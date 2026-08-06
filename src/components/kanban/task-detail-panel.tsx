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
  AlertTriangle, Flame, CalendarDays, User, ListChecks,
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
      {/* Header — title + metadata in one line */}
      <div className="p-4" style={{ borderBottom: '2px solid rgba(252, 238, 10, 0.2)', background: 'linear-gradient(90deg, rgba(252,238,10,0.04), transparent)' }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-white leading-tight">{task.title}</h3>
          <div className="flex items-center gap-1">
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
        </div>

        {/* Metadata in one line */}
        <div className="flex items-center gap-3 flex-wrap text-[10px]">
          {/* Status */}
          <span className="flex items-center gap-1">
            <Circle className="w-2 h-2" style={{ color: statusHex }} />
            <span style={{ color: statusHex }}>{STATUSES.find(s => s.value === task.status)?.label || task.status}</span>
          </span>
          {/* Priority */}
          <span className="flex items-center gap-1 text-slate-400">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: priorityHex }} />
            {PRIORITIES.find(p => p.value === task.priority)?.label || task.priority}
          </span>
          {/* Assignee */}
          {task.assignee && (
            <span className="flex items-center gap-1 text-slate-400">
              <User className="w-2.5 h-2.5" />
              {task.assignee}
            </span>
          )}
          {/* Deadline */}
          {task.deadline && (
            <span className="flex items-center gap-1" style={{ color: deadlineInfo.status === 'overdue' ? '#fb7185' : deadlineInfo.status === 'urgent' ? '#f59e0b' : '#64748b' }}>
              <CalendarDays className="w-2.5 h-2.5" />
              <DeadlineBadge value={task.deadline} info={deadlineInfo} />
            </span>
          )}
        </div>

        {/* Instruments */}
        {config?.instruments?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
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
        <div className="px-4 py-3" style={{ borderBottom: '2px solid rgba(252, 238, 10, 0.15)' }}>
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

      {/* Description (inline editable) — cyberpunk styled */}
      <div className="px-4 py-3" style={{ borderBottom: '2px solid rgba(252, 238, 10, 0.15)' }}>
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-[9px] uppercase tracking-widest font-bold"
            style={{ color: '#FCEE0A', textShadow: '0 0 6px rgba(252,238,10,0.3)' }}
          >
            Описание
          </span>
          {!isEditingDesc && (
            <button
              onClick={() => { setDescDraft(task.description || ''); setIsEditingDesc(true); }}
              className="text-[9px] px-2 py-0.5 rounded transition-all flex items-center gap-1 font-medium"
              style={{ color: '#FCEE0A', border: '1px solid rgba(252,238,10,0.2)', background: 'rgba(252,238,10,0.04)', clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))' }}
            >
              <Pencil className="w-2.5 h-2.5" /> Изменить
            </button>
          )}
        </div>
        {isEditingDesc ? (
          <div className="space-y-2">
            <Textarea
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value.slice(0, DESC_LIMIT))}
              placeholder="Опишите трек..."
              className="text-[11px] text-slate-200 placeholder:text-slate-600 min-h-[70px] resize-none focus:outline-none rounded-md"
              style={{
                background: 'rgba(8, 8, 16, 0.9)',
                border: '1px solid rgba(252, 238, 10, 0.2)',
                boxShadow: 'inset 0 0 8px rgba(252, 238, 10, 0.03)',
              }}
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
            />
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-slate-600 tabular-nums">{descDraft.length}/{DESC_LIMIT}</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { setIsEditingDesc(false); setDescDraft(task.description || ''); }}
                  className="text-[10px] text-slate-500 hover:text-slate-300 px-2 py-1 rounded transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={() => void saveDesc()}
                  className="text-[10px] font-bold px-3 py-1 rounded transition-all"
                  style={{ color: '#000', backgroundColor: '#FCEE0A', boxShadow: '0 0 8px rgba(252,238,10,0.3)' }}
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        ) : task.description ? (
          <div
            className="rounded-md px-3 py-2 transition-all cursor-pointer"
            style={{
              background: 'rgba(0, 229, 255, 0.05)',
              border: '1.5px solid rgba(0, 229, 255, 0.25)',
              clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
              boxShadow: 'inset 0 0 8px rgba(0, 229, 255, 0.02)',
            }}
            onClick={() => { setDescDraft(task.description || ''); setIsEditingDesc(true); }}
          >
            <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap">
              {task.description}
            </p>
          </div>
        ) : (
          <button
            onClick={() => { setDescDraft(''); setIsEditingDesc(true); }}
            className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors"
          >
            Нажмите, чтобы добавить описание...
          </button>
        )}
      </div>

      {/* Track cover */}
      <div className="px-4 py-3" style={{ borderBottom: '2px solid rgba(252, 238, 10, 0.15)' }}>
        <span
          className="text-[9px] uppercase tracking-widest font-medium block mb-2"
          style={{ color: hexToRgba(boardColor, 0.55) }}
        >
          Обложка
        </span>
        <div
          className="aspect-square max-w-[160px] rounded-lg border border-dashed flex items-center justify-center overflow-hidden"
          style={{ borderColor: hexToRgba(boardColor, 0.2), backgroundColor: hexToRgba(boardColor, 0.03) }}
        >
          {task.soundflowTrackId ? (
            <div className="w-full h-full flex items-center justify-center text-slate-700">
              <Music className="w-8 h-8" />
            </div>
          ) : (
            <div className="text-center px-2">
              <Music className="w-5 h-5 mx-auto mb-1 text-slate-700" />
              <p className="text-[9px] text-slate-600">Нет обложки</p>
            </div>
          )}
        </div>
      </div>

      {/* Track text / lyrics */}
      <TrackTextSection task={task} boardColor={boardColor} onUpdate={async (patch) => {
        await fetch('/api/tasks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: task.id, ...patch }),
        });
        if (selectedBoardId) {
          const res = await fetch(`/api/tasks?boardId=${selectedBoardId}&deep=true`);
          const data = await res.json();
          setBoardTasks(data.tasks);
        }
      }} />
    </div>
  );
}

