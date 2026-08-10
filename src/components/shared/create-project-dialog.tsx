'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Disc3, AudioLines, Zap } from 'lucide-react';
import { useAuthStore, useDataStore, useNavigationStore, type Project } from '@/lib/store';
import { useKanbanStore } from '@/store/kanban-store';
import { cn } from '@/lib/utils';

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeInfo: Record<string, { boards: string; icon: typeof Disc3; color: string }> = {
  album: { boards: '7 auto-boards: Tracks, Design, Distribution, Marketing, Mixing, Mastering, References', icon: Disc3, color: 'text-[#8A2BE2]' },
  ep: { boards: '7 auto-boards: Tracks, Design, Distribution, Marketing, Mixing, Mastering, References', icon: Disc3, color: 'text-[#00E5FF]' },
  single: { boards: '4 auto-boards: Track, Cover, Publication, Promotion', icon: AudioLines, color: 'text-[#F59E0B]' },
};

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('album');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoOpenKanban, setAutoOpenKanban] = useState(true);
  const currentGroupId = useAuthStore((s) => s.currentGroupId);
  const addProject = useDataStore((s) => s.addProject);
  const navigate = useNavigationStore((s) => s.navigate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !currentGroupId) return;

    setLoading(true);
    setError('');

    if (!currentGroupId) {
      setError('No group selected. Please join or create a group first.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), type, groupId: currentGroupId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const errMsg = data.error || 'Failed to create project';
        const details = data.details
          ? Object.entries(data.details).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`).join('; ')
          : '';
        throw new Error(details ? `${errMsg} (${details})` : errMsg);
      }

      const project: Project = await res.json();
      addProject(project);
      setTitle('');
      setType('album');
      onOpenChange(false);

      // Auto-open the kanban workspace for this project
      if (autoOpenKanban && project.kanbanTaskId) {
        // Switch to kanban view and select the project's kanban task
        navigate('kanban');
        // Use a small delay to let the kanban view mount before selecting
        setTimeout(() => {
          useKanbanStore.getState().selectProject(project.kanbanTaskId!);
        }, 300);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const info = typeInfo[type];
  const Icon = info.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Create New Project</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Start a new music project. Album, EP, and Single types automatically create a Kanban workspace with production boards.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-title">Title</Label>
            <Input
              id="project-title"
              placeholder="Enter project title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="bg-input border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-type">Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['album', 'ep', 'single'] as const).map((t) => {
                const TIcon = typeInfo[t].icon;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all',
                      type === t
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-input hover:border-primary/40'
                    )}
                  >
                    <TIcon className={cn('h-5 w-5', type === t ? 'text-primary' : typeInfo[t].color)} />
                    <span className={cn('text-xs font-medium capitalize', type === t ? 'text-primary' : 'text-muted-foreground')}>
                      {t}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Autoboards info banner */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-start gap-2.5">
            <Icon className={cn('h-4 w-4 flex-shrink-0 mt-0.5', info.color)} />
            <div className="flex-1">
              <p className="text-xs font-medium text-foreground capitalize">{type} project</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                {info.boards}
              </p>
            </div>
          </div>

          {/* Auto-open kanban toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoOpenKanban}
              onChange={(e) => setAutoOpenKanban(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm text-muted-foreground">
              Open Kanban workspace after creation
            </span>
          </label>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="hover:bg-[#1E1E28] text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !title.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {loading ? 'Creating...' : 'Create & Open Kanban'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
