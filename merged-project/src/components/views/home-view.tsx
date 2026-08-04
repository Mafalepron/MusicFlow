'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FolderKanban,
  Music2,
  Lightbulb,
  Users,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuthStore, useDataStore, useNavigationStore } from '@/lib/store';

const statusColors: Record<string, string> = {
  draft: 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30',
  in_progress: 'bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30',
  mixing: 'bg-[#8A2BE2]/15 text-[#8A2BE2] border-[#8A2BE2]/30',
  mastering: 'bg-[#00E5FF]/15 text-[#00E5FF] border-[#00E5FF]/30',
  released: 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  in_progress: 'In Progress',
  mixing: 'Mixing',
  mastering: 'Mastering',
  released: 'Released',
};

const typeLabels: Record<string, string> = {
  album: 'Album',
  ep: 'EP',
  single: 'Single',
};

const containerVariants: any = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
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

  const recentProjects = useMemo(
    () =>
      [...projects]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 3),
    [projects]
  );

  const recentIdeas = useMemo(
    () =>
      [...ideas]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 4),
    [ideas]
  );

  const getTrackCountForProject = (projectId: string) =>
    tracks.filter((t) => t.projectId === projectId).length;

  // Fetch member count
  useEffect(() => {
    if (!currentGroupId) return;
    fetch(`/api/groups/${currentGroupId}/members`)
      .then((r) => r.json())
      .then((members) => setMemberCount(Array.isArray(members) ? members.length : 0))
      .catch(() => {});
  }, [currentGroupId]);

  const stats = [
    {
      label: 'Projects',
      value: projects.length,
      icon: FolderKanban,
      gradient: 'from-[#8A2BE2]/20 to-[#8A2BE2]/5',
      iconColor: 'text-[#8A2BE2]',
      glowColor: 'shadow-[0_0_20px_rgba(138,43,226,0.08)]',
    },
    {
      label: 'Tracks',
      value: tracks.length,
      icon: Music2,
      gradient: 'from-[#00E5FF]/20 to-[#00E5FF]/5',
      iconColor: 'text-[#00E5FF]',
      glowColor: 'shadow-[0_0_20px_rgba(0,229,255,0.08)]',
    },
    {
      label: 'Ideas',
      value: ideas.length,
      icon: Lightbulb,
      gradient: 'from-[#F59E0B]/20 to-[#F59E0B]/5',
      iconColor: 'text-[#F59E0B]',
      glowColor: 'shadow-[0_0_20px_rgba(245,158,11,0.08)]',
    },
    {
      label: 'Members',
      value: memberCount,
      icon: Users,
      gradient: 'from-[#10B981]/20 to-[#10B981]/5',
      iconColor: 'text-[#10B981]',
      glowColor: 'shadow-[0_0_20px_rgba(16,185,129,0.08)]',
    },
  ];

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-6xl space-y-8 p-6 lg:p-8">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-2xl font-bold text-foreground lg:text-3xl">
            Welcome back, {user?.displayName || 'Musician'}
          </h1>
          {currentGroup && (
            <p className="mt-1 text-muted-foreground">
              {currentGroup.name}
              {currentGroup.genre ? ` · ${currentGroup.genre}` : ''}
            </p>
          )}
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        >
          {stats.map((stat) => (
            <motion.div key={stat.label} variants={itemVariants}>
              <Card
                className={`relative overflow-hidden border-border bg-gradient-to-br ${stat.gradient} ${stat.glowColor}`}
              >
                <CardContent className="p-4 lg:p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background/50">
                      <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent Projects</h2>
            <button
              onClick={() => navigate('projects')}
              className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-[#00E5FF]"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {recentProjects.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderKanban className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No projects yet</p>
                <button
                  onClick={() => navigate('projects')}
                  className="mt-2 text-sm text-[#8A2BE2] hover:underline"
                >
                  Create your first project
                </button>
              </CardContent>
            </Card>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {recentProjects.map((project) => (
                <motion.div key={project.id} variants={itemVariants}>
                  <Card
                    className="group cursor-pointer border-border bg-card transition-all hover:border-[#8A2BE2]/40 hover:shadow-[0_0_24px_rgba(138,43,226,0.06)]"
                    onClick={() => navigate('project-detail', project.id)}
                  >
                    <CardContent className="p-4 lg:p-5">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-foreground group-hover:text-[#8A2BE2] transition-colors line-clamp-1">
                          {project.title}
                        </h3>
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px] uppercase tracking-wide border-[#8A2BE2]/40 text-[#8A2BE2]"
                        >
                          {typeLabels[project.type] || project.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Music2 className="h-3.5 w-3.5" />
                          {getTrackCountForProject(project.id)} tracks
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize ${statusColors[project.status] || 'border-border text-muted-foreground'}`}
                        >
                          {statusLabels[project.status] || project.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent Ideas</h2>
            <button
              onClick={() => navigate('ideas')}
              className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-[#00E5FF]"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {recentIdeas.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Lightbulb className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No ideas yet</p>
                <button
                  onClick={() => navigate('ideas')}
                  className="mt-2 text-sm text-[#F59E0B] hover:underline"
                >
                  Capture your first idea
                </button>
              </CardContent>
            </Card>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              {recentIdeas.map((idea) => (
                <motion.div key={idea.id} variants={itemVariants}>
                  <Card className="border-border bg-card transition-all hover:border-[#F59E0B]/30">
                    <CardContent className="p-4">
                      <h3 className="mb-1 text-sm font-medium text-foreground line-clamp-1">
                        {idea.title}
                      </h3>
                      {idea.description && (
                        <p className="mb-2 text-xs text-muted-foreground line-clamp-2">
                          {idea.description}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground/70">
                        {formatDate(idea.createdAt)}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </section>
      </div>
    </ScrollArea>
  );
}
