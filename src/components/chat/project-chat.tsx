'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useKanbanStore } from '@/store/kanban-store';
import { useChatContextStore } from '@/store/chat-context-store';
import { useAudioContextStore } from '@/store/audio-context-store';
import { useChatUIStore } from '@/store/chat-ui-store';
import { useAuthStore, useNavigationStore, useDataStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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

export default function ProjectChat() {
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
    if (isOpen && projectId) {
      fetchMessages(projectId);
    }
  }, [projectId, isOpen, fetchMessages]);

  useEffect(() => {
    if (!isOpen || !projectId) {
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
  }, [isOpen, projectId]);

  useEffect(() => {
    if (isOpen || !projectId) return;
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
  }, [isOpen, projectId]);

  useEffect(() => {
    if (isOpen && messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, close]);

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

          {/* Chat panel — slides in from the LEFT (always on the left side,
              consistent with the sidebar's chat section) */}
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

            {/* Messages */}
            <div className="flex-1 overflow-y-auto">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800/40 border border-slate-700/30 flex items-center justify-center mb-3">
                    <MessageCircle className="w-6 h-6 text-slate-700" />
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">No messages yet</p>
                  <p className="text-[10px] text-slate-700 mt-1 leading-relaxed">
                    Start the conversation. Use <span className="text-cyan-500/70">@</span> to reference tasks
                    {activeTrackId && <> or <Clock className="inline w-2.5 h-2.5" /> to link timestamps</>}
                  </p>
                </div>
              )}
              {messages.map((msg, idx) => renderMessage(msg, idx))}
              <div ref={messagesEndRef} />
            </div>

            {/* Mention dropdown */}
            {showMentionDropdown && mentionResults.length > 0 && (
              <div className="border-t border-slate-800/60 max-h-[160px] overflow-y-auto bg-[#0c0c14]">
                {mentionResults.map((result, idx) => {
                  const style = result.type === 'task' ? { color: '#00d9ff', label: 'Task' } : { color: '#a855f7', label: 'Subtask' };
                  return (
                    <button
                      key={result.id}
                      onClick={() => selectMention(result)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors duration-75',
                        idx === mentionIndex ? 'bg-slate-800/60' : 'hover:bg-slate-800/30',
                      )}
                    >
                      <AtSign className="w-3 h-3 flex-shrink-0" style={{ color: style.color }} />
                      <span className="text-[11px] text-slate-300 truncate flex-1">{result.title}</span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: style.color + '15', color: style.color }}>
                        {style.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Input area */}
            <div className="flex-shrink-0 border-t border-slate-800/60 bg-slate-900/40 p-3">
              {activeTrackId && (
                <div className="mb-2 flex items-center gap-1.5 text-[10px] text-[#8A2BE2]/70">
                  <Clock className="w-2.5 h-2.5" />
                  <span>Audio linked · {formatTimestamp(currentTime)}</span>
                  <button onClick={insertTimestamp} className="ml-auto text-[#8A2BE2] hover:underline font-medium">
                    + Insert timestamp
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message... (@ for tasks)"
                    className="w-full bg-slate-800/50 border border-slate-700/40 rounded-lg px-3 py-2 pr-9 text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 focus:bg-slate-800/70 transition-all"
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-700/50 text-slate-600 hover:text-cyan-400 transition-all"
                    title="Reference a task"
                  >
                    <AtSign className="w-3.5 h-3.5" />
                  </button>
                </div>
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={!inputValue.trim() || sending}
                  className="h-9 w-9 p-0 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white flex-shrink-0 transition-all shadow-lg shadow-cyan-500/20"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
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
