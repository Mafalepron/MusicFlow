'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import {
  Plus, FolderOpen, LayoutDashboard, Music2, Disc3, AudioLines, Clock,
  Search, X, Layers, Star,
} from 'lucide-react';
import { useNavigationStore, useDataStore, type Project } from '@/lib/store';
import { useKanbanStore, type Task } from '@/store/kanban-store';
import { CreateProjectDialog } from '@/components/shared/create-project-dialog';
import { hexToRgba } from '@/lib/utils';
import { useFavorites } from '@/lib/use-favorites';

const statusHex: Record<string, string> = {
  draft: '#f59e0b',
  in_progress: '#3b82f6',
  mixing: '#a855f7',
  mastering: '#00d9ff',
  released: '#10b981',
};

const statusLabels: Record<string, string> = {
  draft: 'Черновик',
  in_progress: 'В работе',
  mixing: 'Сведение',
  mastering: 'Мастеринг',
  released: 'Релиз',
};

const typeConfig: Record<string, { label: string; color: string; icon: typeof Disc3 }> = {
  album:   { label: 'Альбом',  color: '#a855f7', icon: Disc3 },
  ep:      { label: 'EP',      color: '#00d9ff', icon: AudioLines },
  single:  { label: 'Сингл',   color: '#f59e0b', icon: Music2 },
  general: { label: 'Канбан',  color: '#10b981', icon: LayoutDashboard },
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
} as const;

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
} as const;

// ── Unified card for both auto projects and kanban projects ──
// `kind` distinguishes the source so we render the right badge + open the right view.
type UnifiedCard =
  | { kind: 'auto'; project: Project; trackCount: number }
  | { kind: 'kanban'; task: Task; boardCount: number };

