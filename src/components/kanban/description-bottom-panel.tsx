'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useKanbanStore, Task, TaskChild, TaskGrandchild, TaskStatus, TaskPriority } from '@/store/kanban-store';
import { useAuthStore } from '@/lib/store';
import {
  X, Save, Plus, Check, Circle, Clock, Eye, Pencil, Trash2,
  ChevronDown, ChevronRight, User, CalendarDays,
  AlertTriangle, Flame, ListChecks, Layers, ArrowUp, ArrowDown, GripVertical,
  AlignJustify,
} from 'lucide-react';
import DeadlinePicker, { getDeadlineInfo } from '@/components/kanban/deadline-picker';
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
  { value: 'review', label: 'На проверке', hex: '#fb7185', icon: Eye },
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
  review: '#fb7185',
  done: '#34d399',
};

const PRIORITY_HEX: Record<string, string> = {
  low: '#64748b',
  medium: '#f59e0b',
  high: '#f43f5e',
};

const STATUS_ICON: Record<string, typeof Circle> = {
  todo: Circle,
  'in-progress': Clock,
  review: Eye,
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
  a04: string;
  a08: string;
  a1: string;
  a12: string;
  a15: string;
  a2: string;
  a25: string;
  a3: string;
  a4: string;
  a5: string;
  a6: string;
  a7: string;
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

  // The selected track task (auto-show panel when a track is selected)
  const selectedTask = boardTasks.find(t => t.id === selectedTaskId);
  const isTrackTask = !!selectedTask?.trackConfig;

  // Also handle "Manage subtasks" hint for non-track tasks
  const stagePanelTaskId = selectedStageForPanel?.taskId;
  const stagePanelTask = boardTasks.find(t => t.id === stagePanelTaskId);
  const isNonTrackManage = !!(selectedStageForPanel && stagePanelTask && !stagePanelTask.trackConfig);

  const shouldShow = isTrackTask || isNonTrackManage;
  const task = isTrackTask ? selectedTask : stagePanelTask;
  const taskId = task?.id || null;

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
    const isTracks = useKanbanStore.getState().boards.find(b => b.id === selectedBoardId)?.boardType === 'tracks';
    const url = `/api/tasks?boardId=${selectedBoardId}${isTracks ? '&deep=true' : ''}`;
    const res = await fetch(url);
    const data = await res.json();
    setBoardTasks(data.tasks);
  }, [selectedBoardId, setBoardTasks]);

  const c = useMemo<ColorSet>(() => ({
    raw: boardColor,
    a04: hexToRgba(boardColor, 0.04),
    a08: hexToRgba(boardColor, 0.08),
    a1: hexToRgba(boardColor, 0.1),
    a12: hexToRgba(boardColor, 0.12),
    a15: hexToRgba(boardColor, 0.15),
    a2: hexToRgba(boardColor, 0.2),
    a25: hexToRgba(boardColor, 0.25),
    a3: hexToRgba(boardColor, 0.3),
    a4: hexToRgba(boardColor, 0.4),
    a5: hexToRgba(boardColor, 0.5),
    a6: hexToRgba(boardColor, 0.6),
    a7: hexToRgba(boardColor, 0.7),
  }), [boardColor]);

  if (!shouldShow || !task) return null;

  const stagesCount = task.children?.length || 0;
  const subtasksCount = (task.children || []).flatMap(s => s.children || []).length;

  return (
    <div
      className="flex-shrink-0 flex flex-col"
      style={{
        borderTop: `1px solid ${c.a25}`,
        backgroundColor: '#08080f',
        height: isCollapsed ? '36px' : '320px',
        transition: 'height 220ms ease',
      }}
    >
      {/* Accent gradient line */}
      <div
        className="h-[2px] flex-shrink-0"
        style={{ background: `linear-gradient(90deg, ${c.a6}, ${c.a1})` }}
      />

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0"
        style={{ borderBottom: isCollapsed ? 'none' : `1px solid ${c.a12}` }}
      >
        <button
          onClick={() => setIsCollapsed(v => !v)}
          className="flex items-center gap-1.5 min-w-0 flex-1 text-left group"
          title={isCollapsed ? 'Развернуть' : 'Свернуть'}
        >
          <Layers className="w-3.5 h-3.5 flex-shrink-0" style={{ color: c.a6 }} />
          <span
            className="text-[11px] font-semibold text-slate-200 truncate"
            style={{ color: c.raw }}
          >
            {task.trackConfig ? 'Этапы и подзадачи' : 'Подзадачи'}
          </span>
          <span className="text-[9px] text-slate-500 truncate hidden sm:inline">
            · {task.title}
          </span>
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: c.a12, color: c.raw }}
          >
            {task.trackConfig ? `${stagesCount} эт. · ${subtasksCount} подзад.` : `${stagesCount} подзад.`}
          </span>
        </button>

        {!isCollapsed && (
          <button
            onClick={() => setSelectedStageForPanel(null)}
            className="p-1 rounded-md hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
            title="Закрыть"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        <button
          onClick={() => setIsCollapsed(v => !v)}
          className="p-1 rounded-md hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
          title={isCollapsed ? 'Развернуть' : 'Свернуть'}
        >
          {isCollapsed
            ? <ChevronDown className="w-3 h-3" />
            : <ChevronDown className="w-3 h-3 rotate-180" />
          }
        </button>
      </div>

      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto min-h-0 panel-scroll">
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

      <style jsx global>{`
        .panel-scroll::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .panel-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .panel-scroll::-webkit-scrollbar-thumb {
          background: ${c.a25};
          border-radius: 3px;
        }
        .panel-scroll::-webkit-scrollbar-thumb:hover {
          background: ${c.a4};
        }
      `}</style>
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
            className="bg-slate-900/80 border-slate-700/50 text-[11px] text-slate-200 placeholder:text-slate-600 h-7"
            style={{ borderColor: c.a3 }}
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
          className="w-full mx-2 flex items-center justify-center gap-1.5 py-2 text-[10px] text-slate-500 transition-all"
          style={{ width: 'calc(100% - 1rem)' }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.color = c.raw;
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.color = '';
          }}
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

  const subtasks = stage.children || [];
  const stageProgress = getProgress(subtasks);
  const StatusIcon = STATUS_ICON[stage.status] || Circle;
  const statusHex = STATUS_HEX[stage.status] || '#64748b';
  const priorityHex = PRIORITY_HEX[stage.priority] || '#64748b';

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
    const order: TaskStatus[] = ['todo', 'in-progress', 'review', 'done'];
    const idx = order.indexOf(stage.status as TaskStatus);
    const next = order[(idx + 1) % order.length];
    await onUpdate({ status: next });
  };

  const deadlineInfo = getDeadlineInfo(stage.deadline || null);
  const assigneeMember = stage.assignee ? members.find(m => m.userId === stage.assignee || m.displayName === stage.assignee) : null;
  const assigneeLabel = stage.assignee || null;

  return (
    <div
      className="mx-2 rounded-lg overflow-hidden transition-all"
      style={{
        border: `1px solid ${isSelected ? c.a4 : c.a15}`,
        backgroundColor: isSelected ? c.a08 : 'rgba(15, 15, 25, 0.4)',
        boxShadow: isSelected ? `0 0 12px ${c.a15}` : 'none',
      }}
    >
      {/* Stage header */}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        {/* Drag handle (visual) */}
        <GripVertical className="w-3 h-3 text-slate-700 flex-shrink-0" />

        {/* Status cycle */}
        <button
          onClick={(e) => { e.stopPropagation(); void cycleStatus(); }}
          className="flex-shrink-0 transition-opacity hover:opacity-70"
          title="Сменить статус"
        >
          <StatusIcon className="w-3.5 h-3.5" style={{ color: statusHex }} />
        </button>

        {/* Priority dot */}
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: priorityHex, boxShadow: `0 0 4px ${priorityHex}80` }}
          title={`Приоритет: ${PRIORITIES.find(p => p.value === stage.priority)?.label || stage.priority}`}
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
            className="flex-1 min-w-0 bg-slate-900/80 rounded px-1.5 py-0.5 text-[11px] text-slate-200 focus:outline-none"
            style={{ border: `1px solid ${c.a4}` }}
            autoFocus
          />
        ) : (
          <button
            onDoubleClick={() => setIsEditingTitle(true)}
            onClick={() => { onSelect(); onToggleExpand(); }}
            className={cn(
              'flex-1 min-w-0 text-left text-[11px] font-medium truncate transition-colors',
              stage.status === 'done' ? 'text-slate-600 line-through' : 'text-slate-200'
            )}
            title="Двойной клик — переименовать"
          >
            {stage.title}
          </button>
        )}

        {/* Subtask count badge */}
        {subtasks.length > 0 && (
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 tabular-nums"
            style={{ backgroundColor: c.a12, color: c.raw }}
            title={`${subtasks.length} подзадач · ${stageProgress}%`}
          >
            {stageProgress}%
          </span>
        )}

        {/* Assignee avatar */}
        {assigneeLabel && (
          <AssigneeAvatar
            label={assigneeLabel}
            member={assigneeMember}
            boardColor={boardColor}
            size="sm"
          />
        )}

        {/* Deadline */}
        <DeadlinePicker
          value={stage.deadline || null}
          onChange={(d) => void onUpdate({ deadline: d })}
          isDone={stage.status === 'done'}
          size="sm"
          inline
        />

        {/* Move up/down */}
        <div className="flex items-center opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity flex-shrink-0"
          style={{ opacity: 1 }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
            disabled={index === 0}
            className="p-0.5 rounded hover:bg-slate-800 text-slate-600 hover:text-slate-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Выше"
          >
            <ArrowUp className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            disabled={index === total - 1}
            className="p-0.5 rounded hover:bg-slate-800 text-slate-600 hover:text-slate-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Ниже"
          >
            <ArrowDown className="w-3 h-3" />
          </button>
        </div>

        {/* Delete */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-0.5 rounded hover:bg-rose-500/10 text-slate-700 hover:text-rose-400 transition-all flex-shrink-0"
          title="Удалить этап"
        >
          <Trash2 className="w-3 h-3" />
        </button>

        {/* Expand arrow */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
          className="p-0.5 rounded hover:bg-slate-800 text-slate-500 transition-colors flex-shrink-0"
        >
          {isExpanded
            ? <ChevronDown className="w-3 h-3 rotate-180" />
            : <ChevronDown className="w-3 h-3" />
          }
        </button>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-2 pb-2 space-y-1.5">
          {/* Progress bar */}
          {subtasks.length > 0 && (
            <div className="px-1">
              <div className="h-1 bg-slate-800/60 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${stageProgress}%`,
                    backgroundColor: stageProgress === 100 ? '#10b981' : stageProgress > 50 ? boardColor : stageProgress > 0 ? '#f59e0b' : '#334155',
                  }}
                />
              </div>
            </div>
          )}

          {/* Description editor */}
          <div>
            {isEditingDesc ? (
              <div className="space-y-1">
                <Textarea
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value.slice(0, DESC_LIMIT))}
                  placeholder="Описание этапа..."
                  className="bg-slate-900/80 text-[10px] text-slate-300 placeholder:text-slate-600 min-h-[50px] resize-none focus:outline-none"
                  style={{ border: `1px solid ${c.a3}` }}
                  autoFocus
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void saveDesc(); }
                    if (e.key === 'Escape') { setIsEditingDesc(false); setDescDraft(stage.description || ''); }
                  }}
                  onBlur={() => void saveDesc()}
                />
                <div className="flex items-center justify-between">
                  <span className="text-[8px] text-slate-600 tabular-nums">{descDraft.length}/{DESC_LIMIT}</span>
                  <span className="text-[8px] text-slate-700">Ctrl+Enter — сохранить</span>
                </div>
              </div>
            ) : stage.description ? (
              <button
                onClick={() => setIsEditingDesc(true)}
                className="w-full text-left rounded px-2 py-1 transition-colors hover:bg-slate-800/40"
                style={{ border: `1px solid ${c.a12}`, backgroundColor: c.a04 }}
              >
                <p className="text-[10px] text-slate-400 leading-relaxed whitespace-pre-wrap line-clamp-3">
                  {stage.description}
                </p>
              </button>
            ) : (
              <button
                onClick={() => setIsEditingDesc(true)}
                className="text-[10px] transition-colors py-0.5 px-1"
                style={{ color: c.a3 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = c.a6; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = c.a3; }}
              >
                + описание этапа
              </button>
            )}
          </div>

          {/* Metadata controls row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Priority select */}
            <Select
              value={stage.priority}
              onValueChange={(v) => void onUpdate({ priority: v })}
            >
              <SelectTrigger
                className="h-6 text-[10px] bg-slate-900/80 border-slate-700/50 text-slate-300 px-2 py-0 w-auto min-w-[90px]"
                style={{ borderColor: c.a2 }}
              >
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: priorityHex }} />
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {PRIORITIES.map(p => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.hex }} />
                      {p.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Assignee select */}
            <AssigneeSelect
              value={stage.assignee}
              members={members}
              onChange={(v) => void onUpdate({ assignee: v })}
              boardColor={boardColor}
            />

            {/* Status display */}
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: hexToRgba(statusHex, 0.15), color: statusHex }}
            >
              {STATUSES.find(s => s.value === stage.status)?.label || stage.status}
            </span>
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
      <div className="ml-3 pl-2 border-l border-slate-800/60 py-1">
        <button
          onClick={() => setAddingSub(true)}
          className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = c.raw; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = ''; }}
        >
          <Plus className="w-2.5 h-2.5" /> Добавить подзадачу
        </button>
      </div>
    );
  }

  return (
    <div className="ml-3 pl-2 border-l border-slate-800/60 space-y-0.5">
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
            className="bg-slate-900/80 border-slate-700/50 text-[10px] text-slate-300 placeholder:text-slate-600 h-6"
            style={{ borderColor: c.a25 }}
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
          className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-400 transition-colors py-0.5"
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = c.raw; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = ''; }}
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
    const order: TaskStatus[] = ['todo', 'in-progress', 'review', 'done'];
    const idx = order.indexOf(subtask.status as TaskStatus);
    const next = order[(idx + 1) % order.length];
    await onUpdate({ status: next });
  };

  const assigneeMember = subtask.assignee ? members.find(m => m.userId === subtask.assignee || m.displayName === subtask.assignee) : null;

  return (
    <div>
      <div className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-slate-800/40 transition-colors group/sub">
        {/* Status cycle */}
        <button
          onClick={(e) => { e.stopPropagation(); void cycleStatus(); }}
          className="flex-shrink-0 transition-opacity hover:opacity-70"
          title="Сменить статус"
        >
          <StatusIcon className="w-3 h-3" style={{ color: statusHex }} />
        </button>

        {/* Priority dot */}
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: priorityHex }}
          title={`Приоритет: ${PRIORITIES.find(p => p.value === subtask.priority)?.label || subtask.priority}`}
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
            className="flex-1 min-w-0 bg-slate-900/80 rounded px-1.5 py-0.5 text-[10px] text-slate-200 focus:outline-none"
            style={{ border: `1px solid ${c.a3}` }}
            autoFocus
          />
        ) : (
          <button
            onDoubleClick={() => setIsEditingTitle(true)}
            onClick={onToggleExpand}
            className={cn(
              'flex-1 min-w-0 text-left text-[10px] truncate transition-colors',
              subDone ? 'text-slate-600 line-through' : 'text-slate-300'
            )}
            title="Двойной клик — переименовать"
          >
            {subtask.title}
          </button>
        )}

        {/* Assignee avatar */}
        {subtask.assignee && (
          <AssigneeAvatar
            label={subtask.assignee}
            member={assigneeMember}
            boardColor={boardColor}
            size="xs"
          />
        )}

        {/* Deadline */}
        <DeadlinePicker
          value={subtask.deadline || null}
          onChange={(d) => void onUpdate({ deadline: d })}
          isDone={subDone}
          size="sm"
          inline
        />

        {/* Move up/down */}
        <button
          onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          disabled={index === 0}
          className="p-0.5 rounded hover:bg-slate-700 text-slate-700 hover:text-slate-300 transition-colors disabled:opacity-20 disabled:cursor-not-allowed flex-shrink-0"
          title="Выше"
        >
          <ArrowUp className="w-2.5 h-2.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          disabled={index === total - 1}
          className="p-0.5 rounded hover:bg-slate-700 text-slate-700 hover:text-slate-300 transition-colors disabled:opacity-20 disabled:cursor-not-allowed flex-shrink-0"
          title="Ниже"
        >
          <ArrowDown className="w-2.5 h-2.5" />
        </button>

        {/* Delete */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-0.5 rounded hover:bg-rose-500/10 text-slate-700 hover:text-rose-400 transition-all opacity-0 group-hover/sub:opacity-100 flex-shrink-0"
          title="Удалить"
        >
          <Trash2 className="w-2.5 h-2.5" />
        </button>
      </div>

      {/* Expanded subtask content */}
      {isExpanded && (
        <div className="ml-4 px-2 pb-1.5 space-y-1.5">
          {/* Description */}
          {isEditingDesc ? (
            <Textarea
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value.slice(0, DESC_LIMIT))}
              placeholder="Описание подзадачи..."
              className="bg-slate-900/80 text-[10px] text-slate-300 placeholder:text-slate-600 min-h-[40px] resize-none focus:outline-none"
              style={{ border: `1px solid ${c.a25}` }}
              autoFocus
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void saveDesc(); }
                if (e.key === 'Escape') { setIsEditingDesc(false); setDescDraft(subtask.description || ''); }
              }}
              onBlur={() => void saveDesc()}
            />
          ) : subtask.description ? (
            <button
              onClick={() => setIsEditingDesc(true)}
              className="w-full text-left rounded px-1.5 py-1 transition-colors hover:bg-slate-800/40"
              style={{ border: `1px solid ${c.a12}`, backgroundColor: c.a04 }}
            >
              <p className="text-[9px] text-slate-500 leading-relaxed whitespace-pre-wrap line-clamp-2">
                {subtask.description}
              </p>
            </button>
          ) : (
            <button
              onClick={() => setIsEditingDesc(true)}
              className="text-[9px] transition-colors py-0.5"
              style={{ color: c.a3 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = c.a6; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = c.a3; }}
            >
              + описание
            </button>
          )}

          {/* Metadata row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Priority */}
            <Select
              value={subtask.priority}
              onValueChange={(v) => void onUpdate({ priority: v })}
            >
              <SelectTrigger
                className="h-5 text-[9px] bg-slate-900/80 border-slate-700/50 text-slate-300 px-1.5 py-0 w-auto min-w-[80px]"
                style={{ borderColor: c.a2 }}
              >
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: priorityHex }} />
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {PRIORITIES.map(p => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.hex }} />
                      {p.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Assignee */}
            <AssigneeSelect
              value={subtask.assignee}
              members={members}
              onChange={(v) => void onUpdate({ assignee: v })}
              boardColor={boardColor}
              compact
            />
          </div>
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
            className="bg-slate-900/80 border-slate-700/50 text-[11px] text-slate-200 placeholder:text-slate-600 h-7"
            style={{ borderColor: c.a3 }}
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
          className="w-full flex items-center justify-center gap-1.5 py-2 text-[10px] text-slate-500 transition-colors"
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = c.raw; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = ''; }}
        >
          <Plus className="w-3 h-3" /> Добавить подзадачу
        </button>
      )}
    </div>
  );
}

