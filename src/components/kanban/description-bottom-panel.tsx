'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useKanbanStore, Task, TaskChild, TaskGrandchild, TaskStatus, TaskPriority } from '@/store/kanban-store';
import { useAuthStore } from '@/lib/store';
import {
  X, Save, Plus, Check, Circle, Clock, Pencil, Trash2,
  ChevronDown, ChevronRight, User, CalendarDays,
  AlertTriangle, Flame, ListChecks, Layers, ArrowUp, ArrowDown, GripVertical,
  AlignJustify, FileText,
} from 'lucide-react';
import DeadlinePicker, { getDeadlineInfo } from '@/components/kanban/deadline-picker';
import {
  Popover, PopoverTrigger, PopoverContent,
} from '@/components/ui/popover';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { hexToRgba, cn } from '@/lib/utils';

/* ── Constants ────────────────────────────────────────── */

const STATUSES: { value: TaskStatus; label: string; hex: string; icon: typeof Circle }[] = [
  { value: 'todo', label: 'К выполнению', hex: '#22d3ee', icon: Circle },
  { value: 'in-progress', label: 'В работе', hex: '#fb923c', icon: Clock },
  { value: 'done', label: 'Готово', hex: '#34d399', icon: Check },
];

const PRIORITIES: { value: TaskPriority; label: string; hex: string }[] = [
  { value: 'low', label: 'Низкий', hex: '#64748b' },
  { value: 'medium', label: 'Средний', hex: '#f59e0b' },
  { value: 'high', label: 'Высокий', hex: '#f43f5e' },
];

const STATUS_HEX: Record<string, string> = {
  todo: '#22d3ee',
  'in-progress': '#fb923c',
  done: '#34d399',
};

const PRIORITY_HEX: Record<string, string> = {
  low: '#64748b',
  medium: '#f59e0b',
  high: '#f43f5e',
};

const PRIORITY_LEVELS: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
};

const STATUS_ICON: Record<string, typeof Circle> = {
  todo: Circle,
  'in-progress': Clock,
  done: Check,
};

const DESC_LIMIT = 1500;

interface GroupMember {
  userId: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  role: string;
  instrument: string | null;
}

interface ColorSet {
  raw: string;
  a02: string;
  a04: string;
  a05: string;
  a08: string;
  a1: string;
  a12: string;
  a15: string;
  a18: string;
  a2: string;
  a25: string;
  a3: string;
  a4: string;
  a5: string;
  a6: string;
  a7: string;
}

/* ── Priority Bars (visual indicator) ──────────────────── */

function PriorityBars({ priority, size = 'sm' }: { priority: string; size?: 'sm' | 'xs' }) {
  const level = PRIORITY_LEVELS[priority] || 2;
  const hex = PRIORITY_HEX[priority] || '#64748b';
  const barW = size === 'xs' ? 'w-[2.5px]' : 'w-[3px]';
  const gap = size === 'xs' ? 'gap-[1.5px]' : 'gap-[2px]';

  return (
    <div className={cn('flex items-end', gap)} style={{ height: size === 'xs' ? '10px' : '12px' }}>
      {[1, 2, 3].map(i => (
        <div
          key={i}
          className={cn(barW, 'rounded-sm transition-all duration-200')}
          style={{
            height: i === 1 ? '30%' : i === 2 ? '65%' : '100%',
            backgroundColor: i <= level ? hex : hexToRgba(hex, 0.15),
            boxShadow: i <= level ? `0 0 3px ${hex}60` : 'none',
          }}
        />
      ))}
    </div>
  );
}

/* ── Priority Selector (popover) ──────────────────────── */

