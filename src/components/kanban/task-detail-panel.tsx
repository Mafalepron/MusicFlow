'use client';

import { useState, useEffect, useCallback } from 'react';
import { useKanbanStore, Task, TaskStatus, TaskPriority, TaskCategory, TaskChild } from '@/store/kanban-store';
import { useNavigationStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Check, Circle, Clock, Eye, Plus, Trash2, Pencil,
  ChevronRight, X, Save, Music, AudioWaveform,
  ArrowRight, AlertTriangle, Flame, CalendarDays, User, ListChecks,
} from 'lucide-react';
import DeadlinePicker, { getDeadlineInfo } from '@/components/kanban/deadline-picker';
import { cn, boardColorStyles, hexToRgba } from '@/lib/utils';

const STATUSES: { value: TaskStatus; label: string; color: string; dot: string }[] = [
  { value: 'todo', label: 'К выполнению', color: 'text-cyan-400', dot: '#22d3ee' },
  { value: 'in-progress', label: 'В работе', color: 'text-orange-400', dot: '#fb923c' },
  { value: 'review', label: 'На проверке', color: 'text-rose-400', dot: '#fb7185' },
  { value: 'done', label: 'Готово', color: 'text-emerald-400', dot: '#34d399' },
];

const PRIORITIES: { value: TaskPriority; label: string; dot: string; text: string }[] = [
  { value: 'low', label: 'Низкий', dot: 'bg-slate-500', text: 'text-slate-400' },
  { value: 'medium', label: 'Средний', dot: 'bg-amber-500', text: 'text-amber-400' },
  { value: 'high', label: 'Высокий', dot: 'bg-rose-500', text: 'text-rose-400' },
];

const CATEGORIES: { value: TaskCategory; label: string }[] = [
  { value: 'rehearsal', label: '🎤 Репетиция' },
  { value: 'recording', label: '🎵 Запись' },
  { value: 'performance', label: '🎪 Выступление' },
  { value: 'marketing', label: '📢 Маркетинг' },
  { value: 'social', label: '📱 Соцсети' },
  { value: 'general', label: '📋 Общее' },
];

const PRIORITY_DOT_HEX: Record<string, string> = {
  low: '#64748b',
  medium: '#f59e0b',
  high: '#f43f5e',
};

const STATUS_DOT_HEX: Record<string, string> = {
  todo: '#22d3ee',
  'in-progress': '#fb923c',
  review: '#fb7185',
  done: '#34d399',
};

const DESC_LIMIT = 600;

export default function TaskDetailPanel() {
  const {
    boardTasks, selectedTaskId, setBoardTasks,
    selectedBoardId, boards,
    editingTask, isCreating, setEditingTask, setIsCreating,
  } = useKanbanStore();

  const selectedTask = boardTasks.find(t => t.id === selectedTaskId);
  const selectedBoard = boards.find(b => b.id === selectedBoardId);

  const boardColor = selectedBoard?.color || '#00d9ff';

  if (isCreating) return <TaskForm mode="create" boardColor={boardColor} />;
  if (editingTask) return <TaskForm mode="edit" task={editingTask} boardColor={boardColor} />;

  if (!selectedTask) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800/50 flex items-center justify-center mb-3">
          <Pencil className="w-5 h-5 text-slate-700" />
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Выберите задачу в панели<br />сверху для просмотра и редактирования
        </p>
      </div>
    );
  }

  // Track detail view for tracks with 3-level hierarchy
  if (selectedTask.trackConfig) {
    return <TrackDetailView task={selectedTask} board={selectedBoard} />;
  }

  return <TaskDetailView task={selectedTask} board={selectedBoard} />;
}

/* ── Track Detail View (info-only — stages/subtasks moved to bottom panel) ──── */

