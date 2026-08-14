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

function buildCommentTree(
  comments: Comment[],
  rootComparator?: (a: CommentNode, b: CommentNode) => number
): CommentNode[] {
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
  // Sort root comments — caller may pass a custom comparator (e.g. by date/author/status).
  // Default: ascending by timestampMs (oldest first) — preserves the original behavior.
  if (rootComparator) {
    roots.sort(rootComparator);
  } else {
    roots.sort((a, b) => a.timestampMs - b.timestampMs);
  }
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
  // Cyberpunk 2077 status palette — muted colors per HUD spec
  draft: '#00a8c6',
  in_progress: '#00a8c6',
  mastering: '#4a8d6f',
  released: '#00a8c6',
  review: '#c7a008',
};

// Russian labels for track statuses (Cyberpunk 2077 HUD)
const statusLabels: Record<string, string> = {
  draft: 'Черновик',
  in_progress: 'В работе',
  mixing: 'Сведение',
  mastering: 'Мастеринг',
  released: 'Релиз',
  recording: 'Запись',
  review: 'Проверка',
  // Legacy statuses (backward compat with existing data)
  idea: 'Идея',
  final: 'Финал',
};

// Ordered list of statuses shown in the Select dropdown
const STATUS_OPTIONS: string[] = [
  'draft',
  'in_progress',
  'mixing',
  'mastering',
  'released',
  'recording',
  'review',
];

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

// Recursively flatten ALL descendants of a task tree.
// The backend returns tasks with up to 3 levels of `children` (task → child → grandchild),
// but this helper is generic so it works for any depth. Used by the track + project
// progress panels to count every subtask regardless of how deep it nests.
function countAllDescendants(tasks: { children?: unknown[] }[]): any[] {
  const result: any[] = [];
  const walk = (nodes: unknown[]) => {
    for (const n of nodes as any[]) {
      result.push(n);
      if (n && Array.isArray(n.children) && n.children.length > 0) {
        walk(n.children);
      }
    }
  };
  walk(tasks as unknown[]);
  return result;
}

// --- Priority helpers (used by the Track Profile info grid) ---

const PRIORITY_COLORS: Record<string, string> = {
  high: '#ff5a5a',
  medium: Y,
  low: G,
};