function PrioritySelector({
  priority,
  onChange,
  size = 'sm',
  boardColor = '#00d9ff',
}: {
  priority: string;
  onChange: (v: string) => void;
  size?: 'sm' | 'xs';
  boardColor?: string;
}) {
  const [open, setOpen] = useState(false);
  const level = PRIORITY_LEVELS[priority] || 2;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-all cursor-pointer border border-transparent hover:bg-slate-800/60',
            size === 'xs' ? 'h-5' : 'h-6',
          )}
          title={`Приоритет: ${PRIORITY_LABELS[priority] || priority}`}
        >
          <PriorityBars priority={priority} size={size} />
          <span
            className={cn('font-medium', size === 'xs' ? 'text-[9px]' : 'text-[10px]')}
            style={{ color: PRIORITY_HEX[priority] || '#64748b' }}
          >
            {level === 1 ? 'P1' : level === 2 ? 'P2' : 'P3'}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-44 p-2 shadow-2xl shadow-black/40 z-[70] border-0 rounded-none"
        style={{
          background: 'rgba(8, 10, 18, 0.97)',
          border: `1.5px solid ${hexToRgba(boardColor, 0.4)}`,
          clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
          boxShadow: `0 0 24px ${hexToRgba(boardColor, 0.15)}, 0 8px 32px rgba(0,0,0,0.6)`,
        }}
        align="start"
        sideOffset={6}
        onClick={(e) => e.stopPropagation()}
      >
        <p
          className="text-[9px] uppercase tracking-wider font-bold mb-1.5 px-1"
          style={{ color: '#FCEE0A', textShadow: '0 0 4px rgba(252,238,10,0.3)' }}
        >
          Приоритет
        </p>
        <div className="space-y-1">
          {PRIORITIES.map(p => {
            const isActive = priority === p.value;
            const pLevel = PRIORITY_LEVELS[p.value];
            return (
              <button
                key={p.value}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(p.value);
                  setOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2 py-1.5 transition-all',
                  isActive ? '' : 'hover:bg-white/5',
                )}
                style={isActive ? {
                  background: hexToRgba(boardColor, 0.12),
                  boxShadow: `inset 2px 0 0 ${p.hex}`,
                } : undefined}
              >
                <PriorityBars priority={p.value} size="sm" />
                <div className="flex-1 text-left">
                  <span className={cn('text-[11px] font-medium', isActive ? 'text-slate-100' : 'text-slate-300')}>
                    {p.label}
                  </span>
                  <span className="text-[9px] text-slate-600 ml-1">P{pLevel}</span>
                </div>
                {isActive && <Check className="w-3 h-3" style={{ color: '#FCEE0A' }} />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ── Main Panel ────────────────────────────────────────── */

export default function DescriptionBottomPanel() {
  const {
    boardTasks, selectedTaskId, selectedBoardId,
    selectedStageForPanel, setSelectedStageForPanel,
    setBoardTasks, boards,
  } = useKanbanStore();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);

  // Bottom panel is ALWAYS pinned when a task is selected at the top.
  // For track tasks → renders StagesList; for regular tasks → renders FlatSubtasksList.
  const task = boardTasks.find(t => t.id === selectedTaskId) || null;
  const taskId = task?.id || null;
  const shouldShow = !!task;

  const selectedBoard = boards.find(b => b.id === selectedBoardId);
  const boardColor = selectedBoard?.color || '#00d9ff';

  // Fetch group members for assignee dropdowns
  useEffect(() => {
    const gid = useAuthStore.getState().currentGroupId;
    if (!gid) return;
    let cancelled = false;
    fetch(`/api/groups/${gid}/members`)
      .then(r => r.json())
      .then(d => {
        if (!cancelled && Array.isArray(d)) setMembers(d);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Reset collapse state when switching tasks (prev-tracker pattern avoids useEffect-setState)
  const [prevTaskId, setPrevTaskId] = useState<string | null>(taskId);
  if (taskId !== prevTaskId) {
    setPrevTaskId(taskId);
    setIsCollapsed(false);
  }

  const reloadTasks = useCallback(async () => {
    if (!selectedBoardId) return;
    // Always fetch deep — non-track boards may still contain track tasks with stages
    const url = `/api/tasks?boardId=${selectedBoardId}&deep=true`;
    const res = await fetch(url);
    const data = await res.json();
    setBoardTasks(data.tasks);
  }, [selectedBoardId, setBoardTasks]);

  const c = useMemo<ColorSet>(() => ({
    raw: boardColor,
    a02: hexToRgba(boardColor, 0.02),
    a04: hexToRgba(boardColor, 0.04),
    a05: hexToRgba(boardColor, 0.05),
    a08: hexToRgba(boardColor, 0.08),
    a1: hexToRgba(boardColor, 0.1),
    a12: hexToRgba(boardColor, 0.12),
    a15: hexToRgba(boardColor, 0.15),
    a18: hexToRgba(boardColor, 0.18),
    a2: hexToRgba(boardColor, 0.2),
    a25: hexToRgba(boardColor, 0.25),
    a3: hexToRgba(boardColor, 0.3),
    a4: hexToRgba(boardColor, 0.4),
    a5: hexToRgba(boardColor, 0.5),
    a6: hexToRgba(boardColor, 0.6),
    a7: hexToRgba(boardColor, 0.7),
  }), [boardColor]);

  if (!shouldShow || !task) return null;

  const stages = task.children || [];
  const stagesCount = stages.length;
  const allSubtasks = stages.flatMap(s => s.children || []);
  const subtasksCount = allSubtasks.length;
  // Progress is based on STAGE completion, not subtask completion
  const doneStages = stages.filter(s => s.status === 'done').length;
  const progress = stagesCount > 0 ? Math.round((doneStages / stagesCount) * 100) : 0;
  const progressColor = progress === 100 ? '#34d399' : '#FCEE0A';

  return (
    <div
      className="flex-shrink-0 flex flex-col cp-panel"
      style={{
        height: isCollapsed ? '42px' : '360px',
        transition: 'height 220ms ease',
        '--bc': c.raw,
        '--bc-012': hexToRgba(boardColor, 0.012),
        '--bc-02': c.a02,
        '--bc-025': hexToRgba(boardColor, 0.025),
        '--bc-04': c.a04,
        '--bc-05': c.a05,
        '--bc-08': c.a08,
        '--bc-1': c.a1,
        '--bc-12': c.a12,
        '--bc-15': c.a15,
        '--bc-18': c.a18,
        '--bc-2': c.a2,
        '--bc-22': hexToRgba(boardColor, 0.22),
        '--bc-25': c.a25,
        '--bc-3': c.a3,
        '--bc-35': hexToRgba(boardColor, 0.35),
        '--bc-4': c.a4,
        '--bc-45': hexToRgba(boardColor, 0.45),
        '--bc-5': c.a5,
        '--bc-55': hexToRgba(boardColor, 0.55),
        '--bc-6': c.a6,
        '--bc-65': hexToRgba(boardColor, 0.65),
        '--bc-7': c.a7,
        '--bc-8': hexToRgba(boardColor, 0.8),
      } as React.CSSProperties}
    >
      {/* Scan line overlay */}
      <div className="cp-scanlines" />

      {/* Top neon border with glitch */}
      <div className="cp-neon-top" style={{ background: `linear-gradient(90deg, transparent, ${c.raw} 20%, #FCEE0A 50%, ${c.raw} 80%, transparent)` }} />

      {/* Header */}
      <div className="cp-header" style={{ borderBottom: isCollapsed ? 'none' : `1px solid ${c.a3}` }}>
        <button
          onClick={() => setIsCollapsed(v => !v)}
          className="flex items-center gap-2 min-w-0 flex-1 text-left group"
          title={isCollapsed ? 'Развернуть' : 'Свернуть'}
        >
          <div className="cp-header-icon" style={{ borderColor: c.a5, backgroundColor: c.a12 }}>
            <Layers className="w-3.5 h-3.5" style={{ color: c.raw }} />
          </div>
          <span className="cp-header-title" style={{ color: c.raw }}>
            {task.trackConfig ? 'ЭТАПЫ' : 'ПОДЗАДАЧИ'}
          </span>
          <span className="cp-header-sub truncate hidden sm:inline">
            {'// '}{task.title}
          </span>
          <span className="cp-count-chip" style={{ borderColor: c.a4, color: c.raw, backgroundColor: c.a08 }}>
            {task.trackConfig ? `${doneStages}/${stagesCount} ETH · ${subtasksCount} SUB` : `${stagesCount} SUB`}
          </span>

          {/* Progress bar in header — always show */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="cp-header-progress">
              <div
                className="cp-header-progress-fill"
                style={{ width: `${progress}%`, backgroundColor: progressColor, boxShadow: progress > 0 ? `0 0 6px ${progressColor}80` : 'none' }}
              />
            </div>
            <span className="cp-header-progress-text" style={{ color: progressColor }}>
              {progress}%
            </span>
          </div>
        </button>

        {!isCollapsed && false && (
          <button
            onClick={() => setSelectedStageForPanel(null)}
            className="cp-icon-btn"
            title="Закрыть"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        <button
          onClick={() => setIsCollapsed(v => !v)}
          className="cp-icon-btn"
          title={isCollapsed ? 'Развернуть' : 'Свернуть'}
        >
          {isCollapsed
            ? <ChevronDown className="w-3 h-3" />
            : <ChevronDown className="w-3 h-3 rotate-180" />
          }
        </button>
      </div>

      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto min-h-0 panel-scroll cp-content">
          {task.trackConfig ? (
            <StagesList
              key={task.id}
              task={task}
              boardColor={boardColor}
              c={c}
              members={members}
              selectedStageId={selectedStageForPanel?.stageId || null}
              onSelectStage={(stageId) => setSelectedStageForPanel({ taskId: task.id, stageId })}
              reloadTasks={reloadTasks}
            />
          ) : (
            <FlatSubtasksList
              key={task.id}
              task={task}
              boardColor={boardColor}
              c={c}
              members={members}
              reloadTasks={reloadTasks}
            />
          )}
        </div>
      )}

    </div>
  );
}

/* ── Stages List (for track tasks) ──────────────────────── */

function StagesList({
  task, boardColor, c, members, selectedStageId, onSelectStage, reloadTasks,
}: {
  task: Task;
  boardColor: string;
  c: ColorSet;
  members: GroupMember[];
  selectedStageId: string | null;
  onSelectStage: (stageId: string) => void;
  reloadTasks: () => Promise<void>;
}) {
  const stages = task.children || [];
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>(() => {
    // Auto-expand first stage or the selected one
    const initial: Record<string, boolean> = {};
    if (stages.length > 0) {
      initial[stages[0].id] = true;
    }
    if (selectedStageId && stages.find(s => s.id === selectedStageId)) {
      initial[selectedStageId] = true;
    }
    return initial;
  });
  const [addingStage, setAddingStage] = useState(false);
  const [newStageTitle, setNewStageTitle] = useState('');

  // If selectedStageId changes, ensure that stage is expanded (prev-tracker pattern avoids useEffect-setState)
  const [prevSelectedStageId, setPrevSelectedStageId] = useState<string | null>(selectedStageId);
  if (selectedStageId !== prevSelectedStageId) {
    setPrevSelectedStageId(selectedStageId);
    if (selectedStageId && stages.find(s => s.id === selectedStageId) && !expandedStages[selectedStageId]) {
      setExpandedStages(prev => ({ ...prev, [selectedStageId]: true }));
    }
  }

  const toggleExpand = (stageId: string) => {
    setExpandedStages(prev => ({ ...prev, [stageId]: !prev[stageId] }));
  };

  const addStage = async () => {
    if (!newStageTitle.trim()) return;
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newStageTitle.trim(), parentId: task.id, boardId: task.boardId }),
    });
    setNewStageTitle('');
    setAddingStage(false);
    await reloadTasks();
  };

  const moveStage = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= stages.length) return;
    const a = stages[index];
    const b = stages[target];
    // Swap hexR values
    await Promise.all([
      fetch('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, hexR: b.hexR, hexQ: b.hexQ }) }),
      fetch('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: b.id, hexR: a.hexR, hexQ: a.hexQ }) }),
    ]);
    await reloadTasks();
  };

  const deleteStage = async (stageId: string) => {
    await fetch(`/api/tasks?id=${stageId}`, { method: 'DELETE' });
    await reloadTasks();
  };

  const updateStage = async (stageId: string, patch: Record<string, unknown>) => {
    await fetch('/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: stageId, ...patch }),
    });
    await reloadTasks();
  };

  return (
    <div className="py-2 space-y-1.5">
      {stages.length === 0 && !addingStage && (
        <div className="text-center py-6 px-4">
          <ListChecks className="w-6 h-6 mx-auto mb-2 text-slate-700" />
          <p className="text-[11px] text-slate-500 mb-1">Этапов пока нет</p>
          <p className="text-[10px] text-slate-600 mb-3">Создайте первый этап производства трека</p>
        </div>
      )}

      {stages.map((stage, idx) => (
        <StageCard
          key={stage.id}
          stage={stage}
          index={idx}
          total={stages.length}
          boardColor={boardColor}
          c={c}
          members={members}
          isExpanded={!!expandedStages[stage.id]}
          isSelected={selectedStageId === stage.id}
          onToggleExpand={() => toggleExpand(stage.id)}
          onSelect={() => onSelectStage(stage.id)}
          onMoveUp={() => moveStage(idx, -1)}
          onMoveDown={() => moveStage(idx, 1)}
          onDelete={() => deleteStage(stage.id)}
          onUpdate={(patch) => updateStage(stage.id, patch)}
          reloadTasks={reloadTasks}
        />
      ))}

      {/* Add stage form */}
      {addingStage ? (
        <div
          className="mx-2 rounded-lg p-2.5 space-y-1.5"
          style={{ border: `1px dashed ${c.a3}`, backgroundColor: c.a04 }}
        >
          <Input
            value={newStageTitle}
            onChange={(e) => setNewStageTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addStage();
              if (e.key === 'Escape') { setAddingStage(false); setNewStageTitle(''); }
            }}
            placeholder="Название этапа..."
            className="bg-[rgba(8,8,16,0.92)] text-[11px] text-slate-200 placeholder:text-slate-600 h-7 rounded-md border focus:outline-none focus-visible:ring-0 transition-colors px-2"
            style={{ borderColor: c.a3 }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#FCEE0A'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = c.a3; }}
            autoFocus
          />
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => void addStage()}
              disabled={!newStageTitle.trim()}
              className="text-[10px] px-2 py-1 rounded font-medium transition-all disabled:opacity-40"
              style={{ color: '#fff', backgroundColor: c.a5 }}
            >
              + Добавить этап
            </button>
            <button
              onClick={() => { setAddingStage(false); setNewStageTitle(''); }}
              className="text-[10px] text-slate-500 hover:text-slate-300 px-2 py-1"
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingStage(true)}
          className="cp-add-btn mx-2 w-[calc(100%-1rem)] justify-center"
        >
          <Plus className="w-3 h-3" /> Добавить этап
        </button>
      )}
    </div>
  );
}

