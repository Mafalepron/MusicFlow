'use client';

import { useState, useEffect, useCallback } from 'react';
import { useKanbanStore } from '@/store/kanban-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ChevronRight, ChevronLeft, Check, Music, Guitar, Mic2,
  Sparkles, X, Loader2, Plus, Trash2, FileText,
} from 'lucide-react';
import { cn, boardColorStyles } from '@/lib/utils';

interface WizardData {
  instruments: string[];
  stages: { key: string; label: string; emoji: string; hasInstrumentBased: boolean; defaultSubtaskCount: number }[];
}

interface EditableSubtask {
  id: string;
  title: string;
  description: string;
}

interface EditableStage {
  id: string;
  emoji: string;
  label: string;
  description: string;
  subtasks: EditableSubtask[];
  sourceKey?: string; // template key if added from template, undefined if custom
}

const CUSTOM_ICONS: Record<string, typeof Music> = {
  'Вокал (основной)': Mic2,
  'Бэк-вокал': Mic2,
  'Гитара (акустическая)': Guitar,
  'Гитара (электро)': Guitar,
};

const DEFAULT_STAGE_EMOJIS = ['📁', '🎯', '⚙️', '🔧', '🎨', '📊', '💡', '📋', '🧩', '🚀'];

const STAGE_SUBTASKS: Record<string, string[]> = {
  'Сонграйтинг': ['Написание текста', 'Демо'],
  'Аранжировка': ['Гармоническая структура', 'Тембровая расстановка'],
  'Редактура': ['Компинг', 'Тюнинг вокала', 'Тайминг'],
  'Сведение': ['Баланс и эквализация', 'Пространственная обработка', 'Эффекты и автоматизация'],
  'Мастеринг': ['Финальная громкость и лимитирование', 'Стерео-обработка'],
};

let _uid = 0;
const uid = () => `es_${++_uid}_${Date.now()}`;

