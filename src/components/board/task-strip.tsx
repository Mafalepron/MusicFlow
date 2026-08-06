'use client';

import { useKanbanStore, Task, TaskStatus } from '@/store/kanban-store';
import { useNavigationStore } from '@/lib/store';
import { useEffect, useRef, useMemo } from 'react';
import { Check, Circle, Clock, Eye, Trash2, Pencil, Plus, Music } from 'lucide-react';
import { cn, hexToRgba } from '@/lib/utils';

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
    a5: hexToRgba(boardColor, 0.5),
    a6: hexToRgba(boardColor, 0.6),
    a65: hexToRgba(boardColor, 0.65),
    a7: hexToRgba(boardColor, 0.7),
    a8: hexToRgba(boardColor, 0.8),
    raw: boardColor,
    raw50: boardColor + '50',
  }), [boardColor]);

  const styles = useMemo(() => ({
    containerBorder: { borderBottom: '1px solid rgba(252, 238, 10, 0.12)', background: 'linear-gradient(180deg, rgba(6,6,12,0.95), rgba(10,10,18,0.98))' },
    accentLine: { background: 'linear-gradient(90deg, rgba(252,238,10,0.4), rgba(252,238,10,0.05))', boxShadow: '0 0 6px rgba(252,238,10,0.15)' },
    dotBg: { backgroundColor: '#FCEE0A', boxShadow: '0 0 6px rgba(252,238,10,0.4)' },
    titleColor: { color: '#FCEE0A', textShadow: '0 0 6px rgba(252,238,10,0.3)', letterSpacing: '0.12em' },
    scrollbar: { scrollbarWidth: 'thin' as const, scrollbarColor: c.a2 + ' transparent' },
    cardDefault: {
      backgroundColor: 'rgba(20, 20, 36, 0.8)',
      border: '1px solid rgba(252, 238, 10, 0.15)',
      clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))',
    },
    cardSelected: {
      backgroundColor: 'rgba(252, 238, 10, 0.1)',
      border: '1px solid rgba(252, 238, 10, 0.4)',
      boxShadow: '0 0 16px rgba(252, 238, 10, 0.15), inset 0 0 12px rgba(252, 238, 10, 0.04)',
      clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))',
    },
    progressBg: { backgroundColor: 'rgba(255,255,255,0.04)' },
    btnGrad: {
      background: 'linear-gradient(135deg, rgba(252,238,10,0.9), rgba(252,238,10,0.7))',
      color: '#000',
      boxShadow: '0 0 8px rgba(252,238,10,0.3)',
      clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))',
    },
    tracksBtnGrad: {
      background: 'linear-gradient(135deg, rgba(252,238,10,0.9), rgba(0,240,255,0.7))',
      color: '#000',
      boxShadow: '0 0 10px rgba(252,238,10,0.3), 0 0 16px rgba(0,240,255,0.1)',
      clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))',
    },
    iconActive: c.raw,
    iconDone: c.a4,
    textColor: 'rgba(226, 232, 240, 0.95)',
    textDoneColor: c.a4,
    progressTextColor: c.a6,
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

  const handleDelete = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    await fetch('/api/tasks?id=' + taskId, { method: 'DELETE' });
    if (selectedTaskId === taskId) setSelectedTaskId(null);
    await reloadTasks();
  };

  const reloadTasks = async () => {
    if (!selectedBoardId) return;
    const isTracks = boardType === 'tracks';
    const url = '/api/tasks?boardId=' + selectedBoardId + (isTracks ? '&deep=true' : '');
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
    el.style.backgroundColor = 'rgba(252, 238, 10, 0.08)';
    el.style.borderColor = 'rgba(252, 238, 10, 0.3)';
    el.style.boxShadow = '0 0 14px rgba(252, 238, 10, 0.12), inset 0 0 8px rgba(252, 238, 10, 0.03)';
  };
  const handleCardLeave = (el: HTMLElement) => {
    el.style.backgroundColor = 'rgba(20, 20, 36, 0.8)';
    el.style.borderColor = 'rgba(252, 238, 10, 0.15)';
    el.style.boxShadow = 'none';
  };

  return (
    <div className="flex-shrink-0" style={styles.containerBorder}>
      <div className="h-[2px]" style={styles.accentLine} />
      <div className="flex items-center gap-1.5 px-3 py-1.5">
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
              'cp-strip-btn',
              isTracksBoard && boardTasks.length === 0 && 'animate-pulse',
            )}
          >
            {isTracksBoard
              ? <><Music className="w-3 h-3" /><span>Новый трек</span></>
              : <><Plus className="w-3 h-3" /><span>Новая задача</span></>
            }
          </button>
        )}
        <style jsx>{`
          .cp-strip-btn {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            padding: 6px 14px;
            color: #000;
            background: linear-gradient(135deg, #FCEE0A 0%, #FIF100 50%, #FCEE0A 100%);
            border: 1px solid rgba(252, 238, 10, 0.8);
            clip-path: polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px));
            box-shadow: 0 0 10px rgba(252, 238, 10, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3);
            transition: all 180ms;
            cursor: pointer;
            position: relative;
          }
          .cp-strip-btn::before {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            transform: translateX(-100%);
            transition: transform 400ms;
            clip-path: inherit;
          }
          .cp-strip-btn:hover {
            background: linear-gradient(135deg, #FCEE0A 0%, #FFD700 50%, #FCEE0A 100%);
            box-shadow: 0 0 16px rgba(252, 238, 10, 0.5), 0 0 24px rgba(252, 238, 10, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.4);
            transform: translateY(-1px);
          }
          .cp-strip-btn:hover::before {
            transform: translateX(100%);
          }
          .cp-strip-btn:active {
            transform: translateY(0);
          }
        `}</style>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-2 px-3 pb-2 overflow-x-auto"
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
                    className="flex-shrink-0 flex items-center gap-0.5 text-[8px] font-semibold px-1 py-0.5 rounded"
                    style={{
                      color: '#22d3ee',
                      backgroundColor: 'rgba(34, 211, 238, 0.12)',
                      boxShadow: 'inset 0 0 0 1px rgba(34, 211, 238, 0.25)',
                    }}
                    title="Связан с аудиотреком — двойной клик откроет редактор"
                  >
                    <Music className="w-2 h-2" />
                    Audio
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
                  <button
                    onClick={(e) => handleDelete(e, task.id)}
                    className="p-0.5 rounded hover:bg-rose-500/10"
                    style={{ color: styles.deleteColor }}
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
              {allLeaves.length > 0 && (
                <div className="h-[2px] w-full overflow-hidden rounded-b-lg" style={styles.progressBg}>
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: progress + '%',
                      backgroundColor: hexToRgba(boardColor, progress === 100 ? 0.8 : 0.5),
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

function getProgress(children: { status: string }[]): number {
  if (children.length === 0) return 0;
  const done = children.filter(c => c.status === 'done').length;
  return Math.round((done / children.length) * 100);
}