const PRIORITY_LABELS: Record<string, string> = {
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

function priorityColor(p: string): string {
  return PRIORITY_COLORS[p] ?? Y;
}

function priorityLabel(p: string): string {
  return PRIORITY_LABELS[p] ?? p;
}

// Small HUD stat cell — yellow uppercase label on top, white value below.
// Used in the 3×2 Track Info Grid (track #, duration, version, etc.).
function InfoStatCell({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-col gap-0.5 px-2 py-1.5"
      style={{
        background: BG_MAIN,
        border: `0.5px solid ${hexToRgba(C, 0.25)}`,
        clipPath: CHAMFER_3,
        boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.6)',
      }}
    >
      <span
        className="text-[8px]"
        style={{
          color: Y,
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontWeight: 700,
          letterSpacing: '1px',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        className="truncate tabular-nums text-[12px]"
        style={{
          color: TEXT_PRIMARY,
          fontFamily: 'var(--font-rajdhani), sans-serif',
          fontWeight: 700,
          letterSpacing: '0.3px',
        }}
        title={value}
      >
        {value}
      </span>
    </div>
  );
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
    userName: raw.userName ?? raw.user?.displayName ?? 'Неизвестный',
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
          Идеи
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
                              Исходная идея
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
  // Pinned marker tooltip — when a marker is clicked the tooltip stays open
  // until the user closes it (X button) or clicks elsewhere. Lets the user
  // interact with the Edit/Resolve/Delete buttons without fighting the 200ms
  // hover hide timer.
  const [pinnedMarkerId, setPinnedMarkerId] = useState<string | null>(null);
  // Helper: compute + apply the tooltip position for a given marker element.
  // The tooltip is centered horizontally on the marker (left = marker center x)
  // and anchored just above it. The `right` flag tells the tooltip to also clamp
  // itself inside the viewport when the marker sits near the right edge.
  const showMarkerTooltipFor = useCallback((el: HTMLElement, commentId: string) => {
    if (markerHideTimerRef.current) {
      clearTimeout(markerHideTimerRef.current);
      markerHideTimerRef.current = null;
    }
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const isRight = centerX > window.innerWidth - 160; // within 160px of right edge
    setHoveredMarkerId(commentId);
    setMarkerTooltipPos({ top: rect.top - 8, left: centerX, right: isRight });
  }, []);


  // Comment state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [visibleCommentCount, setVisibleCommentCount] = useState(4);
  const [commentTimestamp, setCommentTimestamp] = useState(0);
  const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null);
  const commentsEndRef = useRef<HTMLDivElement | null>(null);

  // Comment sort mode — drives the order of root comments in the comments panel
  const [sortBy, setSortBy] = useState<'date' | 'time' | 'author' | 'status'>('time');

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

  // --- Track Profile panel state ---
  // The store Track only exposes `createdBy` (a user id). To display the
  // creator's display name + avatar in the Track Profile panel we fetch the
  // full track record (which includes `creator: { id, displayName, avatarUrl }`).
  const [trackDetail, setTrackDetail] = useState<{
    creator?: { id: string; displayName: string; avatarUrl?: string | null };
    createdAt?: string;
  } | null>(null);

  useEffect(() => {
    if (!selectedTrackId) {
      setTrackDetail(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/tracks/${encodeURIComponent(selectedTrackId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setTrackDetail({
          creator: data.creator,
          createdAt: data.createdAt,
        });
      })
      .catch(() => {
        if (!cancelled) setTrackDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTrackId]);

  // Inline editing state for the Track Profile panel.
  // Each field tracks its own editing/draft/saving state so the user can edit
  // title, description and priority without affecting one another.
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  // Track which field is currently being saved (for "saving..." indicator)
  const [savingField, setSavingField] = useState<string | null>(null);
  // Ref-guard to prevent double-saves when Enter + onBlur fire in quick succession.
  const titleSaveInFlightRef = useRef(false);
  const descSaveInFlightRef = useRef(false);

  // Local copy of the kanban Task description (kept in sync after PUT updates)
  // so the user sees their edited text immediately without waiting for a refetch.
  const [localKanbanDescription, setLocalKanbanDescription] = useState<string | null>(null);
  const [localKanbanTitle, setLocalKanbanTitle] = useState<string | null>(null);
  const [localKanbanPriority, setLocalKanbanPriority] = useState<string | null>(null);

  // --- Track text (lyrics/notes) ---
  // Stored inside the kanban task's `trackConfig` JSON string under a `trackText`
  // key (separate from `description`, which is the inline "Описание" field in
  // section B). Parsed on kanban task change, edited inline in the right column,
  // saved via PUT /api/tasks { id, trackConfig: JSON.stringify({...existing, trackText}) }.
  const [localTrackText, setLocalTrackText] = useState<string>('');
  const [trackTextDraft, setTrackTextDraft] = useState<string>('');
  const [trackTextFocused, setTrackTextFocused] = useState(false);
  const trackTextSaveInFlightRef = useRef(false);

  // --- References count ---
  // The track's project has a kanbanTaskId. The project's kanban boards include a
  // "Референсы" board (title contains "Референсы" / "References" OR boardType
  // === 'references'). We fetch /api/boards?projectId=<kanbanTaskId>, find the
  // references board and count its top-level tasks.
  const [referencesCount, setReferencesCount] = useState<number | null>(null);

  // Reset the local kanban-field mirrors whenever the underlying kanban task changes
  // (e.g. when the user switches to a different track).
  const primaryKanbanTask = trackTasks[0] ?? null;
  useEffect(() => {
    if (!primaryKanbanTask) {
      setLocalKanbanDescription(null);
      setLocalKanbanTitle(null);
      setLocalKanbanPriority(null);
      setLocalTrackText('');
      setTrackTextDraft('');
      return;
    }
    setLocalKanbanDescription(primaryKanbanTask.description);
    setLocalKanbanTitle(primaryKanbanTask.title);
    setLocalKanbanPriority(primaryKanbanTask.priority);
    // Parse trackConfig JSON to extract `trackText` (lyrics / notes).
    // The trackConfig field is a JSON string stored on the kanban Task; if it's
    // null/invalid or lacks `trackText`, fall back to '' (empty editor).
    let parsedText = '';
    if (primaryKanbanTask.trackConfig) {
      try {
        const cfg = JSON.parse(primaryKanbanTask.trackConfig);
        if (cfg && typeof cfg.trackText === 'string') {
          parsedText = cfg.trackText;
        }
      } catch {
        // Ignore malformed JSON — treat as empty.
      }
    }
    setLocalTrackText(parsedText);
    setTrackTextDraft(parsedText);
  }, [primaryKanbanTask?.id, primaryKanbanTask?.description, primaryKanbanTask?.title, primaryKanbanTask?.priority, primaryKanbanTask?.trackConfig]);

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
      setReferencesCount(null);
      return;
    }
    let cancelled = false;
    // Fetch the project kanban task BY ID with deep=true so we get its
    // full children subtree and can recursively count all descendants.
    fetch(`/api/tasks?id=${encodeURIComponent(kanbanTaskId)}&deep=true`)
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

    // Fetch the project's kanban boards and locate the "Референсы" board
    // (matched by title containing "Референсы" / "References" — case-insensitive —
    // OR by boardType === 'references'). The boards endpoint returns each board
    // with a top-level `tasks` array (only parentId === null entries), so we
    // sum the count of those tasks as the references total.
    fetch(`/api/boards?projectId=${encodeURIComponent(kanbanTaskId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled) return;
        const boards: Array<{ title: string; boardType: string; tasks?: unknown[] }> =
          data && Array.isArray(data.boards) ? data.boards : [];
        const refBoard = boards.find((b) => {
          const t = (b.title || '').toLowerCase();
          return (
            b.boardType === 'references' ||
            t.includes('референс') ||
            t.includes('reference')
          );
        });
        if (refBoard && Array.isArray(refBoard.tasks)) {
          setReferencesCount(refBoard.tasks.length);
        } else {
          setReferencesCount(null);
        }
      })
      .catch(() => {
        if (!cancelled) setReferencesCount(null);
      });

    return () => { cancelled = true; };
  }, [projectOfTrack?.kanbanTaskId]);

  // Compute kanban progress statistics for the currently-selected track.
  // Flatten ALL descendants (not just direct children) of every fetched track-task
  // and bucket them by status — gives a true reflection of the track's kanban position.
  const trackProgress = useMemo(() => {
    const allDescendants = countAllDescendants(trackTasks);
    const total = allDescendants.length;
    const done = allDescendants.filter((c) => c.status === 'done').length;
    const inProgress = allDescendants.filter((c) => c.status === 'in-progress').length;
    const review = allDescendants.filter((c) => c.status === 'review').length;
    const todo = allDescendants.filter((c) => c.status === 'todo').length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { allChildren: allDescendants, total, done, inProgress, review, todo, pct };
  }, [trackTasks]);

  // Project-level progress: count ALL descendants of the project's kanban task
  // (recursively, not just direct children).
  const projectProgress = useMemo(() => {
    if (!projectTask) return null;
    const allDescendants = countAllDescendants([projectTask]);
    const total = allDescendants.length;
    const done = allDescendants.filter((c) => c.status === 'done').length;
    const inProgress = allDescendants.filter((c) => c.status === 'in-progress').length;
    const review = allDescendants.filter((c) => c.status === 'review').length;
    const todo = allDescendants.filter((c) => c.status === 'todo').length;
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

    // "Open in Kanban" button is now rendered inline next to the status selector
    setHeaderActions([]);

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
      // Keep highlight for 5 seconds — long enough to read the comment +
      // clock the bright glow/badge we now paint on the focused bubble.
      setTimeout(() => {
        setFocusedCommentId(null);
      }, 5000);
    },
    [seekTo]
  );

  // Global click listener — when a pinned marker tooltip is open, dismiss it
  // if the user clicks anywhere outside the tooltip (and outside any marker).
  // Marker buttons + tooltip both call `e.stopPropagation()` on their click
  // handlers, so this listener only fires for "outside" clicks.
  useEffect(() => {
    if (!pinnedMarkerId) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      // Dismiss the pinned tooltip on any outside click.
      setPinnedMarkerId(null);
      // Also clear hoveredMarkerId + position so the tooltip fully closes.
      setHoveredMarkerId(null);
      setMarkerTooltipPos(null);
    };
    // Defer registration by a tick so the click that *opened* the tooltip
    // doesn't immediately close it.
    const t = setTimeout(() => {
      document.addEventListener('click', handler);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', handler);
    };
  }, [pinnedMarkerId]);

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

  // Scroll to focused comment — slight delay lets the bubble mount + the
  // focus glow/scale animation settle before we centre the row.
  useEffect(() => {
    if (!focusedCommentId) return;
    const id = focusedCommentId;
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(`comment-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => cancelAnimationFrame(raf);
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
      toast({ description: 'Комментарий обновлён' });
    } catch {
      toast({ description: 'Не удалось обновить комментарий', variant: 'destructive' });
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
      toast({ description: 'Комментарий удалён' });
    } catch {
      toast({ description: 'Не удалось удалить комментарий', variant: 'destructive' });
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
  // Updates the track's status both locally (zustand store + socket emit) and
  // persistently via PATCH /api/tracks/:id. If the track is linked to a kanban
  // Task, that task's status is also synced via PUT /api/tasks so the kanban
  // board reflects the same status as the track profile.

  const handleStatusChange = useCallback(
    async (newStatus: string) => {
      if (!selectedTrackId || !track) return;
      // Optimistic local update
      updateTrackStatus(selectedTrackId, newStatus);
      socketRef.current?.emit('track:update_status', {
        trackId: selectedTrackId,
        status: newStatus,
      });

      // Persist to /api/tracks/:id
      setSavingField('status');
      try {
        await fetch(`/api/tracks/${encodeURIComponent(selectedTrackId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });
      } catch {
        // Silently fail — local state already reflects the user's intent
      } finally {
        setSavingField(null);
      }

      // Mirror status onto the linked kanban task (if any)
      const kanbanTaskId = primaryKanbanTask?.id;
      if (kanbanTaskId) {
        try {
          await fetch('/api/tasks', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: kanbanTaskId, status: newStatus }),
          });
          // Mirror locally so the UI reflects the change immediately
          setTrackTasks((prev) =>
            prev.map((t) =>
              t.id === kanbanTaskId ? { ...t, status: newStatus as Task['status'] } : t
            )
          );
        } catch {
          // Best-effort sync — failure here doesn't affect the track record
        }
      }
    },
    [selectedTrackId, track, updateTrackStatus, primaryKanbanTask?.id]
  );

  // --- Inline title editing ---
  // Saves the new title to BOTH the track record (PATCH /api/tracks/:id) and
  // the linked kanban task (PUT /api/tasks) so the two stay in sync.

  const handleStartEditTitle = useCallback(() => {
    setTitleDraft(track?.title ?? '');
    setEditingTitle(true);
  }, [track?.title]);

  const handleSaveTitle = useCallback(async () => {
    if (titleSaveInFlightRef.current) return;
    if (!selectedTrackId || !track) return;
    const newTitle = titleDraft.trim();
    if (!newTitle || newTitle === track.title) {
      setEditingTitle(false);
      return;
    }
    titleSaveInFlightRef.current = true;
    setEditingTitle(false);
    setSavingField('title');
    // Optimistic local update — patch the in-memory store Track so the UI
    // reflects the new title immediately (zustand store tracks array).
    useDataStore.setState((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === selectedTrackId ? { ...t, title: newTitle } : t
      ),
    }));
    try {
      await fetch(`/api/tracks/${encodeURIComponent(selectedTrackId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      // Mirror onto linked kanban task
      const kanbanTaskId = primaryKanbanTask?.id;
      if (kanbanTaskId) {
        await fetch('/api/tasks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: kanbanTaskId, title: newTitle }),
        });
        setLocalKanbanTitle(newTitle);
        setTrackTasks((prev) =>
          prev.map((t) =>
            t.id === kanbanTaskId ? { ...t, title: newTitle } : t
          )
        );
      }
      setHeaderTitle(newTitle);
    } catch {
      // Silently fail
    } finally {
      setSavingField(null);
      titleSaveInFlightRef.current = false;
    }
  }, [selectedTrackId, track, titleDraft, primaryKanbanTask?.id, setHeaderTitle]);

  // --- Inline description editing (kanban task description) ---

  const handleStartEditDescription = useCallback(() => {
    setDescriptionDraft(localKanbanDescription ?? '');
    setEditingDescription(true);
  }, [localKanbanDescription]);

  const handleSaveDescription = useCallback(async () => {
    if (descSaveInFlightRef.current) return;
    const kanbanTaskId = primaryKanbanTask?.id;
    if (!kanbanTaskId) {
      setEditingDescription(false);
      return;
    }
    const newText = descriptionDraft.trim();
    descSaveInFlightRef.current = true;
    setEditingDescription(false);
    if (newText === (localKanbanDescription ?? '')) {
      descSaveInFlightRef.current = false;
      return;
    }
    setSavingField('description');
    setLocalKanbanDescription(newText || null);
    try {
      await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: kanbanTaskId, description: newText }),
      });
      setTrackTasks((prev) =>
        prev.map((t) =>
          t.id === kanbanTaskId
            ? { ...t, description: newText || null }
            : t
        )
      );
    } catch {
      // Silently fail
    } finally {
      setSavingField(null);
      descSaveInFlightRef.current = false;
    }
  }, [primaryKanbanTask?.id, descriptionDraft, localKanbanDescription]);

  // --- Priority editing (kanban task priority) ---

  const handlePriorityChange = useCallback(
    async (newPriority: string) => {
      const kanbanTaskId = primaryKanbanTask?.id;
      if (!kanbanTaskId) return;
      setLocalKanbanPriority(newPriority);
      setSavingField('priority');
      try {
        await fetch('/api/tasks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: kanbanTaskId, priority: newPriority }),
        });
        setTrackTasks((prev) =>
          prev.map((t) =>
            t.id === kanbanTaskId
              ? { ...t, priority: newPriority as Task['priority'] }
              : t
          )
        );
      } catch {
        // Silently fail
      } finally {
        setSavingField(null);
      }
    },
    [primaryKanbanTask?.id]
  );

  // --- Track text (lyrics/notes) editing ---
  // Persists the textarea's value into the kanban task's `trackConfig` JSON
  // under the `trackText` key. We merge with any existing trackConfig keys
  // (so other tools that store data in trackConfig keep working). Saved on
  // blur OR Ctrl/Cmd+Enter; a ref-guard prevents double-saves when both fire.
  const handleSaveTrackText = useCallback(async () => {
    if (trackTextSaveInFlightRef.current) return;
    const kanbanTaskId = primaryKanbanTask?.id;
    if (!kanbanTaskId) return;
    const newText = trackTextDraft;
    trackTextSaveInFlightRef.current = true;
    if (newText === localTrackText) {
      trackTextSaveInFlightRef.current = false;
      return;
    }
    setSavingField('trackText');
    setLocalTrackText(newText);
    // Merge with existing trackConfig keys (parse, override trackText, re-stringify).
    let existingCfg: Record<string, unknown> = {};
    if (primaryKanbanTask?.trackConfig) {
      try {
        const parsed = JSON.parse(primaryKanbanTask.trackConfig);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          existingCfg = parsed as Record<string, unknown>;
        }
      } catch {
        // Ignore malformed JSON — start fresh.
      }
    }
    const mergedCfg = { ...existingCfg, trackText: newText };
    try {
      await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: kanbanTaskId, trackConfig: JSON.stringify(mergedCfg) }),
      });
      setTrackTasks((prev) =>
        prev.map((t) =>
          t.id === kanbanTaskId ? { ...t, trackConfig: JSON.stringify(mergedCfg) } : t
        )
      );
    } catch {
      // Silently fail
    } finally {
      setSavingField(null);
      trackTextSaveInFlightRef.current = false;
    }
  }, [primaryKanbanTask?.id, primaryKanbanTask?.trackConfig, trackTextDraft, localTrackText]);


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

  // Sorted comment tree — applies the user-selected sort mode (date / time / author / status).
  // Defaults to "По времени" (timestamp ascending) so original behavior is preserved.
  const sortedTree = useMemo(() => {
    const versionComments = comments.filter((c) => activeVersion?.id && c.versionId === activeVersion.id);
    return buildCommentTree(versionComments, (a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'author':
          // Locale-aware alphabetical sort by user display name
          return a.userName.localeCompare(b.userName, 'ru');
        case 'status':
          // Resolved-first, then by timestampMs (preserves a sensible secondary order)
          if (a.isResolved !== b.isResolved) return a.isResolved ? -1 : 1;
          return a.timestampMs - b.timestampMs;
        case 'time':
        default:
          return a.timestampMs - b.timestampMs;
      }
    });
  }, [comments, activeVersion, sortBy]);

  // Auto-expand the visible-comment window when a marker click focuses a
  // comment that's currently hidden past the visibleCommentCount cutoff.
  // Without this, the bright focus glow/badge would never actually mount
  // for comments beyond the initial 4-row window.
  useEffect(() => {
    if (!focusedCommentId) return;
    const topLevelIndex = sortedTree.findIndex((c) => c.id === focusedCommentId);
    if (topLevelIndex >= 0 && topLevelIndex >= visibleCommentCount) {
      setVisibleCommentCount(topLevelIndex + 1);
    }
  }, [focusedCommentId, sortedTree, visibleCommentCount]);

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
          <p className="text-sm" style={{ color: TEXT_SECONDARY, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>Нет выбранного трека</p>
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
            Назад к проекту
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-full flex-col"
      style={{
        // Override global purple (#8A2BE2) defaults — these CSS variables cascade
        // to all shadcn components (Select, Tooltip, Badge, Button) inside this view
        // so popups/tooltips/hover states read as cyberpunk 2077 HUD instead of
        // the default purple theme defined in globals.css.
        ['--primary' as any]: Y,
        ['--primary-foreground' as any]: '#0a0b10',
        ['--accent' as any]: BG_MAIN,
        ['--accent-foreground' as any]: C,
        ['--ring' as any]: Y,
        ['--popover' as any]: BG_PANEL,
        ['--popover-foreground' as any]: TEXT_PRIMARY,
        ['--secondary' as any]: BG_PANEL,
        ['--secondary-foreground' as any]: TEXT_PRIMARY,
        ['--muted' as any]: BG_MAIN,
        ['--muted-foreground' as any]: TEXT_SECONDARY,
      } as React.CSSProperties}
    >
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

      </motion.div>

      {/* ─── Track Profile Panel — editable track + kanban metadata ─── */}
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
            {/* LEFT (lg:col-span-2): Track Profile header + description + info grid + progress */}
            <div className="lg:col-span-2">
              {/* ── A. Profile Header ─ cover + title + status + Канбан ── */}
              <div className="flex items-start gap-3">
                {/* E. Cover Image — text-based placeholder (Track has no coverUrl).
                    80×80 chamfered HUD cell with the track number + audio icon. */}
                <div
                  className="relative flex h-20 w-20 shrink-0 items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${BG_CARD_PURPLE} 0%, ${BG_MAIN} 100%)`,
                    border: `1px solid ${hexToRgba(Y, 0.5)}`,
                    clipPath: CHAMFER_5,
                    boxShadow: INSET_BEVEL_SHADOW,
                  }}
                  title={track.title}
                >
                  <CornerBrackets size={8} />
                  {/* Track number — large yellow monospace readout */}
                  <span
                    className="tabular-nums leading-none"
                    style={{
                      color: Y,
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                      fontSize: '26px',
                      fontWeight: 800,
                      textShadow: `0 0 8px ${hexToRgba(Y, 0.6)}`,
                    }}
                  >
                    {String(track.trackNumber ?? 1).padStart(2, '0')}
                  </span>
                  {/* Audio indicator — bottom-right when audio exists */}
                  {track.audioUrl ? (
                    <span
                      className="absolute bottom-1 right-1 flex items-center gap-0.5"
                      style={{ color: C, filter: `drop-shadow(0 0 3px ${hexToRgba(C, 0.7)})` }}
                      title="Аудио загружено"
                    >
                      <Music2 className="h-3 w-3" />
                    </span>
                  ) : null}
                  {/* Top-left chip — "ТР" marker */}
                  <span
                    className="absolute top-1 left-1"
                    style={{
                      color: hexToRgba(Y, 0.7),
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                      fontSize: '8px',
                      fontWeight: 700,
                      letterSpacing: '1px',
                    }}
                  >
                    ТР
                  </span>
                </div>

                {/* Right side of header: title + status + Канбан */}
                <div className="min-w-0 flex-1">
                  {/* Title row — click to edit inline */}
                  {editingTitle ? (
                    <div
                      className="flex items-center gap-1.5"
                      style={{
                        background: BG_MAIN,
                        border: `1px solid ${hexToRgba(Y, 0.8)}`,
                        clipPath: CHAMFER_3,
                        boxShadow: `0 0 8px ${hexToRgba(Y, 0.35)}`,
                        padding: '2px 4px',
                      }}
                    >
                      <Input
                        autoFocus
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveTitle();
                          } else if (e.key === 'Escape') {
                            setEditingTitle(false);
                          }
                        }}
                        onBlur={handleSaveTitle}
                        className="h-7 border-0 bg-transparent px-1.5 text-sm focus-visible:ring-0"
                        style={{
                          color: TEXT_PRIMARY,
                          fontFamily: 'var(--font-rajdhani), sans-serif',
                          fontWeight: 700,
                          letterSpacing: '0.5px',
                        }}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartEditTitle}
                      className="group flex max-w-full items-center gap-1.5 text-left transition-colors hover:opacity-90"
                      title="Кликните, чтобы изменить название"
                    >
                      <h3
                        className="truncate text-base"
                        style={{
                          color: '#ffffff',
                          fontFamily: 'var(--font-rajdhani), sans-serif',
                          fontWeight: 700,
                          letterSpacing: '0.6px',
                          textShadow: `0 0 6px ${hexToRgba(Y, 0.25)}`,
                        }}
                      >
                        {track.title}
                      </h3>
                      <Pencil
                        className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                        style={{ color: Y }}
                      />
                    </button>
                  )}

                  {/* Subline: project + version chip */}
                  <div
                    className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px]"
                    style={{
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                      color: TEXT_SECONDARY,
                    }}
                  >
                    <span
                      className="px-1.5 py-0.5"
                      style={{
                        background: hexToRgba(P, 0.15),
                        border: `0.5px solid ${hexToRgba(P, 0.4)}`,
                        color: '#b794f4',
                        clipPath: CHAMFER_3,
                        fontWeight: 700,
                        letterSpacing: '0.5px',
                      }}
                    >
                      v{track.version}
                    </span>
                    <span className="opacity-70">
                      {projectOfTrack?.title || 'Без проекта'}
                    </span>
                    {savingField && (
                      <span
                        className="ml-auto flex items-center gap-1"
                        style={{
                          color: Y,
                          letterSpacing: '0.5px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        <span
                          className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
                          style={{ background: Y, boxShadow: `0 0 4px ${hexToRgba(Y, 0.8)}` }}
                        />
                        Сохранение…
                      </span>
                    )}
                  </div>

                  {/* Status + Kanban buttons */}
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <Select value={track.status} onValueChange={handleStatusChange}>
                      <SelectTrigger
                        size="sm"
                        className="w-[150px] shrink-0 h-8 border-0 rounded-none hover:!bg-[#0a0c10] data-[state=open]:!bg-[#0a0c10]"
                        style={{
                          background: BG_PANEL,
                          border: `1px solid ${hexToRgba(C, 0.5)}`,
                          clipPath: CHAMFER_4,
                          color: Y,
                          fontFamily: 'var(--font-jetbrains-mono), monospace',
                          fontSize: '11px',
                          fontWeight: 700,
                          letterSpacing: '1px',
                          textTransform: 'uppercase',
                          boxShadow: INSET_BEVEL_SHADOW,
                        }}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        className="border-0 rounded-none p-1 min-w-[180px]"
                        style={{
                          background: BG_PANEL,
                          border: `1px solid ${hexToRgba(C, 0.5)}`,
                          clipPath: CHAMFER_4,
                          boxShadow: `0 0 16px rgba(0,0,0,0.7), ${INSET_BEVEL_SHADOW}`,
                        }}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem
                            key={status}
                            value={status}
                            className="focus:!bg-[#0a0c10] focus:!text-[#00a8c6] data-[highlighted]:!bg-[#0a0c10] data-[highlighted]:!text-[#00a8c6] hover:!bg-[#0a0c10] hover:!text-[#00a8c6] !text-[#c7a008] border-0 rounded-none"
                            style={{
                              fontFamily: 'var(--font-jetbrains-mono), monospace',
                              fontSize: '11px',
                              fontWeight: 600,
                              letterSpacing: '0.5px',
                              clipPath: CHAMFER_3,
                              padding: '4px 8px',
                            }}
                          >
                            <span className="flex items-center gap-1.5">
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{
                                  backgroundColor: statusDotColors[status] || A,
                                  boxShadow: `0 0 4px ${hexToRgba(statusDotColors[status] || A, 0.6)}`,
                                }}
                              />
                              {statusLabels[status] || status}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {projectOfTrack?.kanbanTaskId && (
                      <button
                        onClick={() => {
                          const project = useDataStore.getState().projects.find((p) => p.id === selectedProjectId);
                          if (!project?.kanbanTaskId) return;
                          useNavigationStore.getState().navigate('kanban');
                          const taskId = project.kanbanTaskId;
                          setTimeout(() => {
                            useKanbanStore.getState().selectProject(taskId);
                          }, 300);
                        }}
                        className="flex items-center gap-1.5 shrink-0 h-8 px-3 transition-all hover:scale-105"
                        style={{
                          clipPath: CHAMFER_4,
                          background: hexToRgba(C, 0.1),
                          border: `1px solid ${hexToRgba(C, 0.5)}`,
                          color: C,
                          fontFamily: 'var(--font-jetbrains-mono), monospace',
                          fontSize: '11px',
                          fontWeight: 700,
                          letterSpacing: '1px',
                          textTransform: 'uppercase',
                          boxShadow: INSET_BEVEL_SHADOW,
                        }}
                        title="Открыть в Канбане"
                      >
                        <LayoutDashboard className="h-3.5 w-3.5" />
                        Канбан
                      </button>
                    )}

                    {/* Priority Select — moved here from the Track Info Grid.
                        Renders inline next to Status + Канбан; uses a compact
                        HUD-styled Select colored by the current priority. */}
                    {primaryKanbanTask ? (
                      <Select
                        value={localKanbanPriority ?? 'medium'}
                        onValueChange={handlePriorityChange}
                      >
                        <SelectTrigger
                          size="sm"
                          className="relative w-[140px] shrink-0 h-8 border-0 rounded-none hover:!bg-[#0a0c10] data-[state=open]:!bg-[#0a0c10]"
                          style={{
                            background: BG_PANEL,
                            border: `1px solid ${hexToRgba(priorityColor(localKanbanPriority ?? 'medium'), 0.5)}`,
                            clipPath: CHAMFER_4,
                            color: priorityColor(localKanbanPriority ?? 'medium'),
                            fontFamily: 'var(--font-jetbrains-mono), monospace',
                            fontSize: '11px',
                            fontWeight: 700,
                            letterSpacing: '1px',
                            textTransform: 'uppercase',
                            boxShadow: INSET_BEVEL_SHADOW,
                          }}
                        >
                          <SelectValue />
                          {savingField === 'priority' && (
                            <span
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-block h-1.5 w-1.5 animate-pulse rounded-full"
                              style={{ background: Y, boxShadow: `0 0 4px ${hexToRgba(Y, 0.8)}` }}
                            />
                          )}
                        </SelectTrigger>
                        <SelectContent
                          className="border-0 rounded-none p-1 min-w-[160px]"
                          style={{
                            background: BG_PANEL,
                            border: `1px solid ${hexToRgba(Y, 0.5)}`,
                            clipPath: CHAMFER_4,
                            boxShadow: `0 0 16px rgba(0,0,0,0.7), ${INSET_BEVEL_SHADOW}`,
                          }}
                        >
                          {(['high', 'medium', 'low'] as const).map((p) => (
                            <SelectItem
                              key={p}
                              value={p}
                              className="focus:!bg-[#0a0c10] data-[highlighted]:!bg-[#0a0c10] hover:!bg-[#0a0c10] border-0 rounded-none"
                              style={{
                                color: priorityColor(p),
                                fontFamily: 'var(--font-jetbrains-mono), monospace',
                                fontSize: '11px',
                                fontWeight: 700,
                                letterSpacing: '0.5px',
                                textTransform: 'uppercase',
                                clipPath: CHAMFER_3,
                                padding: '4px 8px',
                              }}
                            >
                              <span className="flex items-center gap-1.5">
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{
                                    backgroundColor: priorityColor(p),
                                    boxShadow: `0 0 4px ${hexToRgba(priorityColor(p), 0.6)}`,
                                  }}
                                />
                                {priorityLabel(p)}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* ── B. Description Section ─ kanban task description, inline-editable ── */}
              <div className="mt-3">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span
                    className="text-[10px]"
                    style={{
                      ...SECTION_TITLE_STYLE,
                      fontSize: '10px',
                      letterSpacing: '1.5px',
                    }}
                  >
                    Описание
                  </span>
                  {savingField === 'description' && (
                    <span
                      className="flex items-center gap-1 text-[9px]"
                      style={{ color: Y, fontFamily: 'var(--font-jetbrains-mono), monospace', letterSpacing: '0.5px' }}
                    >
                      <span
                        className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
                        style={{ background: Y, boxShadow: `0 0 4px ${hexToRgba(Y, 0.8)}` }}
                      />
                      Сохранение…
                    </span>
                  )}
                </div>

                {!primaryKanbanTask ? (
                  // No linked kanban task — show a hint instead of an editor
                  <div
                    className="px-2.5 py-2 text-[11px]"
                    style={{
                      background: BG_MAIN,
                      border: `0.5px solid ${hexToRgba(BORDER_MUTED, 1)}`,
                      clipPath: CHAMFER_3,
                      color: TEXT_SECONDARY,
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                    }}
                  >
                    Нет связанной kanban-задачи.
                  </div>
                ) : editingDescription ? (
                  // Edit mode: textarea + Save / Cancel buttons
                  <div
                    className="relative"
                    style={{
                      background: BG_MAIN,
                      border: `1px solid ${hexToRgba(Y, 0.8)}`,
                      clipPath: CHAMFER_4,
                      boxShadow: `0 0 8px ${hexToRgba(Y, 0.35)}`,
                      padding: '6px 8px 8px',
                    }}
                  >
                    <textarea
                      autoFocus
                      value={descriptionDraft}
                      onChange={(e) => setDescriptionDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          handleSaveDescription();
                        } else if (e.key === 'Escape') {
                          setEditingDescription(false);
                        }
                      }}
                      placeholder="Опишите трек — настроение, референсы, инструкции…"
                      rows={3}
                      className="w-full resize-none border-0 bg-transparent px-1 py-1 text-[12px] outline-none placeholder:opacity-40"
                      style={{
                        color: TEXT_PRIMARY,
                        fontFamily: 'var(--font-rajdhani), sans-serif',
                        fontWeight: 500,
                        lineHeight: 1.4,
                      }}
                    />
                    <div className="mt-1.5 flex items-center justify-between">
                      <span
                        className="text-[9px]"
                        style={{
                          color: TEXT_SECONDARY,
                          fontFamily: 'var(--font-jetbrains-mono), monospace',
                          letterSpacing: '0.5px',
                        }}
                      >
                        ⌘+Enter — сохранить
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingDescription(false)}
                          className="flex h-6 items-center gap-1 px-2 transition-all hover:opacity-80"
                          style={{
                            background: BG_PANEL,
                            border: `0.5px solid ${hexToRgba(A, 0.5)}`,
                            color: TEXT_SECONDARY,
                            clipPath: CHAMFER_3,
                            fontFamily: 'var(--font-jetbrains-mono), monospace',
                            fontSize: '10px',
                            fontWeight: 700,
                            letterSpacing: '0.5px',
                            textTransform: 'uppercase',
                          }}
                        >
                          <X className="h-3 w-3" />
                          Отмена
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveDescription}
                          className="flex h-6 items-center gap-1 px-2.5 transition-all hover:brightness-110"
                          style={YELLOW_BUTTON_STYLE}
                        >
                          <Check className="h-3 w-3" />
                          Сохранить
                        </button>
                      </div>
                    </div>
                  </div>
                ) : localKanbanDescription ? (
                  // Display mode: HUD bubble with the description text
                  <button
                    type="button"
                    onClick={handleStartEditDescription}
                    className="group relative block w-full px-2.5 py-2 text-left transition-all hover:brightness-110"
                    style={{
                      background: hexToRgba(BG_CARD_TEAL, 0.7),
                      border: `0.5px solid ${hexToRgba(C, 0.3)}`,
                      borderLeft: `2px solid ${Y}`,
                      clipPath: CHAMFER_3,
                      boxShadow: `inset 0 1px 1px rgba(255,255,255,0.04), 0 0 6px ${hexToRgba(Y, 0.1)}`,
                    }}
                  >
                    <p
                      className="whitespace-pre-wrap break-words text-[12px]"
                      style={{
                        color: TEXT_PRIMARY,
                        fontFamily: 'var(--font-rajdhani), sans-serif',
                        fontWeight: 500,
                        lineHeight: 1.45,
                      }}
                    >
                      {localKanbanDescription}
                    </p>
                    <Pencil
                      className="absolute right-1.5 top-1.5 h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ color: Y }}
                    />
                  </button>
                ) : (
                  // Empty state: "Нет описания" + "Добавить описание" button
                  <button
                    type="button"
                    onClick={handleStartEditDescription}
                    className="group flex w-full items-center justify-between px-2.5 py-2 text-left transition-all hover:brightness-110"
                    style={{
                      background: BG_MAIN,
                      border: `0.5px dashed ${hexToRgba(Y, 0.4)}`,
                      clipPath: CHAMFER_3,
                    }}
                  >
                    <span
                      className="text-[11px]"
                      style={{
                        color: TEXT_SECONDARY,
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Нет описания
                    </span>
                    <span
                      className="flex h-6 items-center gap-1 px-2 transition-all group-hover:brightness-110"
                      style={{
                        ...YELLOW_BUTTON_STYLE,
                        fontSize: '10px',
                        padding: '2px 8px',
                      }}
                    >
                      <Plus className="h-3 w-3" />
                      Добавить
                    </span>
                  </button>
                )}
              </div>

              {/* ── C. Track Info Grid — 3×2 grid of small HUD stat cells ── */}
              {/* Priority used to live here as the 6th cell; it has been moved
                  up to the Profile Header row (next to Status + Канбан button)
                  per the new layout. Grid now has 5 cells: Номер, Длительность,
                  Референсы, Дедлайн, Автор. */}
              <div
                className="mt-3 grid grid-cols-3 gap-1.5"
              >
                {/* Track # */}
                <InfoStatCell
                  label="Номер"
                  value={String(track.trackNumber ?? 1).padStart(2, '0')}
                />
                {/* Duration */}
                <InfoStatCell
                  label="Длительность"
                  value={formatDuration(
                    (track.durationMs ?? 0) / 1000
                  )}
                />
                {/* References — count of top-level tasks on the project's
                    "Референсы" kanban board. Shows "—" while loading or when
                    the project has no references board. */}
                <InfoStatCell
                  label="Референсы"
                  value={
                    referencesCount === null
                      ? '—'
                      : referencesCount === 0
                        ? 'Нет'
                        : `${referencesCount} реф.`
                  }
                />
                {/* Deadline — read from the first trackTask's deadline field
                    (the primary kanban task linked to this track). Formatted
                    DD.MM.YY; "Нет" when no deadline is set. */}
                <InfoStatCell
                  label="Дедлайн"
                  value={
                    primaryKanbanTask?.deadline
                      ? format(new Date(primaryKanbanTask.deadline), 'dd.MM.yy')
                      : 'Нет'
                  }
                />
                {/* Created by */}
                <InfoStatCell
                  label="Автор"
                  value={trackDetail?.creator?.displayName || '—'}
                />
              </div>

              {/* ── D. Task tree breakdown — one row per trackTask with mini progress bar ──
                  The WaveformProgressBar + StatDot row used to live here too;
                  they have been moved under the audio player (above the
                  comments section) per the new layout. Only the task tree
                  breakdown remains in the Profile Panel. */}
              {trackTasks.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Zap
                      className="h-3.5 w-3.5"
                      style={{ color: Y, filter: `drop-shadow(0 0 4px ${hexToRgba(Y, 0.6)})` }}
                    />
                    <span
                      className="text-[10px]"
                      style={{
                        ...SECTION_TITLE_STYLE,
                        fontSize: '10px',
                        letterSpacing: '1.5px',
                      }}
                    >
                      Задачи трека
                    </span>
                  </div>
                  <div
                    className="max-h-44 overflow-y-auto pr-1"
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: `${hexToRgba(Y, 0.4)} transparent`,
                    }}
                  >
                    <div className="flex flex-col gap-1.5">
                      {trackTasks.map((tt) => {
                        const subtasks = countAllDescendants([tt]);
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
                </div>
              )}
            </div>

            {/* RIGHT (lg:col-span-1): Track text editor (lyrics/notes).
                Stored in the kanban task's `trackConfig` JSON under `trackText`.
                Saves on blur or Ctrl/Cmd+Enter via PUT /api/tasks {id, trackConfig}. */}
            <div
              className="relative flex flex-col gap-2 p-2.5 lg:p-3"
              style={{
                background: BG_MAIN,
                border: `1px solid ${hexToRgba(Y, 0.35)}`,
                clipPath: CHAMFER_5,
                boxShadow: INSET_BEVEL_SHADOW,
              }}
            >
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <MessageSquareQuote
                    className="h-3.5 w-3.5"
                    style={{ color: Y, filter: `drop-shadow(0 0 3px ${hexToRgba(Y, 0.5)})` }}
                  />
                  <span
                    className="text-[10px]"
                    style={{
                      ...SECTION_TITLE_STYLE,
                      fontSize: '10px',
                      letterSpacing: '1.5px',
                    }}
                  >
                    Текст трека
                  </span>
                </div>
                {savingField === 'trackText' && (
                  <span
                    className="flex items-center gap-1 text-[9px]"
                    style={{ color: Y, fontFamily: 'var(--font-jetbrains-mono), monospace', letterSpacing: '0.5px' }}
                  >
                    <span
                      className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
                      style={{ background: Y, boxShadow: `0 0 4px ${hexToRgba(Y, 0.8)}` }}
                    />
                    Сохранение…
                  </span>
                )}
              </div>

              {primaryKanbanTask ? (
                <div
                  className="relative flex-1"
                  style={{
                    background: '#0a0c10',
                    border: `1px solid ${trackTextFocused ? hexToRgba(Y, 0.8) : hexToRgba(BORDER_MUTED, 1)}`,
                    clipPath: CHAMFER_4,
                    boxShadow: trackTextFocused
                      ? `0 0 8px ${hexToRgba(Y, 0.35)}`
                      : 'inset 0 1px 1px rgba(0,0,0,0.6)',
                    transition: 'border-color 120ms ease, box-shadow 120ms ease',
                    padding: '6px 8px',
                  }}
                >
                  <textarea
                    value={trackTextDraft}
                    onChange={(e) => setTrackTextDraft(e.target.value)}
                    onFocus={() => setTrackTextFocused(true)}
                    onBlur={() => {
                      setTrackTextFocused(false);
                      handleSaveTrackText();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleSaveTrackText();
                      }
                    }}
                    placeholder="Текст трека, лирика, заметки… ⌘+Enter — сохранить"
                    className="w-full resize-none border-0 bg-transparent px-1 py-1 text-[12px] outline-none placeholder:opacity-40"
                    style={{
                      color: TEXT_PRIMARY,
                      fontFamily: 'var(--font-rajdhani), sans-serif',
                      fontWeight: 500,
                      lineHeight: 1.45,
                      minHeight: '180px',
                    }}
                  />
                </div>
              ) : (
                <div
                  className="px-2.5 py-2 text-[11px]"
                  style={{
                    background: BG_MAIN,
                    border: `0.5px solid ${hexToRgba(BORDER_MUTED, 1)}`,
                    clipPath: CHAMFER_3,
                    color: TEXT_SECONDARY,
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                  }}
                >
                  Нет связанной kanban-задачи.
                </div>
              )}

              {/* Hint — Ctrl+Enter to save; appears even when empty */}
              {primaryKanbanTask && (
                <div
                  className="text-[9px]"
                  style={{
                    color: TEXT_SECONDARY,
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    letterSpacing: '0.5px',
                  }}
                >
                  ⌘+Enter — сохранить · Сохранение автоматически при потере фокуса
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
                <span>{v.version === 1 && !v.label ? 'Оригинал' : v.label || `v${v.version}`}</span>
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
            Добавить версию
          </motion.button>
        </div>
        {/* Current version info */}
        {activeVersion && (
          <div className="mt-1.5 flex items-center gap-2 text-[10px]" style={{ color: `${TEXT_SECONDARY}b3`, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
            <span>Версия {activeVersion.version}</span>
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
                <span>{activeVersion.commentCount} комм.</span>
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

      {/* Main content — single full-width column (chat moved to global floating widget) */}
      <div className="min-h-0 flex-1">
        <div className="flex h-full flex-col">
              {/* Waveform */}
              <div className="shrink-0 px-4 pt-4 lg:px-6">
                {/* Marker mode toolbar — always visible near waveform */}
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium uppercase tracking-widest" style={{ color: TEXT_SECONDARY, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>Маркер:</span>
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
                        ? 'Кликните волну для начала, затем снова для конца'
                        : 'Кликните волну для маркера'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {markerMode === 'range' && isSelectingRange && rangeStartMs > 0 && (
                      <Badge variant="outline" className="border-[#c7a008]/30 text-[#c7a008] text-[10px] animate-pulse">
                        Начало: {formatTimestamp(rangeStartMs)} — кликните конец…
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

                {/* Waveform wrapper — no clip-path so tooltip can escape */}
                <div
                  className="relative"
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    if (duration > 0 && waveformReady) {
                      const pct = x / rect.width;
                      const ms = Math.round(pct * duration * 1000);
                      setWaveformHoverTime({ x, ms });
                    }
                  }}
                  onMouseLeave={() => setWaveformHoverTime(null)}
                >
                {/* Hover time tooltip — in the OUTER wrapper, above all clip-paths */}
                {waveformHoverTime && !hoveredMarkerId && !pinnedMarkerId && (
                  <div
                    className="pointer-events-none absolute z-50 -translate-x-1/2"
                    style={{ left: waveformHoverTime.x, top: '0px' }}
                  >
                    <span
                      className="px-2 py-1 text-[10px] font-bold whitespace-nowrap"
                      style={{
                        background: Y,
                        color: '#0a0b10',
                        clipPath: CHAMFER_3,
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                        boxShadow: `0 0 10px ${hexToRgba(Y, 0.6)}, 0 2px 8px rgba(0,0,0,0.8)`,
                        position: 'relative',
                        top: '-24px',
                      }}
                    >
                      {formatTimestamp(waveformHoverTime.ms)}
                    </span>
                  </div>
                )}

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
                        Загрузка волны...
                      </span>
                    </div>
                  )}
                  <div className="relative">
                    <canvas
                      ref={canvasRef}
                      className={`h-24 w-full ${!waveformReady ? 'hidden' : ''} ${
                        markerMode === 'range'
                          ? 'cursor-ew-resize'
                          : 'cursor-crosshair'
                      }`}
                      onClick={handleWaveformClick}
                    />
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
                              isFocused ? 'bg-[#c7a008]/22 border-y-2 border-[#c7a008]' :
                              isHovered ? 'bg-[#c7a008]/10 border-y-2 border-[#c7a008]/40' :
                              comment.isResolved ? 'bg-[#4a8d6f]/8 border-y-2 border-[#4a8d6f]/20' :
                              'bg-[#c7a008]/8 border-y-2 border-[#c7a008]/20'
                            }`}
                            style={{
                              left: `${startPct * 100}%`,
                              width: `${(endPct - startPct) * 100}%`,
                              ...(isFocused ? {
                                boxShadow: `0 0 16px rgba(199,160,8,0.5), inset 0 0 12px rgba(199,160,8,0.25)`,
                                animation: 'kb6-focus-badge 1.6s ease-in-out infinite',
                              } : {}),
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
                              showMarkerTooltipFor(e.currentTarget, comment.id);
                            }}
                            onMouseLeave={() => {
                              markerTooltipHoverRef.current = false;
                              if (pinnedMarkerId === comment.id) return; // pinned: keep visible
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
                              // Pin the tooltip so it stays open after click.
                              setPinnedMarkerId(comment.id);
                              showMarkerTooltipFor(e.currentTarget, comment.id);
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
                                {/* Pulsing focus halo for range start */}
                                {isFocused && (
                                  <div
                                    className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2"
                                    style={{
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '9999px',
                                      border: `1.5px solid ${Y}`,
                                      boxShadow: `0 0 10px ${Y}, inset 0 0 8px ${hexToRgba(Y, 0.4)}`,
                                      animation: 'kb6-focus-badge 1.6s ease-in-out infinite',
                                    }}
                                  />
                                )}
                                <div
                                  className={`rotate-45 transition-all duration-150 ${
                                    isFocused
                                      ? 'h-4 w-4 bg-[#c7a008] shadow-[0_0_12px_rgba(199,160,8,0.8),0_0_22px_rgba(199,160,8,0.5)]'
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
                                {/* Point marker: cyberpunk HUD diamond pin */}
                                {/* Pulsing focus halo — radiates ring to draw eye */}
                                {isFocused && (
                                  <div
                                    className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2"
                                    style={{
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '9999px',
                                      border: `1.5px solid ${C}`,
                                      boxShadow: `0 0 10px ${C}, inset 0 0 8px ${hexToRgba(C, 0.4)}`,
                                      animation: 'kb6-focus-badge 1.6s ease-in-out infinite',
                                    }}
                                  />
                                )}
                                <div
                                  className="transition-all duration-150"
                                  style={{
                                    width: isFocused ? '14px' : isHovered ? '12px' : '10px',
                                    height: isFocused ? '14px' : isHovered ? '12px' : '10px',
                                    background: comment.isResolved ? G : C,
                                    clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                                    boxShadow: isFocused
                                      ? `0 0 10px ${C}, 0 0 5px ${Y}, 0 0 18px ${hexToRgba(C, 0.5)}`
                                      : isHovered
                                        ? `0 0 6px ${C}`
                                        : comment.isResolved
                                          ? `0 0 3px ${G}`
                                          : `0 0 4px ${hexToRgba(C, 0.6)}`,
                                    border: `1px solid ${Y}`,
                                  }}
                                >
                                  <div style={{
                                    width: '3px', height: '3px',
                                    background: Y,
                                    margin: 'auto',
                                    marginTop: isFocused ? '5px' : isHovered ? '4px' : '3px',
                                  }} />
                                </div>

                                {/* Vertical line down from pin */}
                                <div
                                  className="absolute left-1/2 top-full w-px -translate-x-1/2 transition-colors"
                                  style={{
                                    height: '20px',
                                    background: isFocused
                                      ? `linear-gradient(180deg, ${C}, transparent)`
                                      : isHovered
                                        ? `linear-gradient(180deg, ${hexToRgba(C, 0.6)}, transparent)`
                                        : `linear-gradient(180deg, ${hexToRgba(C, 0.3)}, transparent)`,
                                  }}
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
                                showMarkerTooltipFor(e.currentTarget, comment.id);
                              }}
                              onMouseLeave={() => {
                                markerTooltipHoverRef.current = false;
                                if (pinnedMarkerId === comment.id) return; // pinned: keep visible
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
                                // Pin the tooltip so it stays open after click.
                                setPinnedMarkerId(comment.id);
                                showMarkerTooltipFor(e.currentTarget, comment.id);
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
                      ? `Кликните по волне для перемотки · ${markerMode === 'range' ? 'Первый клик — начало, второй — конец' : 'Кликните для маркера в этой позиции'}`
                      : 'Загрузите аудио для взаимодействия с волной'}
                  </p>
                </div>
              </div>

              {/* Marker hover/click tooltip — rendered via portal to escape overflow clipping.
                  Renders on hover AND when pinned (after click). Cyberpunk 2077 styled:
                  dark bg, yellow border, chamfered corners, corner brackets. */}
              {((hoveredMarkerId || pinnedMarkerId) && markerTooltipPos) && (() => {
                const id = hoveredMarkerId || pinnedMarkerId;
                const comment = comments.find((c) => c.id === id);
                if (!comment) return null;
                const isPinned = pinnedMarkerId === comment.id;
                return createPortal(
                  <AnimatePresence>
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.95 }}
                      transition={{ duration: 0.12 }}
                      className="fixed z-[9999] px-3 py-2 shadow-2xl shadow-black/70"
                      style={{
                        background: BG_PANEL,
                        border: `1px solid ${hexToRgba(Y, 0.6)}`,
                        clipPath: CHAMFER_5,
                        boxShadow: `${INSET_BEVEL_SHADOW}, 0 0 12px ${hexToRgba(Y, 0.25)}`,
                        bottom: window.innerHeight - markerTooltipPos.top + 4,
                        left: markerTooltipPos.right ? 'auto' : markerTooltipPos.left,
                        right: markerTooltipPos.right ? 12 : 'auto',
                        minWidth: 220,
                        maxWidth: 300,
                        whiteSpace: 'normal',
                        transform: markerTooltipPos.right ? 'none' : 'translateX(-50%)',
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
                        // If pinned (clicked), keep the tooltip open even when the
                        // mouse leaves — user must click the X button or click
                        // elsewhere to dismiss a pinned tooltip.
                        if (pinnedMarkerId === comment.id) return;
                        setHoveredMarkerId(null);
                        setMarkerTooltipPos(null);
                      }}
                    >
                      <CornerBrackets size={8} />
                      {/* Close (X) button — top-right corner, yellow on hover */}
                      <button
                        className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center text-muted-foreground transition-colors hover:text-[#c7a008]"
                        style={{ clipPath: CHAMFER_3 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPinnedMarkerId(null);
                          setHoveredMarkerId(null);
                          setMarkerTooltipPos(null);
                        }}
                        aria-label="Close marker tooltip"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <div className="flex items-center gap-2 pr-5">
                        {/* User initials avatar — yellow chip */}
                        <div
                          className="flex h-6 w-6 shrink-0 items-center justify-center text-[9px] font-bold"
                          style={{
                            background: hexToRgba(Y, 0.15),
                            color: Y,
                            border: `1px solid ${hexToRgba(Y, 0.5)}`,
                            clipPath: CHAMFER_3,
                          }}
                        >
                          {getInitials(comment.userName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-semibold leading-tight" style={{ color: TEXT_PRIMARY }}>
                            {comment.userName}
                            {commentNumberMap.get(comment.id) && (
                              <span className="ml-1.5 text-xs font-bold" style={{ color: Y }}>
                                #{commentNumberMap.get(comment.id)}
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] leading-tight" style={{ color: Y, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                            {comment.rangeEndMs && comment.rangeEndMs > comment.timestampMs
                              ? `${formatTimestamp(comment.timestampMs)} → ${formatTimestamp(comment.rangeEndMs)}`
                              : formatTimestamp(comment.timestampMs)} · {format(new Date(comment.createdAt), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </div>
                      <div className="mt-1.5 border-t pt-1.5" style={{ borderColor: hexToRgba(Y, 0.25) }}>
                        <p className="line-clamp-3 text-[10px] leading-relaxed" style={{ color: TEXT_PRIMARY, opacity: 0.85 }}>
                          {comment.text}
                        </p>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1 border-t pt-1.5" style={{ borderColor: hexToRgba(Y, 0.25) }}>
                        {/* Edit button — yellow styled */}
                        <button
                          className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase transition-colors"
                          style={{
                            color: Y,
                            background: hexToRgba(Y, 0.08),
                            border: `0.5px solid ${hexToRgba(Y, 0.4)}`,
                            clipPath: CHAMFER_3,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = hexToRgba(Y, 0.2); }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = hexToRgba(Y, 0.08); }}
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingComment(comment);
                            handleMarkerClick(comment);
                            setPinnedMarkerId(null);
                            setHoveredMarkerId(null);
                            setMarkerTooltipPos(null);
                          }}
                        >
                          <Pencil className="h-2.5 w-2.5" />
                          Изменить
                        </button>
                        {/* Resolve button — cyan styled */}
                        <button
                          className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase transition-colors"
                          style={{
                            color: C,
                            background: hexToRgba(C, 0.08),
                            border: `0.5px solid ${hexToRgba(C, 0.4)}`,
                            clipPath: CHAMFER_3,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = hexToRgba(C, 0.2); }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = hexToRgba(C, 0.08); }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleResolved(comment.id, comment.isResolved);
                          }}
                        >
                          {comment.isResolved ? <DoubleCheckIcon className="h-2.5 w-2.5" /> : <Check className="h-2.5 w-2.5" />}
                          {comment.isResolved ? 'Отменить' : 'Решено'}
                        </button>
                        {/* Delete button — yellow styled with red hover hint */}
                        <button
                          className="ml-auto flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase transition-colors"
                          style={{
                            color: Y,
                            background: hexToRgba(Y, 0.08),
                            border: `0.5px solid ${hexToRgba(Y, 0.4)}`,
                            clipPath: CHAMFER_3,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#ff5a5a';
                            e.currentTarget.style.background = 'rgba(255,90,90,0.15)';
                            e.currentTarget.style.borderColor = 'rgba(255,90,90,0.5)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = Y;
                            e.currentTarget.style.background = hexToRgba(Y, 0.08);
                            e.currentTarget.style.borderColor = hexToRgba(Y, 0.4);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteComment(comment.id);
                            setPinnedMarkerId(null);
                            setHoveredMarkerId(null);
                            setMarkerTooltipPos(null);
                          }}
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                          Удалить
                        </button>
                      </div>
                      {isPinned && (
                        <div className="mt-1.5 text-center text-[9px] uppercase tracking-widest" style={{ color: hexToRgba(Y, 0.6), fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                          ◆ Закреплено — кликните × для закрытия
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>,
                  document.body
                );
              })()}

                </div>{/* End waveform wrapper */}

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
                {/* Seek bar — continuous smooth bar, no segments */}
                <div className="mb-3">
                  <div
                    className="group relative h-2.5 w-full cursor-pointer"
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
                    {/* Continuous fill — yellow→cyan gradient with glow */}
                    <div
                      className="absolute inset-y-0 left-0 transition-all duration-100"
                      style={{
                        width: `${progress * 100}%`,
                        background: `linear-gradient(to right, ${P}, ${Y})`,
                        boxShadow: `0 0 6px ${hexToRgba(Y, 0.6)}, 0 0 3px ${hexToRgba(P, 0.4)}`,
                        clipPath: CHAMFER_3,
                      }}
                    />
                    {/* Thumb */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                      style={{
                        left: `${progress * 100}%`,
                        background: '#ffffff',
                        boxShadow: `0 0 6px ${Y}, 0 0 2px ${Y}`,
                      }}
                    />
                  </div>
                  {/* Time display row — large yellow current / smaller grey total */}
                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <span
                      className="tabular-nums"
                      style={{
                        color: Y,
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                        fontSize: '16px',
                        fontWeight: 800,
                        textShadow: `0 0 6px ${hexToRgba(Y, 0.5)}`,
                        letterSpacing: '0.5px',
                      }}
                    >
                      {formatDuration(currentTime)}
                    </span>
                    <span
                      className="tabular-nums"
                      style={{
                        color: TEXT_SECONDARY,
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                        fontSize: '11px',
                      }}
                    >
                      {formatDuration(displayDuration)}
                    </span>
                  </div>
                </div>

                {/* Controls row — transport buttons + volume + hint */}
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
                      <TooltipContent className="!bg-[#11141d] !text-[#c7a008] !border !border-[#c7a008]/40 !rounded-none" style={{ clipPath: "polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))", boxShadow: "0 0 8px rgba(199,160,8,0.25)" }}>Назад 5с</TooltipContent>
                    </Tooltip>

                    <Button
                      size="icon"
                      className="h-12 w-12 rounded-none border-0"
                      style={{
                        clipPath: CHAMFER_4,
                        // Purple→yellow gradient bg per cyberpunk 2077 spec
                        background: `linear-gradient(135deg, ${P} 0%, ${Y} 100%)`,
                        boxShadow: `0 0 16px ${hexToRgba(Y, 0.55)}, 0 0 8px ${hexToRgba(P, 0.5)}, inset 0 1px 0 rgba(255,255,255,0.25)`,
                        border: `1.5px solid ${hexToRgba(Y, 0.5)}`,
                      }}
                      onClick={togglePlay}
                    >
                      {isPlaying ? (
                        <Pause className="h-5 w-5" style={{ color: '#fff', filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.6))' }} />
                      ) : (
                        <Play className="h-5 w-5 ml-0.5" style={{ color: Y, filter: `drop-shadow(0 0 3px ${Y})` }} />
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
                      <TooltipContent className="!bg-[#11141d] !text-[#c7a008] !border !border-[#c7a008]/40 !rounded-none" style={{ clipPath: "polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))", boxShadow: "0 0 8px rgba(199,160,8,0.25)" }}>Вперёд 5с</TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Volume — chamfered slider with yellow fill */}
                  <div className="flex items-center gap-2 ml-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-none border-0 hover:bg-[#c7a008]/10"
                          style={{
                            clipPath: CHAMFER_4,
                            border: `1px solid ${hexToRgba(Y, 0.5)}`,
                            background: BG_MAIN,
                            color: Y,
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
                      <TooltipContent className="!bg-[#11141d] !text-[#c7a008] !border !border-[#c7a008]/40 !rounded-none" style={{ clipPath: "polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))", boxShadow: "0 0 8px rgba(199,160,8,0.25)" }}>
                        {isMuted ? 'Включить звук' : 'Выключить звук'}
                      </TooltipContent>
                    </Tooltip>
                    <div
                      className="group relative h-2 w-24 cursor-pointer"
                      style={{
                        background: BG_MAIN,
                        clipPath: CHAMFER_3,
                        boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.7)',
                        border: `0.5px solid ${hexToRgba(Y, 0.3)}`,
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
                          background: `linear-gradient(to right, ${Y2}, ${Y})`,
                          clipPath: CHAMFER_3,
                          boxShadow: `0 0 4px ${hexToRgba(Y, 0.6)}`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Keyboard shortcut hint */}
                  <p className="ml-auto hidden text-[11px] lg:block" style={{ color: `${Y}cc`, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                    Пробел: Играть/Пауза · ←→: Перемотка 5с
                  </p>
                </div>
              </div>

              {/* ─── Track Progress + Project Progress ───
                  Moved out of the Track Profile Panel per the new layout: the
                  WaveformProgressBar + StatDot row (track progress) and a new
                  horizontal cyan Project Progress bar sit directly under the
                  audio player, above the comments section. Full width. */}

              {/* Track progress — yellow waveform with chamfered yellow frame.
                  Step 4: bars=48 (denser than the previous 24), wrapped in a
                  6px-padded CHAMFER_5 container with a yellow border + faint
                  yellow tint so the bar reads as a framed HUD element. */}
              <div className="shrink-0 px-4 pt-3 lg:px-6">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Zap
                      className="h-3.5 w-3.5"
                      style={{ color: Y, filter: `drop-shadow(0 0 4px ${hexToRgba(Y, 0.6)})` }}
                    />
                    <span
                      className="text-[10px]"
                      style={{
                        ...SECTION_TITLE_STYLE,
                        fontSize: '10px',
                        letterSpacing: '1.5px',
                      }}
                    >
                      Прогресс трека
                    </span>
                  </div>
                  {/* Compact stats row — colored status dots.
                      Step 5: removed В РАБОТЕ + ПРОВЕРКА, renamed TODO → ОЖИДАНИЕ. */}
                  <div
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px]"
                    style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                  >
                    <StatDot label="ВСЕГО" count={trackProgress.total} color={A} />
                    <StatDot label="ГОТОВО" count={trackProgress.done} color={G} />
                    <StatDot label="ОЖИДАНИЕ" count={trackProgress.todo} color={A} />
                  </div>
                </div>
                <div
                  style={{
                    border: `1px solid ${hexToRgba(Y, 0.4)}`,
                    clipPath: CHAMFER_5,
                    padding: '6px',
                    background: hexToRgba(Y, 0.04),
                  }}
                >
                  <WaveformProgressBar
                    progress={trackProgress.pct}
                    accentColor={Y}
                    height={32}
                    bars={48}
                  />
                </div>

                {/* Project progress — horizontal cyan bar, visually distinct
                    from the yellow track progress above.
                    Step 8: thinner than the track progress, cyan border + cyan
                    fill gradient. Shows "Прогресс проекта" title, percentage,
                    and done/total count. */}
                {projectProgress ? (
                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <LayoutDashboard
                          className="h-3 w-3"
                          style={{ color: C, filter: `drop-shadow(0 0 3px ${hexToRgba(C, 0.5)})` }}
                        />
                        <span
                          className="text-[10px]"
                          style={{
                            ...SECTION_TITLE_STYLE,
                            fontSize: '10px',
                            letterSpacing: '1.5px',
                            color: C,
                          }}
                        >
                          Прогресс проекта
                        </span>
                      </div>
                      <div
                        className="flex items-center gap-2 text-[10px]"
                        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                      >
                        <span
                          className="tabular-nums"
                          style={{
                            color: C,
                            fontWeight: 800,
                            textShadow: `0 0 6px ${hexToRgba(C, 0.4)}`,
                          }}
                        >
                          {projectProgress.pct}%
                        </span>
                        <span
                          className="tabular-nums"
                          style={{ color: TEXT_SECONDARY }}
                        >
                          {projectProgress.done}/{projectProgress.total}
                        </span>
                      </div>
                    </div>
                    {/* Horizontal cyan bar — thinner than the WaveformProgressBar */}
                    <div
                      className="relative h-2 w-full"
                      style={{
                        background: BG_MAIN,
                        border: `1px solid ${hexToRgba(C, 0.5)}`,
                        clipPath: CHAMFER_3,
                        boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.7)',
                      }}
                    >
                      <div
                        className="absolute inset-y-0 left-0"
                        style={{
                          width: `${projectProgress.pct}%`,
                          background: `linear-gradient(to right, ${P2}, ${C})`,
                          boxShadow: `0 0 6px ${hexToRgba(C, 0.6)}`,
                          transition: 'width 320ms ease',
                        }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

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
                    className="h-7 gap-1.5 text-xs border-0 rounded-none transition-all"
                    style={{
                      ...YELLOW_BUTTON_STYLE,
                      paddingRight: '10px',
                      paddingLeft: '10px',
                      paddingTop: '4px',
                      paddingBottom: '4px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = `0 0 16px ${hexToRgba(Y, 0.6)}, 0 0 6px ${hexToRgba(Y, 0.4)}, inset 0 1px 0 rgba(255,255,255,0.35)`;
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = (YELLOW_BUTTON_STYLE.boxShadow as string) || '';
                      e.currentTarget.style.transform = 'scale(1)';
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
                    Добавить комментарий
                  </Button>
                </div>

                {/* Comment sort bar — replaces the removed participant presence panel.
                    Cyberpunk HUD: dark bg, cyan border, chamfered corners, yellow active. */}
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
                  <span
                    className="text-[10px] uppercase tracking-widest"
                    style={{ color: TEXT_SECONDARY, fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                  >
                    Сортировка:
                  </span>
                  <div className="flex items-center gap-1">
                    {([
                      { id: 'date', label: 'По дате' },
                      { id: 'time', label: 'По времени' },
                      { id: 'author', label: 'По автору' },
                      { id: 'status', label: 'По статусу' },
                    ] as const).map((opt) => {
                      const isActive = sortBy === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => setSortBy(opt.id)}
                          className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all"
                          style={
                            isActive
                              ? {
                                  color: '#0a0b10',
                                  background: `linear-gradient(135deg, ${Y} 0%, ${Y2} 100%)`,
                                  clipPath: CHAMFER_3,
                                  boxShadow: `0 0 6px ${hexToRgba(Y, 0.5)}`,
                                  border: '0.5px solid transparent',
                                }
                              : {
                                  color: TEXT_SECONDARY,
                                  background: BG_MAIN,
                                  border: `0.5px solid ${hexToRgba(BORDER_MUTED, 1)}`,
                                  clipPath: CHAMFER_3,
                                }
                          }
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.color = Y;
                              e.currentTarget.style.borderColor = hexToRgba(Y, 0.5);
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.color = TEXT_SECONDARY;
                              e.currentTarget.style.borderColor = hexToRgba(BORDER_MUTED, 1);
                            }
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <span
                    className="ml-auto text-[10px] tabular-nums"
                    style={{ color: hexToRgba(Y, 0.7), fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                  >
                    {sortedTree.length} комм.
                  </span>
                </div>

                <AnimatePresence>
                  {showCommentInput && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.97 }}
                      transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                      className="shrink-0 mt-3 mb-4"
                    >
                      <div
                        className="relative p-3"
                        style={{
                          background: `linear-gradient(135deg, ${hexToRgba(Y, 0.12)} 0%, ${BG_PANEL} 40%, ${hexToRgba(C, 0.06)} 100%)`,
                          border: `2px solid ${Y}`,
                          clipPath: CHAMFER_5,
                          boxShadow: `${INSET_BEVEL_SHADOW}, 0 0 16px ${hexToRgba(Y, 0.4)}, 0 0 6px ${hexToRgba(Y, 0.25)}, inset 0 0 12px ${hexToRgba(Y, 0.08)}`,
                        }}
                      >
                        <CornerBrackets size={8} />
                        {/* Chip row — marker mode + timestamp / range chips */}
                        <div className="mb-2 flex flex-wrap items-center gap-1.5">
                          {/* Marker mode toggle */}
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
                              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium transition-all ${
                                markerMode === 'point'
                                  ? 'text-black'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                              style={
                                markerMode === 'point'
                                  ? { background: C, clipPath: CHAMFER_3, boxShadow: `0 0 4px ${hexToRgba(Y, 0.4)}` }
                                  : undefined
                              }
                            >
                              <MapPin className="h-2.5 w-2.5" />
                              Point
                            </button>
                            <button
                              onClick={() => {
                                setMarkerMode('range');
                                setIsSelectingRange(false);
                              }}
                              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium transition-all ${
                                markerMode === 'range'
                                  ? 'text-black'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                              style={
                                markerMode === 'range'
                                  ? { background: Y, clipPath: CHAMFER_3, boxShadow: `0 0 4px ${hexToRgba(Y, 0.4)}` }
                                  : undefined
                              }
                            >
                              <MoveHorizontal className="h-2.5 w-2.5" />
                              Range
                            </button>
                          </div>
                          {/* Timestamp / range chips */}
                          {markerMode === 'range' ? (
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className="border-[#c7a008]/30 text-[#c7a008] text-[10px]"
                                style={{ clipPath: CHAMFER_3 }}
                              >
                                {formatTimestamp(rangeStartMs || commentTimestamp || Math.round(currentTime * 1000))}
                              </Badge>
                              <span className="text-[10px]" style={{ color: Y }}>→</span>
                              {isSelectingRange ? (
                                <Badge
                                  variant="outline"
                                  className="border-[#c7a008]/30 text-[#c7a008] text-[10px] animate-pulse"
                                  style={{ clipPath: CHAMFER_3 }}
                                >
                                  Кликните конец…
                                </Badge>
                              ) : rangeEndMsState > 0 ? (
                                <Badge
                                  variant="outline"
                                  className="border-[#c7a008]/30 text-[#c7a008] text-[10px]"
                                  style={{ clipPath: CHAMFER_3 }}
                                >
                                  {formatTimestamp(rangeEndMsState)}
                                </Badge>
                              ) : (
                                <span className="text-[10px]" style={{ color: `${Y}99` }}>
                                  Кликните начало на волне
                                </span>
                              )}
                              {rangeEndMsState > rangeStartMs && (
                                <span className="text-[9px]" style={{ color: `${Y}cc` }}>
                                  ({formatDuration((rangeEndMsState - rangeStartMs) / 1000)})
                                </span>
                              )}
                            </div>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-[#00a8c6]/30 text-[#00a8c6] text-[10px]"
                              style={{ clipPath: CHAMFER_3 }}
                            >
                              {formatTimestamp(commentTimestamp || Math.round(currentTime * 1000))}
                            </Badge>
                          )}
                          {/* Range selection in-progress hint chip */}
                          {markerMode === 'range' && isSelectingRange && (
                            <span className="text-[10px] font-bold" style={{ color: Y }}>
                              📍 Начало диапазона — кликните волну для конца
                            </span>
                          )}
                          {/* Cancel (X) button — right side of chip row */}
                          <button
                            className="ml-auto flex h-5 w-5 items-center justify-center text-muted-foreground transition-colors hover:text-[#c7a008]"
                            style={{ clipPath: CHAMFER_3 }}
                            onClick={() => {
                              setShowCommentInput(false);
                              setNewCommentText('');
                              setRangeStartMs(0);
                              setRangeEndMsState(0);
                              setIsSelectingRange(false);
                            }}
                            aria-label="Close comment input"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        {/* Composer row — input (flex-1) + send button, chat-style */}
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Комментарий в этом таймстемпе..."
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
                            className="h-9 flex-1 text-sm border-0 rounded-none"
                            style={HUD_INPUT_STYLE}
                            autoFocus
                          />
                          <Button
                            size="icon"
                            className="h-9 w-9 shrink-0 border-0 rounded-none transition-all"
                            style={{
                              clipPath: CHAMFER_4,
                              background: `linear-gradient(135deg, ${Y} 0%, ${Y2} 100%)`,
                              boxShadow: `0 0 8px ${hexToRgba(Y, 0.4)}, inset 0 1px 0 rgba(255,255,255,0.25)`,
                              color: '#0a0b10',
                            }}
                            onMouseEnter={(e) => {
                              if (!e.currentTarget.disabled) {
                                e.currentTarget.style.boxShadow = `0 0 16px ${hexToRgba(Y, 0.7)}, 0 0 6px ${hexToRgba(Y, 0.5)}, inset 0 1px 0 rgba(255,255,255,0.35)`;
                                e.currentTarget.style.transform = 'scale(1.08)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.boxShadow = `0 0 8px ${hexToRgba(Y, 0.4)}, inset 0 1px 0 rgba(255,255,255,0.25)`;
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                            onClick={handleAddComment}
                            disabled={!newCommentText.trim() || (markerMode === 'range' && isSelectingRange)}
                            aria-label="Post comment"
                          >
                            <Send className="h-4 w-4" style={{ filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.3))' }} />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <ScrollArea className="flex-1" style={{ minHeight: 0, marginTop: showCommentInput ? '12px' : '0' }}>
                  <div className="space-y-2 pb-4">
                    {(() => {
                      const tree = sortedTree;
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
                          <p className="text-xs" style={{ color: TEXT_SECONDARY, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>Нет комментариев. Кликните по волне, чтобы добавить.</p>
                        </div>
                      );
                      const visibleTree = tree.slice(0, visibleCommentCount);
                      const remainingCount = tree.length - visibleCommentCount;
                      return (
                        <>
                          {visibleTree.map((comment) => (
                        <div key={comment.id}>
                          {/* TOP-LEVEL COMMENT — chat-style row: avatar LEFT, content bubble RIGHT */}
                          <motion.div
                            id={`comment-${comment.id}`}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{
                              opacity: 1,
                              x: 0,
                              scale: focusedCommentId === comment.id ? 1.015 : 1,
                            }}
                            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                            className="group flex items-start gap-2.5 transition-transform"
                            style={{ opacity: comment.isResolved ? 0.6 : 1 }}
                          >
                            {/* Avatar — chat-style circular avatar with colored ring */}
                            <Avatar className="h-7 w-7 shrink-0 ring-2 ring-[#0a0c10]">
                              <AvatarFallback
                                className="text-[10px] font-bold"
                                style={{
                                  background: hexToRgba(Y, 0.15),
                                  color: Y,
                                  border: `1px solid ${hexToRgba(Y, 0.4)}`,
                                }}
                              >
                                {getInitials(comment.userName)}
                              </AvatarFallback>
                            </Avatar>

                            {/* Content bubble — dark teal with yellow left border (quote indicator) */}
                            <div
                              data-comment-bubble
                              className="relative min-w-0 flex-1 transition-all duration-300 group-hover:shadow-[0_0_8px_rgba(199,160,8,0.2)]"
                              style={{
                                background: comment.isResolved ? BG_MAIN : BG_CARD_TEAL,
                                clipPath: CHAMFER_5,
                                boxShadow: INSET_BEVEL_SHADOW,
                              }}
                            >
                              {/* Yellow left border — quote/reply indicator stripe */}
                              <div
                                className="absolute left-0 top-0 bottom-0 w-[3px] pointer-events-none transition-all duration-200"
                                style={{
                                  background: comment.isResolved ? hexToRgba(G, 0.6) : Y,
                                  boxShadow:
                                    focusedCommentId === comment.id
                                      ? `0 0 12px ${Y}, 0 0 22px ${hexToRgba(Y, 0.6)}`
                                      : comment.isResolved
                                        ? 'none'
                                        : `0 0 6px ${hexToRgba(Y, 0.5)}`,
                                  width: focusedCommentId === comment.id ? '4px' : '3px',
                                }}
                              />
                              {/* Focused-comment highlight — bright pulsing glow + corner badge + sweep */}
                              {focusedCommentId === comment.id && (() => {
                                const isRangeComment = !!(comment.rangeEndMs && comment.rangeEndMs > comment.timestampMs);
                                const focusColor = isRangeComment ? Y : C;
                                const focusGlow = hexToRgba(focusColor, 0.55);
                                return (
                                  <>
                                    {/* Pulsing outer glow outline */}
                                    <div
                                      className="absolute inset-0 pointer-events-none"
                                      style={{
                                        clipPath: CHAMFER_5,
                                        animation: 'kb6-focus-glow 1.6s ease-in-out infinite',
                                        ['--kb6-focus-color' as string]: focusColor,
                                        ['--kb6-focus-glow' as string]: focusGlow,
                                      }}
                                    />
                                    {/* Top "В ФОКУСЕ" badge */}
                                    <div
                                      className="pointer-events-none absolute -top-3 right-4 z-30 flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                                      style={{
                                        background: '#0a0c10',
                                        color: focusColor,
                                        border: `1.5px solid ${focusColor}`,
                                        clipPath: CHAMFER_3,
                                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                                        boxShadow: `0 0 10px ${hexToRgba(focusColor, 0.7)}, 0 0 4px ${hexToRgba(focusColor, 0.9)}`,
                                        animation: 'kb6-focus-badge 1.6s ease-in-out infinite',
                                      }}
                                    >
                                      <LocateFixed className="h-3 w-3" />
                                      В фокусе
                                    </div>
                                    {/* Diagonal sweep sheen */}
                                    <div
                                      className="pointer-events-none absolute inset-0 overflow-hidden"
                                      style={{ clipPath: CHAMFER_5 }}
                                    >
                                      <div
                                        className="absolute top-0 left-0 h-full w-1/3"
                                        style={{
                                          background: `linear-gradient(100deg, transparent 0%, ${hexToRgba(focusColor, 0.18)} 50%, transparent 100%)`,
                                          animation: 'kb6-focus-sweep 2.4s ease-in-out infinite',
                                        }}
                                      />
                                    </div>
                                  </>
                                );
                              })()}
                              <div className="relative pl-3.5 pr-3 py-2.5">
                                {/* Header row — name + #chip (left), timestamp + actions (right) */}
                                <div className="flex items-start gap-2 mb-1">
                                  {/* Comment number badge — small yellow chamfered chip attached to bubble */}
                                  <span
                                    className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold"
                                    style={{
                                      background: hexToRgba(Y, 0.15),
                                      color: Y,
                                      border: `0.5px solid ${hexToRgba(Y, 0.5)}`,
                                      clipPath: CHAMFER_3,
                                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                                    }}
                                  >
                                    #{commentNumberMap.get(comment.id) ?? '?'}
                                  </span>
                                  <span
                                    className="min-w-0 flex-1 truncate text-xs font-semibold"
                                    style={{ color: TEXT_PRIMARY }}
                                  >
                                    {comment.userName}
                                  </span>
                                  {/* Resolved checkmark — green */}
                                  {comment.isResolved && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          className="shrink-0 rounded p-0.5 text-[#4a8d6f] transition-colors hover:bg-[#4a8d6f]/15"
                                          onClick={() => handleToggleResolved(comment.id, comment.isResolved)}
                                        >
                                          <DoubleCheckIcon className="h-3.5 w-3.5" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent className="!bg-[#11141d] !text-[#c7a008] !border !border-[#c7a008]/40 !rounded-none" style={{ clipPath: "polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))", boxShadow: "0 0 8px rgba(199,160,8,0.25)" }}>{comment.isResolved ? 'Отменить' : 'Решено'}</TooltipContent>
                                    </Tooltip>
                                  )}
                                  {/* Timestamp — yellow monospace, top-right of bubble */}
                                  <Badge
                                    variant="outline"
                                    className={`shrink-0 h-4 px-1 text-[10px] cursor-pointer transition-colors ${
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
                                  {/* Edit / Delete — small icon-only buttons that appear on hover */}
                                  <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          className="rounded p-1 text-muted-foreground transition-colors hover:bg-[#c7a008]/15 hover:text-[#c7a008]"
                                          onClick={() => startEditingComment(comment)}
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent className="!bg-[#11141d] !text-[#c7a008] !border !border-[#c7a008]/40 !rounded-none" style={{ clipPath: "polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))", boxShadow: "0 0 8px rgba(199,160,8,0.25)" }}>Изменить комментарий</TooltipContent>
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
                                      <TooltipContent className="!bg-[#11141d] !text-[#c7a008] !border !border-[#c7a008]/40 !rounded-none" style={{ clipPath: "polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))", boxShadow: "0 0 8px rgba(199,160,8,0.25)" }}>Удалить комментарий</TooltipContent>
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
                                      <div
                                        className="p-2"
                                        style={{
                                          background: hexToRgba(P, 0.08),
                                          border: `1px solid ${hexToRgba(P, 0.3)}`,
                                          clipPath: CHAMFER_3,
                                        }}
                                      >
                                        <textarea
                                          className="w-full resize-none bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
                                          style={{ color: TEXT_PRIMARY }}
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
                                          placeholder="Измените комментарий..."
                                        />
                                        <div className="flex items-center justify-between mt-1.5">
                                          <span className="text-[9px] text-muted-foreground/40">⌘+Enter для сохранения</span>
                                          <div className="flex gap-1.5">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 px-2 text-[10px]"
                                              onClick={cancelEditingComment}
                                            >
                                              Отмена
                                            </Button>
                                            <Button
                                              size="sm"
                                              className="h-6 gap-1 border-0 rounded-none px-2 text-[10px]"
                                              style={{
                                                ...YELLOW_BUTTON_STYLE,
                                                paddingTop: '3px',
                                                paddingBottom: '3px',
                                                paddingLeft: '8px',
                                                paddingRight: '8px',
                                              }}
                                              onClick={() => handleEditComment(comment.id)}
                                              disabled={!editCommentText.trim()}
                                            >
                                              <Check className="h-2.5 w-2.5" />
                                              Сохранить
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
                                      className={`text-xs leading-relaxed ${comment.isResolved ? 'line-through' : ''}`}
                                      style={{ color: TEXT_PRIMARY, opacity: comment.isResolved ? 0.7 : 0.9 }}
                                    >
                                      {comment.text}
                                    </motion.p>
                                  )}
                                </AnimatePresence>
                                {/* Footer row — creation time (left), Reply + Jump-to (right) */}
                                <div className="mt-1.5 flex items-center gap-2">
                                  <span
                                    className="text-[10px]"
                                    style={{ color: Y, fontFamily: 'var(--font-jetbrains-mono), monospace', opacity: 0.7 }}
                                  >
                                    {format(new Date(comment.createdAt), 'MMM d, h:mm a')}
                                  </span>
                                  <div className="ml-auto flex items-center gap-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 gap-1 px-2 text-[10px] text-[#00a8c6] hover:text-[#00a8c6] hover:bg-[#00a8c6]/10"
                                          onClick={() => seekTo(comment.timestampMs / 1000)}
                                        >
                                          <LocateFixed className="h-3 w-3" />
                                          Перейти к
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent className="!bg-[#11141d] !text-[#c7a008] !border !border-[#c7a008]/40 !rounded-none" style={{ clipPath: "polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))", boxShadow: "0 0 8px rgba(199,160,8,0.25)" }}>Перейти к этому таймстемпу</TooltipContent>
                                    </Tooltip>
                                    {/* Reply button — small yellow ghost button at bottom of bubble */}
                                    {!comment.isResolved && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 gap-1 px-2 text-[10px] transition-colors"
                                            style={{
                                              color: Y,
                                              border: `0.5px solid ${hexToRgba(Y, 0.3)}`,
                                              clipPath: CHAMFER_3,
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = hexToRgba(Y, 0.1); }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                            onClick={() => {
                                              setReplyingTo(replyingTo === comment.id ? null : comment.id);
                                              setReplyText('');
                                              if (editingCommentId === comment.id) cancelEditingComment();
                                            }}
                                          >
                                            <Reply className="h-3 w-3" />
                                            Ответить
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent className="!bg-[#11141d] !text-[#c7a008] !border !border-[#c7a008]/40 !rounded-none" style={{ clipPath: "polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))", boxShadow: "0 0 8px rgba(199,160,8,0.25)" }}>Ответить на комментарий</TooltipContent>
                                      </Tooltip>
                                    )}
                                    {comment.isResolved && (
                                      <span className="text-[9px] text-[#4a8d6f]/60 italic">Тема закрыта</span>
                                    )}
                                  </div>
                                </div>
                                {/* Inline reply input — hidden when resolved */}
                                <AnimatePresence>
                                  {replyingTo === comment.id && !comment.isResolved && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      className="mt-2 ml-2 overflow-hidden border-l-2 pl-3"
                                      style={{ borderColor: hexToRgba(Y, 0.4) }}
                                    >
                                      <Input
                                        placeholder={`Ответить ${comment.userName}...`}
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
                                        className="mb-1.5 h-7 text-xs border-0 rounded-none"
                                        style={HUD_INPUT_STYLE}
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
                                          Отмена
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="h-6 gap-1 border-0 rounded-none px-2 text-[10px]"
                                          style={{
                                            ...YELLOW_BUTTON_STYLE,
                                            paddingTop: '3px',
                                            paddingBottom: '3px',
                                            paddingLeft: '8px',
                                            paddingRight: '8px',
                                          }}
                                          onClick={handleReply}
                                          disabled={!replyText.trim()}
                                        >
                                          <Send className="h-2.5 w-2.5" />
                                          Ответить
                                        </Button>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          </motion.div>

                          {/* NESTED REPLIES THREAD — indented with vertical yellow line connector */}
                          {comment.replies.length > 0 && (
                            <div
                              className="mt-1 ml-9 space-y-1 border-l-2 pl-3"
                              style={{ borderColor: hexToRgba(Y, 0.3) }}
                            >
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
                                    className="group/reply flex items-start gap-2"
                                    style={{ opacity: comment.isResolved ? 0.55 : 1 }}
                                  >
                                    {/* Reply avatar — smaller, yellow tinted */}
                                    <Avatar className="h-6 w-6 shrink-0 ring-1 ring-[#0a0c10]">
                                      <AvatarFallback
                                        className="text-[8px] font-bold"
                                        style={{
                                          background: hexToRgba(C, 0.12),
                                          color: C,
                                          border: `1px solid ${hexToRgba(C, 0.35)}`,
                                        }}
                                      >
                                        {getInitials(reply.userName)}
                                      </AvatarFallback>
                                    </Avatar>
                                    {/* Reply bubble — smaller, yellow left stripe */}
                                    <div
                                      data-comment-bubble
                                      className="relative min-w-0 flex-1 transition-all duration-300 group-hover:shadow-[0_0_6px_rgba(199,160,8,0.15)]"
                                      style={{
                                        background: comment.isResolved ? BG_MAIN : hexToRgba(BG_CARD_TEAL, 0.85),
                                        clipPath: CHAMFER_4,
                                        boxShadow: INSET_BEVEL_SHADOW,
                                      }}
                                    >
                                      <div
                                        className="absolute left-0 top-0 bottom-0 w-[2px] pointer-events-none transition-all duration-200"
                                        style={{
                                          background: comment.isResolved ? hexToRgba(G, 0.5) : hexToRgba(Y, 0.7),
                                          boxShadow:
                                            focusedCommentId === reply.id
                                              ? `0 0 10px ${P}, 0 0 18px ${hexToRgba(P, 0.6)}`
                                              : 'none',
                                          width: focusedCommentId === reply.id ? '3px' : '2px',
                                        }}
                                      />
                                      {focusedCommentId === reply.id && (
                                        <>
                                          {/* Pulsing outer glow outline */}
                                          <div
                                            className="absolute inset-0 pointer-events-none"
                                            style={{
                                              clipPath: CHAMFER_4,
                                              animation: 'kb6-focus-glow 1.6s ease-in-out infinite',
                                              ['--kb6-focus-color' as string]: P,
                                              ['--kb6-focus-glow' as string]: hexToRgba(P, 0.55),
                                            }}
                                          />
                                          {/* Top "В ФОКУСЕ" badge */}
                                          <div
                                            className="pointer-events-none absolute -top-2.5 right-3 z-30 flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                                            style={{
                                              background: '#0a0c10',
                                              color: P,
                                              border: `1.5px solid ${P}`,
                                              clipPath: CHAMFER_3,
                                              fontFamily: 'var(--font-jetbrains-mono), monospace',
                                              boxShadow: `0 0 8px ${hexToRgba(P, 0.7)}, 0 0 4px ${hexToRgba(P, 0.9)}`,
                                              animation: 'kb6-focus-badge 1.6s ease-in-out infinite',
                                            }}
                                          >
                                            <LocateFixed className="h-2.5 w-2.5" />
                                            В фокусе
                                          </div>
                                          {/* Diagonal sweep sheen */}
                                          <div
                                            className="pointer-events-none absolute inset-0 overflow-hidden"
                                            style={{ clipPath: CHAMFER_4 }}
                                          >
                                            <div
                                              className="absolute top-0 left-0 h-full w-1/3"
                                              style={{
                                                background: `linear-gradient(100deg, transparent 0%, ${hexToRgba(P, 0.18)} 50%, transparent 100%)`,
                                                animation: 'kb6-focus-sweep 2.4s ease-in-out infinite',
                                              }}
                                            />
                                          </div>
                                        </>
                                      )}
                                      <div className="relative pl-2.5 pr-2 py-1.5">
                                        {/* Header — name (left), edit/delete icons on hover (right) */}
                                        <div className="flex items-center gap-1 mb-0.5">
                                          <span
                                            className="min-w-0 flex-1 truncate text-[11px] font-semibold"
                                            style={{ color: TEXT_PRIMARY }}
                                          >
                                            {reply.userName}
                                          </span>
                                          <span
                                            className="shrink-0 text-[9px]"
                                            style={{ color: Y, fontFamily: 'var(--font-jetbrains-mono), monospace', opacity: 0.7 }}
                                          >
                                            {format(new Date(reply.createdAt), 'MMM d, h:mm a')}
                                          </span>
                                          {/* Reply actions — icon-only, hover-revealed */}
                                          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/reply:opacity-100 focus-within:opacity-100">
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <button
                                                  className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-[#c7a008]/15 hover:text-[#c7a008]"
                                                  onClick={() => startEditingComment(reply)}
                                                >
                                                  <Pencil className="h-2.5 w-2.5" />
                                                </button>
                                              </TooltipTrigger>
                                              <TooltipContent className="!bg-[#11141d] !text-[#c7a008] !border !border-[#c7a008]/40 !rounded-none" style={{ clipPath: "polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))", boxShadow: "0 0 8px rgba(199,160,8,0.25)" }}>Изменить</TooltipContent>
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
                                              <TooltipContent className="!bg-[#11141d] !text-[#c7a008] !border !border-[#c7a008]/40 !rounded-none" style={{ clipPath: "polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))", boxShadow: "0 0 8px rgba(199,160,8,0.25)" }}>Удалить</TooltipContent>
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
                                              <div
                                                className="p-1.5"
                                                style={{
                                                  background: hexToRgba(P, 0.08),
                                                  border: `1px solid ${hexToRgba(P, 0.3)}`,
                                                  clipPath: CHAMFER_3,
                                                }}
                                              >
                                                <textarea
                                                  className="w-full resize-none bg-transparent text-[11px] outline-none placeholder:text-muted-foreground/50"
                                                  style={{ color: TEXT_PRIMARY }}
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
                                                  placeholder="Изменить ответ..."
                                                />
                                                <div className="flex justify-end gap-1 mt-1">
                                                  <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[9px]" onClick={cancelEditingComment}>Отмена</Button>
                                                  <Button
                                                    size="sm"
                                                    className="h-5 gap-0.5 border-0 rounded-none px-1.5 text-[9px]"
                                                    style={{
                                                      ...YELLOW_BUTTON_STYLE,
                                                      paddingTop: '2px',
                                                      paddingBottom: '2px',
                                                      paddingLeft: '6px',
                                                      paddingRight: '6px',
                                                    }}
                                                    onClick={() => handleEditComment(reply.id)}
                                                    disabled={!editCommentText.trim()}
                                                  >
                                                    <Check className="h-2 w-2" /> Сохранить
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
                                              className={`text-[11px] leading-relaxed ${comment.isResolved ? 'line-through' : ''}`}
                                              style={{ color: TEXT_PRIMARY, opacity: comment.isResolved ? 0.6 : 0.85 }}
                                            >
                                              {reply.text}
                                            </motion.p>
                                          )}
                                        </AnimatePresence>
                                        {/* Footer — reply-to-reply button */}
                                        {!comment.isResolved && (
                                          <button
                                            className="mt-0.5 text-[9px] uppercase tracking-wider transition-colors"
                                            style={{ color: hexToRgba(Y, 0.7), fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                            onMouseEnter={(e) => { e.currentTarget.style.color = Y; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.color = hexToRgba(Y, 0.7); }}
                                            onClick={() => {
                                              setReplyingTo(replyingTo === reply.id ? null : reply.id);
                                              setReplyText('');
                                              if (editingCommentId === reply.id) cancelEditingComment();
                                            }}
                                          >
                                            <Reply className="inline h-2.5 w-2.5" /> Ответить
                                          </button>
                                        )}
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
                                                placeholder={`Ответить ${reply.userName}...`}
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
                                                className="mb-1 h-6 text-[10px] border-0 rounded-none"
                                                style={HUD_INPUT_STYLE}
                                                autoFocus
                                              />
                                              <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[9px]" onClick={() => { setReplyingTo(null); setReplyText(''); }}>Отмена</Button>
                                                <Button
                                                  size="sm"
                                                  className="h-5 gap-0.5 border-0 rounded-none px-1.5 text-[9px]"
                                                  style={{
                                                    ...YELLOW_BUTTON_STYLE,
                                                    paddingTop: '2px',
                                                    paddingBottom: '2px',
                                                    paddingLeft: '6px',
                                                    paddingRight: '6px',
                                                  }}
                                                  onClick={handleReply}
                                                  disabled={!replyText.trim()}
                                                >
                                                  <Send className="h-2 w-2" /> Ответить
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
                          ))}
                          {remainingCount > 0 && (
                            <button
                              onClick={() => setVisibleCommentCount((prev) => prev + 4)}
                              className="w-full py-2.5 text-center text-[11px] font-bold uppercase tracking-wider transition-all hover:scale-[1.01]"
                              style={{
                                color: Y,
                                background: hexToRgba(Y, 0.08),
                                border: `1px solid ${hexToRgba(Y, 0.3)}`,
                                clipPath: CHAMFER_4,
                                fontFamily: 'var(--font-jetbrains-mono), monospace',
                              }}
                            >
                              Показать ещё {remainingCount} комм.
                            </button>
                          )}
                        </>
                      );
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
            Добавить новую версию
          </DialogTitle>
          <DialogDescription style={{ color: TEXT_SECONDARY }}>
            Загрузите аудиофайл для создания новой версии трека.
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
              Аудиофайл *
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
                    <p className="text-sm" style={{ color: TEXT_SECONDARY, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>Кликните для выбора аудиофайла</p>
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
              Метка версии
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
                <span>Загрузка...</span>
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
              Отмена
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
                  Загрузка...
                </>
              ) : (
                <>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Загрузить версию
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}