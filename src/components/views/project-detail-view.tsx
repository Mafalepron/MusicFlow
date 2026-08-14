'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Music, Upload, Loader2, ChevronRight, LayoutDashboard } from 'lucide-react';
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
import { useKanbanStore } from '@/store/kanban-store';
import { useHeaderActionsStore } from '@/store/header-actions-store';
import { hexToRgba } from '@/lib/utils';

/* ─── Cyberpunk 2077 HUD palette (mirrors home-view.tsx) ─── */
const Y = '#c7a008'; // industrial desaturated gold
const C = '#00a8c6'; // controlled cyan
const P = '#7b2cbf'; // deep violet
const A = '#718096'; // muted grey
const G = '#4a8d6f'; // muted green
const BG_MAIN = '#0a0c10';
const BG_PANEL = '#11141d';
const BG_CARD_PURPLE = '#161224';
const BG_CARD_TEAL = '#0e1a24';
const BORDER_MUTED = '#1f2633';
const TEXT_PRIMARY = '#e2e8f0';
const TEXT_SECONDARY = '#718096';

/* Status colors — muted HUD palette (draft/in_progress=C, mixing=P, mastering=G, released=C) */
const statusColors: Record<string, string> = {
  draft: C,
  in_progress: C,
  mixing: P,
  mastering: G,
  released: C,
  recording: P,
  review: Y,
};

/* Russian labels for project status */
const statusLabels: Record<string, string> = {
  draft: 'Черновик',
  in_progress: 'В работе',
  mixing: 'Сведение',
  mastering: 'Мастеринг',
  released: 'Релиз',
  recording: 'Запись',
  review: 'Проверка',
};

const typeLabels: Record<string, string> = {
  album: 'Альбом',
  ep: 'EP',
  single: 'Сингл',
  general: 'Канбан',
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

/* Shared chamfer clip-paths (mirrors home-view.tsx bevel language) */
const CHAMFER_8 = 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))';
const CHAMFER_5 = 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))';
const CHAMFER_4 = 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))';
const CHAMFER_3 = 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))';
const CHAMFER_PANEL = 'polygon(0 5px, 5px 0, calc(100% - 5px) 0, 100% 5px, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 calc(100% - 5px), 0 5px)';

/* Panel border style — same as StatBar / Quick Access panel in home-view.tsx */
const PANEL_BORDER_STYLE: React.CSSProperties = {
  border: `1px solid ${hexToRgba(C, 0.4)}`,
  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.06), inset 0 -1px 1px rgba(0,0,0,0.8)',
  background: `linear-gradient(135deg, ${BG_PANEL} 0%, ${BG_MAIN} 100%)`,
};

/* Yellow CREATE-style button (mirrors CreateCard core — gold gradient, dark text, chamfered) */
const YELLOW_BUTTON_STYLE: React.CSSProperties = {
  color: '#0a0b10',
  background: `linear-gradient(135deg, ${Y} 0%, #9e7c06 50%, ${Y} 100%)`,
  fontFamily: 'var(--font-jetbrains-mono), monospace',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  clipPath: CHAMFER_4,
  boxShadow: `0 0 8px ${hexToRgba(Y, 0.3)}, inset 0 1px 0 rgba(255,255,255,0.25)`,
};

/* Yellow tag/badge chip (chamfered, transparent yellow tint, yellow text) */
const YELLOW_CHIP_STYLE: React.CSSProperties = {
  color: Y,
  fontFamily: 'var(--font-jetbrains-mono), monospace',
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '1px',
  textTransform: 'uppercase',
  clipPath: CHAMFER_3,
  background: hexToRgba(Y, 0.1),
  border: `0.5px solid ${hexToRgba(Y, 0.3)}`,
};