function ProjectCardUnified({
  data,
  onClick,
  onOpenKanban,
  isFavorite,
  onToggleFavorite,
}: {
  data: UnifiedCard;
  onClick: () => void;
  onOpenKanban: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  const [h, setH] = useState(false);

  const title = data.kind === 'auto' ? data.project.title : data.task.title;
  const projectType = data.kind === 'auto' ? data.project.type : (data.task.projectType || 'general');
  const type = typeConfig[projectType] || typeConfig.general;
  const TypeIcon = type.icon;
  const status = data.kind === 'auto' ? data.project.status : data.task.status;
  const sc = statusHex[status] || '#64748b';
  const sl = statusLabels[status] || status;
  const updatedAt = data.kind === 'auto' ? data.project.updatedAt : data.task.updatedAt;
  const metaCount = data.kind === 'auto' ? data.trackCount : data.boardCount;
  const metaLabel = data.kind === 'auto'
    ? (metaCount === 1 ? 'трек' : metaCount > 4 ? 'треков' : 'трека')
    : (metaCount === 1 ? 'board' : 'boards');
  const hasKanban = data.kind === 'auto' ? !!data.project.kanbanTaskId : true;

  return (
    <motion.div variants={cardVariants}>
      <div
        onClick={onClick}
        onMouseEnter={() => setH(true)}
        onMouseLeave={() => setH(false)}
        className="group relative cursor-pointer overflow-hidden"
        style={{
          borderRadius: '10px',
          background: h
            ? `linear-gradient(135deg, ${hexToRgba(type.color, 0.18)}, rgba(16,20,30,0.95))`
            : `linear-gradient(135deg, ${hexToRgba(type.color, 0.1)}, rgba(14,18,28,0.85))`,
          border: `1px solid ${h ? hexToRgba(type.color, 0.6) : hexToRgba(type.color, 0.3)}`,
          boxShadow: h
            ? `0 0 0 1px ${hexToRgba(type.color, 0.3)}, 0 8px 32px ${hexToRgba(type.color, 0.2)}, 0 4px 16px rgba(0,0,0,0.4)`
            : `0 0 0 1px ${hexToRgba(type.color, 0.08)}, 0 4px 12px rgba(0,0,0,0.3)`,
          transform: h ? 'translateY(-4px) scale(1.01)' : 'translateY(0)',
          transition: 'all 220ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Cover strip */}
        <div
          className="h-16 flex items-center justify-between px-4"
          style={{
            background: `linear-gradient(135deg, ${hexToRgba(type.color, h ? 0.3 : 0.18)}, ${hexToRgba(type.color, h ? 0.08 : 0.04)})`,
            borderBottom: `1px solid ${hexToRgba(type.color, 0.1)}`,
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: hexToRgba(type.color, 0.15), border: `1px solid ${hexToRgba(type.color, 0.3)}` }}
            >
              <TypeIcon className="w-4 h-4" style={{ color: type.color }} />
            </div>
            <span className="text-[11px] font-semibold" style={{ color: type.color }}>{type.label}</span>
            {/* Source badge — AUTO vs KANBAN */}
            <span
              className="ml-1 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider"
              style={{
                background: data.kind === 'auto' ? hexToRgba('#00d9ff', 0.1) : hexToRgba('#10b981', 0.1),
                color: data.kind === 'auto' ? '#00d9ff' : '#10b981',
                border: `1px solid ${data.kind === 'auto' ? hexToRgba('#00d9ff', 0.3) : hexToRgba('#10b981', 0.3)}`,
              }}
            >
              {data.kind === 'auto' ? 'AUTO' : 'KANBAN'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
              style={{ background: hexToRgba(sc, 0.12), color: sc, border: `1px solid ${hexToRgba(sc, 0.25)}` }}
            >
              {sl}
            </span>
            {/* Favorite star toggle — adds/removes from quick-access */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
              aria-label={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
              title={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
              className="flex h-7 w-7 items-center justify-center transition-all duration-200"
              style={{
                clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))',
                background: isFavorite
                  ? 'linear-gradient(135deg, #FCEE0A, #F1F100 50%, #FCEE0A)'
                  : 'rgba(10,20,35,0.6)',
                border: isFavorite
                  ? '1px solid rgba(252,238,10,0.9)'
                  : '1px solid rgba(252,238,10,0.3)',
                boxShadow: isFavorite
                  ? '0 0 10px rgba(252,238,10,0.5), inset 0 1px 0 rgba(255,255,255,0.4)'
                  : 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!isFavorite) {
                  e.currentTarget.style.borderColor = 'rgba(252,238,10,0.7)';
                  e.currentTarget.style.boxShadow = '0 0 8px rgba(252,238,10,0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isFavorite) {
                  e.currentTarget.style.borderColor = 'rgba(252,238,10,0.3)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              <Star
                className="w-3.5 h-3.5"
                style={{
                  color: isFavorite ? '#000' : 'rgba(252,238,10,0.7)',
                  fill: isFavorite ? '#000' : 'none',
                }}
              />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          <h3
            className="mb-2 text-[15px] font-semibold leading-snug transition-colors"
            style={{ color: h ? type.color : '#e2e8f0' }}
          >
            {title}
          </h3>

          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              {data.kind === 'auto' ? (
                <>
                  <Music2 className="w-3 h-3" />
                  {metaCount} {metaLabel}
                </>
              ) : (
                <>
                  <Layers className="w-3 h-3" />
                  {metaCount} {metaLabel}
                </>
              )}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
            </span>
          </div>

          {hasKanban && (
            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${hexToRgba(type.color, 0.1)}` }}>
              <button
                onClick={(e) => { e.stopPropagation(); onOpenKanban(); }}
                className="flex items-center gap-1.5 text-[11px] font-medium transition-colors"
                style={{ color: h ? '#FCEE0A' : '#00d9ff' }}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                Открыть Kanban
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

type SectionFilter = 'all' | 'auto' | 'kanban';

export function ProjectsView() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('all');
  const [kanbanProjects, setKanbanProjects] = useState<Task[]>([]);

  const navigate = useNavigationStore((s) => s.navigate);
  const projects = useDataStore((s) => s.projects);
  const tracks = useDataStore((s) => s.tracks);
  const { isFavorite, toggleFavorite } = useFavorites();

  const getTrackCount = (projectId: string) =>
    tracks.filter((t) => t.projectId === projectId).length;

  // Fetch kanban projects (top-level tasks with no parentId). These are the
  // "kanban projects" that used to live on the separate Kanban tab.
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

  // Auto projects = projects with a linked kanbanTaskId (i.e. created via the
  // "auto" flow — album/EP/single with auto-generated kanban boards).
  const autoProjects = useMemo(() => projects.filter((p) => p.kanbanTaskId), [projects]);

  // Build a unified list of cards, applying the section filter + title search.
  const cards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const out: UnifiedCard[] = [];

    if (sectionFilter === 'all' || sectionFilter === 'auto') {
      autoProjects.forEach((p) => {
        if (q && !p.title.toLowerCase().includes(q)) return;
        out.push({ kind: 'auto', project: p, trackCount: getTrackCount(p.id) });
      });
    }

    if (sectionFilter === 'all' || sectionFilter === 'kanban') {
      // Deduplicate: skip kanban tasks that are already linked to an auto project.
      const linkedKanbanIds = new Set(autoProjects.map((p) => p.kanbanTaskId));
      kanbanProjects.forEach((t) => {
        if (linkedKanbanIds.has(t.id)) return;
        if (q && !t.title.toLowerCase().includes(q)) return;
        out.push({ kind: 'kanban', task: t, boardCount: t.children?.length ?? 0 });
      });
    }

    return out;
  }, [autoProjects, kanbanProjects, sectionFilter, searchQuery, tracks, getTrackCount]);

  const handleOpenKanban = (kanbanTaskId: string) => {
    // Select the project FIRST so KanbanPage doesn't redirect to Projects
    // (KanbanPage redirects when selectedProjectId is empty).
    useKanbanStore.getState().selectProject(kanbanTaskId);
    navigate('kanban');
  };

  const sectionFilters: { value: SectionFilter; label: string; count: number }[] = [
    { value: 'all', label: 'Все', count: autoProjects.length + kanbanProjects.filter((t) => !autoProjects.some((p) => p.kanbanTaskId === t.id)).length },
    { value: 'auto', label: 'Автопроекты', count: autoProjects.length },
    { value: 'kanban', label: 'Канбан', count: kanbanProjects.filter((t) => !autoProjects.some((p) => p.kanbanTaskId === t.id)).length },
  ];

  return (
    <div className="min-h-full bg-[#06080d]">
      <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Проекты</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Автопроекты и Канбан-проекты · {cards.length} {cards.length === 1 ? 'проект' : cards.length > 4 ? 'проектов' : 'проекта'}
            </p>
          </div>
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-1.5 transition-all duration-200"
            style={{
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              padding: '8px 18px',
              color: '#000',
              background: 'linear-gradient(135deg, #FCEE0A, #F1F100 50%, #FCEE0A)',
              border: '1.5px solid rgba(252, 238, 10, 0.9)',
              clipPath: 'polygon(0 0, calc(100% - 7px) 0, 100% 7px, 100% 100%, 7px 100%, 0 calc(100% - 7px))',
              boxShadow: '0 0 14px rgba(252,238,10,0.4), 0 0 28px rgba(252,238,10,0.15), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
              cursor: 'pointer',
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
              el.style.border = '1.5px solid rgba(252, 238, 10, 0.9)';
              el.style.boxShadow = '0 0 14px rgba(252,238,10,0.4), 0 0 28px rgba(252,238,10,0.15), inset 0 1px 0 rgba(255, 255, 255, 0.4)';
              el.style.textShadow = '0 1px 0 rgba(255,255,255,0.3)';
              el.style.transform = 'translateY(0)';
            }}
          >
            <Plus className="w-3 h-3" />
            <span>Новый проект</span>
          </button>
        </div>

        {/* ── Toolbar: section filter + search ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Section filter chips */}
          <div className="flex items-center gap-1.5">
            {sectionFilters.map((f) => {
              const active = sectionFilter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setSectionFilter(f.value)}
                  className="flex items-center gap-1.5 transition-all duration-200"
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    padding: '6px 12px',
                    color: active ? '#000' : '#94a3b8',
                    background: active
                      ? 'linear-gradient(135deg, #FCEE0A, #F1F100 50%, #FCEE0A)'
                      : 'rgba(30, 35, 50, 0.6)',
                    border: active
                      ? '1px solid rgba(252, 238, 10, 0.9)'
                      : '1px solid rgba(100, 116, 139, 0.2)',
                    clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))',
                    boxShadow: active
                      ? '0 0 10px rgba(252,238,10,0.4), inset 0 1px 0 rgba(255,255,255,0.4)'
                      : 'none',
                    cursor: 'pointer',
                  }}
                >
                  {f.label}
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[8px] tabular-nums"
                    style={{
                      background: active ? 'rgba(0,0,0,0.2)' : 'rgba(100,116,139,0.15)',
                      color: active ? '#000' : '#64748b',
                    }}
                  >
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search input */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию…"
              className="w-full pl-9 pr-8 py-2 text-xs text-slate-200 bg-[#0d1117] border border-slate-700/60 rounded-md outline-none transition-colors focus:border-[#FCEE0A]/50 focus:bg-[#0d1117]"
              style={{ fontFamily: 'inherit' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center text-slate-500 hover:text-slate-300 transition-colors"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                aria-label="Очистить поиск"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Grid */}
        {cards.length > 0 ? (
          <motion.div
            key={`${sectionFilter}-${searchQuery}`}
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            {cards.map((card) => {
              const cardId = card.kind === 'auto'
                ? (card.project.kanbanTaskId || card.project.id)
                : card.task.id;
              return (
                <ProjectCardUnified
                  key={card.kind === 'auto' ? `auto-${card.project.id}` : `kanban-${card.task.id}`}
                  data={card}
                  onClick={() => {
                    if (card.kind === 'auto') {
                      navigate('project-detail', card.project.id);
                    } else {
                      // Kanban-only project — open the kanban view directly.
                      handleOpenKanban(card.task.id);
                    }
                  }}
                  onOpenKanban={() => {
                    if (card.kind === 'auto' && card.project.kanbanTaskId) {
                      handleOpenKanban(card.project.kanbanTaskId);
                    } else if (card.kind === 'kanban') {
                      handleOpenKanban(card.task.id);
                    }
                  }}
                  isFavorite={isFavorite(cardId)}
                  onToggleFavorite={() => toggleFavorite(cardId)}
                />
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center py-16"
          >
            <div
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg"
              style={{ background: 'rgba(252,238,10,0.06)', border: '1px solid rgba(252,238,10,0.15)' }}
            >
              {searchQuery ? (
                <Search className="h-6 w-6 text-slate-600" />
              ) : (
                <FolderOpen className="h-6 w-6 text-slate-600" />
              )}
            </div>
            <h3 className="mb-1 text-sm font-medium text-slate-400">
              {searchQuery ? 'Ничего не найдено' : 'Пока нет проектов'}
            </h3>
            <p className="mb-4 text-xs text-slate-600">
              {searchQuery
                ? `По запросу «${searchQuery}» ничего не найдено. Попробуйте изменить запрос.`
                : 'Создайте первый проект, чтобы начать работу'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setDialogOpen(true)}
                className="flex items-center gap-1.5 transition-all duration-200"
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  padding: '8px 18px',
                  color: '#000',
                  background: 'linear-gradient(135deg, #FCEE0A, #F1F100 50%, #FCEE0A)',
                  border: '1.5px solid rgba(252, 238, 10, 0.9)',
                  clipPath: 'polygon(0 0, calc(100% - 7px) 0, 100% 7px, 100% 100%, 7px 100%, 0 calc(100% - 7px))',
                  boxShadow: '0 0 14px rgba(252,238,10,0.4), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
                  cursor: 'pointer',
                  textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#FCEE0A';
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(252,238,10,0.6), inset 0 1px 0 rgba(255,255,255,0.4)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#000';
                  e.currentTarget.style.boxShadow = '0 0 14px rgba(252,238,10,0.4), inset 0 1px 0 rgba(255,255,255,0.4)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <Plus className="w-3 h-3" />
                <span>Создать проект</span>
              </button>
            )}
          </motion.div>
        )}
      </div>

      <CreateProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
