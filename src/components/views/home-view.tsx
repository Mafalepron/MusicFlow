'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderKanban, Music2, Lightbulb, Users, ArrowRight, Plus,
  ChevronDown, ChevronRight, ChevronLeft, Disc3, AudioLines, Zap, Clock, Star, X,
  ArrowUp, ArrowDown, Flame, Layers, Key,
} from 'lucide-react';
import { useAuthStore, useDataStore, useNavigationStore, type Project } from '@/lib/store';
import { useKanbanStore, type Task } from '@/store/kanban-store';
import { hexToRgba } from '@/lib/utils';
import { CreateProjectDialog } from '@/components/shared/create-project-dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

/* ─── palette ─── */
const Y = '#FFC42E'; // golden sun (was #FFC42E harsh yellow)
const C = '#00d9ff'; // cyan
const A = '#f59e0b'; // amber
const G = '#10b981'; // green

const typeMeta: Record<string, { label: string; color: string; icon: typeof Disc3 }> = {
  album:   { label: 'Альбом',  color: '#a855f7', icon: Disc3 },
  ep:      { label: 'EP',      color: C,         icon: AudioLines },
  single:  { label: 'Сингл',   color: A,         icon: Music2 },
  general: { label: 'Канбан',  color: G,         icon: FolderKanban },
};