/* ── Track Text / Lyrics Section ──────────────────────── */

function TrackTextSection({
  task,
  boardColor,
  onUpdate,
}: {
  task: Task;
  boardColor: string;
  onUpdate: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const config = task.trackConfig ? JSON.parse(task.trackConfig) : null;
  const trackText: string = config?.text || '';
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [draft, setDraft] = useState(trackText);

  const save = async () => {
    const newConfig = { ...config, text: draft.trim() };
    await onUpdate({ trackConfig: JSON.stringify(newConfig) });
    setIsEditing(false);
  };

  const cancel = () => {
    setDraft(trackText);
    setIsEditing(false);
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[9px] uppercase tracking-widest font-medium"
          style={{ color: hexToRgba(boardColor, 0.55) }}
        >
          Текст трека
        </span>
        <div className="flex items-center gap-1">
          {!isEditing && trackText && (
            <button
              onClick={() => setIsExpanded(v => !v)}
              className="text-[9px] px-1.5 py-0.5 rounded transition-colors text-slate-500 hover:text-slate-300"
            >
              {isExpanded ? 'Свернуть' : 'Читать'}
            </button>
          )}
          {!isEditing && (
            <button
              onClick={() => { setDraft(trackText); setIsEditing(true); }}
              className="text-[9px] px-1.5 py-0.5 rounded transition-colors flex items-center gap-1"
              style={{ color: hexToRgba(boardColor, 0.5) }}
            >
              <Pencil className="w-2.5 h-2.5" /> Изменить
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Введите текст трека или лирику..."
            className="bg-slate-900/80 text-[11px] text-slate-300 placeholder:text-slate-600 min-h-[120px] resize-none focus:outline-none rounded-md"
            style={{ borderColor: hexToRgba(boardColor, 0.3) }}
            autoFocus
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void save(); }
              if (e.key === 'Escape') cancel();
            }}
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={cancel}
              className="text-[10px] text-slate-500 hover:text-slate-300 px-2 py-1 rounded transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={() => void save()}
              className="text-[10px] font-bold px-3 py-1 rounded transition-all"
              style={{ color: '#000', backgroundColor: '#FCEE0A', boxShadow: '0 0 8px rgba(252,238,10,0.3)' }}
            >
              Сохранить
            </button>
          </div>
        </div>
      ) : trackText ? (
        <div
          className={`text-[11px] text-slate-400 leading-relaxed whitespace-pre-wrap ${isExpanded ? '' : 'line-clamp-3'}`}
        >
          {trackText}
        </div>
      ) : (
        <button
          onClick={() => { setDraft(''); setIsEditing(true); }}
          className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors"
        >
          Нажмите, чтобы добавить текст трека...
        </button>
      )}
    </div>
  );
}