export default function TrackWizard() {
  const { boards, selectedBoardId, setBoardTasks, setIsTrackWizardOpen, setSelectedTaskId, setTrackWizardStep } = useKanbanStore();
  const boardColor = boards.find(b => b.id === selectedBoardId)?.color || '#00d9ff';
  const bc = boardColorStyles(boardColor);
  const [step, setStep] = useState(0); // 0=name, 1=instruments, 2=stages+configure

  // Sync wizard step to store for onboarding
  useEffect(() => { setTrackWizardStep(step); return () => setTrackWizardStep(-1); }, [step, setTrackWizardStep]);

  const [trackName, setTrackName] = useState('');
  const [trackDescription, setTrackDescription] = useState('');
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([]);
  const [customInstrument, setCustomInstrument] = useState('');
  const [wizardData, setWizardData] = useState<WizardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [allInstruments, setAllInstruments] = useState<string[]>([]);

  // Editable stages (shared state for merged step 2)
  const [editableStages, setEditableStages] = useState<EditableStage[]>([]);
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null);
  const [addingSubtaskForStage, setAddingSubtaskForStage] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskDesc, setNewSubtaskDesc] = useState('');
  const [newStageLabel, setNewStageLabel] = useState('');
  const [newStageDesc, setNewStageDesc] = useState('');
  const [showNewStageForm, setShowNewStageForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(true);

  useEffect(() => {
    fetch('/api/tracks/wizard')
      .then(r => r.json())
      .then(data => {
        setWizardData(data);
        setAllInstruments([...data.instruments]);
      });
  }, []);

  // --- Template helpers ---
  const isTemplateAdded = (key: string) => editableStages.some(s => s.sourceKey === key);

  const toggleTemplate = (key: string) => {
    if (isTemplateAdded(key)) {
      // Remove template stage
      setEditableStages(prev => prev.filter(s => s.sourceKey !== key));
    } else {
      // Add template stage with default subtasks
      const tpl = wizardData?.stages.find(s => s.key === key);
      if (!tpl) return;
      const subtaskTitles = tpl.hasInstrumentBased && selectedInstruments.length > 0
        ? selectedInstruments.map(i => `Запись: ${i}`)
        : STAGE_SUBTASKS[key] || [];
      const newStage: EditableStage = {
        id: uid(),
        emoji: tpl.emoji,
        label: tpl.label,
        description: '',
        subtasks: subtaskTitles.map(t => ({ id: uid(), title: t, description: '' })),
        sourceKey: key,
      };
      setEditableStages(prev => [...prev, newStage]);
      setExpandedStageId(newStage.id);
    }
  };

  const addAllTemplates = () => {
    if (!wizardData) return;
    const allAdded = wizardData.stages.every(s => isTemplateAdded(s.key));
    if (allAdded) {
      // Remove all template stages
      setEditableStages(prev => prev.filter(s => !s.sourceKey));
    } else {
      // Add all missing templates
      const newStages: EditableStage[] = [];
      for (const tpl of wizardData.stages) {
        if (!isTemplateAdded(tpl.key)) {
          const subtaskTitles = tpl.hasInstrumentBased && selectedInstruments.length > 0
            ? selectedInstruments.map(i => `Запись: ${i}`)
            : STAGE_SUBTASKS[tpl.key] || [];
          newStages.push({
            id: uid(),
            emoji: tpl.emoji,
            label: tpl.label,
            description: '',
            subtasks: subtaskTitles.map(t => ({ id: uid(), title: t, description: '' })),
            sourceKey: tpl.key,
          });
        }
      }
      setEditableStages(prev => [...prev, ...newStages]);
    }
  };

  // Re-generate instrument-based subtasks when instruments change
  const updateInstrumentSubtasks = useCallback(() => {
    if (!wizardData) return;
    const recordStage = wizardData.stages.find(s => s.key === 'Запись');
    if (!recordStage || !isTemplateAdded('Запись')) return;
    const instSubtasks = selectedInstruments.map(i => `Запись: ${i}`);
    setEditableStages(prev => prev.map(s => {
      if (s.sourceKey !== 'Запись') return s;
      // Keep existing subtasks that still match an instrument, add new ones
      const existing = s.subtasks.filter(st => instSubtasks.includes(st.title));
      const finalSubs: EditableSubtask[] = instSubtasks.map(title => {
        const ex = existing.find(e => e.title === title);
        return ex || { id: uid(), title, description: '' };
      });
      return { ...s, subtasks: finalSubs };
    }));
  }, [wizardData, selectedInstruments]);

  // When entering step 2, ensure instrument subtasks are synced
  const goToStep2 = () => {
    updateInstrumentSubtasks();
    setStep(2);
  };

  // --- Instrument helpers ---
  const toggleInstrument = (inst: string) => {
    setSelectedInstruments(prev =>
      prev.includes(inst) ? prev.filter(i => i !== inst) : [...prev, inst]
    );
  };

  const addCustomInstrument = () => {
    const trimmed = customInstrument.trim();
    if (!trimmed || allInstruments.includes(trimmed)) return;
    setAllInstruments(prev => [...prev, trimmed]);
    setSelectedInstruments(prev => [...prev, trimmed]);
    setCustomInstrument('');
  };

  // --- Stage editing helpers ---
  const updateStage = (stageId: string, updates: Partial<Pick<EditableStage, 'label' | 'description' | 'emoji'>>) => {
    setEditableStages(prev => prev.map(s => s.id === stageId ? { ...s, ...updates } : s));
  };

  const removeStage = (stageId: string) => {
    setEditableStages(prev => prev.filter(s => s.id !== stageId));
  };

  const addNewStage = () => {
    if (!newStageLabel.trim()) return;
    const newStage: EditableStage = {
      id: uid(),
      emoji: DEFAULT_STAGE_EMOJIS[editableStages.length % DEFAULT_STAGE_EMOJIS.length],
      label: newStageLabel.trim(),
      description: newStageDesc.trim(),
      subtasks: [],
    };
    setEditableStages(prev => [...prev, newStage]);
    setNewStageLabel('');
    setNewStageDesc('');
    setShowNewStageForm(false);
    setExpandedStageId(newStage.id);
  };

  const updateSubtask = (stageId: string, subtaskId: string, updates: Partial<Pick<EditableSubtask, 'title' | 'description'>>) => {
    setEditableStages(prev => prev.map(s => {
      if (s.id !== stageId) return s;
      return { ...s, subtasks: s.subtasks.map(st => st.id === subtaskId ? { ...st, ...updates } : st) };
    }));
  };

  const removeSubtask = (stageId: string, subtaskId: string) => {
    setEditableStages(prev => prev.map(s => {
      if (s.id !== stageId) return s;
      return { ...s, subtasks: s.subtasks.filter(st => st.id !== subtaskId) };
    }));
  };

  const addSubtask = (stageId: string) => {
    if (!newSubtaskTitle.trim()) return;
    setEditableStages(prev => prev.map(s => {
      if (s.id !== stageId) return s;
      return { ...s, subtasks: [...s.subtasks, { id: uid(), title: newSubtaskTitle.trim(), description: newSubtaskDesc.trim() }] };
    }));
    setNewSubtaskTitle('');
    setNewSubtaskDesc('');
    setAddingSubtaskForStage(null);
  };

  // --- Create ---
  const handleCreate = useCallback(async () => {
    if (!trackName.trim() || !selectedBoardId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/tracks/wizard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trackName.trim(),
          description: trackDescription.trim(),
          instruments: selectedInstruments,
          boardId: selectedBoardId,
          customStages: editableStages.map(s => ({
            emoji: s.emoji,
            label: s.label,
            description: s.description,
            subtasks: s.subtasks.map(st => ({ title: st.title, description: st.description })),
          })),
        }),
      });
      const data = await res.json();
      const taskRes = await fetch(`/api/tasks?boardId=${selectedBoardId}&deep=true`);
      const taskData = await taskRes.json();
      setBoardTasks(taskData.tasks);
      if (data.trackId) setSelectedTaskId(data.trackId);
      setIsTrackWizardOpen(false);
    } finally {
      setLoading(false);
    }
  }, [trackName, trackDescription, selectedInstruments, selectedBoardId, editableStages, setBoardTasks, setSelectedTaskId, setIsTrackWizardOpen]);

  const canProceed = () => {
    if (step === 0) return trackName.trim().length > 0;
    if (step === 1) return selectedInstruments.length > 0;
    if (step === 2) return editableStages.length > 0;
    return true;
  };

  const handleClose = () => setIsTrackWizardOpen(false);

  const STEPS = ['Название', 'Инструменты', 'Этапы'];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-slate-800/50 p-4 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: bc.gradient }}>
              <Music className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Конструктор трека</h3>
              <p className="text-[10px] text-slate-500">Мастер создания пайплайна</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <button
                onClick={() => i < step && setStep(i)}
                className={cn(
                  'flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-md transition-all duration-200',
                  i < step && 'text-slate-400 hover:bg-slate-800/60 cursor-pointer',
                  i > step && 'text-slate-600',
                )}
                style={i === step ? { backgroundColor: bc.bg15, color: bc.text } : undefined}
              >
                {i < step ? <Check className="w-3 h-3" /> : <span className="w-4 h-4 rounded-full border text-center text-[9px] flex items-center justify-center" style={{
                  borderColor: i === step ? bc.text : i < step ? bc.text : '#334155',
                }}>{i + 1}</span>}
                <span className="hidden lg:inline">{s}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px mx-1" style={{ backgroundColor: i < step ? bc.bg30 : '#1e293b' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Step 0: Name */}
        {step === 0 && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 font-medium">Название трека</label>
              <Input
                value={trackName}
                onChange={(e) => setTrackName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && canProceed() && setStep(1)}
                placeholder="Лирика, Эксперимент..."
                autoFocus
                className="bg-slate-900/80 border-slate-700/50 text-sm text-slate-200 placeholder:text-slate-600 h-10"
                style={{ '--focus-border-color': bc.bg80 } as React.CSSProperties}
                onFocus={(e) => e.currentTarget.style.borderColor = bc.bg80}
                onBlur={(e) => e.currentTarget.style.borderColor = ''}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 font-medium">Описание</label>
              <Textarea
                value={trackDescription}
                onChange={(e) => setTrackDescription(e.target.value)}
                placeholder="Краткое описание идеи трека, настроение, жанр..."
                rows={3}
                className="bg-slate-900/80 border-slate-700/50 text-sm text-slate-200 placeholder:text-slate-600 resize-none"
                onFocus={(e) => e.currentTarget.style.borderColor = bc.bg80}
                onBlur={(e) => e.currentTarget.style.borderColor = ''}
              />
            </div>
            <div className="rounded-lg bg-slate-900/40 border border-slate-800/30 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-3.5 h-3.5" style={{ color: bc.text }} />
                <span className="text-[11px] font-medium" style={{ color: bc.text }}>Подсказка</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                После ввода названия и описания вы выберете инструменты и этапы производства.
                Система автоматически создаст структуру задач для вашего трека.
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Instruments */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">
                Инструменты <span className="text-slate-600">({selectedInstruments.length} выбрано)</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allInstruments.map((inst) => {
                const IconComp = CUSTOM_ICONS[inst];
                const isSelected = selectedInstruments.includes(inst);
                return (
                  <button
                    key={inst}
                    onClick={() => toggleInstrument(inst)}
                    className={cn(
                      'flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border transition-all duration-150',
                      !isSelected && 'bg-slate-900/60 border-slate-800/50 text-slate-400 hover:border-slate-700 hover:text-slate-300',
                    )}
                    style={isSelected ? {
                      backgroundColor: bc.bg15,
                      borderColor: bc.bg40,
                      color: bc.text,
                      boxShadow: `0 1px 2px 0 ${bc.bg20}`,
                    } : undefined}
                  >
                    {IconComp ? <IconComp className="w-3 h-3" /> : <Music className="w-3 h-3" />}
                    {inst}
                    {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 pt-1">
              <Input
                value={customInstrument}
                onChange={(e) => setCustomInstrument(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomInstrument()}
                placeholder="Свой инструмент..."
                className="bg-slate-900/80 border-slate-700/50 text-[11px] text-slate-200 placeholder:text-slate-600 h-7"
                onFocus={(e) => e.currentTarget.style.borderColor = bc.bg80}
                onBlur={(e) => e.currentTarget.style.borderColor = ''}
              />
              <Button size="sm" onClick={addCustomInstrument} disabled={!customInstrument.trim()} variant="ghost" className="h-7 text-[10px] text-slate-400 gap-1" onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = bc.text; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = ''; }}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            <div className="rounded-lg bg-slate-900/40 border border-slate-800/30 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-3.5 h-3.5" style={{ color: bc.text }} />
                <span className="text-[11px] font-medium" style={{ color: bc.text }}>Подсказка</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Выбранные инструменты определят подзадачи на этапе &laquo;Запись&raquo;.
                Для каждого инструмента создастся отдельная задача.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Stages + Configure (merged) */}
        {step === 2 && (
          <div className="space-y-3">
            {/* Templates section */}
            <div className="rounded-lg border border-slate-800/40 bg-slate-900/30 overflow-hidden">
              <button
                onClick={() => setShowTemplates(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] text-slate-300 font-medium">Шаблоны этапов</span>
                  <span className="text-[9px] text-slate-600">
                    {wizardData?.stages.filter(s => isTemplateAdded(s.key)).length || 0}/{wizardData?.stages.length || 0}
                  </span>
                </div>
                <ChevronRight className={cn('w-3.5 h-3.5 text-slate-500 transition-transform', showTemplates && 'rotate-90')} />
              </button>

              {showTemplates && (
                <div className="px-3 pb-3 space-y-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {wizardData?.stages.map(tpl => {
                      const added = isTemplateAdded(tpl.key);
                      return (
                        <button
                          key={tpl.key}
                          onClick={() => toggleTemplate(tpl.key)}
                          className={cn(
                            'flex items-center gap-1.5 text-[10px] px-2 py-1.5 rounded-lg border transition-all duration-150',
                            !added && 'bg-slate-900/60 border-slate-800/50 text-slate-500 hover:border-slate-700 hover:text-slate-300',
                          )}
                          style={added ? {
                            backgroundColor: bc.bg15,
                            borderColor: bc.bg30,
                            color: bc.text,
                          } : undefined}
                        >
                          <span className="text-sm">{tpl.emoji}</span>
                          {tpl.label}
                          {tpl.hasInstrumentBased && selectedInstruments.length > 0 && (
                            <span className="text-[8px] px-1 py-0.5 rounded" style={{ color: bc.bg60, backgroundColor: bc.bg15 }}>{selectedInstruments.length}</span>
                          )}
                          {added && <Check className="w-3 h-3" />}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={addAllTemplates}
                      className="text-[9px] transition-colors"
                      style={{ color: bc.bg50 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = bc.text; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = bc.bg50; }}
                    >
                      {wizardData?.stages.every(s => isTemplateAdded(s.key)) ? 'Снять все' : 'Добавить все'}
                    </button>
                    <span className="text-slate-800">·</span>
                    {!showNewStageForm ? (
                      <button
                        onClick={() => setShowNewStageForm(true)}
                        className="flex items-center gap-1 text-[9px] transition-colors"
                        style={{ color: bc.bg50 }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = bc.text; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = bc.bg50; }}
                      >
                        <Plus className="w-2.5 h-2.5" />
                        Свой этап
                      </button>
                    ) : null}
                  </div>
                  {/* New stage form inside templates */}
                  {showNewStageForm && (
                    <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: bc.bg30, background: bc.bgRgba(0.03) }}>
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3" style={{ color: bc.text }} />
                        <span className="text-[10px] font-medium" style={{ color: bc.text }}>Новый этап</span>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={DEFAULT_STAGE_EMOJIS[editableStages.length % DEFAULT_STAGE_EMOJIS.length]}
                          onChange={(e) => {}}
                          className="w-12 bg-slate-900/80 border-slate-700/50 text-sm text-center p-1 h-8"
                          maxLength={4}
                          readOnly
                          onFocus={(e) => { e.currentTarget.style.borderColor = bc.bg80; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = ''; }}
                        />
                        <Input
                          value={newStageLabel}
                          onChange={(e) => setNewStageLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newStageLabel.trim()) addNewStage();
                            if (e.key === 'Escape') { setShowNewStageForm(false); setNewStageLabel(''); setNewStageDesc(''); }
                          }}
                          placeholder="Название нового этапа"
                          autoFocus
                          className="flex-1 bg-slate-900/80 border-slate-700/50 text-xs text-slate-200 h-8"
                          onFocus={(e) => { e.currentTarget.style.borderColor = bc.bg80; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = ''; }}
                        />
                      </div>
                      <Textarea
                        value={newStageDesc}
                        onChange={(e) => setNewStageDesc(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && newStageLabel.trim()) addNewStage();
                          if (e.key === 'Escape') { setShowNewStageForm(false); setNewStageLabel(''); setNewStageDesc(''); }
                        }}
                        placeholder="Описание этапа (необязательно)"
                        className="bg-slate-900/80 border-slate-700/50 text-[11px] text-slate-300 placeholder:text-slate-600 min-h-[50px] resize-none"
                        rows={2}
                        onFocus={(e) => { e.currentTarget.style.borderColor = bc.bg80; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = ''; }}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => { setShowNewStageForm(false); setNewStageLabel(''); setNewStageDesc(''); }}
                          className="text-[9px] text-slate-500 hover:text-slate-300 px-2 py-1 rounded hover:bg-slate-800/60 transition-colors"
                        >
                          Отмена
                        </button>
                        <Button
                          size="sm"
                          onClick={addNewStage}
                          disabled={!newStageLabel.trim()}
                          className="h-7 text-[10px] disabled:opacity-40 text-white gap-1"
                          style={{ backgroundColor: bc.bg }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = bc.bg; e.currentTarget.style.filter = 'brightness(1.15)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = bc.bg; e.currentTarget.style.filter = ''; }}
                        >
                          <Plus className="w-3 h-3" />
                          Добавить этап
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Editable stages list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">
                  Этапы <span className="text-slate-600">({editableStages.length})</span>
                </span>
              </div>

              {editableStages.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-700/40 p-4 text-center">
                  <p className="text-[10px] text-slate-600">
                    Добавьте этапы из шаблонов выше или создайте свой
                  </p>
                </div>
              )}

              {editableStages.map((stage, idx) => {
                const isExpanded = expandedStageId === stage.id;
                return (
                  <div
                    key={stage.id}
                    className={cn(
                      'rounded-lg overflow-hidden transition-all duration-200',
                      !isExpanded && 'border border-slate-800/40 bg-slate-900/30',
                    )}
                    style={isExpanded ? {
                      borderColor: bc.bg30,
                      boxShadow: bc.shadow,
                    } : undefined}
                  >
                    {/* Stage header */}
                    <div
                      className={cn(
                        'flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors',
                        !isExpanded && 'bg-slate-800/30 hover:bg-slate-800/50',
                      )}
                      style={isExpanded ? { background: bc.bgRgba(0.08) } : undefined}
                      onClick={() => setExpandedStageId(isExpanded ? null : stage.id)}
                    >
                      <span className={cn('text-base transition-colors', !isExpanded && 'text-slate-400')} style={isExpanded ? { color: bc.text } : undefined}>{stage.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <span className={cn('text-[11px] font-medium', isExpanded ? 'text-white' : 'text-slate-200')}>{stage.label}</span>
                        <p className="text-[9px] text-slate-600">
                          {stage.subtasks.length} подзадач{stage.subtasks.length !== 1 ? '' : 'а'}
                          {stage.description ? ' · с описанием' : ''}
                        </p>
                      </div>
                      {isExpanded && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ color: bc.bg60, backgroundColor: bc.bg15 }}>#{idx + 1}</span>}
                      {!isExpanded && <span className="text-[9px] text-slate-600 bg-slate-800/60 px-1.5 py-0.5 rounded">#{idx + 1}</span>}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeStage(stage.id); }}
                        className="p-1 rounded hover:bg-red-500/20 text-slate-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Expanded: editable content with visual flair */}
                    {isExpanded && (
                      <div className="px-3 py-3 space-y-3" style={{ background: `linear-gradient(to bottom, ${bc.bgRgba(0.03)}, transparent)` }}>
                        {/* Stage name */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium" style={{ color: bc.bg50 }}>Название этапа</label>
                          <div className="flex gap-2">
                            <Input
                              value={stage.emoji}
                              onChange={(e) => updateStage(stage.id, { emoji: e.target.value })}
                              className="w-12 bg-slate-900/80 border-slate-700/50 text-sm text-center p-1 h-8"
                              onFocus={(e) => { e.currentTarget.style.borderColor = bc.bg80; }}
                              onBlur={(e) => { e.currentTarget.style.borderColor = ''; }}
                              maxLength={4}
                            />
                            <Input
                              value={stage.label}
                              onChange={(e) => updateStage(stage.id, { label: e.target.value })}
                              className="flex-1 bg-slate-900/80 border-slate-700/50 text-xs text-slate-200 h-8"
                              onFocus={(e) => { e.currentTarget.style.borderColor = bc.bg80; }}
                              onBlur={(e) => { e.currentTarget.style.borderColor = ''; }}
                              placeholder="Название этапа"
                            />
                          </div>
                        </div>

                        {/* Stage description */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full" style={{ backgroundColor: bc.bg }} />
                            <label className="text-[10px] font-medium" style={{ color: bc.bg50 }}>Описание этапа</label>
                          </div>
                          <Textarea
                            value={stage.description}
                            onChange={(e) => updateStage(stage.id, { description: e.target.value })}
                            placeholder="Опишите, что делается на этом этапе..."
                            className="bg-slate-900/60 text-[11px] text-slate-300 placeholder:text-slate-600/80 min-h-[60px] resize-none"
                            style={{ borderColor: bc.bg15 }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = bc.bg40; e.currentTarget.style.boxShadow = `0 0 0 1px ${bc.bg15}`; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = bc.bg15; e.currentTarget.style.boxShadow = ''; }}
                            rows={2}
                          />
                        </div>

                        {/* Subtasks */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <div className="w-1 h-1 rounded-full" style={{ backgroundColor: bc.bg }} />
                              <span className="text-[10px] font-medium" style={{ color: bc.bg50 }}>
                                Подзадачи ({stage.subtasks.length})
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                setAddingSubtaskForStage(stage.id);
                                setNewSubtaskTitle('');
                                setNewSubtaskDesc('');
                              }}
                              className="flex items-center gap-1 text-[9px] transition-colors"
                              style={{ color: bc.bg50 }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = bc.text; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = bc.bg50; }}
                            >
                              <Plus className="w-2.5 h-2.5" />
                              Добавить
                            </button>
                          </div>

                          <div className="space-y-1.5">
                            {stage.subtasks.map((sub) => (
                              <div
                                key={sub.id}
                                className="rounded-md border border-slate-800/40 bg-slate-900/50 p-2 space-y-1.5 hover:border-slate-700/50 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: bc.bg60 }} />
                                  <Input
                                    value={sub.title}
                                    onChange={(e) => updateSubtask(stage.id, sub.id, { title: e.target.value })}
                                    className="flex-1 bg-transparent border-transparent hover:border-slate-700/50 text-[11px] text-slate-300 h-6 px-1"
                                    onFocus={(e) => { e.currentTarget.style.borderColor = bc.bg80; }}
                                    onBlur={(e) => { e.currentTarget.style.borderColor = ''; }}
                                    placeholder="Название подзадачи"
                                  />
                                  <button
                                    onClick={() => removeSubtask(stage.id, sub.id)}
                                    className="p-0.5 rounded hover:bg-red-500/20 text-slate-600 hover:text-red-400 transition-colors shrink-0"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                                <Textarea
                                  value={sub.description}
                                  onChange={(e) => updateSubtask(stage.id, sub.id, { description: e.target.value })}
                                  placeholder="Описание подзадачи..."
                                  className="bg-transparent border-transparent hover:border-slate-700/50 text-[10px] text-slate-500 placeholder:text-slate-700 min-h-[32px] resize-none pl-4"
                                  onFocus={(e) => { e.currentTarget.style.borderColor = bc.bg80; e.currentTarget.style.boxShadow = `0 0 0 1px ${bc.bg15}`; }}
                                  onBlur={(e) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }}
                                  rows={1}
                                />
                              </div>
                            ))}
                          </div>

                          {/* Add subtask form */}
                          {addingSubtaskForStage === stage.id && (
                            <div className="rounded-md border p-2.5 space-y-1.5" style={{ borderColor: bc.bg30, background: bc.bgRgba(0.03) }}>
                              <Input
                                value={newSubtaskTitle}
                                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && newSubtaskTitle.trim()) addSubtask(stage.id);
                                  if (e.key === 'Escape') setAddingSubtaskForStage(null);
                                }}
                                placeholder="Название подзадачи"
                                autoFocus
                                className="bg-slate-900/80 border-slate-700/50 text-[11px] text-slate-200 placeholder:text-slate-600 h-7"
                                onFocus={(e) => { e.currentTarget.style.borderColor = bc.bg80; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = ''; }}
                              />
                              <Textarea
                                value={newSubtaskDesc}
                                onChange={(e) => setNewSubtaskDesc(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey && newSubtaskTitle.trim()) addSubtask(stage.id);
                                  if (e.key === 'Escape') setAddingSubtaskForStage(null);
                                }}
                                placeholder="Описание (необязательно)"
                                className="bg-slate-900/80 border-slate-700/50 text-[10px] text-slate-300 placeholder:text-slate-600 min-h-[40px] resize-none"
                                onFocus={(e) => { e.currentTarget.style.borderColor = bc.bg80; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = ''; }}
                                rows={2}
                              />
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => setAddingSubtaskForStage(null)}
                                  className="text-[9px] text-slate-500 hover:text-slate-300 px-2 py-1 rounded hover:bg-slate-800/60 transition-colors"
                                >
                                  Отмена
                                </button>
                                <Button
                                  size="sm"
                                  onClick={() => addSubtask(stage.id)}
                                  disabled={!newSubtaskTitle.trim()}
                                  className="h-6 text-[9px] disabled:opacity-40 text-white px-2"
                                  style={{ backgroundColor: bc.bg }}
                                  onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.15)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.filter = ''; }}
                                >
                                  Добавить
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div className="border-t border-slate-800/50 px-4 py-3 flex items-center justify-between shrink-0">
        <button
          onClick={() => step > 0 ? setStep(step - 1) : handleClose()}
          className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          {step === 0 ? 'Отмена' : 'Назад'}
        </button>

        {step < 2 ? (
          <Button
            onClick={() => step === 1 ? goToStep2() : setStep(step + 1)}
            disabled={!canProceed()}
            className="disabled:opacity-40 text-white h-8 text-xs gap-1"
            style={{ backgroundColor: bc.bg }}
            onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = ''; }}
          >
            Далее
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        ) : (
          <Button
            onClick={handleCreate}
            disabled={loading || editableStages.length === 0}
            className="disabled:opacity-40 text-white h-8 text-xs gap-1.5"
            style={{ background: bc.gradientFull, boxShadow: bc.shadowGlow }}
            onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = ''; }}
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Создать
          </Button>
        )}
      </div>
    </div>
  );
}
