'use client';

import { useEffect, useState } from 'react';
import {
  X, Music, CalendarDays, Disc3, AudioLines, Zap, Check, Circle, Clock,
  ListChecks, FileText, Guitar, Mic2,
} from 'lucide-react';
import { hexToRgba } from '@/lib/utils';
import type { Task } from '@/store/kanban-store';

interface ProjectInfoModalProps {
  projectId: string;
  onClose: () => void;
}

/* ── Constants ────────────────────────────────────────── */

const BOARD_COLOR = '#00d9ff';

const PROJECT_TYPE_LABEL: Record<string, string> = {
  album: 'Альбом',
  ep: 'EP',
  single: 'Сингл',
  general: 'Канбан',
};

const STATUS_HEX: Record<string, string> = {
  todo: '#22d3ee',
  'in-progress': '#fb923c',
  review: '#fb7185',
  done: '#34d399',
};

const STATUS_ICON: Record<string, typeof Circle> = {
  todo: Circle,
  'in-progress': Clock,
  done: Check,
};

interface BoardInfo {
  id: string;
  title: string;
  color: string;
  boardType: string;
}

interface ConcertEntry {
  task: { id: string; title: string; status: string; deadline: string | null };
  boardTitle: string;
  boardColor: string;
}

/* ── Helpers ──────────────────────────────────────────── */

function getProgress(children: { status: string }[] | undefined): number {
  if (!children || children.length === 0) return 0;
  const done = children.filter(c => c.status === 'done').length;
  return Math.round((done / children.length) * 100);
}

interface CountableTask {
  status: string;
  children?: CountableTask[] | unknown;
}

function countAll(tasks: CountableTask[]): { total: number; done: number } {
  let total = 0;
  let done = 0;
  for (const t of tasks) {
    total++;
    if (t.status === 'done') done++;
    if (Array.isArray(t.children) && t.children.length > 0) {
      const sub = countAll(t.children as CountableTask[]);
      total += sub.total;
      done += sub.done;
    }
  }
  return { total, done };
}

