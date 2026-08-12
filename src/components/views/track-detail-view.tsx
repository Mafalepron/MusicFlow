'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { io, type Socket } from 'socket.io-client';
import { format } from 'date-fns';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Send,
  Plus,
  MessageCircle,
  ArrowLeft,
  Music2,
  LocateFixed,
  Lightbulb,
  X,
  Reply,
  Upload,
  MapPin,
  MoveHorizontal,
  Pencil,
  Trash2,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  MessageSquareQuote,
  LayoutDashboard,
  Zap,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  ScrollArea,
} from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useNavigationStore,
  useDataStore,
  useAuthStore,
  type Comment,
  type Idea,
  type TrackVersion,
} from '@/lib/store';
import { useKanbanStore, type Task } from '@/store/kanban-store';
import { useAudioContextStore } from '@/store/audio-context-store';
import { useHeaderActionsStore } from '@/store/header-actions-store';

import { hexToRgba } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { WaveformProgressBar } from '@/components/waveform-progress-bar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

/* ─── Cyberpunk 2077 HUD palette (mirrors home-view.tsx / project-detail-view.tsx) ─── */
const Y = '#c7a008'; // industrial desaturated gold
const Y2 = '#9e7c06';
const C = '#00a8c6'; // controlled cyan
const C2 = '#0085a0';
const P = '#7b2cbf'; // deep violet
const P2 = '#5a1d8f';
const A = '#718096'; // muted grey
const G = '#4a8d6f'; // muted green
const BG_MAIN = '#0a0c10';
const BG_PANEL = '#11141d';
const BG_CARD_PURPLE = '#161224';
const BG_CARD_TEAL = '#0e1a24';
const BORDER_MUTED = '#1f2633';
const TEXT_PRIMARY = '#e2e8f0';
const TEXT_SECONDARY = '#718096';

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
  background: `linear-gradient(135deg, ${Y} 0%, ${Y2} 50%, ${Y} 100%)`,
  fontFamily: 'var(--font-jetbrains-mono), monospace',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  clipPath: CHAMFER_4,
  boxShadow: `0 0 8px ${hexToRgba(Y, 0.5)}, inset 0 1px 0 rgba(255,255,255,0.25)`,
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

/* Section title style — uppercase white HUD heading (mirrors home-view SectionHeader) */
const SECTION_TITLE_STYLE: React.CSSProperties = {
  color: '#ffffff',
  fontFamily: 'var(--font-rajdhani), sans-serif',
  fontWeight: 700,
  letterSpacing: '2px',
  textTransform: 'uppercase' as const,
};

/* Inset bevel shadow used on every major HUD panel */
const INSET_BEVEL_SHADOW = 'inset 0 1px 1px rgba(255,255,255,0.06), inset 0 -1px 1px rgba(0,0,0,0.8)';

/* L-shaped corner brackets — blue top-left + yellow bottom-right (mirrors home-view StatBar) */
function CornerBrackets({ size = 12 }: { size?: number }) {
  return (
    <>
      {/* Blue corner bracket (top-left) */}
      <div
        className="absolute top-0 left-0 pointer-events-none"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderTop: '1.5px solid rgba(0,168,198,0.6)',
          borderLeft: '1.5px solid rgba(0,168,198,0.6)',
        }}
      />
      {/* Yellow corner bracket (bottom-right) */}
      <div
        className="absolute bottom-0 right-0 pointer-events-none"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderBottom: '1.5px solid rgba(199,160,8,0.6)',
          borderRight: '1.5px solid rgba(199,160,8,0.6)',
        }}
      />
    </>
  );
}

/* StatDot — compact stats badge: small colored status dot with label + count.
 * Used in the Kanban progress panel for track + project status buckets.
 * The dot carries a 4px glow in its own color so each status reads at a glance. */
function StatDot({
  label,
  count,
  color,
  compact = false,
}: {
  label: string;
  count: number;
  color: string;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <span
        className="inline-block shrink-0 rounded-full"
        style={{
          width: compact ? '5px' : '6px',
          height: compact ? '5px' : '6px',
          background: color,
          boxShadow: `0 0 4px ${hexToRgba(color, 0.8)}`,
        }}
      />
      <span
        style={{
          color: TEXT_SECONDARY,
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: compact ? '9px' : '10px',
          letterSpacing: '0.5px',
        }}
      >
        {label}
      </span>
      <span
        className="tabular-nums"
        style={{
          color,
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: compact ? '9px' : '10px',
          fontWeight: 700,
        }}
      >
        {count}
      </span>
    </div>
  );
}

// --- Types ---

interface ChatMember {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  role: string;
  instrument?: string;
  joinedAt: string;
}

// --- Constants ---

// Build a nested tree from flat comment list
interface CommentNode extends Comment {
  replies: CommentNode[];
}

function buildCommentTree(comments: Comment[]): CommentNode[] {
  const map = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];
  
  for (const c of comments) {
    map.set(c.id, { ...c, replies: [] });
  }
  for (const c of comments) {
    const node = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  roots.sort((a, b) => a.timestampMs - b.timestampMs);
  for (const r of roots) {
    r.replies.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  return roots;
}

// DoubleCheckmark SVG component for resolved state
function DoubleCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
      <polyline points="14 6 9 11 4 6" />
    </svg>
  );
}

const statusDotColors: Record<string, string> = {
  idea: '#c7a008',
  recording: '#00a8c6',
  mixing: '#7b2cbf',
  final: '#4a8d6f',
};

// --- Helpers ---

