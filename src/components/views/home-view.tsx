'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderKanban, Music2, Lightbulb, Users, ArrowRight, Plus,
  ChevronDown, ChevronRight, ChevronLeft, Disc3, AudioLines, Zap, Clock, Star, X,
  ArrowUp, ArrowDown, Flame, Layers, Key, Pencil, Check, AlertTriangle,
} from 'lucide-react';
import { useAuthStore, useDataStore, useNavigationStore, type Project } from '@/lib/store';
import { useKanbanStore, type Task } from '@/store/kanban-store';
import { hexToRgba } from '@/lib/utils';
import { CreateProjectDialog } from '@/components/shared/create-project-dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { WaveformProgressBar } from '@/components/waveform-progress-bar';

/* ─── palette (muted HUD tokens — strict spec) ─── */
const Y = '#c7a008';   // industrial desaturated gold (--accent-yellow)
const Y2 = '#9e7c06';  // darker gold
const C = '#00a8c6';   // controlled cyan (--accent-cyan)
const C2 = '#0085a0';  // darker cyan
const P = '#7b2cbf';   // deep violet (--accent-purple)
const P2 = '#5a1d8f';  // darker purple
const A = '#718096';   // muted grey (text-secondary)
const G = '#4a8d6f';   // muted green (for done state)
const MAX_QUICK_ACCESS = 7; // maximum cards in Quick Access panel
// Background tokens
const BG_MAIN = '#0a0c10';
const BG_PANEL = '#11141d';
const BG_CARD_PURPLE = '#161224';
const BG_CARD_TEAL = '#0e1a24';
const BORDER_MUTED = '#1f2633';
const TEXT_PRIMARY = '#e2e8f0';
const TEXT_SECONDARY = '#718096';

const typeMeta: Record<string, { label: string; color: string; icon: typeof Disc3 }> = {
  album:   { label: 'Альбом',  color: P,         icon: Disc3 },       // purple card
  ep:      { label: 'EP',      color: P,         icon: AudioLines },  // purple card
  single:  { label: 'Сингл',   color: P,         icon: Music2 },       // purple card
  general: { label: 'Канбан',  color: C,         icon: FolderKanban },// blue card (kanban)
};

const stHex: Record<string, string> = {
  draft: C, in_progress: C, mixing: P, mastering: G, released: C,
};
const stLabel: Record<string, string> = {
  draft: 'Черновик', in_progress: 'В работе', mixing: 'Сведение', mastering: 'Мастеринг', released: 'Релиз',
};