const stHex: Record<string, string> = {
  draft: A, in_progress: C, mixing: '#ff6b35', mastering: G, released: Y,
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
type SortMode = 'date' | 'name' | 'type';
interface ModalItem {
  id: string;
  title: string;
  type: string;
  status: string;
  date: string;
  trackCount: number;
  onOpen: () => void;
}

/* ─── Project Card — dark data slab with realistic static waveform ─── */
function ProjectCard({ project, trackCount, onClick, onKanban }: {
  project: Project; trackCount: number; onClick: () => void; onKanban: () => void;
}) {
  const [h, setH] = useState(false);
  const t = typeMeta[project.type] || typeMeta.general;
  const Icon = t.icon;
  const sc = stHex[project.status] || '#64748b';
  const sl = stLabel[project.status] || project.status;
  const hasKanban = !!project.kanbanTaskId;
  // Realistic waveform: deterministic pseudo-random heights from project.id
  // Using a smooth sinusoidal envelope so it looks like a real audio track
  const waveBars = useMemo(() => {
    const seed = project.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return Array.from({ length: 32 }, (_, i) => {
      // Combine base sinusoid + harmonics + deterministic noise → realistic waveform shape
      const base = 0.45 + 0.35 * Math.sin((i / 32) * Math.PI * 4 + (seed % 7));
      const harm = 0.15 * Math.sin((i / 32) * Math.PI * 11 + (seed % 13));
      const noise = ((seed * (i + 3) * 7) % 23) / 100 - 0.1;
      return Math.max(0.12, Math.min(0.95, base + harm + noise));
    });
  }, [project.id]);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      className="group relative cursor-pointer overflow-hidden"
      style={{
        clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
        background: h
          ? `linear-gradient(135deg, ${hexToRgba(t.color, 0.24)}, rgba(12,16,28,0.96))`
          : `linear-gradient(135deg, ${hexToRgba(t.color, 0.12)}, rgba(10,14,22,0.92))`,
        boxShadow: h
          ? `inset 0 0 0 1.5px ${hexToRgba(t.color, 0.75)}, 0 0 28px ${hexToRgba(t.color, 0.28)}, 0 8px 24px rgba(0,0,0,0.5), inset 0 0 22px ${hexToRgba(t.color, 0.1)}`
          : `inset 0 0 0 1px ${hexToRgba(t.color, 0.35)}, inset 0 0 0 4px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.4)`,
        transition: 'all 280ms cubic-bezier(0.4,0,0.2,1)',
        transform: h ? 'translateY(-4px) scale(1.01)' : 'translateY(0)',
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
              background: hexToRgba(t.color, 0.2),
              border: `1px solid ${hexToRgba(t.color, 0.5)}`,
              boxShadow: h ? `0 0 10px ${hexToRgba(t.color, 0.5)}` : 'none',
            }}
          >
            <Icon className="w-4 h-4" style={{ color: t.color, filter: `drop-shadow(0 0 2px ${t.color})` }} />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: t.color, textShadow: `0 0 4px ${hexToRgba(t.color, 0.4)}` }}>{t.label}</span>
        </div>
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

        {/* ── Realistic audio waveform (static, playhead sweeps on hover) ── */}
        <div className="relative h-12 my-2.5 overflow-hidden" style={{
          background: 'rgba(0,0,0,0.35)',
          borderRadius: '2px',
          border: `0.5px solid ${hexToRgba(t.color, 0.2)}`,
        }}>
          {/* Center axis line */}
          <div className="absolute left-0 right-0 top-1/2 h-px" style={{ background: hexToRgba(t.color, 0.15) }} />
          {/* Waveform bars — static heights, gentle lift on hover */}
          <div className="absolute inset-0 flex items-center justify-between px-1">
            {waveBars.map((v, i) => (
              <div
                key={i}
                className="relative"
                style={{
                  width: '2px',
                  height: `${Math.round(v * 100)}%`,
                  background: t.color,
                  opacity: h ? 0.95 : 0.55,
                  boxShadow: h ? `0 0 2px ${hexToRgba(t.color, 0.6)}` : 'none',
                  transformOrigin: 'center',
                  animation: h ? `kb4-bar-lift ${1.6 + (i % 6) * 0.18}s ease-in-out ${(i * 0.06).toFixed(2)}s infinite` : 'none',
                  transition: 'opacity 200ms',
                  borderRadius: '0.5px',
                }}
              />
            ))}
          </div>
          {/* Playhead sweep — moves left→right→left on hover */}
          {h && (
            <div
              className="absolute inset-y-0 pointer-events-none"
              style={{
                width: '36px',
                background: `linear-gradient(90deg, transparent, ${hexToRgba(t.color, 0.25)} 40%, ${hexToRgba('#ffffff', 0.35)} 50%, ${hexToRgba(t.color, 0.25)} 60%, transparent)`,
                animation: 'kb4-play-sweep 2.4s ease-in-out infinite',
                boxShadow: `0 0 8px ${hexToRgba(t.color, 0.5)}`,
              }}
            >
              {/* Playhead line */}
              <div className="absolute inset-y-0 left-1/2 w-px" style={{ background: '#ffffff', boxShadow: `0 0 6px ${t.color}` }} />
            </div>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-[11px]" style={{ color: h ? hexToRgba(t.color, 0.85) : '#7c8aa5', fontFamily: 'monospace' }}>
          <span className="flex items-center gap-1">
            <Music2 className="w-3 h-3" style={{ color: t.color, opacity: h ? 1 : 0.65 }} />
            {trackCount} {plural(trackCount, ['трек', 'трека', 'треков'])}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc, boxShadow: `0 0 5px ${hexToRgba(sc, 0.6)}` }} />
            {sl}
          </span>
        </div>

        {hasKanban && (
          <button
            onClick={(e) => { e.stopPropagation(); onKanban(); }}
            className="mt-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-all hover:scale-105"
            style={{
              color: h ? C : hexToRgba(C, 0.7),
              textShadow: h ? `0 0 6px ${hexToRgba(C, 0.5)}` : 'none',
              clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))',
              padding: '4px 8px',
              background: h ? hexToRgba(C, 0.1) : 'transparent',
              border: `0.5px solid ${h ? hexToRgba(C, 0.4) : hexToRgba(C, 0.2)}`,
            }}
          >
            <Key className="w-3 h-3" style={{ filter: h ? `drop-shadow(0 0 2px ${C})` : 'none' }} />
            Открыть Kanban
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Kanban Card — cartoon cyberpunk interactive data panel ─── */
function KanbanCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const [h, setH] = useState(false);
  const isAuto = !!task.soundflowProjectId;
  const color = isAuto ? Y : C;
  const children = task.children || [];
  const done = children.filter(c => c.status === 'done').length;
  const pct = children.length > 0 ? Math.round((done / children.length) * 100) : 0;
  const SEGMENTS = 10;
  const filledSegs = Math.round((pct / 100) * SEGMENTS);
  const TypeIcon = isAuto ? Music2 : FolderKanban;

  return (
    <motion.div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      className="relative cursor-pointer overflow-hidden"
      initial={{ opacity: 0, scale: 0.88, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      whileHover={{ scale: 1.035, y: -5 }}
      whileTap={{ scale: 0.985 }}
      style={{
        clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
        background: `linear-gradient(135deg, ${hexToRgba(color, h ? 0.22 : 0.12)}, rgba(14,18,28,0.94))`,
        boxShadow: h
          ? `inset 0 0 0 2px ${hexToRgba(color, 0.75)}, 0 12px 40px ${hexToRgba(color, 0.32)}, 0 0 70px ${hexToRgba(color, 0.18)}, 0 6px 18px rgba(0,0,0,0.55)`
          : `inset 0 0 0 1.5px ${hexToRgba(color, 0.38)}, 0 4px 14px rgba(0,0,0,0.45)`,
        transition: 'box-shadow 280ms ease, background 280ms ease',
      }}
    >
      {/* ── Breathing edge glow (cartoon pulsing aura) ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: `inset 0 0 0 2px ${hexToRgba(color, h ? 0.45 : 0.15)}`,
          animation: 'kb-breathe 2.4s ease-in-out infinite',
          opacity: h ? 1 : 0.6,
          zIndex: 1,
        }}
      />

      {/* ── Sweeping scan line (vertical, on hover) ── */}
      {h && (
        <div
          className="absolute inset-y-0 pointer-events-none"
          style={{
            width: '45%',
            left: '-45%',
            background: `linear-gradient(90deg, transparent, ${hexToRgba(color, 0.3)}, transparent)`,
            animation: 'kb-sweep 1.4s ease-out',
            zIndex: 3,
          }}
        />
      )}

      {/* ── Circuit grid pattern — animated shift on hover ── */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: h ? 0.55 : 0.18,
          backgroundImage: `
            linear-gradient(${hexToRgba(color, 0.1)} 1px, transparent 1px),
            linear-gradient(90deg, ${hexToRgba(color, 0.1)} 1px, transparent 1px)
          `,
          backgroundSize: '14px 14px',
          animation: h ? 'kb-grid-shift 1.5s linear infinite' : 'none',
          zIndex: 0,
        }}
      />

      {/* ── Floating particles (cartoon sparkles) ── */}
      {h && [
        { id: 1, top: '18%', left: '10%', delay: '0s', size: 3 },
        { id: 2, top: '72%', left: '14%', delay: '0.3s', size: 2 },
        { id: 3, top: '28%', left: '86%', delay: '0.6s', size: 3 },
        { id: 4, top: '82%', left: '80%', delay: '0.9s', size: 2 },
        { id: 5, top: '50%', left: '6%', delay: '0.15s', size: 2 },
      ].map(p => (
        <div
          key={p.id}
          className="absolute pointer-events-none rounded-full"
          style={{
            top: p.top, left: p.left, width: p.size, height: p.size,
            background: color,
            boxShadow: `0 0 8px ${color}, 0 0 3px ${color}`,
            animation: `kb-float 2s ease-in-out ${p.delay} infinite`,
            zIndex: 2,
          }}
        />
      ))}

      {/* ── Animated corner brackets (targeting reticle, cartoon-style) ── */}
      {[
        { cls: 'top-1.5 left-1.5', rot: 0 },
        { cls: 'top-1.5 right-1.5', rot: 90 },
        { cls: 'bottom-1.5 right-1.5', rot: 180 },
        { cls: 'bottom-1.5 left-1.5', rot: 270 },
      ].map((c, i) => (
        <div
          key={i}
          className={`absolute ${c.cls} pointer-events-none`}
          style={{
            width: 14, height: 14,
            transform: `rotate(${c.rot}deg) scale(${h ? 1.1 : 0.55})`,
            opacity: h ? 1 : 0.4,
            transition: 'all 320ms cubic-bezier(0.34,1.56,0.64,1)',
            animation: h ? `kb-corner-flash 1.8s ease-in-out ${i * 0.15}s infinite` : 'none',
            zIndex: 4,
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, width: 14, height: 2.5, background: color, boxShadow: `0 0 5px ${color}`, borderRadius: '1px' }} />
          <div style={{ position: 'absolute', top: 0, left: 0, width: 2.5, height: 14, background: color, boxShadow: `0 0 5px ${color}`, borderRadius: '1px' }} />
        </div>
      ))}

      {/* ── Top accent strip — holographic gradient ── */}
      <div
        className="h-1 w-full relative z-[2]"
        style={{
          background: `linear-gradient(90deg, transparent, ${color} 30%, ${color} 70%, transparent)`,
          boxShadow: `0 0 10px ${hexToRgba(color, 0.8)}`,
        }}
      />

      <div className="p-4 relative z-[2]">
        {/* Header row: holographic KANBAN badge + project type */}
        <div className="mb-3 flex items-center justify-between">
          <span
            className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-extrabold uppercase tracking-widest relative"
            style={{
              background: h
                ? `linear-gradient(90deg, ${hexToRgba(color, 0.3)}, ${hexToRgba(color, 0.18)}, ${hexToRgba(color, 0.3)})`
                : hexToRgba(color, 0.14),
              backgroundSize: h ? '200% 100%' : '100% 100%',
              animation: h ? 'kb-holo-shift 1.5s ease-in-out infinite' : 'none',
              color,
              border: `1.5px solid ${hexToRgba(color, h ? 0.65 : 0.4)}`,
              clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
              boxShadow: h ? `0 0 12px ${hexToRgba(color, 0.45)}` : 'none',
              transition: 'all 220ms ease',
            }}
          >
            {/* Pulsing status dot — heartbeat ping */}
            <span className="relative inline-block w-2 h-2">
              <span
                className="absolute inset-0 rounded-full"
                style={{ background: color, boxShadow: `0 0 6px ${color}` }}
              />
              {h && (
                <span
                  className="absolute inset-0 rounded-full"
                  style={{ background: color, animation: 'kb-ping 1.5s ease-out infinite' }}
                />
              )}
            </span>
            {isAuto ? 'AUTO' : 'KANBAN'}
          </span>
          <span
            className="text-[10px] font-mono uppercase tracking-wider transition-colors"
            style={{ color: h ? hexToRgba(color, 0.8) : 'rgba(100,116,139,0.7)' }}
          >
            {task.projectType || 'general'}
          </span>
        </div>

        {/* Floating bobbing type icon */}
        <motion.div
          className="mb-2.5 flex h-10 w-10 items-center justify-center"
          style={{
            clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))',
            background: h ? hexToRgba(color, 0.28) : hexToRgba(color, 0.14),
            border: `1.5px solid ${hexToRgba(color, h ? 0.65 : 0.32)}`,
            boxShadow: h ? `0 0 16px ${hexToRgba(color, 0.5)}` : 'none',
          }}
          animate={h ? { y: [0, -3, 0], rotate: [0, -4, 4, 0] } : { y: 0, rotate: 0 }}
          transition={{ duration: 1.2, repeat: h ? Infinity : 0, ease: 'easeInOut' }}
        >
          <TypeIcon className="w-5 h-5" style={{ color, filter: h ? `drop-shadow(0 0 4px ${color})` : 'none' }} />
        </motion.div>

        {/* Title — monospace with neon glow on hover */}
        <h3
          className="mb-3 text-sm font-bold leading-tight line-clamp-2"
          style={{
            minHeight: '2.5em',
            color: h ? '#ffffff' : '#cbd5e1',
            textShadow: h ? `0 0 10px ${hexToRgba(color, 0.5)}, 0 0 2px ${hexToRgba(color, 0.9)}` : 'none',
            transition: 'color 200ms ease, text-shadow 200ms ease',
            fontFamily: 'monospace',
            letterSpacing: '0.01em',
          }}
        >
          {task.title}
        </h3>

        {/* Chunky segmented progress bar — cartoon blocks */}
        <div className="flex items-center gap-2 mb-2.5">
          <div className="flex-1 flex gap-[2px]">
            {Array.from({ length: SEGMENTS }).map((_, i) => {
              const filled = i < filledSegs;
              const doneColor = pct === 100 ? G : color;
              return (
                <div
                  key={i}
                  className="flex-1 h-2"
                  style={{
                    background: filled ? doneColor : hexToRgba(color, 0.1),
                    boxShadow: filled ? `0 0 6px ${hexToRgba(doneColor, 0.7)}` : 'none',
                    borderRadius: '1px',
                    transition: `all 220ms cubic-bezier(0.34,1.56,0.64,1) ${i * 35}ms`,
                    transform: h && filled ? 'scaleY(1.15)' : 'scaleY(1)',
                  }}
                />
              );
            })}
          </div>
          <span
            className="text-[11px] font-extrabold tabular-nums font-mono"
            style={{
              color: pct === 100 ? G : color,
              textShadow: `0 0 6px ${hexToRgba(pct === 100 ? G : color, 0.55)}`,
              minWidth: '34px',
              textAlign: 'right',
            }}
          >
            {pct}%
          </span>
        </div>

        {/* Bottom data row — chunky meta with icons */}
        <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider">
          <span className="flex items-center gap-1" style={{ color: h ? hexToRgba(color, 0.9) : 'rgba(100,116,139,0.9)' }}>
            <Layers className="w-3 h-3" style={{ color, opacity: h ? 1 : 0.65 }} />
            {children.length} {plural(children.length, ['board', 'boards', 'boards'])}
          </span>
          <span className="flex items-center gap-1" style={{ color: h ? hexToRgba(pct === 100 ? G : color, 0.9) : 'rgba(100,116,139,0.9)' }}>
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: pct === 100 ? G : color,
                boxShadow: `0 0 5px ${pct === 100 ? G : color}`,
                animation: 'kb-blink 1.5s ease-in-out infinite',
              }}
            />
            {done}/{children.length} done
          </span>
        </div>
      </div>
    </motion.div>
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

