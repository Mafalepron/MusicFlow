'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import {
  Plus, FolderOpen, FolderInput, LayoutDashboard, Music2, Disc3, AudioLines, Clock,
  Search, X, Layers, Star, ChevronDown, Check, Trash2, FolderPlus,
} from 'lucide-react';
import { useNavigationStore, useDataStore, useAuthStore, type Project, type Folder } from '@/lib/store';
import { useKanbanStore, type Task } from '@/store/kanban-store';
import { CreateProjectDialog } from '@/components/shared/create-project-dialog';
import { hexToRgba } from '@/lib/utils';
import { useFavorites } from '@/lib/use-favorites';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

const statusHex: Record<string, string> = {
  in_progress: '#3b82f6',
  mixing: '#a855f7',
  mastering: '#00d9ff',
  released: '#10b981',
};

const statusLabels: Record<string, string> = {
  in_progress: 'В работе',
  mixing: 'Сведение',
  mastering: 'Мастеринг',
  released: 'Релиз',
};

const typeConfig: Record<string, { label: string; color: string; icon: typeof Disc3 }> = {
  album:   { label: 'Альбом',  color: '#a855f7', icon: Disc3 },
  ep:      { label: 'EP',      color: '#00d9ff', icon: AudioLines },
  single:  { label: 'Сингл',   color: '#f59e0b', icon: Music2 },
  general: { label: 'Стандартный Канбан',  color: '#10b981', icon: LayoutDashboard },
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
} as const;

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
} as const;

// ── Unified card for both auto projects and kanban projects ──
// `kind` distinguishes the source so we render the right badge + open the right view.
type UnifiedCard =
  | { kind: 'auto'; project: Project; trackCount: number }
  | { kind: 'kanban'; task: Task; boardCount: number };

// Helper: get the underlying SoundFlow project ID for a card (used when PATCHing folderId)
function getCardProjectId(card: UnifiedCard): string | null {
  if (card.kind === 'auto') return card.project.id;
  return null; // kanban-only projects don't have a SoundFlow Project record
}

// Helper: get the current folderId for a card
function getCardFolderId(card: UnifiedCard): string | null {
  if (card.kind === 'auto') return card.project.folderId ?? null;
  return null;
}

