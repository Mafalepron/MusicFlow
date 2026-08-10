'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderKanban, Music2, Lightbulb, Users, ArrowRight, Plus,
  ChevronDown, ChevronRight, Disc3, AudioLines, Zap, Clock,
} from 'lucide-react';
import { useAuthStore, useDataStore, useNavigationStore, type Project } from '@/lib/store';
import { useKanbanStore, type Task } from '@/store/kanban-store';
import { hexToRgba } from '@/lib/utils';

/* ─── palette ─── */
const Y = '#FCEE0A'; // yellow accent
const C = '#00d9ff'; // cyan
const A = '#f59e0b'; // amber
const G = '#10b981'; // green

const typeMeta: Record<string, { label: string; color: string; icon: typeof Disc3 }> = {
  album:   { label: 'Альбом',  color: '#a855f7', icon: Disc3 },
  ep:      { label: 'EP',      color: C,         icon: AudioLines },
  single:  { label: 'Сингл',   color: A,         icon: Music2 },
  general: { label: 'Канбан',  color: G,         icon: FolderKanban },
};

const stHex: Record<string, string> = {
  draft: A, in_progress: C, mixing: '#ff6b35', mastering: G, released: Y,
};
const stLabel: Record<string, string> = {
  draft: 'Черновик', in_progress: 'В работе', mixing: 'Сведение', mastering: 'Мастеринг', released: 'Релиз',
};

const plural = (n: number, f: [string, string, string]) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return f[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return f[1];
  return f[2];
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

/* ─── Project Card ─── */
function ProjectCard({ project, trackCount, onClick, onKanban }: {
  project: Project; trackCount: number; onClick: () => void; onKanban: () => void;
}) {
  const [h, setH] = useState(false);
  const t = typeMeta[project.type] || typeMeta.general;
  const Icon = t.icon;
  const sc = stHex[project.status] || '#64748b';
  const sl = stLabel[project.status] || project.status;
  const hasKanban = !!project.kanbanTaskId;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      className="group relative cursor-pointer"
      style={{
        borderRadius: '10px',
        background: h ? 'rgba(16,20,30,0.8)' : 'rgba(10,14,22,0.5)',
        border: `1px solid ${h ? hexToRgba(t.color, 0.4) : 'rgba(255,255,255,0.06)'}`,
        boxShadow: h ? `0 8px 28px rgba(0,0,0,0.4), 0 0 0 1px ${hexToRgba(t.color, 0.15)}` : '0 2px 8px rgba(0,0,0,0.2)',
        transition: 'all 220ms cubic-bezier(0.4,0,0.2,1)',
        transform: h ? 'translateY(-3px)' : 'none',
        overflow: 'hidden',
      }}
    >
      {/* Cover gradient strip */}
      <div
        className="h-20 flex items-end p-3"
        style={{
          background: `linear-gradient(135deg, ${hexToRgba(t.color, h ? 0.25 : 0.12)}, ${hexToRgba(t.color, h ? 0.05 : 0.02)})`,
          borderBottom: `1px solid ${hexToRgba(t.color, 0.1)}`,
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: hexToRgba(t.color, 0.15), border: `1px solid ${hexToRgba(t.color, 0.3)}` }}
          >
            <Icon className="w-4 h-4" style={{ color: t.color }} />
          </div>
          <span className="text-[11px] font-semibold" style={{ color: t.color }}>{t.label}</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <h3
          className="mb-2 text-[15px] font-semibold leading-snug transition-colors"
          style={{ color: h ? t.color : '#e8eaed' }}
        >
          {project.title}
        </h3>

        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Music2 className="w-3 h-3" />
            {trackCount} {plural(trackCount, ['трек', 'трека', 'треков'])}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc, boxShadow: `0 0 4px ${hexToRgba(sc, 0.5)}` }} />
            {sl}
          </span>
        </div>

        {hasKanban && (
          <button
            onClick={(e) => { e.stopPropagation(); onKanban(); }}
            className="mt-3 flex items-center gap-1.5 text-[11px] font-medium transition-colors"
            style={{ color: h ? Y : C }}
          >
            <Zap className="w-3 h-3" />
            Открыть Kanban
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Kanban Card ─── */
function KanbanCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const [h, setH] = useState(false);
  const isAuto = !!task.soundflowProjectId;
  const color = isAuto ? Y : C;
  const children = task.children || [];
  const done = children.filter(c => c.status === 'done').length;
  const pct = children.length > 0 ? Math.round((done / children.length) * 100) : 0;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      className="cursor-pointer p-4"
      style={{
        borderRadius: '10px',
        background: h ? 'rgba(16,20,30,0.8)' : 'rgba(10,14,22,0.5)',
        border: `1px solid ${h ? hexToRgba(color, 0.35) : 'rgba(255,255,255,0.06)'}`,
        boxShadow: h ? `0 6px 20px rgba(0,0,0,0.35)` : '0 2px 6px rgba(0,0,0,0.15)',
        transition: 'all 220ms cubic-bezier(0.4,0,0.2,1)',
        transform: h ? 'translateY(-2px)' : 'none',
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
          style={{ background: hexToRgba(color, 0.12), color, border: `1px solid ${hexToRgba(color, 0.25)}` }}
        >
          {isAuto ? 'AUTO' : 'KANBAN'}
        </span>
        <span className="text-[10px] text-slate-600">{task.projectType || 'general'}</span>
      </div>
      <h3 className="mb-3 text-sm font-medium text-slate-200 line-clamp-2" style={{ minHeight: '2.5em' }}>
        {task.title}
      </h3>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: color, boxShadow: pct > 0 ? `0 0 4px ${hexToRgba(color, 0.5)}` : 'none' }}
          />
        </div>
        <span className="text-[10px] font-semibold tabular-nums" style={{ color: pct === 100 ? G : color }}>
          {pct}%
        </span>
      </div>
    </div>
  );
}