/* ─── Stat Bar: cyberpunk 2077 chamfered yellow metric panels ─── */
function StatBar({ stats }: { stats: { icon: typeof FolderKanban; value: number; label: string; color: string }[] }) {
  return (
    <div className="flex items-center gap-2">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            className="flex items-center gap-2 px-3 py-2 transition-all hover:scale-[1.03]"
            style={{
              clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))',
              background: 'linear-gradient(135deg, #FFC42E 0%, #FFB423 50%, #FFC42E 100%)',
              boxShadow: '0 0 14px rgba(255,196,46,0.5), 0 0 28px rgba(255,196,46,0.2), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.2)',
              borderRight: '1px solid rgba(0,0,0,0.25)',
            }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: '#0a0b10', filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.4))' }} />
            <div className="flex flex-col leading-none">
              <span className="text-sm font-extrabold tabular-nums" style={{ color: '#0a0b10' }}>{s.value}</span>
              <span className="text-[8px] font-bold uppercase tracking-[0.12em] mt-0.5" style={{ color: 'rgba(10,11,16,0.7)' }}>{s.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Section header ─── */
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
        <h2 className="text-sm font-bold tracking-wide text-slate-200">{title}</h2>
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
        clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
        background: h
          ? 'radial-gradient(circle at center, rgba(255,196,46,0.14), rgba(10,14,22,0.92))'
          : 'radial-gradient(circle at center, rgba(255,196,46,0.06), rgba(10,14,22,0.7))',
        boxShadow: h
          ? `inset 0 0 0 1.5px rgba(255,196,46,0.6), 0 0 28px rgba(255,196,46,0.25), inset 0 0 22px rgba(255,196,46,0.1)`
          : `inset 0 0 0 1px rgba(255,196,46,0.25)`,
        transition: 'all 280ms cubic-bezier(0.4,0,0.2,1)',
        cursor: 'pointer',
      }}
    >
      {/* Circuit board pattern background on hover */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: h ? 0.5 : 0.15,
          backgroundImage: `
            linear-gradient(rgba(255,196,46,0.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,196,46,0.12) 1px, transparent 1px)
          `,
          backgroundSize: '14px 14px',
        }}
      />

      {/* ── Holographic terminal: central ring core with rotating concentric data rings ── */}
      <div className="relative flex items-center justify-center" style={{ width: '88px', height: '88px' }}>
        {/* Outer thin ring */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: '88px', height: '88px',
            border: '1px solid rgba(255,196,46,0.35)',
            boxShadow: '0 0 14px rgba(255,196,46,0.3)',
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
            border: '1.5px dashed rgba(255,196,46,0.7)',
            background: 'transparent',
            animation: 'kb2-ring-spin-cw 8s linear infinite',
            boxShadow: '0 0 12px rgba(255,196,46,0.4)',
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
            background: `conic-gradient(from 0deg, transparent 0deg, transparent 15deg, rgba(255,196,46,0.6) 16deg, rgba(255,196,46,0.6) 18deg, transparent 19deg, transparent 45deg, rgba(255,196,46,0.6) 46deg, rgba(255,196,46,0.6) 48deg, transparent 49deg, transparent 90deg, rgba(255,196,46,0.6) 91deg, rgba(255,196,46,0.6) 93deg, transparent 94deg, transparent 135deg, rgba(255,196,46,0.6) 136deg, rgba(255,196,46,0.6) 138deg, transparent 139deg, transparent 180deg, rgba(255,196,46,0.6) 181deg, rgba(255,196,46,0.6) 183deg, transparent 184deg, transparent 225deg, rgba(255,196,46,0.6) 226deg, rgba(255,196,46,0.6) 228deg, transparent 229deg, transparent 270deg, rgba(255,196,46,0.6) 271deg, rgba(255,196,46,0.6) 273deg, transparent 274deg, transparent 315deg, rgba(255,196,46,0.6) 316deg, rgba(255,196,46,0.6) 318deg, transparent 319deg)`,
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
            background: 'linear-gradient(135deg, #FFC42E 0%, #FFB423 50%, #FFC42E 100%)',
            boxShadow: '0 0 18px rgba(255,196,46,0.6), inset 0 1px 0 rgba(255,255,255,0.5)',
            animation: 'kb2-core-pulse 2.4s ease-in-out infinite',
          }}
        >
          <Plus
            className="w-6 h-6"
            style={{
              color: '#0a0b10',
              filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.4))',
            }}
          />
        </div>
      </div>

      <span
        className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.18em]"
        style={{
          color: '#FFC42E',
          textShadow: '0 0 8px rgba(255,196,46,0.6), 0 0 4px rgba(255,196,46,0.9)',
          animation: h ? 'kb2-holo-text 1.8s ease-in-out infinite' : 'none',
        }}
      >
        {label}
      </span>
    </button>
  );
}