const plural = (n: number, f: [string, string, string]) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return f[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return f[1];
  return f[2];
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

/* ─── shared types ─── */
interface ModalItem {
  id: string;
  title: string;
  type: string;
  status: string;
  date: string;
  trackCount: number;
  onOpen: () => void;
}

/* WaveformProgressBar has been extracted to src/components/waveform-progress-bar.tsx
   and imported above as a shared component. */

/* ─── Project Card — dark data slab with WaveformProgressBar ─── */
function ProjectCard({ project, trackCount, onClick, onKanban, isFavorite, onToggleFavorite }: {
  project: Project; trackCount: number; onClick: () => void; onKanban: () => void;
  isFavorite: boolean; onToggleFavorite: () => void;
}) {
  const [h, setH] = useState(false);
  const t = typeMeta[project.type] || typeMeta.general;
  const Icon = t.icon;
  const sc = stHex[project.status] || '#64748b';
  const sl = stLabel[project.status] || project.status;
  const hasKanban = !!project.kanbanTaskId;
  // Auto project cards are purple, inner content is always yellow.
  const isAutoProjectCard = project.type === 'album' || project.type === 'ep' || project.type === 'single';
  const contentColor = isAutoProjectCard ? Y : (t.color === C ? Y : t.color);
  // Compute progress %: based on track count (capped at 100) + status boost
  const progress = useMemo(() => {
    const trackPct = Math.min(80, trackCount * 12); // each track ~12%, capped at 80
    const statusBoost = project.status === 'released' ? 100 : project.status === 'mastering' ? 90 : project.status === 'mixing' ? 70 : project.status === 'in_progress' ? 40 : 0;
    return Math.max(trackPct, statusBoost);
  }, [trackCount, project.status]);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      className="group relative cursor-pointer overflow-hidden"
      style={{
        clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
        background: project.type === 'album' ? '#161224' : project.type === 'ep' ? '#161224' : '#161224',
        borderTop: `2px solid ${h ? '#c7a008' : t.color}`,
        boxShadow: h
          ? `inset 0 1px 12px ${hexToRgba('#c7a008', 0.15)}, inset 0 0 0 1px ${hexToRgba('#c7a008', 0.5)}, 0 4px 12px rgba(0,0,0,0.4)`
          : `inset 0 1px 12px ${hexToRgba(t.color, 0.15)}, inset 0 0 0 1px ${hexToRgba(t.color, 0.3)}`,
        transition: 'all 280ms cubic-bezier(0.4,0,0.2,1)',
        transform: h ? 'translateY(-3px)' : 'translateY(0)',
      }}
    >
      {/* ── Inner beveled frame (recessed screen effect) ── */}
      <div
        className="absolute inset-[3px] pointer-events-none transition-opacity duration-300"
        style={{
          clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
          boxShadow: h
            ? `inset 0 0 0 1px ${hexToRgba(t.color, 0.35)}, inset 0 0 14px ${hexToRgba(t.color, 0.15)}`
            : `inset 0 0 0 1px ${hexToRgba(t.color, 0.15)}`,
          opacity: h ? 1 : 0.5,
        }}
      />

      {/* Top accent strip — color gradient */}
      <div
        className="h-[2px] w-full relative z-[2]"
        style={{
          background: `linear-gradient(90deg, transparent, ${t.color} 30%, ${t.color} 70%, transparent)`,
          boxShadow: `0 0 8px ${hexToRgba(t.color, 0.7)}`,
        }}
      />

      {/* Cover strip — with type icon (left) */}
      <div
        className="h-16 flex items-center justify-between px-4 relative z-[2] overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${hexToRgba(t.color, h ? 0.28 : 0.16)}, ${hexToRgba(t.color, h ? 0.06 : 0.03)})`,
          borderBottom: `1px solid ${hexToRgba(t.color, 0.12)}`,
        }}
      >
        <div className="flex items-center gap-2 relative z-[2]">
          <div
            className="flex h-8 w-8 items-center justify-center"
            style={{
              clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))',
              background: hexToRgba(contentColor, 0.2),
              border: `1px solid ${hexToRgba(contentColor, 0.5)}`,
              boxShadow: h ? `0 0 10px ${hexToRgba(contentColor, 0.5)}` : 'none',
            }}
          >
            <Icon className="w-4 h-4" style={{ color: contentColor, filter: `drop-shadow(0 0 2px ${contentColor})` }} />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: contentColor, textShadow: `0 0 4px ${hexToRgba(contentColor, 0.4)}` }}>{t.label}</span>
        </div>
        {/* Favorite star toggle — adds/removes from quick-access */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          aria-label={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
          title={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
          className="flex h-7 w-7 items-center justify-center transition-all duration-200 relative z-[3]"
          style={{
            clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))',
            background: isFavorite
              ? 'linear-gradient(135deg, #FCEE0A, #F1F100 50%, #FCEE0A)'
              : 'rgba(10,20,35,0.6)',
            border: isFavorite
              ? '1px solid rgba(252,238,10,0.9)'
              : '1px solid rgba(252,238,10,0.3)',
            boxShadow: isFavorite
              ? '0 0 10px rgba(252,238,10,0.5), inset 0 1px 0 rgba(255,255,255,0.4)'
              : 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            if (!isFavorite) {
              e.currentTarget.style.borderColor = 'rgba(252,238,10,0.7)';
              e.currentTarget.style.boxShadow = '0 0 8px rgba(252,238,10,0.3)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isFavorite) {
              e.currentTarget.style.borderColor = 'rgba(252,238,10,0.3)';
              e.currentTarget.style.boxShadow = 'none';
            }
          }}
        >
          <Star
            className="w-3.5 h-3.5 transition-transform"
            style={{
              color: isFavorite ? '#000' : 'rgba(252,238,10,0.7)',
              fill: isFavorite ? '#000' : 'none',
            }}
          />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 relative z-[2]">
        {/* Title */}
        <h3
          className="mb-2 text-[15px] font-bold leading-snug transition-colors"
          style={{
            color: h ? '#ffffff' : '#e8eaed',
            letterSpacing: '0.01em',
            textShadow: h ? `0 0 8px ${hexToRgba(t.color, 0.4)}` : 'none',
          }}
        >
          {project.title}
        </h3>

        {/* ── Waveform Progress Bar (animated audio waveform, playhead sweeps on hover) ── */}
        <div className="my-2.5">
          <WaveformProgressBar progress={progress} accentColor="#c7a008" height={48} bars={32} />
        </div>

        {/* Meta row — monospace 11px opacity 0.6 per spec */}
        <div className="flex items-center gap-3 text-[11px]" style={{
          color: h ? hexToRgba(contentColor, 0.85) : TEXT_SECONDARY,
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          opacity: 0.6,
        }}>
          <span className="flex items-center gap-1">
            <Music2 className="w-3 h-3" style={{ color: contentColor, opacity: h ? 1 : 0.65 }} />
            {trackCount} {plural(trackCount, ['трек', 'трека', 'треков'])}
          </span>
          <span className="flex items-center gap-1.5">
            {/* Status dot with matching colored glow */}
            <span className="w-1.5 h-1.5 rounded-full" style={{
              background: contentColor,
              boxShadow: `0 0 6px ${hexToRgba(contentColor, 0.6)}`,
            }} />
            {sl}
          </span>
        </div>

        {hasKanban && (
          <button
            onClick={(e) => { e.stopPropagation(); onKanban(); }}
            className="mt-3 flex items-center gap-1.5 text-[11px] font-bold uppercase transition-all hover:scale-105"
            style={{
              color: contentColor,
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              letterSpacing: '1px',
              clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))',
              padding: '4px 8px',
              background: h ? hexToRgba(contentColor, 0.1) : 'transparent',
              border: `0.5px solid ${h ? hexToRgba(contentColor, 0.4) : hexToRgba(contentColor, 0.2)}`,
            }}
          >
            <Key className="w-3 h-3" />
            Открыть Kanban
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Kanban Card — clean cyberpunk data slab with kanban waveform sign ─── */
function KanbanCard({ task, onClick, isFavorite, onToggleFavorite }: { task: Task; onClick: () => void; isFavorite: boolean; onToggleFavorite: () => void }) {
  const [h, setH] = useState(false);
  const isAuto = !!task.soundflowProjectId;
  // Yellow→Blue remap per spec: auto cards were yellow, now blue. Kanban cards stay cyan.
  const color = isAuto ? C : C;
  // Content color rule: Kanban cards are blue, inner content is always yellow.
  const contentColor = Y;
  const children = task.children || [];
  const done = children.filter(c => c.status === 'done').length;
  const pct = children.length > 0 ? Math.round((done / children.length) * 100) : 0;
  const TypeIcon = isAuto ? Music2 : FolderKanban;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      className="relative cursor-pointer overflow-hidden"
      style={{
        clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
        background: '#0e1a24',
        borderTop: `2px solid ${h ? '#c7a008' : color}`,
        boxShadow: h
          ? `inset 0 1px 12px ${hexToRgba('#c7a008', 0.15)}, inset 0 0 0 1px ${hexToRgba('#c7a008', 0.5)}, 0 4px 12px rgba(0,0,0,0.4)`
          : `inset 0 1px 12px ${hexToRgba(color, 0.15)}, inset 0 0 0 1px ${hexToRgba(color, 0.3)}`,
        transition: 'box-shadow 280ms ease, transform 280ms ease',
        transform: h ? 'translateY(-3px)' : 'translateY(0)',
      }}
    >
      {/* Inner beveled frame (static, recessed screen effect) */}
      <div
        className="absolute inset-[3px] pointer-events-none transition-opacity duration-300"
        style={{
          clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
          boxShadow: h
            ? `inset 0 0 0 1px ${hexToRgba(color, 0.3)}, inset 0 0 14px ${hexToRgba(color, 0.12)}`
            : `inset 0 0 0 1px ${hexToRgba(color, 0.12)}`,
          opacity: h ? 1 : 0.5,
        }}
      />

      {/* Top accent strip */}
      <div
        className="h-[2px] w-full relative z-[2]"
        style={{
          background: `linear-gradient(90deg, transparent, ${color} 30%, ${color} 70%, transparent)`,
          boxShadow: `0 0 8px ${hexToRgba(color, 0.7)}`,
        }}
      />

      <div className="p-4 relative z-[2]">
        {/* Header row: KANBAN badge + project type */}
        <div className="mb-3 flex items-center justify-between">
          <span
            className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-extrabold uppercase tracking-widest"
            style={{
              background: hexToRgba(contentColor, h ? 0.22 : 0.14),
              color: contentColor,
              border: `1.5px solid ${hexToRgba(contentColor, h ? 0.65 : 0.4)}`,
              clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
              boxShadow: h ? `0 0 10px ${hexToRgba(contentColor, 0.4)}` : 'none',
              transition: 'all 220ms ease',
            }}
          >
            {/* Static status dot */}
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: contentColor, boxShadow: `0 0 6px ${contentColor}` }}
            />
            {isAuto ? 'AUTO' : 'KANBAN'}
          </span>
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-mono uppercase tracking-wider transition-colors"
              style={{ color: h ? hexToRgba(contentColor, 0.8) : 'rgba(100,116,139,0.7)' }}
            >
              {task.projectType || 'general'}
            </span>
            {/* Favorite star toggle — adds/removes from quick-access */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
              aria-label={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
              title={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
              className="flex h-6 w-6 items-center justify-center transition-all duration-200"
              style={{
                clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))',
                background: isFavorite
                  ? 'linear-gradient(135deg, #FCEE0A, #F1F100 50%, #FCEE0A)'
                  : 'rgba(10,20,35,0.6)',
                border: isFavorite
                  ? '1px solid rgba(252,238,10,0.9)'
                  : '1px solid rgba(252,238,10,0.3)',
                boxShadow: isFavorite
                  ? '0 0 8px rgba(252,238,10,0.5), inset 0 1px 0 rgba(255,255,255,0.4)'
                  : 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!isFavorite) {
                  e.currentTarget.style.borderColor = 'rgba(252,238,10,0.7)';
                  e.currentTarget.style.boxShadow = '0 0 6px rgba(252,238,10,0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isFavorite) {
                  e.currentTarget.style.borderColor = 'rgba(252,238,10,0.3)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              <Star
                className="w-3 h-3"
                style={{
                  color: isFavorite ? '#000' : 'rgba(252,238,10,0.7)',
                  fill: isFavorite ? '#000' : 'none',
                }}
              />
            </button>
          </div>
        </div>

        {/* Type icon (static, no bobbing) */}
        <div
          className="mb-2.5 flex h-10 w-10 items-center justify-center"
          style={{
            clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))',
            background: h ? hexToRgba(contentColor, 0.28) : hexToRgba(contentColor, 0.14),
            border: `1.5px solid ${hexToRgba(contentColor, h ? 0.65 : 0.32)}`,
            boxShadow: h ? `0 0 16px ${hexToRgba(contentColor, 0.5)}` : 'none',
            transition: 'all 220ms ease',
          }}
        >
          <TypeIcon className="w-5 h-5" style={{ color: contentColor, filter: h ? `drop-shadow(0 0 4px ${contentColor})` : 'none' }} />
        </div>

        {/* Title */}
        <h3
          className="mb-3 text-sm font-bold leading-tight line-clamp-2"
          style={{
            minHeight: '2.5em',
            color: h ? '#ffffff' : '#cbd5e1',
            textShadow: h ? `0 0 8px ${hexToRgba(contentColor, 0.4)}` : 'none',
            transition: 'color 200ms ease, text-shadow 200ms ease',
            letterSpacing: '0.01em',
          }}
        >
          {task.title}
        </h3>

        {/* ── Waveform Progress Bar — distinctive kanban sign (animated audio waveform) ── */}
        <div className="my-2.5">
          <WaveformProgressBar progress={pct} accentColor="#c7a008" height={40} bars={28} />
        </div>

        {/* Bottom data row */}
        <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider">
          <span className="flex items-center gap-1" style={{ color: h ? hexToRgba(contentColor, 0.9) : 'rgba(100,116,139,0.9)' }}>
            <Layers className="w-3 h-3" style={{ color: contentColor, opacity: h ? 1 : 0.65 }} />
            {children.length} {plural(children.length, ['board', 'boards', 'boards'])}
          </span>
          <span className="flex items-center gap-1" style={{ color: h ? hexToRgba(pct === 100 ? G : contentColor, 0.9) : 'rgba(100,116,139,0.9)' }}>
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: pct === 100 ? G : contentColor,
                boxShadow: `0 0 5px ${pct === 100 ? G : contentColor}`,
              }}
            />
            {done}/{children.length} done
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Idea Card ─── */
function IdeaCard({ idea, onClick }: { idea: { id: string; title: string; description?: string; createdAt: string }; onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      className="w-60 shrink-0 cursor-pointer p-4"
      style={{
        borderRadius: '10px',
        background: h ? `linear-gradient(135deg, ${hexToRgba(A, 0.15)}, rgba(16,20,30,0.95))` : `linear-gradient(135deg, ${hexToRgba(A, 0.08)}, rgba(14,18,28,0.85))`,
        border: `1px solid ${h ? hexToRgba(A, 0.5) : hexToRgba(A, 0.22)}`,
        boxShadow: h ? `0 0 0 1px ${hexToRgba(A, 0.15)}, 0 6px 24px ${hexToRgba(A, 0.15)}, 0 4px 12px rgba(0,0,0,0.3)` : `0 0 0 1px ${hexToRgba(A, 0.05)}, 0 4px 10px rgba(0,0,0,0.2)`,
        transition: 'all 220ms cubic-bezier(0.4,0,0.2,1)',
        transform: h ? 'translateY(-3px) scale(1.01)' : 'none',
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <Lightbulb className="w-3.5 h-3.5" style={{ color: A, opacity: h ? 1 : 0.6 }} />
        <span className="text-[10px] font-medium text-slate-500">{fmtDate(idea.createdAt)}</span>
      </div>
      <h3 className="mb-1 text-sm font-medium text-slate-200 line-clamp-1">{idea.title}</h3>
      {idea.description && <p className="text-[11px] text-slate-500 line-clamp-2">{idea.description}</p>}
    </div>
  );
}

/* ─── Stat Bar: cyberpunk 2077 HUD stat cells ─── */
function StatBar({ stats }: { stats: { icon: typeof FolderKanban; value: number; label: string; color: string }[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {stats.map((s, i) => {
        const Icon = s.icon;
        return (
          <div key={s.label} className="flex items-center">
            {/* Tick divider between cells */}
            {i > 0 && (
              <div className="flex flex-col items-center mx-1 gap-0.5" style={{ opacity: 0.4 }}>
                <div style={{ width: '1px', height: '6px', background: '#00a8c6' }} />
                <div style={{ width: '3px', height: '3px', background: '#c7a008', borderRadius: '50%' }} />
                <div style={{ width: '1px', height: '6px', background: '#00a8c6' }} />
              </div>
            )}
            <div
              className="relative flex items-center gap-2 px-3 py-2 transition-all hover:bg-white/[0.04] group"
              style={{
                clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))',
                background: 'linear-gradient(135deg, #11141d 0%, #0c0e16 100%)',
                border: '1px solid rgba(0,168,198,0.4)',
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.06), inset 0 -1px 1px rgba(0,0,0,0.8)',
              }}
            >
              {/* Icon (no frame) */}
              <Icon className="w-5 h-5 shrink-0" style={{ color: '#c7a008', filter: 'drop-shadow(0 0 2px rgba(199,160,8,0.4))' }} />

              {/* Value + label */}
              <div className="flex flex-col leading-none">
                <span className="text-lg font-extrabold tabular-nums" style={{
                  color: '#e2e8f0',
                  fontFamily: 'var(--font-rajdhani), sans-serif',
                  fontWeight: 700,
                  textShadow: '0 0 4px rgba(0,168,198,0.15)',
                }}>{s.value}</span>
                <span className="text-[9px] font-bold uppercase mt-0.5" style={{
                  color: '#718096',
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  letterSpacing: '0.15em',
                }}>{s.label}</span>
              </div>

              {/* Yellow corner bracket (bottom-right) */}
              <div className="absolute bottom-0 right-0 w-2 h-2 pointer-events-none" style={{
                borderBottom: '1.5px solid rgba(199,160,8,0.6)',
                borderRight: '1.5px solid rgba(199,160,8,0.6)',
              }} />
              {/* Blue corner bracket (top-left) */}
              <div className="absolute top-0 left-0 w-2 h-2 pointer-events-none" style={{
                borderTop: '1.5px solid rgba(0,168,198,0.6)',
                borderLeft: '1.5px solid rgba(0,168,198,0.6)',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Section header — uppercase bold wide-tracked title ─── */
function SectionHeader({ title, action, accentColor }: { title: string; action?: React.ReactNode; accentColor?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {accentColor && (
          <div className="flex h-7 w-7 items-center justify-center" style={{
            clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
            background: hexToRgba(accentColor, 0.15),
            border: `1px solid ${hexToRgba(accentColor, 0.4)}`,
          }}>
            <Zap className="w-3.5 h-3.5" style={{ color: accentColor }} />
          </div>
        )}
        <h2 className="text-sm font-bold uppercase" style={{
          color: TEXT_PRIMARY,
          fontFamily: 'var(--font-rajdhani), sans-serif',
          fontWeight: 700,
          letterSpacing: '2px',
        }}>{title}</h2>
      </div>
      {action}
    </div>
  );
}

/* ─── Create Card — holographic terminal with rotating concentric rings ─── */
function CreateCard({ onClick, label }: { onClick: () => void; label: string }) {
  const [h, setH] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      className="group relative flex flex-col items-center justify-center overflow-hidden"
      style={{
        minHeight: '180px',
        clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
        background: '#12131a',
        borderTop: h ? '2px solid #00a8c6' : '2px solid #c7a008',
        boxShadow: h
          ? `inset 0 1px 12px rgba(0,168,198,0.3), inset 0 0 0 2px rgba(0,168,198,0.7), 0 0 8px rgba(0,168,198,0.3), 0 4px 12px rgba(0,0,0,0.4)`
          : `inset 0 1px 12px rgba(199,160,8,0.15), inset 0 0 0 1px rgba(199,160,8,0.3)`,
        transition: 'all 280ms cubic-bezier(0.4,0,0.2,1)',
        transform: h ? 'scale(1.04)' : 'scale(1)',
        cursor: 'pointer',
      }}
    >
      {/* Fine HUD grid overlay lines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: h ? 0.20 : 0.08,
          backgroundImage: `
            linear-gradient(rgba(199,160,8,0.10) 1px, transparent 1px),
            linear-gradient(90deg, rgba(199,160,8,0.10) 1px, transparent 1px)
          `,
          backgroundSize: '14px 14px',
        }}
      />

      {/* Faint corner technical text overlays (opacity 0.4, 9px monospace) */}
      <div className="absolute top-2 left-2.5 pointer-events-none" style={{
        fontFamily: 'var(--font-jetbrains-mono), monospace',
        fontSize: '9px',
        color: '#c7a008',
        opacity: 0.4,
        letterSpacing: '0.08em',
        lineHeight: '1.5',
      }}>
        <div>SECURITY ENCRYPTION ACTIVE</div>
        <div>PROJECTION: 60</div>
      </div>
      <div className="absolute bottom-2 right-2.5 pointer-events-none text-right" style={{
        fontFamily: 'var(--font-jetbrains-mono), monospace',
        fontSize: '9px',
        color: '#c7a008',
        opacity: 0.4,
        letterSpacing: '0.08em',
        lineHeight: '1.5',
      }}>
        <div>CODE: 1-00000.F0</div>
        <div>RING_SYS:ONLINE</div>
      </div>

      {/* ── Holographic terminal: central ring core with rotating concentric data rings ── */}
      <div className="relative flex items-center justify-center" style={{ width: '88px', height: '88px' }}>
        {/* Outer thin ring */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: '88px', height: '88px',
            border: '1px solid rgba(199,160,8,0.35)',
            boxShadow: '0 0 8px rgba(199,160,8,0.25)',
            opacity: h ? 1 : 0.55,
            transition: 'opacity 280ms',
          }}
        />
        {/* Middle dashed data ring — rotating clockwise */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: '68px', height: '68px',
            top: '50%', left: '50%',
            borderRadius: '50%',
            border: '1.5px dashed rgba(199,160,8,0.7)',
            background: 'transparent',
            animation: 'kb2-ring-spin-cw 8s linear infinite',
            boxShadow: '0 0 8px rgba(199,160,8,0.25)',
            opacity: h ? 1 : 0.65,
            transition: 'opacity 280ms',
          }}
        />
        {/* Inner solid gold ring — rotating counter-clockwise with data tick marks */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: '52px', height: '52px',
            top: '50%', left: '50%',
            borderRadius: '50%',
            background: `conic-gradient(from 0deg, transparent 0deg, transparent 15deg, rgba(199,160,8,0.6) 16deg, rgba(199,160,8,0.6) 18deg, transparent 19deg, transparent 45deg, rgba(199,160,8,0.6) 46deg, rgba(199,160,8,0.6) 48deg, transparent 49deg, transparent 90deg, rgba(199,160,8,0.6) 91deg, rgba(199,160,8,0.6) 93deg, transparent 94deg, transparent 135deg, rgba(199,160,8,0.6) 136deg, rgba(199,160,8,0.6) 138deg, transparent 139deg, transparent 180deg, rgba(199,160,8,0.6) 181deg, rgba(199,160,8,0.6) 183deg, transparent 184deg, transparent 225deg, rgba(199,160,8,0.6) 226deg, rgba(199,160,8,0.6) 228deg, transparent 229deg, transparent 270deg, rgba(199,160,8,0.6) 271deg, rgba(199,160,8,0.6) 273deg, transparent 274deg, transparent 315deg, rgba(199,160,8,0.6) 316deg, rgba(199,160,8,0.6) 318deg, transparent 319deg)`,
            mask: 'radial-gradient(circle, transparent 22px, #000 23px, #000 25px, transparent 26px)',
            WebkitMask: 'radial-gradient(circle, transparent 22px, #000 23px, #000 25px, transparent 26px)',
            animation: 'kb2-ring-spin-ccw 6s linear infinite',
            opacity: h ? 1 : 0.7,
            transition: 'opacity 280ms',
          }}
        />
        {/* Central solid gold core with Plus icon */}
        <div
          className="relative flex items-center justify-center rounded-full"
          style={{
            width: '40px', height: '40px',
            background: 'linear-gradient(135deg, #c7a008 0%, #9e7c06 50%, #c7a008 100%)',
            boxShadow: '0 0 8px rgba(199,160,8,0.25), inset 0 1px 0 rgba(255,255,255,0.25)',
            animation: 'kb2-core-pulse 2.4s ease-in-out infinite',
          }}
        >
          <Plus
            className="w-6 h-6"
            style={{
              color: '#0a0b10',
              filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.25))',
            }}
          />
        </div>
      </div>

      <span
        className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.18em]"
        style={{
          color: '#c7a008',
          textShadow: '0 0 8px rgba(199,160,8,0.25), 0 0 4px rgba(199,160,8,0.25)',
          animation: h ? 'kb2-holo-text 1.8s ease-in-out infinite' : 'none',
        }}
      >
        {label}
      </span>
    </button>
  );
}

/* ─── Quick Access Card — dark data slab with waveform + clickable priority scale ─── */
function QuickAccessCard({ item, onClick, onMoveTo, priority, total }: {
  item: ModalItem; onClick: () => void;
  onMoveTo: (targetIdx: number) => void; priority: number; total: number;
}) {
  const [h, setH] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [pendingPriority, setPendingPriority] = useState(priority);
  const t = typeMeta[item.type] || typeMeta.general;
  const sc = stHex[item.status] || '#64748b';
  const sl = stLabel[item.status] || item.status;
  // Content color rule: Quick Access cards are cyan, inner content is always yellow.
  const contentColor = Y;
  // Priority scale: always 7 segments (max 7 cards), filled = priority level
  const SCALE_SEGS = 7;
  const filledSegs = priority; // priority is 1-based, segments 0..priority-1 are filled

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      className="group relative w-60 shrink-0 cursor-pointer overflow-hidden"
      style={{
        clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
        background: h
          ? `linear-gradient(135deg, ${hexToRgba(C, 0.22)}, rgba(10,14,22,0.96))`
          : `linear-gradient(135deg, ${hexToRgba(C, 0.10)}, rgba(10,14,22,0.88))`,
        boxShadow: h
          ? `inset 0 0 0 1px ${hexToRgba(C, 0.5)}, inset 0 0 0 3px ${hexToRgba('#c7a008', 0.8)}, 0 0 8px ${hexToRgba('#c7a008', 0.25)}, 0 4px 16px rgba(0,0,0,0.5)`
          : `inset 0 0 0 1px ${hexToRgba(C, 0.3)}, inset 0 0 0 2.5px ${hexToRgba('#c7a008', 0.55)}, 0 0 4px ${hexToRgba('#c7a008', 0.1)}, 0 2px 10px rgba(0,0,0,0.4)`,
        transition: 'all 280ms cubic-bezier(0.4,0,0.2,1)',
        transform: h ? 'translateY(-3px)' : 'none',
      }}
    >
      {/* Beveled edge glow — top accent strip (cyan) */}
      <div
        className="h-[2px] w-full"
        style={{
          background: `linear-gradient(90deg, transparent, ${C} 30%, ${C} 70%, transparent)`,
          boxShadow: `0 0 8px ${hexToRgba(C, 0.7)}`,
        }}
      />

      {/* Body */}
      <div className="p-3 pt-3.5 relative">
        {/* Type icon + label (left) | Priority scale (right) */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div
              className="flex h-6 w-6 items-center justify-center"
              style={{
                clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))',
                background: hexToRgba(contentColor, 0.18),
                border: `1px solid ${hexToRgba(contentColor, 0.5)}`,
                boxShadow: h ? `0 0 8px ${hexToRgba(contentColor, 0.5)}` : 'none',
              }}
            >
              <Zap className="w-3 h-3" style={{ color: contentColor, filter: `drop-shadow(0 0 2px ${contentColor})` }} />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: contentColor, textShadow: `0 0 4px ${hexToRgba(contentColor, 0.4)}` }}>{t.label}</span>
          </div>
          {/* ── Priority scale (top-right) — click opens popup for convenient selection ── */}
            <Popover open={priorityOpen} onOpenChange={(open) => { setPriorityOpen(open); if (open) setPendingPriority(priority); }}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); }}
                  className="flex gap-[2px] items-center transition-all hover:scale-105"
                  title="Нажмите, чтобы изменить приоритет"
                  aria-label="Изменить приоритет"
                  style={{ cursor: 'pointer', background: 'transparent', border: 'none', padding: 0 }}
                >
                  {Array.from({ length: SCALE_SEGS }).map((_, i) => {
                    const filled = i < filledSegs;
                    return (
                      <div
                        key={i}
                        style={{
                          width: '3px',
                          height: '14px',
                          background: filled ? contentColor : hexToRgba(contentColor, 0.18),
                          boxShadow: filled ? `0 0 4px ${hexToRgba(contentColor, 0.7)}` : 'none',
                          borderRadius: '0.5px',
                          transition: `transform 220ms cubic-bezier(0.34,1.56,0.64,1) ${i * 25}ms, background 180ms`,
                          transform: h && filled ? 'scaleY(1.15)' : 'scaleY(1)',
                        }}
                      />
                    );
                  })}
                </button>
              </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={6}
              className="p-3 w-56 rounded-none border-0 bg-transparent"
              style={{
                background: '#161a24',
                border: '1px solid #00a8c6',
                clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
                boxShadow: '0 0 8px rgba(0,168,198,0.25)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase" style={{ color: '#00a8c6', fontFamily: 'var(--font-jetbrains-mono), monospace', letterSpacing: '1px' }}>
                  Приоритет
                </span>
                <span className="text-[12px] font-extrabold tabular-nums" style={{ color: '#00a8c6', fontFamily: 'var(--font-rajdhani), sans-serif' }}>
                  {pendingPriority}/{SCALE_SEGS}
                </span>
              </div>
              {/* Interactive scale — click segments to preview value */}
              <div className="flex gap-[3px] mb-3 justify-center items-end" style={{ height: '32px' }}>
                {Array.from({ length: SCALE_SEGS }).map((_, i) => {
                  const filled = i < pendingPriority;
                  const isActive = i + 1 === pendingPriority;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setPendingPriority(i + 1); }}
                      className="transition-all hover:scale-y-110"
                      style={{
                        flex: 1,
                        height: `${30 + (i % 3) * 8}%`,
                        background: filled ? '#00a8c6' : hexToRgba('#00a8c6', 0.15),
                        boxShadow: isActive ? '0 0 6px rgba(0,168,198,0.8)' : filled ? '0 0 3px rgba(0,168,198,0.5)' : 'none',
                        borderRadius: '1px',
                        cursor: 'pointer',
                        border: 'none',
                      }}
                      title={`Приоритет ${i + 1}`}
                    />
                  );
                })}
              </div>
              {/* Confirm / Cancel */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onMoveTo(pendingPriority - 1); setPriorityOpen(false); }}
                  className="flex-1 py-1.5 text-[10px] font-bold uppercase transition-all hover:scale-[1.02]"
                  style={{
                    background: '#00a8c6',
                    color: '#0a0c10',
                    clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    letterSpacing: '1px',
                  }}
                >
                  Применить
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setPriorityOpen(false); }}
                  className="px-3 py-1.5 text-[10px] font-bold uppercase transition-all"
                  style={{
                    background: 'transparent',
                    color: '#718096',
                    border: '1px solid #232a3b',
                    clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    letterSpacing: '1px',
                  }}
                >
                  Отмена
                </button>
              </div>
            </PopoverContent>
            </Popover>
        </div>

        {/* Title */}
        <p className="text-sm font-bold line-clamp-1" style={{
          color: h ? '#ffffff' : '#cbd5e1',
          letterSpacing: '0.02em',
          fontFamily: 'monospace',
          textShadow: h ? `0 0 8px ${hexToRgba(contentColor, 0.4)}` : 'none',
        }}>
          {item.title}
        </p>

        {/* Meta */}
        <div className="mt-1.5 flex items-center gap-2 text-[10px]" style={{ color: h ? hexToRgba(contentColor, 0.85) : '#64748b', fontFamily: 'monospace' }}>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: contentColor, boxShadow: `0 0 4px ${hexToRgba(contentColor, 0.5)}` }} />
            {sl}
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Music2 className="w-3 h-3" style={{ color: contentColor }} />
            {item.trackCount}
          </span>
        </div>

        {/* ── Waveform Progress Bar (animated audio waveform, progress = priority-based) ── */}
        <div className="mt-2.5">
          <WaveformProgressBar progress={priority * 14} accentColor="#c7a008" height={32} bars={24} />
        </div>
      </div>
    </div>
  );
}