/* ── Stage Card ─────────────────────────────────────────── */

function StageCard({
  stage, index, total, boardColor, c, members,
  isExpanded, isSelected,
  onToggleExpand, onSelect, onMoveUp, onMoveDown, onDelete, onUpdate, reloadTasks,
}: {
  stage: TaskChild;
  index: number;
  total: number;
  boardColor: string;
  c: ColorSet;
  members: GroupMember[];
  isExpanded: boolean;
  isSelected: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onUpdate: (patch: Record<string, unknown>) => Promise<void>;
  reloadTasks: () => Promise<void>;
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(stage.title);
  const [descDraft, setDescDraft] = useState(stage.description || '');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closingAll, setClosingAll] = useState(false);

  const subtasks = stage.children || [];
  const stageProgress = getProgress(subtasks);
  const StatusIcon = STATUS_ICON[stage.status] || Circle;
  const statusHex = STATUS_HEX[stage.status] || '#64748b';
  const priorityHex = PRIORITY_HEX[stage.priority] || '#64748b';
  const unclosedSubtasks = subtasks.filter(s => s.status !== 'done');

  // Sync local draft state with prop changes when not actively editing (prev-tracker pattern)
  const [prevStageTitle, setPrevStageTitle] = useState(stage.title);
  if (stage.title !== prevStageTitle) {
    setPrevStageTitle(stage.title);
    if (!isEditingTitle) setTitleDraft(stage.title);
  }
  const [prevStageDesc, setPrevStageDesc] = useState(stage.description);
  if (stage.description !== prevStageDesc) {
    setPrevStageDesc(stage.description);
    if (!isEditingDesc) setDescDraft(stage.description || '');
  }

  const saveTitle = async () => {
    if (titleDraft.trim() && titleDraft !== stage.title) {
      await onUpdate({ title: titleDraft.trim() });
    }
    setIsEditingTitle(false);
  };

  const saveDesc = async () => {
    if (descDraft.trim() !== (stage.description || '').trim()) {
      await onUpdate({ description: descDraft.trim() || null });
    }
    setIsEditingDesc(false);
  };

  const cycleStatus = async () => {
    const order: TaskStatus[] = ['todo', 'in-progress', 'done'];
    const idx = order.indexOf(stage.status as TaskStatus);
    const next = order[(idx + 1) % order.length];

    // If trying to mark as done and there are unclosed subtasks, show confirmation
    if (next === 'done' && unclosedSubtasks.length > 0) {
      setShowCloseConfirm(true);
      return;
    }

    await onUpdate({ status: next });
  };

  // Mark all unclosed subtasks as done AND the stage itself as done
  const completeAllAndClose = async () => {
    if (closingAll) return;
    setClosingAll(true);
    try {
      for (const sub of subtasks) {
        if (sub.status !== 'done') {
          await fetch('/api/tasks', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: sub.id, status: 'done' }),
          });
        }
      }
      await onUpdate({ status: 'done' });
      await reloadTasks();
    } finally {
      setClosingAll(false);
      setShowCloseConfirm(false);
    }
  };

  const deadlineInfo = getDeadlineInfo(stage.deadline || null);

  const stageDone = stage.status === 'done';

  return (
    <div
      className={cn('cp-stage-card', isSelected && 'cp-stage-card-selected', stageDone && 'cp-stage-card-done')}
    >
      {/* Stage header */}
      <div
        className={cn('cp-stage-header', isExpanded && 'cp-stage-header-bg')}
      >
        {/* Drag handle (visual) */}
        <GripVertical className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />

        {/* Status cycle */}
        <button
          onClick={(e) => { e.stopPropagation(); void cycleStatus(); }}
          className="flex-shrink-0 p-1 transition-all hover:opacity-70"
          title="Сменить статус"
          style={{ filter: `drop-shadow(0 0 4px ${statusHex}60)` }}
        >
          <StatusIcon className="w-4 h-4" style={{ color: statusHex }} />
        </button>

        {/* Priority selector (interactive bars) */}
        <PrioritySelector
          priority={stage.priority}
          onChange={(v) => void onUpdate({ priority: v })}
          size="sm"
          boardColor={boardColor}
        />

        {/* Title (inline editable) */}
        {isEditingTitle ? (
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); void saveTitle(); }
              if (e.key === 'Escape') { setIsEditingTitle(false); setTitleDraft(stage.title); }
            }}
            onBlur={() => void saveTitle()}
            className="flex-1 min-w-0 bg-[rgba(8,8,16,0.92)] rounded-md px-2 py-1 text-[12px] text-slate-100 font-medium focus:outline-none focus-visible:ring-0 transition-colors"
            style={{ border: `1.5px solid ${c.a5}` }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#FCEE0A'; }}
            autoFocus
          />
        ) : (
          <button
            onDoubleClick={() => setIsEditingTitle(true)}
            onClick={() => { onSelect(); onToggleExpand(); }}
            className={cn(
              'cp-stage-title flex-1 min-w-0 text-left truncate transition-colors',
              stage.status === 'done' ? 'text-slate-600 line-through' : 'text-[#FCEE0A]'
            )}
            title="Двойной клик — переименовать"
          >
            {stage.title}
          </button>
        )}

        {/* Subtask count badge — fixed width so percentages align across all stages */}
        {subtasks.length > 0 && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 tabular-nums font-bold text-right"
            style={{ backgroundColor: c.a2, color: '#FCEE0A', border: `1px solid ${c.a3}`, width: '48px', textAlign: 'right' }}
            title={`${subtasks.length} подзадач · ${stageProgress}%`}
          >
            {stageProgress}%
          </span>
        )}

        {/* Assignee picker (multi-select popover) */}
        <AssigneePicker
          assigneeRaw={stage.assignee}
          members={members}
          onChange={(v) => void onUpdate({ assignee: v })}
          boardColor={boardColor}
          size="sm"
        />

        {/* Deadline */}
        <DeadlinePicker
          value={stage.deadline || null}
          onChange={(d) => void onUpdate({ deadline: d })}
          isDone={stage.status === 'done'}
          size="sm"
          inline
          boardColor={boardColor}
        />

        {/* Move up/down */}
        <div className="flex items-center flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
            disabled={index === 0}
            className="cp-arrow-btn"
            title="Выше"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            disabled={index === total - 1}
            className="cp-arrow-btn"
            title="Ниже"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Delete */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="cp-delete-btn"
          title="Удалить этап"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {/* Expand arrow */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
          className="cp-icon-btn flex-shrink-0"
        >
          {isExpanded
            ? <ChevronDown className="w-3.5 h-3.5 rotate-180" />
            : <ChevronDown className="w-3.5 h-3.5" />
          }
        </button>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 py-2 space-y-2">
          {/* Progress bar */}
          {subtasks.length > 0 && (
            <div className="cp-progress-bar mx-2 my-1">
              <div
                className="cp-progress-fill"
                style={{
                  width: `${stageProgress}%`,
                  backgroundColor: stageProgress === 100 ? '#10b981' : '#FCEE0A',
                  boxShadow: stageProgress > 0 ? `0 0 6px ${stageProgress === 100 ? '#10b981' : '#FCEE0A'}80` : 'none',
                }}
              />
            </div>
          )}

          {/* Description editor */}
          <div>
            {isEditingDesc ? (
              <div className="space-y-1.5">
                <Textarea
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value.slice(0, DESC_LIMIT))}
                  placeholder="Описание этапа..."
                  className="bg-[rgba(8,8,16,0.92)] text-[10px] text-slate-300 placeholder:text-slate-600 min-h-[50px] resize-none focus:outline-none focus-visible:ring-0 focus-visible:border-[#FCEE0A] rounded-md border border-[rgba(252,238,10,0.35)] transition-colors px-2.5 py-1.5"
                  autoFocus
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void saveDesc(); }
                    if (e.key === 'Escape') { setIsEditingDesc(false); setDescDraft(stage.description || ''); }
                  }}
                />
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-slate-600 tabular-nums">{descDraft.length}/{DESC_LIMIT}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => { setIsEditingDesc(false); setDescDraft(stage.description || ''); }}
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
            ) : stage.description ? (
              <button
                onClick={() => setIsEditingDesc(true)}
                className="cp-desc-card w-full text-left"
              >
                <div className="flex items-center gap-1.5 mb-1" style={{ opacity: 0.6 }}>
                  <FileText className="w-2.5 h-2.5" style={{ color: c.a6 }} />
                  <span className="text-[8px] uppercase tracking-wider font-bold" style={{ color: c.a6 }}>
                    Описание этапа
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap line-clamp-3">
                  {stage.description}
                </p>
              </button>
            ) : (
              <button
                onClick={() => setIsEditingDesc(true)}
                className="cp-add-btn"
              >
                <Plus className="w-2.5 h-2.5" /> описание этапа
              </button>
            )}
          </div>

          {/* Subtasks list */}
          <SubtasksList
            stage={stage}
            boardColor={boardColor}
            c={c}
            members={members}
            onUpdate={(subId, patch) => updateSubtask(subId, patch, reloadTasks)}
            onDelete={async (subId) => { await fetch(`/api/tasks?id=${subId}`, { method: 'DELETE' }); await reloadTasks(); }}
            onMove={async (idx, dir) => moveSubtask(stage, idx, dir, reloadTasks)}
            reloadTasks={reloadTasks}
          />
        </div>
      )}

      {/* Close-with-unclosed-subtasks confirmation dialog */}
      {showCloseConfirm && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => { if (!closingAll) setShowCloseConfirm(false); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'rgba(8, 10, 18, 0.98)',
              border: `1.5px solid ${c.a4}`,
              clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
              boxShadow: `0 0 32px ${c.a15}, 0 0 64px rgba(252, 238, 10, 0.08), 0 16px 48px rgba(0,0,0,0.6)`,
              padding: '20px',
              maxWidth: '400px',
              width: '90%',
            }}
          >
            {/* Header */}
            <div className="flex items-start gap-2.5 mb-3">
              <div
                className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center"
                style={{
                  backgroundColor: 'rgba(252, 238, 10, 0.1)',
                  border: '1px solid rgba(252, 238, 10, 0.35)',
                  boxShadow: '0 0 12px rgba(252, 238, 10, 0.15)',
                }}
              >
                <AlertTriangle className="w-4 h-4" style={{ color: '#FCEE0A' }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-slate-100 leading-tight" style={{ letterSpacing: '0.02em' }}>
                  Этап не завершён
                </p>
                <p className="text-[10px] text-slate-500 truncate mt-0.5" title={stage.title}>
                  «{stage.title}»
                </p>
              </div>
            </div>

            {/* Body text */}
            <p className="text-[11px] text-slate-400 leading-relaxed mb-2.5">
              Остались незавершённые подзадачи
              <span className="text-[#FCEE0A] font-semibold"> ({unclosedSubtasks.length})</span>.
              Завершить все подзадачи вместе с этапом?
            </p>

            {/* Unclosed subtasks list */}
            <div
              className="mb-3.5 max-h-40 overflow-y-auto rounded pr-1"
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: `1px solid ${c.a2}`,
              }}
            >
              <ul className="py-1.5">
                {unclosedSubtasks.map(sub => (
                  <li
                    key={sub.id}
                    className="flex items-center gap-2 px-2.5 py-1 text-[10px]"
                  >
                    <span
                      className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: sub.status === 'in-progress' ? '#fb923c' : '#22d3ee',
                        boxShadow: `0 0 6px ${sub.status === 'in-progress' ? '#fb923c' : '#22d3ee'}80`,
                      }}
                    />
                    <span className="text-slate-300 truncate flex-1 min-w-0" title={sub.title}>
                      {sub.title}
                    </span>
                    <span className="text-[8px] uppercase tracking-wider flex-shrink-0" style={{ color: c.a6 }}>
                      {sub.status === 'in-progress' ? 'в работе' : 'к вып.'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCloseConfirm(false)}
                disabled={closingAll}
                className="flex-1 text-[11px] font-medium px-3 py-2 rounded transition-all text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={() => void completeAllAndClose()}
                disabled={closingAll}
                className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded transition-all disabled:opacity-60"
                style={{
                  color: '#000',
                  backgroundColor: '#FCEE0A',
                  boxShadow: '0 0 12px rgba(252, 238, 10, 0.4), inset 0 1px 0 rgba(255,255,255,0.4)',
                  clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))',
                }}
              >
                {closingAll ? (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="w-3 h-3 rounded-full border-2 border-black/30 border-t-black animate-spin"
                      style={{ animationDuration: '0.6s' }}
                    />
                    Завершение...
                  </span>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Завершить все
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ── Subtasks List ──────────────────────────────────────── */

function SubtasksList({
  stage, boardColor, c, members, onUpdate, onDelete, onMove, reloadTasks,
}: {
  stage: TaskChild;
  boardColor: string;
  c: ColorSet;
  members: GroupMember[];
  onUpdate: (subId: string, patch: Record<string, unknown>) => Promise<void>;
  onDelete: (subId: string) => Promise<void>;
  onMove: (idx: number, dir: -1 | 1) => Promise<void>;
  reloadTasks: () => Promise<void>;
}) {
  const subtasks = stage.children || [];
  const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({});
  const [addingSub, setAddingSub] = useState(false);
  const [newSubTitle, setNewSubTitle] = useState('');

  const toggleExpand = (id: string) => setExpandedSubs(prev => ({ ...prev, [id]: !prev[id] }));

  const addSub = async () => {
    if (!newSubTitle.trim()) return;
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newSubTitle.trim(), parentId: stage.id }),
    });
    setNewSubTitle('');
    setAddingSub(false);
    await reloadTasks();
  };

  if (subtasks.length === 0 && !addingSub) {
    return (
      <div className="ml-3 pl-2 py-1">
        <button
          onClick={() => setAddingSub(true)}
          className="cp-add-btn"
        >
          <Plus className="w-2.5 h-2.5" /> Добавить подзадачу
        </button>
      </div>
    );
  }

  return (
    <div className="ml-3 pl-2 space-y-0.5">
      {subtasks.map((sub, idx) => (
        <SubtaskRow
          key={sub.id}
          subtask={sub}
          index={idx}
          total={subtasks.length}
          boardColor={boardColor}
          c={c}
          members={members}
          isExpanded={!!expandedSubs[sub.id]}
          onToggleExpand={() => toggleExpand(sub.id)}
          onMoveUp={() => onMove(idx, -1)}
          onMoveDown={() => onMove(idx, 1)}
          onDelete={() => onDelete(sub.id)}
          onUpdate={(patch) => onUpdate(sub.id, patch)}
        />
      ))}

      {addingSub ? (
        <div className="pt-1">
          <Input
            value={newSubTitle}
            onChange={(e) => setNewSubTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addSub();
              if (e.key === 'Escape') { setAddingSub(false); setNewSubTitle(''); }
            }}
            placeholder="Название подзадачи..."
            className="bg-[rgba(8,8,16,0.92)] text-[10px] text-slate-300 placeholder:text-slate-600 h-6 rounded-md border focus:outline-none focus-visible:ring-0 transition-colors px-2"
            style={{ borderColor: c.a25 }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#FCEE0A'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = c.a25; }}
            autoFocus
          />
          <div className="flex items-center gap-1.5 mt-1">
            <button
              onClick={() => void addSub()}
              disabled={!newSubTitle.trim()}
              className="text-[9px] px-1.5 py-0.5 rounded font-medium transition-all disabled:opacity-40"
              style={{ color: '#fff', backgroundColor: c.a5 }}
            >
              + Добавить
            </button>
            <button
              onClick={() => { setAddingSub(false); setNewSubTitle(''); }}
              className="text-[9px] text-slate-500 hover:text-slate-300"
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingSub(true)}
          className="cp-add-btn"
        >
          <Plus className="w-2.5 h-2.5" /> Добавить подзадачу
        </button>
      )}
    </div>
  );
}

