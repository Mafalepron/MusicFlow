'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import {
  Lightbulb,
  Plus,
  FolderInput,
  Trash2,
  Tag,
  User,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDataStore, type Idea } from '@/lib/store';
import { CreateIdeaDialog } from '@/components/shared/create-idea-dialog';
import { MoveIdeaDialog } from '@/components/shared/move-idea-dialog';

const containerVariants: any = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

export function IdeasView() {
  const ideas = useDataStore((s) => s.ideas);
  const removeIdea = useDataStore((s) => s.removeIdea);

  const [createOpen, setCreateOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<Idea | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sortedIdeas = [...ideas].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const handleDelete = async (ideaId: string) => {
    setDeletingId(ideaId);
    try {
      const res = await fetch(`/api/ideas/${ideaId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete idea');
      }
      removeIdea(ideaId);
    } catch {
      // silently fail
    } finally {
      setDeletingId(null);
    }
  };

  const parseTags = (tags: string | undefined): string[] => {
    if (!tags) return [];
    // API stores tags as a JSON-stringified array (e.g. '["melody","upbeat"]').
    // Fall back to comma-splitting for any legacy plain-string values.
    try {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) {
        return parsed.map((t) => String(t).trim()).filter(Boolean);
      }
    } catch {
      // not JSON — treat as comma-separated string
    }
    return tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  };

  return (
    <>
      <ScrollArea className="h-full">
        <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h1 className="text-2xl font-bold text-foreground lg:text-3xl">
                Idea Bin
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Capture sparks of inspiration before they fade.
              </p>
            </div>
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New Idea
            </Button>
          </motion.div>

          {sortedIdeas.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <Card className="border-border bg-card">
                <CardContent className="flex flex-col items-center justify-center py-20">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F59E0B]/10">
                    <Lightbulb className="h-8 w-8 text-[#F59E0B]/70" />
                  </div>
                  <h3 className="text-base font-medium text-foreground">
                    No ideas yet
                  </h3>
                  <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
                    Start capturing your musical ideas. Record a melody, jot down
                    lyrics, or describe a vibe.
                  </p>
                  <Button
                    onClick={() => setCreateOpen(true)}
                    variant="outline"
                    className="mt-4 border-[#8A2BE2]/40 text-[#8A2BE2] hover:bg-[#8A2BE2]/10 hover:text-[#8A2BE2]"
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    Create First Idea
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid gap-4 sm:grid-cols-2"
            >
              {sortedIdeas.map((idea) => {
                const tags = parseTags(idea.tags);
                return (
                  <motion.div key={idea.id} variants={itemVariants}>
                    <Card className="group border-border bg-card transition-all hover:border-[#F59E0B]/25">
                      <CardContent className="space-y-3 p-4 lg:p-5">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-base font-semibold text-foreground line-clamp-1">
                            {idea.title}
                          </h3>
                          <span className="shrink-0 text-[11px] text-muted-foreground/60">
                            {formatDistanceToNow(new Date(idea.createdAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>

                        {idea.description && (
                          <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2">
                            {idea.description}
                          </p>
                        )}

                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1 rounded-md bg-[#1E1E28] px-2 py-0.5 text-[11px] text-muted-foreground"
                              >
                                <Tag className="h-2.5 w-2.5" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                            <User className="h-3 w-3" />
                            {idea.createdBy}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setMoveTarget(idea)}
                              className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:bg-[#8A2BE2]/10 hover:text-[#8A2BE2]"
                            >
                              <FolderInput className="h-3.5 w-3.5" />
                              Move to Project
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={deletingId === idea.id}
                              onClick={() => handleDelete(idea.id)}
                              className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      </ScrollArea>

      <CreateIdeaDialog open={createOpen} onOpenChange={setCreateOpen} />

      {moveTarget && (
        <MoveIdeaDialog
          ideaId={moveTarget.id}
          open={!!moveTarget}
          onOpenChange={(open) => {
            if (!open) setMoveTarget(null);
          }}
          onMove={() => {
            removeIdea(moveTarget.id);
            setMoveTarget(null);
          }}
        />
      )}
    </>
  );
}