function TrackDetailView({ task, board }: { task: Task; board?: { title: string; color: string } }) {
  const { setBoardTasks, selectedBoardId, setEditingTask, setSelectedTaskId, setSelectedStageForPanel } = useKanbanStore();
  const [descDraft, setDescDraft] = useState(task.description || '');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [savingDesc, setSavingDesc] = useState(false);

  const config = task.trackConfig ? JSON.parse(task.trackConfig) : null;
  const stages = task.children || [];
  const allSubtasks = stages.flatMap(s => s.children || []);
  const progress = getProgress(allSubtasks);
  const boardColor = board?.color || '#00d9ff';
  const bc = boardColorStyles(boardColor);

  const getProgressColor = () => {
    if (progress === 100) return '#10b981';
    if (progress > 50) return boardColor;
    if (progress > 0) return '#f59e0b';
    return '#334155';
  };
  const getProgressTextColor = () => {
    if (progress === 100) return '#34d399';
    if (progress > 50) return boardColor;
    if (progress > 0) return '#f59e0b';
    return '#475569';
  };

  const reloadTasks = useCallback(async () => {
    if (!selectedBoardId) return;
    const res = await fetch(`/api/tasks?boardId=${selectedBoardId}&deep=true`);
    const data = await res.json();
    setBoardTasks(data.tasks);
  }, [selectedBoardId, setBoardTasks]);

  const saveDesc = useCallback(async () => {
    if (savingDesc) return;
    setSavingDesc(true);
    try {
      await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, description: descDraft.trim() || null }),
      });
      setIsEditingDesc(false);
      await reloadTasks();
    } finally {
      setSavingDesc(false);
    }
  }, [task.id, descDraft, savingDesc, reloadTasks]);

  // Sync descDraft when task changes (prev-tracker pattern avoids useEffect-setState)
  const [prevTaskDesc, setPrevTaskDesc] = useState<string | null>(task.description);
  if (task.description !== prevTaskDesc) {
    setPrevTaskDesc(task.description);
    if (!isEditingDesc) setDescDraft(task.description || '');
  }

  const handleDelete = async () => {
    await fetch(`/api/tasks?id=${task.id}`, { method: 'DELETE' });
    setSelectedTaskId(null);
    setSelectedStageForPanel(null);
    if (selectedBoardId) {
      const res = await fetch(`/api/tasks?boardId=${selectedBoardId}&deep=true`);
      const data = await res.json();
      setBoardTasks(data.tasks);
    }
  };

  const openManageStages = () => {
    if (stages.length > 0) {
      setSelectedStageForPanel({ taskId: task.id, stageId: stages[0].id });
    } else {
      // Still open so user can add stages
      setSelectedStageForPanel({ taskId: task.id, stageId: '' });
    }
  };

  const deadlineInfo = getDeadlineInfo(task.deadline || null);
  const priorityHex = PRIORITY_DOT_HEX[task.priority] || '#64748b';
  const statusHex = STATUS_DOT_HEX[task.status] || '#22d3ee';

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-800/50 p-4">
        <div className="flex items-center gap-1.5 mb-2.5">
          <span
            className="text-[9px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider"
            style={{ color: boardColor, backgroundColor: hexToRgba(boardColor, 0.12) }}
          >
            Трек
          </span>
          <div className="flex-1" />
          <button
            onClick={() => setEditingTask(task)}
            className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
            title="Редактировать"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => void handleDelete()}
            className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition-colors"
            title="Удалить"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <h3 className="text-base font-semibold text-white leading-tight mb-1">{task.title}</h3>
        {task.assignee && (
          <p className="text-[11px] text-slate-500 flex items-center gap-1 mb-1">
            <User className="w-3 h-3" /> {task.assignee}
          </p>
        )}
        {config?.instruments?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {config.instruments.map((inst: string) => (
              <span
                key={inst}
                className="text-[9px] px-1.5 py-0.5 rounded transition-colors"
                style={{ backgroundColor: hexToRgba(boardColor, 0.1), color: boardColor }}
              >
                {inst}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Open in Audio Editor */}
      {task.soundflowTrackId && (
        <div className="px-4 py-3 border-b border-slate-800/30">
          <button
            onClick={async () => {
              const kanbanState = useKanbanStore.getState();
              let kanbanProject = kanbanState.projects.find(p => p.id === kanbanState.selectedProjectId);
              let sfProjectId = kanbanProject?.soundflowProjectId;

              if (!sfProjectId && kanbanState.selectedProjectId) {
                try {
                  const res = await fetch(`/api/tasks?parentId=${kanbanState.selectedProjectId}`);
                  const data = await res.json();
                  if (data.tasks && data.tasks.length > 0) {
                    sfProjectId = data.tasks[0].soundflowProjectId;
                  }
                } catch { /* ignore */ }
              }

              if (!sfProjectId && task.soundflowTrackId) {
                try {
                  const res = await fetch(`/api/tracks/${task.soundflowTrackId}`);
                  if (res.ok) {
                    const track = await res.json();
                    sfProjectId = track.projectId || track.project?.id;
                  }
                } catch { /* ignore */ }
              }

              if (sfProjectId && task.soundflowTrackId) {
                useNavigationStore.getState().navigate('track-detail', sfProjectId, task.soundflowTrackId);
              }
            }}
            className="w-full flex items-center justify-center gap-2 text-[11px] font-semibold text-white px-3 py-2 rounded-md transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
            style={{
              background: 'linear-gradient(135deg, #06b6d4 0%, #14b8a6 100%)',
              boxShadow: '0 2px 10px rgba(6, 182, 212, 0.35), 0 0 18px rgba(20, 184, 166, 0.18)',
            }}
          >
            <AudioWaveform className="w-3.5 h-3.5" />
            Открыть в аудиоредакторе
          </button>
        </div>
      )}

      {/* Description (inline editable) */}
      <div className="border-b border-slate-800/30 px-4 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <span
            className="text-[9px] uppercase tracking-widest font-medium"
            style={{ color: hexToRgba(boardColor, 0.55) }}
          >
            Описание
          </span>
          {!isEditingDesc && (
            <button
              onClick={() => { setDescDraft(task.description || ''); setIsEditingDesc(true); }}
              className="text-[9px] px-1.5 py-0.5 rounded transition-colors flex items-center gap-1"
              style={{ color: hexToRgba(boardColor, 0.5) }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = boardColor; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = hexToRgba(boardColor, 0.5); }}
            >
              <Pencil className="w-2.5 h-2.5" /> Изменить
            </button>
          )}
        </div>
        {isEditingDesc ? (
          <div className="space-y-1.5">
            <Textarea
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value.slice(0, DESC_LIMIT))}
              placeholder="Опишите трек..."
              className="bg-slate-900/80 border-slate-700/50 text-[11px] text-slate-300 placeholder:text-slate-600 min-h-[70px] resize-none focus:outline-none transition-colors"
              style={{ borderColor: hexToRgba(boardColor, 0.3) }}
              autoFocus
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  void saveDesc();
                }
                if (e.key === 'Escape') {
                  setIsEditingDesc(false);
                  setDescDraft(task.description || '');
                }
              }}
              onBlur={() => {
                if (descDraft.trim() !== (task.description || '').trim()) {
                  void saveDesc();
                } else {
                  setIsEditingDesc(false);
                }
              }}
            />
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-slate-600 tabular-nums">{descDraft.length}/{DESC_LIMIT}</span>
              <span className="text-[8px] text-slate-700">Ctrl+Enter — сохранить</span>
            </div>
          </div>
        ) : task.description ? (
          <p className="text-[11px] text-slate-400 leading-relaxed whitespace-pre-wrap">
            {task.description}
          </p>
        ) : (
          <button
            onClick={() => { setDescDraft(''); setIsEditingDesc(true); }}
            className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors"
          >
            Нажмите, чтобы добавить описание...
          </button>
        )}
      </div>

      {/* Metadata row */}
      <div className="border-b border-slate-800/30 px-4 py-3 space-y-2">
        <span
          className="text-[9px] uppercase tracking-widest font-medium block mb-1"
          style={{ color: hexToRgba(boardColor, 0.55) }}
        >
          Метаданные
        </span>

        {/* Status */}
        <MetaRow icon={<Circle className="w-2.5 h-2.5" style={{ color: statusHex }} />} label="Статус">
          <span className="text-[11px] font-medium" style={{ color: statusHex }}>
            {STATUSES.find(s => s.value === task.status)?.label || task.status}
          </span>
        </MetaRow>

        {/* Priority */}
        <MetaRow icon={<span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: priorityHex }} />} label="Приоритет">
          <span className={cn('text-[11px] font-medium', PRIORITIES.find(p => p.value === task.priority)?.text)}>
            {PRIORITIES.find(p => p.value === task.priority)?.label || task.priority}
          </span>
        </MetaRow>

        {/* Assignee */}
        {task.assignee && (
          <MetaRow
            icon={
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                style={{ backgroundColor: hexToRgba(boardColor, 0.6) }}
              >
                {task.assignee.charAt(0).toUpperCase()}
              </span>
            }
            label="Ответственный"
          >
            <span className="text-[11px] text-slate-300">{task.assignee}</span>
          </MetaRow>
        )}

        {/* Deadline */}
        {task.deadline && (
          <MetaRow
            icon={<CalendarDays className="w-3 h-3"
              style={{
                color: deadlineInfo.status === 'overdue' ? '#fb7185' :
                  deadlineInfo.status === 'urgent' ? '#f59e0b' :
                  deadlineInfo.status === 'soon' ? '#22d3ee' : '#64748b'
              }}
            />}
            label="Дедлайн"
          >
            <DeadlineBadge value={task.deadline} info={deadlineInfo} />
          </MetaRow>
        )}
      </div>
    </div>
  );
}