/* ─── Carousel with arrow buttons ─── */
function Carousel({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, [updateArrows]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7;
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <div className="relative group/carousel" style={{ padding: '0 44px' }}>
      {/* Left arrow — yellow accent button style */}
      <button
        onClick={() => scroll('left')}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center transition-all duration-200"
        style={{
          clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))',
          background: 'linear-gradient(135deg, #FCEE0A, #F1F100 50%, #FCEE0A)',
          border: '1.5px solid rgba(252,238,10,0.9)',
          boxShadow: '0 0 12px rgba(252,238,10,0.4), inset 0 1px 0 rgba(255,255,255,0.4)',
          color: '#000',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 16px rgba(252,238,10,0.6), 0 0 24px rgba(252,238,10,0.2), inset 0 1px 0 rgba(255,255,255,0.5)'; e.currentTarget.style.transform = 'translateY(-50%) translateX(-1px)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 12px rgba(252,238,10,0.4), inset 0 1px 0 rgba(255,255,255,0.4)'; e.currentTarget.style.transform = 'translateY(-50%)'; }}
        aria-label="Прокрутить влево"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Scrollable container — hidden scrollbar */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto py-1"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {children}
      </div>

      {/* Right arrow — yellow accent button style */}
      <button
        onClick={() => scroll('right')}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center transition-all duration-200"
        style={{
          clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))',
          background: 'linear-gradient(135deg, #FCEE0A, #F1F100 50%, #FCEE0A)',
          border: '1.5px solid rgba(252,238,10,0.9)',
          boxShadow: '0 0 12px rgba(252,238,10,0.4), inset 0 1px 0 rgba(255,255,255,0.4)',
          color: '#000',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 16px rgba(252,238,10,0.6), 0 0 24px rgba(252,238,10,0.2), inset 0 1px 0 rgba(255,255,255,0.5)'; e.currentTarget.style.transform = 'translateY(-50%) translateX(1px)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 12px rgba(252,238,10,0.4), inset 0 1px 0 rgba(255,255,255,0.4)'; e.currentTarget.style.transform = 'translateY(-50%)'; }}
        aria-label="Прокрутить вправо"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Hidden scrollbar CSS */}
      <style>{`
        .group\\/carousel > div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

/* ─── Manage Quick Access Modal — add/remove projects ─── */
function ManageQuickAccessModal({
  open, onClose, quickAccess, toggleQuickAccess, autoItems, kanbanItems, warning,
}: {
  open: boolean;
  onClose: () => void;
  quickAccess: string[];
  toggleQuickAccess: (id: string, title?: string) => void;
  autoItems: ModalItem[];
  kanbanItems: ModalItem[];
  warning: string | null;
}) {
  const all = [...autoItems, ...kanbanItems];
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 10 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            className="relative w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
            style={{
              clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
              background: 'linear-gradient(180deg, rgba(0,168,198,0.10), rgba(8,10,18,0.98))',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Border + top bar */}
            <div className="absolute inset-0 pointer-events-none" style={{
              padding: '1.5px',
              background: 'linear-gradient(90deg, rgba(0,168,198,0.7) 0%, rgba(0,168,198,0.15) 50%, rgba(0,168,198,0.7) 100%)',
              WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
            }} />
            <div className="absolute left-0 right-0 top-0 h-[3px]" style={{
              background: 'linear-gradient(90deg, transparent, #00a8c6 20%, #00a8c6 80%, transparent)',
              boxShadow: '0 0 8px rgba(0,168,198,0.25)',
            }} />

            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-cyan-500/15">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center" style={{
                  clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
                  background: 'rgba(0,168,198,0.18)',
                  border: '1px solid rgba(0,168,198,0.5)',
                }}>
                  <Pencil className="w-4 h-4" style={{ color: '#00a8c6' }} />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-[0.18em]" style={{ color: '#00a8c6', textShadow: '0 0 8px rgba(0,168,198,0.25)' }}>
                    Управление быстрым доступом
                  </h2>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {quickAccess.length}/{MAX_QUICK_ACCESS} · выберите проекты для закрепления
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-cyan-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Warning */}
            {warning && (
              <div className="mx-5 mt-3 px-3 py-2 flex items-center gap-2 text-[11px]" style={{
                background: 'rgba(199,160,8,0.1)',
                border: '1px solid rgba(199,160,8,0.4)',
                color: '#c7a008',
                clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))',
              }}>
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{warning}</span>
              </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto p-5" style={{ scrollbarWidth: 'thin' }}>
              {all.length === 0 ? (
                <p className="text-center text-sm text-slate-600 py-8">Нет доступных проектов</p>
              ) : (
                <div className="space-y-1.5">
                  {all.map(item => {
                    const inQuick = quickAccess.includes(item.id);
                    const t = typeMeta[item.type] || typeMeta.general;
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggleQuickAccess(item.id, item.title)}
                        className="w-full flex items-center gap-3 p-2.5 transition-all hover:scale-[1.01] text-left"
                        style={{
                          clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))',
                          background: inQuick ? hexToRgba(t.color, 0.12) : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${inQuick ? hexToRgba(t.color, 0.5) : 'rgba(255,255,255,0.05)'}`,
                          boxShadow: inQuick ? `inset 2px 0 0 ${t.color}` : 'none',
                        }}
                      >
                        <div className="flex h-7 w-7 items-center justify-center shrink-0" style={{
                          clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))',
                          background: hexToRgba(t.color, 0.18),
                          border: `1px solid ${hexToRgba(t.color, 0.4)}`,
                        }}>
                          <t.icon className="w-3.5 h-3.5" style={{ color: t.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: inQuick ? '#fff' : '#cbd5e1' }}>{item.title}</p>
                          <p className="text-[10px] text-slate-500">{t.label} · {item.trackCount} треков</p>
                        </div>
                        <div
                          className="flex h-6 w-6 items-center justify-center shrink-0 transition-all"
                          style={{
                            clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))',
                            background: inQuick ? t.color : 'transparent',
                            border: `1px solid ${inQuick ? t.color : hexToRgba(t.color, 0.4)}`,
                            boxShadow: inQuick ? `0 0 8px ${hexToRgba(t.color, 0.6)}` : 'none',
                          }}
                        >
                          {inQuick ? <Check className="w-3 h-3" style={{ color: '#000' }} /> : <Plus className="w-3 h-3" style={{ color: t.color }} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-cyan-500/15 flex items-center justify-between">
              <span className="text-[10px] text-slate-600 uppercase tracking-wider">
                Максимум {MAX_QUICK_ACCESS} проектов
              </span>
              <button
                onClick={onClose}
                className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all hover:scale-105"
                style={{
                  clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
                  background: 'linear-gradient(135deg, #00a8c6, #00b4d4)',
                  color: '#001824',
                  boxShadow: '0 0 8px rgba(0,168,198,0.25)',
                }}
              >
                Готово
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ═══ MAIN ═══ */
export function HomeView() {
  const user = useAuthStore(s => s.user);
  const currentGroupId = useAuthStore(s => s.currentGroupId);
  const currentGroup = useDataStore(s => s.currentGroup);
  const projects = useDataStore(s => s.projects);
  const ideas = useDataStore(s => s.ideas);
  const tracks = useDataStore(s => s.tracks);
  const navigate = useNavigationStore(s => s.navigate);

  const [memberCount, setMemberCount] = useState(0);
  const [kanbanProjects, setKanbanProjects] = useState<Task[]>([]);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [quickAccess, setQuickAccess] = useState<string[]>([]);
  const [manageQuickOpen, setManageQuickOpen] = useState(false);
  const [quickWarning, setQuickWarning] = useState<string | null>(null);

  const autoProjects = useMemo(() => projects.filter(p => p.kanbanTaskId), [projects]);
  const recentIdeas = useMemo(() =>
    [...ideas].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8),
  [ideas]);

  const getTrackCount = (pid: string) => tracks.filter(t => t.projectId === pid).length;

  useEffect(() => {
    if (!currentGroupId) return;
    fetch(`/api/groups/${currentGroupId}/members`).then(r => r.json()).then(m => setMemberCount(Array.isArray(m) ? m.length : 0)).catch(() => {});
  }, [currentGroupId]);

  useEffect(() => {
    fetch('/api/tasks?parentId=null').then(r => r.json()).then(data => {
      const tasks: Task[] = Array.isArray(data) ? data : data.tasks || [];
      setKanbanProjects(tasks);
      useKanbanStore.getState().setProjects(tasks);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('soundflow-quick-access');
      if (raw) setQuickAccess(JSON.parse(raw) as string[]);
    } catch { /* ignore */ }
  }, []);

  const goToKanban = (id: string) => {
    // Select the project FIRST so KanbanPage doesn't redirect to Projects.
    if (id) {
      useKanbanStore.getState().selectProject(id);
      navigate('kanban');
    }
  };

  const toggleQuickAccess = (id: string, title?: string) => {
    setQuickAccess(prev => {
      if (prev.includes(id)) {
        // removing — always allowed
        const next = prev.filter(x => x !== id);
        try { localStorage.setItem('soundflow-quick-access', JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      }
      // adding — enforce max 7
      if (prev.length >= MAX_QUICK_ACCESS) {
        setQuickWarning(`Достигнут максимум ${MAX_QUICK_ACCESS} проектов в быстром доступе. Удалите один, чтобы добавить «${title || 'проект'}».`);
        setTimeout(() => setQuickWarning(null), 5000);
        return prev;
      }
      const next = [...prev, id];
      try { localStorage.setItem('soundflow-quick-access', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const moveQuickAccess = (id: string, dir: 'up' | 'down') => {
    setQuickAccess(prev => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const target = dir === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      try { localStorage.setItem('soundflow-quick-access', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const moveQuickAccessTo = (id: string, targetIdx: number) => {
    setQuickAccess(prev => {
      const from = prev.indexOf(id);
      if (from < 0 || from === targetIdx) return prev;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(targetIdx, 0, moved);
      try { localStorage.setItem('soundflow-quick-access', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const autoModalItems: ModalItem[] = useMemo(() => autoProjects.map(p => ({
    id: p.id, title: p.title, type: p.type, status: p.status, date: p.createdAt,
    trackCount: getTrackCount(p.id),
    onOpen: () => { setAllAutoOpen(false); navigate('project-detail', p.id); },
  })), [autoProjects, tracks]);

  const kanbanModalItems: ModalItem[] = useMemo(() => kanbanProjects.map(t => ({
    id: t.id, title: t.title, type: t.projectType || 'general', status: t.status, date: t.createdAt,
    trackCount: (t.children || []).length,
    onOpen: () => { setAllKanbanOpen(false); goToKanban(t.id); },
  })), [kanbanProjects]);

  const quickAccessItems: ModalItem[] = useMemo(() => {
    const all = [...autoModalItems, ...kanbanModalItems];
    return quickAccess
      .map(id => all.find(it => it.id === id))
      .filter((x): x is ModalItem => !!x);
  }, [autoModalItems, kanbanModalItems, quickAccess]);

  const stats = [
    { icon: FolderKanban, value: projects.length, label: 'Проекты', color: Y },
    { icon: Music2, value: tracks.length, label: 'Треки', color: C },
    { icon: Lightbulb, value: ideas.length, label: 'Идеи', color: A },
    { icon: Users, value: memberCount, label: 'Участники', color: G },
  ];

  return (
    <div className="min-h-full relative" style={{ background: BG_MAIN }}>
      {/* ── Global background: glassmorphism HUD grid + ambient depth glows ── */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          zIndex: 0,
          backgroundColor: BG_MAIN,
          backgroundImage: `
            radial-gradient(ellipse 80% 50% at 50% 0%, rgba(123,44,191,0.08) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 90% 100%, rgba(0,168,198,0.06) 0%, transparent 55%),
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 100% 100%, 20px 20px, 20px 20px',
        }}
      />

      <div className="relative mx-auto max-w-6xl px-5 py-6 lg:px-8 lg:py-8" style={{ zIndex: 1 }}>
        {/* ── Header + Stats in one row ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 className="text-xl font-bold lg:text-2xl" style={{
              color: TEXT_PRIMARY,
              fontFamily: 'var(--font-rajdhani), sans-serif',
              fontWeight: 700,
              letterSpacing: '0.04em',
            }}>
              Привет, {user?.displayName || 'музыкант'}
            </h1>
            <p className="mt-0.5 text-sm" style={{
              color: TEXT_SECONDARY,
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              letterSpacing: '0.08em',
            }}>
              {currentGroup?.name || 'SoundFlow'}{currentGroup?.genre ? ` · ${currentGroup.genre}` : ''}
            </p>
          </div>
          <StatBar stats={stats} />
        </motion.div>


        {/* ── Quick Access — stat-panel style border ── */}
        {quickAccessItems.length > 0 && (
          <section className="mt-8 relative overflow-hidden" style={{
            clipPath: 'polygon(0 5px, 5px 0, calc(100% - 5px) 0, 100% 5px, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 calc(100% - 5px), 0 5px)',
            background: 'linear-gradient(135deg, #11141d 0%, #0c0e16 100%)',
            border: '1px solid rgba(0,168,198,0.4)',
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.06), inset 0 -1px 1px rgba(0,0,0,0.8)',
            padding: '22px',
          }}>
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

            <div className="mb-4 flex items-center justify-between relative" style={{ zIndex: 2 }}>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center" style={{
                  clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
                  background: 'rgba(199,160,8,0.18)',
                  border: '1px solid rgba(199,160,8,0.55)',
                  boxShadow: '0 0 8px rgba(199,160,8,0.25)',
                }}>
                  <Zap className="w-3.5 h-3.5" style={{ color: '#c7a008', filter: 'drop-shadow(0 0 3px rgba(199,160,8,0.25))' }} />
                </div>
                <h2 className="text-sm font-bold uppercase" style={{
                  color: '#ffffff',
                  fontFamily: 'var(--font-rajdhani), sans-serif',
                  fontWeight: 700,
                  letterSpacing: '2px',
                }}>
                  Избранное
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase px-2 py-1" style={{
                  color: '#c7a008',
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
                  background: 'rgba(199,160,8,0.08)',
                  border: '1px solid rgba(199,160,8,0.3)',
                  opacity: 0.85,
                }}>
                  {quickAccessItems.length}/{MAX_QUICK_ACCESS} активных
                </span>
                <button
                  onClick={() => setManageQuickOpen(true)}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 transition-all hover:scale-105"
                  style={{
                    color: '#c7a008',
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
                    background: 'rgba(199,160,8,0.08)',
                    border: '1px solid rgba(199,160,8,0.3)',
                  }}
                  title="Управлять избранным"
                >
                  <Pencil className="w-2.5 h-2.5" /> Изменить
                </button>
              </div>
            </div>

            <div className="relative" style={{ zIndex: 2 }}>
              <Carousel>
                {quickAccessItems.map((item, idx) => (
                  <QuickAccessCard
                    key={item.id}
                    item={item}
                    onClick={item.onOpen}
                    onMoveTo={(targetIdx) => moveQuickAccessTo(item.id, targetIdx)}
                    priority={idx + 1}
                    total={quickAccessItems.length}
                  />
                ))}
              </Carousel>
            </div>
          </section>
        )}

        {/* ── Auto Projects — stat-panel style border ── */}
        <section className="mt-8 relative overflow-hidden" style={{
          clipPath: 'polygon(0 5px, 5px 0, calc(100% - 5px) 0, 100% 5px, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 calc(100% - 5px), 0 5px)',
          background: 'linear-gradient(135deg, #11141d 0%, #0c0e16 100%)',
          border: '1px solid rgba(199,160,8,0.4)',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.06), inset 0 -1px 1px rgba(0,0,0,0.8)',
          padding: '22px',
        }}>
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

          <div className="relative" style={{ zIndex: 2 }}>
            <SectionHeader
              title="Авто проекты"
              accentColor={Y}
              action={
                <button onClick={() => navigate('projects')} className="flex items-center gap-1 text-[11px] font-bold uppercase transition-all hover:scale-105" style={{
                  color: 'rgba(199,160,8,0.85)',
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  letterSpacing: '1px',
                }}>
                  Все <ArrowRight className="w-3 h-3" />
                </button>
              }
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <CreateCard onClick={() => setCreateProjectOpen(true)} label="Создать" />
              {autoProjects.slice(0, 3).map(p => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  trackCount={getTrackCount(p.id)}
                  onClick={() => navigate('project-detail', p.id)}
                  onKanban={() => p.kanbanTaskId && goToKanban(p.kanbanTaskId)}
                  isFavorite={quickAccess.includes(p.kanbanTaskId || p.id)}
                  onToggleFavorite={() => toggleQuickAccess(p.kanbanTaskId || p.id, p.title)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ── Kanban Projects — stat-panel style border ── */}
        <section className="mt-6 relative overflow-hidden" style={{
          clipPath: 'polygon(0 5px, 5px 0, calc(100% - 5px) 0, 100% 5px, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 calc(100% - 5px), 0 5px)',
          background: 'linear-gradient(135deg, #11141d 0%, #0c0e16 100%)',
          border: '1px solid rgba(0,168,198,0.4)',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.06), inset 0 -1px 1px rgba(0,0,0,0.8)',
          padding: '22px',
        }}>
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

          <SectionHeader
            title="Канбан проекты"
            accentColor={C}
            action={
              <button onClick={() => navigate('projects')} className="flex items-center gap-1 text-[11px] font-bold uppercase transition-all hover:scale-105" style={{
                color: '#00a8c6',
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                letterSpacing: '1px',
              }}>
                Все <ArrowRight className="w-3 h-3" />
              </button>
            }
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CreateCard onClick={() => navigate('projects')} label="Создать" />
            {kanbanProjects.slice(0, 3).map(task => (
              <KanbanCard
                key={task.id}
                task={task}
                onClick={() => goToKanban(task.id)}
                isFavorite={quickAccess.includes(task.id)}
                onToggleFavorite={() => toggleQuickAccess(task.id, task.title)}
              />
            ))}
          </div>
        </section>

        {/* ── Ideas ── */}
        <section className="mt-8">
          <SectionHeader
            title="Лента идей"
            action={
              <button onClick={() => navigate('ideas')} className="flex items-center gap-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-amber-400">
                Все <ArrowRight className="w-3 h-3" />
              </button>
            }
          />
          {recentIdeas.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-slate-800 py-10 text-center">
              <p className="text-sm text-slate-600">Идей пока нет</p>
              <button onClick={() => navigate('ideas')} className="mt-1 text-sm font-medium text-amber-400 hover:underline">добавить →</button>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
              {recentIdeas.map(idea => (
                <IdeaCard key={idea.id} idea={idea} onClick={() => navigate('ideas')} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Modals & Dialogs */}
      <CreateProjectDialog open={createProjectOpen} onOpenChange={setCreateProjectOpen} />
      <ManageQuickAccessModal
        open={manageQuickOpen}
        onClose={() => setManageQuickOpen(false)}
        quickAccess={quickAccess}
        toggleQuickAccess={toggleQuickAccess}
        autoItems={autoModalItems}
        kanbanItems={kanbanModalItems}
        warning={quickWarning}
      />
    </div>
  );
}
