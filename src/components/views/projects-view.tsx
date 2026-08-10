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

function ProjectCard({ project, trackCount, onClick, onOpenKanban }: {
  project: Project;
  trackCount: number;
  onClick: () => void;
  onOpenKanban: () => void;
}) {
  const [h, setH] = useState(false);
  const type = typeConfig[project.type] || typeConfig.general;
  const TypeIcon = type.icon;
  const sc = statusHex[project.status] || '#64748b';
  const sl = statusLabels[project.status] || project.status;
  const hasKanban = !!project.kanbanTaskId;

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
          </div>
          <span
            className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
            style={{ background: hexToRgba(sc, 0.12), color: sc, border: `1px solid ${hexToRgba(sc, 0.25)}` }}
          >
            {sl}
          </span>
        </div>

        {/* Body */}
        <div className="p-4">
          <h3
            className="mb-2 text-[15px] font-semibold leading-snug transition-colors"
            style={{ color: h ? type.color : '#e2e8f0' }}
          >
            {project.title}
          </h3>

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
    <div className="min-h-full bg-[#06080d]">
      <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Проекты</h2>
            <p className="mt-0.5 text-sm text-slate-500">Управление альбомами, EP и синглами</p>
          </div>
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-all duration-200"
            style={{
              padding: '9px 18px',
              color: '#000',
              background: 'linear-gradient(135deg, #FCEE0A, #F1F100)',
              borderRadius: '8px',
              boxShadow: '0 0 12px rgba(252,238,10,0.35)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 18px rgba(252,238,10,0.55)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 12px rgba(252,238,10,0.35)'; e.currentTarget.style.transform = 'translateY(0)'; }}
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
            className="flex flex-col items-center justify-center py-16"
          >
            <div
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg"
              style={{ background: 'rgba(252,238,10,0.06)', border: '1px solid rgba(252,238,10,0.15)' }}
            >
              <FolderOpen className="h-6 w-6 text-slate-600" />
            </div>
            <h3 className="mb-1 text-sm font-medium text-slate-400">Пока нет проектов</h3>
            <p className="mb-4 text-xs text-slate-600">Создайте первый проект, чтобы начать работу</p>
            <button
              onClick={() => setDialogOpen(true)}
              className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-all duration-200"
              style={{
                padding: '9px 18px',
                color: '#000',
                background: 'linear-gradient(135deg, #FCEE0A, #F1F100)',
                borderRadius: '8px',
                boxShadow: '0 0 12px rgba(252,238,10,0.35)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 18px rgba(252,238,10,0.55)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 12px rgba(252,238,10,0.35)'; e.currentTarget.style.transform = 'translateY(0)'; }}
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
