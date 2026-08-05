'use client';

import { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Music, Upload, Loader2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNavigationStore, useDataStore, useAuthStore } from '@/lib/store';

const statusColors: Record<string, string> = {
  draft: '#F59E0B',
  in_progress: '#3B82F6',
  mixing: '#8A2BE2',
  mastering: '#00E5FF',
  released: '#10B981',
  recording: '#F472B6',
  review: '#FB923C',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  in_progress: 'In Progress',
  mixing: 'Mixing',
  mastering: 'Mastering',
  released: 'Released',
  recording: 'Recording',
  review: 'Review',
};

const typeBadgeColors: Record<string, string> = {
  album: 'bg-[#8A2BE2]/20 text-[#8A2BE2]',
  ep: 'bg-[#00E5FF]/20 text-[#00E5FF]',
  single: 'bg-[#F59E0B]/20 text-[#F59E0B]',
};

function formatDuration(ms?: number | null): string {
  if (!ms) return '--:--';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const listVariants: any = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const rowVariants: any = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

export function ProjectDetailView() {
  const selectedProjectId = useNavigationStore((s) => s.selectedProjectId);
  const navigate = useNavigationStore((s) => s.navigate);
  const projects = useDataStore((s) => s.projects);
  const tracks = useDataStore((s) => s.tracks);
  const addTrack = useDataStore((s) => s.addTrack);
  const user = useAuthStore((s) => s.user);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [trackTitle, setTrackTitle] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [addError, setAddError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const project = useMemo(
    () => projects.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId]
  );

  const projectTracks = useMemo(
    () =>
      tracks
        .filter((t) => t.projectId === selectedProjectId)
        .sort((a, b) => (a.trackNumber ?? 999) - (b.trackNumber ?? 999)),
    [tracks, selectedProjectId]
  );

  const handleStatusChange = async (newStatus: string) => {
    if (!project) return;
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update status');
      }
      const updated = await res.json();
      // Update the project in the store by refreshing projects
      const currentProjects = useDataStore.getState().projects;
      useDataStore.getState().setProjects(
        currentProjects.map((p) =>
          p.id === project.id ? { ...p, status: updated.status, updatedAt: updated.updatedAt } : p
        )
      );
    } catch (err) {
      // Silently fail for now — could add toast notification
      console.error('Failed to update project status:', err);
    }
  };

  const handleAddTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackTitle.trim() || !selectedProjectId || !user) return;

    setUploading(true);
    setAddError('');
    setUploadProgress(0);

    try {
      let res: Response;

      if (audioFile) {
        const formData = new FormData();
        formData.append('title', trackTitle.trim());
        formData.append('projectId', selectedProjectId);
        formData.append('createdBy', user.id);
        formData.append('audio', audioFile);

        // Simulate progress for file upload
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + Math.random() * 15, 90));
        }, 200);

        res = await fetch('/api/tracks', {
          method: 'POST',
          body: formData,
        });

        clearInterval(progressInterval);
        setUploadProgress(100);
      } else {
        res = await fetch('/api/tracks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: trackTitle.trim(),
            projectId: selectedProjectId,
            createdBy: user.id,
          }),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create track');
      }

      const track = await res.json();
      addTrack(track);
      setTrackTitle('');
      setAudioFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setAddDialogOpen(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-20">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1E1E28]">
          <Music className="h-8 w-8 text-[#A0A0B0]" />
        </div>
        <h3 className="mb-1 text-base font-semibold text-foreground">Project not found</h3>
        <p className="mb-6 text-sm text-[#A0A0B0]">
          This project may have been deleted or doesn&apos;t exist.
        </p>
        <Button
          onClick={() => navigate('projects')}
          variant="ghost"
          className="text-[#A0A0B0] hover:text-foreground hover:bg-[#1E1E28]"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Project Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <button
          onClick={() => navigate('projects')}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[#A0A0B0] transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{project.title}</h1>
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
                typeBadgeColors[project.type] || 'bg-[#8A2BE2]/20 text-[#8A2BE2]'
              }`}
            >
              {project.type}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Select
              value={project.status}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger className="w-[160px] bg-[#15151A] border-[#25252D] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#15151A] border-[#25252D]">
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="recording">Recording</SelectItem>
                <SelectItem value="mixing">Mixing</SelectItem>
                <SelectItem value="mastering">Mastering</SelectItem>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="released">Released</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </motion.div>

      {/* Status Badge Bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="flex items-center justify-between"
      >
        <Badge
          variant="outline"
          className="border-transparent text-xs font-medium"
          style={{
            color: statusColors[project.status] || '#A0A0B0',
            backgroundColor: `${statusColors[project.status] || '#A0A0B0'}15`,
          }}
        >
          {statusLabels[project.status] || project.status}
        </Badge>
        <span className="text-xs text-[#A0A0B0]">
          {projectTracks.length} {projectTracks.length === 1 ? 'track' : 'tracks'}
        </span>
      </motion.div>

      {/* Tracks Section */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Tracks</h2>
          <Button
            onClick={() => setAddDialogOpen(true)}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Track
          </Button>
        </div>

        {projectTracks.length > 0 ? (
          <motion.div
            variants={listVariants}
            initial="hidden"
            animate="show"
            className="space-y-2"
          >
            {projectTracks.map((track, index) => (
              <motion.div key={track.id} variants={rowVariants}>
                <Card
                  className="cursor-pointer border-[#25252D] bg-[#15151A] transition-colors hover:border-[#8A2BE2]/30 hover:bg-[#1A1A22]"
                  onClick={() => navigate('track-detail', selectedProjectId!, track.id)}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    {/* Track Number */}
                    <span className="w-8 text-center text-sm font-medium text-[#A0A0B0]">
                      {String(index + 1).padStart(2, '0')}
                    </span>

                    {/* Title + Info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {track.title}
                      </p>
                      <p className="text-xs text-[#A0A0B0]">by {track.createdBy}</p>
                    </div>

                    {/* Status */}
                    <Badge
                      variant="outline"
                      className="hidden border-transparent text-xs sm:inline-flex"
                      style={{
                        color: statusColors[track.status] || '#A0A0B0',
                        backgroundColor: `${statusColors[track.status] || '#A0A0B0'}15`,
                      }}
                    >
                      {statusLabels[track.status] || track.status}
                    </Badge>

                    {/* Duration */}
                    <span className="hidden text-xs text-[#A0A0B0] md:block w-12 text-right">
                      {formatDuration(track.durationMs)}
                    </span>

                    {/* Version */}
                    <span className="hidden text-xs text-[#A0A0B0] lg:block">
                      v{track.version}
                    </span>

                    {/* Chevron indicator */}
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#A0A0B0]/60" />
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#25252D] bg-[#15151A] px-6 py-16"
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1E1E28]">
              <Music className="h-7 w-7 text-[#A0A0B0]" />
            </div>
            <h3 className="mb-1 text-base font-semibold text-foreground">
              No tracks yet
            </h3>
            <p className="mb-6 text-sm text-[#A0A0B0]">
              Add your first track to this project
            </p>
            <Button
              onClick={() => setAddDialogOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Track
            </Button>
          </motion.div>
        )}
      </div>

      {/* Add Track Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="bg-[#15151A] border-[#25252D] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add New Track</DialogTitle>
            <DialogDescription className="text-[#A0A0B0]">
              Add a track to this project. You can upload audio now or add it later.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddTrack} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="track-title">Track Title</Label>
              <Input
                id="track-title"
                placeholder="Enter track title"
                value={trackTitle}
                onChange={(e) => setTrackTitle(e.target.value)}
                required
                className="bg-[#0B0B0F] border-[#25252D] text-foreground placeholder:text-[#A0A0B0]/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="audio-file">Audio File (optional)</Label>
              <div className="relative">
                <Input
                  id="audio-file"
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setAudioFile(file);
                  }}
                  className="bg-[#0B0B0F] border-[#25252D] text-[#A0A0B0] file:text-primary file:bg-primary/10 file:border-0 file:rounded-md file:px-3 file:py-1 file:mr-3 file:text-xs file:font-medium"
                />
              </div>
              {audioFile && (
                <p className="text-xs text-[#A0A0B0]">
                  Selected: {audioFile.name} ({(audioFile.size / (1024 * 1024)).toFixed(1)} MB)
                </p>
              )}
            </div>

            {/* Upload progress */}
            <AnimatePresence>
              {uploading && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between text-xs text-[#A0A0B0]">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Uploading...
                    </span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-1.5 bg-[#25252D]" />
                </motion.div>
              )}
            </AnimatePresence>

            {addError && (
              <p className="text-sm text-red-400">{addError}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAddDialogOpen(false)}
                disabled={uploading}
                className="text-[#A0A0B0] hover:text-foreground hover:bg-[#1E1E28]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={uploading || !trackTitle.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Track
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