/* ── Subtask Row ────────────────────────────────────────── */

function SubtaskRow({
  subtask, index, total, boardColor, c, members,
  isExpanded, onToggleExpand, onMoveUp, onMoveDown, onDelete, onUpdate,
}: {
  subtask: TaskGrandchild;
  index: number;
  total: number;
  boardColor: string;
  c: ColorSet;
  members: GroupMember[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onUpdate: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(subtask.title);
  const [descDraft, setDescDraft] = useState(subtask.description || '');
  const [isEditingDesc, setIsEditingDesc] = useState(false);

  const StatusIcon = STATUS_ICON[subtask.status] || Circle;
  const statusHex = STATUS_HEX[subtask.status] || '#64748b';
  const priorityHex = PRIORITY_HEX[subtask.priority] || '#64748b';
  const subDone = subtask.status === 'done';

  // Sync local draft state with prop changes when not actively editing (prev-tracker pattern)
  const [prevSubTitle, setPrevSubTitle] = useState(subtask.title);
  if (subtask.title !== prevSubTitle) {
    setPrevSubTitle(subtask.title);
    if (!isEditingTitle) setTitleDraft(subtask.title);
  }
  const [prevSubDesc, setPrevSubDesc] = useState(subtask.description);
  if (subtask.description !== prevSubDesc) {
    setPrevSubDesc(subtask.description);
    if (!isEditingDesc) setDescDraft(subtask.description || '');
  }

  const saveTitle = async () => {
    if (titleDraft.trim() && titleDraft !== subtask.title) {
      await onUpdate({ title: titleDraft.trim() });
    }
    setIsEditingTitle(false);
  };

  const saveDesc = async () => {
    if (descDraft.trim() !== (subtask.description || '').trim()) {
      await onUpdate({ description: descDraft.trim() || null });
    }
    setIsEditingDesc(false);
  };

  const cycleStatus = async () => {
    const order: TaskStatus[] = ['todo', 'in-progress', 'done'];
    const idx = order.indexOf(subtask.status as TaskStatus);
    const next = order[(idx + 1) % order.length];
    await onUpdate({ status: next });
  };

  const assigneeMember = null; // unused — AssigneePicker handles display

  return (
    <div>
      <div className={cn('cp-subtask-row group/sub', subDone && 'cp-subtask-row-done')}>
        {/* Status cycle */}
        <button
          onClick={(e) => { e.stopPropagation(); void cycleStatus(); }}
          className="flex-shrink-0 p-0.5 rounded transition-opacity hover:opacity-70"
          title="Сменить статус"
        >
          <StatusIcon className="w-3.5 h-3.5" style={{ color: statusHex }} />
        </button>

        {/* Priority selector (interactive bars) */}
        <PrioritySelector
          priority={subtask.priority}
          onChange={(v) => void onUpdate({ priority: v })}
          size="xs"
          boardColor={boardColor}
        />

        {/* Title (inline editable) */}
        {isEditingTitle ? (
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); void saveTitle(); }
              if (e.key === 'Escape') { setIsEditingTitle(false); setTitleDraft(subtask.title); }
            }}
            onBlur={() => void saveTitle()}
            className="flex-1 min-w-0 bg-[rgba(8,8,16,0.92)] rounded px-2 py-0.5 text-[11px] text-slate-100 focus:outline-none focus-visible:ring-0 transition-colors"
            style={{ border: `1.5px solid ${c.a4}` }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#FCEE0A'; }}
            autoFocus
          />
        ) : (
          <button
            onDoubleClick={() => setIsEditingTitle(true)}
            onClick={onToggleExpand}
            className={cn(
              'flex-1 min-w-0 text-left text-[11px] font-medium truncate transition-colors',
              subDone ? 'text-slate-600 line-through' : 'text-[#FCEE0A]'
            )}
            title="Двойной клик — переименовать"
          >
            {subtask.title}
          </button>
        )}

        {/* Assignee picker (multi-select popover) */}
        <AssigneePicker
          assigneeRaw={subtask.assignee}
          members={members}
          onChange={(v) => void onUpdate({ assignee: v })}
          boardColor={boardColor}
          size="xs"
        />

        {/* Deadline */}
        <DeadlinePicker
          value={subtask.deadline || null}
          onChange={(d) => void onUpdate({ deadline: d })}
          isDone={subDone}
          size="sm"
          inline
          boardColor={boardColor}
        />

        {/* Move up/down */}
        <button
          onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          disabled={index === 0}
          className="cp-arrow-btn"
          title="Выше"
        >
          <ArrowUp className="w-3 h-3" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          disabled={index === total - 1}
          className="cp-arrow-btn"
          title="Ниже"
        >
          <ArrowDown className="w-3 h-3" />
        </button>

        {/* Delete */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="cp-delete-btn opacity-0 group-hover/sub:opacity-100"
          title="Удалить"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Expanded subtask content */}
      {isExpanded && (
        <div className="ml-4 px-2 pb-1.5 space-y-1.5">
          {/* Description */}
          {isEditingDesc ? (
            <div className="space-y-1.5">
              <Textarea
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value.slice(0, DESC_LIMIT))}
                placeholder="Описание подзадачи..."
                className="bg-[rgba(8,8,16,0.92)] text-[10px] text-slate-300 placeholder:text-slate-600 min-h-[42px] resize-none focus:outline-none focus-visible:ring-0 focus-visible:border-[#FCEE0A] rounded-md border border-[rgba(252,238,10,0.35)] transition-colors px-2.5 py-1.5"
                autoFocus
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void saveDesc(); }
                  if (e.key === 'Escape') { setIsEditingDesc(false); setDescDraft(subtask.description || ''); }
                }}
              />
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-slate-600 tabular-nums">{descDraft.length}/{DESC_LIMIT}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { setIsEditingDesc(false); setDescDraft(subtask.description || ''); }}
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
          ) : subtask.description ? (
            <button
              onClick={() => setIsEditingDesc(true)}
              className="cp-desc-card w-full text-left"
            >
              <div className="flex items-center gap-1.5 mb-0.5" style={{ opacity: 0.6 }}>
                <FileText className="w-2.5 h-2.5" style={{ color: c.a6 }} />
                <span className="text-[8px] uppercase tracking-wider font-bold" style={{ color: c.a6 }}>
                  Описание подзадачи
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed whitespace-pre-wrap line-clamp-2">
                {subtask.description}
              </p>
            </button>
          ) : (
            <button
              onClick={() => setIsEditingDesc(true)}
              className="cp-add-btn"
            >
              <Plus className="w-2.5 h-2.5" /> описание
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Flat Subtasks List (for non-track tasks) ──────────── */

function FlatSubtasksList({
  task, boardColor, c, members, reloadTasks,
}: {
  task: Task;
  boardColor: string;
  c: ColorSet;
  members: GroupMember[];
  reloadTasks: () => Promise<void>;
}) {
  const subtasks = task.children || [];
  const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({});
  const [addingSub, setAddingSub] = useState(false);
  const [newSubTitle, setNewSubTitle] = useState('');

  const toggleExpand = (id: string) => setExpandedSubs(prev => ({ ...prev, [id]: !prev[id] }));

  const updateSubtask = async (subId: string, patch: Record<string, unknown>) => {
    await fetch('/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: subId, ...patch }),
    });
    await reloadTasks();
  };

  const moveSubtask = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= subtasks.length) return;
    const a = subtasks[idx];
    const b = subtasks[target];
    await Promise.all([
      fetch('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, hexR: b.hexR, hexQ: b.hexQ }) }),
      fetch('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: b.id, hexR: a.hexR, hexQ: a.hexQ }) }),
    ]);
    await reloadTasks();
  };

  const deleteSubtask = async (subId: string) => {
    await fetch(`/api/tasks?id=${subId}`, { method: 'DELETE' });
    await reloadTasks();
  };

  const addSub = async () => {
    if (!newSubTitle.trim()) return;
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newSubTitle.trim(), parentId: task.id, boardId: task.boardId }),
    });
    setNewSubTitle('');
    setAddingSub(false);
    await reloadTasks();
  };

  return (
    <div className="py-2 space-y-0.5">
      {subtasks.length === 0 && !addingSub && (
        <div className="text-center py-6 px-4">
          <AlignJustify className="w-6 h-6 mx-auto mb-2 text-slate-700" />
          <p className="text-[11px] text-slate-500 mb-1">Подзадач пока нет</p>
          <p className="text-[10px] text-slate-600 mb-3">Создайте первую подзадачу</p>
        </div>
      )}

      {subtasks.map((sub, idx) => (
        <SubtaskRow
          key={sub.id}
          subtask={sub as unknown as TaskGrandchild}
          index={idx}
          total={subtasks.length}
          boardColor={boardColor}
          c={c}
          members={members}
          isExpanded={!!expandedSubs[sub.id]}
          onToggleExpand={() => toggleExpand(sub.id)}
          onMoveUp={() => moveSubtask(idx, -1)}
          onMoveDown={() => moveSubtask(idx, 1)}
          onDelete={() => deleteSubtask(sub.id)}
          onUpdate={(patch) => updateSubtask(sub.id, patch)}
        />
      ))}

      {addingSub ? (
        <div className="mx-2 mt-1.5 rounded-lg p-2 space-y-1" style={{ border: `1px dashed ${c.a3}`, backgroundColor: c.a04 }}>
          <Input
            value={newSubTitle}
            onChange={(e) => setNewSubTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addSub();
              if (e.key === 'Escape') { setAddingSub(false); setNewSubTitle(''); }
            }}
            placeholder="Название подзадачи..."
            className="bg-[rgba(8,8,16,0.92)] text-[11px] text-slate-200 placeholder:text-slate-600 h-7 rounded-md border focus:outline-none focus-visible:ring-0 transition-colors px-2"
            style={{ borderColor: c.a3 }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#FCEE0A'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = c.a3; }}
            autoFocus
          />
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => void addSub()}
              disabled={!newSubTitle.trim()}
              className="text-[10px] px-2 py-1 rounded font-medium transition-all disabled:opacity-40"
              style={{ color: '#fff', backgroundColor: c.a5 }}
            >
              + Добавить
            </button>
            <button
              onClick={() => { setAddingSub(false); setNewSubTitle(''); }}
              className="text-[10px] text-slate-500 hover:text-slate-300 px-2 py-1"
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingSub(true)}
          className="cp-add-btn mx-2 w-[calc(100%-1rem)] justify-center"
        >
          <Plus className="w-3 h-3" /> Добавить подзадачу
        </button>
      )}
    </div>
  );
}

