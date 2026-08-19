'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useKanbanStore } from '@/store/kanban-store';
import { useChatContextStore } from '@/store/chat-context-store';
import { useAudioContextStore } from '@/store/audio-context-store';
import { useChatUIStore } from '@/store/chat-ui-store';
import { useAuthStore, useNavigationStore, useDataStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import {
  X, Send, AtSign, Trash2, Clock, MessageCircle,
  CheckCircle2, AlertCircle, Circle,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  content: string;
  author: string;
  projectId: string | null;
  userId?: string | null;
  user?: { id: string; displayName: string; avatarUrl: string | null } | null;
  referencedTaskId: string | null;
  referencedTask: { id: string; title: string; status: string } | null;
  createdAt: string;
}

interface MentionResult {
  id: string;
  title: string;
  type: 'task' | 'subtask';
}

const STATUS_STYLES: Record<string, { color: string; icon: typeof Circle }> = {
  'todo':        { color: '#00d9ff', icon: Circle },
  'in-progress': { color: '#ff8c00', icon: Clock },
  'review':      { color: '#ff3366', icon: AlertCircle },
  'done':        { color: '#00ff88', icon: CheckCircle2 },
};

function stripMentionTags(text: string): string {
  return text.replace(/\s*@task:[a-zA-Z0-9]+/g, '');
}

function extractMentionId(text: string): string | null {
  const m = text.match(/@task:([a-zA-Z0-9]+)/);
  return m ? m[1] : null;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds % 1) * 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

function parseTimestamps(text: string): { text: string; timestamp: string }[] {
  const regex = /\[(\d{1,2}):(\d{2})(?:\.(\d))?\]/g;
  const parts: { text: string; timestamp: string }[] = [];
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const mins = parseInt(match[1]);
    const secs = parseInt(match[2]);
    const tenths = match[3] ? parseInt(match[3]) : 0;
    const ts = formatTimestamp(mins * 60 + secs + tenths / 10);
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), timestamp: '' });
    }
    parts.push({ text: match[0], timestamp: ts });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), timestamp: '' });
  }
  return parts;
}