function formatDeadline(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const month = months[d.getMonth()] || '';
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/* ── Main Modal ───────────────────────────────────────── */

export default function ProjectInfoModal({ projectId, onClose }: ProjectInfoModalProps) {
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Task | null>(null);
  const [boards, setBoards] = useState<BoardInfo[]>([]);
  const [boardTasksMap, setBoardTasksMap] = useState<Map<string, Task[]>>(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // 1. Fetch project task (parentId=null, then find by id)
        const projRes = await fetch('/api/tasks?parentId=null');
        const projData = await projRes.json();
        if (cancelled) return;
        const proj = ((projData.tasks as Task[]) || []).find(t => t.id === projectId) || null;
        setProject(proj);

        // 2. Fetch boards
        const boardsRes = await fetch(`/api/boards?projectId=${projectId}`);
        const boardsData = await boardsRes.json();
        if (cancelled) return;
        const bl: BoardInfo[] = ((boardsData.boards as BoardInfo[]) || []).map(b => ({
          id: b.id, title: b.title, color: b.color, boardType: b.boardType,
        }));
        setBoards(bl);

        // 3. For each board, fetch deep tasks (tracks boards need 2-level children)
        const tasksMap = new Map<string, Task[]>();
        await Promise.all(bl.map(async (b) => {
          try {
            const r = await fetch(`/api/tasks?boardId=${b.id}&deep=true`);
            const d = await r.json();
            if (!cancelled) tasksMap.set(b.id, (d.tasks as Task[]) || []);
          } catch {
            /* ignore */
          }
        }));
        if (!cancelled) setBoardTasksMap(tasksMap);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  /* ── Aggregate data ────────────────────────────────── */

  const tracksBoard = boards.find(b => b.boardType === 'tracks');
  const tracks: Task[] = tracksBoard ? (boardTasksMap.get(tracksBoard.id) || []) : [];

  // Aggregate unique instruments from all track tasks' trackConfig
  const instrumentsSet = new Set<string>();
  for (const t of tracks) {
    if (t.trackConfig) {
      try {
        const cfg = JSON.parse(t.trackConfig) as { instruments?: unknown };
        if (Array.isArray(cfg.instruments)) {
          for (const inst of cfg.instruments) {
            if (typeof inst === 'string' && inst.trim()) instrumentsSet.add(inst.trim());
          }
        }
      } catch {
        /* ignore */
      }
    }
  }
  const instruments = Array.from(instrumentsSet);

  // Overall progress: total done / total tasks across ALL boards
  let totalTasks = 0;
  let doneTasks = 0;
  for (const b of boards) {
    const ts = boardTasksMap.get(b.id) || [];
    const c = countAll(ts as unknown as CountableTask[]);
    totalTasks += c.total;
    doneTasks += c.done;
  }
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Performance tasks (concerts) across all boards, all levels
  const performances: ConcertEntry[] = [];
  for (const b of boards) {
    const ts = boardTasksMap.get(b.id) || [];
    for (const t of ts) {
      if (t.category === 'performance') {
        performances.push({ task: t, boardTitle: b.title, boardColor: b.color });
      }
      if (t.children) {
        for (const child of t.children) {
          if (child.category === 'performance') {
            performances.push({ task: child, boardTitle: b.title, boardColor: b.color });
          }
          if (child.children) {
            for (const gc of child.children) {
              if (gc.category === 'performance') {
                performances.push({ task: gc, boardTitle: b.title, boardColor: b.color });
              }
            }
          }
        }
      }
    }
  }

  const boardColor = BOARD_COLOR;
  const projectTypeLabel = (project?.projectType && PROJECT_TYPE_LABEL[project.projectType]) || project?.projectType || 'Канбан';

  return (
    <div className="pim-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="pim-panel" onClick={(e) => e.stopPropagation()}>
        {/* Visual overlays */}
        <div className="pim-scanlines" />
        <div className="pim-grid" />
        <div
          className="pim-neon-top"
          style={{ background: `linear-gradient(90deg, transparent, ${boardColor} 20%, #FCEE0A 50%, ${boardColor} 80%, transparent)` }}
        />

        {/* Scrollable content */}
        <div className="pim-scroll">
          {loading ? (
            <div className="pim-loading">
              <Zap className="w-6 h-6 animate-pulse" style={{ color: '#FCEE0A' }} />
              <p>ЗАГРУЗКА...</p>
            </div>
          ) : !project ? (
            <div className="pim-loading">
              <FileText className="w-6 h-6" style={{ color: '#f43f5e' }} />
              <p>ПРОЕКТ НЕ НАЙДЕН</p>
            </div>
          ) : (
            <div className="pim-content">
              {/* ─── HEADER ─── */}
              <header className="pim-header">
                <div className="pim-header-left">
                  <div className="pim-header-icon">
                    <Disc3 className="w-4 h-4" style={{ color: '#FCEE0A' }} />
                  </div>
                  <div className="pim-header-title-wrap">
                    <h2 className="pim-title">{project.title}</h2>
                    <div className="pim-meta-row">
                      <span className="pim-type-badge">{projectTypeLabel}</span>
                      {project.deadline && (
                        <span className="pim-meta-chip">
                          <CalendarDays className="w-2.5 h-2.5" />
                          {formatDeadline(project.deadline)}
                        </span>
                      )}
                      {project.soundflowProjectId && (
                        <span className="pim-meta-chip">
                          <AudioLines className="w-2.5 h-2.5" />
                          SoundFlow
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  className="pim-close"
                  onClick={onClose}
                  title="Закрыть (Esc)"
                  aria-label="Закрыть"
                >
                  <X className="w-4 h-4" />
                </button>
              </header>

              {/* ─── COVER ─── */}
              <section className="pim-section pim-cover-section">
                <div className="pim-cover">
                  <Music className="w-7 h-7" style={{ color: hexToRgba('#FCEE0A', 0.55) }} />
                </div>
                <div className="pim-cover-info">
                  <span className="pim-label pim-label-block">ОБЛОЖКА</span>
                  <p className="pim-cover-text">
                    {project.soundflowProjectId
                      ? 'Связан с проектом SoundFlow'
                      : 'Загрузите обложку для релиза'}
                  </p>
                </div>
              </section>

              {/* ─── CONCEPT ─── */}
              <section className="pim-section">
                <div className="pim-label-row">
                  <FileText className="w-3 h-3" />
                  <span className="pim-label">КОНЦЕПЦИЯ</span>
                </div>
                {project.description ? (
                  <p className="pim-concept-text">{project.description}</p>
                ) : (
                  <p className="pim-empty-inline">Концепция не задана</p>
                )}
              </section>

              {/* ─── TRACK LIST ─── */}
              <section className="pim-section">
                <div className="pim-label-row">
                  <AudioLines className="w-3 h-3" />
                  <span className="pim-label">ТРЕК-ЛИСТ</span>
                  <span className="pim-count-chip">{tracks.length}</span>
                </div>
                {tracks.length === 0 ? (
                  <div className="pim-empty-state">
                    <Music className="w-5 h-5" />
                    <p>Треки пока не добавлены</p>
                  </div>
                ) : (
                  <div className="pim-tracks-list">
                    {tracks.map((track, idx) => {
                      const StatusIcon = STATUS_ICON[track.status] || Circle;
                      const statusHex = STATUS_HEX[track.status] || '#22d3ee';
                      const trackProgress = getProgress(track.children as { status: string }[] | undefined);
                      let trackInstruments: string[] = [];
                      if (track.trackConfig) {
                        try {
                          const cfg = JSON.parse(track.trackConfig) as { instruments?: unknown };
                          if (Array.isArray(cfg.instruments)) {
                            trackInstruments = cfg.instruments.filter(
                              (i): i is string => typeof i === 'string' && i.trim().length > 0,
                            );
                          }
                        } catch { /* ignore */ }
                      }
                      return (
                        <div key={track.id} className="pim-track-card">
                          <div className="pim-track-num">{String(idx + 1).padStart(2, '0')}</div>
                          <div className="pim-track-body">
                            <div className="pim-track-header">
                              <span className="pim-track-title">{track.title}</span>
                              <span className="pim-track-status" style={{ color: statusHex }}>
                                <StatusIcon className="w-3 h-3" />
                              </span>
                            </div>
                            <div className="pim-track-progress-row">
                              <div className="pim-track-progress-bar">
                                <div
                                  className="pim-track-progress-fill"
                                  style={{
                                    width: `${trackProgress}%`,
                                    backgroundColor: trackProgress === 100 ? '#34d399' : '#FCEE0A',
                                    boxShadow: trackProgress > 0
                                      ? `0 0 6px ${hexToRgba(trackProgress === 100 ? '#34d399' : '#FCEE0A', 0.5)}`
                                      : 'none',
                                  }}
                                />
                              </div>
                              <span
                                className="pim-track-progress-text"
                                style={{ color: trackProgress === 100 ? '#34d399' : '#FCEE0A' }}
                              >
                                {trackProgress}%
                              </span>
                            </div>
                            {trackInstruments.length > 0 && (
                              <div className="pim-track-instruments">
                                {trackInstruments.map((inst) => (
                                  <span key={inst} className="pim-instrument-chip">{inst}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* ─── COMPLETION STAGE ─── */}
              <section className="pim-section">
                <div className="pim-label-row">
                  <Zap className="w-3 h-3" />
                  <span className="pim-label">ЭТАП ВЫПОЛНЕНИЯ</span>
                </div>
                <div className="pim-overall-progress">
                  <div className="pim-overall-progress-bar">
                    <div
                      className="pim-overall-progress-fill"
                      style={{
                        width: `${progressPct}%`,
                        background: progressPct === 100
                          ? 'linear-gradient(90deg, #10b981, #34d399)'
                          : 'linear-gradient(90deg, #FCEE0A, #fbbf24)',
                        boxShadow: progressPct > 0
                          ? `0 0 10px ${hexToRgba(progressPct === 100 ? '#34d399' : '#FCEE0A', 0.5)}`
                          : 'none',
                      }}
                    />
                  </div>
                  <div className="pim-overall-progress-meta">
                    <span
                      className="pim-overall-progress-pct"
                      style={{ color: progressPct === 100 ? '#34d399' : '#FCEE0A' }}
                    >
                      {progressPct}%
                    </span>
                    <span className="pim-overall-progress-count">
                      {doneTasks} / {totalTasks} задач
                    </span>
                  </div>
                </div>
              </section>

              {/* ─── INSTRUMENTS ─── */}
              <section className="pim-section">
                <div className="pim-label-row">
                  <Guitar className="w-3 h-3" />
                  <span className="pim-label">ИНСТРУМЕНТЫ</span>
                  <span className="pim-count-chip">{instruments.length}</span>
                </div>
                {instruments.length === 0 ? (
                  <div className="pim-empty-state">
                    <Mic2 className="w-5 h-5" />
                    <p>Инструменты не указаны</p>
                  </div>
                ) : (
                  <div className="pim-instruments-grid">
                    {instruments.map((inst) => (
                      <span key={inst} className="pim-instrument-chip pim-instrument-chip-lg">{inst}</span>
                    ))}
                  </div>
                )}
              </section>

              {/* ─── REFERENCES ─── */}
              <section className="pim-section">
                <div className="pim-label-row">
                  <FileText className="w-3 h-3" />
                  <span className="pim-label">РЕФЕРЕНСЫ</span>
                </div>
                <div className="pim-empty-state">
                  <FileText className="w-5 h-5" />
                  <p>Референсы скоро появятся</p>
                </div>
              </section>

              {/* ─── CLIPS ─── */}
              <section className="pim-section">
                <div className="pim-label-row">
                  <Disc3 className="w-3 h-3" />
                  <span className="pim-label">КЛИПЫ</span>
                </div>
                <div className="pim-empty-state">
                  <Disc3 className="w-5 h-5" />
                  <p>Клипы скоро появятся</p>
                </div>
              </section>

              {/* ─── CONCERT SCHEDULE ─── */}
              <section className="pim-section">
                <div className="pim-label-row">
                  <CalendarDays className="w-3 h-3" />
                  <span className="pim-label">КОНЦЕРТЫ</span>
                  <span className="pim-count-chip">{performances.length}</span>
                </div>
                {performances.length === 0 ? (
                  <div className="pim-empty-state">
                    <CalendarDays className="w-5 h-5" />
                    <p>Концерты не запланированы</p>
                  </div>
                ) : (
                  <div className="pim-concerts-list">
                    {performances.map(({ task, boardTitle, boardColor: bc }) => {
                      const StatusIcon = STATUS_ICON[task.status] || Circle;
                      const statusHex = STATUS_HEX[task.status] || '#22d3ee';
                      return (
                        <div key={task.id} className="pim-concert-card">
                          <div
                            className="pim-concert-accent"
                            style={{ background: bc, boxShadow: `0 0 6px ${bc}` }}
                          />
                          <div className="pim-concert-body">
                            <div className="pim-concert-header">
                              <span className="pim-concert-title">{task.title}</span>
                              <span className="pim-concert-status" style={{ color: statusHex }}>
                                <StatusIcon className="w-3 h-3" />
                              </span>
                            </div>
                            <div className="pim-concert-meta">
                              <span className="pim-concert-board" style={{ color: bc }}>
                                <ListChecks className="w-2.5 h-2.5" />
                                {boardTitle}
                              </span>
                              {task.deadline && (
                                <span className="pim-concert-deadline">
                                  <Clock className="w-2.5 h-2.5" />
                                  {formatDeadline(task.deadline)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .pim-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          padding: 16px;
          animation: pim-fade-in 180ms ease-out;
        }
        @keyframes pim-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .pim-panel {
          position: relative;
          width: 100%;
          max-width: 672px;
          max-height: 80vh;
          background: rgba(8, 10, 18, 0.98);
          border: 1.5px solid ${hexToRgba(boardColor, 0.3)};
          box-shadow:
            0 0 32px ${hexToRgba(boardColor, 0.15)},
            0 16px 64px rgba(0, 0, 0, 0.7);
          clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: pim-pop-in 220ms ease-out;
        }
        @keyframes pim-pop-in {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .pim-scanlines {
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent 0px,
            transparent 2px,
            rgba(0, 229, 255, 0.02) 2px,
            rgba(0, 229, 255, 0.02) 3px
          );
          pointer-events: none;
          z-index: 1;
          animation: pim-scan 8s linear infinite;
        }
        @keyframes pim-scan {
          0% { transform: translateY(0); }
          100% { transform: translateY(3px); }
        }

        .pim-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(0, 229, 255, 0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 229, 255, 0.025) 1px, transparent 1px);
          background-size: 24px 24px;
          pointer-events: none;
          z-index: 1;
        }

        .pim-neon-top {
          height: 3px;
          flex-shrink: 0;
          position: relative;
          z-index: 2;
          box-shadow:
            0 0 12px rgba(252, 238, 10, 0.5),
            0 0 24px rgba(252, 238, 10, 0.2);
          animation: pim-pulse-neon 3s ease-in-out infinite;
        }
        @keyframes pim-pulse-neon {
          0%, 100% {
            opacity: 0.85;
            box-shadow: 0 0 8px rgba(252, 238, 10, 0.4), 0 0 16px rgba(252, 238, 10, 0.15);
          }
          50% {
            opacity: 1;
            box-shadow: 0 0 16px rgba(252, 238, 10, 0.7), 0 0 32px rgba(252, 238, 10, 0.3);
          }
        }

        .pim-scroll {
          position: relative;
          z-index: 2;
          overflow-y: auto;
          flex: 1;
          min-height: 0;
        }
        .pim-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .pim-scroll::-webkit-scrollbar-track {
          background: rgba(252, 238, 10, 0.03);
        }
        .pim-scroll::-webkit-scrollbar-thumb {
          background: ${hexToRgba(boardColor, 0.4)};
          border-radius: 0;
        }
        .pim-scroll::-webkit-scrollbar-thumb:hover {
          background: ${hexToRgba(boardColor, 0.6)};
        }
        .pim-scroll {
          scrollbar-width: thin;
          scrollbar-color: ${hexToRgba(boardColor, 0.4)} rgba(252, 238, 10, 0.03);
        }

        .pim-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 64px 16px;
          color: ${hexToRgba(boardColor, 0.7)};
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          text-shadow: 0 0 8px ${hexToRgba(boardColor, 0.3)};
        }

        .pim-content {
          padding: 0;
        }

        /* ── Header ───────────────────────────── */
        .pim-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 16px;
          background: linear-gradient(135deg, ${hexToRgba(boardColor, 0.08)}, transparent 70%);
          border-bottom: 2px solid ${hexToRgba(boardColor, 0.35)};
          position: relative;
        }
        .pim-header::before {
          content: '';
          position: absolute;
          left: 0;
          top: 12px;
          bottom: 12px;
          width: 2px;
          background: ${boardColor};
          box-shadow: 0 0 8px ${boardColor}, 0 0 16px ${hexToRgba(boardColor, 0.3)};
        }
        .pim-header-left {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          min-width: 0;
          flex: 1;
        }
        .pim-header-icon {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: ${hexToRgba('#FCEE0A', 0.08)};
          border: 1.5px solid ${hexToRgba('#FCEE0A', 0.4)};
          clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px));
          flex-shrink: 0;
        }
        .pim-header-title-wrap {
          min-width: 0;
          flex: 1;
        }
        .pim-title {
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
          line-height: 1.2;
          margin-bottom: 6px;
          word-break: break-word;
          text-shadow: 0 0 12px rgba(0, 229, 255, 0.15);
        }
        .pim-meta-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .pim-type-badge {
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 3px 8px;
          color: #000;
          background: linear-gradient(135deg, #FCEE0A, #fbbf24);
          clip-path: polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px));
          box-shadow: 0 0 8px rgba(252, 238, 10, 0.4);
          text-shadow: 0 1px 0 rgba(255, 255, 255, 0.3);
        }
        .pim-meta-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.05em;
          color: ${hexToRgba(boardColor, 0.85)};
          padding: 3px 7px;
          border: 1px solid ${hexToRgba(boardColor, 0.3)};
          background: ${hexToRgba(boardColor, 0.06)};
          clip-path: polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px));
        }
        .pim-close {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #4a4a5e;
          background: transparent;
          border: 1px solid transparent;
          clip-path: polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px));
          transition: all 150ms;
          flex-shrink: 0;
          cursor: pointer;
        }
        .pim-close:hover {
          color: #000;
          background: #FCEE0A;
          border-color: #FCEE0A;
          box-shadow: 0 0 12px rgba(252, 238, 10, 0.5);
        }

        /* ── Sections ─────────────────────────── */
        .pim-section {
          padding: 14px 16px;
          border-bottom: 1px solid ${hexToRgba(boardColor, 0.15)};
        }
        .pim-section:last-child {
          border-bottom: none;
        }
        .pim-label-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 10px;
        }
        .pim-label-row svg {
          color: #FCEE0A;
          filter: drop-shadow(0 0 4px rgba(252, 238, 10, 0.4));
        }
        .pim-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #FCEE0A;
          text-shadow: 0 0 6px rgba(252, 238, 10, 0.3);
        }
        .pim-label-block {
          display: block;
          margin-bottom: 6px;
        }
        .pim-count-chip {
          margin-left: auto;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.05em;
          padding: 2px 7px;
          color: ${boardColor};
          background: ${hexToRgba(boardColor, 0.1)};
          border: 1px solid ${hexToRgba(boardColor, 0.3)};
          clip-path: polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px));
        }

        /* ── Cover section ────────────────────── */
        .pim-cover-section {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .pim-cover {
          width: 96px;
          height: 96px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(10, 14, 24, 0.6);
          border: 1.5px dashed rgba(252, 238, 10, 0.4);
          clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
        }
        .pim-cover-info {
          flex: 1;
          min-width: 0;
        }
        .pim-cover-text {
          font-size: 11px;
          color: #64748b;
          line-height: 1.5;
        }

        /* ── Concept ──────────────────────────── */
        .pim-concept-text {
          font-size: 12px;
          color: #cbd5e1;
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .pim-empty-inline {
          font-size: 11px;
          color: #475569;
          font-style: italic;
        }

        /* ── Empty states ─────────────────────── */
        .pim-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 18px 12px;
          color: #475569;
          background: ${hexToRgba(boardColor, 0.03)};
          border: 1px dashed ${hexToRgba(boardColor, 0.2)};
          clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px));
        }
        .pim-empty-state svg {
          color: #475569;
        }
        .pim-empty-state p {
          font-size: 10px;
          letter-spacing: 0.05em;
          text-align: center;
        }

        /* ── Track list ───────────────────────── */
        .pim-tracks-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .pim-track-card {
          display: flex;
          gap: 10px;
          padding: 10px 12px;
          background: linear-gradient(135deg, rgba(10, 18, 32, 0.7), rgba(6, 10, 20, 0.8));
          border: 1.5px solid ${hexToRgba(boardColor, 0.2)};
          clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px));
          transition: all 180ms;
        }
        .pim-track-card:hover {
          border-color: ${hexToRgba('#FCEE0A', 0.4)};
          background: linear-gradient(135deg, rgba(14, 24, 42, 0.7), rgba(8, 14, 26, 0.8));
          box-shadow: 0 0 16px rgba(252, 238, 10, 0.08);
        }
        .pim-track-num {
          font-size: 11px;
          font-weight: 800;
          font-family: monospace;
          color: ${hexToRgba(boardColor, 0.6)};
          letter-spacing: 0.05em;
          min-width: 22px;
        }
        .pim-track-body {
          flex: 1;
          min-width: 0;
        }
        .pim-track-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 6px;
        }
        .pim-track-title {
          font-size: 12px;
          font-weight: 700;
          color: #FCEE0A;
          text-shadow: 0 0 6px rgba(252, 238, 10, 0.15);
          word-break: break-word;
        }
        .pim-track-status {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }
        .pim-track-progress-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }
        .pim-track-progress-bar {
          flex: 1;
          height: 4px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid ${hexToRgba(boardColor, 0.15)};
          overflow: hidden;
          position: relative;
        }
        .pim-track-progress-fill {
          height: 100%;
          transition: width 500ms;
          position: relative;
        }
        .pim-track-progress-fill::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
          animation: pim-shimmer 2s linear infinite;
        }
        @keyframes pim-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .pim-track-progress-text {
          font-size: 10px;
          font-weight: 700;
          font-family: monospace;
          min-width: 32px;
          text-align: right;
          text-shadow: 0 0 6px currentColor;
        }
        .pim-track-instruments {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .pim-instrument-chip {
          font-size: 9px;
          font-weight: 600;
          padding: 2px 6px;
          color: ${boardColor};
          background: ${hexToRgba(boardColor, 0.1)};
          border: 1px solid ${hexToRgba(boardColor, 0.25)};
          clip-path: polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px));
        }
        .pim-instrument-chip-lg {
          font-size: 10px;
          padding: 4px 9px;
        }
        .pim-instruments-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        /* ── Overall progress ─────────────────── */
        .pim-overall-progress {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pim-overall-progress-bar {
          height: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid ${hexToRgba('#FCEE0A', 0.2)};
          overflow: hidden;
          position: relative;
          clip-path: polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px));
        }
        .pim-overall-progress-fill {
          height: 100%;
          transition: width 600ms;
          position: relative;
        }
        .pim-overall-progress-fill::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
          animation: pim-shimmer 2s linear infinite;
        }
        .pim-overall-progress-meta {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
        }
        .pim-overall-progress-pct {
          font-size: 22px;
          font-weight: 800;
          font-family: monospace;
          letter-spacing: 0.05em;
          text-shadow: 0 0 12px currentColor;
        }
        .pim-overall-progress-count {
          font-size: 10px;
          color: #64748b;
          font-family: monospace;
          letter-spacing: 0.08em;
        }

        /* ── Concerts ─────────────────────────── */
        .pim-concerts-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .pim-concert-card {
          display: flex;
          gap: 0;
          background: linear-gradient(135deg, rgba(10, 18, 32, 0.7), rgba(6, 10, 20, 0.8));
          border: 1.5px solid ${hexToRgba(boardColor, 0.2)};
          clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px));
          overflow: hidden;
          transition: all 180ms;
        }
        .pim-concert-card:hover {
          border-color: ${hexToRgba('#FCEE0A', 0.4)};
          box-shadow: 0 0 16px rgba(252, 238, 10, 0.08);
        }
        .pim-concert-accent {
          width: 3px;
          flex-shrink: 0;
        }
        .pim-concert-body {
          flex: 1;
          padding: 8px 10px;
          min-width: 0;
        }
        .pim-concert-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 4px;
        }
        .pim-concert-title {
          font-size: 12px;
          font-weight: 700;
          color: #FCEE0A;
          word-break: break-word;
        }
        .pim-concert-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          font-size: 9px;
        }
        .pim-concert-board,
        .pim-concert-deadline {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-weight: 600;
          letter-spacing: 0.05em;
        }
        .pim-concert-deadline {
          color: #94a3b8;
        }

        /* ── Mobile responsiveness ────────────── */
        @media (max-width: 640px) {
          .pim-overlay {
            padding: 8px;
          }
          .pim-panel {
            max-width: 100%;
            max-height: 88vh;
          }
          .pim-title {
            font-size: 16px;
          }
          .pim-cover {
            width: 80px;
            height: 80px;
          }
          .pim-section {
            padding: 12px;
          }
          .pim-header {
            padding: 12px;
          }
          .pim-overall-progress-pct {
            font-size: 18px;
          }
        }
      `}</style>
    </div>
  );
}