/* ── Assignee helpers ─────────────────────────────────── */

function parseAssignees(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
    return [raw];
  } catch {
    return [raw];
  }
}

function serializeAssignees(ids: string[]): string | null {
  if (ids.length === 0) return null;
  return JSON.stringify(ids);
}

/* ── Assignee Picker (popover with multi-select) ──────── */

function AssigneePicker({
  assigneeRaw,
  members,
  onChange,
  boardColor,
  size = 'sm',
}: {
  assigneeRaw: string | null;
  members: GroupMember[];
  onChange: (raw: string | null) => void;
  boardColor: string;
  size?: 'xs' | 'sm';
}) {
  const [open, setOpen] = useState(false);
  const selectedIds = parseAssignees(assigneeRaw);

  const toggleMember = (userId: string) => {
    const next = selectedIds.includes(userId)
      ? selectedIds.filter(id => id !== userId)
      : [...selectedIds, userId];
    onChange(serializeAssignees(next));
  };

  const selectedMembers = selectedIds
    .map(id => members.find(m => m.userId === id || m.displayName === id))
    .filter(Boolean) as GroupMember[];
  const isSmall = size === 'xs';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'flex items-center gap-0.5 rounded-full transition-all cursor-pointer flex-shrink-0',
            isSmall ? 'h-5' : 'h-6',
          )}
          title={selectedMembers.length > 0
            ? selectedMembers.map(m => m.displayName).join(', ')
            : 'Назначить ответственных'
          }
        >
          {selectedMembers.length === 0 ? (
            <div
              className={cn(
                'rounded-full flex items-center justify-center border border-dashed',
                isSmall ? 'w-4 h-4' : 'w-5 h-5'
              )}
              style={{ borderColor: hexToRgba(boardColor, 0.4) }}
            >
              <User className={isSmall ? 'w-2 h-2' : 'w-2.5 h-2.5'} style={{ color: hexToRgba(boardColor, 0.5) }} />
            </div>
          ) : (
            <>
              {selectedMembers.slice(0, 2).map((m, i) => (
                <div
                  key={m.userId}
                  className={cn('rounded-full overflow-hidden flex-shrink-0', isSmall ? 'w-4 h-4' : 'w-5 h-5')}
                  style={{
                    backgroundColor: hexToRgba(boardColor, 0.5),
                    border: `1px solid ${hexToRgba(boardColor, 0.7)}`,
                    marginLeft: i > 0 ? '-4px' : 0,
                    zIndex: 10 - i,
                  }}
                >
                  {m.avatarUrl ? (
                    <img src={m.avatarUrl} alt={m.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className={cn('font-bold text-white', isSmall ? 'text-[7px]' : 'text-[8px]')}>
                        {(m.displayName || '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              ))}
              {selectedMembers.length > 2 && (
                <div
                  className={cn('rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white', isSmall ? 'w-4 h-4 text-[7px]' : 'w-5 h-5 text-[8px]')}
                  style={{
                    backgroundColor: hexToRgba(boardColor, 0.6),
                    border: `1px solid ${hexToRgba(boardColor, 0.8)}`,
                    marginLeft: '-4px',
                    zIndex: 7,
                  }}
                >
                  +{selectedMembers.length - 2}
                </div>
              )}
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-2 shadow-2xl shadow-black/40 z-[70] border-0 rounded-none"
        style={{
          background: 'rgba(8, 10, 18, 0.97)',
          border: `1.5px solid ${hexToRgba(boardColor, 0.4)}`,
          clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
          boxShadow: `0 0 24px ${hexToRgba(boardColor, 0.15)}, 0 8px 32px rgba(0,0,0,0.6)`,
        }}
        align="center"
        sideOffset={6}
        onClick={(e) => e.stopPropagation()}
      >
        <p
          className="text-[9px] uppercase tracking-wider font-bold mb-1.5 px-1"
          style={{ color: '#FCEE0A', textShadow: '0 0 4px rgba(252,238,10,0.3)' }}
        >
          Ответственные
        </p>
        {members.length === 0 ? (
          <p className="text-[10px] text-slate-600 py-2 text-center">Нет участников группы</p>
        ) : (
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {members.map(m => {
              const isSelected = selectedIds.includes(m.userId) || selectedIds.includes(m.displayName);
              return (
                <button
                  key={m.userId}
                  onClick={(e) => { e.stopPropagation(); toggleMember(m.userId); }}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 transition-all',
                    isSelected ? '' : 'hover:bg-white/5',
                  )}
                  style={isSelected ? {
                    background: hexToRgba(boardColor, 0.12),
                    boxShadow: `inset 2px 0 0 ${boardColor}`,
                  } : undefined}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
                    style={{
                      backgroundColor: hexToRgba(boardColor, 0.5),
                      border: `1px solid ${isSelected ? boardColor : hexToRgba(boardColor, 0.3)}`,
                    }}
                  >
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt={m.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[8px] font-bold text-white">
                        {(m.displayName || '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <span className={cn('text-[11px] font-medium truncate block', isSelected ? 'text-slate-100' : 'text-slate-300')}>
                      {m.displayName || m.email}
                    </span>
                    {m.instrument && (
                      <span className="text-[9px] text-slate-600">{m.instrument}</span>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: boardColor }} />
                  )}
                </button>
              );
            })}
          </div>
        )}
        {selectedIds.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            className="w-full mt-1.5 text-[10px] text-slate-600 hover:text-rose-400 transition-colors py-1 border-t border-slate-800"
          >
            Сбросить всех
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ── Helpers ───────────────────────────────────────────── */

async function updateSubtask(subId: string, patch: Record<string, unknown>, reloadTasks: () => Promise<void>) {
  await fetch('/api/tasks', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: subId, ...patch }),
  });
  await reloadTasks();
}

async function moveSubtask(stage: TaskChild, idx: number, dir: -1 | 1, reloadTasks: () => Promise<void>) {
  const subtasks = stage.children || [];
  const target = idx + dir;
  if (target < 0 || target >= subtasks.length) return;
  const a = subtasks[idx];
  const b = subtasks[target];
  await Promise.all([
    fetch('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, hexR: b.hexR, hexQ: b.hexQ }) }),
    fetch('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: b.id, hexR: a.hexR, hexQ: a.hexQ }) }),
  ]);
  await reloadTasks();
}

function getProgress(children: { status: string }[]): number {
  if (children.length === 0) return 0;
  const done = children.filter(c => c.status === 'done').length;
  return Math.round((done / children.length) * 100);
}