/* ── Assignee Avatar ───────────────────────────────────── */

function AssigneeAvatar({
  label, member, boardColor, size = 'sm',
}: {
  label: string;
  member: GroupMember | null | undefined;
  boardColor: string;
  size?: 'xs' | 'sm';
}) {
  const initial = label.charAt(0).toUpperCase();
  const avatarUrl = member?.avatarUrl;
  const isSmall = size === 'xs';
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden',
        isSmall ? 'w-4 h-4' : 'w-5 h-5'
      )}
      style={{
        backgroundColor: hexToRgba(boardColor, 0.5),
        border: `1px solid ${hexToRgba(boardColor, 0.7)}`,
      }}
      title={label + (member?.instrument ? ` · ${member.instrument}` : '')}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={label} className="w-full h-full object-cover" />
      ) : (
        <span className={cn('font-bold text-white', isSmall ? 'text-[7px]' : 'text-[8px]')}>
          {initial}
        </span>
      )}
    </div>
  );
}

/* ── Assignee Select ───────────────────────────────────── */

function AssigneeSelect({
  value, members, onChange, boardColor, compact = false,
}: {
  value: string | null;
  members: GroupMember[];
  onChange: (v: string | null) => void;
  boardColor: string;
  compact?: boolean;
}) {
  // If value is set but not in members list (e.g., legacy assignee name), include it as an option
  const isInMembers = value && members.find(m => m.userId === value || m.displayName === value);
  const displayValue = value || '';

  return (
    <Select
      value={displayValue || '__none__'}
      onValueChange={(v) => onChange(v === '__none__' ? null : v)}
    >
      <SelectTrigger
        className={cn(
          'bg-slate-900/80 border-slate-700/50 text-slate-300 px-2 py-0 w-auto min-w-[110px]',
          compact ? 'h-5 text-[9px]' : 'h-6 text-[10px]'
        )}
        style={{ borderColor: hexToRgba(boardColor, 0.2) }}
      >
        <span className="flex items-center gap-1 truncate">
          <User className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} style={{ color: hexToRgba(boardColor, 0.6) }} />
          <SelectValue placeholder="Не назначен" />
        </span>
      </SelectTrigger>
      <SelectContent className="bg-slate-900 border-slate-700 max-h-60 overflow-y-auto">
        <SelectItem value="__none__">
          <span className="text-slate-500">— Не назначен —</span>
        </SelectItem>
        {value && !isInMembers && (
          <SelectItem value={value}>
            <span className="flex items-center gap-1.5">
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white"
                style={{ backgroundColor: hexToRgba(boardColor, 0.5) }}
              >
                {value.charAt(0).toUpperCase()}
              </span>
              {value}
            </span>
          </SelectItem>
        )}
        {members.map(m => (
          <SelectItem key={m.userId} value={m.userId}>
            <span className="flex items-center gap-1.5">
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white overflow-hidden flex-shrink-0"
                style={{ backgroundColor: hexToRgba(boardColor, 0.5) }}
              >
                {m.avatarUrl ? (
                  <img src={m.avatarUrl} alt={m.displayName || ''} className="w-full h-full object-cover" />
                ) : (
                  (m.displayName || '?').charAt(0).toUpperCase()
                )}
              </span>
              <span className="truncate">{m.displayName || m.email || m.userId}</span>
              {m.instrument && (
                <span className="text-[8px] text-slate-600">· {m.instrument}</span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
