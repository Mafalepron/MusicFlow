'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { useKanbanStore } from '@/store/kanban-store';
import { useHeaderActionsStore } from '@/store/header-actions-store';
import RadialBoard from '@/components/board/radial-board';
import TaskStrip from '@/components/board/task-strip';
import OnboardingHintPanel from '@/components/board/onboarding-hint-panel';
import TaskDetailPanel from '@/components/kanban/task-detail-panel';
import TrackWizard from '@/components/kanban/track-wizard';
import DescriptionBottomPanel from '@/components/kanban/description-bottom-panel';
import ProjectInfoModal from '@/components/kanban/project-info-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, RefreshCw, Hexagon, FolderOpen, ChevronRight, Trash2, Plus, Music, Disc3, Zap, AudioLines, Search, Pencil, LayoutGrid, Layers, Check, X, Clock } from 'lucide-react';
import { cn, hexToRgba } from '@/lib/utils';

type FilterType = 'all' | 'kanban' | 'music';

function ProjectList() {
  const { projects, setProjects, selectProject } = useKanbanStore();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tasks?parentId=null');
      const data = await res.json();
      setProjects(data.tasks);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadProjects(); }, [setProjects]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim(), isProject: true, projectType: 'general' }),
    });
    setNewTitle('');
    setCreating(false);
    await loadProjects();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
    setConfirmDeleteId(null);
    await loadProjects();
  };

  const handleRename = async (id: string) => {
    if (!editTitle.trim()) return;
    await fetch('/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title: editTitle.trim() }),
    });
    setEditingId(null);
    setEditTitle('');
    await loadProjects();
  };

  const startEdit = (e: React.MouseEvent, project: { id: string; title: string }) => {
    e.stopPropagation();
    setEditingId(project.id);
    setEditTitle(project.title);
  };

  // Compute stats
  const kanbanProjects = projects.filter(p => !p.soundflowProjectId);
  const musicProjects = projects.filter(p => p.soundflowProjectId);

  // Apply filter + search
  const filtered = projects.filter(p => {
    const isMusic = !!p.soundflowProjectId;
    if (filter === 'kanban' && isMusic) return false;
    if (filter === 'music' && !isMusic) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filters: { key: FilterType; label: string; count: number; icon: typeof Layers }[] = [
    { key: 'all', label: 'Все', count: projects.length, icon: LayoutGrid },
    { key: 'kanban', label: 'Канбаны', count: kanbanProjects.length, icon: Zap },
    { key: 'music', label: 'С треками', count: musicProjects.length, icon: Music },
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#06080d]">
      {/* Header */}
      <div className="px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Канбан-проекты</h2>
            <p className="mt-0.5 text-sm text-slate-500">Управление досками и задачами</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadProjects()}
              disabled={loading}
              className="flex items-center justify-center h-9 w-9 rounded-lg border border-white/[0.06] bg-white/[0.03] text-slate-500 transition-colors hover:text-slate-300 hover:border-white/10"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 transition-all duration-200"
              style={{
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
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.color = '#FCEE0A';
                el.style.border = '1.5px solid #FCEE0A';
                el.style.boxShadow = '0 0 0 1px rgba(252, 238, 10, 0.4), 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 20px rgba(252, 238, 10, 0.15)';
                el.style.textShadow = '0 0 8px rgba(252, 238, 10, 0.8), 0 1px 0 rgba(255,255,255,0.3)';
                el.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.color = '#000';
                el.style.border = '1.5px solid rgba(252, 238, 10, 0.9)';
                el.style.boxShadow = '0 0 14px rgba(252,238,10,0.4), 0 0 28px rgba(252,238,10,0.15), inset 0 1px 0 rgba(255, 255, 255, 0.4)';
                el.style.textShadow = '0 1px 0 rgba(255,255,255,0.3)';
                el.style.transform = 'translateY(0)';
              }}
            >
              <Plus className="w-3 h-3" />
              <span>Новый канбан</span>
            </button>
          </div>
        </div>

        {/* Filters + Search */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-1 border border-white/[0.06]">
            {filters.map(f => {
              const Icon = f.icon;
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200',
                    active ? 'bg-yellow-500/15 text-yellow-300' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]',
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {f.label}
                  <span className={cn('text-[9px] px-1 py-0 rounded-full', active ? 'bg-yellow-500/20 text-yellow-200' : 'bg-white/[0.06] text-slate-600')}>{f.count}</span>
                </button>
              );
            })}
          </div>
          <div className="relative flex-1 min-w-[140px] max-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск..."
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-yellow-500/30 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Inline create form */}
      {creating && (
        <div className="px-6 pb-3">
          <div className="flex gap-2 p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/[0.03]">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); if (e.key === 'Escape') { setCreating(false); setNewTitle(''); } }}
              placeholder="Название канбан-проекта..."
              autoFocus
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-yellow-500/40"
            />
            <button
              onClick={() => void handleCreate()}
              disabled={!newTitle.trim()}
              className="px-4 py-2 rounded-md text-xs font-bold bg-yellow-500 text-black disabled:opacity-30 transition-opacity"
            >
              Создать
            </button>
            <button onClick={() => { setCreating(false); setNewTitle(''); }} className="px-3 py-2 rounded-md text-xs text-slate-500 hover:text-slate-300">
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Project grid */}
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6 pt-2">
          {filtered.length === 0 && !loading && (
            <div className="col-span-full text-center py-16">
              <div className="inline-flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                  {search ? <Search className="w-6 h-6 text-slate-700" /> : <LayoutGrid className="w-6 h-6 text-slate-700" />}
                </div>
                <div>
                  <p className="text-slate-400 text-sm font-medium">
                    {search ? 'Ничего не найдено' : 'Канбан-проектов пока нет'}
                  </p>
                  <p className="text-slate-600 text-xs mt-1">
                    {search ? 'Попробуйте изменить запрос' : 'Создайте новый канбан-проект'}
                  </p>
                </div>
              </div>
            </div>
          )}
          {filtered.map((project) => {
            const isMusic = !!project.soundflowProjectId;
            const pType = project.projectType || 'general';
            const typeConf = isMusic
              ? (pType === 'album' ? { color: '#a855f7', icon: Disc3, label: 'Альбом' }
                 : pType === 'ep' ? { color: '#00d9ff', icon: AudioLines, label: 'EP' }
                 : pType === 'single' ? { color: '#f59e0b', icon: Music2, label: 'Сингл' }
                 : { color: '#10b981', icon: Music2, label: 'Music' })
              : { color: '#FCEE0A', icon: FolderOpen, label: 'Канбан' };
            const TypeIcon = typeConf.icon;
            const color = typeConf.color;
            const childCount = project.children?.length || 0;
            const doneCount = (project.children || []).filter(c => c.status === 'done').length;
            const pct = childCount > 0 ? Math.round((doneCount / childCount) * 100) : 0;
            const isEditing = editingId === project.id;
            const isConfirming = confirmDeleteId === project.id;

            return (
              <div
                key={project.id}
                onClick={() => !isEditing && !isConfirming && selectProject(project.id)}
                className="group relative cursor-pointer overflow-hidden"
                style={{
                  borderRadius: '10px',
                  background: `linear-gradient(135deg, ${hexToRgba(color, 0.1)}, rgba(14,18,28,0.85))`,
                  border: `1px solid ${hexToRgba(color, 0.3)}`,
                  boxShadow: `0 0 0 1px ${hexToRgba(color, 0.08)}, 0 4px 12px rgba(0,0,0,0.3)`,
                  transition: 'all 220ms cubic-bezier(0.4,0,0.2,1)',
                }}
                onMouseEnter={(e) => {
                  if (!isEditing && !isConfirming) {
                    e.currentTarget.style.background = `linear-gradient(135deg, ${hexToRgba(color, 0.18)}, rgba(16,20,30,0.95))`;
                    e.currentTarget.style.borderColor = hexToRgba(color, 0.6);
                    e.currentTarget.style.boxShadow = `0 0 0 1px ${hexToRgba(color, 0.3)}, 0 8px 32px ${hexToRgba(color, 0.2)}, 0 4px 16px rgba(0,0,0,0.4)`;
                    e.currentTarget.style.transform = 'translateY(-4px) scale(1.01)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `linear-gradient(135deg, ${hexToRgba(color, 0.1)}, rgba(14,18,28,0.85))`;
                  e.currentTarget.style.borderColor = hexToRgba(color, 0.3);
                  e.currentTarget.style.boxShadow = `0 0 0 1px ${hexToRgba(color, 0.08)}, 0 4px 12px rgba(0,0,0,0.3)`;
                  e.currentTarget.style.transform = 'none';
                }}
              >
                {/* Cover strip */}
                <div
                  className="h-16 flex items-center justify-between px-4"
                  style={{
                    background: `linear-gradient(135deg, ${hexToRgba(color, 0.15)}, ${hexToRgba(color, 0.02)})`,
                    borderBottom: `1px solid ${hexToRgba(color, 0.08)}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ background: hexToRgba(color, 0.15), border: `1px solid ${hexToRgba(color, 0.25)}` }}
                    >
                      <TypeIcon className="w-4 h-4" style={{ color }} />
                    </div>
                    <span className="text-[11px] font-semibold" style={{ color }}>{typeConf.label}</span>
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5" style={{ background: hexToRgba(color, 0.1), color, border: `1px solid ${hexToRgba(color, 0.2)}` }}>
                    {isMusic ? 'AUTO' : 'KANBAN'}
                  </span>
                </div>

                {/* Body */}
                <div className="p-4">
                  {isEditing ? (
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleRename(project.id);
                        if (e.key === 'Escape') { setEditingId(null); setEditTitle(''); }
                      }}
                      autoFocus
                      className="w-full bg-white/[0.06] border border-yellow-500/40 rounded px-2 py-1 text-sm text-slate-100 focus:outline-none"
                    />
                  ) : (
                    <h3 className="mb-2 text-[15px] font-semibold leading-snug text-slate-200 group-hover:text-white transition-colors">
                      {project.title}
                    </h3>
                  )}

                  {project.description && !isEditing && (
                    <p className="mb-2 text-[11px] text-slate-500 line-clamp-1">{project.description}</p>
                  )}

                  {/* Progress */}
                  {!isEditing && childCount > 0 && (
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct === 100 ? '#10b981' : color, boxShadow: pct > 0 ? `0 0 4px ${hexToRgba(pct === 100 ? '#10b981' : color, 0.5)}` : 'none' }} />
                      </div>
                      <span className="text-[10px] font-semibold tabular-nums" style={{ color: pct === 100 ? '#10b981' : color }}>{pct}%</span>
                    </div>
                  )}

                  {/* Meta row */}
                  {!isEditing && (
                    <div className="flex items-center gap-3 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        {childCount} {childCount === 1 ? 'доска' : childCount > 4 ? 'досок' : 'доски'}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: getStatusColor(project.status), boxShadow: `0 0 4px ${hexToRgba(getStatusColor(project.status), 0.4)}` }} />
                        {getStatusLabel(project.status)}
                      </span>
                    </div>
                  )}

                  {/* Edit mode */}
                  {isEditing && (
                    <div className="flex items-center gap-2 mt-3">
                      <button onClick={(e) => { e.stopPropagation(); void handleRename(project.id); }} disabled={!editTitle.trim()} className="px-3 py-1 rounded text-[10px] font-bold bg-yellow-500 text-black disabled:opacity-30">Сохранить</button>
                      <button onClick={(e) => { e.stopPropagation(); setEditingId(null); setEditTitle(''); }} className="px-2 py-1 text-[10px] text-slate-500 hover:text-slate-300">Отмена</button>
                    </div>
                  )}

                  {/* Delete confirmation */}
                  {isConfirming && (
                    <div className="mt-3 rounded-lg bg-rose-500/10 border border-rose-500/30 p-2.5">
                      <p className="text-[10px] text-rose-300 mb-2">Удалить проект? Это необратимо.</p>
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); void handleDelete(project.id); }} className="px-3 py-1 rounded text-[10px] font-bold bg-rose-600 text-white">Удалить</button>
                        <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }} className="px-2 py-1 text-[10px] text-slate-500">Отмена</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Hover actions */}
                {!isMusic && !isEditing && !isConfirming && (
                  <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => startEdit(e, project)} className="p-1.5 rounded hover:bg-white/[0.08] text-slate-500 hover:text-yellow-400 transition-all" title="Переименовать">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(project.id); }} className="p-1.5 rounded hover:bg-white/[0.08] text-slate-500 hover:text-rose-400 transition-all" title="Удалить">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {isMusic && !isEditing && !isConfirming && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[8px] text-slate-600 bg-white/[0.06] px-1.5 py-0.5 rounded flex items-center gap-0.5" title="Создано в Projects — редактирование там">
                      <Clock className="w-2 h-2" /> только просмотр
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function KanbanWorkspace() {
  const { selectedProjectId, projects, boards, setBoards, selectedBoardId, isTrackWizardOpen } = useKanbanStore();
  const [loading, setLoading] = useState(true);
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [newBoardColor, setNewBoardColor] = useState('#00d9ff');
  const [showProjectInfo, setShowProjectInfo] = useState(false);
  const BOARD_COLORS = [
    '#00d9ff', '#ff6b35', '#ec4899', '#10b981', '#a855f7',
    '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16',
    '#f97316', '#3b82f6', '#d946ef', '#14b8a6', '#eab308',
    '#f43f5e', '#22c55e', '#6366f1', '#0ea5e9', '#fb7185',
  ];
  const onboardingInitRef = useRef<string | null>(null);

  const project = projects.find((p) => p.id === selectedProjectId);
  const selectedBoard = boards.find((b) => b.id === selectedBoardId);
  const boardColor = selectedBoard?.color || '#00d9ff';

  const loadBoards = useCallback(async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/boards?projectId=${selectedProjectId}`);
      const data = await res.json();
      setBoards(data.boards);
      // Start onboarding only once per project entry
      if (onboardingInitRef.current !== selectedProjectId) {
        onboardingInitRef.current = selectedProjectId;
        const ghostIds = data.boards
          .filter((b: { isGhost: boolean }) => b.isGhost)
          .sort((a: { sortOrder: number }, b: { sortOrder: number }) => a.sortOrder - b.sortOrder)
          .map((b: { id: string }) => b.id);
        if (ghostIds.length > 0) {
          useKanbanStore.getState().startOnboarding(ghostIds);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, setBoards]);

  useEffect(() => { void loadBoards(); }, [loadBoards]);

  const handleCreateBoard = async () => {
    if (!newBoardTitle.trim() || !selectedProjectId) return;
    await fetch('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newBoardTitle.trim(), color: newBoardColor, projectId: selectedProjectId }),
    });
    setNewBoardTitle('');
    setNewBoardColor(BOARD_COLORS[Math.floor(Math.random() * BOARD_COLORS.length)]);
    setCreatingBoard(false);
    await loadBoards();
  };

  if (!selectedProjectId) {
    return <div className="flex-1 flex flex-col bg-slate-950"><ProjectList /></div>;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950">
      <TaskStrip />
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 p-2 md:p-3 relative min-h-0">
            <OnboardingHintPanel />
            {creatingBoard && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-slate-900/95 border border-slate-700/50 rounded-lg px-3 py-2.5 shadow-xl">
                <Input
                  value={newBoardTitle}
                  onChange={(e) => setNewBoardTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void handleCreateBoard()}
                  placeholder="Название доски..."
                  autoFocus
                  className="bg-slate-800/80 border-slate-600/50 text-sm text-slate-200 placeholder:text-slate-500 h-7 w-40 focus:border-slate-500"
                />
                <div className="flex items-center gap-1 flex-wrap max-w-[200px]">
                  {BOARD_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewBoardColor(c)}
                      className={cn(
                        'w-3.5 h-3.5 rounded-full transition-all duration-150 border',
                        newBoardColor === c ? 'border-white scale-125' : 'border-transparent hover:scale-110',
                      )}
                      style={{ backgroundColor: c, boxShadow: newBoardColor === c ? `0 0 8px ${c}80` : 'none' }}
                    />
                  ))}
                </div>
                <Button
                  size="sm"
                  onClick={() => void handleCreateBoard()}
                  disabled={!newBoardTitle.trim()}
                  className="text-white h-7 w-7 p-0 flex items-center justify-center"
                  style={{ backgroundColor: newBoardColor }}
                >
                  +
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCreatingBoard(false)} className="h-7 w-7 p-0 text-slate-500 hover:text-slate-300">×</Button>
              </div>
            )}
            <RadialBoard projectName={project?.title || 'Проект'} onAddBoard={() => setCreatingBoard(true)} onCenterClick={() => setShowProjectInfo(true)} />
          </div>
          <DescriptionBottomPanel />
        </div>
        <div className="w-[360px] flex flex-col min-h-0 relative overflow-hidden rp-panel" style={{
          '--bc': boardColor,
          '--bc-012': hexToRgba(boardColor, 0.012),
          '--bc-02': hexToRgba(boardColor, 0.02),
          '--bc-025': hexToRgba(boardColor, 0.025),
          '--bc-04': hexToRgba(boardColor, 0.04),
          '--bc-05': hexToRgba(boardColor, 0.05),
          '--bc-08': hexToRgba(boardColor, 0.08),
          '--bc-1': hexToRgba(boardColor, 0.1),
          '--bc-12': hexToRgba(boardColor, 0.12),
          '--bc-15': hexToRgba(boardColor, 0.15),
          '--bc-18': hexToRgba(boardColor, 0.18),
          '--bc-2': hexToRgba(boardColor, 0.2),
          '--bc-22': hexToRgba(boardColor, 0.22),
          '--bc-25': hexToRgba(boardColor, 0.25),
          '--bc-3': hexToRgba(boardColor, 0.3),
          '--bc-35': hexToRgba(boardColor, 0.35),
          '--bc-4': hexToRgba(boardColor, 0.4),
          '--bc-45': hexToRgba(boardColor, 0.45),
          '--bc-5': hexToRgba(boardColor, 0.5),
          '--bc-55': hexToRgba(boardColor, 0.55),
          '--bc-6': hexToRgba(boardColor, 0.6),
          '--bc-65': hexToRgba(boardColor, 0.65),
          '--bc-7': hexToRgba(boardColor, 0.7),
          '--bc-8': hexToRgba(boardColor, 0.8),
          borderLeft: `2px solid ${hexToRgba(boardColor, 0.35)}`,
          background: 'linear-gradient(180deg, rgba(5, 10, 20, 0.97), rgba(8, 12, 24, 0.99))',
          boxShadow: `inset 1px 0 0 ${hexToRgba(boardColor, 0.15)}, -4px 0 24px rgba(0, 0, 0, 0.5), inset 4px 0 24px ${hexToRgba(boardColor, 0.04)}`,
        } as React.CSSProperties}>
          <div className="rp-grid" />
          <div className="rp-scanlines" />
          {/* Neon left accent line */}
          <div
            className="absolute left-0 top-0 bottom-0 w-[2px] z-[1] pointer-events-none"
            style={{
              background: `linear-gradient(180deg, transparent, ${boardColor} 20%, #FCEE0A 50%, ${boardColor} 80%, transparent)`,
              boxShadow: `0 0 8px ${hexToRgba(boardColor, 0.5)}, 0 0 16px ${hexToRgba(boardColor, 0.2)}`,
              opacity: 0.7,
            }}
          />
          <div className="relative z-[2] flex flex-col flex-1 min-h-0">
            {isTrackWizardOpen ? (
              <TrackWizard />
            ) : (
              <TaskDetailPanel />
            )}
          </div>
        </div>
      </div>
      {showProjectInfo && selectedProjectId && (
        <ProjectInfoModal projectId={selectedProjectId} onClose={() => setShowProjectInfo(false)} />
      )}
    </div>
  );
}

