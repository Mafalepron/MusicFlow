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
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore, useDataStore, type Idea } from '@/lib/store';

interface CreateIdeaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateIdeaDialog({ open, onOpenChange }: CreateIdeaDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const user = useAuthStore((s) => s.user);
  const currentGroupId = useAuthStore((s) => s.currentGroupId);
  const addIdea = useDataStore((s) => s.addIdea);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !currentGroupId || !user) return;

    setLoading(true);
    setError('');

    try {
      const tagList = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          tags: tagList.length > 0 ? tagList : undefined,
          groupId: currentGroupId,
          userId: user.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create idea');
      }

      const idea: Idea = await res.json();
      addIdea(idea);
      setTitle('');
      setDescription('');
      setTags('');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">New Idea</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Capture a new idea before it escapes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="idea-title">Title</Label>
            <Input
              id="idea-title"
              placeholder="Give your idea a name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="bg-input border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="idea-desc">Description</Label>
            <Textarea
              id="idea-desc"
              placeholder="Describe your idea..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="bg-input border-border resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="idea-tags">Tags (comma separated)</Label>
            <Input
              id="idea-tags"
              placeholder="e.g. melody, upbeat, chorus"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="bg-input border-border"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

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
              {loading ? 'Saving...' : 'Save Idea'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
