'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { Plus, FolderOpen, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigationStore, useDataStore } from '@/lib/store';
import { useKanbanStore } from '@/store/kanban-store';
import { CreateProjectDialog } from '@/components/shared/create-project-dialog';

const statusColors: Record<string, string> = {
  draft: '#F59E0B',
  in_progress: '#3B82F6',
  mixing: '#8A2BE2',
  mastering: '#00E5FF',
  released: '#10B981',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  in_progress: 'In Progress',
  mixing: 'Mixing',
  mastering: 'Mastering',
  released: 'Released',
};

const typeBadgeColors: Record<string, string> = {
  album: 'bg-[#8A2BE2]/20 text-[#8A2BE2]',
  ep: 'bg-[#00E5FF]/20 text-[#00E5FF]',
  single: 'bg-[#F59E0B]/20 text-[#F59E0B]',
};

const containerVariants: any = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const cardVariants: any = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export function ProjectsView() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigationStore((s) => s.navigate);
  const projects = useDataStore((s) => s.projects);
  const tracks = useDataStore((s) => s.tracks);

  const getTrackCount = (projectId: string) => {
    return tracks.filter((t) => t.projectId === projectId).length;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          <p className="mt-1 text-sm text-[#A0A0B0]">
            Manage your albums, EPs, and singles
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
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
            <motion.div key={project.id} variants={cardVariants}>
              <Card
                className="group cursor-pointer border-[#25252D] bg-[#15151A] transition-colors hover:border-[#8A2BE2]/40 hover:bg-[#1A1A22]"
              >
                <CardContent className="p-5" onClick={() => navigate('project-detail', project.id)}>
                  {/* Type badge */}
                  <div className="mb-3 flex items-center justify-between">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
                        typeBadgeColors[project.type] || 'bg-[#8A2BE2]/20 text-[#8A2BE2]'
                      }`}
                    >
                      {project.type}
                    </span>
                    <Badge
                      variant="outline"
                      className="border-transparent text-xs"
                      style={{
                        color: statusColors[project.status] || '#A0A0B0',
                        backgroundColor: `${statusColors[project.status] || '#A0A0B0'}15`,
                      }}
                    >
                      {statusLabels[project.status] || project.status}
                    </Badge>
                  </div>

                  {/* Title */}
                  <h3 className="mb-2 text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                    {project.title}
                  </h3>

                  {/* Track count + last updated */}
                  <div className="flex items-center justify-between text-xs text-[#A0A0B0]">
                    <span>
                      {getTrackCount(project.id)}{' '}
                      {getTrackCount(project.id) === 1 ? 'track' : 'tracks'}
                    </span>
                    <span>
                      Updated{' '}
                      {formatDistanceToNow(new Date(project.updatedAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </CardContent>

                {/* Open in Kanban button */}
                {project.kanbanTaskId && (
                  <div className="border-t border-[#25252D] px-5 py-2.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('kanban');
                        setTimeout(() => {
                          useKanbanStore.getState().selectProject(project.kanbanTaskId!);
                        }, 300);
                      }}
                      className="flex items-center gap-1.5 text-xs text-[#00E5FF] hover:text-[#00E5FF]/80 transition-colors"
                    >
                      <LayoutDashboard className="h-3.5 w-3.5" />
                      Open Kanban workspace
                    </button>
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#25252D] bg-[#15151A] px-6 py-20"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1E1E28]">
            <FolderOpen className="h-8 w-8 text-[#A0A0B0]" />
          </div>
          <h3 className="mb-1 text-base font-semibold text-foreground">
            No projects yet
          </h3>
          <p className="mb-6 text-sm text-[#A0A0B0]">
            Create your first project to get started
          </p>
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Project
          </Button>
        </motion.div>
      )}

      <CreateProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