export function KanbanPage() {
  const { selectedProjectId, selectProject } = useKanbanStore();
  const setHeaderActions = useHeaderActionsStore((s) => s.setActions);
  const setHeaderTitle = useHeaderActionsStore((s) => s.setTitle);

  useEffect(() => {
    if (selectedProjectId) {
      // Inside a kanban project — register back action
      setHeaderActions([
        {
          id: 'back-to-projects',
          label: 'К проектам',
          icon: <ArrowLeft className="h-3.5 w-3.5" />,
          onClick: () => selectProject(''),
          variant: 'ghost',
        },
      ]);
    } else {
      // On the project list — no contextual actions needed
      setHeaderActions([]);
    }
    setHeaderTitle(null);
    return () => { /* keep actions on unmount so transitions don't flicker */ };
  }, [selectedProjectId, selectProject, setHeaderActions, setHeaderTitle]);

  return (
    <div className="bg-slate-950 text-slate-100 flex flex-col h-[calc(100dvh-7rem)] lg:h-[calc(100dvh-7rem)]">
      <KanbanWorkspace />
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  'todo': '#00d9ff',
  'in-progress': '#ff8c00',
  'review': '#ff3366',
  'done': '#00ff88',
};

const STATUS_LABELS: Record<string, string> = {
  'todo': 'К выполнению',
  'in-progress': 'В работе',
  'review': 'На проверке',
  'done': 'Готово',
};

function getStatusColor(status: string) {
  return STATUS_COLORS[status] || '#00d9ff';
}

function getStatusLabel(status: string) {
  return STATUS_LABELS[status] || status;
}
