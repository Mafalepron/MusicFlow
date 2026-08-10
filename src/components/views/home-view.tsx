'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderKanban, Music2, Lightbulb, Users, ArrowRight, Plus,
  ChevronDown, ChevronRight, Disc3, AudioLines, Zap, Clock, Star, X,
} from 'lucide-react';
import { useAuthStore, useDataStore, useNavigationStore, type Project } from '@/lib/store';
import { useKanbanStore, type Task } from '@/store/kanban-store';
import { hexToRgba } from '@/lib/utils';
import { CreateProjectDialog } from '@/components/shared/create-project-dialog';

/* ─── palette ─── */
const Y = '#FCEE0A'; // yellow accent
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

/* ─── Project Card ─── */
function ProjectCard({ project, trackCount, onClick, onKanban }: {
  project: Project; trackCount: number; onClick: () => void; onKanban: () => void;
}) {
  const [h, setH] = useState(false);
  const t = typeMeta[project.type] || typeMeta.general;
  const Icon = t.icon;
  const sc = stHex[project.status] || '#64748b';
  const sl = stLabel[project.status] || project.status;
  const hasKanban = !!project.kanbanTaskId;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      className="group relative cursor-pointer"
      style={{
        borderRadius: '10px',
        background: h ? `linear-gradient(135deg, ${hexToRgba(t.color, 0.18)}, rgba(16,20,30,0.95))` : `linear-gradient(135deg, ${hexToRgba(t.color, 0.1)}, rgba(14,18,28,0.85))`,
        border: `1px solid ${h ? hexToRgba(t.color, 0.6) : hexToRgba(t.color, 0.3)}`,
        boxShadow: h ? `0 0 0 1px ${hexToRgba(t.color, 0.3)}, 0 8px 32px ${hexToRgba(t.color, 0.2)}, 0 4px 16px rgba(0,0,0,0.4)` : `0 0 0 1px ${hexToRgba(t.color, 0.08)}, 0 4px 12px rgba(0,0,0,0.3)`,
        transition: 'all 220ms cubic-bezier(0.4,0,0.2,1)',
        transform: h ? 'translateY(-4px) scale(1.01)' : 'translateY(0)',
        overflow: 'hidden',
      }}
    >
      {/* Cover gradient strip */}
      <div
        className="h-20 flex items-end p-3"
        style={{
          background: `linear-gradient(135deg, ${hexToRgba(t.color, h ? 0.3 : 0.18)}, ${hexToRgba(t.color, h ? 0.08 : 0.04)})`,
          borderBottom: `1px solid ${hexToRgba(t.color, 0.1)}`,
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: hexToRgba(t.color, 0.15), border: `1px solid ${hexToRgba(t.color, 0.3)}` }}
          >
            <Icon className="w-4 h-4" style={{ color: t.color }} />
          </div>
          <span className="text-[11px] font-semibold" style={{ color: t.color }}>{t.label}</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <h3
          className="mb-2 text-[15px] font-semibold leading-snug transition-colors"
          style={{ color: h ? t.color : '#e8eaed' }}
        >
          {project.title}
        </h3>

        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Music2 className="w-3 h-3" />
            {trackCount} {plural(trackCount, ['трек', 'трека', 'треков'])}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc, boxShadow: `0 0 4px ${hexToRgba(sc, 0.5)}` }} />
            {sl}
          </span>
        </div>

        {hasKanban && (
          <button
            onClick={(e) => { e.stopPropagation(); onKanban(); }}
            className="mt-3 flex items-center gap-1.5 text-[11px] font-medium transition-colors"
            style={{ color: h ? Y : C }}
          >
            <Zap className="w-3 h-3" />
            Открыть Kanban
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Kanban Card ─── */
function KanbanCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const [h, setH] = useState(false);
  const isAuto = !!task.soundflowProjectId;
  const color = isAuto ? Y : C;
  const children = task.children || [];
  const done = children.filter(c => c.status === 'done').length;
  const pct = children.length > 0 ? Math.round((done / children.length) * 100) : 0;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      className="cursor-pointer p-4"
      style={{
        borderRadius: '10px',
        background: h ? `linear-gradient(135deg, ${hexToRgba(color, 0.15)}, rgba(16,20,30,0.95))` : `linear-gradient(135deg, ${hexToRgba(color, 0.08)}, rgba(14,18,28,0.85))`,
        border: `1px solid ${h ? hexToRgba(color, 0.55) : hexToRgba(color, 0.25)}`,
        boxShadow: h ? `0 0 0 1px ${hexToRgba(color, 0.2)}, 0 6px 24px ${hexToRgba(color, 0.15)}, 0 4px 12px rgba(0,0,0,0.35)` : `0 0 0 1px ${hexToRgba(color, 0.05)}, 0 4px 10px rgba(0,0,0,0.25)`,
        transition: 'all 220ms cubic-bezier(0.4,0,0.2,1)',
        transform: h ? 'translateY(-3px) scale(1.01)' : 'none',
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
          style={{ background: hexToRgba(color, 0.12), color, border: `1px solid ${hexToRgba(color, 0.25)}` }}
        >
          {isAuto ? 'AUTO' : 'KANBAN'}
        </span>
        <span className="text-[10px] text-slate-600">{task.projectType || 'general'}</span>
      </div>
      <h3 className="mb-3 text-sm font-medium text-slate-200 line-clamp-2" style={{ minHeight: '2.5em' }}>
        {task.title}
      </h3>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: color, boxShadow: pct > 0 ? `0 0 4px ${hexToRgba(color, 0.5)}` : 'none' }}
          />
        </div>
        <span className="text-[10px] font-semibold tabular-nums" style={{ color: pct === 100 ? G : color }}>
          {pct}%
        </span>
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

/* ─── Stat Pill ─── */
function StatPill({ icon: Icon, value, label, color }: {
  icon: typeof FolderKanban; value: number; label: string; color: string;
}) {
  const [h, setH] = useState(false);
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      className="flex items-center gap-3 p-4"
      style={{
        borderRadius: '10px',
        background: h ? `linear-gradient(135deg, ${hexToRgba(color, 0.12)}, rgba(16,20,30,0.9))` : `linear-gradient(135deg, ${hexToRgba(color, 0.06)}, rgba(14,18,28,0.8))`,
        border: `1px solid ${h ? hexToRgba(color, 0.4) : hexToRgba(color, 0.18)}`,
        boxShadow: h ? `0 0 16px ${hexToRgba(color, 0.12)}` : 'none',
        transition: 'all 200ms',
      }}
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ background: hexToRgba(color, 0.1), border: `1px solid ${hexToRgba(color, 0.2)}` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <p className="text-xl font-bold tabular-nums text-slate-100">{value}</p>
        <p className="text-[10px] text-slate-500">{label}</p>
      </div>
    </div>
  );
}

/* ─── Section header ─── */
function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-sm font-bold tracking-wide text-slate-200">{title}</h2>
      {action}
    </div>
  );
}

