'use client';

import { useEffect, useState, useRef } from 'react';
import {
  X, Music, CalendarDays, Disc3, AudioLines, Zap, Check, Circle, Clock,
  ListChecks, FileText, Guitar, Mic2, Pencil, User,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { hexToRgba } from '@/lib/utils';
import type { Task, TaskChild } from '@/store/kanban-store';

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

/* Static lookup of "extra" boards to show as their own task lists. */
const BOARD_SECTION_DEFS: { title: string; match: string[] }[] = [
  { title: 'ДИСТРИБУЦИЯ', match: ['Дистрибуция'] },
  { title: 'МАРКЕТИНГ / ПРОДВИЖЕНИЕ', match: ['Маркетинг', 'Продвижение'] },
  { title: 'СВЕДЕНИЕ', match: ['Сведение'] },
  { title: 'МАСТЕРИНГ', match: ['Мастеринг'] },
  { title: 'РЕФЕРЕНСЫ', match: ['Референсы'] },
];

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

/* ── Compact task row (used by all extra board sections) ── */

function BoardTaskRow({ task }: { task: Task | TaskChild }) {
  const StatusIcon = STATUS_ICON[task.status] || Circle;
  const statusHex = STATUS_HEX[task.status] || '#22d3ee';
  const deadline = (task as { deadline?: string | null }).deadline ?? null;
  const assignee = (task as { assignee?: string | null }).assignee ?? null;
  return (
    <div className="pim-board-task-card">
      <span className="pim-board-task-status" style={{ color: statusHex }}>
        <StatusIcon className="w-3 h-3" />
      </span>
      <div className="pim-board-task-body">
        <div className="pim-board-task-header">
          <span className="pim-board-task-title">{task.title}</span>
        </div>
        {(deadline || assignee) && (
          <div className="pim-board-task-meta">
            {deadline && (
              <span className="pim-board-task-deadline">
                <Clock className="w-2.5 h-2.5" />
                {formatDeadline(deadline)}
              </span>
            )}
            {assignee && (
              <span className="pim-board-task-assignee">
                <User className="w-2.5 h-2.5" />
                {assignee}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Modal ───────────────────────────────────────── */

export default function ProjectInfoModal({ projectId, onClose }: ProjectInfoModalProps) {
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Task | null>(null);
  const [boards, setBoards] = useState<BoardInfo[]>([]);
  const [boardTasksMap, setBoardTasksMap] = useState<Map<string, Task[]>>(new Map());

  // Concept (description) inline editing
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [savingDesc, setSavingDesc] = useState(false);
  const descTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Cover URL fetch + edit
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverLoaded, setCoverLoaded] = useState(false);
  const [editingCover, setEditingCover] = useState(false);
  const [coverDraft, setCoverDraft] = useState('');
  const [savingCover, setSavingCover] = useState(false);

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

        // 4. Fetch SoundFlow project to get coverUrl (if linked)
        if (proj?.soundflowProjectId) {
          try {
            const cvRes = await fetch(`/api/projects/${proj.soundflowProjectId}`);
            if (cvRes.ok) {
              const cvData = await cvRes.json();
              if (!cancelled) setCoverUrl(cvData.coverUrl || null);
            }
          } catch {
            /* ignore */
          }
        }
        if (!cancelled) setCoverLoaded(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  // Close on Escape key (only when not editing description)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !editingDesc && !editingCover) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, editingDesc, editingCover]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (editingDesc && descTextareaRef.current) {
      descTextareaRef.current.focus();
      descTextareaRef.current.setSelectionRange(
        descTextareaRef.current.value.length,
        descTextareaRef.current.value.length,
      );
    }
  }, [editingDesc]);

  /* ── Save handlers ────────────────────────────────── */

  async function saveDesc() {
    if (!project || savingDesc) return;
    const next = descDraft.trim();
    if (next === (project.description || '')) {
      setEditingDesc(false);
      return;
    }
    setSavingDesc(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: projectId, description: next }),
      });
      if (!res.ok) throw new Error('save failed');
      setProject(prev => prev ? { ...prev, description: next || null } : prev);
      setEditingDesc(false);
    } catch {
      /* ignore */
    } finally {
      setSavingDesc(false);
    }
  }

  function startEditDesc() {
    setDescDraft(project?.description || '');
    setEditingDesc(true);
  }

  function cancelEditDesc() {
    setEditingDesc(false);
    setDescDraft(project?.description || '');
  }

  async function saveCover() {
    if (!project || !project.soundflowProjectId || savingCover) return;
    const next = coverDraft.trim();
    setSavingCover(true);
    try {
      const res = await fetch(`/api/projects/${project.soundflowProjectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverUrl: next || null }),
      });
      if (!res.ok) throw new Error('cover save failed');
      const data = await res.json();
      setCoverUrl(data.coverUrl || null);
      setEditingCover(false);
    } catch {
      /* ignore */
    } finally {
      setSavingCover(false);
    }
  }

  function startEditCover() {
    setCoverDraft(coverUrl || '');
    setEditingCover(true);
  }

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
  const boardProgressList: { board: BoardInfo; total: number; done: number; pct: number }[] = [];
  for (const b of boards) {
    const ts = boardTasksMap.get(b.id) || [];
    const c = countAll(ts as unknown as CountableTask[]);
    totalTasks += c.total;
    doneTasks += c.done;
    const pct = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
    boardProgressList.push({ board: b, total: c.total, done: c.done, pct });
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

  // Build the extra board-task sections (Дистрибуция / Маркетинг / etc.)
  // Always show all 5 sections — empty ones display "Нет задач".
  const boardSections: { title: string; tasks: (Task | TaskChild)[]; color: string }[] = [];
  for (const def of BOARD_SECTION_DEFS) {
    const matchingBoards = boards.filter(b =>
      def.match.some(m => b.title.toLowerCase() === m.toLowerCase()),
    );
    const tasks: (Task | TaskChild)[] = [];
    let color = BOARD_COLOR;
    for (const mb of matchingBoards) {
      const ts = boardTasksMap.get(mb.id) || [];
      for (const t of ts) tasks.push(t);
      if (mb.color) color = mb.color;
    }
    boardSections.push({ title: def.title, tasks, color });
  }

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
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt="Обложка проекта"
                      className="pim-cover-img"
                      onError={() => setCoverUrl(null)}
                    />
                  ) : (
                    <Music className="w-7 h-7" style={{ color: hexToRgba('#FCEE0A', 0.55) }} />
                  )}
                </div>
                <div className="pim-cover-info">
                  <span className="pim-label pim-label-block">ОБЛОЖКА</span>
                  {editingCover ? (
                    <>
                      <input
                        type="url"
                        className="pim-cover-url-input"
                        placeholder="https://..."
                        value={coverDraft}
                        onChange={(e) => setCoverDraft(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void saveCover(); }
                          if (e.key === 'Escape') { setEditingCover(false); }
                        }}
                      />
                      <div className="pim-edit-actions">
                        <button
                          className="pim-edit-cancel"
                          onClick={() => setEditingCover(false)}
                          disabled={savingCover}
                        >
                          Отмена
                        </button>
                        <button
                          className="pim-edit-save"
                          onClick={() => void saveCover()}
                          disabled={savingCover}
                        >
                          {savingCover ? '...' : 'Сохранить'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="pim-cover-text">
                        {!project.soundflowProjectId
                          ? 'Нет связи с SoundFlow'
                          : coverUrl
                            ? 'Обложка загружена'
                            : coverLoaded
                              ? 'Обложка не задана'
                              : 'Загрузка обложки...'}
                      </p>
                      {project.soundflowProjectId && (
                        <div className="pim-cover-edit-row">
                          <button
                            className="pim-edit-btn"
                            onClick={startEditCover}
                            disabled={savingCover}
                          >
                            <Pencil className="w-3 h-3" />
                            Изменить
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>

              {/* ─── CONCEPT (editable) ─── */}
              <section className="pim-section">
                <div className="pim-label-row">
                  <FileText className="w-3 h-3" />
                  <span className="pim-label">КОНЦЕПЦИЯ</span>
                  {!editingDesc && (
                    <button
                      className="pim-edit-btn"
                      style={{ marginLeft: 'auto' }}
                      onClick={startEditDesc}
                      title="Изменить концепцию"
                    >
                      <Pencil className="w-3 h-3" />
                      Изменить
                    </button>
                  )}
                </div>
                {editingDesc ? (
                  <div>
                    <Textarea
                      ref={descTextareaRef}
                      value={descDraft}
                      onChange={(e) => setDescDraft(e.target.value)}
                      placeholder="Опишите концепцию проекта..."
                      className="pim-concept-textarea"
                      autoFocus
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                          e.preventDefault();
                          void saveDesc();
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          cancelEditDesc();
                        }
                      }}
                      onBlur={() => { void saveDesc(); }}
                    />
                    <div className="pim-edit-actions">
                      <span style={{ fontSize: '9px', color: '#475569', marginRight: 'auto' }}>
                        Ctrl+Enter — сохранить · Esc — отмена
                      </span>
                      <button
                        className="pim-edit-cancel"
                        onClick={cancelEditDesc}
                        disabled={savingDesc}
                      >
                        Отмена
                      </button>
                      <button
                        className="pim-edit-save"
                        onClick={() => void saveDesc()}
                        disabled={savingDesc}
                      >
                        {savingDesc ? '...' : 'Сохранить'}
                      </button>
                    </div>
                  </div>
                ) : project.description ? (
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

              {/* ─── BOARD PROGRESS OVERVIEW ─── */}
              <section className="pim-section">
                <div className="pim-label-row">
                  <ListChecks className="w-3 h-3" />
                  <span className="pim-label">ПРОГРЕСС ПО ДОСКАМ</span>
                  <span className="pim-count-chip">{boards.length}</span>
                </div>
                {boards.length === 0 ? (
                  <div className="pim-empty-inline">Доски не найдены</div>
                ) : (
                  <div className="pim-board-progress-grid">
                    {boardProgressList.map(({ board, total, done, pct }) => (
                      <div key={board.id} className="pim-board-progress-card">
                        <div className="pim-board-progress-header">
                          <span
                            className="pim-board-progress-dot"
                            style={{ background: board.color, boxShadow: `0 0 6px ${hexToRgba(board.color, 0.6)}` }}
                          />
                          <span className="pim-board-progress-title" title={board.title}>
                            {board.title}
                          </span>
                          <span className="pim-board-progress-pct">{pct}%</span>
                        </div>
                        <div className="pim-board-progress-bar">
                          <div
                            className="pim-board-progress-fill"
                            style={{
                              width: `${pct}%`,
                              background: pct === 100
                                ? 'linear-gradient(90deg, #10b981, #34d399)'
                                : board.color,
                              boxShadow: pct > 0 ? `0 0 6px ${hexToRgba(pct === 100 ? '#34d399' : board.color, 0.4)}` : 'none',
                            }}
                          />
                        </div>
                        <div className="pim-board-progress-meta">
                          <span>{done} вып.</span>
                          <span>{total} всего</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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

              {/* ─── EXTRA BOARD SECTIONS ─── */}
              {boardSections.map((sec) => (
                <section key={sec.title} className="pim-section">
                  <div className="pim-label-row">
                    <span
                      className="pim-board-progress-dot"
                      style={{ background: sec.color, boxShadow: `0 0 6px ${hexToRgba(sec.color, 0.6)}` }}
                    />
                    <span className="pim-label">{sec.title}</span>
                    <span className="pim-count-chip">{sec.tasks.length}</span>
                  </div>
                  {sec.tasks.length === 0 ? (
                    <div className="pim-empty-inline-board">Нет задач</div>
                  ) : (
                    <div className="pim-board-tasks-list">
                      {sec.tasks.map((t) => (
                        <BoardTaskRow key={t.id} task={t} />
                      ))}
                    </div>
                  )}
                </section>
              ))}

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
