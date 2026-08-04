'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useKanbanStore, Task, TaskChild, TaskStatus } from '@/store/kanban-store';
import { X, Save, CalendarDays, AlertTriangle, Flame, Clock, Plus, Check, Circle, Pencil, Trash2 } from 'lucide-react';
import { hexToRgba } from '@/lib/utils';
import DeadlinePicker, { getDeadlineInfo, MONTHS_RU } from '@/components/kanban/deadline-picker';
import { cn } from '@/lib/utils';

const DESC_LIMIT = 2000;
const STATUS_ICON: Record<string, typeof Circle> = {
  'todo': Circle,
  'in-progress': Clock,
  'review': X,
  'done': Check,
};
const STATUS_COLOR: Record<string, string> = {
  'todo': '#64748b',
  'in-progress': '#f59e0b',
  'review': '#f43f5e',
  'done': '#10b981',
};

export default function DescriptionBottomPanel() {
  const {
    selectedStageForPanel,
    setSelectedStageForPanel,
    descriptionEditorItem,
    setDescriptionEditorItem,
    selectedBoardId,
    setBoardTasks,
    boards,
    boardTasks,
  } = useKanbanStore();

  const selectedBoard = boards.find(b => b.id === selectedBoardId);
  const boardColor = selectedBoard?.color || '#00d9ff';

  // If descriptionEditorItem is set (legacy: clicking subtask), show the old editor
  if (!selectedStageForPanel && !descriptionEditorItem) return null;
  if (descriptionEditorItem && !selectedStageForPanel) {
    return <LegacyDescriptionEditor />;
  }

  if (!selectedStageForPanel) return null;

  // Find the parent task and stage
  const parentTask = boardTasks.find(t => t.id === selectedStageForPanel.taskId);
  if (!parentTask) {
    // Task not found in current board, clear selection
    setSelectedStageForPanel(null);
    return null;
  }
  const stage = (parentTask.children || []).find(c => c.id === selectedStageForPanel.stageId);
  if (!stage) {
    setSelectedStageForPanel(null);
    return null;
  }

  return (
    <StageBranchPanel
      stage={stage}
      parentTaskTitle={parentTask.title}
      boardColor={boardColor}
      boardId={selectedBoardId!}
    />
  );
}

/* ── Stage Branch Panel ────────────────────────────────── */