/* ─── Create Card ("+") ─── */
function CreateCard({ onClick, label }: { onClick: () => void; label: string }) {
  const [h, setH] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      className="group relative flex flex-col items-center justify-center"
      style={{
        minHeight: '180px',
        borderRadius: '10px',
        background: h ? 'rgba(252,238,10,0.08)' : 'rgba(10,14,22,0.5)',
        border: `1px dashed ${h ? 'rgba(252,238,10,0.6)' : 'rgba(252,238,10,0.3)'}`,
        boxShadow: h ? `0 0 24px ${hexToRgba(Y, 0.15)}` : 'none',
        transition: 'all 220ms cubic-bezier(0.4,0,0.2,1)',
        cursor: 'pointer',
      }}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{
          background: h ? hexToRgba(Y, 0.15) : hexToRgba(Y, 0.08),
          border: `1px solid ${h ? hexToRgba(Y, 0.5) : hexToRgba(Y, 0.3)}`,
          transition: 'all 220ms',
          transform: h ? 'scale(1.1)' : 'scale(1)',
          boxShadow: h ? `0 0 16px ${hexToRgba(Y, 0.4)}` : `0 0 6px ${hexToRgba(Y, 0.15)}`,
        }}
      >
        <Plus
          className="w-8 h-8"
          style={{
            color: Y,
            filter: h ? `drop-shadow(0 0 4px ${Y})` : 'none',
            transition: 'all 220ms',
          }}
        />
      </div>
      <span
        className="mt-3 text-[11px] font-semibold uppercase tracking-wider transition-colors"
        style={{ color: h ? Y : '#94a3b8' }}
      >
        {label}
      </span>
    </button>
  );
}