/* ── Deadline badge helper ─────────────────────────────── */

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

/* ── Regular Task Detail View (cyberpunk styled — matches TrackDetailView) ──── */

function TaskDetailView({ task, board }: { task: Task; board?: { title: string; color: string } }) {
  const { setBoardTasks, selectedBoardId, setEditingTask, setSelectedTaskId, setSelectedStageForPanel } = useKanbanStore();
  const [descDraft, setDescDraft] = useState(task.description || '');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [savingDesc, setSavingDesc] = useState(false);

  const boardColor = board?.color || '#00d9ff';
  const subtasks = task.children || [];
  const doneCount = subtasks.filter(s => s.status === 'done').length;

  const reloadTasks = useCallback(async () => {
    if (!selectedBoardId) return;
    const isTracks = useKanbanStore.getState().boards.find(b => b.id === selectedBoardId)?.boardType === 'tracks';
    const res = await fetch(`/api/tasks?boardId=${selectedBoardId}${isTracks ? '&deep=true' : ''}`);
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

  const deadlineInfo = getDeadlineInfo(task.deadline || null);
  const priorityHex = PRIORITY_DOT_HEX[task.priority] || '#64748b';
  const statusHex = STATUS_DOT_HEX[task.status] || '#22d3ee';

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {/* Header — title + metadata in one line (cyberpunk, matches TrackDetailView) */}
      <div className="p-4" style={{ borderBottom: '2px solid rgba(252, 238, 10, 0.2)', background: 'linear-gradient(90deg, rgba(252,238,10,0.04), transparent)' }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-white leading-tight">{task.title}</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEditingTask(task)}
              className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
              title="Редактировать"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => void handleDeleteTask()}
              className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition-colors"
              title="Удалить"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Metadata in one line: status · priority · assignee · deadline */}
        <div className="flex items-center gap-3 flex-wrap text-[10px]">
          {/* Status */}
          <span className="flex items-center gap-1">
            <Circle className="w-2 h-2" style={{ color: statusHex }} />
            <span style={{ color: statusHex }}>{STATUSES.find(s => s.value === task.status)?.label || task.status}</span>
          </span>
          {/* Priority */}
          <span className="flex items-center gap-1 text-slate-400">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: priorityHex }} />
            {PRIORITIES.find(p => p.value === task.priority)?.label || task.priority}
          </span>
          {/* Assignee */}
          {task.assignee && (
            <span className="flex items-center gap-1 text-slate-400">
              <User className="w-2.5 h-2.5" />
              {task.assignee}
            </span>
          )}
          {/* Deadline */}
          {task.deadline && (
            <span className="flex items-center gap-1" style={{ color: deadlineInfo.status === 'overdue' ? '#fb7185' : deadlineInfo.status === 'urgent' ? '#f59e0b' : '#64748b' }}>
              <CalendarDays className="w-2.5 h-2.5" />
              <DeadlineBadge value={task.deadline} info={deadlineInfo} />
            </span>
          )}
          {/* Subtasks count chip */}
          {subtasks.length > 0 && (
            <span
              className="flex items-center gap-1 ml-auto px-1.5 py-0.5 text-[9px] font-bold"
              style={{
                color: '#FCEE0A',
                border: '1px solid rgba(252, 238, 10, 0.3)',
                backgroundColor: 'rgba(252, 238, 10, 0.06)',
                clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))',
              }}
              title={`${doneCount} из ${subtasks.length} подзадач выполнено`}
            >
              <ListChecks className="w-2.5 h-2.5" />
              {doneCount}/{subtasks.length}
            </span>
          )}
        </div>
      </div>

      {/* Description (inline editable) — cyberpunk styled, matches TrackDetailView */}
      <div className="px-4 py-3" style={{ borderBottom: '2px solid rgba(252, 238, 10, 0.15)' }}>
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-[9px] uppercase tracking-widest font-bold"
            style={{ color: '#FCEE0A', textShadow: '0 0 6px rgba(252,238,10,0.3)' }}
          >
            Описание
          </span>
          {!isEditingDesc && (
            <button
              onClick={() => { setDescDraft(task.description || ''); setIsEditingDesc(true); }}
              className="text-[9px] px-2 py-0.5 rounded transition-all flex items-center gap-1 font-medium"
              style={{ color: '#FCEE0A', border: '1px solid rgba(252,238,10,0.2)', background: 'rgba(252,238,10,0.04)', clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))' }}
            >
              <Pencil className="w-2.5 h-2.5" /> Изменить
            </button>
          )}
        </div>
        {isEditingDesc ? (
          <div className="space-y-2">
            <Textarea
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value.slice(0, DESC_LIMIT))}
              placeholder="Описание задачи..."
              className="text-[11px] text-slate-200 placeholder:text-slate-600 min-h-[70px] resize-none focus:outline-none rounded-md"
              style={{
                background: 'rgba(8, 8, 16, 0.9)',
                border: '1px solid rgba(252, 238, 10, 0.2)',
                boxShadow: 'inset 0 0 8px rgba(252, 238, 10, 0.03)',
              }}
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
            />
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-slate-600 tabular-nums">{descDraft.length}/{DESC_LIMIT}</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { setIsEditingDesc(false); setDescDraft(task.description || ''); }}
                  className="text-[10px] text-slate-500 hover:text-slate-300 px-2 py-1 rounded transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={() => void saveDesc()}
                  disabled={savingDesc}
                  className="text-[10px] font-bold px-3 py-1 rounded transition-all disabled:opacity-50"
                  style={{ color: '#000', backgroundColor: '#FCEE0A', boxShadow: '0 0 8px rgba(252,238,10,0.3)' }}
                >
                  {savingDesc ? '...' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        ) : task.description ? (
          <div
            className="rounded-md px-3 py-2 transition-all cursor-pointer"
            style={{
              background: 'rgba(0, 229, 255, 0.05)',
              border: '1.5px solid rgba(0, 229, 255, 0.25)',
              clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
              boxShadow: 'inset 0 0 8px rgba(0, 229, 255, 0.02)',
            }}
            onClick={() => { setDescDraft(task.description || ''); setIsEditingDesc(true); }}
          >
            <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap">
              {task.description}
            </p>
          </div>
        ) : (
          <button
            onClick={() => { setDescDraft(''); setIsEditingDesc(true); }}
            className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors"
          >
            Нажмите, чтобы добавить описание...
          </button>
        )}
      </div>

      {/* Hint — subtasks are managed in the bottom panel (always pinned) */}
      <div className="px-4 py-3 mt-auto">
        <div
          className="flex items-center gap-2 px-3 py-2 text-[10px]"
          style={{
            color: 'rgba(0, 229, 255, 0.7)',
            border: '1px solid rgba(0, 229, 255, 0.15)',
            backgroundColor: 'rgba(0, 229, 255, 0.04)',
            clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
          }}
        >
          <ListChecks className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">
            {subtasks.length > 0
              ? `Подзадачи доступны в панели снизу — ${doneCount}/${subtasks.length} выполнено`
              : 'Создавайте подзадачи в панели снизу'}
          </span>
        </div>
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
        {/* Header */}
        <div className="flex items-center justify-between pb-2" style={{ borderBottom: '2px solid rgba(252, 238, 10, 0.15)' }}>
          <h3 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#FCEE0A', textShadow: '0 0 6px rgba(252,238,10,0.3)' }}>
            {mode === 'edit' ? 'Редактировать' : 'Новая задача'}
          </h3>
          <button
            onClick={() => { setEditingTask(null); setIsCreating(false); }}
            className="p-1.5 rounded transition-all"
            style={{ color: '#4a4a5e', border: '1px solid transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#FCEE0A'; e.currentTarget.style.borderColor = 'rgba(252,238,10,0.3)'; e.currentTarget.style.background = 'rgba(252,238,10,0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#4a4a5e'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Title */}
          <div className="space-y-1">
            <Label className="text-[9px] uppercase tracking-widest font-bold" style={{ color: 'rgba(252,238,10,0.6)' }}>Название</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Задача..."
              className="text-sm text-slate-100 placeholder:text-slate-600 h-9 rounded-md focus:outline-none"
              style={{ background: 'rgba(8,8,16,0.9)', border: '1.5px solid rgba(252,238,10,0.2)', boxShadow: 'inset 0 0 6px rgba(252,238,10,0.02)' }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(252,238,10,0.4)'; e.target.style.boxShadow = 'inset 0 0 6px rgba(252,238,10,0.05), 0 0 8px rgba(252,238,10,0.1)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(252,238,10,0.15)'; e.target.style.boxShadow = 'inset 0 0 6px rgba(252,238,10,0.02)'; }}
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label className="text-[9px] uppercase tracking-widest font-bold" style={{ color: 'rgba(252,238,10,0.6)' }}>Описание</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Описание..."
              className="text-xs text-slate-200 placeholder:text-slate-600 min-h-[55px] resize-none rounded-md focus:outline-none"
              style={{ background: 'rgba(8,8,16,0.9)', border: '1.5px solid rgba(252,238,10,0.2)', boxShadow: 'inset 0 0 6px rgba(252,238,10,0.02)' }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(252,238,10,0.4)'; e.target.style.boxShadow = 'inset 0 0 6px rgba(252,238,10,0.05), 0 0 8px rgba(252,238,10,0.1)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(252,238,10,0.15)'; e.target.style.boxShadow = 'inset 0 0 6px rgba(252,238,10,0.02)'; }}
            />
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[9px] uppercase tracking-widest font-bold" style={{ color: 'rgba(252,238,10,0.6)' }}>Статус</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger className="text-xs text-slate-100 h-9 rounded-md" style={{ background: 'rgba(8,8,16,0.9)', border: '1.5px solid rgba(252,238,10,0.2)' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 z-[60]">{STATUSES.map((s) => (<SelectItem key={s.value} value={s.value}><span className={s.color}>{s.label}</span></SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] uppercase tracking-widest font-bold" style={{ color: 'rgba(252,238,10,0.6)' }}>Приоритет</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger className="text-xs text-slate-100 h-9 rounded-md" style={{ background: 'rgba(8,8,16,0.9)', border: '1.5px solid rgba(252,238,10,0.2)' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 z-[60]">{PRIORITIES.map((p) => (<SelectItem key={p.value} value={p.value}><div className="flex items-center gap-1.5"><div className={cn('w-1.5 h-1.5 rounded-full', p.dot)} />{p.label}</div></SelectItem>))}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Deadline */}
          <div className="space-y-1">
            <Label className="text-[9px] uppercase tracking-widest font-bold" style={{ color: 'rgba(252,238,10,0.6)' }}>Дедлайн</Label>
            <DeadlinePicker value={deadline} onChange={setDeadline} size="md" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => void handleSave()}
            disabled={!title.trim() || saving}
            className="flex-1 flex items-center justify-center gap-1.5 h-9 text-[11px] font-bold rounded-md transition-all disabled:opacity-40"
            style={{ color: '#000', background: 'linear-gradient(135deg, #FCEE0A, #F1F100)', boxShadow: '0 0 10px rgba(252,238,10,0.3)', clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))' }}
          >
            <Save className="w-3 h-3" />{saving ? '...' : mode === 'edit' ? 'Сохранить' : 'Создать'}
          </button>
          {mode === 'edit' && (
            <button
              onClick={() => void handleDelete()}
              disabled={saving}
              className="flex items-center justify-center gap-1.5 h-9 px-4 text-[11px] font-bold rounded-md transition-all"
              style={{ color: '#FF003C', background: 'rgba(255,0,60,0.08)', border: '1.5px solid rgba(255,0,60,0.3)', clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))' }}
            >
              <Trash2 className="w-3 h-3" /> Удалить
            </button>
          )}
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
