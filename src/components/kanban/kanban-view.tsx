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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, RefreshCw, Hexagon, FolderOpen, ChevronRight, Trash2, Plus, Music, Disc3, Zap, AudioLines, Search, Pencil, LayoutGrid, Layers, Check, X, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800/50 bg-gradient-to-b from-slate-900/40 to-transparent">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/10">
              <LayoutGrid className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-200">Канбан-проекты</h2>
              <p className="text-[10px] text-slate-500">Управление досками и задачами</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => void loadProjects()} disabled={loading} className="h-8 w-8 p-0 text-slate-500 hover:text-slate-300">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" onClick={() => setCreating(true)} className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white h-8 text-xs gap-1.5 transition-all shadow-lg shadow-cyan-500/20">
              <Plus className="w-3.5 h-3.5" /> Новый канбан
            </Button>
          </div>
        </div>

        {/* Stats + Filters row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Filter tabs */}
          <div className="flex items-center gap-0.5 bg-slate-900/60 rounded-lg p-0.5 border border-slate-800/50">
            {filters.map(f => {
              const Icon = f.icon;
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200',
                    active
                      ? 'bg-cyan-500/20 text-cyan-300 shadow-sm'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50',
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {f.label}
                  <span className={cn('text-[9px] px-1 py-0 rounded-full', active ? 'bg-cyan-500/30 text-cyan-200' : 'bg-slate-800/60 text-slate-600')}>{f.count}</span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[140px] max-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск..."
              className="w-full bg-slate-900/60 border border-slate-800/50 rounded-lg pl-8 pr-7 py-1.5 text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 transition-colors"
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
        <div className="px-6 py-3 border-b border-slate-800/30 bg-cyan-500/[0.03]">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Zap className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cyan-400" />
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreate();
                  if (e.key === 'Escape') { setCreating(false); setNewTitle(''); }
                }}
                placeholder="Название канбан-проекта..."
                autoFocus
                className="w-full bg-slate-900/80 border border-cyan-500/30 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60 focus:shadow-[0_0_0_3px_rgba(0,217,255,0.08)] transition-all"
              />
            </div>
            <Button size="sm" onClick={() => void handleCreate()} disabled={!newTitle.trim()} className="bg-cyan-600 hover:bg-cyan-500 text-white h-9 px-4 text-xs gap-1.5 disabled:opacity-40">
              <Check className="w-3.5 h-3.5" /> Создать
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setNewTitle(''); }} className="h-9 px-3 text-xs text-slate-500 hover:text-slate-300">
              Отмена
            </Button>
          </div>
          <div className="flex items-center gap-1.5 mt-2 ml-1">
            <Layers className="w-3 h-3 text-cyan-400/70" />
            <span className="text-[10px] text-slate-500">Стандартный канбан — доски создаются вручную внутри проекта</span>
          </div>
        </div>
      )}

      {/* Project grid */}
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-6">
          {filtered.length === 0 && !loading && (
            <div className="col-span-full text-center py-20">
              <div className="inline-flex flex-col items-center gap-3 animate-pulse">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-slate-700/30 flex items-center justify-center">
                  {search ? <Search className="w-7 h-7 text-slate-700" /> : <LayoutGrid className="w-7 h-7 text-slate-700" />}
                </div>
                <div>
                  <p className="text-slate-400 text-sm font-medium">
                    {search ? 'Ничего не найдено' : filter === 'music' ? 'Нет музыкальных проектов' : filter === 'kanban' ? 'Нет стандартных канбанов' : 'Канбан-проектов пока нет'}
                  </p>
                  <p className="text-slate-600 text-xs mt-1">
                    {search ? 'Попробуйте изменить запрос' : 'Создайте новый канбан или откройте проект из вкладки Projects'}
                  </p>
                </div>
              </div>
            </div>
          )}
          {filtered.map((project) => {
            const color = getStatusColor(project.status);
            const isMusic = !!project.soundflowProjectId;
            const pType = project.projectType;
            const isAlbum = pType === 'album' || pType === 'ep';
            const isSingle = pType === 'single';
            const isEp = pType === 'ep';
            const isEditing = editingId === project.id;
            const isConfirming = confirmDeleteId === project.id;
            const childCount = project.children?.length || 0;

            return (
              <div
                key={project.id}
                onClick={() => !isEditing && !isConfirming && selectProject(project.id)}
                className={cn(
                  'group relative rounded-xl p-4 cursor-pointer transition-all duration-200 border',
                  isEditing || isConfirming ? 'cursor-default' : '',
                  isMusic
                    ? 'bg-gradient-to-br from-purple-500/[0.06] to-transparent border-purple-500/20 hover:border-purple-500/40 hover:from-purple-500/[0.1]'
                    : 'bg-slate-900/60 border-slate-800/50 hover:border-cyan-500/30 hover:bg-slate-800/40',
                )}
                style={!isMusic ? { boxShadow: 'inset 0 0 0 1px transparent' } : undefined}
              >
                {/* Top row: icon + title + chevron */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105',
                        isAlbum ? 'bg-gradient-to-br from-purple-500/25 to-pink-500/15' :
                        isSingle ? 'bg-gradient-to-br from-amber-500/25 to-orange-500/15' :
                        '')}
                      style={!isAlbum && !isSingle ? { backgroundColor: color + '18', boxShadow: `0 0 12px ${color}15` } : undefined}
                    >
                      {isAlbum
                        ? <Disc3 className="w-4.5 h-4.5 text-purple-400 group-hover:rotate-45 transition-transform duration-300" />
                        : isSingle
                          ? <AudioLines className="w-4.5 h-4.5 text-amber-400" />
                          : <FolderOpen className="w-4.5 h-4.5" style={{ color }} />
                      }
                    </div>
                    <div className="min-w-0 flex-1">
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
                          className="w-full bg-slate-900 border border-cyan-500/50 rounded px-2 py-0.5 text-sm text-slate-200 focus:outline-none focus:shadow-[0_0_0_2px_rgba(0,217,255,0.1)]"
                        />
                      ) : (
                        <h3 className="text-sm font-semibold text-slate-200 truncate flex items-center gap-1.5">
                          {project.title}
                        </h3>
                      )}
                      {project.description && !isEditing && (
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{project.description}</p>
                      )}
                    </div>
                  </div>
                  {!isEditing && !isConfirming && (
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
                  )}
                </div>

                {/* Bottom row: status + counts + type badge */}
                {!isEditing && (
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}80` }} />
                      <span className="text-[10px] font-medium" style={{ color }}>{getStatusLabel(project.status)}</span>
                    </div>
                    {childCount > 0 && (
                      <span className="text-[10px] text-slate-600 flex items-center gap-0.5">
                        <Layers className="w-2.5 h-2.5" />
                        {childCount}
                      </span>
                    )}
                    {isMusic ? (
                      <span className="text-[9px] text-cyan-300 bg-cyan-500/15 border border-cyan-500/20 px-1.5 py-0.5 rounded ml-auto capitalize flex items-center gap-1 font-medium">
                        <Music className="w-2.5 h-2.5" />
                        {isEp ? 'EP' : pType}
                      </span>
                    ) : (
                      <span className="text-[9px] text-cyan-400/70 bg-cyan-500/[0.08] border border-cyan-500/15 px-1.5 py-0.5 rounded ml-auto flex items-center gap-1 font-medium">
                        <Zap className="w-2.5 h-2.5" />
                        Канбан
                      </span>
                    )}
                  </div>
                )}

                {/* Edit mode actions */}
                {isEditing && (
                  <div className="flex items-center gap-2 mt-3">
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); void handleRename(project.id); }} disabled={!editTitle.trim()} className="h-7 text-[10px] bg-cyan-600 hover:bg-cyan-500 text-white gap-1 disabled:opacity-40">
                      <Check className="w-3 h-3" /> Сохранить
                    </Button>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditingId(null); setEditTitle(''); }} className="h-7 text-[10px] text-slate-500 hover:text-slate-300">
                      Отмена
                    </Button>
                  </div>
                )}

                {/* Delete confirmation */}
                {isConfirming && (
                  <div className="mt-3 rounded-lg bg-rose-500/10 border border-rose-500/30 p-2.5">
                    <p className="text-[10px] text-rose-300 mb-2">Удалить проект? Это действие необратимо.</p>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={(e) => { e.stopPropagation(); void handleDelete(project.id); }} className="h-7 text-[10px] bg-rose-600 hover:bg-rose-500 text-white gap-1">
                        <Trash2 className="w-3 h-3" /> Удалить
                      </Button>
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }} className="h-7 text-[10px] text-slate-400 hover:text-slate-200">
                        Отмена
                      </Button>
                    </div>
                  </div>
                )}

                {/* Hover actions — only for standard kanbans (not music projects) */}
                {!isMusic && !isEditing && !isConfirming && (
                  <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => startEdit(e, project)}
                      className="p-1.5 rounded-lg hover:bg-slate-700/60 text-slate-500 hover:text-cyan-400 transition-all"
                      title="Переименовать"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(project.id); }}
                      className="p-1.5 rounded-lg hover:bg-slate-700/60 text-slate-500 hover:text-rose-400 transition-all"
                      title="Удалить"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Music projects: read-only indicator on hover */}
                {isMusic && !isEditing && !isConfirming && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[8px] text-slate-600 bg-slate-800/60 px-1.5 py-0.5 rounded flex items-center gap-0.5" title="Создано в Projects — редактирование там">
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
  const BOARD_COLORS = ['#00d9ff', '#ff8c00', '#ff3366', '#00ff88', '#a855f7', '#eab308', '#06b6d4', '#f43f5e'];
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
                <div className="flex items-center gap-1">
                  {BOARD_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewBoardColor(c)}
                      className={cn(
                        'w-4 h-4 rounded-full transition-all duration-150 border',
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
            <RadialBoard projectName={project?.title || 'Проект'} onAddBoard={() => setCreatingBoard(true)} />
          </div>
          <DescriptionBottomPanel />
        </div>
        <div className="w-[360px] flex flex-col min-h-0" style={{
          borderLeft: '2px solid rgba(252, 238, 10, 0.25)',
          background: 'linear-gradient(180deg, rgba(5, 10, 20, 0.95), rgba(8, 12, 24, 0.98))',
          boxShadow: 'inset 1px 0 0 rgba(252, 238, 10, 0.1), -4px 0 24px rgba(0, 0, 0, 0.5)',
        }}>
          {isTrackWizardOpen ? (
            <TrackWizard />
          ) : (
            <TaskDetailPanel />
          )}
        </div>
      </div>
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