/* ─── Idea Card ─── */
function IdeaCard({ idea, onClick }: { idea: { id: string; title: string; description?: string; createdAt: string }; onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      className="w-60 shrink-0 cursor-pointer p-4"
      style={{
        borderRadius: '10px',
        background: h ? 'rgba(16,20,30,0.8)' : 'rgba(10,14,22,0.5)',
        border: `1px solid ${h ? hexToRgba(A, 0.3) : 'rgba(255,255,255,0.06)'}`,
        boxShadow: h ? `0 6px 20px rgba(0,0,0,0.3)` : '0 2px 6px rgba(0,0,0,0.15)',
        transition: 'all 220ms cubic-bezier(0.4,0,0.2,1)',
        transform: h ? 'translateY(-2px)' : 'none',
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <Lightbulb className="w-3.5 h-3.5" style={{ color: A, opacity: h ? 1 : 0.6 }} />
        <span className="text-[10px] font-medium text-slate-500">{fmtDate(idea.createdAt)}</span>
      </div>
      <h3 className="mb-1 text-sm font-medium text-slate-200 line-clamp-1">{idea.title}</h3>
      {idea.description && <p className="text-[11px] text-slate-500 line-clamp-2">{idea.description}</p>}
    </div>
  );
}

/* ─── Stat Pill ─── */
function StatPill({ icon: Icon, value, label, color }: {
  icon: typeof FolderKanban; value: number; label: string; color: string;
}) {
  const [h, setH] = useState(false);
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      className="flex items-center gap-3 p-4"
      style={{
        borderRadius: '10px',
        background: h ? 'rgba(16,20,30,0.7)' : 'rgba(10,14,22,0.4)',
        border: `1px solid ${h ? hexToRgba(color, 0.25) : 'rgba(255,255,255,0.05)'}`,
        transition: 'all 200ms',
      }}
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ background: hexToRgba(color, 0.1), border: `1px solid ${hexToRgba(color, 0.2)}` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <p className="text-xl font-bold tabular-nums text-slate-100">{value}</p>
        <p className="text-[10px] text-slate-500">{label}</p>
      </div>
    </div>
  );
}

/* ─── Section header ─── */
function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-sm font-bold tracking-wide text-slate-200">{title}</h2>
      {action}
    </div>
  );
}