function ProjectCardUnified({
  data,
  onClick,
  onOpenKanban,
  isFavorite,
  onToggleFavorite,
  folders,
  onMoveToFolder,
}: {
  data: UnifiedCard;
  onClick: () => void;
  onOpenKanban: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  folders: Folder[];
  onMoveToFolder: (folderId: string | null) => void;
}) {
  const [h, setH] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

  const title = data.kind === 'auto' ? data.project.title : data.task.title;
  const projectType = data.kind === 'auto' ? data.project.type : (data.task.projectType || 'general');
  const type = typeConfig[projectType] || typeConfig.general;
  const TypeIcon = type.icon;
  const status = data.kind === 'auto' ? data.project.status : data.task.status;
  const sc = statusHex[status] || '#64748b';
  const sl = statusLabels[status] || status;
  const updatedAt = data.kind === 'auto' ? data.project.updatedAt : data.task.updatedAt;
  const metaCount = data.kind === 'auto' ? data.trackCount : data.boardCount;
  const metaLabel = data.kind === 'auto'
    ? (metaCount === 1 ? 'трек' : metaCount > 4 ? 'треков' : 'трека')
    : (metaCount === 1 ? 'board' : 'boards');
  const hasKanban = data.kind === 'auto' ? !!data.project.kanbanTaskId : true;

  // Move-to-folder only applies to auto projects (kanban-only projects have no SoundFlow record)
  const canMoveFolder = data.kind === 'auto';
  const currentFolderId = getCardFolderId(data);

  return (
    <motion.div variants={cardVariants}>
      <div
        onClick={onClick}
        onMouseEnter={() => setH(true)}
        onMouseLeave={() => setH(false)}
        className="group relative cursor-pointer overflow-hidden"
        style={{
          borderRadius: '10px',
          background: h
            ? `linear-gradient(135deg, ${hexToRgba(type.color, 0.18)}, rgba(16,20,30,0.95))`
            : `linear-gradient(135deg, ${hexToRgba(type.color, 0.1)}, rgba(14,18,28,0.85))`,
          border: `1px solid ${h ? hexToRgba(type.color, 0.6) : hexToRgba(type.color, 0.3)}`,
          boxShadow: h
            ? `0 0 0 1px ${hexToRgba(type.color, 0.3)}, 0 8px 32px ${hexToRgba(type.color, 0.2)}, 0 4px 16px rgba(0,0,0,0.4)`
            : `0 0 0 1px ${hexToRgba(type.color, 0.08)}, 0 4px 12px rgba(0,0,0,0.3)`,
          transform: h ? 'translateY(-4px) scale(1.01)' : 'translateY(0)',
          transition: 'all 220ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Cover strip */}
        <div
          className="h-16 flex items-center justify-between px-4"
          style={{
            background: `linear-gradient(135deg, ${hexToRgba(type.color, h ? 0.3 : 0.18)}, ${hexToRgba(type.color, h ? 0.08 : 0.04)})`,
            borderBottom: `1px solid ${hexToRgba(type.color, 0.1)}`,
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: hexToRgba(type.color, 0.15), border: `1px solid ${hexToRgba(type.color, 0.3)}` }}
            >
              <TypeIcon className="w-4 h-4" style={{ color: type.color }} />
            </div>
            <span className="text-[11px] font-semibold" style={{ color: type.color }}>{type.label}</span>
            {/* Source badge — AUTO vs KANBAN */}
            <span
              className="ml-1 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider"
              style={{
                background: data.kind === 'auto' ? hexToRgba('#00d9ff', 0.1) : hexToRgba('#10b981', 0.1),
                color: data.kind === 'auto' ? '#00d9ff' : '#10b981',
                border: `1px solid ${data.kind === 'auto' ? hexToRgba('#00d9ff', 0.3) : hexToRgba('#10b981', 0.3)}`,
              }}
            >
              {data.kind === 'auto' ? 'AUTO' : 'KANBAN'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
              style={{ background: hexToRgba(sc, 0.12), color: sc, border: `1px solid ${hexToRgba(sc, 0.25)}` }}
            >
              {sl}
            </span>

            {/* Move-to-folder popover — only on auto projects */}
            {canMoveFolder && (
              <Popover open={moveOpen} onOpenChange={setMoveOpen}>
                <PopoverTrigger asChild>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMoveOpen(true); }}
                    aria-label="Переместить в папку"
                    title="Переместить в папку"
                    className="flex h-7 w-7 items-center justify-center transition-all duration-200"
                    style={{
                      clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))',
                      background: currentFolderId
                        ? 'linear-gradient(135deg, rgba(252,238,10,0.18), rgba(241,241,0,0.1))'
                        : 'rgba(10,20,35,0.6)',
                      border: currentFolderId
                        ? '1px solid rgba(252,238,10,0.6)'
                        : '1px solid rgba(252,238,10,0.3)',
                      boxShadow: currentFolderId ? '0 0 8px rgba(252,238,10,0.25)' : 'none',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(252,238,10,0.7)';
                      e.currentTarget.style.boxShadow = '0 0 8px rgba(252,238,10,0.3)';
                    }}
                    onMouseLeave={(e) => {
                      if (!currentFolderId) {
                        e.currentTarget.style.borderColor = 'rgba(252,238,10,0.3)';
                        e.currentTarget.style.boxShadow = 'none';
                      } else {
                        e.currentTarget.style.borderColor = 'rgba(252,238,10,0.6)';
                        e.currentTarget.style.boxShadow = '0 0 8px rgba(252,238,10,0.25)';
                      }
                    }}
                  >
                    <FolderInput
                      className="w-3.5 h-3.5"
                      style={{ color: currentFolderId ? '#FCEE0A' : 'rgba(252,238,10,0.7)' }}
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  sideOffset={4}
                  className="w-56 p-1 border rounded-md"
                  style={{
                    background: '#0a0d14',
                    borderColor: 'rgba(252,238,10,0.25)',
                    boxShadow: '0 0 20px rgba(252,238,10,0.12), 0 8px 24px rgba(0,0,0,0.6)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider"
                    style={{ color: 'rgba(252,238,10,0.7)', fontFamily: 'var(--font-jetbrains-mono), monospace, ui-monospace, monospace' }}
                  >
                    Переместить в папку
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveToFolder(null);
                      setMoveOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors hover:bg-white/[0.04]"
                    style={{
                      background: currentFolderId === null ? 'rgba(252,238,10,0.08)' : 'transparent',
                    }}
                  >
                    <FolderOpen className="w-3.5 h-3.5" style={{ color: 'rgba(252,238,10,0.7)' }} />
                    <span className="text-xs text-slate-200 flex-1">Без папки</span>
                    {currentFolderId === null && (
                      <Check className="w-3.5 h-3.5 text-[#FCEE0A]" />
                    )}
                  </button>
                  {folders.length === 0 ? (
                    <div className="px-2 py-2 text-[11px] text-slate-500">
                      Нет папок. Создайте папку кнопкой «Новая папка».
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                      {folders.map((f) => {
                        const active = currentFolderId === f.id;
                        return (
                          <button
                            key={f.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onMoveToFolder(f.id);
                              setMoveOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors hover:bg-white/[0.04]"
                            style={{
                              background: active ? 'rgba(252,238,10,0.08)' : 'transparent',
                            }}
                          >
                            <FolderOpen className="w-3.5 h-3.5" style={{ color: active ? '#FCEE0A' : 'rgba(252,238,10,0.7)' }} />
                            <span className="text-xs text-slate-200 flex-1 truncate">{f.title}</span>
                            {active && <Check className="w-3.5 h-3.5 text-[#FCEE0A]" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            )}

            {/* Favorite star toggle — adds/removes from quick-access */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
              aria-label={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
              title={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
              className="flex h-7 w-7 items-center justify-center transition-all duration-200"
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
                className="w-3.5 h-3.5"
                style={{
                  color: isFavorite ? '#000' : 'rgba(252,238,10,0.7)',
                  fill: isFavorite ? '#000' : 'none',
                }}
              />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          <h3
            className="mb-2 text-[15px] font-semibold leading-snug transition-colors"
            style={{ color: h ? type.color : '#e2e8f0' }}
          >
            {title}
          </h3>

          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              {data.kind === 'auto' ? (
                <>
                  <Music2 className="w-3 h-3" />
                  {metaCount} {metaLabel}
                </>
              ) : (
                <>
                  <Layers className="w-3 h-3" />
                  {metaCount} {metaLabel}
                </>
              )}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
            </span>
          </div>

          {hasKanban && (
            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${hexToRgba(type.color, 0.1)}` }}>
              <button
                onClick={(e) => { e.stopPropagation(); onOpenKanban(); }}
                className="flex items-center gap-1.5 text-[11px] font-medium transition-colors"
                style={{ color: h ? '#FCEE0A' : '#00d9ff' }}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                Открыть Kanban
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Folder section component ──
function FolderSection({
  folder,
  cards,
  folders,
  tracks,
  isFavorite,
  toggleFavorite,
  onOpenProject,
  onOpenKanban,
  onMoveProject,
  onRename,
  onDelete,
  defaultExpanded,
}: {
  folder: Folder;
  cards: UnifiedCard[];
  folders: Folder[];
  tracks: ReturnType<typeof useDataStore.getState>['tracks'];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  onOpenProject: (project: Project) => void;
  onOpenKanban: (kanbanTaskId: string) => void;
  onMoveProject: (projectId: string, folderId: string | null) => void;
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const getTrackCount = (projectId: string) =>
    tracks.filter((t) => t.projectId === projectId).length;

  return (
    <div
      className="overflow-hidden"
      style={{
        borderRadius: '10px',
        background: 'linear-gradient(135deg, rgba(252,238,10,0.04) 0%, rgba(14,18,28,0.55) 60%)',
        border: `1px solid ${expanded ? 'rgba(252,238,10,0.4)' : 'rgba(252,238,10,0.22)'}`,
        boxShadow: expanded
          ? '0 0 0 1px rgba(252,238,10,0.08), 0 6px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)'
          : '0 0 0 1px rgba(252,238,10,0.05), 0 4px 12px rgba(0,0,0,0.25)',
        transition: 'all 220ms cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Header (clickable to toggle expand) */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]"
        style={{ cursor: 'pointer', background: 'transparent', border: 'none' }}
      >
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center"
          style={{
            clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))',
            background: 'linear-gradient(135deg, rgba(252,238,10,0.18), rgba(241,241,0,0.1))',
            border: '1px solid rgba(252,238,10,0.45)',
            boxShadow: '0 0 8px rgba(252,238,10,0.2)',
          }}
        >
          <FolderOpen className="w-3.5 h-3.5" style={{ color: '#FCEE0A' }} />
        </div>

        {renaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && renameValue.trim()) {
                onRename(folder.id, renameValue.trim());
                setRenaming(false);
              } else if (e.key === 'Escape') {
                setRenameValue(folder.title);
                setRenaming(false);
              }
            }}
            className="flex-1 bg-transparent text-sm font-semibold text-slate-100 outline-none border-b border-[#FCEE0A]/50"
            style={{ fontFamily: 'inherit' }}
          />
        ) : (
          <h3 className="flex-1 text-left text-sm font-semibold text-slate-100 truncate">
            {folder.title}
          </h3>
        )}

        {/* Count badge */}
        <span
          className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider tabular-nums"
          style={{
            background: 'rgba(252,238,10,0.08)',
            color: '#FCEE0A',
            border: '1px solid rgba(252,238,10,0.25)',
          }}
        >
          {cards.length} {cards.length === 1 ? 'проект' : cards.length > 4 ? 'проектов' : 'проекта'}
        </span>

        {/* Rename / delete actions (stop propagation so they don't toggle expand) */}
        {renaming ? (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (renameValue.trim()) {
                  onRename(folder.id, renameValue.trim());
                  setRenaming(false);
                }
              }}
              className="flex h-6 w-6 items-center justify-center text-[#FCEE0A] hover:bg-white/[0.06] rounded transition-colors"
              aria-label="Сохранить название"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRenameValue(folder.title);
                setRenaming(false);
              }}
              className="flex h-6 w-6 items-center justify-center text-slate-400 hover:bg-white/[0.06] rounded transition-colors"
              aria-label="Отмена"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : confirmingDelete ? (
          <>
            <span className="text-[10px] text-slate-400 mr-1">Удалить?</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(folder.id);
                setConfirmingDelete(false);
              }}
              className="flex h-6 px-2 items-center justify-center rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
              style={{
                background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                color: '#fff',
                border: '1px solid rgba(239,68,68,0.6)',
                cursor: 'pointer',
              }}
            >
              Да
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmingDelete(false);
              }}
              className="flex h-6 px-2 items-center justify-center rounded text-[10px] font-bold uppercase tracking-wider transition-colors hover:bg-white/[0.06]"
              style={{
                background: 'rgba(30, 35, 50, 0.6)',
                color: '#94a3b8',
                border: '1px solid rgba(100,116,139,0.2)',
                cursor: 'pointer',
              }}
            >
              Нет
            </button>
          </>
        ) : (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRenameValue(folder.title);
                setRenaming(true);
              }}
              className="flex h-6 w-6 items-center justify-center text-slate-400 hover:text-[#FCEE0A] hover:bg-white/[0.06] rounded transition-colors"
              aria-label="Переименовать"
              title="Переименовать"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <FolderInput className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmingDelete(true);
              }}
              className="flex h-6 w-6 items-center justify-center text-slate-400 hover:text-red-400 hover:bg-white/[0.06] rounded transition-colors"
              aria-label="Удалить папку"
              title="Удалить папку"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}

        {/* Expand chevron */}
        <ChevronDown
          className="w-4 h-4 text-slate-400 transition-transform duration-200"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {/* Body (cards grid) */}
      {expanded && (
        <div className="px-4 pb-4 pt-1">
          {cards.length > 0 ? (
            <motion.div
              key={`folder-${folder.id}`}
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
            >
              {cards.map((card) => {
                const cardId = card.kind === 'auto'
                  ? (card.project.kanbanTaskId || card.project.id)
                  : card.task.id;
                const trackCount = card.kind === 'auto'
                  ? getTrackCount(card.project.id)
                  : card.boardCount;
                return (
                  <ProjectCardUnified
                    key={card.kind === 'auto' ? `auto-${card.project.id}` : `kanban-${card.task.id}`}
                    data={card.kind === 'auto'
                      ? { kind: 'auto', project: card.project, trackCount }
                      : { kind: 'kanban', task: card.task, boardCount: card.boardCount }}
                    onClick={() => {
                      if (card.kind === 'auto') {
                        onOpenProject(card.project);
                      } else {
                        onOpenKanban(card.task.id);
                      }
                    }}
                    onOpenKanban={() => {
                      if (card.kind === 'auto' && card.project.kanbanTaskId) {
                        onOpenKanban(card.project.kanbanTaskId);
                      } else if (card.kind === 'kanban') {
                        onOpenKanban(card.task.id);
                      }
                    }}
                    isFavorite={isFavorite(cardId)}
                    onToggleFavorite={() => toggleFavorite(cardId)}
                    folders={folders}
                    onMoveToFolder={(folderId) => {
                      const pid = getCardProjectId(card);
                      if (pid) onMoveProject(pid, folderId);
                    }}
                  />
                );
              })}
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <p className="text-xs text-slate-500">
                В папке нет проектов. Переместите сюда проект кнопкой{' '}
                <FolderInput className="inline-block w-3 h-3 -mt-0.5" style={{ color: 'rgba(252,238,10,0.6)' }} />{' '}
                на карточке.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type SectionFilter = 'all' | 'auto' | 'kanban';

export function ProjectsView() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('all');
  const [kanbanProjects, setKanbanProjects] = useState<Task[]>([]);

  // Folder management local UI state
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const navigate = useNavigationStore((s) => s.navigate);
  const projects = useDataStore((s) => s.projects);
  const folders = useDataStore((s) => s.folders);
  const setFolders = useDataStore((s) => s.setFolders);
  const addFolder = useDataStore((s) => s.addFolder);
  const updateFolder = useDataStore((s) => s.updateFolder);
  const removeFolder = useDataStore((s) => s.removeFolder);
  const updateProjectFolder = useDataStore((s) => s.updateProjectFolder);
  const tracks = useDataStore((s) => s.tracks);
  const currentGroupId = useAuthStore((s) => s.currentGroupId);
  const { isFavorite, toggleFavorite } = useFavorites();

  const getTrackCount = (projectId: string) =>
    tracks.filter((t) => t.projectId === projectId).length;

  // Fetch kanban projects (top-level tasks with no parentId).
  useEffect(() => {
    fetch('/api/tasks?parentId=null')
      .then((r) => r.json())
      .then((data) => {
        const tasks: Task[] = Array.isArray(data) ? data : data.tasks || [];
        setKanbanProjects(tasks);
        useKanbanStore.getState().setProjects(tasks);
      })
      .catch(() => {});
  }, []);

  // Fetch folders for the current group.
  useEffect(() => {
    if (!currentGroupId) return;
    fetch(`/api/folders?groupId=${currentGroupId}`)
      .then((r) => r.json())
      .then((data: (Folder & { projects?: Project[] })[]) => {
        setFolders(data.map((f) => ({
          id: f.id,
          groupId: f.groupId,
          title: f.title,
          sortOrder: f.sortOrder,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
        })));
        // Sync project.folderId from the server response (folders include their projects).
        // This ensures the local `projects` array reflects the latest folder assignments.
        const folderProjectIds: Record<string, string> = {}; // projectId -> folderId
        data.forEach((f) => {
          (f.projects || []).forEach((p) => {
            folderProjectIds[p.id] = f.id;
          });
        });
        // Update the projects in the store to match server-truth
        const fresh = useDataStore.getState().projects.map((p) => {
          const fid = folderProjectIds[p.id] ?? null;
          if ((p.folderId ?? null) !== (fid ?? null)) {
            return { ...p, folderId: fid };
          }
          return p;
        });
        useDataStore.getState().setProjects(fresh);
      })
      .catch(() => {});
  }, [currentGroupId, setFolders]);

  // Auto projects = projects with a linked kanbanTaskId (i.e. created via the
  // "auto" flow — album/EP/single with auto-generated kanban boards).
  const autoProjects = useMemo(() => projects.filter((p) => p.kanbanTaskId), [projects]);

  // Build a unified list of cards, applying the section filter + title search.
  const allCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const out: UnifiedCard[] = [];

    if (sectionFilter === 'all' || sectionFilter === 'auto') {
      autoProjects.forEach((p) => {
        if (q && !p.title.toLowerCase().includes(q)) return;
        out.push({ kind: 'auto', project: p, trackCount: getTrackCount(p.id) });
      });
    }

    if (sectionFilter === 'all' || sectionFilter === 'kanban') {
      // Deduplicate: skip kanban tasks that are already linked to an auto project.
      const linkedKanbanIds = new Set(autoProjects.map((p) => p.kanbanTaskId));
      kanbanProjects.forEach((t) => {
        if (linkedKanbanIds.has(t.id)) return;
        if (q && !t.title.toLowerCase().includes(q)) return;
        out.push({ kind: 'kanban', task: t, boardCount: t.children?.length ?? 0 });
      });
    }

    return out;
  }, [autoProjects, kanbanProjects, sectionFilter, searchQuery, tracks, getTrackCount]);

  // Sort folders by sortOrder for stable display.
  const sortedFolders = useMemo(
    () => [...folders].sort((a, b) => a.sortOrder - b.sortOrder),
    [folders]
  );

  // Group the cards by folderId (null = unassigned / main grid).
  const cardsByFolder = useMemo(() => {
    const map = new Map<string | null, UnifiedCard[]>();
    for (const card of allCards) {
      const fid = getCardFolderId(card);
      const key = fid ?? null;
      const arr = map.get(key) || [];
      arr.push(card);
      map.set(key, arr);
    }
    return map;
  }, [allCards]);

  const unassignedCards = cardsByFolder.get(null) || [];

  const handleOpenKanban = (kanbanTaskId: string) => {
    // Select the project FIRST so KanbanPage doesn't redirect to Projects
    useKanbanStore.getState().selectProject(kanbanTaskId);
    navigate('kanban');
  };

  // ── Folder CRUD handlers ──
  const handleCreateFolder = async () => {
    const title = newFolderName.trim();
    if (!title || !currentGroupId) return;
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: currentGroupId, title }),
      });
      if (!res.ok) return;
      const folder: Folder & { projects?: Project[] } = await res.json();
      addFolder({
        id: folder.id,
        groupId: folder.groupId,
        title: folder.title,
        sortOrder: folder.sortOrder,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
      });
      setNewFolderName('');
      setCreatingFolder(false);
    } catch {
      /* ignore */
    }
  };

  const handleRenameFolder = async (id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    // Optimistic update
    updateFolder(id, { title: trimmed });
    try {
      await fetch(`/api/folders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
    } catch {
      /* revert would require re-fetch; ignore for now */
    }
  };

  const handleDeleteFolder = async (id: string) => {
    // Optimistic: remove folder + null out folderId for any projects in it
    const folderProjects = projects.filter((p) => p.folderId === id);
    removeFolder(id);
    folderProjects.forEach((p) => updateProjectFolder(p.id, null));
    try {
      await fetch(`/api/folders/${id}`, { method: 'DELETE' });
    } catch {
      /* ignore */
    }
  };

  // ── Move project to folder ──
  const handleMoveProject = async (projectId: string, folderId: string | null) => {
    // Optimistic update of local store
    updateProjectFolder(projectId, folderId);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      });
    } catch {
      /* ignore */
    }
  };

  // Total card count for the header summary line.
  const totalCount = allCards.length;

  const sectionFilters: { value: SectionFilter; label: string; count: number }[] = [
    { value: 'all', label: 'Все', count: autoProjects.length + kanbanProjects.filter((t) => !autoProjects.some((p) => p.kanbanTaskId === t.id)).length },
    { value: 'auto', label: 'Автопроекты', count: autoProjects.length },
    { value: 'kanban', label: 'Стандартный Канбан', count: kanbanProjects.filter((t) => !autoProjects.some((p) => p.kanbanTaskId === t.id)).length },
  ];

  // Shared yellow button style for the "Новая папка" + "Новый проект" buttons.
  const yellowButtonStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    padding: '8px 18px',
    color: '#000',
    background: 'linear-gradient(135deg, #FCEE0A, #F1F100 50%, #FCEE0A)',
    border: '1.5px solid rgba(252, 238, 10, 0.9)',
    clipPath: 'polygon(0 0, calc(100% - 7px) 0, 100% 7px, 100% 100%, 7px 100%, 0 calc(100% - 7px))',
    boxShadow: '0 0 14px rgba(252,238,10,0.4), 0 0 28px rgba(252,238,10,0.15), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
    cursor: 'pointer',
    textShadow: '0 1px 0 rgba(255,255,255,0.3)',
    ...extra,
  });

  const yellowButtonHover = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;
    el.style.color = '#FCEE0A';
    el.style.border = '1.5px solid #FCEE0A';
    el.style.boxShadow = '0 0 0 1px rgba(252, 238, 10, 0.4), 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 20px rgba(252, 238, 10, 0.15)';
    el.style.textShadow = '0 0 8px rgba(252, 238, 10, 0.8), 0 1px 0 rgba(255,255,255,0.3)';
    el.style.transform = 'translateY(-1px)';
  };
  const yellowButtonLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;
    el.style.color = '#000';
    el.style.border = '1.5px solid rgba(252, 238, 10, 0.9)';
    el.style.boxShadow = '0 0 14px rgba(252,238,10,0.4), 0 0 28px rgba(252,238,10,0.15), inset 0 1px 0 rgba(255, 255, 255, 0.4)';
    el.style.textShadow = '0 1px 0 rgba(255,255,255,0.3)';
    el.style.transform = 'translateY(0)';
  };

  const hasFolders = sortedFolders.length > 0;
  const hasAnyCards = totalCount > 0 || hasFolders;

  return (
    <div className="min-h-full bg-[#06080d]">
      <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Проекты</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Автопроекты и Канбан-проекты · {totalCount} {totalCount === 1 ? 'проект' : totalCount > 4 ? 'проектов' : 'проекта'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCreatingFolder(true)}
              className="flex items-center gap-1.5 transition-all duration-200"
              style={yellowButtonStyle({ padding: '8px 14px' })}
              onMouseEnter={yellowButtonHover}
              onMouseLeave={yellowButtonLeave}
            >
              <FolderPlus className="w-3 h-3" />
              <span>Новая папка</span>
            </button>
            <button
              onClick={() => setDialogOpen(true)}
              className="flex items-center gap-1.5 transition-all duration-200"
              style={yellowButtonStyle()}
              onMouseEnter={yellowButtonHover}
              onMouseLeave={yellowButtonLeave}
            >
              <Plus className="w-3 h-3" />
              <span>Новый проект</span>
            </button>
          </div>
        </div>

        {/* Inline new-folder input */}
        {creatingFolder && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 px-4 py-3 rounded-lg"
            style={{
              background: 'linear-gradient(135deg, rgba(252,238,10,0.06), rgba(14,18,28,0.6))',
              border: '1px solid rgba(252,238,10,0.3)',
              boxShadow: '0 0 12px rgba(252,238,10,0.1), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <FolderOpen className="w-4 h-4 text-[#FCEE0A] shrink-0" />
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                else if (e.key === 'Escape') {
                  setNewFolderName('');
                  setCreatingFolder(false);
                }
              }}
              placeholder="Название папки…"
              className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none border-b border-[#FCEE0A]/40"
              style={{ fontFamily: 'inherit' }}
            />
            <button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim()}
              className="flex items-center gap-1.5 transition-all duration-200 disabled:opacity-40"
              style={{
                ...yellowButtonStyle({ padding: '6px 12px', fontSize: '9px' }),
                cursor: newFolderName.trim() ? 'pointer' : 'not-allowed',
              }}
              onMouseEnter={yellowButtonHover}
              onMouseLeave={yellowButtonLeave}
            >
              <Check className="w-3 h-3" />
              <span>Создать</span>
            </button>
            <button
              onClick={() => {
                setNewFolderName('');
                setCreatingFolder(false);
              }}
              className="flex h-7 w-7 items-center justify-center text-slate-400 hover:text-slate-200 transition-colors"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
              aria-label="Отмена"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}

        {/* ── Toolbar: section filter + search ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Section filter chips */}
          <div className="flex items-center gap-1.5">
            {sectionFilters.map((f) => {
              const active = sectionFilter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setSectionFilter(f.value)}
                  className="flex items-center gap-1.5 transition-all duration-200"
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    padding: '6px 12px',
                    color: active ? '#000' : '#94a3b8',
                    background: active
                      ? 'linear-gradient(135deg, #FCEE0A, #F1F100 50%, #FCEE0A)'
                      : 'rgba(30, 35, 50, 0.6)',
                    border: active
                      ? '1px solid rgba(252, 238, 10, 0.9)'
                      : '1px solid rgba(100, 116, 139, 0.2)',
                    clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))',
                    boxShadow: active
                      ? '0 0 10px rgba(252,238,10,0.4), inset 0 1px 0 rgba(255,255,255,0.4)'
                      : 'none',
                    cursor: 'pointer',
                  }}
                >
                  {f.label}
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[8px] tabular-nums"
                    style={{
                      background: active ? 'rgba(0,0,0,0.2)' : 'rgba(100,116,139,0.15)',
                      color: active ? '#000' : '#64748b',
                    }}
                  >
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search input */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию…"
              className="w-full pl-9 pr-8 py-2 text-xs text-slate-200 bg-[#0d1117] border border-slate-700/60 rounded-md outline-none transition-colors focus:border-[#FCEE0A]/50 focus:bg-[#0d1117]"
              style={{ fontFamily: 'inherit' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center text-slate-500 hover:text-slate-300 transition-colors"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                aria-label="Очистить поиск"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* ── Folder sections (each with its own cards grid) ── */}
        {sortedFolders.length > 0 && (
          <div className="space-y-4">
            {sortedFolders.map((folder) => {
              const folderCards = cardsByFolder.get(folder.id) || [];
              return (
                <FolderSection
                  key={folder.id}
                  folder={folder}
                  cards={folderCards}
                  folders={sortedFolders}
                  tracks={tracks}
                  isFavorite={isFavorite}
                  toggleFavorite={toggleFavorite}
                  onOpenProject={(p) => navigate('project-detail', p.id)}
                  onOpenKanban={handleOpenKanban}
                  onMoveProject={handleMoveProject}
                  onRename={handleRenameFolder}
                  onDelete={handleDeleteFolder}
                  defaultExpanded={true}
                />
              );
            })}
          </div>
        )}

        {/* ── Main grid (unassigned projects) ── */}
        <div>
          {/* Section divider — only when folders exist above */}
          {hasFolders && (
            <div className="flex items-center gap-3 mb-4">
              <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Без папки
              </span>
              <span className="rounded px-1.5 py-0.5 text-[9px] font-bold tabular-nums"
                style={{
                  background: 'rgba(100,116,139,0.1)',
                  color: '#64748b',
                  border: '1px solid rgba(100,116,139,0.2)',
                }}
              >
                {unassignedCards.length}
              </span>
              <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(100,116,139,0.25), transparent)' }} />
            </div>
          )}

          {unassignedCards.length > 0 ? (
            <motion.div
              key={`unassigned-${sectionFilter}-${searchQuery}`}
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
            >
              {unassignedCards.map((card) => {
                const cardId = card.kind === 'auto'
                  ? (card.project.kanbanTaskId || card.project.id)
                  : card.task.id;
                return (
                  <ProjectCardUnified
                    key={card.kind === 'auto' ? `auto-${card.project.id}` : `kanban-${card.task.id}`}
                    data={card}
                    onClick={() => {
                      if (card.kind === 'auto') {
                        navigate('project-detail', card.project.id);
                      } else {
                        handleOpenKanban(card.task.id);
                      }
                    }}
                    onOpenKanban={() => {
                      if (card.kind === 'auto' && card.project.kanbanTaskId) {
                        handleOpenKanban(card.project.kanbanTaskId);
                      } else if (card.kind === 'kanban') {
                        handleOpenKanban(card.task.id);
                      }
                    }}
                    isFavorite={isFavorite(cardId)}
                    onToggleFavorite={() => toggleFavorite(cardId)}
                    folders={sortedFolders}
                    onMoveToFolder={(folderId) => {
                      const pid = getCardProjectId(card);
                      if (pid) handleMoveProject(pid, folderId);
                    }}
                  />
                );
              })}
            </motion.div>
          ) : !hasAnyCards ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <div
                className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg"
                style={{ background: 'rgba(252,238,10,0.06)', border: '1px solid rgba(252,238,10,0.15)' }}
              >
                {searchQuery ? (
                  <Search className="h-6 w-6 text-slate-600" />
                ) : (
                  <FolderOpen className="h-6 w-6 text-slate-600" />
                )}
              </div>
              <h3 className="mb-1 text-sm font-medium text-slate-400">
                {searchQuery ? 'Ничего не найдено' : 'Пока нет проектов'}
              </h3>
              <p className="mb-4 text-xs text-slate-600">
                {searchQuery
                  ? `По запросу «${searchQuery}» ничего не найдено. Попробуйте изменить запрос.`
                  : 'Создайте первый проект, чтобы начать работу'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setDialogOpen(true)}
                  className="flex items-center gap-1.5 transition-all duration-200"
                  style={yellowButtonStyle()}
                  onMouseEnter={yellowButtonHover}
                  onMouseLeave={yellowButtonLeave}
                >
                  <Plus className="w-3 h-3" />
                  <span>Создать проект</span>
                </button>
              )}
            </motion.div>
          ) : null}
        </div>
      </div>

      <CreateProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