/* Cyan-bordered dark HUD input style */
const HUD_INPUT_STYLE: React.CSSProperties = {
  background: BG_MAIN,
  border: `1px solid ${hexToRgba(C, 0.3)}`,
  color: TEXT_PRIMARY,
  fontFamily: 'var(--font-jetbrains-mono), monospace',
  fontSize: '13px',
  clipPath: CHAMFER_3,
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

  // Register contextual header actions (Open Kanban)
  const setHeaderActions = useHeaderActionsStore((s) => s.setActions);
  const setHeaderTitle = useHeaderActionsStore((s) => s.setTitle);
  useEffect(() => {
    const actions: { id: string; label: string; icon: React.ReactNode; onClick: () => void; variant?: 'default' | 'outline' | 'ghost'; className?: string }[] = [];
    if (project?.kanbanTaskId) {
      actions.push({
        id: 'open-kanban',
        label: 'Kanban',
        icon: <LayoutDashboard className="h-3.5 w-3.5" />,
        onClick: () => {
          // Select the project FIRST so KanbanPage doesn't redirect.
          useKanbanStore.getState().selectProject(project.kanbanTaskId!);
          navigate('kanban');
        },
        variant: 'outline',
        className: 'border-[#00a8c6]/30 text-[#00a8c6] hover:bg-[#00a8c6]/10 hover:text-[#00a8c6]',
      });
    }
    setHeaderActions(actions);
    setHeaderTitle(project?.title || null);
    return () => { setHeaderActions([]); setHeaderTitle(null); };
  }, [project, setHeaderActions, setHeaderTitle, navigate]);

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

  // Focus a specific track in the Kanban workspace.
  // Navigates to kanban, selects the project, then focuses the track task.
  const focusTrackInKanban = async (trackKanbanTaskId: string, projectKanbanTaskId?: string | null) => {
    if (!projectKanbanTaskId) return;

    // Pre-load the kanban projects list so the store has soundflowProjectId
    // available for the TaskDetailPanel's "Open in Audio Editor" button.
    try {
      const projectsRes = await fetch('/api/tasks?parentId=null');
      const projectsData = await projectsRes.json();
      if (projectsData.tasks) {
        useKanbanStore.getState().setProjects(projectsData.tasks);
      }
    } catch { /* ignore — will still work without preloaded projects */ }

    // Select the project FIRST so KanbanPage doesn't redirect to Projects.
    // KanbanWorkspace.loadBoards will fetch boards asynchronously.
    useKanbanStore.getState().selectProject(projectKanbanTaskId);
    navigate('kanban');

    // After boards load (~600ms), dismiss any onboarding and select the tracks board.
    setTimeout(() => {
      const store = useKanbanStore.getState();
      store.dismissOnboarding();
      const tracksBoard = store.boards.find((b) => b.boardType === 'tracks');
      if (tracksBoard) {
        store.setSelectedBoardId(tracksBoard.id);
        // After tasks load (~400ms more), select the specific track task.
        setTimeout(() => {
          useKanbanStore.getState().setSelectedTaskId(trackKanbanTaskId);
        }, 400);
      }
    }, 600);
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

  /* ── "Project not found" empty state — chamfered dark HUD panel with yellow icon ── */
  if (!project) {
    return (
      <div
        className="flex flex-col items-center justify-center px-6 py-20"
        style={{ background: BG_MAIN, minHeight: '100%' }}
      >
        <div
          className="relative mb-4 flex h-16 w-16 items-center justify-center overflow-hidden"
          style={{
            clipPath: CHAMFER_8,
            ...PANEL_BORDER_STYLE,
          }}
        >
          <Music
            className="h-7 w-7"
            style={{ color: Y, filter: `drop-shadow(0 0 4px ${hexToRgba(Y, 0.5)})` }}
          />
          {/* Blue corner bracket (top-left) */}
          <div className="absolute top-0 left-0 w-2 h-2 pointer-events-none" style={{
            borderTop: '1.5px solid rgba(0,168,198,0.6)',
            borderLeft: '1.5px solid rgba(0,168,198,0.6)',
          }} />
          {/* Yellow corner bracket (bottom-right) */}
          <div className="absolute bottom-0 right-0 w-2 h-2 pointer-events-none" style={{
            borderBottom: '1.5px solid rgba(199,160,8,0.6)',
            borderRight: '1.5px solid rgba(199,160,8,0.6)',
          }} />
        </div>
        <h3
          className="mb-1 text-base font-bold uppercase"
          style={{
            color: TEXT_PRIMARY,
            fontFamily: 'var(--font-rajdhani), sans-serif',
            letterSpacing: '2px',
          }}
        >
          Проект не найден
        </h3>
        <p className="mb-6 text-sm" style={{ color: TEXT_SECONDARY }}>
          Этот проект, возможно, был удалён или не существует.
        </p>
        <Button
          onClick={() => navigate('projects')}
          variant="ghost"
          className="hover:bg-transparent"
          style={{
            ...YELLOW_CHIP_STYLE,
            fontSize: '11px',
            padding: '8px 14px',
            clipPath: CHAMFER_4,
          }}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          К проектам
        </Button>
      </div>
    );
  }

  const projectStatusColor = statusColors[project.status] || A;

  return (
    <div className="space-y-6 p-6" style={{ background: BG_MAIN, minHeight: '100%' }}>
      {/* ─── Project Header — chamfered panel with blue/yellow corner brackets ─── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden"
        style={{
          clipPath: CHAMFER_PANEL,
          ...PANEL_BORDER_STYLE,
          padding: '20px 22px',
        }}
      >
        {/* Blue corner bracket (top-left) */}
        <div className="absolute top-0 left-0 w-3 h-3 pointer-events-none" style={{
          borderTop: '1.5px solid rgba(0,168,198,0.6)',
          borderLeft: '1.5px solid rgba(0,168,198,0.6)',
        }} />
        {/* Yellow corner bracket (bottom-right) */}
        <div className="absolute bottom-0 right-0 w-3 h-3 pointer-events-none" style={{
          borderBottom: '1.5px solid rgba(199,160,8,0.6)',
          borderRight: '1.5px solid rgba(199,160,8,0.6)',
        }} />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between relative" style={{ zIndex: 2 }}>
          <div className="flex items-center gap-3 min-w-0">
            <h1
              className="truncate text-2xl font-bold"
              style={{
                color: TEXT_PRIMARY,
                fontFamily: 'var(--font-rajdhani), sans-serif',
                letterSpacing: '0.5px',
                textShadow: `0 0 8px ${hexToRgba(projectStatusColor, 0.3)}`,
              }}
            >
              {project.title}
            </h1>
            {/* Type badge — yellow tint chip, chamfered */}
            <span
              className="inline-flex items-center shrink-0 uppercase"
              style={{
                ...YELLOW_CHIP_STYLE,
                padding: '3px 8px',
                letterSpacing: '1.5px',
                fontSize: '10px',
                textShadow: `0 0 4px ${hexToRgba(Y, 0.4)}`,
              }}
            >
              {typeLabels[project.type] || project.type}
            </span>
          </div>

          {/* Status select — HUD dark style with cyan border */}
          <div className="flex items-center gap-3">
            <Select
              value={project.status}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger
                className="w-[180px] border-0 rounded-none data-[size=default]:h-9"
                style={{
                  background: BG_PANEL,
                  border: `1px solid ${hexToRgba(C, 0.4)}`,
                  color: TEXT_PRIMARY,
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  clipPath: CHAMFER_3,
                }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                className="border-0 rounded-none"
                style={{
                  background: BG_PANEL,
                  border: `1px solid ${hexToRgba(C, 0.5)}`,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                }}
              >
                <SelectItem value="draft">Черновик</SelectItem>
                <SelectItem value="in_progress">В работе</SelectItem>
                <SelectItem value="recording">Запись</SelectItem>
                <SelectItem value="mixing">Сведение</SelectItem>
                <SelectItem value="mastering">Мастеринг</SelectItem>
                <SelectItem value="review">Проверка</SelectItem>
                <SelectItem value="released">Релиз</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </motion.div>

      {/* ─── Status Badge Bar — HUD dot + colored label + yellow mono track count ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: projectStatusColor,
              boxShadow: `0 0 6px ${hexToRgba(projectStatusColor, 0.6)}`,
            }}
          />
          <span
            className="uppercase"
            style={{
              color: projectStatusColor,
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '1.5px',
              textShadow: `0 0 4px ${hexToRgba(projectStatusColor, 0.3)}`,
            }}
          >
            {statusLabels[project.status] || project.status}
          </span>
        </div>
        <span
          style={{
            color: Y,
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '1px',
            opacity: 0.85,
          }}
        >
          {projectTracks.length} {projectTracks.length === 1 ? 'трек' : 'треков'}
        </span>
      </motion.div>

      {/* ─── Tracks Section ─── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Yellow icon frame — matches SectionHeader in home-view.tsx */}
            <div
              className="flex h-7 w-7 items-center justify-center"
              style={{
                clipPath: CHAMFER_4,
                background: hexToRgba(Y, 0.18),
                border: `1px solid ${hexToRgba(Y, 0.55)}`,
                boxShadow: `0 0 8px ${hexToRgba(Y, 0.25)}`,
              }}
            >
              <Music
                className="w-3.5 h-3.5"
                style={{ color: Y, filter: `drop-shadow(0 0 3px ${hexToRgba(Y, 0.25)})` }}
              />
            </div>
            <h2
              className="text-sm font-bold uppercase"
              style={{
                color: TEXT_PRIMARY,
                fontFamily: 'var(--font-rajdhani), sans-serif',
                fontWeight: 700,
                letterSpacing: '2px',
              }}
            >
              Треки
            </h2>
          </div>
          {/* Add Track button — yellow CREATE-style */}
          <Button
            onClick={() => setAddDialogOpen(true)}
            variant="ghost"
            className="hover:bg-transparent"
            style={{
              ...YELLOW_BUTTON_STYLE,
              padding: '8px 14px',
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Добавить трек
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
                <TrackCard
                  index={index}
                  title={track.title}
                  createdBy={track.createdBy}
                  status={track.status}
                  durationMs={track.durationMs}
                  version={track.version}
                  kanbanTaskId={track.kanbanTaskId}
                  statusColor={statusColors[track.status] || A}
                  onClick={() => navigate('track-detail', selectedProjectId!, track.id)}
                  onFocusKanban={
                    track.kanbanTaskId
                      ? () => focusTrackInKanban(track.kanbanTaskId!, project?.kanbanTaskId)
                      : undefined
                  }
                />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          /* ── Empty state — chamfered dark panel with yellow icon ── */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="relative flex flex-col items-center justify-center overflow-hidden"
            style={{
              clipPath: CHAMFER_PANEL,
              ...PANEL_BORDER_STYLE,
              padding: '64px 24px',
            }}
          >
            {/* Blue corner bracket (top-left) */}
            <div className="absolute top-0 left-0 w-3 h-3 pointer-events-none" style={{
              borderTop: '1.5px solid rgba(0,168,198,0.6)',
              borderLeft: '1.5px solid rgba(0,168,198,0.6)',
            }} />
            {/* Yellow corner bracket (bottom-right) */}
            <div className="absolute bottom-0 right-0 w-3 h-3 pointer-events-none" style={{
              borderBottom: '1.5px solid rgba(199,160,8,0.6)',
              borderRight: '1.5px solid rgba(199,160,8,0.6)',
            }} />
            <div
              className="mb-4 flex h-14 w-14 items-center justify-center"
              style={{
                clipPath: CHAMFER_5,
                background: hexToRgba(Y, 0.12),
                border: `1px solid ${hexToRgba(Y, 0.4)}`,
                boxShadow: `0 0 12px ${hexToRgba(Y, 0.2)}`,
              }}
            >
              <Music
                className="h-7 w-7"
                style={{ color: Y, filter: `drop-shadow(0 0 4px ${hexToRgba(Y, 0.5)})` }}
              />
            </div>
            <h3
              className="mb-1 text-base font-bold uppercase"
              style={{
                color: TEXT_PRIMARY,
                fontFamily: 'var(--font-rajdhani), sans-serif',
                letterSpacing: '2px',
              }}
            >
              Треков пока нет
            </h3>
            <p className="mb-6 text-sm" style={{ color: TEXT_SECONDARY }}>
              Добавьте первый трек в этот проект
            </p>
            <Button
              onClick={() => setAddDialogOpen(true)}
              variant="ghost"
              className="hover:bg-transparent"
              style={{
                ...YELLOW_BUTTON_STYLE,
                padding: '10px 18px',
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Добавить трек
            </Button>
          </motion.div>
        )}
      </div>

      {/* ─── Add Track Dialog — dark bg #11141d, cyan border, chamfered ─── */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent
          className="border-0 rounded-none sm:max-w-md"
          style={{
            background: BG_PANEL,
            border: `1px solid ${hexToRgba(C, 0.5)}`,
            boxShadow: `0 0 24px ${hexToRgba(C, 0.2)}, 0 8px 32px rgba(0,0,0,0.7)`,
            clipPath: 'polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 calc(100% - 8px), 0 8px)',
          }}
        >
          <DialogHeader>
            <DialogTitle
              className="uppercase"
              style={{
                color: TEXT_PRIMARY,
                fontFamily: 'var(--font-rajdhani), sans-serif',
                fontWeight: 700,
                letterSpacing: '2px',
              }}
            >
              Новый трек
            </DialogTitle>
            <DialogDescription style={{ color: TEXT_SECONDARY }}>
              Добавьте трек в этот проект. Можно загрузить аудио сейчас или позже.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddTrack} className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="track-title"
                className="uppercase"
                style={{
                  color: TEXT_SECONDARY,
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  fontSize: '10px',
                  letterSpacing: '1.5px',
                }}
              >
                Название трека
              </Label>
              <Input
                id="track-title"
                placeholder="Введите название трека"
                value={trackTitle}
                onChange={(e) => setTrackTitle(e.target.value)}
                required
                className="border-0 rounded-none"
                style={HUD_INPUT_STYLE}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="audio-file"
                className="uppercase"
                style={{
                  color: TEXT_SECONDARY,
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  fontSize: '10px',
                  letterSpacing: '1.5px',
                }}
              >
                Аудио файл (опционально)
              </Label>
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
                  className="border-0 rounded-none file:border-0 file:bg-transparent file:text-[#c7a008] file:mr-3 file:px-2 file:py-0.5"
                  style={{
                    ...HUD_INPUT_STYLE,
                    fontSize: '11px',
                    color: TEXT_SECONDARY,
                  }}
                />
              </div>
              {audioFile && (
                <p
                  className="text-xs flex items-center gap-1.5"
                  style={{
                    color: Y,
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                  }}
                >
                  <Upload className="h-3 w-3" />
                  {audioFile.name} ({(audioFile.size / (1024 * 1024)).toFixed(1)} MB)
                </p>
              )}
            </div>

            {/* Upload progress — yellow waveform/progress per spec */}
            <AnimatePresence>
              {uploading && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <div
                    className="flex items-center justify-between text-xs"
                    style={{
                      color: TEXT_SECONDARY,
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                    }}
                  >
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: Y }} />
                      Загрузка...
                    </span>
                    <span style={{ color: Y }}>{Math.round(uploadProgress)}%</span>
                  </div>
                  <Progress
                    value={uploadProgress}
                    className="h-1.5 rounded-none border-0 bg-[#1f2633] [&>[data-slot=progress-indicator]]:bg-[#c7a008]"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {addError && (
              <p
                className="text-sm"
                style={{
                  color: '#ff5d5d',
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  fontSize: '11px',
                }}
              >
                {addError}
              </p>
            )}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAddDialogOpen(false)}
                disabled={uploading}
                className="hover:bg-transparent"
                style={{
                  color: TEXT_SECONDARY,
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  clipPath: CHAMFER_3,
                  background: 'transparent',
                  border: `0.5px solid ${hexToRgba(A, 0.3)}`,
                  padding: '8px 14px',
                }}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={uploading || !trackTitle.trim()}
                variant="ghost"
                className="hover:bg-transparent"
                style={{
                  ...YELLOW_BUTTON_STYLE,
                  padding: '8px 14px',
                }}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Добавление...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить трек
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

/* ─── Track Card — cyan-yellow HUD slab with purple accents, interactive ─── */
function TrackCard({
  index,
  title,
  createdBy,
  status,
  durationMs,
  version,
  kanbanTaskId,
  statusColor,
  onClick,
  onFocusKanban,
}: {
  index: number;
  title: string;
  createdBy: string;
  status: string;
  durationMs?: number | null;
  version?: number | null;
  kanbanTaskId?: string | null;
  statusColor: string;
  onClick: () => void;
  onFocusKanban?: () => void;
}) {
  const [h, setH] = useState(false);

  return (
    <motion.div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      className="group relative cursor-pointer overflow-hidden"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      style={{
        clipPath: CHAMFER_8,
        background: h
          ? `linear-gradient(135deg, ${hexToRgba(C, 0.18)} 0%, ${hexToRgba(Y, 0.08)} 50%, ${BG_CARD_TEAL} 100%)`
          : `linear-gradient(135deg, ${hexToRgba(Y, 0.04)} 0%, ${BG_CARD_TEAL} 40%, ${BG_PANEL} 100%)`,
        borderTop: `2px solid ${h ? Y : C}`,
        boxShadow: h
          ? `inset 0 1px 12px ${hexToRgba(Y, 0.15)}, inset 0 0 0 1px ${hexToRgba(Y, 0.4)}, 0 0 8px ${hexToRgba(Y, 0.15)}, 0 4px 16px rgba(0,0,0,0.5)`
          : `inset 0 1px 12px ${hexToRgba(C, 0.1)}, inset 0 0 0 1px ${hexToRgba(C, 0.25)}`,
        transition: 'background 280ms ease, box-shadow 280ms ease, border-top 280ms ease',
      }}
    >
      {/* Subtle top glow line on hover (static, no glitch animation) */}
      {h && (
        <div
          className="absolute inset-x-0 top-0 h-[2px] pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent, ${Y} 30%, ${Y} 70%, transparent)`,
            boxShadow: `0 0 6px ${Y}`,
          }}
        />
      )}

      {/* Corner brackets */}
      <div className="absolute top-0 left-0 w-2.5 h-2.5 pointer-events-none" style={{
        borderTop: '1.5px solid rgba(0,168,198,0.6)',
        borderLeft: '1.5px solid rgba(0,168,198,0.6)',
      }} />
      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 pointer-events-none" style={{
        borderBottom: '1.5px solid rgba(199,160,8,0.6)',
        borderRight: '1.5px solid rgba(199,160,8,0.6)',
      }} />

      {/* Left purple accent bar */}
      <div
        className="absolute left-0 top-3 bottom-3 w-[2px]"
        style={{
          background: `linear-gradient(180deg, transparent, ${P} 30%, ${P} 70%, transparent)`,
          boxShadow: `0 0 4px ${hexToRgba(P, 0.5)}`,
          opacity: h ? 1 : 0.5,
          transition: 'opacity 280ms ease',
        }}
      />

      <div className="relative flex items-center gap-4 p-4 pl-5" style={{ zIndex: 2 }}>
        {/* Track number — purple monospace in yellow frame */}
        <div
          className="flex h-9 w-9 items-center justify-center shrink-0"
          style={{
            clipPath: CHAMFER_4,
            background: hexToRgba(P, 0.15),
            border: `1px solid ${hexToRgba(P, 0.5)}`,
            boxShadow: h ? `0 0 8px ${hexToRgba(P, 0.4)}` : 'none',
          }}
        >
          <span
            style={{
              color: Y,
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: '13px',
              fontWeight: 700,
              textShadow: `0 0 4px ${hexToRgba(Y, 0.4)}`,
            }}
          >
            {String(index + 1).padStart(2, '0')}
          </span>
        </div>

        {/* Title + Info */}
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-bold transition-colors"
            style={{
              color: h ? '#ffffff' : TEXT_PRIMARY,
              fontFamily: 'var(--font-rajdhani), sans-serif',
              fontWeight: 700,
              textShadow: h ? `0 0 6px ${hexToRgba(Y, 0.3)}` : 'none',
            }}
          >
            {title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p
              className="text-xs"
              style={{
                color: h ? hexToRgba(Y, 0.7) : TEXT_SECONDARY,
                fontFamily: 'var(--font-jetbrains-mono), monospace',
              }}
            >
              {createdBy}
            </p>
            {durationMs != null && (
              <span className="text-[10px]" style={{ color: TEXT_SECONDARY, fontFamily: 'monospace' }}>·</span>
            )}
            {durationMs != null && (
              <span
                className="text-[10px]"
                style={{
                  color: C,
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  opacity: h ? 1 : 0.6,
                }}
              >
                {formatDuration(durationMs)}
              </span>
            )}
          </div>
        </div>

        {/* Status badge — yellow tint chamfered with colored status dot */}
        <div
          className="hidden sm:flex items-center gap-1.5"
          style={{
            ...YELLOW_CHIP_STYLE,
            padding: '3px 8px',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: statusColor,
              boxShadow: `0 0 6px ${hexToRgba(statusColor, 0.6)}`,
            }}
          />
          <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {statusLabels[status] || status}
          </span>
        </div>

        {/* Version — purple mono */}
        {version != null && (
          <span
            className="hidden lg:block"
            style={{
              color: P,
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: '11px',
              opacity: h ? 1 : 0.6,
              textShadow: h ? `0 0 4px ${hexToRgba(P, 0.4)}` : 'none',
            }}
          >
            v{version}
          </span>
        )}

        {/* Focus on Kanban button — cyan chip */}
        {kanbanTaskId && onFocusKanban && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFocusKanban();
            }}
            className="hidden sm:flex items-center gap-1 transition-all hover:scale-105"
            style={{
              padding: '4px 8px',
              clipPath: CHAMFER_3,
              background: hexToRgba(C, 0.1),
              border: `1px solid ${hexToRgba(C, 0.4)}`,
              color: C,
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
            }}
            title="Открыть в Kanban"
          >
            <LayoutDashboard className="h-3 w-3" />
            Канбан
          </button>
        )}

        {/* Chevron indicator — yellow, slides on hover */}
        <motion.div
          animate={{ x: h ? 3 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <ChevronRight
            className="h-4 w-4 shrink-0"
            style={{
              color: Y,
              opacity: h ? 1 : 0.5,
              filter: h ? `drop-shadow(0 0 3px ${Y})` : 'none',
              transition: 'opacity 280ms ease',
            }}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
