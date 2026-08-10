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
    <div
      className="pim-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        '--bc': BOARD_COLOR,
        '--bc-012': hexToRgba(BOARD_COLOR, 0.012),
        '--bc-02': hexToRgba(BOARD_COLOR, 0.02),
        '--bc-025': hexToRgba(BOARD_COLOR, 0.025),
        '--bc-04': hexToRgba(BOARD_COLOR, 0.04),
        '--bc-05': hexToRgba(BOARD_COLOR, 0.05),
        '--bc-08': hexToRgba(BOARD_COLOR, 0.08),
        '--bc-1': hexToRgba(BOARD_COLOR, 0.1),
        '--bc-12': hexToRgba(BOARD_COLOR, 0.12),
        '--bc-15': hexToRgba(BOARD_COLOR, 0.15),
        '--bc-18': hexToRgba(BOARD_COLOR, 0.18),
        '--bc-2': hexToRgba(BOARD_COLOR, 0.2),
        '--bc-22': hexToRgba(BOARD_COLOR, 0.22),
        '--bc-25': hexToRgba(BOARD_COLOR, 0.25),
        '--bc-3': hexToRgba(BOARD_COLOR, 0.3),
        '--bc-35': hexToRgba(BOARD_COLOR, 0.35),
        '--bc-4': hexToRgba(BOARD_COLOR, 0.4),
        '--bc-45': hexToRgba(BOARD_COLOR, 0.45),
        '--bc-5': hexToRgba(BOARD_COLOR, 0.5),
        '--bc-55': hexToRgba(BOARD_COLOR, 0.55),
        '--bc-6': hexToRgba(BOARD_COLOR, 0.6),
        '--bc-65': hexToRgba(BOARD_COLOR, 0.65),
        '--bc-7': hexToRgba(BOARD_COLOR, 0.7),
        '--bc-8': hexToRgba(BOARD_COLOR, 0.8),
      } as React.CSSProperties}
    >
      <div className="pim-panel" onClick={(e) => e.stopPropagation()}>
        {/* Visual overlays */}
        <div className="pim-scanlines" />
        <div className="pim-grid" />
        <div
          className="pim-neon-top"
          style={{ background: `linear-gradient(90deg, transparent, #00d9ff 20%, #FCEE0A 50%, #00d9ff 80%, transparent)` }}
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
    </div>
  );
}