/* ─── Quick Access Card ─── */
function QuickAccessCard({ item, onClick, onUnstar }: {
  item: ModalItem; onClick: () => void; onUnstar: () => void;
}) {
  const [h, setH] = useState(false);
  const t = typeMeta[item.type] || typeMeta.general;
  const Icon = t.icon;
  const sc = stHex[item.status] || '#64748b';
  const sl = stLabel[item.status] || item.status;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      className="group w-56 shrink-0 cursor-pointer p-3"
      style={{
        borderRadius: '10px',
        background: h ? `linear-gradient(135deg, ${hexToRgba(t.color, 0.14)}, rgba(16,20,30,0.95))` : `linear-gradient(135deg, ${hexToRgba(t.color, 0.08)}, rgba(14,18,28,0.85))`,
        border: `1px solid ${h ? hexToRgba(t.color, 0.5) : hexToRgba(t.color, 0.2)}`,
        boxShadow: h ? `0 6px 24px ${hexToRgba(t.color, 0.15)}` : 'none',
        transition: 'all 220ms cubic-bezier(0.4,0,0.2,1)',
        transform: h ? 'translateY(-2px)' : 'none',
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md"
          style={{ background: hexToRgba(t.color, 0.1), border: `1px solid ${hexToRgba(t.color, 0.25)}` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: t.color }} />
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onUnstar(); }}
          className="p-1 rounded transition-all hover:bg-white/[0.08]"
          style={{ color: Y }}
          title="Убрать из быстрого доступа"
        >
          <Star className="w-3.5 h-3.5" style={{ color: Y, fill: Y }} />
        </button>
      </div>
      <p className="text-sm font-medium text-slate-200 line-clamp-1">{item.title}</p>
      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc }} />
          {sl}
        </span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <Music2 className="w-3 h-3" />
          {item.trackCount}
        </span>
      </div>
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
  quickAccess: Set<string>;
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
              const starred = quickAccess.has(item.id);
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
  const [quickAccess, setQuickAccess] = useState<Set<string>>(new Set());

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
      if (raw) setQuickAccess(new Set(JSON.parse(raw) as string[]));
    } catch { /* ignore */ }
  }, []);

  const goToKanban = (id: string) => { if (id) { navigate('kanban'); setTimeout(() => useKanbanStore.getState().selectProject(id), 220); } };
  const toggleFolder = (k: string) => setExpandedFolders(p => ({ ...p, [k]: !p[k] }));

  const toggleQuickAccess = (id: string) => {
    setQuickAccess(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem('soundflow-quick-access', JSON.stringify([...next])); } catch { /* ignore */ }
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

  const quickAccessItems: ModalItem[] = useMemo(
    () => [...autoModalItems, ...kanbanModalItems].filter(it => quickAccess.has(it.id)),
    [autoModalItems, kanbanModalItems, quickAccess],
  );

  const stats = [
    { icon: FolderKanban, value: projects.length, label: 'Проекты', color: Y },
    { icon: Music2, value: tracks.length, label: 'Треки', color: C },
    { icon: Lightbulb, value: ideas.length, label: 'Идеи', color: A },
    { icon: Users, value: memberCount, label: 'Участники', color: G },
  ];

  return (
    <div className="min-h-full bg-[#06080d]">
      <div className="mx-auto max-w-6xl px-5 py-6 lg:px-8 lg:py-8">
        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <h1 className="text-xl font-bold text-slate-100 lg:text-2xl">
            Привет, {user?.displayName || 'музыкант'}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {currentGroup?.name || 'SoundFlow'}{currentGroup?.genre ? ` · ${currentGroup.genre}` : ''}
          </p>
        </motion.div>

        {/* ── Stats ── */}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map(s => <StatPill key={s.label} {...s} />)}
        </div>

        {/* ── Quick Access ── */}
        {quickAccessItems.length > 0 && (
          <section className="mt-8">
            <SectionHeader
              title="Быстрый доступ"
              action={
                <span className="flex items-center gap-1 text-[11px] font-medium text-slate-600">
                  <Star className="w-3 h-3" style={{ color: Y, fill: Y }} />
                  {quickAccessItems.length}
                </span>
              }
            />
            <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
              {quickAccessItems.map(item => (
                <QuickAccessCard
                  key={item.id}
                  item={item}
                  onClick={item.onOpen}
                  onUnstar={() => toggleQuickAccess(item.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Auto Projects ── */}
        <section className="mt-8">
          <SectionHeader
            title="Авто проекты"
            action={
              <button onClick={() => setAllAutoOpen(true)} className="flex items-center gap-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-yellow-400">
                Все <ArrowRight className="w-3 h-3" />
              </button>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CreateCard onClick={() => setCreateProjectOpen(true)} label="Создать" />
            {autoProjects.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                trackCount={getTrackCount(p.id)}
                onClick={() => navigate('project-detail', p.id)}
                onKanban={() => p.kanbanTaskId && goToKanban(p.kanbanTaskId)}
              />
            ))}
          </div>
        </section>

        {/* ── Kanban Projects ── */}
        <section className="mt-8">
          <SectionHeader
            title="Канбан проекты"
            action={
              <button onClick={() => setAllKanbanOpen(true)} className="flex items-center gap-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-cyan-400">
                Все <ArrowRight className="w-3 h-3" />
              </button>
            }
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CreateCard onClick={() => navigate('kanban')} label="Создать" />
            {kanbanProjects.map(task => (
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