/* ── Meta row helper ──────────────────────────────────── */

function MetaRow({
  icon, label, children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-shrink-0 w-4 flex items-center justify-center">{icon}</div>
      <span className="text-[10px] text-slate-600 flex-shrink-0 w-20">{label}</span>
      <div className="flex-1 min-w-0 truncate">{children}</div>
    </div>
  );
}

function DeadlineBadge({
  value, info,
}: {
  value: string;
  info: { daysLeft: number; status: string };
}) {
  const d = new Date(value);
  const day = String(d.getDate()).padStart(2, '0');
  const month = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'][d.getMonth()];
  const color = info.status === 'overdue' ? '#fb7185' :
    info.status === 'urgent' ? '#f59e0b' :
    info.status === 'soon' ? '#22d3ee' : '#94a3b8';

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-medium" style={{ color }}>{day} {month}</span>
      {info.status === 'overdue' && (
        <span className="flex items-center gap-0.5 text-[9px] font-bold text-rose-400 bg-rose-500/15 px-1.5 py-0.5 rounded-full">
          <AlertTriangle className="w-2.5 h-2.5" />{Math.abs(info.daysLeft)}д
        </span>
      )}
      {info.status === 'urgent' && (
        <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-full">
          <Flame className="w-2.5 h-2.5" />{info.daysLeft}д
        </span>
      )}
    </div>
  );
}