function formatTimestamp(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.floor((totalSeconds % 1) * 10);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds}`;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name
    .trim()
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// The backend API returns comments with a nested `user` object
// (e.g. `user: { displayName, ... }`), but the frontend store types expect a
// flat `userName` field. This normalizer bridges that gap so the rest of the
// component can rely on `userName` always being present.
function normalizeComment(raw: any): Comment {
  return {
    id: raw.id,
    trackId: raw.trackId,
    versionId: raw.versionId ?? raw.version?.id ?? undefined,
    parentId: raw.parentId ?? undefined,
    userId: raw.userId,
    userName: raw.userName ?? raw.user?.displayName ?? 'Unknown',
    timestampMs: raw.timestampMs ?? 0,
    rangeEndMs: raw.rangeEndMs ?? undefined,
    text: raw.text ?? '',
    isResolved: raw.isResolved ?? false,
    createdAt: raw.createdAt,
  };
}

// --- Ideas Sticker Strip (square sticker cards) ---

/* Muted HUD palette — 4 colors cycle: gold (Y), cyan (C), violet (P), green (G).
   Source idea uses gold (Y) to read as "primary / originating". */
const STICKER_COLORS = [
  { bg: 'from-[#7b2cbf]/20 to-[#5a1d8f]/20', border: 'border-[#7b2cbf]/30', accent: P, gradient: 'from-[#7b2cbf] to-[#5a1d8f]' },
  { bg: 'from-[#00a8c6]/20 to-[#0085a0]/20', border: 'border-[#00a8c6]/30', accent: C, gradient: 'from-[#00a8c6] to-[#0085a0]' },
  { bg: 'from-[#c7a008]/20 to-[#9e7c06]/20', border: 'border-[#c7a008]/30', accent: Y, gradient: 'from-[#c7a008] to-[#9e7c06]' },
  { bg: 'from-[#4a8d6f]/20 to-[#356a52]/20', border: 'border-[#4a8d6f]/30', accent: G, gradient: 'from-[#4a8d6f] to-[#356a52]' },
];

const SOURCE_STICKER = {
  bg: 'from-[#c7a008]/25 to-[#9e7c06]/25',
  border: 'border-[#c7a008]/50',
  accent: Y,
  gradient: 'from-[#c7a008] to-[#9e7c06]',
};

interface IdeasStoriesStripProps {
  ideas: Idea[];
  sourceIdeaId?: string;
  projectName: string;
}

function IdeasStoriesStrip({ ideas, sourceIdeaId, projectName }: IdeasStoriesStripProps) {
  const [expandedIdea, setExpandedIdea] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build the ordered list: source idea first (highlighted), then all others
  const orderedIdeas = useMemo(() => {
    const sorted = [...ideas];
    if (sourceIdeaId) {
      const srcIdx = sorted.findIndex((i) => i.id === sourceIdeaId);
      if (srcIdx > 0) {
        const [src] = sorted.splice(srcIdx, 1);
        sorted.unshift(src);
      }
    }
    return sorted;
  }, [ideas, sourceIdeaId]);

  if (orderedIdeas.length === 0) return null;

  return (
    <div className="shrink-0">
      {/* Sticky label row */}
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-2 px-4 pt-3 pb-2 lg:px-6"
      >
        <Lightbulb className="h-3.5 w-3.5 text-[#c7a008]" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          Ideas
        </span>
        <span className="text-[10px] text-muted-foreground/40">{ideas.length}</span>
      </motion.div>

      {/* Horizontal scrolling square stickers */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto px-4 pb-3 lg:px-6 scrollbar-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {orderedIdeas.map((idea, idx) => {
          const isSource = idea.id === sourceIdeaId;
          const isExpanded = expandedIdea === idea.id;
          const color = isSource ? SOURCE_STICKER : STICKER_COLORS[idx % STICKER_COLORS.length];
          const creatorName =
            (idea as any).creator?.displayName ??
            (idea as any).userName ??
            '';
          const initials = getInitials(creatorName);

          return (
            <div key={idea.id} className="relative shrink-0">
              {/* --- Expanded panel: slides down from the sticker --- */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    key={idea.id}
                    initial={{ opacity: 0, y: -10, scale: 0.95, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -10, scale: 0.95, filter: 'blur(4px)' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="absolute top-full left-0 z-50 mt-1 w-64 border border-border shadow-2xl shadow-black/60"
                    style={{
                      background: BG_PANEL,
                      border: `1px solid ${hexToRgba(C, 0.4)}`,
                      clipPath: CHAMFER_5,
                    }}
                  >
                    {/* Top accent bar */}
                    <div
                      className={`h-1 w-full bg-gradient-to-r ${color.gradient}`}
                      style={{ clipPath: CHAMFER_5 }}
                    />
                    <div className="p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {isSource && (
                            <span className="mb-1 inline-block rounded bg-[#c7a008]/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#c7a008]">
                              Source Idea
                            </span>
                          )}
                          <h4 className="text-sm font-semibold text-foreground leading-tight truncate">
                            {idea.title}
                          </h4>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setExpandedIdea(null); }}
                          className="shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:bg-[#161224] hover:text-foreground"
                        >
                          <span className="text-sm leading-none">×</span>
                        </button>
                      </div>

                      {idea.description && (
                        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground line-clamp-3">
                          {idea.description}
                        </p>
                      )}

                      <div className="mt-2.5 flex items-center gap-1.5">
                        {/* Mini avatar */}
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br ${color.gradient} text-[8px] font-bold text-white`}
                        >
                          {initials}
                        </div>
                        <span className="text-[10px] text-muted-foreground/60">
                          {creatorName} · {format(new Date(idea.createdAt), 'MMM d')}
                        </span>
                      </div>

                      {/* Tags */}
                      {(() => {
                        const raw = idea.tags;
                        if (!raw) return null;
                        let tags: string[];
                        try {
                          const parsed = JSON.parse(raw);
                          tags = Array.isArray(parsed) ? parsed : [];
                        } catch {
                          tags = raw.split(',').map((t) => t.trim()).filter(Boolean);
                        }
                        if (tags.length === 0) return null;
                        return (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-[#161224] px-1.5 py-0.5 text-[9px] text-muted-foreground/70"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* --- The square sticker itself --- */}
              <motion.button
                whileHover={{ scale: 1.06, y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                onClick={() => setExpandedIdea(isExpanded ? null : idea.id)}
                className="group/sticker relative flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-xl border bg-gradient-to-br outline-none transition-shadow duration-200 hover:shadow-lg"
                style={{
                  borderColor: isSource ? 'rgba(199,160,8,0.4)' : `color-mix(in srgb, ${color.accent} 30%, transparent)`,
                  boxShadow: isSource
                    ? `0 2px 12px rgba(199,160,8,0.15)`
                    : `0 1px 6px ${color.accent}08`,
                }}
              >
                {/* Background gradient fill */}
                <div
                  className={`absolute inset-0 rounded-xl bg-gradient-to-br ${color.bg} opacity-80 group-hover/sticker:opacity-100 transition-opacity`}
                />
                {/* Subtle top-left shine for sticker feel */}
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-xl"
                  style={{
                    background: `linear-gradient(to bottom, rgba(255,255,255,0.04), transparent)`,
                  }}
                />

                {/* Initials */}
                <span className="relative text-base font-bold" style={{ color: color.accent }}>
                  {initials}
                </span>

                {/* Tiny decorative line */}
                <div
                  className="relative h-0.5 w-4 rounded-full opacity-40"
                  style={{ backgroundColor: color.accent }}
                />

                {/* Hover title tooltip — appears above the sticker — dark HUD chip with yellow text */}
                <div
                  className="pointer-events-none absolute -top-9 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap px-2.5 py-1 shadow-xl opacity-0 transition-opacity duration-150 group-hover/sticker:opacity-100"
                  style={{
                    background: BG_PANEL,
                    border: `1px solid ${hexToRgba(Y, 0.4)}`,
                    clipPath: CHAMFER_3,
                  }}
                >
                  <p className="text-[10px] font-medium" style={{ color: Y, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>{idea.title}</p>
                </div>

                {/* Source indicator dot */}
                {isSource && (
                  <div className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#c7a008] ring-2 ring-[#0a0c10] shadow-sm shadow-[#c7a008]/40" />
                )}
              </motion.button>
            </div>
          );
        })}

        {/* End spacer */}
        <div className="w-2 shrink-0" />
      </div>
    </div>
  );
}

// --- Main Component ---

export function TrackDetailView() {
  // Store state
  const selectedTrackId = useNavigationStore((s) => s.selectedTrackId);
  const selectedProjectId = useNavigationStore((s) => s.selectedProjectId);
  const navigate = useNavigationStore((s) => s.navigate);
  const tracks = useDataStore((s) => s.tracks);
  const user = useAuthStore((s) => s.user);
  const addComment = useDataStore((s) => s.addComment);
  const updateCommentStore = useDataStore((s) => s.updateComment);
  const removeCommentStore = useDataStore((s) => s.removeComment);
  const updateTrackStatus = useDataStore((s) => s.updateTrackStatus);

  // Audio context store — sync local playback state to global store for floating chat widget
  const setActiveTrack = useAudioContextStore((s) => s.setActiveTrack);
  const setAudioContextTime = useAudioContextStore((s) => s.setCurrentTime);
  const setAudioContextPlaying = useAudioContextStore((s) => s.setIsPlaying);

  // Header actions store — register contextual actions (Open in Kanban) and the
  // page title with the unified AppHeader. The duplicate inline back button +
  // title header has been removed; breadcrumbs are rendered by AppHeader.
  const setHeaderActions = useHeaderActionsStore((s) => s.setActions);
  const setHeaderTitle = useHeaderActionsStore((s) => s.setTitle);

  const track = useMemo(
    () => tracks.find((t) => t.id === selectedTrackId) ?? null,
    [tracks, selectedTrackId]
  );

  // Audio player state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLoaded, setAudioLoaded] = useState(false);

  // Waveform state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const waveformRef = useRef<Float32Array | null>(null);
  const [waveformReady, setWaveformReady] = useState(false);
  const animFrameRef = useRef<number>(0);
  const [waveformHoverTime, setWaveformHoverTime] = useState<{ x: number; ms: number } | null>(null);
  const [markerTooltipPos, setMarkerTooltipPos] = useState<{ top: number; left: number; right: boolean } | null>(null);
  const markerTooltipHoverRef = useRef(false);
  const markerHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  // Comment state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentTimestamp, setCommentTimestamp] = useState(0);
  const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null);
  const commentsEndRef = useRef<HTMLDivElement | null>(null);

  // Marker mode: 'point' for single-timestamp, 'range' for start→end
  const [markerMode, setMarkerMode] = useState<'point' | 'range'>('point');
  const [rangeStartMs, setRangeStartMs] = useState(0);
  const [rangeEndMsState, setRangeEndMsState] = useState(0);
  const [isSelectingRange, setIsSelectingRange] = useState(false);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Collapsed replies state
  const [collapsedThreads, setCollapsedThreads] = useState<Set<string>>(new Set());
  const toggleThread = useCallback((id: string) => {
    setCollapsedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Edit comment state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');

  const { toast } = useToast();

  // Version state
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [versions, setVersions] = useState<TrackVersion[]>([]);
  const [showAddVersionDialog, setShowAddVersionDialog] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadingVersion, setIsUploadingVersion] = useState(false);

  // Derived: active version from list
  const activeVersion = useMemo(
    () => versions.find((v) => v.id === activeVersionId) ?? versions[0] ?? null,
    [versions, activeVersionId]
  );

  // Hovered comment marker (waveform overlay tooltip)
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);

  // Participant presence
  const [groupMembers, setGroupMembers] = useState<ChatMember[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  // WebSocket
  const socketRef = useRef<Socket | null>(null);

  // Ideas (for this project — displayed as stories above the waveform)
  const currentGroupId = useAuthStore((s) => s.currentGroupId);
  const projects = useDataStore((s) => s.projects);
  const [projectIdeas, setProjectIdeas] = useState<Idea[]>([]);
  const projectOfTrack = useMemo(
    () => projects.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId]
  );

  // --- Kanban progress state ---
  // trackTasks: all Kanban tasks linked to the currently-selected SoundFlow track
  // (fetched via /api/tasks?soundflowTrackId=…&deep=true). Each task carries its
  // own children (2 levels deep) so we can render a per-task mini progress bar.
  const [trackTasks, setTrackTasks] = useState<Task[]>([]);
  // projectTask: the Kanban "project" task for the project this track belongs to
  // (fetched by parentId). Used to show a project-level progress summary next to
  // the track progress. Stays null when the project has no linked kanbanTaskId.
  const [projectTask, setProjectTask] = useState<Task | null>(null);

  useEffect(() => {
    if (!selectedTrackId) {
      setTrackTasks([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/tasks?soundflowTrackId=${encodeURIComponent(selectedTrackId)}&deep=true`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled) return;
        if (data && Array.isArray(data.tasks)) {
          setTrackTasks(data.tasks as Task[]);
        } else {
          setTrackTasks([]);
        }
      })
      .catch(() => {
        if (!cancelled) setTrackTasks([]);
      });
    return () => { cancelled = true; };
  }, [selectedTrackId]);

  useEffect(() => {
    const kanbanTaskId = projectOfTrack?.kanbanTaskId;
    if (!kanbanTaskId) {
      setProjectTask(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/tasks?parentId=${encodeURIComponent(kanbanTaskId)}&deep=true`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled) return;
        // The API returns { tasks: [...] } — single project task expected.
        if (data && Array.isArray(data.tasks) && data.tasks.length > 0) {
          setProjectTask(data.tasks[0] as Task);
        } else {
          setProjectTask(null);
        }
      })
      .catch(() => {
        if (!cancelled) setProjectTask(null);
      });
    return () => { cancelled = true; };
  }, [projectOfTrack?.kanbanTaskId]);

  // Compute kanban progress statistics for the currently-selected track.
  // Flatten every direct child of every fetched track-task and bucket by status.
  const trackProgress = useMemo(() => {
    const allChildren = trackTasks.flatMap((t) => t.children || []);
    const total = allChildren.length;
    const done = allChildren.filter((c) => c.status === 'done').length;
    const inProgress = allChildren.filter((c) => c.status === 'in-progress').length;
    const review = allChildren.filter((c) => c.status === 'review').length;
    const todo = allChildren.filter((c) => c.status === 'todo').length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { allChildren, total, done, inProgress, review, todo, pct };
  }, [trackTasks]);

  // Project-level progress: count direct children of the project's kanban task.
  const projectProgress = useMemo(() => {
    if (!projectTask) return null;
    const children = projectTask.children || [];
    const total = children.length;
    const done = children.filter((c) => c.status === 'done').length;
    const inProgress = children.filter((c) => c.status === 'in-progress').length;
    const review = children.filter((c) => c.status === 'review').length;
    const todo = children.filter((c) => c.status === 'todo').length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, inProgress, review, todo, pct };
  }, [projectTask]);

  useEffect(() => {
    if (!currentGroupId || !selectedProjectId) return;
    fetch(`/api/ideas?groupId=${currentGroupId}&projectId=${selectedProjectId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProjectIdeas(data);
      })
      .catch(() => {});
  }, [currentGroupId, selectedProjectId]);

  // Fetch group members for participant avatars
  useEffect(() => {
    if (!currentGroupId) return;
    fetch(`/api/groups/${currentGroupId}/members`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setGroupMembers(data);
      })
      .catch(() => {});
  }, [currentGroupId]);

  // --- Audio Playback ---

  // The audioUrl to play: active version's audioUrl, or fallback to track's audioUrl
  const currentAudioUrl = activeVersion?.audioUrl || track?.audioUrl || '';

  useEffect(() => {
    if (!currentAudioUrl) return;

    const audio = new Audio(currentAudioUrl);
    audioRef.current = audio;
    audio.volume = isMuted ? 0 : volume;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setAudioLoaded(false);
    setWaveformReady(false);
    waveformRef.current = null;

    const onLoaded = () => {
      setDuration(audio.duration);
      setAudioLoaded(true);
    };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [currentAudioUrl]);

  // Display duration: prefer audio-loaded duration, fall back to track metadata
  const displayDuration = duration > 0 ? duration : (track?.durationMs ? track.durationMs / 1000 : 0);

  // Sync volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Sync current playback position to global audio context store (used by floating chat widget)
  useEffect(() => {
    setAudioContextTime(currentTime);
  }, [currentTime, setAudioContextTime]);

  // Sync play/pause state to global audio context store
  useEffect(() => {
    setAudioContextPlaying(isPlaying);
  }, [isPlaying, setAudioContextPlaying]);

  // Sync active track (trackId, projectId, kanbanTaskId) to global audio context store.
  // The floating chat widget reads these to scope its messages and timestamp links.
  useEffect(() => {
    if (!selectedTrackId) {
      setActiveTrack(null, null, null);
      return;
    }
    setActiveTrack(
      selectedTrackId,
      selectedProjectId ?? null,
      projectOfTrack?.kanbanTaskId ?? null
    );
    return () => {
      setActiveTrack(null, null, null);
    };
  }, [selectedTrackId, selectedProjectId, projectOfTrack?.kanbanTaskId, setActiveTrack]);

  // Register contextual header actions and the page title with the unified
  // AppHeader. Breadcrumbs (Group / Projects / Project Title / Track) are
  // rendered by AppHeader, and the "Open in Kanban" action appears as a header
  // button (only when this project has a linked kanbanTaskId).
  useEffect(() => {
    if (!track) {
      setHeaderTitle(null);
      setHeaderActions([]);
      return;
    }

    setHeaderTitle(track.title);

    const kanbanTaskId = projectOfTrack?.kanbanTaskId;
    if (kanbanTaskId) {
      setHeaderActions([
        {
          id: 'open-in-kanban',
          label: 'Open in Kanban',
          icon: <LayoutDashboard className="h-3.5 w-3.5" />,
          variant: 'outline',
          onClick: () => {
            const project = useDataStore
              .getState()
              .projects.find((p) => p.id === selectedProjectId);
            if (!project?.kanbanTaskId) return;
            useNavigationStore.getState().navigate('kanban');
            const taskId = project.kanbanTaskId;
            setTimeout(() => {
              useKanbanStore.getState().selectProject(taskId);
            }, 300);
          },
        },
      ]);
    } else {
      setHeaderActions([]);
    }

    return () => {
      setHeaderActions([]);
      setHeaderTitle(null);
    };
  }, [
    track,
    projectOfTrack?.kanbanTaskId,
    selectedProjectId,
    setHeaderActions,
    setHeaderTitle,
  ]);

  // Marker tooltip position is now calculated directly in onMouseEnter handler
  // (removed the old useEffect + ref pattern to fix timing issues with framer-motion)

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  }, [isPlaying]);

  const skip = useCallback((seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(
      0,
      Math.min(audioRef.current.currentTime + seconds, duration)
    );
  }, [duration]);

  const seekTo = useCallback((time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  // --- Waveform ---

  useEffect(() => {
    if (!currentAudioUrl) return;

    let cancelled = false;
    setWaveformReady(false);

    async function generateWaveform() {
      try {
        const url = `/api/waveform?audio=${encodeURIComponent(currentAudioUrl)}&samples=200`;
        const res = await fetch(url);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.samples && data.samples.length > 0) {
          waveformRef.current = new Float32Array(data.samples);
          setWaveformReady(true);
        }
      } catch {
        // Silently fail — waveform won't render
      }
    }

    generateWaveform();
    return () => { cancelled = true; };
  }, [currentAudioUrl]);

  // Draw waveform — uses requestAnimationFrame only while playing, single draw otherwise
  useEffect(() => {
    const canvas = canvasRef.current;
    const waveform = waveformRef.current;
    if (!canvas || !waveform) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      // Only resize canvas if dimensions changed
      const targetW = Math.round(rect.width * dpr);
      const targetH = Math.round(rect.height * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const width = rect.width;
      const height = rect.height;
      const barCount = waveform.length;
      const barWidth = width / barCount;
      const barGap = 1;
      const centerY = height / 2;

      // Clear
      ctx.clearRect(0, 0, width, height);

      const progress = duration > 0 ? currentTime / duration : 0;
      const progressX = progress * width;

      // Create gradient (cached via closure — only recreated when canvas resets)
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, '#7b2cbf');
      gradient.addColorStop(0.5, '#5a1d8f');
      gradient.addColorStop(1, '#00a8c6');

      const dimGradient = ctx.createLinearGradient(0, 0, width, 0);
      dimGradient.addColorStop(0, 'rgba(123,44,191,0.7)');
      dimGradient.addColorStop(0.5, 'rgba(90,29,143,0.7)');
      dimGradient.addColorStop(1, 'rgba(0,168,198,0.7)');
      // First pass: unplayed bars
      ctx.fillStyle = dimGradient;
      for (let i = 0; i < barCount; i++) {
        const x = i * barWidth;
        if (x < progressX) continue;
        const amplitude = waveform[i];
        const barHeight = Math.max(2, amplitude * centerY * 0.85);
        const bw = Math.max(1, barWidth - barGap);
        ctx.beginPath();
        ctx.roundRect(x, centerY - barHeight, bw, barHeight * 2, 1);
        ctx.fill();
      }

      // Second pass: played bars
      ctx.fillStyle = gradient;
      for (let i = 0; i < barCount; i++) {
        const x = i * barWidth;
        if (x >= progressX) continue;
        const amplitude = waveform[i];
        const barHeight = Math.max(2, amplitude * centerY * 0.85);
        const bw = Math.max(1, barWidth - barGap);
        ctx.beginPath();
        ctx.roundRect(x, centerY - barHeight, bw, barHeight * 2, 1);
        ctx.fill();
      }

      // Progress cursor
      if (progress > 0 && progress < 1) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(255,255,255,0.5)';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(progressX, 0);
        ctx.lineTo(progressX, height);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Keep animating only while playing
      if (isPlaying) {
        rafId = requestAnimationFrame(draw);
      }
    };

    draw();

    // Also draw on resize
    const handleResize = () => { rafId = requestAnimationFrame(draw); };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
    };
  }, [waveformReady, currentTime, duration, isPlaying]);

  // Redraw once when seeking while paused
  useEffect(() => {
    if (waveformReady && !isPlaying) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Force a redraw by triggering a minimal state change
      const ctx = canvas.getContext('2d');
      if (!ctx || !waveformRef.current) return;
      const waveform = waveformRef.current;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const barCount = waveform.length;
      const barWidth = width / barCount;
      const barGap = 1;
      const centerY = height / 2;
      const progress = duration > 0 ? currentTime / duration : 0;
      const progressX = progress * width;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, '#7b2cbf');
      gradient.addColorStop(0.5, '#5a1d8f');
      gradient.addColorStop(1, '#00a8c6');
      const dimGradient = ctx.createLinearGradient(0, 0, width, 0);
      dimGradient.addColorStop(0, 'rgba(123,44,191,0.7)');
      dimGradient.addColorStop(0.5, 'rgba(90,29,143,0.7)');
      dimGradient.addColorStop(1, 'rgba(0,168,198,0.7)');
      ctx.fillStyle = dimGradient;
      for (let i = 0; i < barCount; i++) {
        const x = i * barWidth;
        if (x < progressX) continue;
        const a = waveform[i];
        const bh = Math.max(2, a * centerY * 0.85);
        const bw = Math.max(1, barWidth - barGap);
        ctx.beginPath();
        ctx.roundRect(x, centerY - bh, bw, bh * 2, 1);
        ctx.fill();
      }
      ctx.fillStyle = gradient;
      for (let i = 0; i < barCount; i++) {
        const x = i * barWidth;
        if (x >= progressX) continue;
        const a = waveform[i];
        const bh = Math.max(2, a * centerY * 0.85);
        const bw = Math.max(1, barWidth - barGap);
        ctx.beginPath();
        ctx.roundRect(x, centerY - bh, bw, bh * 2, 1);
        ctx.fill();
      }
      if (progress > 0 && progress < 1) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(255,255,255,0.5)';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(progressX, 0);
        ctx.lineTo(progressX, height);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
  }, [currentTime, waveformReady, isPlaying, duration]);

  const handleWaveformClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || duration <= 0) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const progress = x / rect.width;
      const time = progress * duration;

      seekTo(time);

      const clickedMs = Math.round(time * 1000);

      if (markerMode === 'range') {
        if (!isSelectingRange) {
          // First click — set range start
          setRangeStartMs(clickedMs);
          setRangeEndMsState(clickedMs);
          setIsSelectingRange(true);
          setCommentTimestamp(clickedMs);
          setShowCommentInput(true);
        } else {
          // Second click — set range end
          const start = Math.min(rangeStartMs, clickedMs);
          const end = Math.max(rangeStartMs, clickedMs);
          setRangeStartMs(start);
          setRangeEndMsState(end);
          setCommentTimestamp(start);
          setIsSelectingRange(false);
        }
      } else {
        // Point mode — single timestamp
        setCommentTimestamp(clickedMs);
        setRangeStartMs(0);
        setRangeEndMsState(0);
        setShowCommentInput(true);
      }
    },
    [duration, seekTo, markerMode, isSelectingRange, rangeStartMs]
  );

  const handleMarkerClick = useCallback(
    (comment: Comment) => {
      seekTo(comment.timestampMs / 1000);
      setFocusedCommentId(comment.id);
      // Keep highlight for 3 seconds
      setTimeout(() => {
        setFocusedCommentId(null);
      }, 3000);
    },
    [seekTo]
  );

  // --- Comments ---

  useEffect(() => {
    if (!selectedTrackId) return;
    fetch(`/api/tracks/${selectedTrackId}/comments`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setComments(data.map(normalizeComment));
      })
      .catch(() => {});
  }, [selectedTrackId, activeVersionId]);

  // Scroll to focused comment
  useEffect(() => {
    if (focusedCommentId) {
      const el = document.getElementById(`comment-${focusedCommentId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusedCommentId]);

  const handleAddComment = useCallback(async () => {
    if (!newCommentText.trim() || !selectedTrackId || !user || !activeVersion?.id) return;

    const timestamp = commentTimestamp || Math.round(currentTime * 1000);

    try {
      const res = await fetch(`/api/tracks/${selectedTrackId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          text: newCommentText.trim(),
          timestampMs: timestamp,
          ...(markerMode === 'range' && rangeEndMsState > timestamp ? { rangeEndMs: rangeEndMsState } : {}),
          versionId: activeVersion.id,
        }),
      });
      if (!res.ok) return;
      const comment = normalizeComment(await res.json());
      addComment(comment);
      setComments((prev) => [...prev, comment]);
      setNewCommentText('');
      setShowCommentInput(false);
      setCommentTimestamp(0);
      setRangeStartMs(0);
      setRangeEndMsState(0);
      setIsSelectingRange(false);
    } catch {
      // Silently fail
    }
  }, [newCommentText, selectedTrackId, user, commentTimestamp, currentTime, addComment, activeVersion, markerMode, rangeEndMsState]);

  const handleEditComment = useCallback(async (commentId: string) => {
    if (!editCommentText.trim() || !selectedTrackId) return;
    try {
      const updateData: Record<string, unknown> = { text: editCommentText.trim() };
      const res = await fetch(`/api/tracks/${selectedTrackId}/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      if (!res.ok) return;
      const updated = normalizeComment(await res.json());
      updateCommentStore(commentId, { text: updated.text });
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, text: updated.text } : c)));
      setEditingCommentId(null);
      setEditCommentText('');
      // Emit socket event
      socketRef.current?.emit('comment:edit', { trackId: selectedTrackId, commentId, text: updated.text });
      toast({ description: 'Comment updated' });
    } catch {
      toast({ description: 'Failed to update comment', variant: 'destructive' });
    }
  }, [editCommentText, selectedTrackId, updateCommentStore, toast]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    if (!selectedTrackId) return;
    try {
      const res = await fetch(`/api/tracks/${selectedTrackId}/comments/${commentId}`, {
        method: 'DELETE',
      });
      if (!res.ok) return;
      removeCommentStore(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      if (focusedCommentId === commentId) setFocusedCommentId(null);
      // Emit socket event
      socketRef.current?.emit('comment:delete', { trackId: selectedTrackId, commentId });
      toast({ description: 'Comment deleted' });
    } catch {
      toast({ description: 'Failed to delete comment', variant: 'destructive' });
    }
  }, [selectedTrackId, removeCommentStore, focusedCommentId, toast]);

  const handleToggleResolved = useCallback(async (commentId: string, isResolved: boolean) => {
    if (!selectedTrackId) return;
    try {
      const res = await fetch(`/api/tracks/${selectedTrackId}/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isResolved: !isResolved }),
      });
      if (!res.ok) return;
      const updated = normalizeComment(await res.json());
      updateCommentStore(commentId, { isResolved: updated.isResolved });
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, isResolved: updated.isResolved } : c)));
      socketRef.current?.emit('comment:edit', { trackId: selectedTrackId, commentId, isResolved: updated.isResolved });
      // When resolving, collapse the thread
      if (updated.isResolved) {
        setCollapsedThreads((prev) => new Set([...prev, commentId]));
      }
    } catch {
      // Silently fail
    }
  }, [selectedTrackId, updateCommentStore]);

  const startEditingComment = useCallback((comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.text);
    setReplyingTo(null);
    setReplyText('');
  }, []);

  const cancelEditingComment = useCallback(() => {
    setEditingCommentId(null);
    setEditCommentText('');
  }, []);

  // --- WebSocket ---

  useEffect(() => {
    if (!selectedTrackId) return;

    const socket = io('/?XTransformPort=3004');
    socketRef.current = socket;

    const room = `track:${selectedTrackId}`;
    socket.emit('room:join', { room, userId: user?.id, userName: user?.displayName, avatarUrl: user?.avatarUrl });

    socket.on('presence:update', (data: any) => {
      if (data?.users) {
        setOnlineUserIds(new Set(data.users.map((u: any) => u.userId)));
      }
    });

    socket.on('presence:current', (data: any) => {
      if (data?.users) {
        setOnlineUserIds(new Set(data.users.map((u: any) => u.userId)));
      }
    });

    socket.on('comment:new', (raw: any) => {
      const comment = normalizeComment(raw);
      addComment(comment);
      setComments((prev) => {
        if (prev.some((c) => c.id === comment.id)) return prev;
        return [...prev, comment];
      });
    });

    socket.on('comment:updated', (data: { commentId: string; text?: string; isResolved?: boolean; timestampMs?: number }) => {
      updateCommentStore(data.commentId, {
        ...(data.text !== undefined ? { text: data.text } : {}),
        ...(data.isResolved !== undefined ? { isResolved: data.isResolved } : {}),
        ...(data.timestampMs !== undefined ? { timestampMs: data.timestampMs } : {}),
      });
      setComments((prev) =>
        prev.map((c) =>
          c.id === data.commentId
            ? { ...c, ...(data.text !== undefined ? { text: data.text } : {}), ...(data.isResolved !== undefined ? { isResolved: data.isResolved } : {}), ...(data.timestampMs !== undefined ? { timestampMs: data.timestampMs } : {}) }
            : c
        )
      );
    });

    socket.on('comment:deleted', (data: { commentId: string }) => {
      removeCommentStore(data.commentId);
      setComments((prev) => prev.filter((c) => c.id !== data.commentId));
      setFocusedCommentId((prev) => (prev === data.commentId ? null : prev));
    });

    return () => {
      socket.emit('room:leave', { room, userId: user?.id });
      socket.disconnect();
      socketRef.current = null;
      setOnlineUserIds(new Set());
    };
  }, [selectedTrackId, addComment, updateCommentStore, removeCommentStore, user]);

  // --- Status Change ---

  const handleStatusChange = useCallback(
    (newStatus: string) => {
      if (!selectedTrackId) return;
      updateTrackStatus(selectedTrackId, newStatus);
      socketRef.current?.emit('track:update_status', {
        trackId: selectedTrackId,
        status: newStatus,
      });
    },
    [selectedTrackId, updateTrackStatus]
  );

  // --- Fetch Versions ---

  useEffect(() => {
    if (!selectedTrackId) return;
    fetch(`/api/tracks/${selectedTrackId}/versions`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setVersions(data);
          // Set active to first version if none selected
          if (data.length > 0 && !activeVersionId) {
            setActiveVersionId(data[0].id);
          }
        }
      })
      .catch(() => {});
  }, [selectedTrackId]);

  // --- Add Version (via file upload dialog) ---

  const handleAddVersion = useCallback(async (file: File, label: string) => {
    if (!selectedTrackId || !user) return;

    setIsUploadingVersion(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('label', label);
      formData.append('createdBy', user.id);

      const xhr = new XMLHttpRequest();
      const url = `/api/tracks/${selectedTrackId}/versions`;

      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.open('POST', url);
        xhr.send(formData);
      });

      // Refresh versions list
      const res = await fetch(`/api/tracks/${selectedTrackId}/versions`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setVersions(data);
        // Switch to the new version (last one)
        if (data.length > 0) {
          setActiveVersionId(data[data.length - 1].id);
        }
      }

      setShowAddVersionDialog(false);
    } catch {
      // Silently fail
    } finally {
      setIsUploadingVersion(false);
      setUploadProgress(0);
    }
  }, [selectedTrackId, user]);

  // --- Reply to Comment ---

  const handleReply = useCallback(async () => {
    if (!replyingTo || !replyText.trim() || !selectedTrackId || !user || !activeVersion?.id) return;

    const directParent = comments.find((c) => c.id === replyingTo);
    if (!directParent) return;

    // Always find the root comment for flat threading (all replies at same level)
    const rootComment = directParent.parentId
      ? comments.find((c) => c.id === directParent.parentId) || directParent
      : directParent;

    try {
      const res = await fetch(`/api/tracks/${selectedTrackId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          text: replyText.trim(),
          timestampMs: rootComment.timestampMs,
          versionId: activeVersion.id,
          parentId: rootComment.id,
        }),
      });
      if (!res.ok) return;
      const reply = normalizeComment(await res.json());
      addComment(reply);
      setComments((prev) => [...prev, reply]);
      // Ensure the root thread is expanded so the new reply is visible
      setCollapsedThreads((prev) => {
        const next = new Set(prev);
        next.delete(rootComment.id);
        return next;
      });
      setReplyText('');
      setReplyingTo(null);
    } catch {
      // Silently fail
    }
  }, [replyingTo, replyText, selectedTrackId, user, comments, addComment, activeVersion]);

  // --- Keyboard Shortcuts ---

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        skip(-5);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        skip(5);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, skip]);

  // --- No Track ---

  // Build a map of root comment ID → 1-based index for numbering
  const commentNumberMap = useMemo(() => {
    const roots = comments.filter((c) => activeVersion?.id && c.versionId === activeVersion.id && !c.parentId);
    roots.sort((a, b) => a.timestampMs - b.timestampMs);
    const map = new Map<string, number>();
    roots.forEach((c, i) => map.set(c.id, i + 1));
    return map;
  }, [comments, activeVersion]);

  // --- Render ---

  const progress = duration > 0 ? currentTime / duration : 0;

  if (!track) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <div
          className="relative flex flex-col items-center gap-3 p-6"
          style={{
            background: BG_PANEL,
            border: `1px solid ${hexToRgba(C, 0.4)}`,
            clipPath: CHAMFER_8,
            boxShadow: INSET_BEVEL_SHADOW,
          }}
        >
          <CornerBrackets size={12} />
          <Music2 className="h-12 w-12" style={{ color: hexToRgba(Y, 0.5) }} />
          <p className="text-sm" style={{ color: TEXT_SECONDARY, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>No track selected</p>
          <Button
            variant="outline"
            size="sm"
            className="border-0 rounded-none"
            style={{
              ...YELLOW_BUTTON_STYLE,
              paddingRight: '12px',
              paddingLeft: '12px',
              paddingTop: '5px',
              paddingBottom: '5px',
            }}
            onClick={() => navigate('project-detail', selectedProjectId ?? undefined)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Project
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Contextual row — ideas strip + status selector.
          Back button, title, and "Open in Kanban" action have moved to the
          unified AppHeader (breadcrumbs + header-actions store). */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-3 px-4 py-3 lg:px-6"
        style={{ borderBottom: `1px solid ${hexToRgba(C, 0.2)}` }}
      >
        <div className="min-w-0 flex-1">
          {/* Ideas Stories Strip — in header area */}
          <IdeasStoriesStrip
            ideas={projectIdeas}
            sourceIdeaId={track.sourceIdeaId ?? undefined}
            projectName={projectOfTrack?.title ?? ''}
          />
        </div>

        {/* Status selector */}
        <Select value={track.status} onValueChange={handleStatusChange}>
          <SelectTrigger
            size="sm"
            className="w-[130px] shrink-0 text-xs"
          >
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: statusDotColors[track.status] || '#718096',
                }}
              />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="idea">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#c7a008]" />
                Idea
              </span>
            </SelectItem>
            <SelectItem value="recording">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#00a8c6]" />
                Recording
              </span>
            </SelectItem>
            <SelectItem value="mixing">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#7b2cbf]" />
                Mixing
              </span>
            </SelectItem>
            <SelectItem value="final">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#4a8d6f]" />
                Final
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Version Panel — dark HUD tabs with chamfered corners */}
      <div
        className="relative shrink-0 px-4 py-3 lg:px-6"
        style={{
          borderBottom: `1px solid ${hexToRgba(C, 0.2)}`,
        }}
      >
        {/* Corner brackets — HUD strip indicators */}
        <div className="absolute top-0 left-0 w-3 h-3 pointer-events-none" style={{
          borderTop: '1.5px solid rgba(0,168,198,0.6)',
          borderLeft: '1.5px solid rgba(0,168,198,0.6)',
        }} />
        <div className="absolute bottom-0 right-0 w-3 h-3 pointer-events-none" style={{
          borderBottom: '1.5px solid rgba(199,160,8,0.6)',
          borderRight: '1.5px solid rgba(199,160,8,0.6)',
        }} />
        <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {versions.map((v) => {
            const isActive = activeVersion?.id === v.id;
            return (
              <motion.button
                key={v.id}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setActiveVersionId(v.id)}
                className={`shrink-0 px-4 py-2 text-xs font-semibold transition-all ${
                  isActive
                    ? 'text-white'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                style={
                  isActive
                    ? {
                        background: `linear-gradient(to right, ${P}, ${P2})`,
                        clipPath: CHAMFER_4,
                        boxShadow: `0 0 8px ${hexToRgba(P, 0.35)}, inset 0 1px 0 rgba(255,255,255,0.2)`,
                      }
                    : {
                        background: BG_CARD_PURPLE,
                        border: `1px solid ${hexToRgba(C, 0.25)}`,
                        clipPath: CHAMFER_4,
                        boxShadow: INSET_BEVEL_SHADOW,
                      }
                }
              >
                <span>{v.version === 1 && !v.label ? 'Original' : v.label || `v${v.version}`}</span>
                {v.commentCount !== undefined && v.commentCount > 0 && (
                  <span
                    className={`ml-2 px-1.5 py-0.5 text-[9px] ${
                      isActive ? 'text-white' : 'text-muted-foreground'
                    }`}
                    style={{
                      background: isActive ? hexToRgba(Y, 0.25) : BG_MAIN,
                      color: isActive ? Y : undefined,
                      clipPath: CHAMFER_3,
                    }}
                  >
                    {v.commentCount}
                  </span>
                )}
                {/* Active yellow indicator dot */}
                {isActive && (
                  <span
                    className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: Y, boxShadow: `0 0 4px ${hexToRgba(Y, 0.6)}` }}
                  />
                )}
              </motion.button>
            );
          })}
          {/* Add Version button — chamfered, yellow on hover */}
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowAddVersionDialog(true)}
            className="flex shrink-0 items-center gap-1.5 border border-dashed bg-transparent px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-[#c7a008]"
            style={{
              borderColor: hexToRgba(Y, 0.5),
              clipPath: CHAMFER_4,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = hexToRgba(Y, 0.6); }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = hexToRgba(Y, 0.5); }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Version
          </motion.button>
        </div>
        {/* Current version info */}
        {activeVersion && (
          <div className="mt-1.5 flex items-center gap-2 text-[10px]" style={{ color: `${TEXT_SECONDARY}b3`, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
            <span>Version {activeVersion.version}</span>
            <span style={{ color: Y }}>·</span>
            <span>{activeVersion.label || `v${activeVersion.version}`}</span>
            {activeVersion.durationMs && (
              <>
                <span style={{ color: Y }}>·</span>
                <span>{formatDuration(activeVersion.durationMs / 1000)}</span>
              </>
            )}
            {activeVersion.commentCount !== undefined && (
              <>
                <span style={{ color: Y }}>·</span>
                <span>{activeVersion.commentCount} comment{activeVersion.commentCount !== 1 ? 's' : ''}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Add Version Dialog */}
      <AddVersionDialog
        open={showAddVersionDialog}
        onOpenChange={setShowAddVersionDialog}
        onSubmit={handleAddVersion}
        isUploading={isUploadingVersion}
        uploadProgress={uploadProgress}
        nextVersion={versions.length + 1}
      />

      {/* ─── Kanban Progress Panel — track + project stats tree ─── */}
      <div
        className="relative shrink-0 px-4 py-3 lg:px-6"
        style={{
          borderBottom: `1px solid ${hexToRgba(C, 0.2)}`,
        }}
      >
        <div
          className="relative"
          style={{
            background: `linear-gradient(135deg, ${BG_PANEL} 0%, ${BG_MAIN} 100%)`,
            border: `1px solid ${hexToRgba(Y, 0.5)}`,
            clipPath: CHAMFER_8,
            boxShadow: `inset 0 1px 1px rgba(255,255,255,0.06), inset 0 -1px 1px rgba(0,0,0,0.8), 0 0 8px ${hexToRgba(Y, 0.15)}`,
          }}
        >
          <CornerBrackets size={12} />

          <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-3 lg:p-4">
            {/* Track progress — spans 2 columns on lg */}
            <div className="lg:col-span-2">
              {/* Section title */}
              <div className="mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4" style={{ color: Y, filter: `drop-shadow(0 0 4px ${hexToRgba(Y, 0.6)})` }} />
                <h3
                  className="text-[13px]"
                  style={{
                    ...SECTION_TITLE_STYLE,
                    fontSize: '13px',
                    letterSpacing: '2px',
                  }}
                >
                  Прогресс трека
                </h3>
              </div>

              {/* Waveform progress bar */}
              <WaveformProgressBar
                progress={trackProgress.pct}
                accentColor={Y}
                height={32}
                bars={24}
              />

              {/* Compact stats row — colored status dots */}
              <div
                className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px]"
                style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
              >
                <StatDot label="ВСЕГО" count={trackProgress.total} color={A} />
                <StatDot label="ГОТОВО" count={trackProgress.done} color={G} />
                <StatDot label="В РАБОТЕ" count={trackProgress.inProgress} color={C} />
                <StatDot label="ПРОВЕРКА" count={trackProgress.review} color={Y} />
                <StatDot label="TODO" count={trackProgress.todo} color={A} />
              </div>

              {/* Tree-like breakdown — one row per trackTask with mini progress bar */}
              {trackTasks.length > 0 && (
                <div
                  className="mt-3 max-h-44 overflow-y-auto pr-1"
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: `${hexToRgba(Y, 0.4)} transparent`,
                  }}
                >
                  <div className="flex flex-col gap-1.5">
                    {trackTasks.map((tt) => {
                      const subtasks = tt.children || [];
                      const subTotal = subtasks.length;
                      const subDone = subtasks.filter((c) => c.status === 'done').length;
                      const subPct = subTotal > 0 ? Math.round((subDone / subTotal) * 100) : 0;
                      return (
                        <div
                          key={tt.id}
                          className="flex items-center gap-2 px-2 py-1"
                          style={{
                            background: BG_MAIN,
                            border: `1px solid ${hexToRgba(C, 0.2)}`,
                            clipPath: CHAMFER_3,
                          }}
                        >
                          {/* Tree connector */}
                          <span
                            className="select-none"
                            style={{ color: hexToRgba(Y, 0.5), fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '10px' }}
                          >
                            ├─
                          </span>
                          {/* Title */}
                          <span
                            className="min-w-0 flex-1 truncate"
                            style={{
                              color: TEXT_PRIMARY,
                              fontFamily: 'var(--font-rajdhani), sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                            }}
                            title={tt.title}
                          >
                            {tt.title}
                          </span>
                          {/* Mini progress bar */}
                          <div
                            className="relative h-1.5 w-20 shrink-0"
                            style={{
                              background: BG_MAIN,
                              border: `0.5px solid ${hexToRgba(Y, 0.3)}`,
                              clipPath: CHAMFER_3,
                              boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.7)',
                            }}
                          >
                            <div
                              className="absolute inset-y-0 left-0"
                              style={{
                                width: `${subPct}%`,
                                background: `linear-gradient(to right, ${P}, ${Y})`,
                                boxShadow: `0 0 4px ${hexToRgba(Y, 0.5)}`,
                                transition: 'width 220ms ease',
                              }}
                            />
                          </div>
                          {/* Done/total count */}
                          <span
                            className="shrink-0 tabular-nums"
                            style={{
                              color: subDone === subTotal && subTotal > 0 ? G : Y,
                              fontFamily: 'var(--font-jetbrains-mono), monospace',
                              fontSize: '10px',
                              fontWeight: 700,
                              minWidth: '34px',
                              textAlign: 'right',
                            }}
                          >
                            {subDone}/{subTotal}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Project progress — compact summary, 1 column */}
            <div
              className="relative flex flex-col justify-between gap-2 p-2.5 lg:p-3"
              style={{
                background: BG_MAIN,
                border: `1px solid ${hexToRgba(C, 0.35)}`,
                clipPath: CHAMFER_5,
                boxShadow: INSET_BEVEL_SHADOW,
              }}
            >
              <div>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <LayoutDashboard className="h-3.5 w-3.5" style={{ color: C, filter: `drop-shadow(0 0 3px ${hexToRgba(C, 0.5)})` }} />
                  <span
                    className="text-[10px]"
                    style={{
                      ...SECTION_TITLE_STYLE,
                      fontSize: '10px',
                      letterSpacing: '1.5px',
                    }}
                  >
                    Проект
                  </span>
                </div>
                <div
                  className="truncate text-[11px]"
                  style={{
                    color: TEXT_PRIMARY,
                    fontFamily: 'var(--font-rajdhani), sans-serif',
                    fontWeight: 600,
                  }}
                  title={projectOfTrack?.title || '—'}
                >
                  {projectOfTrack?.title || '—'}
                </div>
              </div>

              {projectProgress ? (
                <>
                  {/* Big percentage readout */}
                  <div className="flex items-baseline gap-1">
                    <span
                      className="tabular-nums"
                      style={{
                        color: Y,
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                        fontSize: '24px',
                        fontWeight: 800,
                        lineHeight: 1,
                        textShadow: `0 0 6px ${hexToRgba(Y, 0.5)}`,
                      }}
                    >
                      {projectProgress.pct}
                    </span>
                    <span style={{ color: hexToRgba(Y, 0.6), fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '10px' }}>%</span>
                  </div>

                  {/* Mini project progress bar */}
                  <div
                    className="relative h-1.5 w-full"
                    style={{
                      background: BG_MAIN,
                      border: `0.5px solid ${hexToRgba(C, 0.3)}`,
                      clipPath: CHAMFER_3,
                      boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.7)',
                    }}
                  >
                    <div
                      className="absolute inset-y-0 left-0"
                      style={{
                        width: `${projectProgress.pct}%`,
                        background: `linear-gradient(to right, ${P}, ${Y})`,
                        boxShadow: `0 0 4px ${hexToRgba(Y, 0.5)}`,
                      }}
                    />
                  </div>

                  {/* Compact project stats */}
                  <div
                    className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px]"
                    style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                  >
                    <StatDot label="ВСЕГО" count={projectProgress.total} color={A} compact />
                    <StatDot label="ГОТОВО" count={projectProgress.done} color={G} compact />
                    <StatDot label="В РАБОТЕ" count={projectProgress.inProgress} color={C} compact />
                    <StatDot label="ПРОВЕРКА" count={projectProgress.review} color={Y} compact />
                  </div>
                </>
              ) : (
                <div
                  className="text-center text-[10px]"
                  style={{ color: TEXT_SECONDARY, fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                >
                  Нет kanban-задачи
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content — single full-width column (chat moved to global floating widget) */}
      <div className="min-h-0 flex-1">
        <div className="flex h-full flex-col">
          {/* Audio Player — HUD panel with chamfered corners, corner brackets, inset bevel */}
              <div
                className="relative shrink-0 p-4 lg:p-6"
                style={{
                  background: `linear-gradient(135deg, ${BG_PANEL} 0%, ${BG_MAIN} 100%)`,
                  border: `1px solid ${hexToRgba(Y, 0.5)}`,
                  clipPath: CHAMFER_8,
                  boxShadow: `inset 0 1px 1px rgba(255,255,255,0.06), inset 0 -1px 1px rgba(0,0,0,0.8), 0 0 8px ${hexToRgba(Y, 0.15)}`,
                }}
              >
                <CornerBrackets size={12} />
                {/* Seek bar */}
                <div className="mb-4">
                  <div
                    className="group relative h-2 w-full cursor-pointer"
                    style={{
                      background: BG_MAIN,
                      clipPath: CHAMFER_3,
                      boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.7)',
                    }}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const p = x / rect.width;
                      seekTo(p * duration);
                    }}
                  >
                    {/* Background track — purple→cyan gradient fill with yellow glow */}
                    <div
                      className="absolute inset-y-0 left-0 transition-all duration-100"
                      style={{
                        width: `${progress * 100}%`,
                        background: `linear-gradient(to right, ${P}, ${Y})`,
                        boxShadow: `0 0 8px ${hexToRgba(Y, 0.6)}, 0 0 4px ${hexToRgba(Y, 0.4)}`,
                        clipPath: CHAMFER_3,
                      }}
                    />
                    {/* Thumb */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full bg-white shadow-lg opacity-0 transition-opacity group-hover:opacity-100"
                      style={{
                        left: `${progress * 100}%`,
                        boxShadow: `0 0 8px ${hexToRgba(C, 0.6)}`,
                      }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[11px]" style={{ color: TEXT_SECONDARY, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                    <span>{formatDuration(currentTime)}</span>
                    <span>{formatDuration(displayDuration)}</span>
                  </div>
                </div>

                {/* Controls row */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-none border-0 hover:bg-[#c7a008]/10 hover:text-[#c7a008]"
                          style={{
                            clipPath: CHAMFER_4,
                            border: `1px solid ${hexToRgba(Y, 0.5)}`,
                            background: BG_MAIN,
                            color: Y,
                          }}
                          onClick={() => skip(-5)}
                        >
                          <SkipBack className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Back 5s</TooltipContent>
                    </Tooltip>

                    <Button
                      size="icon"
                      className="h-11 w-11 rounded-none border-0"
                      style={{
                        clipPath: CHAMFER_4,
                        background: `linear-gradient(135deg, ${P} 0%, ${P2} 100%)`,
                        boxShadow: `0 0 12px ${hexToRgba(P, 0.5)}, 0 0 4px ${hexToRgba(Y, 0.5)}, inset 0 1px 0 rgba(255,255,255,0.2)`,
                        border: `1.5px solid ${hexToRgba(Y, 0.4)}`,
                      }}
                      onClick={togglePlay}
                    >
                      {isPlaying ? (
                        <Pause className="h-5 w-5" style={{ color: '#fff', filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.5))' }} />
                      ) : (
                        <Play className="h-5 w-5 ml-0.5" style={{ color: Y, filter: `drop-shadow(0 0 2px ${Y})` }} />
                      )}
                    </Button>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-none border-0 hover:bg-[#c7a008]/10 hover:text-[#c7a008]"
                          style={{
                            clipPath: CHAMFER_4,
                            border: `1px solid ${hexToRgba(Y, 0.5)}`,
                            background: BG_MAIN,
                            color: Y,
                          }}
                          onClick={() => skip(5)}
                        >
                          <SkipForward className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Forward 5s</TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Volume */}
                  <div className="flex items-center gap-2 ml-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-none border-0 hover:bg-[#00a8c6]/10 hover:text-[#00a8c6]"
                          style={{
                            clipPath: CHAMFER_4,
                            border: `1px solid ${hexToRgba(C, 0.3)}`,
                            background: BG_MAIN,
                          }}
                          onClick={() => setIsMuted(!isMuted)}
                        >
                          {isMuted || volume === 0 ? (
                            <VolumeX className="h-4 w-4" />
                          ) : (
                            <Volume2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isMuted ? 'Unmute' : 'Mute'}
                      </TooltipContent>
                    </Tooltip>
                    <div
                      className="group relative h-1.5 w-24 cursor-pointer"
                      style={{
                        background: BG_MAIN,
                        clipPath: CHAMFER_3,
                        boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.7)',
                      }}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        setVolume(Math.max(0, Math.min(1, x / rect.width)));
                        if (isMuted) setIsMuted(false);
                      }}
                    >
                      <div
                        className="absolute inset-y-0 left-0 transition-all"
                        style={{
                          width: `${(isMuted ? 0 : volume) * 100}%`,
                          background: `linear-gradient(to right, ${C2}, ${C})`,
                          clipPath: CHAMFER_3,
                        }}
                      />
                    </div>
                  </div>

                  {/* Keyboard shortcut hint */}
                  <p className="ml-auto hidden text-[11px] lg:block" style={{ color: `${TEXT_SECONDARY}cc`, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                    Space: Play/Pause · ←→: Skip 5s
                  </p>
                </div>
              </div>

              {/* Waveform */}
              <div className="shrink-0 px-4 pt-4 lg:px-6">
                {/* Marker mode toolbar — always visible near waveform */}
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium uppercase tracking-widest" style={{ color: TEXT_SECONDARY, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>Marker:</span>
                    <div
                      className="flex items-center border p-0.5"
                      style={{
                        background: BG_MAIN,
                        border: `1px solid ${hexToRgba(BORDER_MUTED, 1)}`,
                        clipPath: CHAMFER_3,
                      }}
                    >
                      <button
                        onClick={() => {
                          setMarkerMode('point');
                          setIsSelectingRange(false);
                        }}
                        className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-all ${
                          markerMode === 'point'
                            ? 'text-black shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        style={
                          markerMode === 'point'
                            ? { background: C, clipPath: CHAMFER_3, boxShadow: `0 0 6px ${hexToRgba(Y, 0.5)}` }
                            : undefined
                        }
                      >
                        <MapPin className="h-3 w-3" />
                        Point
                      </button>
                      <button
                        onClick={() => {
                          setMarkerMode('range');
                          setIsSelectingRange(false);
                        }}
                        className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-all ${
                          markerMode === 'range'
                            ? 'text-black shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        style={
                          markerMode === 'range'
                            ? { background: Y, clipPath: CHAMFER_3, boxShadow: `0 0 6px ${hexToRgba(Y, 0.5)}` }
                            : undefined
                        }
                      >
                        <MoveHorizontal className="h-3 w-3" />
                        Range
                      </button>
                    </div>
                    <span className="text-[10px]" style={{ color: `${TEXT_SECONDARY}b3` }}>
                      {markerMode === 'range'
                        ? 'Click waveform to set start, then click again for end'
                        : 'Click on waveform to place a pin marker'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {markerMode === 'range' && isSelectingRange && rangeStartMs > 0 && (
                      <Badge variant="outline" className="border-[#c7a008]/30 text-[#c7a008] text-[10px] animate-pulse">
                        Start: {formatTimestamp(rangeStartMs)} — click end point…
                      </Badge>
                    )}
                    {markerMode === 'range' && !isSelectingRange && rangeEndMsState > rangeStartMs && rangeStartMs > 0 && (
                      <Badge variant="outline" className="border-[#00a8c6]/30 text-[#00a8c6] text-[10px]">
                        {formatTimestamp(rangeStartMs)} → {formatTimestamp(rangeEndMsState)}
                        <span className="ml-1 text-muted-foreground/50">
                          ({formatDuration((rangeEndMsState - rangeStartMs) / 1000)})
                        </span>
                      </Badge>
                    )}
                    {markerMode === 'point' && commentTimestamp > 0 && (
                      <Badge variant="outline" className="border-[#00a8c6]/30 text-[#00a8c6] text-[10px]">
                        {formatTimestamp(commentTimestamp)}
                      </Badge>
                    )}
                  </div>
                </div>

                <div
                  className={`relative border p-3 transition-colors ${
                    markerMode === 'range'
                      ? 'border-[#c7a008]/30'
                      : 'border-[#1f2633]'
                  }`}
                  style={{
                    background: `linear-gradient(135deg, ${BG_CARD_TEAL} 0%, ${BG_MAIN} 100%)`,
                    border: `1px solid ${hexToRgba(Y, 0.5)}`,
                    clipPath: CHAMFER_8,
                    boxShadow: `inset 0 1px 1px rgba(255,255,255,0.06), inset 0 -1px 1px rgba(0,0,0,0.8), 0 0 8px ${hexToRgba(Y, 0.15)}`,
                  }}
                >
                  <CornerBrackets size={10} />
                  {/* Empty state — show glowing waveform placeholder */}
                  {!currentAudioUrl && (
                    <div className="flex h-24 flex-col items-center justify-center gap-2 relative overflow-hidden">
                      {/* Glowing waveform bars placeholder */}
                      <div className="flex items-center gap-[2px] h-12 mb-2">
                        {Array.from({ length: 40 }).map((_, i) => (
                          <div key={i} style={{
                            width: '2px',
                            height: `${30 + Math.sin(i * 0.5) * 30 + Math.random() * 20}%`,
                            background: `linear-gradient(180deg, ${hexToRgba(P, 0.6)}, ${hexToRgba(C, 0.6)})`,
                            boxShadow: `0 0 3px ${hexToRgba(C, 0.4)}`,
                            borderRadius: '1px',
                            opacity: 0.7,
                          }} />
                        ))}
                      </div>
                      <Music2 className="h-5 w-5" style={{ color: Y, filter: `drop-shadow(0 0 3px ${hexToRgba(Y, 0.4)})` }} />
                      <span className="text-xs" style={{ color: Y, fontFamily: 'var(--font-jetbrains-mono), monospace', opacity: 0.6 }}>
                        Нет аудио — загрузите версию или добавьте аудио
                      </span>
                    </div>
                  )}
                  {!waveformReady && currentAudioUrl && (
                    <div className="flex h-24 items-center justify-center">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#7b2cbf] border-t-transparent" />
                      <span className="ml-2 text-xs text-muted-foreground">
                        Loading waveform...
                      </span>
                    </div>
                  )}
                  <div className="relative"
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const pct = x / rect.width;
                      if (duration > 0 && waveformReady) {
                        const ms = Math.round(pct * duration * 1000);
                        setWaveformHoverTime({ x, ms });
                      }
                    }}
                    onMouseLeave={() => setWaveformHoverTime(null)}
                  >
                    <canvas
                      ref={canvasRef}
                      className={`h-24 w-full ${!waveformReady ? 'hidden' : ''} ${
                        markerMode === 'range'
                          ? 'cursor-ew-resize'
                          : 'cursor-crosshair'
                      }`}
                      onClick={handleWaveformClick}
                    />
                    {/* Hover time tooltip — follows cursor along waveform — yellow HUD chip */}
                    {waveformHoverTime && (
                      <div
                        className="pointer-events-none absolute top-1 z-20 -translate-x-1/2"
                        style={{ left: waveformHoverTime.x }}
                      >
                        <span
                          className="px-1.5 py-0.5 text-[10px] font-bold shadow-lg"
                          style={{
                            background: hexToRgba(Y, 0.95),
                            color: '#0a0b10',
                            clipPath: CHAMFER_3,
                            fontFamily: 'var(--font-jetbrains-mono), monospace',
                          }}
                        >
                          {formatTimestamp(waveformHoverTime.ms)}
                        </span>
                      </div>
                    )}
                    {/* Range highlight bars for range comments */}
                    {waveformReady && displayDuration > 0 &&
                      comments
                        .filter((c) => activeVersion?.id && c.versionId === activeVersion.id && c.rangeEndMs && c.rangeEndMs > c.timestampMs)
                        .map((comment) => {
                        const startPct = duration > 0 ? (comment.timestampMs / 1000) / duration : 0;
                        const endPct = duration > 0 ? (comment.rangeEndMs! / 1000) / duration : 0;
                        const isFocused = focusedCommentId === comment.id;
                        const isHovered = hoveredMarkerId === comment.id;
                        return (
                          <div
                            key={`range-${comment.id}`}
                            className={`absolute top-0 h-full z-[5] rounded-sm transition-all pointer-events-none ${
                              isFocused ? 'bg-[#c7a008]/15 border-y-2 border-[#c7a008]/60' :
                              isHovered ? 'bg-[#c7a008]/10 border-y-2 border-[#c7a008]/40' :
                              comment.isResolved ? 'bg-[#4a8d6f]/8 border-y-2 border-[#4a8d6f]/20' :
                              'bg-[#c7a008]/8 border-y-2 border-[#c7a008]/20'
                            }`}
                            style={{
                              left: `${startPct * 100}%`,
                              width: `${(endPct - startPct) * 100}%`,
                            }}
                          />
                        );
                      })
                    }
                    {/* Range selection preview (while user is selecting a range) */}
                    {waveformReady && displayDuration > 0 && isSelectingRange && rangeStartMs > 0 && (
                      <div className="contents">
                        <div
                          className="absolute top-0 h-full z-[6] bg-[#c7a008]/10 border-y-2 border-[#c7a008]/40 pointer-events-none"
                          style={{
                            left: `${(rangeStartMs / 1000 / duration) * 100}%`,
                            width: `${((rangeEndMsState - rangeStartMs) / 1000 / duration) * 100}%`,
                          }}
                        />
                        <div
                          className="absolute top-0 z-[7] h-full w-0.5 bg-[#c7a008] pointer-events-none"
                          style={{ left: `${(rangeStartMs / 1000 / duration) * 100}%` }}
                        />
                        {rangeEndMsState > rangeStartMs && (
                          <div
                            className="absolute top-0 z-[7] h-full w-0.5 bg-[#c7a008] pointer-events-none"
                            style={{ left: `${(rangeEndMsState / 1000 / duration) * 100}%` }}
                          />
                        )}
                      </div>
                    )}
                    {/* HTML overlay markers for interactive hover/click — only for active version */}
                    {waveformReady && displayDuration > 0 &&
                      comments
                        .filter((c) => activeVersion?.id && c.versionId === activeVersion.id)
                        .map((comment) => {
                        const pct = duration > 0 ? (comment.timestampMs / 1000) / duration : 0;
                        if (pct < 0 || pct > 1) return null;
                        const isHovered = hoveredMarkerId === comment.id;
                        const isFocused = focusedCommentId === comment.id;
                        const isRange = !!(comment.rangeEndMs && comment.rangeEndMs > comment.timestampMs);
                        return (
                          <motion.button
                            key={comment.id}
                            onMouseEnter={(e) => {
                              if (markerHideTimerRef.current) {
                                clearTimeout(markerHideTimerRef.current);
                                markerHideTimerRef.current = null;
                              }
                              const rect = e.currentTarget.getBoundingClientRect();
                              const isRight = rect.left > window.innerWidth / 2;
                              setHoveredMarkerId(comment.id);
                              setMarkerTooltipPos({ top: rect.top - 8, left: isRight ? rect.right : rect.left, right: isRight });
                            }}
                            onMouseLeave={() => {
                              markerTooltipHoverRef.current = false;
                              markerHideTimerRef.current = setTimeout(() => {
                                if (!markerTooltipHoverRef.current) {
                                  setHoveredMarkerId(null);
                                  setMarkerTooltipPos(null);
                                }
                              }, 200);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkerClick(comment);
                            }}
                            initial={false}
                            animate={{ scale: isHovered ? 1.6 : isFocused ? 1.4 : 1, y: isHovered ? -2 : 0 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                            className="absolute top-0 z-10 flex items-center justify-center -translate-x-1/2 cursor-pointer"
                            style={{ left: `${pct * 100}%` }}
                            title={''}
                          >
                            {/* Marker shape: pin (circle) for point, diamond for range */}
                            {isRange ? (
                              <>
                                {/* Range marker: diamond shape */}
                                <div
                                  className={`rotate-45 transition-all duration-150 ${
                                    isFocused
                                      ? 'h-4 w-4 bg-[#c7a008] shadow-[0_0_10px_rgba(199,160,8,0.6)]'
                                      : isHovered
                                        ? 'h-3.5 w-3.5 bg-[#c7a008]/80 shadow-[0_0_8px_rgba(199,160,8,0.5)]'
                                        : comment.isResolved
                                          ? 'h-2.5 w-2.5 bg-[#4a8d6f]'
                                          : 'h-2.5 w-2.5 bg-[#c7a008]'
                                  }`}
                                />
                                {/* Vertical line */}
                                <div
                                  className={`absolute left-1/2 top-full h-4 w-0.5 -translate-x-1/2 -rotate-0 transition-colors ${
                                    isFocused ? 'bg-[#c7a008]/60' : isHovered ? 'bg-[#c7a008]/40' : 'bg-[#c7a008]/20'
                                  }`}
                                />
                              </>
                            ) : (
                              <>
                                {/* Point marker: circle pin */}
                                <div
                                  className={`rounded-full border-2 transition-all duration-150 ${
                                    isFocused
                                      ? 'h-4 w-4 border-[#00a8c6] bg-[#00a8c6]/30 shadow-[0_0_8px_rgba(0,168,198,0.5)]'
                                      : isHovered
                                        ? 'h-3.5 w-3.5 border-[#00a8c6] bg-[#00a8c6]/40 shadow-[0_0_8px_rgba(0,168,198,0.5)]'
                                        : comment.isResolved
                                          ? 'h-2.5 w-2.5 border-[#4a8d6f] bg-[#4a8d6f]'
                                          : 'h-2.5 w-2.5 border-[#00a8c6] bg-[#00a8c6]'
                                  }`}
                                  style={{ borderColor: 'inherit' }}
                                >
                                  <div className="m-auto h-1 w-1 rounded-full bg-white" />
                                </div>

                                {/* Vertical line down from pin */}
                                <div
                                  className={`absolute left-1/2 top-full h-4 w-px -translate-x-1/2 transition-colors ${
                                    isFocused ? 'bg-[#00a8c6]/60' : isHovered ? 'bg-[#00a8c6]/40' : 'bg-[#00a8c6]/20'
                                  }`}
                                />
                              </>
                            )}

                          </motion.button>
                        );
                      })}
                    {/* Range END markers — smaller diamonds at the end position of range comments */}
                    {waveformReady && displayDuration > 0 &&
                      comments
                        .filter((c) => activeVersion?.id && c.versionId === activeVersion.id && c.rangeEndMs && c.rangeEndMs > c.timestampMs)
                        .map((comment) => {
                          const endPct = duration > 0 ? (comment.rangeEndMs! / 1000) / duration : 0;
                          if (endPct < 0 || endPct > 1) return null;
                          const isFocused = focusedCommentId === comment.id;
                          const isHovered = hoveredMarkerId === comment.id;
                          return (
                            <motion.button
                              key={`end-marker-${comment.id}`}
                              onMouseEnter={(e) => {
                                if (markerHideTimerRef.current) {
                                  clearTimeout(markerHideTimerRef.current);
                                  markerHideTimerRef.current = null;
                                }
                                const rect = e.currentTarget.getBoundingClientRect();
                                const isRight = rect.left > window.innerWidth / 2;
                                setHoveredMarkerId(comment.id);
                                setMarkerTooltipPos({ top: rect.top - 8, left: isRight ? rect.right : rect.left, right: isRight });
                              }}
                              onMouseLeave={() => {
                                markerTooltipHoverRef.current = false;
                                markerHideTimerRef.current = setTimeout(() => {
                                  if (!markerTooltipHoverRef.current) {
                                    setHoveredMarkerId(null);
                                    setMarkerTooltipPos(null);
                                  }
                                }, 200);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkerClick(comment);
                              }}
                              initial={false}
                              animate={{ scale: isHovered ? 1.6 : isFocused ? 1.4 : 1, y: isHovered ? -2 : 0 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                              className="absolute top-0 z-10 flex items-center justify-center -translate-x-1/2 cursor-pointer"
                              style={{ left: `${endPct * 100}%` }}
                              title={''}
                            >
                              <div
                                className={`rotate-45 transition-all duration-150 ${
                                  isFocused
                                    ? 'h-3.5 w-3.5 bg-[#c7a008] shadow-[0_0_8px_rgba(199,160,8,0.5)]'
                                    : isHovered
                                      ? 'h-3 w-3 bg-[#c7a008]/80 shadow-[0_0_6px_rgba(199,160,8,0.4)]'
                                      : comment.isResolved
                                        ? 'h-2 w-2 bg-[#4a8d6f]'
                                        : 'h-2 w-2 bg-[#c7a008]'
                                }`}
                              />
                              <div
                                className={`absolute left-1/2 top-full h-3 w-0.5 -translate-x-1/2 transition-colors ${
                                  isFocused ? 'bg-[#c7a008]/50' : isHovered ? 'bg-[#c7a008]/35' : 'bg-[#c7a008]/15'
                                }`}
                              />
                            </motion.button>
                          );
                        })}
                  </div>
                  <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
                    {currentAudioUrl
                      ? `Click on waveform to seek · ${markerMode === 'range' ? 'First click sets range start, second click sets end' : 'Click to place a marker at that position'}`
                      : 'Upload audio to enable waveform interaction'}
                  </p>
                </div>
              </div>

              {/* Marker hover tooltip — rendered via portal to escape overflow clipping */}
              {hoveredMarkerId && markerTooltipPos && (() => {
                const comment = comments.find((c) => c.id === hoveredMarkerId);
                if (!comment) return null;
                return createPortal(
                  <AnimatePresence>
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.95 }}
                      transition={{ duration: 0.12 }}
                      className="relative fixed z-[9999] px-3 py-2 shadow-2xl shadow-black/70"
                      style={{
                        background: BG_PANEL,
                        border: `1px solid ${hexToRgba(C, 0.4)}`,
                        clipPath: CHAMFER_5,
                        boxShadow: INSET_BEVEL_SHADOW,
                        bottom: window.innerHeight - markerTooltipPos.top + 4,
                        left: markerTooltipPos.right ? 'auto' : markerTooltipPos.left,
                        right: markerTooltipPos.right ? window.innerWidth - markerTooltipPos.left : 'auto',
                        minWidth: 200,
                        maxWidth: 280,
                        whiteSpace: 'normal',
                        transform: markerTooltipPos.right ? 'translateX(100%)' : 'translateX(-50%)',
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onMouseEnter={() => {
                        markerTooltipHoverRef.current = true;
                        if (markerHideTimerRef.current) {
                          clearTimeout(markerHideTimerRef.current);
                          markerHideTimerRef.current = null;
                        }
                      }}
                      onMouseLeave={() => {
                        markerTooltipHoverRef.current = false;
                        setHoveredMarkerId(null);
                        setMarkerTooltipPos(null);
                      }}
                    >
                      <CornerBrackets size={8} />
                      <div className="flex items-center gap-2">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#7b2cbf]/20 text-[9px] font-bold text-[#7b2cbf]">
                          {getInitials(comment.userName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-semibold text-foreground leading-tight">
                            {comment.userName}
                            {commentNumberMap.get(comment.id) && (
                              <span className="ml-1.5 text-xs font-bold" style={{ color: Y }}>
                                #{commentNumberMap.get(comment.id)}
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-muted-foreground leading-tight">
                            {comment.rangeEndMs && comment.rangeEndMs > comment.timestampMs
                              ? `${formatTimestamp(comment.timestampMs)} → ${formatTimestamp(comment.rangeEndMs)}`
                              : formatTimestamp(comment.timestampMs)} · {format(new Date(comment.createdAt), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </div>
                      <div className="mt-1 border-t border-border/50 pt-1">
                        <p className="line-clamp-3 text-[10px] text-muted-foreground/70">
                          {comment.text}
                        </p>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1 border-t border-border/50 pt-1.5">
                        <button
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-[#7b2cbf]/15 hover:text-[#7b2cbf]"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingComment(comment);
                            handleMarkerClick(comment);
                          }}
                        >
                          <Pencil className="h-2.5 w-2.5" />
                          Edit
                        </button>
                        <button
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-[#4a8d6f]/15 hover:text-[#4a8d6f]"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleResolved(comment.id, comment.isResolved);
                          }}
                        >
                          {comment.isResolved ? <DoubleCheckIcon className="h-2.5 w-2.5" /> : <Check className="h-2.5 w-2.5" />}
                          {comment.isResolved ? 'Unresolve' : 'Resolve'}
                        </button>
                        <button
                          className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-red-500/15 hover:text-red-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteComment(comment.id);
                          }}
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                          Delete
                        </button>
                      </div>
                    </motion.div>
                  </AnimatePresence>,
                  document.body
                );
              })()}

              {/* Comments Section */}
              <div className="flex min-h-0 flex-1 flex-col px-4 pt-4 lg:px-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" style={{ color: Y }} />
                    <h2
                      className="text-sm font-semibold uppercase"
                      style={{ ...SECTION_TITLE_STYLE, color: '#ffffff' }}
                    >
                      Комментарии по таймстемпам
                    </h2>
                    <Badge
                      variant="secondary"
                      className="h-5 px-1.5 text-[10px]"
                      style={{
                        background: hexToRgba(Y, 0.15),
                        color: Y,
                        border: `0.5px solid ${hexToRgba(Y, 0.5)}`,
                        clipPath: CHAMFER_3,
                      }}
                    >
                      {comments.length}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs border-0 rounded-none"
                    style={{
                      ...YELLOW_BUTTON_STYLE,
                      paddingRight: '10px',
                      paddingLeft: '10px',
                      paddingTop: '4px',
                      paddingBottom: '4px',
                    }}
                    onClick={() => {
                      setCommentTimestamp(Math.round(currentTime * 1000));
                      setRangeStartMs(0);
                      setRangeEndMsState(0);
                      setIsSelectingRange(false);
                      setShowCommentInput(true);
                    }}
                  >
                    <Plus className="h-3 w-3" />
                    Add Comment
                  </Button>
                </div>

                {/* Participant presence — online indicators (chat moved to global floating widget) */}
                {groupMembers.length > 0 && (
                  <div
                    className="relative mb-3 flex items-center gap-2 px-3 py-2"
                    style={{
                      background: BG_PANEL,
                      border: `1px solid ${hexToRgba(C, 0.4)}`,
                      clipPath: CHAMFER_5,
                      boxShadow: INSET_BEVEL_SHADOW,
                    }}
                  >
                    <CornerBrackets size={8} />
                    <div className="flex items-center">
                      {groupMembers.slice(0, 6).map((member, idx) => {
                        const isOnline = onlineUserIds.has(member.userId);
                        return (
                          <div
                            key={member.userId}
                            className="relative"
                            style={{ marginLeft: idx > 0 ? '-6px' : '0', zIndex: 6 - idx }}
                          >
                            <Avatar className="h-6 w-6 border-2 border-background">
                              <AvatarFallback
                                className={`text-[8px] ${
                                  isOnline
                                    ? 'bg-[#4a8d6f]/20 text-[#4a8d6f]'
                                    : 'bg-[#161224] text-muted-foreground'
                                }`}
                              >
                                {getInitials(member.displayName)}
                              </AvatarFallback>
                            </Avatar>
                            {/* Online indicator dot */}
                            <div
                              className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-background ${
                                isOnline ? 'bg-[#4a8d6f]' : 'bg-[#718096]'
                              }`}
                            />
                          </div>
                        );
                      })}
                      {groupMembers.length > 6 && (
                        <div
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-[#161224] border-2 border-background text-[8px] font-medium text-muted-foreground"
                          style={{ marginLeft: '-6px', zIndex: 0 }}
                        >
                          +{groupMembers.length - 6}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px]" style={{ color: TEXT_SECONDARY, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                      <span style={{ color: G }}>{onlineUserIds.size} online</span> · {groupMembers.length} member{groupMembers.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}

                <AnimatePresence>
                  {showCommentInput && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-3 overflow-hidden"
                    >
                      <div
                        className="relative border p-3"
                        style={{
                          background: BG_PANEL,
                          borderColor: markerMode === 'range' ? hexToRgba(Y, 0.5) : hexToRgba(C, 0.3),
                          clipPath: CHAMFER_5,
                          boxShadow: INSET_BEVEL_SHADOW,
                        }}
                      >
                        <CornerBrackets size={8} />
                        <CardContent className="p-0">
                          {/* Marker mode toggle */}
                          <div className="mb-2 flex items-center gap-2">
                            <div
                              className="flex items-center border p-0.5"
                              style={{
                                background: BG_MAIN,
                                border: `1px solid ${BORDER_MUTED}`,
                                clipPath: CHAMFER_3,
                              }}
                            >
                              <button
                                onClick={() => {
                                  setMarkerMode('point');
                                  setIsSelectingRange(false);
                                }}
                                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-medium transition-all ${
                                  markerMode === 'point'
                                    ? 'bg-[#00a8c6] text-black shadow-sm shadow-[#00a8c6]/30'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                <MapPin className="h-2.5 w-2.5" />
                                Point
                              </button>
                              <button
                                onClick={() => {
                                  setMarkerMode('range');
                                  setIsSelectingRange(false);
                                }}
                                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-medium transition-all ${
                                  markerMode === 'range'
                                    ? 'bg-[#c7a008] text-black shadow-sm shadow-[#c7a008]/30'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                <MoveHorizontal className="h-2.5 w-2.5" />
                                Range
                              </button>
                            </div>

                            {/* Timestamp / range display */}
                            {markerMode === 'range' ? (
                              <div className="flex items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className="border-[#c7a008]/30 text-[#c7a008] text-[10px]"
                                >
                                  {formatTimestamp(rangeStartMs || commentTimestamp || Math.round(currentTime * 1000))}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">→</span>
                                {isSelectingRange ? (
                                  <Badge
                                    variant="outline"
                                    className="border-[#c7a008]/30 text-[#c7a008] text-[10px] animate-pulse"
                                  >
                                    Click end point…
                                  </Badge>
                                ) : rangeEndMsState > 0 ? (
                                  <Badge
                                    variant="outline"
                                    className="border-[#c7a008]/30 text-[#c7a008] text-[10px]"
                                  >
                                    {formatTimestamp(rangeEndMsState)}
                                  </Badge>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground/60">
                                    Click start on waveform
                                  </span>
                                )}
                                {rangeEndMsState > rangeStartMs && (
                                  <span className="text-[9px] text-muted-foreground/50">
                                    ({formatDuration((rangeEndMsState - rangeStartMs) / 1000)})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className="border-[#00a8c6]/30 text-[#00a8c6] text-[10px]"
                                >
                                  {formatTimestamp(commentTimestamp || Math.round(currentTime * 1000))}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  at this timestamp
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Range selection in-progress indicator on waveform hint */}
                          {markerMode === 'range' && isSelectingRange && (
                            <p className="mb-2 text-[10px] text-[#c7a008]">
                              📍 Range start set — now click on the waveform to set the end point
                            </p>
                          )}

                          <Input
                            placeholder="Write your comment..."
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if (markerMode === 'range' && isSelectingRange) return; // don't submit while selecting
                                handleAddComment();
                              }
                              if (e.key === 'Escape') {
                                setShowCommentInput(false);
                                setNewCommentText('');
                                setRangeStartMs(0);
                                setRangeEndMsState(0);
                                setIsSelectingRange(false);
                              }
                            }}
                            className="mb-2 h-8 text-sm border-0 rounded-none"
                            style={HUD_INPUT_STYLE}
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                setShowCommentInput(false);
                                setNewCommentText('');
                                setRangeStartMs(0);
                                setRangeEndMsState(0);
                                setIsSelectingRange(false);
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 border-0 rounded-none text-xs"
                              style={{
                                ...YELLOW_BUTTON_STYLE,
                                paddingRight: '10px',
                                paddingLeft: '10px',
                                paddingTop: '4px',
                                paddingBottom: '4px',
                              }}
                              onClick={handleAddComment}
                              disabled={!newCommentText.trim() || (markerMode === 'range' && isSelectingRange)}
                            >
                              Post Comment
                            </Button>
                          </div>
                        </CardContent>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <ScrollArea className="flex-1" style={{ minHeight: 0 }}>
                  <div className="space-y-2 pb-4">
                    {(() => {
                      const versionComments = comments.filter((c) => activeVersion?.id && c.versionId === activeVersion.id);
                      const tree = buildCommentTree(versionComments);
                      if (tree.length === 0) return (
                        <div
                          className="relative flex flex-col items-center justify-center py-8"
                          style={{
                            background: BG_PANEL,
                            border: `1px solid ${hexToRgba(C, 0.4)}`,
                            clipPath: CHAMFER_5,
                            padding: '32px',
                            boxShadow: INSET_BEVEL_SHADOW,
                          }}
                        >
                          <CornerBrackets size={10} />
                          <MessageCircle className="mb-2 h-8 w-8" style={{ color: hexToRgba(Y, 0.5) }} />
                          <p className="text-xs" style={{ color: TEXT_SECONDARY, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>No comments yet. Click the waveform to add one.</p>
                        </div>
                      );
                      return tree.map((comment) => (
                        <div key={comment.id}>
                          {/* TOP-LEVEL COMMENT CARD — dark purple HUD slab, chamfered */}
                          <motion.div
                            id={`comment-${comment.id}`}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`group relative border p-3 transition-colors ${
                              focusedCommentId === comment.id
                                ? comment.rangeEndMs && comment.rangeEndMs > comment.timestampMs
                                  ? 'border-[#c7a008]/50'
                                  : 'border-[#00a8c6]/50'
                                : comment.isResolved
                                  ? 'border-[#1f2633]'
                                  : 'border-[#1f2633]'
                            }`}
                            style={{
                              background: comment.isResolved ? BG_MAIN : BG_CARD_TEAL,
                              clipPath: CHAMFER_8,
                              opacity: comment.isResolved ? 0.6 : 1,
                              borderTop: `2px solid ${comment.isResolved ? BORDER_MUTED : C}`,
                              boxShadow: INSET_BEVEL_SHADOW,
                            }}
                          >
                            <CornerBrackets size={8} />
                            <div className="flex items-start gap-2.5">
                              <Avatar className="h-6 w-6 shrink-0">
                                <AvatarFallback className="text-[9px] bg-[#161224] text-muted-foreground">
                                  {getInitials(comment.userName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <Badge
                                    variant="outline"
                                    className="h-5 px-1.5 text-xs font-bold border-0"
                                    style={{
                                      background: hexToRgba(Y, 0.15),
                                      color: Y,
                                      border: `0.5px solid ${hexToRgba(Y, 0.4)}`,
                                      clipPath: CHAMFER_3,
                                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                                    }}
                                  >
                                    #{commentNumberMap.get(comment.id) ?? '?'}
                                  </Badge>
                                  <span className="text-xs font-medium text-foreground">
                                    {comment.userName}
                                  </span>
                                  {comment.rangeEndMs && comment.rangeEndMs > comment.timestampMs ? (
                                    <MoveHorizontal className="h-3 w-3 text-[#c7a008] shrink-0" />
                                  ) : (
                                    <MapPin className="h-3 w-3 text-[#00a8c6] shrink-0" />
                                  )}
                                  <Badge
                                    variant="outline"
                                    className={`h-4 px-1 text-[10px] cursor-pointer transition-colors ${
                                      comment.rangeEndMs && comment.rangeEndMs > comment.timestampMs
                                        ? 'border-[#c7a008]/30 text-[#c7a008] hover:bg-[#c7a008]/10'
                                        : 'border-[#00a8c6]/30 text-[#00a8c6] hover:bg-[#00a8c6]/10'
                                    }`}
                                    style={{
                                      clipPath: CHAMFER_3,
                                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                                    }}
                                    onClick={() => seekTo(comment.timestampMs / 1000)}
                                  >
                                    {comment.rangeEndMs && comment.rangeEndMs > comment.timestampMs
                                      ? `${formatTimestamp(comment.timestampMs)} → ${formatTimestamp(comment.rangeEndMs)}`
                                      : formatTimestamp(comment.timestampMs)}
                                  </Badge>
                                  {/* Resolve checkmark — after timestamp, left side */}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        className={`rounded p-0.5 transition-colors ${
                                          comment.isResolved
                                            ? 'text-[#4a8d6f] hover:bg-[#4a8d6f]/15'
                                            : 'text-muted-foreground/40 hover:bg-[#4a8d6f]/15 hover:text-[#4a8d6f]'
                                        }`}
                                        onClick={() => handleToggleResolved(comment.id, comment.isResolved)}
                                      >
                                        {comment.isResolved ? <DoubleCheckIcon className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>{comment.isResolved ? 'Unresolve' : 'Resolve'}</TooltipContent>
                                  </Tooltip>
                                  {/* Edit / Delete actions */}
                                  <div className="ml-auto flex items-center gap-0.5 opacity-40 transition-opacity hover:opacity-100">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          className="rounded p-1 text-muted-foreground transition-colors hover:bg-[#7b2cbf]/15 hover:text-[#7b2cbf]"
                                          onClick={() => startEditingComment(comment)}
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent>Edit comment</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          className="rounded p-1 text-muted-foreground transition-colors hover:bg-red-500/15 hover:text-red-400"
                                          onClick={() => handleDeleteComment(comment.id)}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent>Delete comment</TooltipContent>
                                    </Tooltip>
                                  </div>
                                </div>
                                {/* Comment text / edit mode */}
                                <AnimatePresence mode="wait">
                                  {editingCommentId === comment.id ? (
                                    <motion.div
                                      key="edit"
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="rounded-md border border-[#7b2cbf]/30 bg-[#7b2cbf]/5 p-2">
                                        <textarea
                                          className="w-full resize-none bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/50"
                                          rows={2}
                                          value={editCommentText}
                                          onChange={(e) => setEditCommentText(e.target.value)}
                                          autoFocus
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' && e.metaKey) {
                                              e.preventDefault();
                                              handleEditComment(comment.id);
                                            }
                                            if (e.key === 'Escape') {
                                              cancelEditingComment();
                                            }
                                          }}
                                          placeholder="Edit your comment..."
                                        />
                                        <div className="flex items-center justify-between mt-1.5">
                                          <span className="text-[9px] text-muted-foreground/40">⌘+Enter to save</span>
                                          <div className="flex gap-1.5">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 px-2 text-[10px]"
                                              onClick={cancelEditingComment}
                                            >
                                              Cancel
                                            </Button>
                                            <Button
                                              size="sm"
                                              className="h-6 gap-1 bg-gradient-to-r from-[#7b2cbf] to-[#5a1d8f] px-2 text-[10px] text-white hover:shadow-[#7b2cbf]/30 hover:shadow-lg"
                                              onClick={() => handleEditComment(comment.id)}
                                              disabled={!editCommentText.trim()}
                                            >
                                              <Check className="h-2.5 w-2.5" />
                                              Save
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    </motion.div>
                                  ) : (
                                    <motion.p
                                      key="text"
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      className="text-xs text-muted-foreground leading-relaxed"
                                    >
                                      {comment.text}
                                    </motion.p>
                                  )}
                                </AnimatePresence>
                                {/* Comment creation time — left, under text */}
                                <span className="text-[10px] text-muted-foreground/40">
                                  {format(new Date(comment.createdAt), 'MMM d, h:mm a')}
                                </span>
                                <div className="mt-1.5 flex items-center gap-2">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="ml-auto h-6 gap-1 px-2 text-[10px] text-[#00a8c6] hover:text-[#00a8c6] hover:bg-[#00a8c6]/10"
                                        onClick={() => seekTo(comment.timestampMs / 1000)}
                                      >
                                        <LocateFixed className="h-3 w-3" />
                                        Jump to
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Jump to this timestamp</TooltipContent>
                                  </Tooltip>
                                  {!comment.isResolved && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 gap-1 px-2 text-[10px] text-muted-foreground hover:text-foreground hover:bg-[#161224]"
                                        onClick={() => {
                                          setReplyingTo(replyingTo === comment.id ? null : comment.id);
                                          setReplyText('');
                                          if (editingCommentId === comment.id) cancelEditingComment();
                                        }}
                                      >
                                        <Reply className="h-3 w-3" />
                                        Reply
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Reply to this comment</TooltipContent>
                                  </Tooltip>
                                  )}
                                  {comment.isResolved && (
                                    <span className="text-[9px] text-[#4a8d6f]/60 italic">Thread closed</span>
                                  )}
                                </div>
                                {/* Inline reply input — hidden when resolved */}
                                <AnimatePresence>
                                  {replyingTo === comment.id && !comment.isResolved && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      className="mt-2 ml-2 overflow-hidden border-l-2 border-[#7b2cbf]/30 pl-3"
                                    >
                                      <Input
                                        placeholder={`Reply to ${comment.userName}...`}
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleReply();
                                          }
                                          if (e.key === 'Escape') {
                                            setReplyingTo(null);
                                            setReplyText('');
                                          }
                                        }}
                                        className="mb-1.5 h-7 text-xs"
                                        autoFocus
                                      />
                                      <div className="flex justify-end gap-1.5">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 px-2 text-[10px]"
                                          onClick={() => {
                                            setReplyingTo(null);
                                            setReplyText('');
                                          }}
                                        >
                                          Cancel
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="h-6 gap-1 bg-gradient-to-r from-[#7b2cbf] to-[#5a1d8f] px-2 text-[10px] text-white hover:shadow-[#7b2cbf]/30 hover:shadow-lg"
                                          onClick={handleReply}
                                          disabled={!replyText.trim()}
                                        >
                                          <Send className="h-2.5 w-2.5" />
                                          Reply
                                        </Button>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          </motion.div>

                          {/* NESTED REPLIES THREAD */}
                          {comment.replies.length > 0 && (
                            <div className="ml-4 mt-1 space-y-1 border-l-2 border-[#7b2cbf]/20 pl-3">
                              <button
                                className="flex items-center gap-1 text-[10px] text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                                onClick={() => toggleThread(comment.id)}
                              >
                                {collapsedThreads.has(comment.id) ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                <MessageSquareQuote className="h-3 w-3" />
                                <span>{comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}</span>
                              </button>
                              <AnimatePresence initial={false}>
                                {!collapsedThreads.has(comment.id) && comment.replies.map((reply) => (
                                  <motion.div
                                    key={reply.id}
                                    id={`comment-${reply.id}`}
                                    initial={{ opacity: 0, x: -6 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -6 }}
                                    transition={{ duration: 0.15 }}
                                    className={`relative border p-2.5 transition-colors ${
                                      focusedCommentId === reply.id
                                        ? 'border-[#7b2cbf]/40'
                                        : comment.isResolved
                                          ? 'border-[#1f2633]'
                                          : 'border-[#1f2633]'
                                    }`}
                                    style={{
                                      background: comment.isResolved ? BG_MAIN : BG_CARD_TEAL,
                                      clipPath: CHAMFER_5,
                                      opacity: comment.isResolved ? 0.5 : 1,
                                      borderTop: `2px solid ${comment.isResolved ? BORDER_MUTED : C}`,
                                      boxShadow: INSET_BEVEL_SHADOW,
                                    }}
                                  >
                                    <CornerBrackets size={6} />
                                    <div className="flex items-start gap-2">
                                      <Avatar className="h-5 w-5 shrink-0">
                                        <AvatarFallback className="text-[8px] bg-[#161224] text-muted-foreground">
                                          {getInitials(reply.userName)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1 mb-0.5">
                                          <span className="text-[11px] font-medium text-foreground">
                                            {reply.userName}
                                          </span>
                                          {/* Reply actions — no timestamp badge, no resolve */}
                                          <div className="ml-auto flex items-center gap-0.5 opacity-30 transition-opacity hover:opacity-100">
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <button
                                                  className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-[#7b2cbf]/15 hover:text-[#7b2cbf]"
                                                  onClick={() => startEditingComment(reply)}
                                                >
                                                  <Pencil className="h-2.5 w-2.5" />
                                                </button>
                                              </TooltipTrigger>
                                              <TooltipContent>Edit</TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <button
                                                  className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-red-500/15 hover:text-red-400"
                                                  onClick={() => handleDeleteComment(reply.id)}
                                                >
                                                  <Trash2 className="h-2.5 w-2.5" />
                                                </button>
                                              </TooltipTrigger>
                                              <TooltipContent>Delete</TooltipContent>
                                            </Tooltip>
                                          </div>
                                        </div>
                                        {/* Reply text / edit mode */}
                                        <AnimatePresence mode="wait">
                                          {editingCommentId === reply.id ? (
                                            <motion.div
                                              key="edit"
                                              initial={{ opacity: 0, height: 0 }}
                                              animate={{ opacity: 1, height: 'auto' }}
                                              exit={{ opacity: 0, height: 0 }}
                                              className="overflow-hidden"
                                            >
                                              <div className="rounded border border-[#7b2cbf]/20 bg-[#7b2cbf]/5 p-1.5">
                                                <textarea
                                                  className="w-full resize-none bg-transparent text-[11px] text-foreground outline-none placeholder:text-muted-foreground/50"
                                                  rows={1}
                                                  value={editCommentText}
                                                  onChange={(e) => setEditCommentText(e.target.value)}
                                                  autoFocus
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && e.metaKey) {
                                                      e.preventDefault();
                                                      handleEditComment(reply.id);
                                                    }
                                                    if (e.key === 'Escape') cancelEditingComment();
                                                  }}
                                                  placeholder="Edit reply..."
                                                />
                                                <div className="flex justify-end gap-1 mt-1">
                                                  <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[9px]" onClick={cancelEditingComment}>Cancel</Button>
                                                  <Button size="sm" className="h-5 gap-0.5 bg-gradient-to-r from-[#7b2cbf] to-[#5a1d8f] px-1.5 text-[9px] text-white" onClick={() => handleEditComment(reply.id)} disabled={!editCommentText.trim()}>
                                                    <Check className="h-2 w-2" /> Save
                                                  </Button>
                                                </div>
                                              </div>
                                            </motion.div>
                                          ) : (
                                            <motion.p
                                              key="text"
                                              initial={{ opacity: 0 }}
                                              animate={{ opacity: 1 }}
                                              exit={{ opacity: 0 }}
                                              className="text-[11px] text-muted-foreground leading-relaxed"
                                            >
                                              {reply.text}
                                            </motion.p>
                                          )}
                                        </AnimatePresence>
                                        <div className="mt-1 flex items-center gap-1.5">
                                          <span className="text-[9px] text-muted-foreground/40">
                                            {format(new Date(reply.createdAt), 'MMM d, h:mm a')}
                                          </span>
                                          {!comment.isResolved && (
                                          <button
                                            className="text-[9px] text-muted-foreground/40 transition-colors hover:text-[#7b2cbf]"
                                            onClick={() => {
                                              setReplyingTo(replyingTo === reply.id ? null : reply.id);
                                              setReplyText('');
                                              if (editingCommentId === reply.id) cancelEditingComment();
                                            }}
                                          >
                                            <Reply className="inline h-2.5 w-2.5" /> Reply
                                          </button>
                                          )}
                                        </div>
                                        {/* Inline reply input for reply-to-reply — hidden when parent resolved */}
                                        <AnimatePresence>
                                          {replyingTo === reply.id && !comment.isResolved && (
                                            <motion.div
                                              initial={{ opacity: 0, height: 0 }}
                                              animate={{ opacity: 1, height: 'auto' }}
                                              exit={{ opacity: 0, height: 0 }}
                                              className="mt-1 overflow-hidden"
                                            >
                                              <Input
                                                placeholder={`Reply to ${reply.userName}...`}
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleReply();
                                                  }
                                                  if (e.key === 'Escape') {
                                                    setReplyingTo(null);
                                                    setReplyText('');
                                                  }
                                                }}
                                                className="mb-1 h-6 text-[10px]"
                                                autoFocus
                                              />
                                              <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[9px]" onClick={() => { setReplyingTo(null); setReplyText(''); }}>Cancel</Button>
                                                <Button size="sm" className="h-5 gap-0.5 bg-gradient-to-r from-[#7b2cbf] to-[#5a1d8f] px-1.5 text-[9px] text-white" onClick={handleReply} disabled={!replyText.trim()}>
                                                  <Send className="h-2 w-2" /> Reply
                                                </Button>
                                              </div>
                                            </motion.div>
                                          )}
                                        </AnimatePresence>
                                      </div>
                                    </div>
                                  </motion.div>
                                ))}
                              </AnimatePresence>
                            </div>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                  <div ref={commentsEndRef} />
                </ScrollArea>
              </div>
            </div>
      </div>
    </div>
  );
}


// --- Add Version Dialog ---

interface AddVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (file: File, label: string) => void;
  isUploading: boolean;
  uploadProgress: number;
  nextVersion: number;
}

function AddVersionDialog({
  open,
  onOpenChange,
  onSubmit,
  isUploading,
  uploadProgress,
  nextVersion,
}: AddVersionDialogProps) {
  // Use a derived key from open to reset state; store label/selectedFile internally
  const [dialogState, setDialogState] = useState<{ file: File | null; label: string; initialized: boolean }>({
    file: null,
    label: `v${nextVersion}`,
    initialized: false,
  });

  const handleDialogOpen = useCallback((isOpen: boolean) => {
    if (isOpen) {
      // Reset when dialog opens
      setDialogState({ file: null, label: `v${nextVersion}`, initialized: true });
    }
    onOpenChange(isOpen);
  }, [onOpenChange, nextVersion]);

  const handleSubmit = useCallback(() => {
    if (!dialogState.file) return;
    onSubmit(dialogState.file, dialogState.label);
  }, [dialogState, onSubmit]);

  return (
    <Dialog open={open} onOpenChange={handleDialogOpen}>
      <DialogContent
        className="relative border-0 rounded-none sm:max-w-md"
        style={{
          background: BG_PANEL,
          border: `1px solid ${hexToRgba(Y, 0.5)}`,
          boxShadow: `0 0 24px ${hexToRgba(C, 0.2)}, 0 8px 32px rgba(0,0,0,0.7), ${INSET_BEVEL_SHADOW}`,
          clipPath: 'polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 calc(100% - 8px), 0 8px)',
        }}
      >
        <CornerBrackets size={12} />
        <DialogHeader>
          <DialogTitle
            className="uppercase"
            style={SECTION_TITLE_STYLE}
          >
            Add New Version
          </DialogTitle>
          <DialogDescription style={{ color: TEXT_SECONDARY }}>
            Upload an audio file to create a new version of this track.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* File input area */}
          <div className="space-y-2">
            <label
              className="uppercase block"
              style={{
                color: TEXT_SECONDARY,
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: '10px',
                letterSpacing: '1.5px',
              }}
            >
              Audio File *
            </label>
            <div
              className={`flex items-center gap-3 border border-dashed p-4 transition-colors cursor-pointer ${
                dialogState.file
                  ? 'border-[#7b2cbf]/50 bg-[#7b2cbf]/5'
                  : 'border-[#00a8c6]/40 bg-[#0e1a24] hover:border-[#00a8c6]/70'
              }`}
              style={{ clipPath: CHAMFER_5 }}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'audio/*';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) setDialogState((s) => ({ ...s, file }));
                };
                input.click();
              }}
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center ${
                dialogState.file ? 'bg-[#7b2cbf]/20' : 'bg-[#1f2633]'
              }`} style={{ clipPath: CHAMFER_4 }}>
                <Upload className={`h-4 w-4 ${dialogState.file ? 'text-[#7b2cbf]' : 'text-muted-foreground'}`} />
              </div>
              <div className="min-w-0 flex-1">
                {dialogState.file ? (
                  <>
                    <p className="text-sm font-medium truncate" style={{ color: TEXT_PRIMARY, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>{dialogState.file.name}</p>
                    <p className="text-[10px]" style={{ color: Y, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                      {(dialogState.file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm" style={{ color: TEXT_SECONDARY, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>Click to select an audio file</p>
                    <p className="text-[10px]" style={{ color: `${TEXT_SECONDARY}99`, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>MP3, WAV, OGG, FLAC...</p>
                  </>
                )}
              </div>
              {dialogState.file && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDialogState((s) => ({ ...s, file: null }));
                  }}
                  className="flex h-6 w-6 items-center justify-center text-muted-foreground/40 hover:bg-[#7b2cbf]/15 hover:text-[#7b2cbf]"
                  style={{ clipPath: CHAMFER_3 }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Label input */}
          <div className="space-y-2">
            <label
              className="uppercase block"
              style={{
                color: TEXT_SECONDARY,
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: '10px',
                letterSpacing: '1.5px',
              }}
            >
              Version Label
            </label>
            <Input
              value={dialogState.label}
              onChange={(e) => setDialogState((s) => ({ ...s, label: e.target.value }))}
              placeholder={`v${nextVersion}`}
              className="border-0 rounded-none h-9"
              style={{
                ...HUD_INPUT_STYLE,
                fontSize: '13px',
              }}
            />
          </div>

          {/* Progress bar — yellow HUD fill, chamfered track */}
          {isUploading && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px]" style={{ color: TEXT_SECONDARY, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                <span>Uploading...</span>
                <span style={{ color: Y }}>{uploadProgress}%</span>
              </div>
              <div
                className="h-1.5 w-full overflow-hidden"
                style={{ background: BG_MAIN, clipPath: CHAMFER_3 }}
              >
                <motion.div
                  className="h-full"
                  style={{
                    background: `linear-gradient(to right, ${Y}, ${Y2})`,
                    boxShadow: `0 0 6px ${hexToRgba(Y, 0.5)}`,
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDialogOpen(false)}
              disabled={isUploading}
              className="text-xs"
              style={{
                color: TEXT_SECONDARY,
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                letterSpacing: '1px',
                textTransform: 'uppercase',
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!dialogState.file || isUploading}
              className="border-0 rounded-none text-xs"
              style={{
                ...YELLOW_BUTTON_STYLE,
                paddingRight: '14px',
                paddingLeft: '14px',
                paddingTop: '6px',
                paddingBottom: '6px',
              }}
            >
              {isUploading ? (
                <>
                  <div className="mr-1.5 h-3 w-3 animate-spin rounded-full border-2 border-black/70 border-t-transparent" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Upload Version
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}