function StageBranchPanel({
  stage,
  parentTaskTitle,
  boardColor,
  boardId,
}: {
  stage: TaskChild;
  parentTaskTitle: string;
  boardColor: string;
  boardId: string;
}) {
  const { setSelectedStageForPanel, setBoardTasks, selectedBoardId, boardTasks, setSelectedTaskId } = useKanbanStore();

  // Local state: we need fresh data, so we fetch stage from parent task on each render
  const parentTask = boardTasks.find(t => t.id === useKanbanStore.getState().selectedStageForPanel?.taskId);
  const freshStage = parentTask ? (parentTask.children || []).find(c => c.id === stage.id) : stage;

  const subtasks = freshStage?.children || [];
  const [stageDesc, setStageDesc] = useState(freshStage?.description || '');
  const [isStageDescDirty, setIsStageDescDirty] = useState(false);
  const [isStageDescExpanded, setIsStageDescExpanded] = useState(false);
  const [isStageDescEditing, setIsStageDescEditing] = useState(false);
  const [savingStageDesc, setSavingStageDesc] = useState(false);
  const [stageDeadline, setStageDeadline] = useState<string | null>(freshStage?.deadline || null);

  const [expandedSubtaskDescs, setExpandedSubtaskDescs] = useState<Record<string, boolean>>({});
  const [editingSubtaskDescIds, setEditingSubtaskDescIds] = useState<Record<string, boolean>>({});
  const [subtaskDescDrafts, setSubtaskDescDrafts] = useState<Record<string, string>>({});
  const [subtaskDeadlines, setSubtaskDeadlines] = useState<Record<string, string | null>>({});

  const [addingSubtask, setAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const subtaskInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const stageDone = freshStage?.status === 'done';
  const stageProgress = getProgress(subtasks);
  const StatusIcon = STATUS_ICON[freshStage?.status || 'todo'] || Circle;
  const stageStatusColor = STATUS_COLOR[freshStage?.status || 'todo'] || '#64748b';

  // Colors
  const c = useMemo(() => ({
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
    a8: hexToRgba(boardColor, 0.8),
    raw: boardColor,
  }), [boardColor]);

  // Sync local state when stage data changes
  useEffect(() => {
    if (freshStage) {
      if (!isStageDescDirty) {
        setStageDesc(freshStage.description || '');
      }
      if (stageDeadline === null && freshStage.deadline) {
        setSubtaskDeadlines(prev => {
          const next = { ...prev };
          (freshStage.children || []).forEach(st => {
            if (!(st.id in next)) {
              next[st.id] = st.deadline;
            }
          });
          return next;
        });
      }
    }
  }, [freshStage?.id, freshStage?.description]);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isStageDescDirty && !Object.values(editingSubtaskDescIds).some(Boolean)) {
        setSelectedStageForPanel(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isStageDescDirty, editingSubtaskDescIds, setSelectedStageForPanel]);

  // Reload tasks helper
  const reloadTasks = useCallback(async () => {
    if (!selectedBoardId) return;
    const isTracks = useKanbanStore.getState().boards.find(b => b.id === selectedBoardId)?.boardType === 'tracks';
    const url = `/api/tasks?boardId=${selectedBoardId}${isTracks ? '&deep=true' : ''}`;
    const res = await fetch(url);
    const data = await res.json();
    setBoardTasks(data.tasks);
  }, [selectedBoardId, setBoardTasks]);

  // Save stage description
  const saveStageDesc = useCallback(async () => {
    if (!freshStage || savingStageDesc) return;
    setSavingStageDesc(true);
    try {
      await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: freshStage.id, description: stageDesc.trim() || null }),
      });
      setIsStageDescDirty(false);
      await reloadTasks();
    } finally {
      setSavingStageDesc(false);
    }
  }, [freshStage, stageDesc, savingStageDesc, reloadTasks]);

  // Save subtask description
  const saveSubtaskDesc = useCallback(async (subtaskId: string) => {
    const draft = subtaskDescDrafts[subtaskId];
    if (draft === undefined) return;
    await fetch('/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: subtaskId, description: draft.trim() || null }),
    });
    setEditingSubtaskDescIds(prev => ({ ...prev, [subtaskId]: false }));
    await reloadTasks();
  }, [subtaskDescDrafts, reloadTasks]);

  // Change stage deadline
  const handleStageDeadlineChange = useCallback(async (date: string | null) => {
    if (!freshStage) return;
    setStageDeadline(date);
    await fetch('/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: freshStage.id, deadline: date }),
    });
    await reloadTasks();
  }, [freshStage, reloadTasks]);

  // Change subtask deadline
  const handleSubtaskDeadlineChange = useCallback(async (subtaskId: string, date: string | null) => {
    setSubtaskDeadlines(prev => ({ ...prev, [subtaskId]: date }));
    await fetch('/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: subtaskId, deadline: date }),
    });
    await reloadTasks();
  }, [reloadTasks]);

  // Cycle stage status
  const cycleStageStatus = useCallback(async () => {
    if (!freshStage) return;
    const order: TaskStatus[] = ['todo', 'in-progress', 'review', 'done'];
    const idx = order.indexOf(freshStage.status as TaskStatus);
    const next = order[(idx + 1) % order.length];
    await fetch('/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: freshStage.id, status: next }),
    });
    await reloadTasks();
  }, [freshStage, reloadTasks]);

  // Cycle subtask status
  const cycleSubtaskStatus = useCallback(async (e: React.MouseEvent, subtaskId: string) => {
    e.stopPropagation();
    const st = subtasks.find(s => s.id === subtaskId);
    if (!st) return;
    const order: TaskStatus[] = ['todo', 'in-progress', 'review', 'done'];
    const idx = order.indexOf(st.status as TaskStatus);
    const next = order[(idx + 1) % order.length];
    await fetch('/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: subtaskId, status: next }),
    });
    await reloadTasks();
  }, [subtasks, reloadTasks]);

  // Add subtask
  const addSubtask = useCallback(async () => {
    if (!newSubtaskTitle.trim() || !freshStage) return;
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newSubtaskTitle.trim(), parentId: freshStage.id }),
    });
    setNewSubtaskTitle('');
    setAddingSubtask(false);
    await reloadTasks();
    // Scroll to end
    setTimeout(() => {
      scrollRef.current?.scrollTo({ left: scrollRef.current.scrollWidth, behavior: 'smooth' });
    }, 100);
  }, [newSubtaskTitle, freshStage, reloadTasks]);

  // Delete subtask
  const deleteSubtask = useCallback(async (e: React.MouseEvent, subtaskId: string) => {
    e.stopPropagation();
    await fetch(`/api/tasks?id=${subtaskId}`, { method: 'DELETE' });
    await reloadTasks();
  }, [reloadTasks]);

  // Get deadline info for inline display
  const stageDeadlineInfo = useMemo(() => getDeadlineInfo(freshStage?.deadline || null), [freshStage?.deadline]);

  return (
    <div
      className="flex-shrink-0 flex flex-col"
      style={{
        borderTop: `1px solid ${c.a25}`,
        backgroundColor: '#08080f',
        maxHeight: '45vh',
        minHeight: '120px',
      }}
    >
      {/* Accent line */}
      <div className="h-[2px] flex-shrink-0" style={{ background: `linear-gradient(90deg, ${c.a6}, ${c.a1})` }} />

      {/* Header: stage name + close */}
      <div
        className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
        style={{ borderBottom: `1px solid ${c.a12}` }}
      >
        <button onClick={cycleStageStatus} className="flex-shrink-0 transition-opacity hover:opacity-70">
          <StatusIcon className="w-4 h-4" style={{ color: stageStatusColor }} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-200 truncate">
            {freshStage?.title || stage.title}
          </p>
          <p className="text-[9px] text-slate-600 truncate">в {parentTaskTitle}</p>
        </div>

        {/* Stage deadline - inline */}
        <div className="flex-shrink-0 mr-2">
          <DeadlinePicker
            value={freshStage?.deadline || null}
            onChange={handleStageDeadlineChange}
            size="sm"
            isDone={stageDone}
          />
        </div>

        <button
          onClick={() => setSelectedStageForPanel(null)}
          className="p-1 rounded-md hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Stage description */}
        <div className="px-4 pt-2 pb-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] uppercase tracking-widest font-medium" style={{ color: c.a5 }}>
              Описание этапа
            </span>
            <div className="flex items-center gap-2">
              {isStageDescDirty && !isStageDescEditing && (
                <button
                  onClick={saveStageDesc}
                  disabled={savingStageDesc}
                  className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-md transition-all duration-200 disabled:opacity-50"
                  style={{ color: c.raw, backgroundColor: c.a12 }}
                >
                  <Save className="w-2.5 h-2.5" />
                  {savingStageDesc ? '...' : 'Сохранить'}
                </button>
              )}
              {!isStageDescEditing && (
                <button
                  onClick={() => setIsStageDescEditing(true)}
                  className="text-[9px] px-1.5 py-0.5 rounded transition-colors"
                  style={{ color: c.a5 }}
                >
                  <Pencil className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>

          {isStageDescEditing ? (
            <div
              className="rounded-lg overflow-hidden"
              style={{ border: `1px solid ${c.a3}` }}
            >
              <textarea
                value={stageDesc}
                onChange={(e) => {
                  setStageDesc(e.target.value.slice(0, DESC_LIMIT));
                  setIsStageDescDirty(true);
                }}
                placeholder="Введите описание этапа..."
                className="w-full bg-slate-900/80 text-[11px] text-slate-300 placeholder:text-slate-600 resize-none focus:outline-none leading-relaxed"
                style={{ height: isStageDescExpanded ? '140px' : '60px', border: 'none' }}
                autoFocus
              />
              <div className="flex items-center justify-between px-2.5 py-1.5" style={{ borderTop: `1px solid ${c.a12}` }}>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] text-slate-600 tabular-nums">{stageDesc.length}/{DESC_LIMIT}</span>
                  <button
                    onClick={() => setIsStageDescExpanded(v => !v)}
                    className="text-[9px] transition-colors"
                    style={{ color: c.a5 }}
                  >
                    {isStageDescExpanded ? 'Свернуть' : 'Развернуть'}
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setIsStageDescEditing(false);
                      setStageDesc(freshStage?.description || '');
                      setIsStageDescDirty(false);
                    }}
                    className="text-[9px] text-slate-500 hover:text-slate-300 px-2 py-0.5 rounded hover:bg-slate-800 transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={async () => {
                      await saveStageDesc();
                      setIsStageDescEditing(false);
                    }}
                    disabled={savingStageDesc}
                    className="text-[9px] px-2 py-0.5 rounded font-medium transition-all duration-200 disabled:opacity-50"
                    style={{ color: '#fff', backgroundColor: c.a5 }}
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="rounded-lg transition-colors cursor-pointer"
              style={{
                border: `1px solid ${c.a15}`,
                backgroundColor: c.a04,
              }}
              onClick={() => {
                setIsStageDescEditing(true);
                setIsStageDescExpanded(true);
              }}
            >
              {stageDesc ? (
                <p
                  className="text-[11px] text-slate-400 leading-relaxed px-3 py-2"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: isStageDescExpanded ? 20 : 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {stageDesc}
                </p>
              ) : (
                <p className="text-[10px] text-slate-700 px-3 py-2">
                  Нажмите, чтобы добавить описание этапа...
                </p>
              )}
              {stageDesc && stageDesc.length > 100 && !isStageDescExpanded && (
                <div className="flex items-center justify-center pb-1">
                  <span className="text-[8px]" style={{ color: c.a4 }}>Показать полностью</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Subtasks horizontal row */}
        <div className="px-4 pt-2 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] uppercase tracking-widest font-medium" style={{ color: c.a5 }}>
              Подзадачи
            </span>
            {subtasks.length > 0 && (
              <span className="text-[9px] tabular-nums" style={{ color: c.a4 }}>
                {stageProgress}%
              </span>
            )}
          </div>

          <div
            ref={scrollRef}
            className="flex gap-2 overflow-x-auto pb-1"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: c.a2 + ' transparent',
            }}
          >
            {subtasks.map((st) => (
              <SubtaskCard
                key={st.id}
                subtask={st}
                boardColor={boardColor}
                c={c}
                isDescExpanded={expandedSubtaskDescs[st.id] === true}
                isDescEditing={editingSubtaskDescIds[st.id] === true}
                descDraft={subtaskDescDrafts[st.id] || ''}
                onToggleDesc={() => setExpandedSubtaskDescs(prev => ({ ...prev, [st.id]: !prev[st.id] }))}
                onStartEditDesc={() => {
                  setEditingSubtaskDescIds(prev => ({ ...prev, [st.id]: true }));
                  setSubtaskDescDrafts(prev => ({ ...prev, [st.id]: st.description || '' }));
                }}
                onSaveDesc={() => saveSubtaskDesc(st.id)}
                onCancelEditDesc={() => setEditingSubtaskDescIds(prev => ({ ...prev, [st.id]: false }))}
                onDescDraftChange={(val: string) => setSubtaskDescDrafts(prev => ({ ...prev, [st.id]: val }))}
                onCycleStatus={(e: React.MouseEvent) => cycleSubtaskStatus(e, st.id)}
                onDelete={(e: React.MouseEvent) => deleteSubtask(e, st.id)}
                onDeadlineChange={(date: string | null) => handleSubtaskDeadlineChange(st.id, date)}
              />
            ))}

            {/* Add subtask card / button */}
            {addingSubtask ? (
              <div
                className="flex-shrink-0 rounded-lg p-2.5 w-44"
                style={{
                  border: `1px dashed ${c.a3}`,
                  backgroundColor: c.a08,
                }}
              >
                <input
                  ref={subtaskInputRef}
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addSubtask();
                    if (e.key === 'Escape') { setAddingSubtask(false); setNewSubtaskTitle(''); }
                  }}
                  placeholder="Название..."
                  className="w-full bg-slate-900/80 border-slate-700/40 rounded-md px-2 py-1 text-[10px] text-slate-300 placeholder:text-slate-600 focus:outline-none"
                  style={{ border: `1px solid ${c.a2}` }}
                  autoFocus
                />
                <div className="flex items-center justify-end gap-1 mt-1.5">
                  <button
                    onClick={() => { setAddingSubtask(false); setNewSubtaskTitle(''); }}
                    className="text-[9px] text-slate-500 hover:text-slate-300 px-1.5 py-0.5 rounded transition-colors"
                  >
                    ×
                  </button>
                  <button
                    onClick={addSubtask}
                    disabled={!newSubtaskTitle.trim()}
                    className="text-[9px] px-2 py-0.5 rounded font-medium transition-all disabled:opacity-40"
                    style={{ color: '#fff', backgroundColor: c.a5 }}
                  >
                    Добавить
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setAddingSubtask(true); setNewSubtaskTitle(''); }}
                className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200"
                style={{
                  border: `1px dashed ${c.a25}`,
                  color: c.a4,
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = c.a5;
                  el.style.backgroundColor = c.a12;
                  el.style.color = c.a7;
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = c.a25;
                  el.style.backgroundColor = 'transparent';
                  el.style.color = c.a4;
                }}
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Subtask Card ──────────────────────────────────────── */