/* ── Regular Task Detail View (simplified — subtasks summary + manage hint) ──── */

function TaskDetailView({ task, board }: { task: Task; board?: { title: string; color: string } }) {
  const { setBoardTasks, selectedBoardId, setEditingTask, setSelectedTaskId, setSelectedStageForPanel } = useKanbanStore();
  const [descDraft, setDescDraft] = useState(task.description || '');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [savingDesc, setSavingDesc] = useState(false);

  const boardColor = board?.color || '#00d9ff';
  const subtasks = task.children || [];
  const progress = getProgress(subtasks);

  const getProgressColor = () => {
    if (progress === 100) return '#10b981';
    if (progress > 50) return boardColor;
    if (progress > 0) return '#f59e0b';
    return '#334155';
  };
  const getProgressTextColor = () => {
    if (progress === 100) return '#34d399';
    if (progress > 50) return boardColor;
    if (progress > 0) return '#f59e0b';
    return '#475569';
  };

  const reloadTasks = useCallback(async () => {
    if (!selectedBoardId) return;
    const res = await fetch(`/api/tasks?boardId=${selectedBoardId}`);
    const data = await res.json();
    setBoardTasks(data.tasks);
  }, [selectedBoardId, setBoardTasks]);

  const saveDesc = useCallback(async () => {
    if (savingDesc) return;
    setSavingDesc(true);
    try {
      await fetch('/api/tasks', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, description: descDraft.trim() || null }),
      });
      setIsEditingDesc(false);
      await reloadTasks();
    } finally {
      setSavingDesc(false);
    }
  }, [task.id, descDraft, savingDesc, reloadTasks]);

  // Sync descDraft when task changes (prev-tracker pattern)
  const [prevTaskDesc, setPrevTaskDesc] = useState<string | null>(task.description);
  if (task.description !== prevTaskDesc) {
    setPrevTaskDesc(task.description);
    if (!isEditingDesc) setDescDraft(task.description || '');
  }

  const updateTaskDeadline = async (deadline: string | null) => {
    await fetch('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: task.id, deadline }) });
    await reloadTasks();
  };

  const handleDeleteTask = async () => {
    await fetch(`/api/tasks?id=${task.id}`, { method: 'DELETE' });
    setSelectedTaskId(null);
    setSelectedStageForPanel(null);
    if (selectedBoardId) {
      const res = await fetch(`/api/tasks?boardId=${selectedBoardId}`);
      const data = await res.json();
      setBoardTasks(data.tasks);
    }
  };

  const openManageSubtasks = () => {
    setSelectedStageForPanel({ taskId: task.id, stageId: '' });
  };

  const deadlineInfo = getDeadlineInfo(task.deadline || null);
  const priorityHex = PRIORITY_DOT_HEX[task.priority] || '#64748b';
  const statusHex = STATUS_DOT_HEX[task.status] || '#22d3ee';
  const doneCount = subtasks.filter(s => s.status === 'done').length;

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-800/50 p-4">
        <div className="flex items-center gap-1.5 mb-2.5">
          {board && (
            <span
              className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium"
              style={{ color: boardColor, backgroundColor: hexToRgba(boardColor, 0.12) }}
            >
              {board.title}
            </span>
          )}
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{ color: statusHex, backgroundColor: hexToRgba(statusHex, 0.12) }}
          >
            {STATUSES.find(s => s.value === task.status)?.label || task.status}
          </span>
          <div className="flex-1" />
          <button onClick={() => setEditingTask(task)} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => void handleDeleteTask()} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <h3 className={cn('text-sm font-semibold leading-tight mb-1', task.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-100')}>
          {task.title}
        </h3>
        {/* Metadata summary line */}
        <div className="flex items-center gap-3 flex-wrap text-[10px] text-slate-500">
          {task.assignee && (
            <span className="flex items-center gap-1">
              <span
                className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold text-white"
                style={{ backgroundColor: hexToRgba(boardColor, 0.6) }}
              >
                {task.assignee.charAt(0).toUpperCase()}
              </span>
              {task.assignee}
            </span>
          )}
          <span className="flex items-center gap-1" style={{ color: priorityHex }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: priorityHex }} />
            {PRIORITIES.find(p => p.value === task.priority)?.label || task.priority}
          </span>
        </div>
      </div>

      {/* Description (inline editable) */}
      <div className="border-b border-slate-800/30 px-4 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] uppercase tracking-widest font-medium" style={{ color: hexToRgba(boardColor, 0.55) }}>
            Описание
          </span>
          {!isEditingDesc && (
            <button
              onClick={() => { setDescDraft(task.description || ''); setIsEditingDesc(true); }}
              className="text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1"
              style={{ color: hexToRgba(boardColor, 0.5) }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = boardColor; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = hexToRgba(boardColor, 0.5); }}
            >
              <Pencil className="w-2.5 h-2.5" /> Изменить
            </button>
          )}
        </div>
        {isEditingDesc ? (
          <Textarea
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value.slice(0, DESC_LIMIT))}
            placeholder="Описание задачи..."
            className="bg-slate-900/80 border-slate-700/50 text-[11px] text-slate-300 placeholder:text-slate-600 min-h-[70px] resize-none focus:outline-none"
            style={{ borderColor: hexToRgba(boardColor, 0.3) }}
            autoFocus
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void saveDesc(); }
              if (e.key === 'Escape') { setIsEditingDesc(false); setDescDraft(task.description || ''); }
            }}
            onBlur={() => {
              if (descDraft.trim() !== (task.description || '').trim()) void saveDesc();
              else setIsEditingDesc(false);
            }}
          />
        ) : task.description ? (
          <p className="text-[11px] text-slate-400 leading-relaxed whitespace-pre-wrap">{task.description}</p>
        ) : (
          <button
            onClick={() => { setDescDraft(''); setIsEditingDesc(true); }}
            className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors"
          >
            Добавить описание...
          </button>
        )}
      </div>

      {/* Deadline */}
      <div className="border-b border-slate-800/30 px-4 py-3">
        <span className="text-[9px] uppercase tracking-widest font-medium block mb-1.5" style={{ color: hexToRgba(boardColor, 0.55) }}>
          Дедлайн
        </span>
        <DeadlinePicker value={task.deadline || null} onChange={(d) => void updateTaskDeadline(d)} isDone={task.status === 'done'} size="md" />
        {task.deadline && deadlineInfo.status !== 'ok' && deadlineInfo.status !== 'done' && (
          <p className="text-[9px] mt-1" style={{ color: deadlineInfo.status === 'overdue' ? '#fb7185' : deadlineInfo.status === 'urgent' ? '#f59e0b' : '#22d3ee' }}>
            {deadlineInfo.status === 'overdue' ? `Просрочен на ${Math.abs(deadlineInfo.daysLeft)} дн.` : `Осталось ${deadlineInfo.daysLeft} дн.`}
          </p>
        )}
      </div>

      {/* Progress */}
      {subtasks.length > 0 && (
        <div className="border-b border-slate-800/30 px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-slate-400 font-medium">Прогресс</span>
            <span className="text-[11px] font-bold" style={{ color: getProgressTextColor() }}>{progress}%</span>
          </div>
          <div className="relative h-2 bg-slate-800/80 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${progress}%`, backgroundColor: getProgressColor() }} />
            {progress > 0 && progress < 100 && (
              <div
                className="absolute inset-0 rounded-full animate-pulse opacity-20"
                style={{ background: `linear-gradient(90deg, transparent, ${getProgressColor()}, transparent)` }}
              />
            )}
          </div>
          <p className="text-[9px] text-slate-600 mt-1">{doneCount} из {subtasks.length} подзадач выполнено</p>
        </div>
      )}

      {/* Manage subtasks hint */}
      <div className="px-4 py-4 mt-auto">
        <button
          onClick={openManageSubtasks}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg transition-all duration-200 group"
          style={{
            border: `1px solid ${hexToRgba(boardColor, 0.25)}`,
            backgroundColor: hexToRgba(boardColor, 0.06),
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.borderColor = hexToRgba(boardColor, 0.5);
            el.style.backgroundColor = hexToRgba(boardColor, 0.12);
            el.style.boxShadow = `0 0 16px ${hexToRgba(boardColor, 0.15)}`;
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.borderColor = hexToRgba(boardColor, 0.25);
            el.style.backgroundColor = hexToRgba(boardColor, 0.06);
            el.style.boxShadow = 'none';
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <ListChecks className="w-3.5 h-3.5 flex-shrink-0" style={{ color: boardColor }} />
            <div className="min-w-0 text-left">
              <p className="text-[11px] font-semibold text-slate-200 truncate">Управление подзадачами</p>
              <p className="text-[9px] text-slate-500 truncate">
                {subtasks.length > 0 ? `${subtasks.length} подзадач · ${doneCount} выполнено` : 'Создайте и управляйте подзадачами'}
              </p>
            </div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 flex-shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: boardColor }} />
        </button>
      </div>
    </div>
  );
}

