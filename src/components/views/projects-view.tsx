'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { Plus, FolderOpen, LayoutDashboard, Music2, Disc3, AudioLines, Clock } from 'lucide-react';
import { useNavigationStore, useDataStore, type Project } from '@/lib/store';
import { useKanbanStore } from '@/store/kanban-store';
import { CreateProjectDialog } from '@/components/shared/create-project-dialog';
import { hexToRgba } from '@/lib/utils';

const statusHex: Record<string, string> = {
  draft: '#f59e0b',
  in_progress: '#3b82f6',
  mixing: '#a855f7',
  mastering: '#00d9ff',
  released: '#10b981',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  in_progress: 'In Progress',
  mixing: 'Mixing',
  mastering: 'Mastering',
  released: 'Released',
};

const typeConfig: Record<string, { label: string; color: string; icon: typeof Disc3 }> = {
  album: { label: 'Альбом', color: '#a855f7', icon: Disc3 },
  ep: { label: 'EP', color: '#00d9ff', icon: AudioLines },
  single: { label: 'Сингл', color: '#f59e0b', icon: Music2 },
  general: { label: 'Канбан', color: '#10b981', icon: LayoutDashboard },
};

const CARD_CLIP = 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))';
const BADGE_CLIP = 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
} as const;

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
} as const;

function ProjectCard({ project, trackCount, onClick, onOpenKanban }: {
  project: Project;
  trackCount: number;
  onClick: () => void;
  onOpenKanban: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const type = typeConfig[project.type] || typeConfig.general;
  const TypeIcon = type.icon;
  const stHex = statusHex[project.status] || '#64748b';
  const stLabel = statusLabels[project.status] || project.status;
  const hasKanban = !!project.kanbanTaskId;

  return (
    <motion.div variants={cardVariants}>
      <div
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative cursor-pointer transition-all duration-200"
        style={{
          background: hovered
            ? `linear-gradient(135deg, ${hexToRgba(type.color, 0.12)}, rgba(8, 12, 22, 0.95))`
            : `linear-gradient(135deg, ${hexToRgba(type.color, 0.06)}, rgba(8, 12, 22, 0.92))`,
          clipPath: CARD_CLIP,
          boxShadow: hovered
            ? `0 0 0 1px ${hexToRgba(type.color, 0.5)}, 0 0 28px ${hexToRgba(type.color, 0.15)}, 0 4px 16px rgba(0,0,0,0.4)`
            : `0 0 0 1px ${hexToRgba(type.color, 0.2)}, 0 2px 8px rgba(0,0,0,0.3)`,
          transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        }}
      >
        {/* Top accent bar */}
        <div
          className="h-[3px] w-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${type.color} 30%, ${type.color} 70%, transparent)`,
            boxShadow: `0 0 8px ${hexToRgba(type.color, 0.5)}`,
          }}
        />

        <div className="p-5">
          {/* Type icon + badge row */}
          <div className="mb-4 flex items-center justify-between">
            <div
              className="flex items-center gap-2 px-2.5 py-1"
              style={{
                background: hexToRgba(type.color, 0.12),
                boxShadow: `inset 0 0 0 1px ${hexToRgba(type.color, 0.3)}`,
                clipPath: BADGE_CLIP,
              }}
            >
              <TypeIcon className="w-3 h-3" style={{ color: type.color }} />
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: type.color }}>
                {type.label}
              </span>
            </div>

            {/* Status dot */}
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: stHex,
                  boxShadow: `0 0 6px ${hexToRgba(stHex, 0.6)}`,
                }}
              />
              <span className="text-[10px] font-medium" style={{ color: stHex }}>
                {stLabel}
              </span>
            </div>
          </div>

          {/* Title */}
          <h3
            className="mb-3 text-base font-bold transition-colors"
            style={{
              color: hovered ? type.color : '#e2e8f0',
              textShadow: hovered ? `0 0 8px ${hexToRgba(type.color, 0.3)}` : 'none',
            }}
          >
            {project.title}
          </h3>

          {/* Track count + updated */}
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <Music2 className="w-3 h-3" />
              {trackCount} {trackCount === 1 ? 'трек' : trackCount > 4 ? 'треков' : 'трека'}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
            </span>
          </div>

          {/* Kanban link */}
          {hasKanban && (
            <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${hexToRgba(type.color, 0.15)}` }}>
              <button
                onClick={(e) => { e.stopPropagation(); onOpenKanban(); }}
                className="flex items-center gap-1.5 text-[11px] font-medium transition-all"
                style={{
                  color: hovered ? '#FCEE0A' : '#00d9ff',
                  textShadow: hovered ? '0 0 6px rgba(252,238,10,0.3)' : 'none',
                }}
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

export function ProjectsView() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigationStore((s) => s.navigate);
  const projects = useDataStore((s) => s.projects);
  const tracks = useDataStore((s) => s.tracks);

  const getTrackCount = (projectId: string) =>
    tracks.filter((t) => t.projectId === projectId).length;

  const handleOpenKanban = (kanbanTaskId: string) => {
    navigate('kanban');
    setTimeout(() => {
      useKanbanStore.getState().selectProject(kanbanTaskId);
    }, 300);
  };

  return (
    <div className="min-h-full" style={{ background: '#05080f' }}>
      <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-widest" style={{ color: '#FCEE0A', textShadow: '0 0 8px rgba(252,238,10,0.3)' }}>
              Проекты
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Управление альбомами, EP и синглами
            </p>
          </div>
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-all duration-200"
            style={{
              padding: '9px 20px',
              color: '#000',
              background: 'linear-gradient(135deg, #FCEE0A, #F1F100)',
              border: '1.5px solid rgba(252,238,10,0.9)',
              clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))',
              boxShadow: '0 0 14px rgba(252,238,10,0.4), inset 0 1px 0 rgba(255,255,255,0.4)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 0 20px rgba(252,238,10,0.6), 0 0 32px rgba(252,238,10,0.2)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 0 14px rgba(252,238,10,0.4), inset 0 1px 0 rgba(255,255,255,0.4)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Новый проект
          </button>
        </div>

        {/* Grid */}
        {projects.length > 0 ? (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                trackCount={getTrackCount(project.id)}
                onClick={() => navigate('project-detail', project.id)}
                onOpenKanban={() => project.kanbanTaskId && handleOpenKanban(project.kanbanTaskId)}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center px-6 py-20"
            style={{
              border: '1.5px dashed rgba(252,238,10,0.15)',
              clipPath: CARD_CLIP,
              background: 'rgba(8,12,22,0.6)',
            }}
          >
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center"
              style={{
                background: 'rgba(252,238,10,0.06)',
                boxShadow: 'inset 0 0 0 1px rgba(252,238,10,0.2)',
                clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
              }}
            >
              <FolderOpen className="h-7 w-7" style={{ color: '#FCEE0A', opacity: 0.5 }} />
            </div>
            <h3 className="mb-1 text-base font-bold text-slate-300">
              Пока нет проектов
            </h3>
            <p className="mb-6 text-sm text-slate-600">
              Создайте первый проект, чтобы начать работу
            </p>
            <button
              onClick={() => setDialogOpen(true)}
              className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-all duration-200"
              style={{
                padding: '9px 20px',
                color: '#000',
                background: 'linear-gradient(135deg, #FCEE0A, #F1F100)',
                clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))',
                boxShadow: '0 0 12px rgba(252,238,10,0.3)',
                cursor: 'pointer',
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              Создать проект
            </button>
          </motion.div>
        )}
      </div>

      <CreateProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
