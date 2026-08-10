'use client';

import { useKanbanStore, Task, TaskStatus } from '@/store/kanban-store';
import { useNavigationStore } from '@/lib/store';
import { useEffect, useRef, useMemo, useState } from 'react';
import { Check, Circle, Clock, Eye, Trash2, Pencil, Plus, Music, ChevronDown, AlertTriangle } from 'lucide-react';
import { cn, hexToRgba } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

const STATUS_ICON: Record<string, typeof Circle> = {
  'todo': Circle,
  'in-progress': Clock,
  'review': Eye,
  'done': Check,
};

export default function TaskStrip() {
  const {
    boards, selectedBoardId, boardTasks, setBoardTasks,
    selectedTaskId, setSelectedTaskId, setEditingTask,
    isCreating, isTrackWizardOpen, setIsCreating,
  } = useKanbanStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const selectedBoard = boards.find(b => b.id === selectedBoardId);
  const boardColor = selectedBoard?.color || '#00d9ff';
  const boardType = selectedBoard?.boardType || '';
  const isTracksBoard = boardType === 'tracks';

  const c = useMemo(() => ({
    a04: hexToRgba(boardColor, 0.04),
    a08: hexToRgba(boardColor, 0.08),
    a1: hexToRgba(boardColor, 0.1),
    a12: hexToRgba(boardColor, 0.12),
    a15: hexToRgba(boardColor, 0.15),
    a18: hexToRgba(boardColor, 0.18),
    a2: hexToRgba(boardColor, 0.2),
    a22: hexToRgba(boardColor, 0.22),
    a25: hexToRgba(boardColor, 0.25),
    a3: hexToRgba(boardColor, 0.3),
    a35: hexToRgba(boardColor, 0.35),
    a4: hexToRgba(boardColor, 0.4),
    a45: hexToRgba(boardColor, 0.45),
    a5: hexToRgba(boardColor, 0.5),
    a55: hexToRgba(boardColor, 0.55),
    a6: hexToRgba(boardColor, 0.6),
    a65: hexToRgba(boardColor, 0.65),
    a7: hexToRgba(boardColor, 0.7),
    a8: hexToRgba(boardColor, 0.8),
    raw: boardColor,
    raw50: boardColor + '50',
  }), [boardColor]);

  // Styles use the BOARD COLOR (not hardcoded yellow) so the task frame matches
  // the board block color on the radial diagram.
  const styles = useMemo(() => ({
    containerBorder: {
      borderBottom: `2px solid ${c.a3}`,
      background: 'linear-gradient(180deg, rgba(5,10,20,0.97), rgba(8,12,24,0.99))',
      position: 'relative' as const,
    },
    accentLine: { background: `linear-gradient(90deg, transparent, ${c.a6} 20%, #FCEE0A 50%, ${c.a6} 80%, transparent)`, boxShadow: `0 0 12px ${c.a5}, 0 0 24px ${c.a2}` },
    dotBg: { backgroundColor: c.raw, boxShadow: `0 0 8px ${c.a5}` },
    titleColor: { color: c.raw, textShadow: `0 0 10px ${c.a5}, 0 0 4px ${c.a35}`, letterSpacing: '0.14em' },
    scrollbar: { scrollbarWidth: 'thin' as const, scrollbarColor: c.a3 + ' transparent' },
    cardDefault: {
      backgroundColor: 'rgba(10, 18, 32, 0.85)',
      border: `1.5px solid ${c.a25}`,
      clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))',
    },
    cardSelected: {
      backgroundColor: 'rgba(10, 18, 32, 0.85)',
      border: '2px solid rgba(252, 238, 10, 0.6)',
      boxShadow: '0 0 0 1px rgba(252, 238, 10, 0.2), 0 0 28px rgba(252, 238, 10, 0.2)',
      clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))',
    },
    progressBg: { backgroundColor: 'rgba(255,255,255,0.04)' },
    iconActive: c.raw,
    iconDone: c.a4,
    textColor: 'rgba(226, 232, 240, 0.95)',
    textDoneColor: c.a4,
    progressTextColor: '#FCEE0A',
    editColor: c.a5,
    deleteColor: 'rgba(244, 63, 94, 0.6)',
  }), [c]);

  const cycleStatus = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    const order: TaskStatus[] = ['todo', 'in-progress', 'review', 'done'];
    const idx = order.indexOf(task.status);
    const next = order[(idx + 1) % order.length];
    await fetch('/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: task.id, status: next }),
    });
    await reloadTasks();
  };

  const reloadTasks = async () => {
    if (!selectedBoardId) return;
    // Always fetch deep — non-track boards may still contain track tasks with stages
    const url = '/api/tasks?boardId=' + selectedBoardId + '&deep=true';
    const res = await fetch(url);
    const data = await res.json();
    setBoardTasks(data.tasks);
  };

  useEffect(() => {
    reloadTasks();
  }, [selectedBoardId]);

  if (!selectedBoard) {
    return (
      <div className="flex-shrink-0 border-b border-slate-800/50 bg-[#070710] px-4 py-2">
        <p className="text-[10px] text-slate-600 text-center animate-pulse">
          Выберите доску задач на диаграмме ниже
        </p>
      </div>
    );
  }

  const showButton = !isCreating && !isTrackWizardOpen;

  const handleCardEnter = (el: HTMLElement) => {
    el.style.backgroundColor = c.a1;
    el.style.borderColor = c.a45;
    el.style.boxShadow = `0 0 20px ${c.a15}, inset 0 0 12px ${c.a04}`;
  };
  const handleCardLeave = (el: HTMLElement) => {
    el.style.backgroundColor = 'rgba(10, 18, 32, 0.85)';
    el.style.borderColor = c.a25;
    el.style.boxShadow = 'none';
  };

  // The currently selected task (used for the compact collapsed view)
  const selectedTask = boardTasks.find(t => t.id === selectedTaskId) || null;

  // ── COLLAPSED: compact single line ──
  // The whole line is clickable to expand. No "New Task" button. The selected
  // task title is shown inline as a description (no "текущая" badge).
  if (isCollapsed) {
    const SelIcon = selectedTask ? (STATUS_ICON[selectedTask.status] || Circle) : null;
    const selDone = selectedTask?.status === 'done';
    return (
      <div
        className="flex-shrink-0 cursor-pointer select-none ts-panel"
        style={{
          ...styles.containerBorder,
          '--bc': c.raw,
          '--bc-012': hexToRgba(boardColor, 0.012),
          '--bc-02': hexToRgba(boardColor, 0.02),
          '--bc-025': hexToRgba(boardColor, 0.025),
          '--bc-04': c.a04,
          '--bc-05': hexToRgba(boardColor, 0.05),
          '--bc-08': c.a08,
          '--bc-1': c.a1,
          '--bc-12': c.a12,
          '--bc-15': c.a15,
          '--bc-18': c.a18,
          '--bc-2': c.a2,
          '--bc-22': c.a22,
          '--bc-25': c.a25,
          '--bc-3': c.a3,
          '--bc-35': c.a35,
          '--bc-4': c.a4,
          '--bc-45': c.a45,
          '--bc-5': c.a5,
          '--bc-55': c.a55,
          '--bc-6': c.a6,
          '--bc-65': c.a65,
          '--bc-7': c.a7,
          '--bc-8': c.a8,
        } as React.CSSProperties}
        onClick={() => setIsCollapsed(false)}
        title="Развернуть список задач"
      >
        <div className="ts-scanlines" />
        <div className="ts-neon-top" style={{ background: `linear-gradient(90deg, transparent, ${c.a6} 20%, #FCEE0A 50%, ${c.a6} 80%, transparent)` }} />
        <div className="flex items-center gap-2 px-3 py-1.5 relative z-[2]">
          <ChevronDown
            className="w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 rotate-180"
            style={{ color: c.a6 }}
          />
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={styles.dotBg} />
          <h3 className="text-[10px] font-semibold uppercase tracking-widest flex-shrink-0" style={styles.titleColor}>
            {selectedBoard.title}
          </h3>
          <span className="text-[9px] text-slate-600 flex-shrink-0">{boardTasks.length}</span>
          {/* Selected task shown inline as a description */}
          {selectedTask && SelIcon ? (
            <>
              <span
                className="text-slate-600 flex-shrink-0"
                style={{ fontSize: '10px' }}
              >{'// '}</span>
              <SelIcon
                className="w-3 h-3 flex-shrink-0"
                style={{ color: selDone ? styles.iconDone : styles.iconActive }}
              />
              <span
                className={cn('text-[11px] font-medium truncate min-w-0', selDone && 'line-through')}
                style={{ color: selDone ? styles.textDoneColor : styles.textColor }}
              >
                {selectedTask.title}
              </span>
              {selectedTask.soundflowTrackId && (
                <Music className="w-2.5 h-2.5 flex-shrink-0" style={{ color: '#22d3ee' }} />
              )}
            </>
          ) : (
            <span className="text-[10px] text-slate-600 truncate">— задача не выбрана</span>
          )}
        </div>
      </div>
    );
  }

  // ── EXPANDED: full task list ──
  return (
    <div className="flex-shrink-0 ts-panel" style={{
      ...styles.containerBorder,
      '--bc': c.raw,
      '--bc-012': hexToRgba(boardColor, 0.012),
      '--bc-02': hexToRgba(boardColor, 0.02),
      '--bc-025': hexToRgba(boardColor, 0.025),
      '--bc-04': c.a04,
      '--bc-05': hexToRgba(boardColor, 0.05),
      '--bc-08': c.a08,
      '--bc-1': c.a1,
      '--bc-12': c.a12,
      '--bc-15': c.a15,
      '--bc-18': c.a18,
      '--bc-2': c.a2,
      '--bc-22': c.a22,
      '--bc-25': c.a25,
      '--bc-3': c.a3,
      '--bc-35': c.a35,
      '--bc-4': c.a4,
      '--bc-45': c.a45,
      '--bc-5': c.a5,
      '--bc-55': c.a55,
      '--bc-6': c.a6,
      '--bc-65': c.a65,
      '--bc-7': c.a7,
      '--bc-8': c.a8,
    } as React.CSSProperties}>
      {/* Scan line overlay */}
      <div className="ts-scanlines" />
      {/* Grid pattern overlay */}
      <div className="ts-grid" />
      {/* Neon top border */}
      <div className="ts-neon-top" style={{ background: `linear-gradient(90deg, transparent, ${c.a6} 20%, #FCEE0A 50%, ${c.a6} 80%, transparent)` }} />
      <div className="flex items-center gap-1.5 px-3 py-1.5 relative z-[2]">
        <button
          onClick={() => setIsCollapsed(true)}
          className="flex-shrink-0 p-0.5 rounded transition-all hover:bg-white/5"
          style={{ color: c.a6 }}
          title="Свернуть (только текущая задача)"
        >
          <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200" />
        </button>
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={styles.dotBg} />
        <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={styles.titleColor}>
          {selectedBoard.title}
        </h3>
        <span className="text-[9px] text-slate-600">{boardTasks.length}</span>
        <div className="flex-1" />
        {showButton && (
          <button
            onClick={() => {
              if (isTracksBoard) {
                useKanbanStore.getState().setIsTrackWizardOpen(true);
              } else {
                setIsCreating(true);
              }
            }}
            className={cn(
              'flex items-center gap-1.5 transition-all duration-200',
              isTracksBoard && boardTasks.length === 0 && 'animate-pulse',
            )}
            style={{
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              padding: '8px 18px',
              color: '#000',
              background: `linear-gradient(135deg, ${c.raw}, ${c.raw} 50%, ${c.raw})`,
              border: `1.5px solid ${c.a8}`,
              clipPath: 'polygon(0 0, calc(100% - 7px) 0, 100% 7px, 100% 100%, 7px 100%, 0 calc(100% - 7px))',
              boxShadow: `0 0 14px ${c.a4}, 0 0 28px ${c.a15}, inset 0 1px 0 rgba(255, 255, 255, 0.4)`,
              cursor: 'pointer',
              transition: 'all 180ms ease',
              textShadow: '0 1px 0 rgba(255,255,255,0.3)',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.color = '#FCEE0A';
              el.style.border = '1.5px solid #FCEE0A';
              el.style.boxShadow = '0 0 0 1px rgba(252, 238, 10, 0.4), 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 20px rgba(252, 238, 10, 0.15)';
              el.style.textShadow = '0 0 8px rgba(252, 238, 10, 0.8), 0 1px 0 rgba(255,255,255,0.3)';
              el.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.color = '#000';
              el.style.border = `1.5px solid ${c.a8}`;
              el.style.boxShadow = `0 0 14px ${c.a4}, 0 0 28px ${c.a15}, inset 0 1px 0 rgba(255, 255, 255, 0.4)`;
              el.style.textShadow = '0 1px 0 rgba(255,255,255,0.3)';
              el.style.transform = 'translateY(0)';
            }}
          >
            {isTracksBoard
              ? <><Music className="w-3 h-3" /><span>Новый трек</span></>
              : <><Plus className="w-3 h-3" /><span>Новая задача</span></>
            }
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex gap-2 px-3 pb-2 overflow-x-auto relative z-[2]"
        style={styles.scrollbar}
      >
        {boardTasks.length === 0 && (
          <div className="flex items-center justify-center w-full py-2">
            <p className="text-[10px] text-slate-700">Нет задач</p>
          </div>
        )}
        {boardTasks.map((task) => {
          const Icon = STATUS_ICON[task.status] || Circle;
          const isSelected = selectedTaskId === task.id;
          const isTrack = !!task.trackConfig;
          const allLeaves = isTrack
            ? (task.children || []).flatMap(s => s.children || [])
            : (task.children || []);
          const progress = isTrack ? getProgress(allLeaves) : getProgress(task.children || []);
          const isDone = task.status === 'done';
          return (
            <div
              key={task.id}
              onClick={() => setSelectedTaskId(task.id)}
              onDoubleClick={() => {
                if (task.soundflowTrackId) {
                  const kanbanState = useKanbanStore.getState();
                  const kanbanProject = kanbanState.projects.find(p => p.id === kanbanState.selectedProjectId);
                  const sfProjectId = kanbanProject?.soundflowProjectId;
                  if (sfProjectId && task.soundflowTrackId) {
                    useNavigationStore.getState().navigate('track-detail', sfProjectId, task.soundflowTrackId);
                    return;
                  }
                }
                setEditingTask(task);
              }}
              className={cn(
                'group flex-shrink-0 rounded-lg cursor-pointer transition-all duration-200',
                isSelected && 'animate-in fade-in duration-200',
              )}
              style={isSelected ? styles.cardSelected : styles.cardDefault}
              onMouseEnter={(e) => { if (!isSelected) handleCardEnter(e.currentTarget); }}
              onMouseLeave={(e) => { if (!isSelected) handleCardLeave(e.currentTarget); }}
            >
              <div className="flex items-center gap-1.5 px-2.5 py-1.5">
                <button
                  onClick={(e) => cycleStatus(e, task)}
                  className="flex-shrink-0 transition-opacity hover:opacity-60"
                  style={{ color: isDone ? styles.iconDone : styles.iconActive }}
                  title={'Статус: ' + task.status}
                >
                  <Icon className="w-3 h-3" />
                </button>
                <p
                  className={cn(
                    'text-[11px] font-medium leading-tight truncate min-w-0 flex-1',
                    isDone ? 'line-through' : '',
                  )}
                  style={{ color: isDone ? styles.textDoneColor : styles.textColor }}
                >
                  {task.title}
                </p>
                {task.soundflowTrackId && (
                  <span
                    className="flex-shrink-0 flex items-center justify-center w-4 h-4 rounded"
                    style={{
                      color: '#22d3ee',
                      backgroundColor: 'rgba(34, 211, 238, 0.12)',
                      boxShadow: 'inset 0 0 0 1px rgba(34, 211, 238, 0.25)',
                    }}
                    title="Связан с аудиотреком — двойной клик откроет редактор"
                  >
                    <Music className="w-2.5 h-2.5" />
                  </span>
                )}
                {allLeaves.length > 0 && (
                  <span className="text-[8px] flex-shrink-0 tabular-nums font-medium" style={{ color: styles.progressTextColor }}>
                    {progress}%
                  </span>
                )}
                <div className="flex items-center gap-px opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingTask(task); }}
                    className="p-0.5 rounded hover:bg-white/10"
                    style={{ color: styles.editColor }}
                  >
                    <Pencil className="w-2.5 h-2.5" />
                  </button>
                  <DeleteTaskButton
                    task={task}
                    onDelete={async () => {
                      await fetch('/api/tasks?id=' + task.id, { method: 'DELETE' });
                      if (selectedTaskId === task.id) setSelectedTaskId(null);
                      await reloadTasks();
                    }}
                    accentColor={c.raw}
                  />
                </div>
              </div>
              {allLeaves.length > 0 && (
                <div className="h-[2px] w-full overflow-hidden rounded-b-lg" style={styles.progressBg}>
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: progress + '%',
                      backgroundColor: progress === 100 ? '#34d399' : '#FCEE0A',
                      boxShadow: progress > 0 ? `0 0 6px ${progress === 100 ? '#34d399' : '#FCEE0A'}80` : 'none',
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Delete with confirmation (popover) ─────────────────── */

function DeleteTaskButton({
  task,
  onDelete,
  accentColor,
}: {
  task: Task;
  onDelete: () => Promise<void>;
  accentColor: string;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="p-0.5 rounded hover:bg-rose-500/10"
          style={{ color: 'rgba(244, 63, 94, 0.6)' }}
          title="Удалить задачу"
        >
          <Trash2 className="w-2.5 h-2.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-60 p-3 shadow-2xl shadow-black/40 z-[70] border-0 rounded-none"
        style={{
          background: 'rgba(8, 10, 18, 0.97)',
          border: `1.5px solid ${hexToRgba(accentColor, 0.4)}`,
          clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
          boxShadow: `0 0 24px ${hexToRgba(accentColor, 0.15)}, 0 8px 32px rgba(0,0,0,0.6)`,
        }}
        align="end"
        sideOffset={6}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2 mb-2.5">
          <div
            className="flex-shrink-0 w-7 h-7 rounded flex items-center justify-center"
            style={{ backgroundColor: 'rgba(255, 0, 60, 0.12)', border: '1px solid rgba(255, 0, 60, 0.3)' }}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-100 leading-tight">Удалить задачу?</p>
            <p className="text-[10px] text-slate-500 truncate mt-0.5" title={task.title}>
              «{task.title}»
            </p>
          </div>
        </div>
        <p className="text-[9px] text-slate-500 mb-2.5 leading-relaxed">
          Действие необратимо. Все подзадачи и этапы будут удалены вместе с задачей.
        </p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            className="flex-1 text-[10px] font-medium px-2 py-1.5 rounded transition-all text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            Отмена
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); void confirm(); }}
            disabled={deleting}
            className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded transition-all disabled:opacity-50"
            style={{
              color: '#fff',
              backgroundColor: '#dc2626',
              boxShadow: '0 0 8px rgba(220, 38, 38, 0.4)',
            }}
          >
            <Trash2 className="w-2.5 h-2.5" />
            {deleting ? '...' : 'Удалить'}
          </button>
        </div>
        <div
          className="mt-2 pt-2 border-t border-slate-800 text-[8px] text-slate-600 flex items-center gap-1"
          style={{ color: hexToRgba(accentColor, 0.5) }}
        >
          <span style={{ color: hexToRgba(accentColor, 0.7) }}>●</span>
          Подтвердите удаление
        </div>
      </PopoverContent>
    </Popover>
  );
}

function getProgress(children: { status: string }[]): number {
  if (children.length === 0) return 0;
  const done = children.filter(c => c.status === 'done').length;
  return Math.round((done / children.length) * 100);
}