function SubtaskCard({
  subtask,
  boardColor,
  c,
  isDescExpanded,
  isDescEditing,
  descDraft,
  onToggleDesc,
  onStartEditDesc,
  onSaveDesc,
  onCancelEditDesc,
  onDescDraftChange,
  onCycleStatus,
  onDelete,
  onDeadlineChange,
}: {
  subtask: TaskChild;
  boardColor: string;
  c: Record<string, string>;
  isDescExpanded: boolean;
  isDescEditing: boolean;
  descDraft: string;
  onToggleDesc: () => void;
  onStartEditDesc: () => void;
  onSaveDesc: () => void;
  onCancelEditDesc: () => void;
  onDescDraftChange: (val: string) => void;
  onCycleStatus: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onDeadlineChange: (date: string | null) => void;
}) {
  const stDone = subtask.status === 'done';
  const StIcon = STATUS_ICON[subtask.status] || Circle;
  const stColor = STATUS_COLOR[subtask.status] || '#64748b';
  const hasDesc = !!subtask.description;

  return (
    <div
      className="flex-shrink-0 rounded-lg transition-all duration-200 group/st"
      style={{
        border: `1px solid ${c.a25}`,
        backgroundColor: c.a08,
        width: '200px',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = c.a4;
        el.style.backgroundColor = c.a12;
        el.style.boxShadow = `0 0 12px ${c.a15}`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = c.a25;
        el.style.backgroundColor = c.a08;
        el.style.boxShadow = 'none';
      }}
    >
      {/* Subtask header */}
      <div className="flex items-start gap-1.5 px-2.5 pt-2 pb-1">
        <button
          onClick={onCycleStatus}
          className="flex-shrink-0 mt-0.5 transition-opacity hover:opacity-70"
          style={{ color: stColor }}
        >
          <StIcon className="w-3.5 h-3.5" />
        </button>
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'text-[11px] font-medium leading-tight',
              stDone ? 'line-through text-slate-600' : 'text-slate-300',
            )}
          >
            {subtask.title}
          </p>
        </div>
        <div className="flex items-center gap-px opacity-0 group-hover/st:opacity-100 transition-opacity flex-shrink-0">
          {hasDesc && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleDesc(); }}
              className="p-0.5 rounded hover:bg-white/5"
              style={{ color: c.a4 }}
            >
              <Pencil className="w-2.5 h-2.5" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-0.5 rounded hover:bg-rose-500/10 text-slate-700 hover:text-rose-400 transition-all"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      {/* Subtask deadline bar */}
      <div className="px-2.5 pb-1">
        <DeadlinePicker
          value={subtask.deadline || null}
          onChange={onDeadlineChange}
          size="sm"
          isDone={stDone}
        />
      </div>

      {/* Subtask description */}
      {isDescEditing ? (
        <div className="px-2 pb-2">
          <div
            className="rounded-md overflow-hidden"
            style={{ border: `1px solid ${c.a25}` }}
          >
            <textarea
              value={descDraft}
              onChange={(e) => onDescDraftChange(e.target.value.slice(0, DESC_LIMIT))}
              placeholder="Описание..."
              className="w-full bg-slate-900/80 text-[10px] text-slate-300 placeholder:text-slate-600 resize-none focus:outline-none leading-relaxed"
              style={{ height: isDescExpanded ? '90px' : '45px', border: 'none' }}
              autoFocus
            />
            <div className="flex items-center justify-between px-2 py-1" style={{ borderTop: `1px solid ${c.a12}` }}>
              <button
                onClick={() => { onDescDraftChange(descDraft); onToggleDesc(); }}
                className="text-[8px]" style={{ color: c.a4 }}
              >
                {isDescExpanded ? 'Свернуть' : 'Развернуть'}
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={onCancelEditDesc}
                  className="text-[8px] text-slate-500 hover:text-slate-300"
                >
                  ×
                </button>
                <button
                  onClick={onSaveDesc}
                  className="text-[8px] px-1.5 py-0.5 rounded font-medium"
                  style={{ color: '#fff', backgroundColor: c.a5 }}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : hasDesc ? (
        <div className="px-2 pb-2">
          <div
            className="rounded-md px-2 py-1.5 cursor-pointer transition-colors"
            style={{
              backgroundColor: c.a04,
              border: `1px solid ${c.a12}`,
            }}
            onClick={onStartEditDesc}
          >
            <p
              className="text-[9px] text-slate-500 leading-relaxed"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: isDescExpanded ? 20 : 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {subtask.description}
            </p>
            {subtask.description && subtask.description.length > 80 && !isDescExpanded && (
              <div className="flex justify-center mt-0.5">
                <span className="text-[7px]" style={{ color: c.a3 }}>Развернуть</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="px-2 pb-2">
          <button
            onClick={onStartEditDesc}
            className="text-[8px] transition-colors py-0.5"
            style={{ color: c.a3 }}
          >
            + описание
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Legacy Description Editor (for non-stage description editing) ── */

function LegacyDescriptionEditor() {
  const {
    descriptionEditorItem,
    setDescriptionEditorItem,
    selectedBoardId,
    setBoardTasks,
    boards,
  } = useKanbanStore();

  const selectedBoard = boards.find(b => b.id === selectedBoardId);
  const boardColor = selectedBoard?.color || '#00d9ff';

  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (descriptionEditorItem) {
      setDraft(descriptionEditorItem.description || '');
      setIsDirty(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [descriptionEditorItem?.id, descriptionEditorItem?.description]);

  useEffect(() => {
    if (!descriptionEditorItem) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDirty) {
        setDescriptionEditorItem(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [descriptionEditorItem, isDirty, setDescriptionEditorItem]);

  const handleSave = useCallback(async () => {
    if (!descriptionEditorItem || saving) return;
    setSaving(true);
    try {
      await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: descriptionEditorItem.id, description: draft.trim() || null }),
      });
      if (selectedBoardId) {
        const isTracks = useKanbanStore.getState().boards.find(b => b.id === selectedBoardId)?.boardType === 'tracks';
        const url = `/api/tasks?boardId=${selectedBoardId}${isTracks ? '&deep=true' : ''}`;
        const res = await fetch(url);
        const data = await res.json();
        setBoardTasks(data.tasks);
      }
      setDescriptionEditorItem({
        ...descriptionEditorItem,
        description: draft.trim() || null,
      });
      setIsDirty(false);
    } finally {
      setSaving(false);
    }
  }, [descriptionEditorItem, draft, saving, selectedBoardId, setBoardTasks, setDescriptionEditorItem]);

  const handleClose = () => {
    if (isDirty && descriptionEditorItem) {
      handleSave();
    } else {
      setDescriptionEditorItem(null);
    }
  };

  if (!descriptionEditorItem) return null;

  return (
    <div
      className="flex-shrink-0"
      style={{ borderTop: `1px solid ${boardColor}30`, backgroundColor: '#0a0a12' }}
    >
      <div className="flex items-center gap-3 px-4 py-2" style={{ borderBottom: `1px solid ${boardColor}15` }}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-200 truncate">{descriptionEditorItem.title}</p>
          <p className="text-[10px] text-slate-600 truncate">в {descriptionEditorItem.parentTitle}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[9px] text-slate-600 tabular-nums">{draft.length}/{DESC_LIMIT}</span>
          {isDirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md transition-colors disabled:opacity-50"
              style={{ color: boardColor, backgroundColor: hexToRgba(boardColor, 0.1) }}
            >
              <Save className="w-3 h-3" />
              {saving ? '...' : 'Сохранить'}
            </button>
          )}
          <button
            onClick={handleClose}
            className="p-1 rounded-md hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="px-4 py-2.5">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value.slice(0, DESC_LIMIT));
            setIsDirty(true);
          }}
          placeholder="Введите описание..."
          className="w-full bg-slate-900/80 rounded-lg text-xs text-slate-300 placeholder:text-slate-600 resize-none focus:outline-none transition-colors leading-relaxed"
          style={{ border: `1px solid ${boardColor}20`, height: '100px' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = boardColor + '60'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = boardColor + '20'; }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); if (!isDirty) setDescriptionEditorItem(null); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleSave(); }
          }}
        />
      </div>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────── */

function getProgress(children: { status: string }[]): number {
  if (children.length === 0) return 0;
  const done = children.filter(c => c.status === 'done').length;
  return Math.round((done / children.length) * 100);
}
