'use client';

import { useKanbanStore, Task, TaskStatus } from '@/store/kanban-store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Trash2, ChevronRight, FolderOpen, FileText } from 'lucide-react';

const STATUS_STYLES: Record<TaskStatus, { text: string; label: string }> = {
  'todo': { text: 'text-cyan-400', label: 'К выполнению' },
  'in-progress': { text: 'text-orange-400', label: 'В работе' },
  'review': { text: 'text-rose-400', label: 'Проверка' },
  'done': { text: 'text-emerald-400', label: 'Готово' },
};

const CATEGORY_LABELS: Record<string, string> = {
  rehearsal: '🎤', recording: '🎵', performance: '🎪',
  marketing: '📢', social: '📱', general: '📋',
};

const PRIORITY_DOTS: Record<string, string> = {
  low: 'bg-slate-500', medium: 'bg-amber-500', high: 'bg-rose-500',
};

export default function TaskList() {
  const {
    tasks, selectedTaskId, setSelectedTaskId, setEditingTask,
    setIsCreating, currentParentId, navigateInto,
  } = useKanbanStore();

  const handleDelete = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/tasks?id=${taskId}`, { method: 'DELETE' });
      const parentIdParam = currentParentId === null ? 'null' : currentParentId;
      const res = await fetch(`/api/tasks?parentId=${parentIdParam}`);
      const data = await res.json();
      useKanbanStore.getState().setTasks(data.tasks);
      if (selectedTaskId === taskId) setSelectedTaskId(null);
    } catch (err) { console.error(err); }
  };

  const handleDoubleClick = (task: Task) => {
    if (task.isProject) {
 navigateInto(task.id);
    } else {
      setEditingTask(task);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/50">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            {currentParentId === null ? 'Проекты' : 'Задачи'}
          </h2>
          <span className="text-[10px] text-slate-600 bg-slate-800/50 px-1.5 py-0.5 rounded">
            {tasks.length}
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1 px-2">
        <div className="space-y-0.5 py-1.5">
          {tasks.length === 0 && (
            <div className="text-center py-8 text-slate-600 text-xs">
              {currentParentId === null ? 'Создайте первый проект' : 'Пока нет задач'}
            </div>
          )}
          {tasks.map((task) => {
            const style = STATUS_STYLES[task.status];
            const isSelected = selectedTaskId === task.id;

            return (
              <div
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                onDoubleClick={() => handleDoubleClick(task)}
                className={`
                  group relative flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150
                  ${isSelected
                    ? 'bg-cyan-500/10 ring-1 ring-cyan-500/30'
                    : 'hover:bg-slate-800/40'
                  }
                `}
              >
                {task.isProject ? (
                  <FolderOpen className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm truncate ${task.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                      {task.title}
                    </span>
                    {task.children?.length > 0 && (
                      <span className="text-[10px] text-cyan-500/70 bg-cyan-500/10 px-1 rounded">
                        {task.children.length}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[10px] font-medium ${style.text}`}>{style.label}</span>
                    {task.assignee && <span className="text-[10px] text-slate-600">👤 {task.assignee}</span>}
                    <span className="text-[10px] text-slate-600">{CATEGORY_LABELS[task.category] || ''}</span>
                  </div>
                </div>

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  {task.isProject && (
                    <button
                      onClick={(e) => { e.stopPropagation(); navigateInto(task.id); }}
                      className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-cyan-400"
                      title="Открыть проект"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(e, task.id)}
                    className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-rose-400"
                    title="Удалить"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
