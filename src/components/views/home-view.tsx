'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderKanban,
  Music2,
  Lightbulb,
  Users,
  ArrowRight,
  Plus,
  ChevronDown,
  ChevronRight,
  Hexagon,
  Folder,
  Disc3,
} from 'lucide-react';
import { useAuthStore, useDataStore, useNavigationStore } from '@/lib/store';
import { useKanbanStore, type Task } from '@/store/kanban-store';
import { hexToRgba } from '@/lib/utils';

/* ─── cyberpunk palette ─── */
const YELLOW = '#FCEE0A';
const CYAN = '#00d9ff';
const AMBER = '#F59E0B';
const GREEN = '#10B981';
const CARD_BG = 'rgba(8,12,22,0.9)';

const CARD_CLIP =
  'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))';
const BTN_CLIP =
  'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))';

const typeLabels: Record<string, string> = {
  album: 'Альбом',
  ep: 'EP',
  single: 'Сингл',
  general: 'Общее',
};

const statusLabels: Record<string, string> = {
  draft: 'Черновик',
  in_progress: 'В работе',
  mixing: 'Сведение',
  mastering: 'Мастеринг',
  released: 'Релиз',
};

const statusColors: Record<string, string> = {
  draft: AMBER,
  in_progress: CYAN,
  mixing: '#ff6b35',
  mastering: GREEN,
  released: YELLOW,
};

const folderColor: Record<string, string> = {
  album: YELLOW,
  ep: CYAN,
  single: AMBER,
  general: GREEN,
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
};