/* ── Task Form (create / edit) ──────────── */

function TaskForm({ mode, task, boardColor }: { mode: 'create' | 'edit'; task?: Task; boardColor?: string }) {
  const { selectedBoardId, setBoardTasks, selectedProjectId, setEditingTask, setIsCreating, setSelectedTaskId } = useKanbanStore();
  const color = boardColor || '#00d9ff';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assignee, setAssignee] = useState('');
  const [category, setCategory] = useState<TaskCategory>('general');
  const [deadline, setDeadline] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && task) {
      setTitle(task.title); setDescription(task.description || ''); setStatus(task.status);
      setPriority(task.priority); setAssignee(task.assignee || ''); setCategory(task.category);
      setDeadline(task.deadline || null);
    }
  }, [mode, task]);

  const reloadTasks = useCallback(async () => {
    if (selectedBoardId) {
      const isTracks = useKanbanStore.getState().boards.find(b => b.id === selectedBoardId)?.boardType === 'tracks';
      const url = `/api/tasks?boardId=${selectedBoardId}${isTracks ? '&deep=true' : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      setBoardTasks(data.tasks);
    }
    if (selectedProjectId) {
      const bRes = await fetch(`/api/boards?projectId=${selectedProjectId}`);
      const bData = await bRes.json();
      useKanbanStore.getState().setBoards(bData.boards);
    }
  }, [selectedBoardId, selectedProjectId, setBoardTasks]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (mode === 'edit' && task) {
        await fetch('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: task.id, title, description: description || null, status, priority, assignee: assignee || null, category, boardId: selectedBoardId, deadline }) });
      } else {
        await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, description: description || null, status, priority, assignee: assignee || null, category, parentId: null, boardId: selectedBoardId, deadline }) });
      }
      await reloadTasks(); setEditingTask(null); setIsCreating(false);
      if (mode === 'edit' && task) setSelectedTaskId(task.id);
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!task) return;
    setSaving(true);
    try {
      await fetch(`/api/tasks?id=${task.id}`, { method: 'DELETE' });
      await reloadTasks(); setEditingTask(null); setSelectedTaskId(null);
    } finally { setSaving(false); }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>{mode === 'edit' ? 'Редактировать' : 'Новая задача'}</h3>
          <button onClick={() => { setEditingTask(null); setIsCreating(false); }} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300"><X className="h-3.5 w-3.5" /></button>
        </div>
        <div className="space-y-2.5">
          <div className="space-y-1"><Label className="text-[11px] text-slate-500">Название</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Задача..." className="bg-slate-900/80 border-slate-700/50 text-sm text-slate-200 placeholder:text-slate-600 h-8" onFocus={(e) => { e.target.style.borderColor = color + '80'; }} onBlur={(e) => { e.target.style.borderColor = ''; }} /></div>
          <div className="space-y-1"><Label className="text-[11px] text-slate-500">Описание</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание..." className="bg-slate-900/80 border-slate-700/50 text-xs text-slate-300 placeholder:text-slate-600 min-h-[50px] resize-none" onFocus={(e) => { e.target.style.borderColor = color + '80'; }} onBlur={(e) => { e.target.style.borderColor = ''; }} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-[11px] text-slate-500">Статус</Label><Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}><SelectTrigger className="bg-slate-900/80 border-slate-700/50 text-xs text-slate-200 h-8"><SelectValue /></SelectTrigger><SelectContent className="bg-slate-900 border-slate-700">{STATUSES.map((s) => (<SelectItem key={s.value} value={s.value}><span className={s.color}>{s.label}</span></SelectItem>))}</SelectContent></Select></div>
            <div className="space-y-1"><Label className="text-[11px] text-slate-500">Приоритет</Label><Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}><SelectTrigger className="bg-slate-900/80 border-slate-700/50 text-xs text-slate-200 h-8"><SelectValue /></SelectTrigger><SelectContent className="bg-slate-900 border-slate-700">{PRIORITIES.map((p) => (<SelectItem key={p.value} value={p.value}><div className="flex items-center gap-1.5"><div className={cn('w-1.5 h-1.5 rounded-full', p.dot)} />{p.label}</div></SelectItem>))}</SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-[11px] text-slate-500">Категория</Label><Select value={category} onValueChange={(v) => setCategory(v as TaskCategory)}><SelectTrigger className="bg-slate-900/80 border-slate-700/50 text-xs text-slate-200 h-8"><SelectValue /></SelectTrigger><SelectContent className="bg-slate-900 border-slate-700">{CATEGORIES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}</SelectContent></Select></div>
            <div className="space-y-1"><Label className="text-[11px] text-slate-500">Ответственный</Label><Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Имя..." className="bg-slate-900/80 border-slate-700/50 text-xs text-slate-200 placeholder:text-slate-600 h-8" onFocus={(e) => { e.target.style.borderColor = color + '80'; }} onBlur={(e) => { e.target.style.borderColor = ''; }} /></div>
          </div>
          <div className="space-y-1"><Label className="text-[11px] text-slate-500">Дедлайн</Label><DeadlinePicker value={deadline} onChange={setDeadline} size="md" /></div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button onClick={() => void handleSave()} disabled={!title.trim() || saving} className="flex-1 text-white h-8 text-xs" style={{ backgroundColor: color, boxShadow: `0 4px 14px ${color}30` }}><Save className="w-3 h-3 mr-1" />{saving ? '...' : mode === 'edit' ? 'Сохранить' : 'Создать'}</Button>
          {mode === 'edit' && <Button onClick={() => void handleDelete()} variant="destructive" disabled={saving} className="h-8 text-xs">Удалить</Button>}
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────── */

function getProgress(children: { status: string }[]): number {
  if (children.length === 0) return 0;
  return Math.round((children.filter(c => c.status === 'done').length / children.length) * 100);
}
