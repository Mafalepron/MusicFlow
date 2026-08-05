'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useKanbanStore, Task, TaskStatus, TaskPriority, TaskCategory } from '@/store/kanban-store';
import { X, Save, Plus } from 'lucide-react';

const CATEGORIES: { value: TaskCategory; label: string }[] = [
  { value: 'rehearsal', label: '🎤 Репетиция' },
  { value: 'recording', label: '🎵 Запись' },
  { value: 'performance', label: '🎪 Выступление' },
  { value: 'marketing', label: '📢 Маркетинг' },
  { value: 'social', label: '📱 Соцсети' },
  { value: 'general', label: '📋 Общее' },
];

const STATUSES: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'todo', label: 'К выполнению', color: 'text-cyan-400' },
  { value: 'in-progress', label: 'В работе', color: 'text-orange-400' },
  { value: 'review', label: 'На проверке', color: 'text-rose-400' },
  { value: 'done', label: 'Готово', color: 'text-emerald-400' },
];

const PRIORITIES: { value: TaskPriority; label: string; dot: string }[] = [
  { value: 'low', label: 'Низкий', dot: 'bg-slate-500' },
  { value: 'medium', label: 'Средний', dot: 'bg-amber-500' },
  { value: 'high', label: 'Высокий', dot: 'bg-rose-500' },
];

export default function TaskForm() {
  const {
    editingTask, isCreating, setIsCreating, setEditingTask,
    selectedBoardId, boards,
    boardTasks, setBoardTasks,
    selectedProjectId,
  } = useKanbanStore();

  const selectedBoard = boards.find(b => b.id === selectedBoardId);
  const boardColor = selectedBoard?.color || '#00d9ff';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assignee, setAssignee] = useState('');
  const [category, setCategory] = useState<TaskCategory>('general');
  const [isProject, setIsProject] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description || '');
      setStatus(editingTask.status);
      setPriority(editingTask.priority);
      setAssignee(editingTask.assignee || '');
      setCategory(editingTask.category);
      setIsProject(editingTask.isProject);
    } else if (isCreating) {
      setTitle('');
      setDescription('');
      setStatus('todo');
      setPriority('medium');
      setAssignee('');
      setCategory('general');
      setIsProject(false);
    }
  }, [editingTask, isCreating]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (editingTask) {
        await fetch('/api/tasks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingTask.id, title, description: description || null, status, priority, assignee: assignee || null, category, boardId: selectedBoardId }),
        });
      } else {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description: description || null, status, priority, assignee: assignee || null, category, isProject, parentId: selectedProjectId, boardId: selectedBoardId }),
        });
      }
      // Reload board tasks
      if (selectedBoardId) {
        const res = await fetch(`/api/tasks?boardId=${selectedBoardId}`);
        const data = await res.json();
        setBoardTasks(data.tasks);
      }
      // Reload boards to update counts
      if (selectedProjectId) {
        const bRes = await fetch(`/api/boards?projectId=${selectedProjectId}`);
        const bData = await bRes.json();
        useKanbanStore.getState().setBoards(bData.boards);
      }
      setEditingTask(null);
      setIsCreating(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingTask) return;
    setSaving(true);
    try {
      await fetch(`/api/tasks?id=${editingTask.id}`, { method: 'DELETE' });
      if (selectedBoardId) {
        const res = await fetch(`/api/tasks?boardId=${selectedBoardId}`);
        const data = await res.json();
        setBoardTasks(data.tasks);
      }
      if (selectedProjectId) {
        const bRes = await fetch(`/api/boards?projectId=${selectedProjectId}`);
        const bData = await bRes.json();
        useKanbanStore.getState().setBoards(bData.boards);
      }
      setEditingTask(null);
      useKanbanStore.getState().setSelectedTaskId(null);
    } finally {
      setSaving(false);
    }
  };

  const showForm = editingTask || isCreating;
  const focusRing = `focus:border-[${boardColor}]/50`;
  const inputCls = `bg-slate-900/80 border-slate-700/50 text-sm text-slate-200 placeholder:text-slate-600 h-8 focus:outline-none`;

  if (!showForm) {
    return (
      <div className="flex items-center justify-center py-3 px-4">
        <Button
          size="sm"
          onClick={() => setIsCreating(true)}
          className="text-white h-8 text-xs gap-1.5 transition-all"
          style={{
            backgroundColor: boardColor,
            boxShadow: `0 4px 14px ${boardColor}30`,
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          Новая задача
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: boardColor }}>
          {editingTask ? 'Редактировать' : 'Новая задача'}
        </h3>
        <button
          onClick={() => { setEditingTask(null); setIsCreating(false); }}
          className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-2.5">
        <div className="space-y-1">
          <Label className="text-[11px] text-slate-500">Название</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Задача..."
            className={inputCls}
            style={{ borderColor: undefined }}
            onFocus={(e) => { e.target.style.borderColor = boardColor + '80'; }}
            onBlur={(e) => { e.target.style.borderColor = ''; }}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-slate-500">Описание</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Описание..."
            className="bg-slate-900/80 border-slate-700/50 text-xs text-slate-300 placeholder:text-slate-600 min-h-[50px] resize-none"
            onFocus={(e) => { e.target.style.borderColor = boardColor + '80'; }}
            onBlur={(e) => { e.target.style.borderColor = ''; }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[11px] text-slate-500">Статус</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
              <SelectTrigger className="bg-slate-900/80 border-slate-700/50 text-xs text-slate-200 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    <span className={s.color}>{s.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-slate-500">Приоритет</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
              <SelectTrigger className="bg-slate-900/80 border-slate-700/50 text-xs text-slate-200 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                      {p.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[11px] text-slate-500">Категория</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as TaskCategory)}>
              <SelectTrigger className="bg-slate-900/80 border-slate-700/50 text-xs text-slate-200 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-slate-500">Ответственный</Label>
            <Input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="Имя..."
              className={inputCls}
              onFocus={(e) => { e.target.style.borderColor = boardColor + '80'; }}
              onBlur={(e) => { e.target.style.borderColor = ''; }}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          onClick={handleSave}
          disabled={!title.trim() || saving}
          className="flex-1 text-white h-8 text-xs transition-all"
          style={{
            backgroundColor: boardColor,
            boxShadow: `0 4px 14px ${boardColor}30`,
          }}
        >
          <Save className="w-3 h-3 mr-1" />
          {saving ? '...' : editingTask ? 'Сохранить' : 'Создать'}
        </Button>
        {editingTask && (
          <Button onClick={handleDelete} variant="destructive" disabled={saving} className="h-8 text-xs">
            Удалить
          </Button>
        )}
      </div>
    </div>
  );
}
