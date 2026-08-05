'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { useKanbanStore } from '@/store/kanban-store';
import RadialBoard from '@/components/board/radial-board';
import TaskStrip from '@/components/board/task-strip';
import OnboardingHintPanel from '@/components/board/onboarding-hint-panel';
import TaskDetailPanel from '@/components/kanban/task-detail-panel';
import TrackWizard from '@/components/kanban/track-wizard';
import DescriptionBottomPanel from '@/components/kanban/description-bottom-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, RefreshCw, Hexagon, FolderOpen, ChevronRight, Trash2, Plus, Music, Disc3, Zap, AudioLines } from 'lucide-react';
import { cn } from '@/lib/utils';

function ProjectList() {
  const { projects, setProjects, selectProject } = useKanbanStore();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

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
    // Only create standard (general) kanbans here.
    // Music projects (album/ep/single) with autoboards are created from the Projects tab.
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim(), isProject: true, projectType: 'general' }),
    });
    setNewTitle('');
    setCreating(false);
    await loadProjects();
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
    await loadProjects();
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800/50">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Проекты</h2>
          <span className="text-[10px] text-slate-600 bg-slate-800/50 px-1.5 py-0.5 rounded">{projects.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => void loadProjects()} disabled={loading} className="h-7 text-xs text-slate-500 hover:text-slate-300">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={() => setCreating(true)} className={cn('bg-cyan-600 hover:bg-cyan-700 text-white h-7 text-xs gap-1 transition-all', projects.length === 0 && 'animate-pulse')}>
            <Plus className="w-3.5 h-3.5" /> Новый проект
          </Button>
        </div>
      </div>

      {creating && (
        <div className="px-6 py-3 border-b border-slate-800/30 space-y-2">
          <div className="flex gap-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleCreate()}
              placeholder="Название канбан-доски..."
              autoFocus
              className="bg-slate-900/80 border-slate-700/50 text-sm text-slate-200 placeholder:text-slate-600 h-8 focus:border-cyan-500/50"
            />
            <Button size="sm" onClick={() => void handleCreate()} disabled={!newTitle.trim()} className="bg-cyan-600 hover:bg-cyan-700 text-white h-8 text-xs">Создать</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)} className="h-8 text-xs text-slate-500">Отмена</Button>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-3 h-3 text-cyan-400" />
            <span className="text-[10px] text-slate-500">Стандартный канбан — доски добавляются вручную</span>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-6">
          {projects.length === 0 && !loading && (
            <div className="col-span-full text-center py-16 space-y-4">
              <div className="animate-pulse">
                <Music className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-400 text-sm font-medium">Канбан-проектов пока нет</p>
                <p className="text-slate-600 text-xs mt-1">Создайте стандартный канбан или откройте музыкальный проект из вкладки Projects</p>
              </div>
            </div>
          )}
          {projects.map((project) => {
            const color = getStatusColor(project.status);
            const isMusic = project.soundflowProjectId !== null && project.soundflowProjectId !== undefined;
            const pType = project.projectType;
            const isAlbum = pType === 'album' || pType === 'ep';
            const isSingle = pType === 'single';
            const isEp = pType === 'ep';
            return (
              <div
                key={project.id}
                onClick={() => selectProject(project.id)}
                className="group relative bg-slate-900/60 border border-slate-800/50 rounded-xl p-4 cursor-pointer hover:border-slate-700/60 transition-all duration-200 hover:bg-slate-800/40"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', isAlbum ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20' : isSingle ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20' : '')} style={!isAlbum && !isSingle ? { backgroundColor: color + '15' } : undefined}>
                      {isAlbum
                        ? <Disc3 className="w-4 h-4 text-purple-400" />
                        : isSingle
                          ? <AudioLines className="w-4 h-4 text-amber-400" />
                          : <FolderOpen className="w-4 h-4" style={{ color }} />
                      }
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                        {project.title}
                        {isAlbum && <Disc3 className="w-3 h-3 text-purple-400/60" />}
                        {isSingle && <AudioLines className="w-3 h-3 text-amber-400/60" />}
                      </h3>
                      {project.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{project.description}</p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors mt-1" />
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}60` }} />
                  <span className="text-[10px]" style={{ color }}>{getStatusLabel(project.status)}</span>
                  {project.children?.length > 0 && (
                    <span className="text-[10px] text-slate-600">{project.children.length} подзадач</span>
                  )}
                  {isMusic && (
                    <span className="text-[9px] text-cyan-400/80 bg-cyan-500/10 px-1.5 py-0.5 rounded ml-auto capitalize flex items-center gap-1">
                      <Music className="w-2.5 h-2.5" />
                      {isEp ? 'EP' : pType}
                    </span>
                  )}
                  {!isMusic && (
                    <span className="text-[9px] text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded ml-auto">Канбан</span>
                  )}
                </div>
                <button
                  onClick={(e) => handleDelete(e, project.id)}
                  className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-slate-700 text-slate-500 hover:text-rose-400 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
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
        <div className="w-[360px] border-l border-slate-800/60 bg-slate-950/80 flex flex-col min-h-0">
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
  return (
    <div className="bg-slate-950 text-slate-100 flex flex-col h-[calc(100dvh-11.5rem)] lg:h-[calc(100dvh-9rem)]">
      <div className="flex items-center gap-3 border-b border-slate-800/60 px-4 py-3 shrink-0">
        <Button variant="ghost" onClick={() => useKanbanStore.getState().selectProject('')} className="text-slate-400 hover:text-slate-200">
          <ArrowLeft className="w-4 h-4 mr-2" /> Назад к проектам
        </Button>
        <div className="flex items-center gap-2">
          <Hexagon className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-slate-300">Kanban workspace</span>
        </div>
      </div>
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
