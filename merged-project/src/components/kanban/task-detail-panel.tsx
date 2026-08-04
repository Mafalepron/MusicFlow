'use client';

import { useState, useEffect, useCallback } from 'react';
import { useKanbanStore, Task, TaskStatus, TaskPriority, TaskCategory, TaskChild, TaskGrandchild } from '@/store/kanban-store';
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
  ChevronDown, ChevronUp, ChevronRight, X, Save, Music, FolderOpen,
  Cat, MessageSquare,
} from 'lucide-react';
import DeadlinePicker, { getDeadlineInfo } from '@/components/kanban/deadline-picker';
import { cn, boardColorStyles, hexToRgba } from '@/lib/utils';

const STATUSES: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'todo', label: 'К выполнению', color: 'text-cyan-400' },
  { value: 'in-progress', label: 'В работе', color: 'text-orange-400' },
  { value: 'review', label: 'На проверке', color: 'text-rose-400' },
  { value: 'done', label: 'Готово', color: 'text-emerald-400' },
];

const PRIORITIES: { value: TaskPriority; label: string; dot: string }[] = [
  { value: 'low', label: 'Низкий', dot: 'bg-slate-500' },
  { value: 'medium', label: 'Средний', dot: 'bg-amber-500' },
  { value: 'high', label: 'Высокий', dot: 'bg-rose-500' },
];

const CATEGORIES: { value: TaskCategory; label: string }[] = [
  { value: 'rehearsal', label: '🎤 Репетиция' },
  { value: 'recording', label: '🎵 Запись' },
  { value: 'performance', label: '🎪 Выступление' },
  { value: 'marketing', label: '📢 Маркетинг' },
  { value: 'social', label: '📱 Соцсети' },
  { value: 'general', label: '📋 Общее' },
];

const SUBTASK_STATUS_ICON: Record<string, typeof Circle> = {
  'todo': Circle,
  'in-progress': Clock,
  'review': Eye,
  'done': Check,
};

const SUBTASK_STATUS_COLOR: Record<string, string> = {
  'todo': 'text-slate-500',
  'in-progress': 'text-orange-400',
  'review': 'text-rose-400',
  'done': 'text-emerald-400',
};

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

/* ── Track Detail View (3-level hierarchy) ──────────── */

const EMOJI_RE = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u;
const DESC_LIMIT = 300;

