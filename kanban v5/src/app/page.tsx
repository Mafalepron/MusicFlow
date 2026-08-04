'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { useKanbanStore, Task, Board } from '@/store/kanban-store';
import RadialBoard from '@/components/board/radial-board';
import TaskStrip from '@/components/board/task-strip';
import OnboardingHintPanel from '@/components/board/onboarding-hint-panel';
import TaskDetailPanel from '@/components/kanban/task-detail-panel';
import TrackWizard from '@/components/kanban/track-wizard';
import DescriptionBottomPanel from '@/components/kanban/description-bottom-panel';
import ProjectChat from '@/components/chat/project-chat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft, RefreshCw, Hexagon, FolderOpen, ChevronRight,
  Trash2, Plus, Music, Disc3, Zap, AudioLines,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function ProjectList() {
  const { projects, setProjects, selectProject } = useKanbanStore();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [projectType, setProjectType] = useState<'general' | 'album' | 'single'>('general');

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tasks?parentId=null');
      const data = await res.json();
      setProjects(data.tasks);
    } finally {
      setLoading(false);
    }
  }, [setProjects]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    // Create project task
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim(), isProject: true, projectType }),
    });
    const task = await res.json();

    // If album, create default boards
    if (projectType === 'album') {
      await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'album-defaults', projectId: task.id, createAlbumDefaults: true }),
      });
    }
    // If single, create default boards
    if (projectType === 'single') {
      await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'single-defaults', projectId: task.id, createSingleDefaults: true }),
      });
    }

    setNewTitle('');
    setCreating(false);
    setProjectType('general');
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
          <Button size="sm" variant="ghost" onClick={loadProjects} disabled={loading} className="h-7 text-xs text-slate-500 hover:text-slate-300">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={() => setCreating(true)} className={cn(
            'bg-cyan-600 hover:bg-cyan-700 text-white h-7 text-xs gap-1 transition-all',
            projects.length === 0 && 'animate-pulse',
          )}>
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
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Название проекта..."
              autoFocus
              className="bg-slate-900/80 border-slate-700/50 text-sm text-slate-200 placeholder:text-slate-600 h-8 focus:border-cyan-500/50"
            />
            <Button size="sm" onClick={handleCreate} disabled={!newTitle.trim()} className="bg-cyan-600 hover:bg-cyan-700 text-white h-8 text-xs">Создать</Button>
            <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setProjectType('general'); }} className="h-8 text-xs text-slate-500">Отмена</Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500">Тип:</span>
            <button
              onClick={() => setProjectType('general')}
              className={cn(
                'flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md border transition-all duration-150',
                projectType === 'general'
                  ? 'bg-slate-700/60 border-slate-600 text-slate-200'
                  : 'border-slate-800/50 text-slate-500 hover:text-slate-400 hover:border-slate-700',
              )}
            >
              <Zap className="w-3 h-3" />
              Общий
            </button>
            <button
              onClick={() => setProjectType('album')}
              className={cn(
                'flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md border transition-all duration-150',
                projectType === 'album'
                  ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                  : 'border-slate-800/50 text-slate-500 hover:text-slate-400 hover:border-slate-700',
              )}
            >
              <Disc3 className="w-3 h-3" />
              Альбом
              <span className="text-[8px] bg-purple-500/20 text-purple-400 px-1 rounded ml-0.5">авто-доски</span>
            </button>
            <button
              onClick={() => setProjectType('single')}
              className={cn(
                'flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md border transition-all duration-150',
                projectType === 'single'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'border-slate-800/50 text-slate-500 hover:text-slate-400 hover:border-slate-700',
              )}
            >
              <AudioLines className="w-3 h-3" />
              Сингл
              <span className="text-[8px] bg-amber-500/20 text-amber-400 px-1 rounded ml-0.5">авто-доски</span>
            </button>
          </div>
          {projectType === 'album' && (
            <div className="rounded-lg bg-purple-500/5 border border-purple-500/30 p-2.5 flex items-start gap-2 animate-pulse">
              <Disc3 className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] text-purple-300 font-medium">Проект альбома</p>
                <p className="text-[9px] text-slate-500 mt-0.5 leading-relaxed">
                  Автоматически создадутся доски: Треки, Дизайн, Дистрибуция, Маркетинг, Сведение, Мастеринг, Референсы.
                  Доска «Треки» будет иметь конструктор треков с выбором инструментов и этапов.
                </p>
              </div>
            </div>
          )}
          {projectType === 'single' && (
            <div className="rounded-lg bg-amber-500/5 border border-amber-500/30 p-2.5 flex items-start gap-2 animate-pulse">
              <AudioLines className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] text-amber-300 font-medium">Проект сингла</p>
                <p className="text-[9px] text-slate-500 mt-0.5 leading-relaxed">
                  Автоматически создадутся доски: Трек, Обложка, Публикация, Продвижение.
                  Доска «Трек» будет иметь конструктор треков с выбором инструментов и этапов.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-6">
          {projects.length === 0 && !loading && (
            <div className="col-span-full text-center py-16 space-y-6">
              {/* Main empty hint — pulsing */}
              <div className="animate-pulse">
                <Music className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-400 text-sm font-medium">Создайте первый проект</p>
                <p className="text-slate-600 text-xs mt-1">Альбом, сингл, тур, клип...</p>
              </div>
              {/* Auto-boards hint cards */}
              <div className="max-w-md mx-auto space-y-3">
                <div className="rounded-xl border border-purple-500/25 bg-purple-500/5 p-4 text-left animate-pulse" style={{ animationDelay: '0.5s', animationDuration: '2.5s' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Disc3 className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-medium text-purple-300">Альбом</span>
                    <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded ml-auto">авто-доски</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    7 досок создадутся автоматически: Треки, Дизайн, Дистрибуция, Маркетинг, Сведение, Мастеринг, Референсы
                  </p>
                </div>
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-left animate-pulse" style={{ animationDelay: '1s', animationDuration: '2.5s' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <AudioLines className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-medium text-amber-300">Сингл</span>
                    <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded ml-auto">авто-доски</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    4 доски создадутся автоматически: Трек, Обложка, Публикация, Продвижение
                  </p>
                </div>
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-left animate-pulse" style={{ animationDelay: '1.5s', animationDuration: '2.5s' }}>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-medium text-cyan-300">Общий</span>
                    <span className="text-[10px] text-slate-500 ml-auto">доски вручную</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          {projects.map((project) => {
            const color = getStatusColor(project.status);
            const isAlbum = project.projectType === 'album';
            const isSingle = project.projectType === 'single';
            return (
              <div
                key={project.id}
                onClick={() => selectProject(project.id)}
                className="group relative bg-slate-900/60 border border-slate-800/50 rounded-xl p-4 cursor-pointer hover:border-slate-700/60 transition-all duration-200 hover:bg-slate-800/40"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center',
                      isAlbum ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20' : isSingle ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20' : '',
                    )} style={!isAlbum && !isSingle ? { backgroundColor: color + '15' } : undefined}>
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
                  {isAlbum && (
                    <span className="text-[9px] text-purple-400/60 bg-purple-500/10 px-1.5 py-0.5 rounded ml-auto">Альбом</span>
                  )}
                  {isSingle && (
                    <span className="text-[9px] text-amber-400/60 bg-amber-500/10 px-1.5 py-0.5 rounded ml-auto">Сингл</span>
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

const BOARD_COLORS = ['#00d9ff', '#ff8c00', '#ff3366', '#00ff88', '#a855f7', '#eab308', '#06b6d4', '#f43f5e'];

function ProjectView() {
  const {
    selectedProjectId, projects, boards, setBoards,
    selectedBoardId, boardTasks,
    isCreating, setIsCreating,
    isTrackWizardOpen,
  } = useKanbanStore();
  const [loading, setLoading] = useState(true);
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [newBoardColor, setNewBoardColor] = useState(BOARD_COLORS[0]);
  const onboardingInitRef = useRef<string | null>(null);

  const project = projects.find(p => p.id === selectedProjectId);
  const selectedBoard = boards.find(b => b.id === selectedBoardId);
  const isTracksBoard = selectedBoard?.boardType === 'tracks';
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

  useEffect(() => { loadBoards(); }, [loadBoards]);

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

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top bar: task strip + new task button */}
      <TaskStrip />

      {/* Main area: radial board + right panel */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Radial board view + bottom description panel */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 p-2 md:p-3 relative min-h-0">
            {/* Onboarding hint panel overlay */}
            <OnboardingHintPanel />
            {creatingBoard && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-slate-900/95 border border-slate-700/50 rounded-lg px-3 py-2.5 shadow-xl">
                <Input
                  value={newBoardTitle}
                  onChange={(e) => setNewBoardTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateBoard()}
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
                        newBoardColor === c
                          ? 'border-white scale-125'
                          : 'border-transparent hover:scale-110',
                      )}
                      style={{ backgroundColor: c, boxShadow: newBoardColor === c ? `0 0 8px ${c}80` : 'none' }}
                    />
                  ))}
                </div>
                <Button
                  size="sm"
                  onClick={handleCreateBoard}
                  disabled={!newBoardTitle.trim()}
                  className="text-white h-7 w-7 p-0 flex items-center justify-center"
                  style={{ backgroundColor: newBoardColor }}
                >+</Button>
                <Button size="sm" variant="ghost" onClick={() => setCreatingBoard(false)} className="h-7 w-7 p-0 text-slate-500 hover:text-slate-300">×</Button>
              </div>
            )}

            <RadialBoard
              projectName={project?.title || 'Проект'}
              onAddBoard={() => setCreatingBoard(true)}
            />
          </div>
          <DescriptionBottomPanel />
        </div>

        {/* Right: Task detail panel / Track wizard */}
        <div className="w-full md:w-[320px] lg:w-[360px] flex-shrink-0 border-l border-slate-800/50 flex flex-col bg-[#050508]">
          {isTrackWizardOpen
            ? <TrackWizard />
            : <TaskDetailPanel />
          }
        </div>
      </div>
    </div>
  );
}

export default function KanbanPage() {
  const { selectedProjectId, navigationStack, navigateBack } = useKanbanStore();

  return (
    <div className="min-h-screen flex flex-col bg-black text-slate-200">
      <header className="flex-shrink-0 border-b border-slate-800/50 bg-black/90 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 md:px-5 py-2.5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center">
              <Hexagon className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white">WebKanban</h1>
              <p className="text-[10px] text-slate-500 -mt-0.5">Планирование задач • Музыкальная группа</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {navigationStack.length > 1 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={navigateBack}
                className="h-7 text-xs text-cyan-400 hover:text-cyan-300 gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Назад</span>
              </Button>
            )}
          </div>
        </div>

        {navigationStack.length > 1 && (
          <div className="px-4 md:px-5 py-1.5 border-t border-slate-800/30 flex items-center gap-1 text-[11px]">
            <button
              onClick={navigateBack}
              className="text-cyan-500/70 hover:text-cyan-400 transition-colors"
            >
              Все проекты
            </button>
            <span className="text-slate-700">/</span>
            <span className="text-slate-300">Проект</span>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {selectedProjectId ? <ProjectView /> : <ProjectList />}
      </main>

      <footer className="flex-shrink-0 border-t border-slate-800/50 px-4 py-1.5 bg-black mt-auto">
        <div className="flex items-center justify-between text-[10px] text-slate-700">
          <span>WebKanban • Доски задач</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
            Онлайн
          </span>
        </div>
      </footer>

      {/* Floating chat widget */}
      <ProjectChat />
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