/* ─── Quick Access Card — dark data slab with waveform + segmented dial ─── */
function QuickAccessCard({ item, onClick, onUnstar, onMoveTo, priority, total }: {
  item: ModalItem; onClick: () => void; onUnstar: () => void;
  onMoveTo: (targetIdx: number) => void; priority: number; total: number;
}) {
  const [h, setH] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const t = typeMeta[item.type] || typeMeta.general;
  const Icon = t.icon;
  const sc = stHex[item.status] || '#64748b';
  const sl = stLabel[item.status] || item.status;
  const triggerActive = h || menuOpen;
  // Segmented dial — 8 segments, filled = priority/total * 8
  const DIAL_SEGS = 8;
  const filledDial = Math.round((priority / Math.max(total, 1)) * DIAL_SEGS);
  // Realistic waveform bars (deterministic from item.id) — smooth sinusoidal shape
  const waveBars = useMemo(() => {
    const seed = item.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return Array.from({ length: 24 }, (_, i) => {
      const base = 0.45 + 0.35 * Math.sin((i / 24) * Math.PI * 4 + (seed % 7));
      const harm = 0.15 * Math.sin((i / 24) * Math.PI * 11 + (seed % 13));
      const noise = ((seed * (i + 3) * 7) % 23) / 100 - 0.1;
      return Math.max(0.12, Math.min(0.95, base + harm + noise));
    });
  }, [item.id]);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      className="group relative w-60 shrink-0 cursor-pointer overflow-hidden"
      style={{
        clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
        background: h
          ? `linear-gradient(135deg, ${hexToRgba(t.color, 0.22)}, rgba(10,14,22,0.96))`
          : `linear-gradient(135deg, ${hexToRgba(t.color, 0.10)}, rgba(10,14,22,0.88))`,
        boxShadow: h
          ? `inset 0 0 0 1.5px ${hexToRgba(t.color, 0.7)}, 0 0 28px ${hexToRgba(t.color, 0.28)}, 0 4px 16px rgba(0,0,0,0.5), inset 0 0 18px ${hexToRgba(t.color, 0.08)}`
          : `inset 0 0 0 1px ${hexToRgba(t.color, 0.35)}, 0 2px 10px rgba(0,0,0,0.4)`,
        transition: 'all 280ms cubic-bezier(0.4,0,0.2,1)',
        transform: h ? 'translateY(-3px)' : 'none',
      }}
    >
      {/* Beveled edge glow — top accent strip */}
      <div
        className="h-[2px] w-full"
        style={{
          background: `linear-gradient(90deg, transparent, ${t.color} 30%, ${t.color} 70%, transparent)`,
          boxShadow: `0 0 8px ${hexToRgba(t.color, 0.7)}`,
        }}
      />

      {/* Body */}
      <div className="p-3 pt-3.5 relative">
        {/* Type icon (fragmented lightning bolt style) + unstar */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div
              className="flex h-6 w-6 items-center justify-center"
              style={{
                clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))',
                background: hexToRgba(t.color, 0.18),
                border: `1px solid ${hexToRgba(t.color, 0.5)}`,
                boxShadow: h ? `0 0 8px ${hexToRgba(t.color, 0.5)}` : 'none',
              }}
            >
              <Zap className="w-3 h-3" style={{ color: t.color, filter: `drop-shadow(0 0 2px ${t.color})` }} />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: t.color, textShadow: `0 0 4px ${hexToRgba(t.color, 0.4)}` }}>{t.label}</span>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onUnstar(); }}
            className="p-0.5 transition-all hover:scale-110"
            title="Убрать из быстрого доступа"
          >
            <Zap className="w-3 h-3" style={{ color: '#FFC42E', filter: 'drop-shadow(0 0 3px rgba(255,196,46,0.7))' }} />
          </button>
        </div>

        {/* Title */}
        <p className="text-sm font-bold line-clamp-1" style={{
          color: h ? '#ffffff' : '#cbd5e1',
          letterSpacing: '0.02em',
          fontFamily: 'monospace',
          textShadow: h ? `0 0 8px ${hexToRgba(t.color, 0.4)}` : 'none',
        }}>
          {item.title}
        </p>

        {/* Meta */}
        <div className="mt-1.5 flex items-center gap-2 text-[10px]" style={{ color: h ? hexToRgba(t.color, 0.85) : '#64748b', fontFamily: 'monospace' }}>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc, boxShadow: `0 0 4px ${hexToRgba(sc, 0.5)}` }} />
            {sl}
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Music2 className="w-3 h-3" />
            {item.trackCount}
          </span>
        </div>

        {/* ── Realistic audio waveform (static, playhead sweeps on hover) ── */}
        <div className="relative h-8 mt-2.5 overflow-hidden" style={{
          background: 'rgba(0,0,0,0.35)',
          borderRadius: '2px',
          border: `0.5px solid ${hexToRgba(t.color, 0.2)}`,
        }}>
          <div className="absolute left-0 right-0 top-1/2 h-px" style={{ background: hexToRgba(t.color, 0.15) }} />
          <div className="absolute inset-0 flex items-center justify-between px-1">
            {waveBars.map((v, i) => (
              <div key={i} style={{
                width: '1.5px',
                height: `${Math.round(v * 100)}%`,
                background: t.color,
                opacity: h ? 0.95 : 0.55,
                boxShadow: h ? `0 0 2px ${hexToRgba(t.color, 0.6)}` : 'none',
                transformOrigin: 'center',
                animation: h ? `kb4-bar-lift ${1.6 + (i % 6) * 0.18}s ease-in-out ${(i * 0.06).toFixed(2)}s infinite` : 'none',
                transition: 'opacity 200ms',
                borderRadius: '0.5px',
              }} />
            ))}
          </div>
          {h && (
            <div className="absolute inset-y-0 pointer-events-none" style={{
              width: '28px',
              background: `linear-gradient(90deg, transparent, ${hexToRgba(t.color, 0.25)} 40%, ${hexToRgba('#ffffff', 0.35)} 50%, ${hexToRgba(t.color, 0.25)} 60%, transparent)`,
              animation: 'kb4-play-sweep 2.4s ease-in-out infinite',
              boxShadow: `0 0 8px ${hexToRgba(t.color, 0.5)}`,
            }}>
              <div className="absolute inset-y-0 left-1/2 w-px" style={{ background: '#ffffff', boxShadow: `0 0 6px ${t.color}` }} />
            </div>
          )}
        </div>
      </div>

      {/* ── Segmented progress dial (priority indicator) — bottom right ── */}
      <div className="absolute bottom-2 left-2 z-20 flex items-center gap-1">
        <div className="flex gap-[1.5px]">
          {Array.from({ length: DIAL_SEGS }).map((_, i) => (
            <div
              key={i}
              style={{
                width: '3px',
                height: '8px',
                background: i < filledDial ? t.color : hexToRgba(t.color, 0.18),
                boxShadow: i < filledDial ? `0 0 4px ${hexToRgba(t.color, 0.7)}` : 'none',
                borderRadius: '0.5px',
                transform: i < filledDial && h ? 'scaleY(1.15)' : 'scaleY(1)',
                transition: `transform 220ms cubic-bezier(0.34,1.56,0.64,1) ${i * 25}ms`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Priority selector — bottom right corner, dropdown of positions */}
      <div className="absolute bottom-2 right-2 z-20">
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="flex h-5 items-center gap-0.5 pl-1 pr-0.5 transition-all hover:scale-105"
              style={{
                clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))',
                background: triggerActive ? '#FFC42E' : 'rgba(0,0,0,0.55)',
                boxShadow: `inset 0 0 0 1px ${triggerActive ? 'rgba(255,196,46,0.85)' : 'rgba(255,196,46,0.45)'}, 0 0 8px ${triggerActive ? 'rgba(255,196,46,0.5)' : 'transparent'}`,
                color: triggerActive ? '#000' : '#FFC42E',
              }}
              title="Сменить позицию"
            >
              <span className="text-[9px] font-extrabold tabular-nums leading-none px-0.5">{priority}</span>
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={4}
            className="p-1.5 w-auto min-w-[72px] rounded-none border-0 bg-transparent"
            style={{
              background: 'rgba(8,10,18,0.98)',
              boxShadow: 'inset 0 0 0 1px rgba(255,196,46,0.4), 0 8px 24px rgba(0,0,0,0.5)',
              clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-0.5">
              {Array.from({ length: total }, (_, i) => i + 1).map((pos) => {
                const active = pos === priority;
                return (
                  <button
                    key={pos}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onMoveTo(pos - 1); }}
                    className="flex h-6 w-full items-center justify-center text-[10px] font-bold tabular-nums transition-colors"
                    style={{
                      clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))',
                      background: active ? 'rgba(255,196,46,0.18)' : 'transparent',
                      color: active ? '#FFC42E' : '#94a3b8',
                      boxShadow: active ? 'inset 0 0 0 1px rgba(255,196,46,0.5)' : 'none',
                    }}
                  >
                    {pos}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
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
    <div className="relative group/carousel">
      {/* Left arrow */}
      {canLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center transition-all duration-200"
          style={{
            background: 'rgba(8,10,18,0.85)',
            backdropFilter: 'blur(8px)',
            borderRadius: '50%',
            border: '1px solid rgba(255,196,46,0.3)',
            boxShadow: '0 0 16px rgba(255,196,46,0.15)',
            color: '#FFC42E',
            cursor: 'pointer',
            opacity: 0.7,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.boxShadow = '0 0 24px rgba(255,196,46,0.4)'; e.currentTarget.style.borderColor = 'rgba(255,196,46,0.6)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.boxShadow = '0 0 16px rgba(255,196,46,0.15)'; e.currentTarget.style.borderColor = 'rgba(255,196,46,0.3)'; }}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

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

      {/* Right arrow */}
      {canRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center transition-all duration-200"
          style={{
            background: 'rgba(8,10,18,0.85)',
            backdropFilter: 'blur(8px)',
            borderRadius: '50%',
            border: '1px solid rgba(255,196,46,0.3)',
            boxShadow: '0 0 16px rgba(255,196,46,0.15)',
            color: '#FFC42E',
            cursor: 'pointer',
            opacity: 0.7,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.boxShadow = '0 0 24px rgba(255,196,46,0.4)'; e.currentTarget.style.borderColor = 'rgba(255,196,46,0.6)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.boxShadow = '0 0 16px rgba(255,196,46,0.15)'; e.currentTarget.style.borderColor = 'rgba(255,196,46,0.3)'; }}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Edge fade gradients */}
      {canLeft && (
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 z-[5]" style={{ background: 'linear-gradient(90deg, rgba(6,8,13,0.9), transparent)' }} />
      )}
      {canRight && (
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 z-[5]" style={{ background: 'linear-gradient(270deg, rgba(6,8,13,0.9), transparent)' }} />
      )}

      {/* Hidden scrollbar CSS */}
      <style>{`
        .group\\/carousel > div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

/* ─── All Projects Modal ─── */
function AllProjectsModal({
  open, onClose, mode, items, quickAccess, toggleQuickAccess,
}: {
  open: boolean;
  onClose: () => void;
  mode: 'auto' | 'kanban';
  items: ModalItem[];
  quickAccess: string[];
  toggleQuickAccess: (id: string) => void;
}) {
  const [sortMode, setSortMode] = useState<SortMode>('date');

  const sorted = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      if (sortMode === 'date') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortMode === 'name') return a.title.localeCompare(b.title, 'ru');
      return (a.type || '').localeCompare(b.type || '');
    });
    return arr;
  }, [items, sortMode]);

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl flex flex-col"
        style={{
          maxHeight: '80vh',
          background: 'rgba(8,10,18,0.98)',
          border: `1px solid ${hexToRgba(Y, 0.5)}`,
          boxShadow: `0 0 50px ${hexToRgba(Y, 0.2)}, 0 20px 60px rgba(0,0,0,0.6)`,
          clipPath: 'polygon(0 14px, 14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px))',
        }}
      >
        <div
          className="h-[2px] shrink-0"
          style={{ background: `linear-gradient(90deg, transparent, ${Y}, transparent)` }}
        />
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-bold tracking-wide text-slate-100">
            {mode === 'auto' ? 'Все проекты' : 'Все канбан-проекты'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.04]">
          <span className="text-[10px] uppercase tracking-wider text-slate-600">Сортировка:</span>
          {(['date', 'name', 'type'] as SortMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSortMode(m)}
              className="rounded px-2.5 py-1 text-[11px] font-medium transition-all"
              style={{
                background: sortMode === m ? hexToRgba(Y, 0.12) : 'transparent',
                color: sortMode === m ? Y : '#94a3b8',
                border: `1px solid ${sortMode === m ? hexToRgba(Y, 0.4) : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              {m === 'date' ? 'Дата' : m === 'name' ? 'Название' : 'Тип'}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-slate-600">
            {sorted.length} {plural(sorted.length, ['проект', 'проекта', 'проектов'])}
          </span>
        </div>
        <div
          className="flex-1 overflow-y-auto p-2"
          style={{ scrollbarWidth: 'thin', scrollbarColor: `${hexToRgba(Y, 0.3)} transparent` }}
        >
          {sorted.length === 0 ? (
            <div className="text-center py-12 text-slate-600 text-sm">Нет проектов</div>
          ) : (
            sorted.map((item) => {
              const t = typeMeta[item.type] || typeMeta.general;
              const Icon = t.icon;
              const sc = stHex[item.status] || '#64748b';
              const sl = stLabel[item.status] || item.status;
              const starred = quickAccess.includes(item.id);
              return (
                <div
                  key={item.id}
                  onClick={item.onOpen}
                  className="group flex items-center gap-3 rounded-md px-3 py-2.5 cursor-pointer transition-colors hover:bg-white/[0.04]"
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                    style={{ background: hexToRgba(t.color, 0.1), border: `1px solid ${hexToRgba(t.color, 0.25)}` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: t.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate group-hover:text-yellow-300 transition-colors">
                      {item.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-[10px] text-slate-500">
                      <span style={{ color: t.color }}>{t.label}</span>
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc, boxShadow: `0 0 4px ${hexToRgba(sc, 0.4)}` }} />
                        {sl}
                      </span>
                      <span className="flex items-center gap-1">
                        <Music2 className="w-3 h-3" />
                        {item.trackCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {fmtDate(item.date)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleQuickAccess(item.id); }}
                    className="shrink-0 p-1.5 rounded-md transition-all hover:bg-white/[0.06]"
                    style={{ color: starred ? Y : '#475569' }}
                    title={starred ? 'Убрать из быстрого доступа' : 'В быстрый доступ'}
                  >
                    <Star className="w-4 h-4" style={{ color: starred ? Y : '#475569', fill: starred ? Y : 'none' }} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </motion.div>
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
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({ album: true, ep: false, single: false, general: false });
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [allAutoOpen, setAllAutoOpen] = useState(false);
  const [allKanbanOpen, setAllKanbanOpen] = useState(false);
  const [quickAccess, setQuickAccess] = useState<string[]>([]);

  const autoProjects = useMemo(() => projects.filter(p => p.kanbanTaskId), [projects]);
  const recentIdeas = useMemo(() =>
    [...ideas].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8),
  [ideas]);

  const getTrackCount = (pid: string) => tracks.filter(t => t.projectId === pid).length;

  const projectsByType = useMemo(() => {
    const g: Record<string, Project[]> = { album: [], ep: [], single: [], general: [] };
    projects.forEach(p => { const k = (p.type || 'general').toLowerCase(); (g[k] ||= []).push(p); });
    return g;
  }, [projects]);

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

  const goToKanban = (id: string) => { if (id) { navigate('kanban'); setTimeout(() => useKanbanStore.getState().selectProject(id), 220); } };
  const toggleFolder = (k: string) => setExpandedFolders(p => ({ ...p, [k]: !p[k] }));

  const toggleQuickAccess = (id: string) => {
    setQuickAccess(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
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
    <div className="min-h-full relative" style={{ background: '#0a0b10' }}>
      {/* ── Global background: circuit board pattern + hex data stream ── */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          zIndex: 0,
          backgroundColor: '#0a0b10',
          backgroundImage: `
            radial-gradient(ellipse at center, rgba(75,30,150,0.18) 0%, transparent 55%),
            linear-gradient(rgba(0,217,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,217,255,0.04) 1px, transparent 1px),
            repeating-linear-gradient(0deg, transparent 0px, transparent 38px, rgba(0,217,255,0.025) 38px, rgba(0,217,255,0.025) 40px),
            repeating-linear-gradient(90deg, transparent 0px, transparent 38px, rgba(0,217,255,0.025) 38px, rgba(0,217,255,0.025) 40px)
          `,
          backgroundSize: '100% 100%, 40px 40px, 40px 40px, 40px 40px, 40px 40px',
          animation: 'kb2-circuit-pulse 8s ease-in-out infinite',
        }}
      />
      {/* ── Hex code data stream overlay (faint vertical columns) ── */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          zIndex: 0,
          opacity: 0.06,
          fontFamily: 'monospace',
          fontSize: '10px',
          lineHeight: '20px',
          color: '#00d9ff',
          backgroundImage: `repeating-linear-gradient(0deg, transparent 0px, transparent 18px, rgba(0,217,255,0.6) 18px, rgba(0,217,255,0.6) 20px)`,
          backgroundSize: '20px 20px',
          animation: 'kb2-hex-scroll 30s linear infinite',
          textShadow: '0 0 4px rgba(0,217,255,0.8)',
        }}
      />
      {/* ── Scanning sweep line (subtle, slow) ── */}
      <div
        className="pointer-events-none fixed left-0 right-0 h-24"
        style={{
          zIndex: 0,
          top: 0,
          background: 'linear-gradient(180deg, transparent, rgba(0,217,255,0.06), transparent)',
          animation: 'kb2-scan-sweep 14s linear infinite',
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
              color: '#e8eaf2',
              letterSpacing: '0.03em',
              textShadow: '0 0 8px rgba(168,85,247,0.55), 0 0 18px rgba(168,85,247,0.3)',
            }}>
              Привет, {user?.displayName || 'музыкант'}
            </h1>
            <p className="mt-0.5 text-sm" style={{
              color: '#7c8aa5',
              letterSpacing: '0.08em',
              textShadow: '0 0 6px rgba(168,85,247,0.25)',
            }}>
              {currentGroup?.name || 'SoundFlow'}{currentGroup?.genre ? ` · ${currentGroup.genre}` : ''}
            </p>
          </div>
          <StatBar stats={stats} />
        </motion.div>


        {/* ── Quick Access — fractured neon-blue light-trail border ── */}
        {quickAccessItems.length > 0 && (
          <section className="mt-8 relative overflow-hidden" style={{
            clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
            background: 'linear-gradient(180deg, rgba(0,217,255,0.10) 0%, rgba(12,18,26,0.95) 40%)',
            padding: '22px',
          }}>
            {/* ── Multi-layered fractured light-trail border (cyan) ── */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                padding: '1.5px',
                background: 'linear-gradient(90deg, rgba(0,217,255,0.7) 0%, rgba(0,217,255,0.15) 15%, rgba(0,217,255,0.7) 25%, rgba(168,85,247,0.55) 50%, rgba(0,217,255,0.7) 75%, rgba(0,217,255,0.15) 85%, rgba(0,217,255,0.7) 100%)',
                backgroundSize: '200% 100%',
                animation: 'kb2-trail-cyan 6s linear infinite',
                WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
                clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
                boxShadow: '0 0 28px rgba(0,217,255,0.25), inset 0 0 22px rgba(0,217,255,0.08)',
                zIndex: 1,
              }}
            />
            {/* Inner glow layer */}
            <div
              className="absolute inset-[3px] pointer-events-none"
              style={{
                clipPath: 'polygon(0 0, calc(100% - 11px) 0, 100% 11px, 100% 100%, 11px 100%, 0 calc(100% - 11px))',
                border: '1px solid rgba(0,217,255,0.18)',
                animation: 'kb2-pulse-cyan 3s ease-in-out infinite',
                zIndex: 1,
              }}
            />

            {/* Neon top bar — cyan */}
            <div className="absolute left-0 right-0 top-0 h-[3px]" style={{
              background: 'linear-gradient(90deg, transparent, #00d9ff 20%, #00d9ff 80%, transparent)',
              boxShadow: '0 0 14px rgba(0,217,255,0.7)',
            }} />
            {/* Corner accents — cyan, larger fractured style */}
            <div className="absolute top-0 left-0 w-4 h-4" style={{ borderTop: '2.5px solid #00d9ff', borderLeft: '2.5px solid #00d9ff', boxShadow: '0 0 8px rgba(0,217,255,0.6)' }} />
            <div className="absolute top-0 right-0 w-4 h-4" style={{ borderTop: '2.5px solid #00d9ff', borderRight: '2.5px solid #00d9ff', boxShadow: '0 0 8px rgba(0,217,255,0.6)' }} />
            <div className="absolute bottom-0 left-0 w-4 h-4" style={{ borderBottom: '2.5px solid #00d9ff', borderLeft: '2.5px solid #00d9ff', boxShadow: '0 0 8px rgba(0,217,255,0.6)' }} />
            <div className="absolute bottom-0 right-0 w-4 h-4" style={{ borderBottom: '2.5px solid #00d9ff', borderRight: '2.5px solid #00d9ff', boxShadow: '0 0 8px rgba(0,217,255,0.6)' }} />

            <div className="mb-4 flex items-center justify-between relative" style={{ zIndex: 2 }}>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center" style={{
                  clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
                  background: 'rgba(0,217,255,0.18)',
                  border: '1px solid rgba(0,217,255,0.55)',
                  boxShadow: '0 0 12px rgba(0,217,255,0.3)',
                }}>
                  <Zap className="w-3.5 h-3.5" style={{ color: '#00d9ff', filter: 'drop-shadow(0 0 3px rgba(0,217,255,0.8))' }} />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-[0.18em]" style={{ color: '#00d9ff', textShadow: '0 0 10px rgba(0,217,255,0.5), 0 0 4px rgba(0,217,255,0.8)' }}>
                  Быстрый доступ
                </h2>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-1" style={{
                color: '#00d9ff',
                clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
                background: 'rgba(0,217,255,0.08)',
                border: '1px solid rgba(0,217,255,0.3)',
                textShadow: '0 0 6px rgba(0,217,255,0.5)',
              }}>
                {quickAccessItems.length} активных
              </span>
            </div>

            <div className="relative" style={{ zIndex: 2 }}>
              <Carousel>
                {quickAccessItems.map((item, idx) => (
                  <QuickAccessCard
                    key={item.id}
                    item={item}
                    onClick={item.onOpen}
                    onUnstar={() => toggleQuickAccess(item.id)}
                    onMoveTo={(targetIdx) => moveQuickAccessTo(item.id, targetIdx)}
                    priority={idx + 1}
                    total={quickAccessItems.length}
                  />
                ))}
              </Carousel>
            </div>
          </section>
        )}

        {/* ── Auto Projects — pulsating yellow fractured light-trail panel ── */}
        <section className="mt-8 relative overflow-hidden" style={{
          clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
          background: 'linear-gradient(180deg, rgba(255,196,46,0.10) 0%, rgba(12,16,24,0.95) 40%)',
          padding: '22px',
        }}>
          {/* ── Multi-layered fractured light-trail border (yellow, pulsating) ── */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              padding: '1.5px',
              background: 'linear-gradient(90deg, rgba(255,196,46,0.8) 0%, rgba(255,196,46,0.15) 12%, rgba(255,196,46,0.8) 22%, rgba(168,85,247,0.5) 50%, rgba(255,196,46,0.8) 78%, rgba(255,196,46,0.15) 88%, rgba(255,196,46,0.8) 100%)',
              backgroundSize: '200% 100%',
              animation: 'kb2-trail-yellow 7s linear infinite, kb2-pulse-yellow 2.8s ease-in-out infinite',
              WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
              zIndex: 1,
            }}
          />
          {/* Inner glow border */}
          <div
            className="absolute inset-[3px] pointer-events-none"
            style={{
              clipPath: 'polygon(0 0, calc(100% - 11px) 0, 100% 11px, 100% 100%, 11px 100%, 0 calc(100% - 11px))',
              border: '1px solid rgba(255,196,46,0.22)',
              animation: 'kb2-pulse-yellow 2.8s ease-in-out infinite',
              zIndex: 1,
            }}
          />

          {/* Neon top accent — yellow */}
          <div className="absolute left-0 right-0 top-0 h-[3px]" style={{
            background: 'linear-gradient(90deg, transparent, #FFC42E 20%, #FFC42E 80%, transparent)',
            boxShadow: '0 0 16px rgba(255,196,46,0.7)',
          }} />
          {/* Corner accents — yellow, fractured style */}
          <div className="absolute top-0 left-0 w-4 h-4" style={{ borderTop: '2.5px solid #FFC42E', borderLeft: '2.5px solid #FFC42E', boxShadow: '0 0 8px rgba(255,196,46,0.6)' }} />
          <div className="absolute top-0 right-0 w-4 h-4" style={{ borderTop: '2.5px solid #FFC42E', borderRight: '2.5px solid #FFC42E', boxShadow: '0 0 8px rgba(255,196,46,0.6)' }} />
          <div className="absolute bottom-0 left-0 w-4 h-4" style={{ borderBottom: '2.5px solid #FFC42E', borderLeft: '2.5px solid #FFC42E', boxShadow: '0 0 8px rgba(255,196,46,0.6)' }} />
          <div className="absolute bottom-0 right-0 w-4 h-4" style={{ borderBottom: '2.5px solid #FFC42E', borderRight: '2.5px solid #FFC42E', boxShadow: '0 0 8px rgba(255,196,46,0.6)' }} />

          <div className="relative" style={{ zIndex: 2 }}>
            <SectionHeader
              title="Авто проекты"
              accentColor={Y}
              action={
                <button onClick={() => setAllAutoOpen(true)} className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider transition-all hover:scale-105" style={{ color: 'rgba(255,196,46,0.85)', textShadow: '0 0 6px rgba(255,196,46,0.4)' }}>
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
                />
              ))}
            </div>
          </div>
        </section>

        {/* ── Kanban Projects — cyan, left accent bar style ── */}
        <section className="mt-6 relative" style={{
          borderRadius: '14px',
          background: 'linear-gradient(135deg, rgba(0,217,255,0.1), rgba(12,16,24,0.85))',
          border: '1px solid rgba(0,217,255,0.18)',
          padding: '20px 20px 20px 24px',
          boxShadow: '0 4px 32px rgba(0,217,255,0.06)',
        }}>
          {/* Left accent bar — cyan, full height */}
          <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full" style={{
            background: 'linear-gradient(180deg, transparent, #00d9ff 20%, #00d9ff 80%, transparent)',
            boxShadow: '0 0 12px rgba(0,217,255,0.5)',
          }} />
          {/* Cyan glow orb — decorative */}
          <div className="pointer-events-none absolute -bottom-10 -left-10 w-28 h-28 rounded-full" style={{
            background: 'radial-gradient(circle, rgba(0,217,255,0.08), transparent 70%)',
          }} />

          <SectionHeader
            title="Канбан проекты"
            accentColor={C}
            action={
              <button onClick={() => setAllKanbanOpen(true)} className="flex items-center gap-1 text-[11px] font-medium transition-colors hover:text-cyan-400" style={{ color: 'rgba(0,217,255,0.6)' }}>
                Все <ArrowRight className="w-3 h-3" />
              </button>
            }
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CreateCard onClick={() => navigate('kanban')} label="Создать" />
            {kanbanProjects.slice(0, 3).map(task => (
              <KanbanCard key={task.id} task={task} onClick={() => goToKanban(task.id)} />
            ))}
          </div>
        </section>

        {/* ── Folders ── */}
        <section className="mt-8">
          <SectionHeader title="Мои папки" />
          <div className="grid gap-3 sm:grid-cols-2">
            {(['album', 'ep', 'single', 'general'] as const).map(key => {
              const list = projectsByType[key] || [];
              const t = typeMeta[key];
              const isOpen = !!expandedFolders[key];
              return (
                <div
                  key={key}
                  className="overflow-hidden"
                  style={{
                    borderRadius: '10px',
                    background: `linear-gradient(135deg, ${hexToRgba(t.color, 0.06)}, rgba(14,18,28,0.8))`,
                    border: `1px solid ${hexToRgba(t.color, 0.2)}`,
                  }}
                >
                  <button
                    onClick={() => toggleFolder(key)}
                    className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-white/[0.03]"
                  >
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ background: hexToRgba(t.color, 0.1), border: `1px solid ${hexToRgba(t.color, 0.2)}` }}
                    >
                      <t.icon className="w-4 h-4" style={{ color: t.color }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-200">{t.label}</p>
                      <p className="text-[10px] text-slate-600">{list.length} {plural(list.length, ['проект', 'проекта', 'проектов'])}</p>
                    </div>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-slate-600" /> : <ChevronRight className="w-4 h-4 text-slate-600" />}
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && list.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-white/[0.04]"
                      >
                        <div className="space-y-1 p-2">
                          {list.map(p => {
                            const sc = stHex[p.status] || C;
                            return (
                              <button
                                key={p.id}
                                onClick={() => navigate('project-detail', p.id)}
                                className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-xs transition-colors hover:bg-white/[0.04]"
                              >
                                <span className="truncate text-slate-300">{p.title}</span>
                                <span className="flex items-center gap-1.5 shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc }} />
                                  <span className="text-[10px] text-slate-500">{stLabel[p.status] || p.status}</span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
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
      <AnimatePresence>
        {allAutoOpen && (
          <AllProjectsModal
            open={allAutoOpen}
            mode="auto"
            items={autoModalItems}
            quickAccess={quickAccess}
            toggleQuickAccess={toggleQuickAccess}
            onClose={() => setAllAutoOpen(false)}
          />
        )}
        {allKanbanOpen && (
          <AllProjectsModal
            open={allKanbanOpen}
            mode="kanban"
            items={kanbanModalItems}
            quickAccess={quickAccess}
            toggleQuickAccess={toggleQuickAccess}
            onClose={() => setAllKanbanOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