/* ─── NeonCard: cyberpunk card with hover glow ─── */
function NeonCard({
  color,
  children,
  onClick,
  className = '',
  glow = 0.06,
}: {
  color: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  glow?: number;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        clipPath: CARD_CLIP,
        background: CARD_BG,
        boxShadow: `inset 0 0 0 1px ${hexToRgba(color, hovered ? 0.6 : 0.3)}, 0 0 ${hovered ? 28 : 18}px ${hexToRgba(color, hovered ? 0.22 : glow)}`,
        transition: 'box-shadow 200ms ease',
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({
  title,
  color = YELLOW,
  action,
}: {
  title: string;
  color?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2
        className="text-base font-bold uppercase tracking-[0.12em] sm:text-lg"
        style={{ color, textShadow: `0 0 8px ${hexToRgba(color, 0.4)}` }}
      >
        {title}
      </h2>
      {action}
    </div>
  );
}

function EmptyState({
  color,
  icon: Icon,
  label,
  hint,
}: {
  color: string;
  icon: typeof FolderKanban;
  label: string;
  hint?: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center py-12"
      style={{
        clipPath: CARD_CLIP,
        background: CARD_BG,
        boxShadow: `inset 0 0 0 1px ${hexToRgba(color, 0.2)}`,
      }}
    >
      <Icon
        className="mb-3 h-8 w-8"
        style={{ color: hexToRgba(color, 0.5), filter: `drop-shadow(0 0 6px ${hexToRgba(color, 0.3)})` }}
      />
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      {hint && <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">{hint}</p>}
    </div>
  );
}

const pluralize = (n: number, forms: [string, string, string]) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
};

export function HomeView() {
  const user = useAuthStore((s) => s.user);
  const currentGroupId = useAuthStore((s) => s.currentGroupId);
  const currentGroup = useDataStore((s) => s.currentGroup);
  const projects = useDataStore((s) => s.projects);
  const ideas = useDataStore((s) => s.ideas);
  const tracks = useDataStore((s) => s.tracks);
  const navigate = useNavigationStore((s) => s.navigate);

  const [memberCount, setMemberCount] = useState(0);
  const [kanbanProjects, setKanbanProjects] = useState<Task[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    album: true,
    ep: false,
    single: false,
    general: false,
  });

  /* Auto Projects = SoundFlow projects linked to a kanban task */
  const autoProjects = useMemo(() => projects.filter((p) => p.kanbanTaskId), [projects]);

  const recentIdeas = useMemo(
    () =>
      [...ideas]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8),
    [ideas]
  );

  const getTrackCountForProject = (projectId: string) =>
    tracks.filter((t) => t.projectId === projectId).length;

  /* Group SoundFlow projects by type → folders */
  const projectsByType = useMemo(() => {
    const groups: Record<string, typeof projects> = {
      album: [],
      ep: [],
      single: [],
      general: [],
    };
    projects.forEach((p) => {
      const key = (p.type || 'general').toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return groups;
  }, [projects]);

  /* Fetch member count */
  useEffect(() => {
    if (!currentGroupId) return;
    fetch(`/api/groups/${currentGroupId}/members`)
      .then((r) => r.json())
      .then((members) => setMemberCount(Array.isArray(members) ? members.length : 0))
      .catch(() => {});
  }, [currentGroupId]);

  /* Fetch ALL kanban projects (top-level tasks where isProject=true) */
  useEffect(() => {
    fetch('/api/tasks?parentId=null')
      .then((r) => r.json())
      .then((data) => {
        const tasks: Task[] = Array.isArray(data) ? data : data.tasks || [];
        setKanbanProjects(tasks);
        useKanbanStore.getState().setProjects(tasks);
      })
      .catch(() => {});
  }, []);

  const stats = [
    { label: 'Projects', value: projects.length, icon: FolderKanban, color: YELLOW },
    { label: 'Tracks', value: tracks.length, icon: Music2, color: CYAN },
    { label: 'Ideas', value: ideas.length, icon: Lightbulb, color: AMBER },
    { label: 'Members', value: memberCount, icon: Users, color: GREEN },
  ];

  const goToKanbanProject = (kanbanProjectId: string) => {
    if (!kanbanProjectId) return;
    navigate('kanban');
    setTimeout(() => useKanbanStore.getState().selectProject(kanbanProjectId), 220);
  };

  const toggleFolder = (key: string) =>
    setExpandedFolders((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="relative min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-[#05080f]">
      {/* subtle grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage: `linear-gradient(${hexToRgba(CYAN, 0.04)} 1px, transparent 1px), linear-gradient(90deg, ${hexToRgba(CYAN, 0.04)} 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />
      {/* faint scanlines */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0, 217, 255, 0.012) 2px, rgba(0, 217, 255, 0.012) 3px)',
        }}
      />

      <div className="relative mx-auto max-w-7xl space-y-10 px-4 py-6 lg:px-8 lg:py-8">
        {/* ─── HEADER ─── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1
            className="text-2xl font-bold uppercase tracking-[0.08em] lg:text-3xl"
            style={{
              color: YELLOW,
              textShadow: `0 0 12px ${hexToRgba(YELLOW, 0.45)}, 0 0 32px ${hexToRgba(YELLOW, 0.2)}`,
            }}
          >
            Welcome back, {user?.displayName || 'Musician'}
          </h1>
          {currentGroup && (
            <p
              className="mt-1 text-sm font-medium uppercase tracking-[0.18em]"
              style={{ color: CYAN, textShadow: `0 0 8px ${hexToRgba(CYAN, 0.3)}` }}
            >
              {currentGroup.name}
              {currentGroup.genre ? ` · ${currentGroup.genre}` : ''}
            </p>
          )}
        </motion.div>

        {/* ─── STATS GRID ─── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"
        >
          {stats.map((stat) => (
            <motion.div key={stat.label} variants={itemVariants}>
              <NeonCard color={stat.color} className="p-4 lg:p-5">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center"
                    style={{
                      clipPath: BTN_CLIP,
                      background: hexToRgba(stat.color, 0.12),
                      boxShadow: `inset 0 0 0 1px ${hexToRgba(stat.color, 0.4)}`,
                    }}
                  >
                    <stat.icon
                      className="h-5 w-5"
                      style={{
                        color: stat.color,
                        filter: `drop-shadow(0 0 4px ${hexToRgba(stat.color, 0.6)})`,
                      }}
                    />
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums text-slate-100">{stat.value}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {stat.label}
                    </p>
                  </div>
                </div>
              </NeonCard>
            </motion.div>
          ))}
        </motion.div>

        {/* ─── AUTO PROJECTS ─── */}
        <section>
          <SectionTitle
            title="АВТО ПРОЕКТЫ"
            color={YELLOW}
            action={
              <button
                onClick={() => navigate('projects')}
                className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] transition-opacity hover:opacity-80"
                style={{ color: YELLOW }}
              >
                <Plus className="h-3 w-3" /> Создать
              </button>
            }
          />
          {autoProjects.length === 0 ? (
            <EmptyState
              color={YELLOW}
              icon={Disc3}
              label="Нет связанных проектов"
              hint="создайте проект и свяжите его с канбаном"
            />
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              {autoProjects.map((project) => {
                const color = statusColors[project.status] || CYAN;
                const trackCount = getTrackCountForProject(project.id);
                return (
                  <motion.div key={project.id} variants={itemVariants}>
                    <NeonCard
                      color={color}
                      onClick={() => project.kanbanTaskId && goToKanbanProject(project.kanbanTaskId)}
                      className="overflow-hidden p-4 lg:p-5"
                    >
                      {/* left accent line in board color */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-[3px]"
                        style={{ background: color, boxShadow: `0 0 8px ${hexToRgba(color, 0.5)}` }}
                      />
                      <div className="ml-2">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <h3 className="line-clamp-1 text-sm font-semibold uppercase tracking-wide text-slate-100">
                            {project.title}
                          </h3>
                          <span
                            className="shrink-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]"
                            style={{
                              clipPath: BTN_CLIP,
                              background: hexToRgba(color, 0.15),
                              color,
                              boxShadow: `inset 0 0 0 1px ${hexToRgba(color, 0.35)}`,
                            }}
                          >
                            {typeLabels[project.type] || project.type}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Music2 className="h-3 w-3" style={{ color }} />
                            {trackCount} {pluralize(trackCount, ['трек', 'трека', 'треков'])}
                          </span>
                          <span
                            className="text-[10px] font-semibold uppercase tracking-wider"
                            style={{ color }}
                          >
                            {statusLabels[project.status] || project.status}
                          </span>
                        </div>
                      </div>
                    </NeonCard>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </section>

        {/* ─── KANBAN PROJECTS ─── */}
        <section>
          <SectionTitle
            title="КАНБАН ПРОЕКТЫ"
            color={CYAN}
            action={
              <button
                onClick={() => navigate('kanban')}
                className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] transition-opacity hover:opacity-80"
                style={{ color: CYAN }}
              >
                Все доски <ArrowRight className="h-3 w-3" />
              </button>
            }
          />
          {kanbanProjects.length === 0 ? (
            <EmptyState color={CYAN} icon={Hexagon} label="Нет канбан-проектов" />
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              {kanbanProjects.map((task) => {
                const isAuto = !!task.soundflowProjectId;
                const color = isAuto ? YELLOW : CYAN;
                const childCount = (task.children || []).length;
                const doneCount = (task.children || []).filter(
                  (c) => c.status === 'done'
                ).length;
                const pct = childCount > 0 ? Math.round((doneCount / childCount) * 100) : 0;
                return (
                  <motion.div key={task.id} variants={itemVariants}>
                    <NeonCard color={color} onClick={() => goToKanbanProject(task.id)} className="p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span
                          className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em]"
                          style={{
                            color,
                            background: hexToRgba(color, 0.12),
                            boxShadow: `inset 0 0 0 1px ${hexToRgba(color, 0.3)}`,
                          }}
                        >
                          {isAuto ? 'AUTO' : 'KANBAN'}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-slate-500">
                          {task.projectType || 'general'}
                        </span>
                      </div>
                      <h3 className="mb-2 line-clamp-2 min-h-[2.5em] text-sm font-semibold uppercase tracking-wide text-slate-100">
                        {task.title}
                      </h3>
                      <div className="mb-1.5 flex justify-between text-[10px] uppercase tracking-wider text-slate-400">
                        <span>
                          {childCount} {pluralize(childCount, ['этап', 'этапа', 'этапов'])}
                        </span>
                        <span style={{ color }}>{pct}%</span>
                      </div>
                      <div
                        className="h-1 overflow-hidden bg-slate-800"
                        style={{ clipPath: BTN_CLIP }}
                      >
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: color,
                            boxShadow: `0 0 6px ${hexToRgba(color, 0.6)}`,
                          }}
                        />
                      </div>
                    </NeonCard>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </section>

        {/* ─── MY PROJECT FOLDERS ─── */}
        <section>
          <SectionTitle title="МОИ ПАПКИ" color={YELLOW} />
          <div className="grid gap-3 sm:grid-cols-2">
            {(['album', 'ep', 'single', 'general'] as const).map((key) => {
              const list = projectsByType[key] || [];
              const color = folderColor[key];
              const isOpen = !!expandedFolders[key];
              return (
                <NeonCard key={key} color={color} className="overflow-hidden">
                  <button
                    onClick={() => toggleFolder(key)}
                    className="flex w-full items-center gap-3 p-4 text-left"
                  >
                    <Folder
                      className="h-5 w-5 shrink-0"
                      style={{
                        color,
                        filter: `drop-shadow(0 0 4px ${hexToRgba(color, 0.5)})`,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-bold uppercase tracking-[0.14em]"
                        style={{ color: '#e2e8f0' }}
                      >
                        {typeLabels[key] || key}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">
                        {list.length} {pluralize(list.length, ['проект', 'проекта', 'проектов'])}
                      </p>
                    </div>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                    )}
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && list.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t"
                        style={{ borderColor: hexToRgba(color, 0.2) }}
                      >
                        <div className="space-y-1.5 p-3">
                          {list.map((p) => {
                            const sc = statusColors[p.status] || CYAN;
                            return (
                              <button
                                key={p.id}
                                onClick={() => navigate('project-detail', p.id)}
                                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-white/5"
                                style={{ clipPath: BTN_CLIP }}
                              >
                                <span className="truncate text-slate-200">{p.title}</span>
                                <span
                                  className="shrink-0 text-[9px] uppercase tracking-wider"
                                  style={{ color: sc }}
                                >
                                  {statusLabels[p.status] || p.status}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {isOpen && list.length === 0 && (
                    <div className="px-4 pb-4 text-xs uppercase tracking-wider text-slate-600">
                      Пусто
                    </div>
                  )}
                </NeonCard>
              );
            })}
          </div>
        </section>

        {/* ─── IDEA FEED ─── */}
        <section>
          <SectionTitle
            title="ЛЕНТА ИДЕЙ"
            color={AMBER}
            action={
              <button
                onClick={() => navigate('ideas')}
                className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] transition-opacity hover:opacity-80"
                style={{ color: AMBER }}
              >
                Все идеи <ArrowRight className="h-3 w-3" />
              </button>
            }
          />
          {recentIdeas.length === 0 ? (
            <EmptyState color={AMBER} icon={Lightbulb} label="Нет идей" />
          ) : (
            <div
              className="flex gap-3 overflow-x-auto pb-3"
              style={{ scrollbarWidth: 'thin' }}
            >
              {recentIdeas.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} onClick={() => navigate('ideas')} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ─── IdeaCard: separate component for hover state ─── */
function IdeaCard({
  idea,
  onClick,
}: {
  idea: { id: string; title: string; description?: string; createdAt: string };
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-64 shrink-0 cursor-pointer p-4"
      style={{
        clipPath: CARD_CLIP,
        background: CARD_BG,
        boxShadow: `inset 0 0 0 1px ${hexToRgba(AMBER, hovered ? 0.6 : 0.3)}, 0 0 ${hovered ? 24 : 16}px ${hexToRgba(AMBER, hovered ? 0.18 : 0.06)}`,
        transition: 'box-shadow 200ms ease',
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <Lightbulb
          className="h-3.5 w-3.5"
          style={{ color: AMBER, filter: `drop-shadow(0 0 4px ${hexToRgba(AMBER, 0.6)})` }}
        />
        <span
          className="text-[9px] font-bold uppercase tracking-[0.18em]"
          style={{ color: AMBER }}
        >
          ИДЕЯ
        </span>
      </div>
      <h3 className="mb-1 line-clamp-1 text-sm font-semibold text-slate-100">{idea.title}</h3>
      {idea.description && (
        <p className="mb-2 line-clamp-2 min-h-[2em] text-xs text-slate-400">{idea.description}</p>
      )}
      <p className="text-[10px] uppercase tracking-wider text-slate-500">
        {new Date(idea.createdAt).toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'short',
        })}
      </p>
    </div>
  );
}