export default function ProjectChat({ embedded = false }: { embedded?: boolean } = {}) {
  const { isOpen, close } = useChatUIStore();
  const { activeChatProjectId, activeChatProjectName } = useChatContextStore();
  const { activeTrackId, currentTime } = useAudioContextStore();
  const user = useAuthStore((s) => s.user);
  const { boardTasks, setSelectedTaskId } = useKanbanStore();
  const navigate = useNavigationStore((s) => s.navigate);
  const tracks = useDataStore((s) => s.tracks);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [mentionResults, setMentionResults] = useState<MentionResult[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mentionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const lastMsgCountRef = useRef(0);

  const projectId = activeChatProjectId;

  // In embedded mode the chat is always visible — treat it as always "open"
  // so the message fetching / polling effects run regardless of useChatUIStore.
  const visible = embedded ? true : isOpen;

  const fetchMessages = useCallback((pid: string) => {
    fetch(`/api/chat?projectId=${pid}`)
      .then(res => res.json())
      .then(data => {
        setMessages(data.messages || []);
        lastMsgCountRef.current = (data.messages || []).length;
        setUnread(0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (visible && projectId) {
      fetchMessages(projectId);
    }
  }, [projectId, visible, fetchMessages]);

  useEffect(() => {
    if (!visible || !projectId) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/chat?projectId=${projectId}`);
        const data = await res.json();
        const msgs: ChatMessage[] = data.messages || [];
        if (msgs.length > lastMsgCountRef.current) {
          setMessages(msgs);
          lastMsgCountRef.current = msgs.length;
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 50);
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [visible, projectId]);

  useEffect(() => {
    if (visible || !projectId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/chat?projectId=${projectId}`);
        const data = await res.json();
        const count = (data.messages || []).length;
        if (count > lastMsgCountRef.current) {
          setUnread(count - lastMsgCountRef.current);
          lastMsgCountRef.current = count;
        }
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [visible, projectId]);

  useEffect(() => {
    if (visible && messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [visible, messages.length]);

  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [visible]);

  // Close on Escape — only in floating (non-embedded) mode
  useEffect(() => {
    if (embedded || !isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, close, embedded]);

  const searchMentions = useCallback(async (query: string) => {
    if (!projectId || !query) {
      setMentionResults([]);
      setShowMentionDropdown(false);
      return;
    }
    try {
      const res = await fetch(`/api/chat?search=${encodeURIComponent(query)}&projectId=${projectId}`);
      const data = await res.json();
      setMentionResults(data.results || []);
      setShowMentionDropdown((data.results || []).length > 0);
      setMentionIndex(0);
    } catch { /* ignore */ }
  }, [projectId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    const atIndex = val.lastIndexOf('@');
    if (atIndex !== -1) {
      const afterAt = val.slice(atIndex + 1);
      if (!afterAt.includes(' ') && afterAt.length > 0 && !afterAt.startsWith('task:')) {
        if (mentionTimeoutRef.current) clearTimeout(mentionTimeoutRef.current);
        mentionTimeoutRef.current = setTimeout(() => searchMentions(afterAt), 200);
        return;
      }
    }
    setShowMentionDropdown(false);
  };

  const selectMention = (mention: MentionResult) => {
    const atIndex = inputValue.lastIndexOf('@');
    const before = inputValue.slice(0, atIndex);
    const newText = `${before}@task:${mention.id} `;
    setInputValue(newText);
    setShowMentionDropdown(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentionDropdown && mentionResults.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(prev => Math.min(prev + 1, mentionResults.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(prev => Math.max(prev - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); selectMention(mentionResults[mentionIndex]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setShowMentionDropdown(false); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const insertTimestamp = () => {
    if (!activeTrackId) return;
    const ts = `[${formatTimestamp(currentTime)}]`;
    const pos = inputRef.current?.selectionStart ?? inputValue.length;
    const newVal = inputValue.slice(0, pos) + ts + ' ' + inputValue.slice(pos);
    setInputValue(newVal);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos + ts.length + 1, pos + ts.length + 1);
    }, 0);
  };

  const handleTimestampClick = (timestamp: string) => {
    if (!activeTrackId) return;
    const track = tracks.find(t => t.id === activeTrackId);
    if (track) navigate('track-detail', track.projectId, track.id);
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || sending || !projectId) return;
    setSending(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, projectId, userId: user?.id, author: user?.displayName }),
      });
      const msg = await res.json();
      setMessages(prev => [...prev, msg]);
      lastMsgCountRef.current += 1;
      setInputValue('');
      setShowMentionDropdown(false);
      setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 50);
    } catch { /* ignore */ }
    setSending(false);
  };

  const handleDelete = async (msgId: string) => {
    await fetch(`/api/chat?id=${msgId}`, { method: 'DELETE' });
    setMessages(prev => prev.filter(m => m.id !== msgId));
    lastMsgCountRef.current = Math.max(0, lastMsgCountRef.current - 1);
  };

  const handleTaskClick = (taskId: string) => {
    const foundInBoard = boardTasks.find(t => t.id === taskId);
    if (foundInBoard) { setSelectedTaskId(taskId); }
    else {
      for (const bt of boardTasks) {
        if (bt.children?.some(c => c.id === taskId)) { setSelectedTaskId(bt.id); break; }
      }
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return time;
    return `${d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} ${time}`;
  };

  const renderTaskRef = (task: { id: string; title: string; status: string }) => {
    const style = STATUS_STYLES[task.status] || STATUS_STYLES['todo'];
    const StatusIcon = style.icon;
    return (
      <button
        onClick={() => handleTaskClick(task.id)}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all duration-150 hover:brightness-125 mt-1 cursor-pointer"
        style={{ backgroundColor: style.color + '18', border: `1px solid ${style.color}35`, color: style.color }}
      >
        <StatusIcon className="w-3 h-3" />
        <span className="max-w-[180px] truncate">{task.title}</span>
      </button>
    );
  };

  const renderMessageContent = (content: string) => {
    const cleanText = stripMentionTags(content);
    const parts = parseTimestamps(cleanText);
    if (parts.length === 0) return cleanText;
    return parts.map((part, i) => {
      if (part.timestamp) {
        return (
          <button
            key={i}
            onClick={() => handleTimestampClick(part.timestamp)}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-medium transition-all hover:brightness-125 mx-0.5"
            style={{ backgroundColor: '#8A2BE218', border: '1px solid #8A2BE235', color: '#8A2BE2' }}
          >
            <Clock className="w-2.5 h-2.5" />
            {part.timestamp}
          </button>
        );
      }
      return <span key={i}>{part.text}</span>;
    });
  };

  const renderMessage = (msg: ChatMessage, idx: number) => {
    const displayName = msg.user?.displayName || msg.author;
    const isMe = msg.userId ? msg.userId === user?.id : msg.author === user?.displayName;
    const hasMentionId = extractMentionId(msg.content);
    return (
      <div
        key={msg.id}
        className={cn(
          'group flex gap-2.5 px-3 py-2 transition-colors duration-100',
          isMe ? 'bg-cyan-500/[0.04]' : 'hover:bg-slate-800/15',
          idx % 2 === 0 && !isMe && 'bg-slate-900/20',
        )}
      >
        <div
          className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold mt-0.5"
          style={{ backgroundColor: isMe ? '#00d9ff20' : '#a855f720', color: isMe ? '#00d9ff' : '#a855f7' }}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className={cn('text-[11px] font-semibold', isMe ? 'text-cyan-400' : 'text-purple-400')}>{displayName}</span>
            <span className="text-[9px] text-slate-600">{formatTime(msg.createdAt)}</span>
          </div>
          <p className="text-[12px] text-slate-300 mt-0.5 break-words whitespace-pre-wrap leading-relaxed">
            {renderMessageContent(msg.content)}
          </p>
          {msg.referencedTask && <div className="mt-1.5">{renderTaskRef(msg.referencedTask)}</div>}
          {!msg.referencedTask && hasMentionId && (
            <div className="mt-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] bg-slate-700/40 border border-slate-600/40 text-slate-400">
                <AtSign className="w-2.5 h-2.5" />task
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => handleDelete(msg.id)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-700/50 text-slate-600 hover:text-rose-400 transition-all self-start mt-0.5"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    );
  };

  // ─── Chat body — shared between floating + embedded modes ───
  const chatBody = (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-6">
            <div
              className="flex w-10 h-10 items-center justify-center mb-2"
              style={{
                borderRadius: '8px',
                background: 'rgba(0,240,255,0.05)',
                border: '1px solid rgba(0,240,255,0.2)',
              }}
            >
              <MessageCircle className="w-5 h-5" style={{ color: 'rgba(0,240,255,0.4)' }} />
            </div>
            <p
              className="text-[10px] font-medium"
              style={{ color: '#8892a0', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
            >
              No messages yet
            </p>
            <p
              className="text-[9px] mt-1 leading-relaxed"
              style={{ color: '#4a5568', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
            >
              Start the conversation. Use <span style={{ color: 'rgba(0,240,255,0.7)' }}>@</span> to reference tasks
              {activeTrackId && <> or <Clock className="inline w-2.5 h-2.5" /> to link timestamps</>}
            </p>
          </div>
        )}
        {messages.map((msg, idx) => renderMessage(msg, idx))}
        <div ref={messagesEndRef} />
      </div>

      {/* Mention dropdown */}
      {showMentionDropdown && mentionResults.length > 0 && (
        <div
          className="max-h-[120px] overflow-y-auto custom-scrollbar"
          style={{
            borderTop: '1px solid rgba(0,240,255,0.15)',
            background: 'rgba(10,14,23,0.98)',
          }}
        >
          {mentionResults.map((result, idx) => {
            const style = result.type === 'task' ? { color: '#00d9ff', label: 'Task' } : { color: '#a855f7', label: 'Subtask' };
            return (
              <button
                key={result.id}
                onClick={() => selectMention(result)}
                className={cn(
                  'w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors duration-75',
                  idx === mentionIndex ? 'bg-slate-800/60' : 'hover:bg-slate-800/30',
                )}
              >
                <AtSign className="w-3 h-3 flex-shrink-0" style={{ color: style.color }} />
                <span className="text-[10px] text-slate-300 truncate flex-1">{result.title}</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: style.color + '15', color: style.color }}>
                  {style.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Input area */}
      <div
        className="flex-shrink-0 p-2.5"
        style={{ borderTop: '1px solid rgba(0,240,255,0.15)' }}
      >
        {activeTrackId && (
          <div className="mb-1.5 flex items-center gap-1.5 text-[9px]" style={{ color: 'rgba(138,43,226,0.7)' }}>
            <Clock className="w-2.5 h-2.5" />
            <span>Audio linked · {formatTimestamp(currentTime)}</span>
            <button onClick={insertTimestamp} className="ml-auto hover:underline font-medium" style={{ color: '#8A2BE2' }}>
              + Insert
            </button>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Сообщение… (@ для задач)"
              className="w-full px-2.5 py-1.5 pr-7 text-[11px] focus:outline-none transition-all"
              style={{
                clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
                background: 'rgba(10,20,35,0.6)',
                border: '1px solid rgba(252,238,10,0.3)',
                color: '#ffffff',
                fontFamily: 'var(--font-jetbrains-mono), monospace',
              }}
              disabled={sending}
            />
            <button
              type="button"
              onClick={() => {
                const pos = inputRef.current?.selectionStart ?? inputValue.length;
                const newVal = inputValue.slice(0, pos) + '@' + inputValue.slice(pos);
                setInputValue(newVal);
                setTimeout(() => {
                  inputRef.current?.focus();
                  inputRef.current?.setSelectionRange(pos + 1, pos + 1);
                }, 0);
              }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 transition-all"
              style={{ color: 'rgba(252,238,10,0.6)' }}
              title="Reference a task"
            >
              <AtSign className="w-3 h-3" />
            </button>
          </div>
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || sending}
            className="flex h-8 w-8 shrink-0 items-center justify-center transition-all duration-200"
            style={{
              clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
              background: inputValue.trim() && !sending
                ? 'linear-gradient(135deg, #FCEE0A, #F1F100 50%, #FCEE0A)'
                : 'rgba(10,20,35,0.6)',
              border: inputValue.trim() && !sending
                ? '1.5px solid rgba(252,238,10,0.9)'
                : '1px solid rgba(252,238,10,0.2)',
              boxShadow: inputValue.trim() && !sending
                ? '0 0 14px rgba(252,238,10,0.4), inset 0 1px 0 rgba(255,255,255,0.4)'
                : 'none',
              cursor: inputValue.trim() && !sending ? 'pointer' : 'not-allowed',
            }}
            onMouseEnter={(e) => {
              if (inputValue.trim() && !sending) {
                e.currentTarget.style.boxShadow = '0 0 18px rgba(252,238,10,0.6), 0 0 24px rgba(252,238,10,0.2), inset 0 1px 0 rgba(255,255,255,0.5)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (inputValue.trim() && !sending) {
                e.currentTarget.style.boxShadow = '0 0 14px rgba(252,238,10,0.4), inset 0 1px 0 rgba(255,255,255,0.4)';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            <Send
              className="w-3.5 h-3.5"
              style={{
                color: inputValue.trim() && !sending ? '#000' : 'rgba(252,238,10,0.4)',
              }}
            />
          </button>
        </div>
      </div>
    </>
  );

  // ─── Embedded mode — inline, always visible, fills its parent container ───
  if (embedded) {
    if (!projectId) {
      return null;
    }
    return (
      <div className="flex h-full min-h-0 flex-col">
        {/* Messages header — compact, shows project name + message count */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 shrink-0"
          style={{ borderBottom: '1px solid rgba(0,240,255,0.1)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span
            className="text-[9px] truncate"
            style={{ color: '#8892a0', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
          >
            {messages.length} messages
          </span>
        </div>
        {chatBody}
      </div>
    );
  }

  // ─── Floating mode — slides in from the left as a fixed overlay ───
  return (
    <AnimatePresence>
      {isOpen && projectId && (
        <>
          {/* Backdrop — subtle, click to close */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
          />

          {/* Chat panel — slides in from the LEFT */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed left-0 top-0 bottom-0 z-50 w-full sm:w-[380px] flex flex-col bg-[#0a0a10]/95 backdrop-blur-2xl border-r border-cyan-500/15 shadow-2xl shadow-black/60"
            style={{
              backgroundImage: 'radial-gradient(ellipse at top left, rgba(0,217,255,0.04), transparent 60%)',
            }}
          >
            {/* Glow accent line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60 bg-slate-900/40 flex-shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate">
                    {activeChatProjectName || 'Project Chat'}
                  </p>
                  <p className="text-[10px] text-slate-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {messages.length} messages
                  </p>
                </div>
              </div>
              <button
                onClick={close}
                className="p-1.5 rounded-lg hover:bg-slate-800/60 text-slate-500 hover:text-slate-300 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {chatBody}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Export unread count hook for the header button
export function useChatUnread() {
  const { isOpen } = useChatUIStore();
  const { activeChatProjectId } = useChatContextStore();
  const [unread, setUnread] = useState(0);
  const lastMsgCountRef = useRef(0);

  useEffect(() => {
    if (isOpen || !activeChatProjectId) return;
    const fetchUnread = async () => {
      try {
        const res = await fetch(`/api/chat?projectId=${activeChatProjectId}`);
        const data = await res.json();
        const count = (data.messages || []).length;
        if (count > lastMsgCountRef.current) {
          setUnread(count - lastMsgCountRef.current);
          lastMsgCountRef.current = count;
        }
      } catch { /* ignore */ }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 5000);
    return () => clearInterval(interval);
  }, [isOpen, activeChatProjectId]);

  // Reset unread when chat opens
  useEffect(() => {
    if (isOpen) setUnread(0);
  }, [isOpen]);

  return unread;
}