function TrackDetailView({ task, board }: { task: Task; board?: { title: string; color: string } }) {
  const { setBoardTasks, selectedBoardId, setEditingTask, setSelectedTaskId } = useKanbanStore();
  const [stages, setStages] = useState<TaskChild[]>(task.children || []);
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>(
    Object.fromEntries((task.children || []).map(c => [c.id, true]))
  );
  const [expandedDescIds, setExpandedDescIds] = useState<Record<string, boolean>>({});
  const [editingDescId, setEditingDescId] = useState<string | null>(null);
  const [descDraft, setDescDraft] = useState('');
  const [addingGrandchild, setAddingGrandchild] = useState<string | null>(null);
  const [newGcTitle, setNewGcTitle] = useState('');
  const [addingStage, setAddingStage] = useState(false);
  const [newStageTitle, setNewStageTitle] = useState('');

  const config = task.trackConfig ? JSON.parse(task.trackConfig) : null;
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
    const updated = data.tasks.find((t: Task) => t.id === task.id);
    if (updated) setStages(updated.children || []);
  }, [selectedBoardId, setBoardTasks, task.id]);

  const toggleGrandchildStatus = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const order: TaskStatus[] = ['todo', 'in-progress', 'review', 'done'];
    const all = stages.flatMap(s => s.children || []);
    const gc = all.find(c => c.id === id);
    if (!gc) return;
    const idx = order.indexOf(gc.status as TaskStatus);
    const next = order[(idx + 1) % order.length];
    await fetch('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: next }) });
    await reloadTasks();
  };

  const toggleStageExpanded = (stageId: string) => {
    setExpandedStages(prev => ({ ...prev, [stageId]: !prev[stageId] }));
  };

  const toggleDescExpanded = (id: string) => {
    setExpandedDescIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const startEditDesc = (id: string, current: string) => {
    setEditingDescId(id);
    setDescDraft(current || '');
  };

  const saveDesc = async (id: string) => {
    await fetch('/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, description: descDraft.trim() || null }),
    });
    setEditingDescId(null);
    setDescDraft('');
    await reloadTasks();
  };

  const cancelEditDesc = () => {
    setEditingDescId(null);
    setDescDraft('');
  };

  const deleteGrandchild = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
    await reloadTasks();
  };

  const addGrandchild = async (stageId: string) => {
    if (!newGcTitle.trim()) return;
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newGcTitle.trim(), parentId: stageId }),
    });
    setNewGcTitle('');
    setAddingGrandchild(null);
    await reloadTasks();
  };

  const addStage = async () => {
    if (!newStageTitle.trim()) return;
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newStageTitle.trim(), parentId: task.id, boardId: selectedBoardId }),
    });
    setNewStageTitle('');
    setAddingStage(false);
    await reloadTasks();
  };

  const deleteStage = async (e: React.MouseEvent, stageId: string) => {
    e.stopPropagation();
    await fetch(`/api/tasks?id=${stageId}`, { method: 'DELETE' });
    await reloadTasks();
  };

  const handleDelete = async () => {
    await fetch(`/api/tasks?id=${task.id}`, { method: 'DELETE' });
    setSelectedTaskId(null);
    if (selectedBoardId) {
      const res = await fetch(`/api/tasks?boardId=${selectedBoardId}&deep=true`);
      const data = await res.json();
      setBoardTasks(data.tasks);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="border-b border-slate-800/50 p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider"
            style={{ color: boardColor, backgroundColor: boardColor + '15' }}>
            Трек
          </span>
          <div className="flex-1" />
          <button onClick={() => setEditingTask(task)} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleDelete} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <h3 className="text-sm font-semibold text-white leading-tight mb-1.5">{task.title}</h3>
        {task.description && (
          <p className="text-[11px] text-slate-500 mb-1.5 line-clamp-2">{task.description}</p>
        )}
        {config && (
          <div className="flex flex-wrap gap-1">
            {config.instruments?.map((inst: string) => (
              <span key={inst} className="text-[9px] bg-slate-800/80 text-slate-400 px-1.5 py-0.5 rounded">{inst}</span>
            ))}
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="border-b border-slate-800/30 px-4 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-slate-400 font-medium">Общий прогресс</span>
          <span className="text-[11px] font-bold" style={{ color: getProgressTextColor() }}>{progress}%</span>
        </div>
        <div className="relative h-2 bg-slate-800/80 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${progress}%`, backgroundColor: getProgressColor() }} />
          {progress > 0 && progress < 100 && (
            <div
              className="absolute inset-0 rounded-full animate-pulse opacity-20"
              style={{
                background: `linear-gradient(90deg, transparent, ${getProgressColor()}, transparent)`,
              }}
            />
          )}
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[9px] text-slate-600">{allSubtasks.filter(s => s.status === 'done').length} из {allSubtasks.length} задач</span>
          {progress === 100 && <span className="text-[9px] text-emerald-400 font-medium">✓ Завершено</span>}
        </div>
      </div>

      {/* Stages as collapsible groups */}
      <div className="px-3 py-2 space-y-1">
        {stages.map((stage) => {
          const grandchildren = stage.children || [];
          const stageProgress = getProgress(grandchildren);
          const stageDone = stage.status === 'done';
          const isExpanded = expandedStages[stage.id] !== false;
          const isCustom = !EMOJI_RE.test(stage.title);
          const StatusIcon = SUBTASK_STATUS_ICON[stage.status] || Circle;
          const hasDesc = !!stage.description;
          const descExpanded = expandedDescIds[stage.id] === true;
          const isEditingDesc = editingDescId === stage.id;

          return (
            <div key={stage.id} className="rounded-lg border border-slate-800/30 overflow-hidden">
              {/* Stage header — full panel click to expand */}
              <button
                onClick={() => {
                  useKanbanStore.getState().setSelectedStageForPanel({ taskId: task.id, stageId: stage.id });
                  toggleStageExpanded(stage.id);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-slate-900/60 transition-colors text-left group/stage"
              >
                <StatusIcon className={cn('w-3.5 h-3.5 flex-shrink-0', SUBTASK_STATUS_COLOR[stage.status])} />
                {isCustom && <Cat className="w-3 h-3 flex-shrink-0 text-amber-400/60" />}
                <span className={cn('flex-1 text-[11px] font-medium min-w-0',
                  stageDone ? 'text-slate-500 line-through' : 'text-slate-300'
                )} onDoubleClick={(e) => { e.stopPropagation(); useKanbanStore.getState().setDescriptionEditorItem({ id: stage.id, title: stage.title, description: stage.description, parentId: task.id, parentTitle: task.title }); }}>
                  {stage.title}
                </span>
                {/* Description icon */}
                <button
                  onClick={(e) => { e.stopPropagation(); if (hasDesc) toggleDescExpanded(stage.id); else startEditDesc(stage.id, stage.description || ''); }}
                  className={cn('flex-shrink-0 transition-opacity',
                    hasDesc ? '' : ''
                  )}
                  style={{ color: hasDesc ? '#64748b' : 'transparent' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = boardColor; (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = hasDesc ? '#64748b' : 'transparent'; (e.currentTarget as HTMLElement).style.opacity = hasDesc ? '1' : '0'; }}
                >
                  <MessageSquare className="w-3 h-3" />
                </button>
                {grandchildren.length > 0 && (
                  <span className="text-[9px] text-slate-600 mr-1">{stageDone ? '✓' : `${stageProgress}%`}</span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); deleteStage(e, stage.id); }}
                  className="flex-shrink-0 p-0.5 rounded opacity-0 group-hover/stage:opacity-100 hover:bg-rose-500/10 text-slate-600 hover:text-rose-400 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                {isExpanded
                  ? <ChevronUp className="w-3 h-3 text-slate-600 group-hover/stage:text-slate-400" />
                  : <ChevronDown className="w-3 h-3 text-slate-600 group-hover/stage:text-slate-400" />
                }
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div>
                  {/* Description card */}
                  {hasDesc && !isEditingDesc && (
                    <div className="mx-2.5 mb-1.5">
                      <div className="bg-slate-900/60 border border-slate-800/40 rounded-md p-2">
                        {descExpanded ? (
                          <>
                            <p className="text-[10px] text-slate-400 whitespace-pre-wrap leading-relaxed">
                              {stage.description && stage.description.length > DESC_LIMIT
                                ? stage.description.slice(0, DESC_LIMIT) + '...'
                                : stage.description}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <button
                                onClick={() => startEditDesc(stage.id, stage.description || '')}
                                className="text-[9px] transition-colors"
                                style={{ color: boardColor + '80' }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = boardColor; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = boardColor + '80'; }}
                              >Редактировать</button>
                              <button
                                onClick={() => toggleDescExpanded(stage.id)}
                                className="text-[9px] text-slate-600 hover:text-slate-400 transition-colors"
                              >Свернуть</button>
                            </div>
                          </>
                        ) : (
                          <p className="text-[10px] text-slate-500 line-clamp-2">
                            {stage.description}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Editing description */}
                  {isEditingDesc && (
                    <div className="mx-2.5 mb-1.5">
                      <div className="bg-slate-900/60 rounded-md p-2 space-y-1.5" style={{ border: `1px solid ${boardColor}30` }}>
                        <Textarea
                          value={descDraft}
                          onChange={(e) => setDescDraft(e.target.value)}
                          placeholder="Описание этапа..."
                          maxLength={DESC_LIMIT}
                          className="bg-slate-800/80 border-slate-700/50 text-[10px] text-slate-300 placeholder:text-slate-600 min-h-[50px] resize-none"
                          autoFocus
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] text-slate-600">{descDraft.length}/{DESC_LIMIT}</span>
                          <div className="flex items-center gap-1">
                            <button onClick={cancelEditDesc} className="text-[9px] text-slate-500 hover:text-slate-300 px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors">Отмена</button>
                            <button
                              onClick={() => saveDesc(stage.id)}
                              className="text-[9px] px-1.5 py-0.5 rounded transition-colors"
                              style={{ color: boardColor, backgroundColor: boardColor + '10' }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = boardColor + '20'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = boardColor + '10'; }}
                            >Сохранить</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Progress bar */}
                  {grandchildren.length > 0 && (
                    <div className="px-2.5 pb-1.5">
                      <div className="h-1 bg-slate-800/60 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${stageProgress}%`, backgroundColor: stageProgress === 100 ? '#10b981' : stageProgress > 50 ? boardColor : stageProgress > 0 ? '#f59e0b' : '#334155' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Grandchildren list */}
                  <div className="space-y-0.5 px-2 pb-2">
                    {grandchildren.map((gc) => {
                      const GcIcon = SUBTASK_STATUS_ICON[gc.status] || Circle;
                      const gcHasDesc = !!gc.description;
                      const gcDescExpanded = expandedDescIds[gc.id] === true;
                      const gcIsEditingDesc = editingDescId === gc.id;
                      return (
                        <div key={gc.id} className="rounded-md border border-transparent hover:border-slate-800/30 overflow-hidden">
                          <div
                            className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-slate-800/40 transition-colors group/gc cursor-pointer"
                            onClick={() => {
                              useKanbanStore.getState().setSelectedStageForPanel({
                                taskId: task.id, stageId: stage.id,
                              });
                            }}
                          >
                            <button
                              onClick={(e) => toggleGrandchildStatus(e, gc.id)}
                              className={cn('flex-shrink-0 hover:opacity-70 transition-opacity', SUBTASK_STATUS_COLOR[gc.status] || 'text-slate-500')}
                            >
                              <GcIcon className="w-3 h-3" />
                            </button>
                            <span className={cn('flex-1 text-[10px] min-w-0',
                              gc.status === 'done' ? 'text-slate-600 line-through' : 'text-slate-400'
                            )}>
                              {gc.title}
                            </span>
                            {/* GC description icon */}
                            <button
                              onClick={(e) => { e.stopPropagation(); if (gcHasDesc) toggleDescExpanded(gc.id); else startEditDesc(gc.id, gc.description || ''); }}
                              className={cn('flex-shrink-0 transition-opacity',
                                gcHasDesc ? '' : ''
                              )}
                              style={{ color: gcHasDesc ? '#475569' : 'transparent' }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = boardColor; (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = gcHasDesc ? '#475569' : 'transparent'; (e.currentTarget as HTMLElement).style.opacity = gcHasDesc ? '1' : '0'; }}
                            >
                              <MessageSquare className="w-2.5 h-2.5" />
                            </button>
                            <button
                              onClick={(e) => deleteGrandchild(e, gc.id)}
                              className="flex-shrink-0 p-0.5 rounded opacity-0 group-hover/gc:opacity-100 hover:bg-rose-500/10 text-slate-700 hover:text-rose-400 transition-all"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                          {/* GC expanded description */}
                          {gcHasDesc && !gcIsEditingDesc && gcDescExpanded && (
                            <div className="px-2 pb-1.5 pt-0.5">
                              <div className="bg-slate-900/40 border border-slate-800/30 rounded p-1.5">
                                <p className="text-[9px] text-slate-500 whitespace-pre-wrap leading-relaxed">
                                  {gc.description && gc.description.length > DESC_LIMIT
                                    ? gc.description.slice(0, DESC_LIMIT) + '...'
                                    : gc.description}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <button onClick={() => startEditDesc(gc.id, gc.description || '')} className="text-[8px] transition-colors" style={{ color: boardColor + '80' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = boardColor; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = boardColor + '80'; }}>Изменить</button>
                                  <button onClick={() => toggleDescExpanded(gc.id)} className="text-[8px] text-slate-600 hover:text-slate-400">Свернуть</button>
                                </div>
                              </div>
                            </div>
                          )}
                          {/* GC editing description */}
                          {gcIsEditingDesc && (
                            <div className="px-2 pb-1.5 pt-0.5">
                              <div className="bg-slate-900/40 rounded p-1.5 space-y-1" style={{ border: `1px solid ${boardColor}20` }}>
                                <Textarea
                                  value={descDraft}
                                  onChange={(e) => setDescDraft(e.target.value)}
                                  placeholder="Описание..."
                                  maxLength={DESC_LIMIT}
                                  className="bg-slate-800/80 border-slate-700/50 text-[9px] text-slate-300 placeholder:text-slate-600 min-h-[40px] resize-none"
                                  autoFocus
                                />
                                <div className="flex items-center justify-between">
                                  <span className="text-[7px] text-slate-600">{descDraft.length}/{DESC_LIMIT}</span>
                                  <div className="flex items-center gap-1">
                                    <button onClick={cancelEditDesc} className="text-[8px] text-slate-500 hover:text-slate-300">Отмена</button>
                                    <button onClick={() => saveDesc(gc.id)} className="text-[8px] px-1.5 py-0.5 rounded" style={{ color: boardColor, backgroundColor: boardColor + '10' }}>Сохранить</button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Add grandchild button */}
                    {addingGrandchild === stage.id ? (
                      <div className="flex items-center gap-1.5 px-2 py-1">
                        <Input
                          value={newGcTitle}
                          onChange={(e) => setNewGcTitle(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') addGrandchild(stage.id); if (e.key === 'Escape') { setAddingGrandchild(null); setNewGcTitle(''); } }}
                          placeholder="Название подзадачи..."
                          className="h-6 text-[10px] bg-slate-800/60 border-slate-700/40 text-slate-300 placeholder:text-slate-600"
                          autoFocus
                        />
                        <button onClick={() => addGrandchild(stage.id)} className="text-[9px] px-1.5 py-1 rounded transition-colors" style={{ color: boardColor, backgroundColor: boardColor + '10' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = boardColor + '20'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = boardColor + '10'; }}>+</button>
                        <button onClick={() => { setAddingGrandchild(null); setNewGcTitle(''); }} className="text-[9px] text-slate-600 hover:text-slate-400 px-1 py-1">×</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingGrandchild(stage.id); setNewGcTitle(''); }}
                        className="flex items-center gap-1 px-2 py-1 text-[9px] text-slate-600 transition-colors"
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = boardColor; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = ''; }}
                      >
                        <Plus className="w-2.5 h-2.5" /> Добавить
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Add custom stage */}
        {addingStage ? (
          <div className="rounded-lg border border-dashed border-slate-700/50 p-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <Cat className="w-3 h-3 text-amber-400/60 flex-shrink-0" />
              <Input
                value={newStageTitle}
                onChange={(e) => setNewStageTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addStage(); if (e.key === 'Escape') { setAddingStage(false); setNewStageTitle(''); } }}
                placeholder="Название этапа..."
                className="h-6 text-[10px] bg-slate-800/60 border-slate-700/40 text-slate-300 placeholder:text-slate-600"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-1 pl-5">
              <button onClick={addStage} className="text-[9px] px-1.5 py-0.5 rounded transition-colors" style={{ color: boardColor, backgroundColor: boardColor + '10' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = boardColor + '20'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = boardColor + '10'; }}>Добавить</button>
              <button onClick={() => { setAddingStage(false); setNewStageTitle(''); }} className="text-[9px] text-slate-600 hover:text-slate-400">Отмена</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setAddingStage(true); setNewStageTitle(''); }}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-[10px] text-slate-600 border border-dashed border-slate-800/50 rounded-lg transition-all"
            style={{ color: '', borderColor: '' }}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = boardColor; el.style.borderColor = boardColor + '30'; }}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = ''; el.style.borderColor = ''; }}
          >
            <Plus className="w-3 h-3" /> Добавить этап
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Regular Task Detail View ──────────── */

function TaskDetailView({ task, board }: { task: Task; board?: { title: string; color: string } }) {
  const { setBoardTasks, selectedBoardId, setEditingTask, setSelectedTaskId } = useKanbanStore();
  const [subtasks, setSubtasks] = useState<TaskChild[]>(task.children || []);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskDeadline, setNewSubtaskDeadline] = useState<string | null>(null);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [expandedSubtasks, setExpandedSubtasks] = useState(true);

  const boardColor = board?.color || '#00d9ff';
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
    const updated = data.tasks.find((t: Task) => t.id === task.id);
    if (updated) setSubtasks(updated.children || []);
  }, [selectedBoardId, setBoardTasks, task.id]);

  const cycleSubtaskStatus = async (e: React.MouseEvent, subtaskId: string) => {
    e.stopPropagation();
    const order: TaskStatus[] = ['todo', 'in-progress', 'review', 'done'];
    const sub = subtasks.find(s => s.id === subtaskId);
    if (!sub) return;
    const idx = order.indexOf(sub.status as TaskStatus);
    const next = order[(idx + 1) % order.length];
    await fetch('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: subtaskId, status: next }) });
    await reloadTasks();
  };

  const deleteSubtask = async (e: React.MouseEvent, subtaskId: string) => {
    e.stopPropagation();
    await fetch(`/api/tasks?id=${subtaskId}`, { method: 'DELETE' });
    await reloadTasks();
  };

  const addSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;
    await fetch('/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newSubtaskTitle.trim(), parentId: task.id, status: 'todo', ...(newSubtaskDeadline ? { deadline: newSubtaskDeadline } : {}) }),
    });
    setNewSubtaskTitle(''); setNewSubtaskDeadline(null); setAddingSubtask(false);
    await reloadTasks();
  };

  const updateTaskDeadline = async (deadline: string | null) => {
    await fetch('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: task.id, deadline }) });
    await reloadTasks();
  };

  const updateSubtaskDeadline = async (subtaskId: string, deadline: string | null) => {
    await fetch('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: subtaskId, deadline }) });
    await reloadTasks();
  };

  const handleDeleteTask = async () => {
    await fetch(`/api/tasks?id=${task.id}`, { method: 'DELETE' });
    setSelectedTaskId(null);
    if (selectedBoardId) {
      const res = await fetch(`/api/tasks?boardId=${selectedBoardId}`);
      const data = await res.json();
      setBoardTasks(data.tasks);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="border-b border-slate-800/50 p-4">
        <div className="flex items-center gap-1.5 mb-2.5">
          {board && (
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium"
              style={{ color: board.color, backgroundColor: board.color + '15' }}>{board.title}</span>
          )}
          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded',
            task.status === 'todo' ? '' :
            task.status === 'in-progress' ? 'text-orange-400 bg-orange-500/10' :
            task.status === 'review' ? 'text-rose-400 bg-rose-500/10' :
            'text-emerald-400 bg-emerald-500/10'
          )}
          style={task.status === 'todo' ? { color: boardColor, backgroundColor: boardColor + '10' } : undefined}
          >
            {STATUSES.find(s => s.value === task.status)?.label || task.status}
          </span>
          <div className="flex-1" />
          <button onClick={() => setEditingTask(task)} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={handleDeleteTask} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
        <h3 className={cn('text-sm font-semibold leading-tight mb-1', task.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-100')}>{task.title}</h3>
        {task.description && <p className="text-[11px] text-slate-400 leading-relaxed mb-2">{task.description}</p>}
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          {task.assignee && <span>👤 {task.assignee}</span>}
          <span className={cn('flex items-center gap-1',
            task.priority === 'high' ? 'text-rose-400' : task.priority === 'medium' ? 'text-amber-400' : 'text-slate-500'
          )}>
            {task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '⚪'}
            {PRIORITIES.find(p => p.value === task.priority)?.label || task.priority}
          </span>
        </div>
      </div>
      <div className="border-b border-slate-800/30 px-4 py-3">
        <DeadlinePicker value={task.deadline || null} onChange={updateTaskDeadline} isDone={task.status === 'done'} size="md" />
      </div>
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
                style={{
                  background: `linear-gradient(90deg, transparent, ${getProgressColor()}, transparent)`,
                }}
              />
            )}
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[9px] text-slate-600">{subtasks.filter(s => s.status === 'done').length} из {subtasks.length} подзадач</span>
            {progress === 100 && <span className="text-[9px] text-emerald-400 font-medium">✓ Завершено</span>}
          </div>
        </div>
      )}
      <div className="px-4 py-3">
        <button onClick={() => setExpandedSubtasks(!expandedSubtasks)} className="flex items-center gap-1.5 mb-2 group w-full text-left">
          {expandedSubtasks
            ? <ChevronUp className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
            : <ChevronDown className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />}
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Подзадачи</span>
          {subtasks.length > 0 && <span className="text-[9px] text-slate-600 bg-slate-800/50 px-1.5 py-0.5 rounded ml-1">{subtasks.length}</span>}
        </button>
        {expandedSubtasks && (
          <div className="space-y-1.5">
            {subtasks.length === 0 && !addingSubtask && <p className="text-[10px] text-slate-600 py-2 text-center">Нет подзадач</p>}
            {subtasks.map((sub) => {
              const Icon = SUBTASK_STATUS_ICON[sub.status] || Circle;
              return (
                <div
                  key={sub.id}
                  className="group/sub flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-900/80 transition-colors cursor-pointer"
                  onClick={() => {
                    useKanbanStore.getState().setDescriptionEditorItem({
                      id: sub.id, title: sub.title, description: sub.description,
                      parentId: task.id, parentTitle: task.title,
                    });
                  }}
                >
                  <button onClick={(e) => cycleSubtaskStatus(e, sub.id)} className={cn('flex-shrink-0 transition-opacity hover:opacity-70', SUBTASK_STATUS_COLOR[sub.status] || 'text-slate-500')}><Icon className="w-3.5 h-3.5" /></button>
                  <span className={cn('flex-1 text-[11px] leading-tight min-w-0', sub.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-300')}>{sub.title}</span>
                  <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <DeadlinePicker value={sub.deadline || null} onChange={(d) => updateSubtaskDeadline(sub.id, d)} isDone={sub.status === 'done'} size="sm" inline />
                  </div>
                  <button onClick={(e) => deleteSubtask(e, sub.id)} className="p-0.5 rounded opacity-0 group-hover/sub:opacity-100 hover:bg-slate-800 text-slate-600 hover:text-rose-400 transition-all flex-shrink-0"><X className="w-3 h-3" /></button>
                </div>
              );
            })}
            {addingSubtask ? (
              <div className="space-y-2 bg-slate-900/60 border border-slate-800/50 rounded-lg p-2.5 mt-1">
                <Input value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSubtask()} placeholder="Название подзадачи..." autoFocus className="bg-slate-800/80 border-slate-700/50 text-[11px] text-slate-200 placeholder:text-slate-600 h-7" onFocus={(e) => { e.target.style.borderColor = boardColor + '80'; }} onBlur={(e) => { e.target.style.borderColor = ''; }} />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-600 flex-shrink-0">Дедлайн:</span>
                  <DeadlinePicker value={newSubtaskDeadline} onChange={setNewSubtaskDeadline} size="sm" />
                </div>
                <div className="flex gap-1.5 pt-0.5">
                  <button onClick={addSubtask} disabled={!newSubtaskTitle.trim()} className="flex-1 text-[10px] text-white rounded px-2 py-1.5 transition-colors font-medium disabled:opacity-40" style={{ backgroundColor: boardColor }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.1)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ''; }}>Добавить</button>
                  <button onClick={() => { setAddingSubtask(false); setNewSubtaskTitle(''); setNewSubtaskDeadline(null); }} className="text-[10px] text-slate-500 hover:text-slate-300 px-2 py-1.5 transition-colors">Отмена</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingSubtask(true)} className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-slate-600 transition-colors rounded-lg hover:bg-slate-900/50 w-full" onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = boardColor; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = ''; }}><Plus className="w-3 h-3" /> Добавить подзадачу</button>
            )}
          </div>
        )}
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
      const res = await fetch(`/api/tasks?boardId=${selectedBoardId}`);
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
          <Button onClick={handleSave} disabled={!title.trim() || saving} className="flex-1 text-white h-8 text-xs" style={{ backgroundColor: color, boxShadow: `0 4px 14px ${color}30` }}><Save className="w-3 h-3 mr-1" />{saving ? '...' : mode === 'edit' ? 'Сохранить' : 'Создать'}</Button>
          {mode === 'edit' && <Button onClick={handleDelete} variant="destructive" disabled={saving} className="h-8 text-xs">Удалить</Button>}
        </div>
      </div>
    </div>
  );
}

function getProgress(children: { status: string }[]): number {
  if (children.length === 0) return 0;
  return Math.round((children.filter(c => c.status === 'done').length / children.length) * 100);
}