/* ═══ MAIN ═══ */
export function HomeView() {
  const user = useAuthStore(s => s.user);
  const currentGroupId = useAuthStore(s => s.currentGroupId);
  const currentGroup = useDataStore(s => s.currentGroup);
  const projects = useDataStore(s => s.projects);
  const ideas = useDataStore(s => s.ideas);
  const tracks = useDataStore(s => s.tracks);
  const navigate = useNavigationStore(s => s.navigate);

  const [memberCount, setMemberCount] = useState(0);
  const [kanbanProjects, setKanbanProjects] = useState<Task[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({ album: true, ep: false, single: false, general: false });

  const autoProjects = useMemo(() => projects.filter(p => p.kanbanTaskId), [projects]);
  const recentIdeas = useMemo(() =>
    [...ideas].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8),
  [ideas]);

  const getTrackCount = (pid: string) => tracks.filter(t => t.projectId === pid).length;

  const projectsByType = useMemo(() => {
    const g: Record<string, Project[]> = { album: [], ep: [], single: [], general: [] };
    projects.forEach(p => { const k = (p.type || 'general').toLowerCase(); (g[k] ||= []).push(p); });
    return g;
  }, [projects]);

  useEffect(() => {
    if (!currentGroupId) return;
    fetch(`/api/groups/${currentGroupId}/members`).then(r => r.json()).then(m => setMemberCount(Array.isArray(m) ? m.length : 0)).catch(() => {});
  }, [currentGroupId]);

  useEffect(() => {
    fetch('/api/tasks?parentId=null').then(r => r.json()).then(data => {
      const tasks: Task[] = Array.isArray(data) ? data : data.tasks || [];
      setKanbanProjects(tasks);
      useKanbanStore.getState().setProjects(tasks);
    }).catch(() => {});
  }, []);

  const goToKanban = (id: string) => { if (id) { navigate('kanban'); setTimeout(() => useKanbanStore.getState().selectProject(id), 220); } };
  const toggleFolder = (k: string) => setExpandedFolders(p => ({ ...p, [k]: !p[k] }));

  const stats = [
    { icon: FolderKanban, value: projects.length, label: 'Проекты', color: Y },
    { icon: Music2, value: tracks.length, label: 'Треки', color: C },
    { icon: Lightbulb, value: ideas.length, label: 'Идеи', color: A },
    { icon: Users, value: memberCount, label: 'Участники', color: G },
  ];

  return (
    <div className="min-h-full bg-[#06080d]">
      <div className="mx-auto max-w-6xl px-5 py-6 lg:px-8 lg:py-8">
        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <h1 className="text-xl font-bold text-slate-100 lg:text-2xl">
            Привет, {user?.displayName || 'музыкант'}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {currentGroup?.name || 'SoundFlow'}{currentGroup?.genre ? ` · ${currentGroup.genre}` : ''}
          </p>
        </motion.div>

        {/* ── Stats ── */}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map(s => <StatPill key={s.label} {...s} />)}
        </div>

        {/* ── Auto Projects ── */}
        <section className="mt-8">
          <SectionHeader
            title="Авто проекты"
            action={
              <button onClick={() => navigate('projects')} className="flex items-center gap-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-yellow-400">
                <Plus className="w-3 h-3" /> Создать
              </button>
            }
          />
          {autoProjects.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-slate-800 py-10 text-center">
              <p className="text-sm text-slate-600">Нет проектов. Создайте первый —</p>
              <button onClick={() => navigate('projects')} className="mt-1 text-sm font-medium text-yellow-400 hover:underline">создать →</button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {autoProjects.map(p => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  trackCount={getTrackCount(p.id)}
                  onClick={() => navigate('project-detail', p.id)}
                  onKanban={() => p.kanbanTaskId && goToKanban(p.kanbanTaskId)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Kanban Projects ── */}
        <section className="mt-8">
          <SectionHeader
            title="Канбан проекты"
            action={
              <button onClick={() => navigate('kanban')} className="flex items-center gap-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-cyan-400">
                Все <ArrowRight className="w-3 h-3" />
              </button>
            }
          />
          {kanbanProjects.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-slate-800 py-10 text-center">
              <p className="text-sm text-slate-600">Канбан-проектов пока нет</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {kanbanProjects.map(task => (
                <KanbanCard key={task.id} task={task} onClick={() => goToKanban(task.id)} />
              ))}
            </div>
          )}
        </section>

        {/* ── Folders ── */}
        <section className="mt-8">
          <SectionHeader title="Мои папки" />
          <div className="grid gap-3 sm:grid-cols-2">
            {(['album', 'ep', 'single', 'general'] as const).map(key => {
              const list = projectsByType[key] || [];
              const t = typeMeta[key];
              const isOpen = !!expandedFolders[key];
              return (
                <div
                  key={key}
                  className="overflow-hidden"
                  style={{
                    borderRadius: '10px',
                    background: 'rgba(10,14,22,0.5)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <button
                    onClick={() => toggleFolder(key)}
                    className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-white/[0.03]"
                  >
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ background: hexToRgba(t.color, 0.1), border: `1px solid ${hexToRgba(t.color, 0.2)}` }}
                    >
                      <t.icon className="w-4 h-4" style={{ color: t.color }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-200">{t.label}</p>
                      <p className="text-[10px] text-slate-600">{list.length} {plural(list.length, ['проект', 'проекта', 'проектов'])}</p>
                    </div>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-slate-600" /> : <ChevronRight className="w-4 h-4 text-slate-600" />}
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && list.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-white/[0.04]"
                      >
                        <div className="space-y-1 p-2">
                          {list.map(p => {
                            const sc = stHex[p.status] || C;
                            return (
                              <button
                                key={p.id}
                                onClick={() => navigate('project-detail', p.id)}
                                className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-xs transition-colors hover:bg-white/[0.04]"
                              >
                                <span className="truncate text-slate-300">{p.title}</span>
                                <span className="flex items-center gap-1.5 shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc }} />
                                  <span className="text-[10px] text-slate-500">{stLabel[p.status] || p.status}</span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Ideas ── */}
        <section className="mt-8">
          <SectionHeader
            title="Лента идей"
            action={
              <button onClick={() => navigate('ideas')} className="flex items-center gap-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-amber-400">
                Все <ArrowRight className="w-3 h-3" />
              </button>
            }
          />
          {recentIdeas.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-slate-800 py-10 text-center">
              <p className="text-sm text-slate-600">Идей пока нет</p>
              <button onClick={() => navigate('ideas')} className="mt-1 text-sm font-medium text-amber-400 hover:underline">добавить →</button>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
              {recentIdeas.map(idea => (
                <IdeaCard key={idea.id} idea={idea} onClick={() => navigate('ideas')} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
