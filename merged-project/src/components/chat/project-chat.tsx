'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useKanbanStore } from '@/store/kanban-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  MessageCircle, X, Send, AtSign, Trash2,
  ChevronDown, ChevronUp, CheckCircle2, Clock, AlertCircle, Circle,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  content: string;
  author: string;
  projectId: string | null;
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

// Strip @task:id tags from displayed text
function stripMentionTags(text: string): string {
  return text.replace(/\s*@task:[a-zA-Z0-9]+/g, '');
}

// Find @task:id in text and return the ID
function extractMentionId(text: string): string | null {
  const m = text.match(/@task:([a-zA-Z0-9]+)/);
  return m ? m[1] : null;
}

export default function ProjectChat() {
  const { selectedProjectId, boardTasks, setSelectedTaskId } = useKanbanStore();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [authorName, setAuthorName] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('chat-author') || '';
    return '';
  });
  const [isAuthorEditing, setIsAuthorEditing] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
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

  // Fetch messages and update state (used in effects)
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

  // Load messages when chat opens
  const prevIsOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current && selectedProjectId) {
      fetchMessages(selectedProjectId);
    }
    prevIsOpenRef.current = isOpen;
  });

  // Reload when project changes while chat is open
  useEffect(() => {
    if (isOpen && selectedProjectId) {
      fetchMessages(selectedProjectId);
    }
  }, [selectedProjectId, isOpen, fetchMessages]);

  // Poll for new messages when open
  useEffect(() => {
    if (!isOpen || !selectedProjectId) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/chat?projectId=${selectedProjectId}`);
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
  }, [isOpen, selectedProjectId]);

  // Count unread when closed
  useEffect(() => {
    if (isOpen || !selectedProjectId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/chat?projectId=${selectedProjectId}`);
        const data = await res.json();
        const count = (data.messages || []).length;
        if (count > lastMsgCountRef.current) {
          setUnread(count - lastMsgCountRef.current);
          lastMsgCountRef.current = count;
        }
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [isOpen, selectedProjectId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [isOpen, messages.length]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Search for mentions
  const searchMentions = useCallback(async (query: string) => {
    if (!selectedProjectId || !query) {
      setMentionResults([]);
      setShowMentionDropdown(false);
      return;
    }
    try {
      const res = await fetch(`/api/chat?search=${encodeURIComponent(query)}&projectId=${selectedProjectId}`);
      const data = await res.json();
      setMentionResults(data.results || []);
      setShowMentionDropdown((data.results || []).length > 0);
      setMentionIndex(0);
    } catch { /* ignore */ }
  }, [selectedProjectId]);

  // Handle input change with @ detection
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    // Detect @ mention: find the word after the last @
    const atIndex = val.lastIndexOf('@');
    if (atIndex !== -1) {
      const afterAt = val.slice(atIndex + 1);
      if (!afterAt.includes(' ') && afterAt.length > 0 && !afterAt.startsWith('task:')) {
        setMentionQuery(afterAt);
        if (mentionTimeoutRef.current) clearTimeout(mentionTimeoutRef.current);
        mentionTimeoutRef.current = setTimeout(() => searchMentions(afterAt), 200);
        return;
      }
    }
    setShowMentionDropdown(false);
    setMentionQuery('');
  };

  // Select a mention
  const selectMention = (mention: MentionResult) => {
    const atIndex = inputValue.lastIndexOf('@');
    const before = inputValue.slice(0, atIndex);
    const newText = `${before}@task:${mention.id} `;
    setInputValue(newText);
    setShowMentionDropdown(false);
    setMentionQuery('');
    inputRef.current?.focus();
  };

  // Handle keyboard in input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentionDropdown && mentionResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => Math.min(prev + 1, mentionResults.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectMention(mentionResults[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionDropdown(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Send message
  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const author = authorName.trim() || 'Пользователь';
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, projectId: selectedProjectId, author }),
      });
      const msg = await res.json();
      setMessages(prev => [...prev, msg]);
      lastMsgCountRef.current += 1;
      setInputValue('');
      setShowMentionDropdown(false);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    } catch { /* ignore */ }
    setSending(false);
  };

  // Delete message
  const handleDelete = async (msgId: string) => {
    await fetch(`/api/chat?id=${msgId}`, { method: 'DELETE' });
    setMessages(prev => prev.filter(m => m.id !== msgId));
    lastMsgCountRef.current = Math.max(0, lastMsgCountRef.current - 1);
  };

  // Navigate to referenced task
  const handleTaskClick = (taskId: string) => {
    const foundInBoard = boardTasks.find(t => t.id === taskId);
    if (foundInBoard) {
      setSelectedTaskId(taskId);
    } else {
      for (const bt of boardTasks) {
        if (bt.children?.some(c => c.id === taskId)) {
          setSelectedTaskId(bt.id);
          break;
        }
      }
    }
  };

  // Save author name
  const saveAuthor = () => {
    const name = authorName.trim() || 'Пользователь';
    setAuthorName(name);
    localStorage.setItem('chat-author', name);
    setIsAuthorEditing(false);
  };

  // Format time
  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return time;
    return `${d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} ${time}`;
  };

  // Render referenced task chip in message
  const renderTaskRef = (task: { id: string; title: string; status: string }) => {
    const style = STATUS_STYLES[task.status] || STATUS_STYLES['todo'];
    const StatusIcon = style.icon;
    return (
      <button
        onClick={() => handleTaskClick(task.id)}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all duration-150 hover:brightness-125 mt-1 cursor-pointer"
        style={{
          backgroundColor: style.color + '18',
          border: `1px solid ${style.color}35`,
          color: style.color,
        }}
      >
        <StatusIcon className="w-3 h-3" />
        <span className="max-w-[180px] truncate">{task.title}</span>
      </button>
    );
  };

  // Render a single message
  const renderMessage = (msg: ChatMessage, idx: number) => {
    const isMe = msg.author === (authorName.trim() || 'Пользователь');
    const cleanText = stripMentionTags(msg.content);
    const hasMentionId = extractMentionId(msg.content);

    return (
      <div
        key={msg.id}
        className={cn(
          'group flex gap-2.5 px-3 py-2 transition-colors duration-100',
          isMe ? 'bg-slate-800/20' : 'hover:bg-slate-800/15',
          idx % 2 === 0 && !isMe && 'bg-slate-900/30',
        )}
      >
        {/* Avatar */}
        <div
          className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold mt-0.5"
          style={{
            backgroundColor: isMe ? '#00d9ff25' : '#a855f725',
            color: isMe ? '#00d9ff' : '#a855f7',
          }}
        >
          {msg.author.charAt(0).toUpperCase()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className={cn('text-[11px] font-semibold', isMe ? 'text-cyan-400' : 'text-purple-400')}>
              {msg.author}
            </span>
            <span className="text-[9px] text-slate-600">{formatTime(msg.createdAt)}</span>
          </div>
          <p className="text-[12px] text-slate-300 mt-0.5 break-words whitespace-pre-wrap leading-relaxed">
            {cleanText}
          </p>
          {/* Referenced task from DB */}
          {msg.referencedTask && (
            <div className="mt-1.5">
              {renderTaskRef(msg.referencedTask)}
            </div>
          )}
          {/* Mentioned task parsed from text (fallback) */}
          {!msg.referencedTask && hasMentionId && (
            <div className="mt-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] bg-slate-700/40 border border-slate-600/40 text-slate-400">
                <AtSign className="w-2.5 h-2.5" />
                задача
              </span>
            </div>
          )}
        </div>

        {/* Delete button */}
        <button
          onClick={() => handleDelete(msg.id)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-700/50 text-slate-600 hover:text-rose-400 transition-all self-start mt-0.5"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    );
  };

  // No project selected - show disabled chat
  if (!selectedProjectId) {
    return (
      <div className="fixed bottom-16 right-4 z-50">
        <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-slate-600 cursor-not-allowed">
          <MessageCircle className="w-5 h-5" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-16 right-4 z-50 flex flex-col items-end gap-2">
      {/* Chat panel */}
      {isOpen && (
        <div className="w-[360px] max-w-[calc(100vw-2rem)] h-[480px] max-h-[calc(100vh-8rem)] bg-[#0a0a10] border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/60 bg-slate-900/50 flex-shrink-0">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-slate-300">Чат проекта</span>
              <span className="text-[9px] text-slate-600 bg-slate-800/60 px-1.5 py-0.5 rounded-full">
                {messages.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {isAuthorEditing ? (
                <input
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveAuthor()}
                  onBlur={saveAuthor}
                  autoFocus
                  className="bg-slate-800 border border-slate-600/50 rounded px-1.5 py-0.5 text-[10px] text-slate-300 w-20 h-5 focus:outline-none focus:border-cyan-500/50"
                  placeholder="Имя..."
                />
              ) : (
                <button
                  onClick={() => setIsAuthorEditing(true)}
                  className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors px-1.5 py-0.5 rounded hover:bg-slate-800/50"
                  title="Изменить имя"
                >
                  {authorName || 'Пользователь'}
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-slate-800/50 text-slate-500 hover:text-slate-300 transition-all"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <MessageCircle className="w-8 h-8 text-slate-800 mb-3" />
                <p className="text-[11px] text-slate-600 font-medium">Нет сообщений</p>
                <p className="text-[10px] text-slate-700 mt-1">
                  Начните обсуждение. Используйте{' '}
                  <span className="text-cyan-500/70">@</span>{' '}
                  для ссылки на задачи
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
                const style = result.type === 'task'
                  ? { color: '#00d9ff', label: 'Задача' }
                  : { color: '#a855f7', label: 'Подзадача' };
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
                    <span
                      className="text-[8px] px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{
                        backgroundColor: style.color + '15',
                        color: style.color,
                      }}
                    >
                      {style.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Input area */}
          <div className="flex-shrink-0 border-t border-slate-800/60 bg-slate-900/30 p-2.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Написать... (@ для задачи)"
                  className="w-full bg-slate-800/50 border border-slate-700/40 rounded-lg px-3 py-2 pr-8 text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 transition-colors"
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
                  title="Ссылка на задачу"
                >
                  <AtSign className="w-3.5 h-3.5" />
                </button>
              </div>
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!inputValue.trim() || sending}
                className="h-8 w-8 p-0 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white flex-shrink-0 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg',
          isOpen
            ? 'bg-slate-800/90 border border-slate-600/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700/90'
            : 'bg-cyan-600/90 hover:bg-cyan-500 text-white',
        )}
        style={!isOpen ? { boxShadow: '0 4px 20px rgba(0, 217, 255, 0.25)' } : undefined}
      >
        {isOpen
          ? <ChevronDown className="w-5 h-5" />
          : <MessageCircle className="w-5 h-5" />
        }
        {/* Unread badge */}
        {!isOpen && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  );
}
