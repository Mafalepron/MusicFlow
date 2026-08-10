'use client';

import { useState, useEffect, useCallback } from 'react';
import { useKanbanStore } from '@/store/kanban-store';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ChevronRight, ChevronLeft, Check, Music, Guitar, Mic2,
  Sparkles, X, Loader2, Plus, Trash2, FileText,
} from 'lucide-react';
import { cn, boardColorStyles, hexToRgba } from '@/lib/utils';
import DeadlinePicker from '@/components/kanban/deadline-picker';

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
  const user = useAuthStore((s) => s.user);
  const boardColor = boards.find(b => b.id === selectedBoardId)?.color || '#00d9ff';
  const bc = boardColorStyles(boardColor);
  const [step, setStep] = useState(0); // 0=name, 1=instruments, 2=stages+configure

  // Sync wizard step to store for onboarding
  useEffect(() => { setTrackWizardStep(step); return () => setTrackWizardStep(-1); }, [step, setTrackWizardStep]);

  const [trackName, setTrackName] = useState('');
  const [trackDescription, setTrackDescription] = useState('');
  const [trackDeadline, setTrackDeadline] = useState<string | null>(null);
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
          deadline: trackDeadline,
          instruments: selectedInstruments,
          boardId: selectedBoardId,
          userId: user?.id,
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
    <div className="tw-panel flex flex-col flex-1 min-h-0" style={{
      '--bc': '#00d9ff',
      '--bc-012': hexToRgba('#00d9ff', 0.012),
      '--bc-02': hexToRgba('#00d9ff', 0.02),
      '--bc-025': hexToRgba('#00d9ff', 0.025),
      '--bc-04': hexToRgba('#00d9ff', 0.04),
      '--bc-05': hexToRgba('#00d9ff', 0.05),
      '--bc-08': hexToRgba('#00d9ff', 0.08),
      '--bc-1': hexToRgba('#00d9ff', 0.1),
      '--bc-12': hexToRgba('#00d9ff', 0.12),
      '--bc-15': hexToRgba('#00d9ff', 0.15),
      '--bc-18': hexToRgba('#00d9ff', 0.18),
      '--bc-2': hexToRgba('#00d9ff', 0.2),
      '--bc-22': hexToRgba('#00d9ff', 0.22),
      '--bc-25': hexToRgba('#00d9ff', 0.25),
      '--bc-3': hexToRgba('#00d9ff', 0.3),
      '--bc-35': hexToRgba('#00d9ff', 0.35),
      '--bc-4': hexToRgba('#00d9ff', 0.4),
      '--bc-45': hexToRgba('#00d9ff', 0.45),
      '--bc-5': hexToRgba('#00d9ff', 0.5),
      '--bc-55': hexToRgba('#00d9ff', 0.55),
      '--bc-6': hexToRgba('#00d9ff', 0.6),
      '--bc-65': hexToRgba('#00d9ff', 0.65),
      '--bc-7': hexToRgba('#00d9ff', 0.7),
      '--bc-8': hexToRgba('#00d9ff', 0.8),
    } as React.CSSProperties}>
      {/* Grid pattern overlay */}
      <div className="tw-grid" />
      {/* Scan line overlay */}
      <div className="tw-scanlines" />
      {/* Top neon border with pulsing glow */}
      <div className="tw-neon-top" />

      {/* Header */}
      <div className="p-4 shrink-0 relative z-10" style={{ borderBottom: '2px solid rgba(252, 238, 10, 0.15)', background: 'linear-gradient(90deg, rgba(252,238,10,0.03), transparent)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FCEE0A, #F1F100)', clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))' }}>
              <Music className="w-4 h-4 text-black" />
            </div>
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#FCEE0A', textShadow: '0 0 6px rgba(252,238,10,0.3)' }}>Конструктор трека</h3>
              <p className="text-[9px] text-slate-600 font-mono">{'// мастер создания пайплайна'}</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded transition-all" style={{ color: '#4a4a5e', border: '1px solid transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#FCEE0A'; e.currentTarget.style.borderColor = 'rgba(252,238,10,0.3)'; e.currentTarget.style.background = 'rgba(252,238,10,0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#4a4a5e'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}>
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
                  'flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 transition-all duration-200',
                  i < step && 'text-slate-400 cursor-pointer',
                  i > step && 'text-slate-600',
                )}
                style={i === step ? { color: '#FCEE0A', textShadow: '0 0 4px rgba(252,238,10,0.3)' } : undefined}
              >
                {i < step ? <Check className="w-3 h-3" /> : <span className="w-4 h-4 text-center text-[9px] font-bold flex items-center justify-center" style={{
                  clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))',
                  border: '1.5px solid',
                  borderColor: i === step ? 'rgba(252,238,10,0.8)' : '#334155',
                  background: i === step ? 'rgba(252,238,10,0.12)' : 'transparent',
                  color: i === step ? '#FCEE0A' : '#5a7a9e',
                  boxShadow: i === step ? '0 0 8px rgba(252,238,10,0.3)' : 'none',
                }}>{i + 1}</span>}
                <span className="hidden lg:inline uppercase tracking-wider">{s}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px mx-1" style={{ background: i < step ? 'linear-gradient(90deg, rgba(252,238,10,0.5), rgba(252,238,10,0.1))' : 'linear-gradient(90deg, #1e293b, #1e293b)' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 relative z-10 tw-scroll">
        {/* Step 0: Name + Description + Deadline */}
        {step === 0 && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[9px] uppercase tracking-widest font-bold" style={{ color: 'rgba(252,238,10,0.6)' }}>Название трека</label>
              <Input
                value={trackName}
                onChange={(e) => setTrackName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && canProceed() && setStep(1)}
                placeholder="Лирика, Эксперимент..."
                autoFocus
                className="bg-[rgba(8,8,16,0.92)] text-sm text-slate-200 placeholder:text-slate-600 h-10 rounded-md focus:outline-none focus-visible:ring-0 focus-visible:border-[#FCEE0A] border border-[rgba(252,238,10,0.35)] transition-colors px-3"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] uppercase tracking-widest font-bold" style={{ color: 'rgba(252,238,10,0.6)' }}>Описание</label>
              <Textarea
                value={trackDescription}
                onChange={(e) => setTrackDescription(e.target.value)}
                placeholder="Краткое описание идеи трека, настроение, жанр..."
                rows={3}
                className="bg-[rgba(8,8,16,0.92)] text-sm text-slate-300 placeholder:text-slate-600 min-h-[60px] resize-none rounded-md focus:outline-none focus-visible:ring-0 focus-visible:border-[#FCEE0A] border border-[rgba(252,238,10,0.35)] transition-colors px-3 py-2"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] uppercase tracking-widest font-bold" style={{ color: 'rgba(252,238,10,0.6)' }}>Дедлайн</label>
              <DeadlinePicker value={trackDeadline} onChange={setTrackDeadline} size="md" />
            </div>
            <div className="rounded-md p-3" style={{ background: 'rgba(0,240,255,0.03)', border: '1px solid rgba(0,240,255,0.12)', clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))' }}>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-3.5 h-3.5" style={{ color: '#FCEE0A' }} />
                <span className="text-[11px] font-medium" style={{ color: '#FCEE0A' }}>Подсказка</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                После ввода названия и описания вы выберете инструменты и этапы производства.
                Система автоматически создаст структуру задач для вашего трека.
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Instruments — blue default, yellow selected */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color: 'rgba(0,229,255,0.7)' }}>
                Инструменты <span style={{ color: '#5a7a9e' }}>({selectedInstruments.length})</span>
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
                      'flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 transition-all duration-150',
                    )}
                    style={isSelected ? {
                      color: '#000',
                      background: 'linear-gradient(135deg, #FCEE0A, #F1F100)',
                      border: '1.5px solid rgba(252,238,10,0.8)',
                      boxShadow: '0 0 10px rgba(252,238,10,0.3), inset 0 1px 0 rgba(255,255,255,0.3)',
                      clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))',
                    } : {
                      color: '#8ab4d8',
                      background: 'rgba(0,229,255,0.05)',
                      border: '1.5px solid rgba(0,229,255,0.2)',
                      clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))',
                    }}
                    onMouseEnter={(e) => { if (!isSelected) { e.currentTarget.style.borderColor = 'rgba(0,229,255,0.5)'; e.currentTarget.style.background = 'rgba(0,229,255,0.1)'; e.currentTarget.style.boxShadow = '0 0 8px rgba(0,229,255,0.1)'; } }}
                    onMouseLeave={(e) => { if (!isSelected) { e.currentTarget.style.borderColor = 'rgba(0,229,255,0.2)'; e.currentTarget.style.background = 'rgba(0,229,255,0.05)'; e.currentTarget.style.boxShadow = 'none'; } }}
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
                className="flex-1 bg-[rgba(8,8,16,0.92)] text-[11px] text-slate-300 placeholder:text-slate-600 h-8 rounded-md focus:outline-none focus-visible:ring-0 focus-visible:border-[#FCEE0A] border border-[rgba(0,229,255,0.3)] transition-colors px-2.5 py-1.5"
              />
              <button
                onClick={addCustomInstrument}
                disabled={!customInstrument.trim()}
                className="flex items-center justify-center h-8 w-8 transition-all disabled:opacity-30"
                style={{ color: '#FCEE0A', background: 'rgba(252,238,10,0.08)', border: '1.5px solid rgba(252,238,10,0.3)', clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))' }}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <div className="rounded-md p-3" style={{ background: 'rgba(0,229,255,0.03)', border: '1px solid rgba(0,229,255,0.12)', clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))' }}>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-3.5 h-3.5" style={{ color: '#00E5FF' }} />
                <span className="text-[11px] font-medium" style={{ color: '#00E5FF' }}>Подсказка</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Выбранные инструменты определят подзадачи на этапе «Запись».
                Для каждого инструмента создастся отдельная задача.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Stages — finalized cyberpunk design */}
        {step === 2 && (
          <div className="space-y-3">
            {/* Templates section */}
            <div className="overflow-hidden" style={{ border: '1.5px solid rgba(0,229,255,0.22)', background: 'linear-gradient(135deg, rgba(10,18,32,0.7), rgba(6,10,20,0.85))', clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}>
              <button
                onClick={() => setShowTemplates(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 transition-colors"
                style={{ borderBottom: showTemplates ? '1px solid rgba(0,229,255,0.1)' : 'none' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,229,255,0.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" style={{ color: '#00E5FF' }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#00E5FF' }}>Шаблоны этапов</span>
                  <span className="text-[9px] font-mono" style={{ color: '#5a7a9e' }}>
                    {wizardData?.stages.filter(s => isTemplateAdded(s.key)).length || 0}/{wizardData?.stages.length || 0}
                  </span>
                </div>
                <ChevronRight className={cn('w-3.5 h-3.5 transition-transform', showTemplates && 'rotate-90')} style={{ color: '#5a7a9e' }} />
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
                          className="flex items-center gap-1.5 text-[10px] font-medium px-2 py-1.5 transition-all duration-150"
                          style={added ? {
                            color: '#000',
                            background: 'linear-gradient(135deg, #FCEE0A, #F1F100)',
                            border: '1.5px solid rgba(252,238,10,0.8)',
                            boxShadow: '0 0 8px rgba(252,238,10,0.25)',
                            clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))',
                          } : {
                            color: '#8ab4d8',
                            background: 'rgba(0,229,255,0.05)',
                            border: '1.5px solid rgba(0,229,255,0.2)',
                            clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))',
                          }}
                          onMouseEnter={(e) => { if (!added) { e.currentTarget.style.borderColor = 'rgba(0,229,255,0.5)'; e.currentTarget.style.background = 'rgba(0,229,255,0.1)'; } }}
                          onMouseLeave={(e) => { if (!added) { e.currentTarget.style.borderColor = 'rgba(0,229,255,0.2)'; e.currentTarget.style.background = 'rgba(0,229,255,0.05)'; } }}
                        >
                          <span className="text-sm">{tpl.emoji}</span>
                          {tpl.label}
                          {tpl.hasInstrumentBased && selectedInstruments.length > 0 && (
                            <span className="text-[8px] px-1 py-0.5 rounded font-bold" style={{ color: '#000', backgroundColor: 'rgba(252,238,10,0.3)' }}>{selectedInstruments.length}</span>
                          )}
                          {added && <Check className="w-3 h-3" />}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={addAllTemplates}
                      className="text-[9px] font-bold uppercase tracking-wider transition-all px-2 py-1"
                      style={{ color: '#5a7a9e', border: '1px solid transparent', clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#FCEE0A'; e.currentTarget.style.borderColor = 'rgba(252,238,10,0.3)'; e.currentTarget.style.background = 'rgba(252,238,10,0.06)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#5a7a9e'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
                    >
                      {wizardData?.stages.every(s => isTemplateAdded(s.key)) ? 'Снять все' : 'Добавить все'}
                    </button>
                    <span style={{ color: '#2a3a4e' }}>·</span>
                    {!showNewStageForm ? (
                      <button
                        onClick={() => setShowNewStageForm(true)}
                        className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider transition-all px-2 py-1"
                        style={{ color: '#5a7a9e', border: '1px solid transparent', clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#00E5FF'; e.currentTarget.style.borderColor = 'rgba(0,229,255,0.3)'; e.currentTarget.style.background = 'rgba(0,229,255,0.06)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#5a7a9e'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
                      >
                        <Plus className="w-2.5 h-2.5" />
                        Свой этап
                      </button>
                    ) : null}
                  </div>
                  {/* New stage form */}
                  {showNewStageForm && (
                    <div className="p-3 space-y-2" style={{ border: '1.5px solid rgba(0,229,255,0.2)', background: 'rgba(0,229,255,0.04)', clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))' }}>
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3" style={{ color: '#00E5FF' }} />
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#00E5FF' }}>Новый этап</span>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={DEFAULT_STAGE_EMOJIS[editableStages.length % DEFAULT_STAGE_EMOJIS.length]}
                          onChange={(e) => {}}
                          className="w-12 bg-[rgba(8,8,16,0.92)] text-sm text-center text-slate-300 p-1 h-8 rounded-md focus:outline-none focus-visible:ring-0 focus-visible:border-[#FCEE0A] border border-[rgba(0,229,255,0.3)] transition-colors"
                          maxLength={4}
                          readOnly
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
                          className="flex-1 bg-[rgba(8,8,16,0.92)] text-xs text-slate-300 placeholder:text-slate-600 h-8 rounded-md focus:outline-none focus-visible:ring-0 focus-visible:border-[#FCEE0A] border border-[rgba(0,229,255,0.3)] transition-colors px-2.5 py-1.5"
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
                        className="bg-[rgba(8,8,16,0.92)] text-[11px] text-slate-300 placeholder:text-slate-600 min-h-[50px] resize-none rounded-md focus:outline-none focus-visible:ring-0 focus-visible:border-[#FCEE0A] border border-[rgba(0,229,255,0.3)] transition-colors px-2.5 py-1.5"
                        rows={2}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => { setShowNewStageForm(false); setNewStageLabel(''); setNewStageDesc(''); }}
                          className="text-[10px] text-slate-500 hover:text-slate-300 px-2 py-1 rounded transition-colors"
                        >
                          Отмена
                        </button>
                        <button
                          onClick={addNewStage}
                          disabled={!newStageLabel.trim()}
                          className="text-[10px] font-bold px-3 py-1 rounded transition-all disabled:opacity-30"
                          style={{ color: '#000', background: 'linear-gradient(135deg, #FCEE0A, #F1F100)', boxShadow: '0 0 8px rgba(252,238,10,0.25)', clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))' }}
                        >
                          <Plus className="w-3 h-3 inline mr-1" />
                          Добавить
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Editable stages list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color: 'rgba(0,229,255,0.7)' }}>
                  Этапы <span style={{ color: '#5a7a9e' }}>({editableStages.length})</span>
                </span>
              </div>

              {editableStages.length === 0 && (
                <div className="p-4 text-center" style={{ border: '1.5px dashed rgba(0,229,255,0.15)', clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))' }}>
                  <p className="text-[10px]" style={{ color: '#4a5a6e' }}>
                    Добавьте этапы из шаблонов выше или создайте свой
                  </p>
                </div>
              )}

              {editableStages.map((stage, idx) => {
                const isExpanded = expandedStageId === stage.id;
                return (
                  <div
                    key={stage.id}
                    className={cn('tw-stage-card overflow-hidden transition-all duration-200', isExpanded && 'tw-stage-card-selected')}
                  >
                    {/* Stage header */}
                    <div
                      className="flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors relative z-10"
                      style={{ borderBottom: isExpanded ? '1px solid rgba(252,238,10,0.15)' : 'none' }}
                      onClick={() => setExpandedStageId(isExpanded ? null : stage.id)}
                    >
                      <span className="text-base">{stage.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <span className={cn('text-[11px] font-medium', isExpanded ? 'text-white' : 'text-slate-300')} style={isExpanded ? { textShadow: '0 0 6px rgba(252,238,10,0.2)' } : undefined}>{stage.label}</span>
                        <p className="text-[9px] font-mono" style={{ color: '#4a5a6e' }}>
                          {stage.subtasks.length} подзадач{stage.subtasks.length !== 1 ? '' : 'а'}
                          {stage.description ? ' · с описанием' : ''}
                        </p>
                      </div>
                      {isExpanded && <span className="text-[9px] font-bold px-1.5 py-0.5" style={{ color: '#FCEE0A', background: 'rgba(252,238,10,0.1)', border: '1px solid rgba(252,238,10,0.2)', clipPath: 'polygon(0 0, calc(100% - 2px) 0, 100% 2px, 100% 100%, 2px 100%, 0 calc(100% - 2px))' }}>#{idx + 1}</span>}
                      {!isExpanded && <span className="text-[9px] font-mono px-1.5 py-0.5" style={{ color: '#5a7a9e', background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.1)' }}>#{idx + 1}</span>}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeStage(stage.id); }}
                        className="p-1 rounded transition-all"
                        style={{ color: '#5a7a9e' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#FF003C'; e.currentTarget.style.background = 'rgba(255,0,60,0.1)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#5a7a9e'; e.currentTarget.style.background = 'transparent'; }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Expanded: editable content */}
                    {isExpanded && (
                      <div className="px-3 py-3 space-y-3 relative z-10" style={{ background: 'linear-gradient(to bottom, rgba(252,238,10,0.03), transparent)' }}>
                        {/* Stage name */}
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase tracking-widest font-bold" style={{ color: 'rgba(0,229,255,0.7)' }}>Название этапа</label>
                          <div className="flex gap-2">
                            <Input
                              value={stage.emoji}
                              onChange={(e) => updateStage(stage.id, { emoji: e.target.value })}
                              className="w-12 bg-[rgba(8,8,16,0.92)] text-sm text-center text-slate-300 p-1 h-8 rounded-md focus:outline-none focus-visible:ring-0 focus-visible:border-[#FCEE0A] border border-[rgba(0,229,255,0.3)] transition-colors"
                              maxLength={4}
                            />
                            <Input
                              value={stage.label}
                              onChange={(e) => updateStage(stage.id, { label: e.target.value })}
                              className="flex-1 bg-[rgba(8,8,16,0.92)] text-xs text-slate-300 placeholder:text-slate-600 h-8 rounded-md focus:outline-none focus-visible:ring-0 focus-visible:border-[#FCEE0A] border border-[rgba(0,229,255,0.3)] transition-colors px-2.5 py-1.5"
                              placeholder="Название этапа"
                            />
                          </div>
                        </div>

                        {/* Stage description */}
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase tracking-widest font-bold" style={{ color: 'rgba(0,229,255,0.7)' }}>Описание этапа</label>
                          <Textarea
                            value={stage.description}
                            onChange={(e) => updateStage(stage.id, { description: e.target.value })}
                            placeholder="Опишите, что делается на этом этапе..."
                            className="bg-[rgba(8,8,16,0.92)] text-[11px] text-slate-300 placeholder:text-slate-600 min-h-[55px] resize-none rounded-md focus:outline-none focus-visible:ring-0 focus-visible:border-[#FCEE0A] border border-[rgba(0,229,255,0.3)] transition-colors px-2.5 py-1.5"
                            rows={2}
                          />
                        </div>

                        {/* Subtasks */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color: 'rgba(0,229,255,0.6)' }}>
                              Подзадачи ({stage.subtasks.length})
                            </span>
                            <button
                              onClick={() => {
                                setAddingSubtaskForStage(stage.id);
                                setNewSubtaskTitle('');
                                setNewSubtaskDesc('');
                              }}
                              className="text-[9px] font-bold uppercase tracking-wider transition-all px-2 py-1"
                              style={{ color: '#5a7a9e', border: '1px solid transparent', clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))' }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = '#FCEE0A'; e.currentTarget.style.borderColor = 'rgba(252,238,10,0.3)'; e.currentTarget.style.background = 'rgba(252,238,10,0.06)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = '#5a7a9e'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
                            >
                              <Plus className="w-2.5 h-2.5 inline mr-0.5" />
                              Добавить
                            </button>
                          </div>

                          <div className="space-y-1.5">
                            {stage.subtasks.map((sub) => (
                              <div
                                key={sub.id}
                                className="p-2 space-y-1.5 transition-all"
                                style={{ border: '1px solid rgba(0,229,255,0.12)', background: 'rgba(0,229,255,0.03)', clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))' }}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#00E5FF', boxShadow: '0 0 4px rgba(0,229,255,0.4)' }} />
                                  <Input
                                    value={sub.title}
                                    onChange={(e) => updateSubtask(stage.id, sub.id, { title: e.target.value })}
                                    className="flex-1 bg-transparent border-transparent text-[11px] text-slate-200 h-6 px-1 focus:outline-none"
                                    placeholder="Название подзадачи"
                                  />
                                  <button
                                    onClick={() => removeSubtask(stage.id, sub.id)}
                                    className="p-0.5 rounded transition-colors shrink-0"
                                    style={{ color: '#5a7a9e' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.color = '#FF003C'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.color = '#5a7a9e'; }}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                                <Textarea
                                  value={sub.description}
                                  onChange={(e) => updateSubtask(stage.id, sub.id, { description: e.target.value })}
                                  placeholder="Описание подзадачи..."
                                  className="bg-transparent border-transparent text-[10px] text-slate-500 placeholder:text-slate-700 min-h-[28px] resize-none pl-4 focus:outline-none"
                                  rows={1}
                                />
                              </div>
                            ))}
                          </div>

                          {/* Add subtask form */}
                          {addingSubtaskForStage === stage.id && (
                            <div className="p-2.5 space-y-1.5" style={{ border: '1.5px solid rgba(252,238,10,0.3)', background: 'rgba(252,238,10,0.04)', clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))' }}>
                              <Input
                                value={newSubtaskTitle}
                                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && newSubtaskTitle.trim()) addSubtask(stage.id);
                                  if (e.key === 'Escape') setAddingSubtaskForStage(null);
                                }}
                                placeholder="Название подзадачи"
                                autoFocus
                                className="bg-[rgba(8,8,16,0.92)] text-[11px] text-slate-300 placeholder:text-slate-600 h-7 rounded-md focus:outline-none focus-visible:ring-0 focus-visible:border-[#FCEE0A] border border-[rgba(252,238,10,0.35)] transition-colors px-2.5 py-1.5"
                              />
                              <Textarea
                                value={newSubtaskDesc}
                                onChange={(e) => setNewSubtaskDesc(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey && newSubtaskTitle.trim()) addSubtask(stage.id);
                                  if (e.key === 'Escape') setAddingSubtaskForStage(null);
                                }}
                                placeholder="Описание (необязательно)"
                                className="bg-[rgba(8,8,16,0.92)] text-[10px] text-slate-300 placeholder:text-slate-600 min-h-[35px] resize-none rounded-md focus:outline-none focus-visible:ring-0 focus-visible:border-[#FCEE0A] border border-[rgba(252,238,10,0.35)] transition-colors px-2.5 py-1.5"
                                rows={2}
                              />
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => setAddingSubtaskForStage(null)}
                                  className="text-[9px] text-slate-500 hover:text-slate-300 px-2 py-1 rounded transition-colors"
                                >
                                  Отмена
                                </button>
                                <button
                                  onClick={() => addSubtask(stage.id)}
                                  disabled={!newSubtaskTitle.trim()}
                                  className="text-[9px] font-bold px-2 py-1 rounded transition-all disabled:opacity-30"
                                  style={{ color: '#000', background: 'linear-gradient(135deg, #FCEE0A, #F1F100)', clipPath: 'polygon(0 0, calc(100% - 2px) 0, 100% 2px, 100% 100%, 2px 100%, 0 calc(100% - 2px))' }}
                                >
                                  Добавить
                                </button>
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
      <div className="px-4 py-3 flex items-center justify-between shrink-0 relative z-10" style={{ borderTop: '2px solid rgba(252, 238, 10, 0.15)', background: 'linear-gradient(90deg, rgba(252,238,10,0.04), transparent 70%)' }}>
        <button
          onClick={() => step > 0 ? setStep(step - 1) : handleClose()}
          className="flex items-center gap-1 text-[11px] font-medium transition-all"
          style={{ color: '#4a4a5e', padding: '4px 10px', border: '1px solid transparent', clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#FCEE0A'; e.currentTarget.style.borderColor = 'rgba(252,238,10,0.3)'; e.currentTarget.style.background = 'rgba(252,238,10,0.06)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#4a4a5e'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          {step === 0 ? 'Отмена' : 'Назад'}
        </button>

        {step < 2 ? (
          <button
            onClick={() => step === 1 ? goToStep2() : setStep(step + 1)}
            disabled={!canProceed()}
            className="flex items-center gap-1.5 text-[11px] font-bold h-8 px-4 transition-all disabled:opacity-40"
            style={{ color: '#000', background: 'linear-gradient(135deg, #FCEE0A, #F1F100)', boxShadow: '0 0 10px rgba(252,238,10,0.3)', clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))' }}
          >
            Далее
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={loading || editableStages.length === 0}
            className="flex items-center gap-1.5 text-[11px] font-bold h-8 px-5 transition-all disabled:opacity-40"
            style={{ color: '#000', background: 'linear-gradient(135deg, #FCEE0A, #FFD700)', boxShadow: '0 0 12px rgba(252,238,10,0.4)', clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))' }}
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Создать
          </button>
        )}
      </div>
    </div>
  );
}
