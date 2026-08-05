'use client';

import { useEffect } from 'react';
import { useKanbanStore, BOARD_ONBOARDING } from '@/store/kanban-store';
import { Button } from '@/components/ui/button';
import { Sparkles, X, SkipForward, Plus, ArrowRight, Lightbulb, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function OnboardingHintPanel() {
  const {
    onboarding, boards, createOnboardingBoard, skipOnboardingBoard, dismissOnboarding,
    advanceGuideSubStep, isTrackWizardOpen, isCreating, trackWizardStep,
  } = useKanbanStore();

  const isGuidePhase = onboarding.phase === 'guide';
  const currentBoardId = onboarding.ghostBoardIds[onboarding.currentIndex];
  const currentBoard = boards.find(b => b.id === currentBoardId);
  const config = currentBoard ? BOARD_ONBOARDING[currentBoard.title] : undefined;
  const step = onboarding.currentIndex + 1;
  const total = onboarding.ghostBoardIds.length;
  const guideStep = isGuidePhase && onboarding.guideSubSteps[onboarding.guideSubIndex]
    ? onboarding.guideSubSteps[onboarding.guideSubIndex]
    : null;
  const guideTotal = onboarding.guideSubSteps.length;
  const guideStepNum = onboarding.guideSubIndex + 1;
  const isLastGuideStep = isGuidePhase && onboarding.guideSubIndex >= guideTotal - 1;

  // Auto-advance guide sub-steps when wizard step changes
  useEffect(() => {
    if (!onboarding.active || onboarding.phase !== 'guide') return;
    if (onboarding.guideBoardType !== 'tracks' || onboarding.guideSubIndex < 1) return;
    const expectedWizardStep = onboarding.guideSubIndex - 1;
    if (trackWizardStep > expectedWizardStep) {
      advanceGuideSubStep();
    }
  }, [trackWizardStep]);

  // Auto-advance when wizard/form closes after guide step 1+
  useEffect(() => {
    if (!onboarding.active || onboarding.phase !== 'guide' || onboarding.guideSubIndex < 1) return;
    if (onboarding.guideBoardType === 'tracks' && !isTrackWizardOpen && trackWizardStep === -1) {
      const remaining = onboarding.guideSubSteps.length - onboarding.guideSubIndex;
      for (let i = 0; i < remaining; i++) advanceGuideSubStep();
    }
    if (onboarding.guideBoardType !== 'tracks' && !isCreating) {
      const remaining = onboarding.guideSubSteps.length - onboarding.guideSubIndex;
      for (let i = 0; i < remaining; i++) advanceGuideSubStep();
    }
  }, [isTrackWizardOpen, isCreating, trackWizardStep]);

  // Action handler for guide step buttons
  const handleGuideAction = () => {
    if (!guideStep?.actionType) return;
    if (guideStep.actionType === 'open-wizard') {
      useKanbanStore.getState().setIsTrackWizardOpen(true);
    } else if (guideStep.actionType === 'create-task') {
      useKanbanStore.getState().setIsCreating(true);
    }
    setTimeout(() => advanceGuideSubStep(), 150);
  };

  // Animation key
  const animKey = isGuidePhase
    ? `${currentBoardId}-guide-${onboarding.guideSubIndex}`
    : currentBoardId;

  // Early returns AFTER all hooks
  if (!onboarding.active || !currentBoardId || !currentBoard) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={animKey}
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
        className="absolute top-3 left-1/2 -translate-x-1/2 z-30 w-[90%] max-w-md"
      >
        <div className={cn(
          'relative rounded-xl border overflow-hidden',
          isGuidePhase ? 'border-white/15 bg-[#0a0a16]/95' : 'border-white/10 bg-[#0c0c18]/95',
          'backdrop-blur-xl shadow-2xl shadow-black/50',
        )}>
          {/* Top accent line */}
          <div
            className={cn('h-[2px] w-full', isGuidePhase && 'onboarding-guide-glow')}
            style={{ background: `linear-gradient(90deg, transparent, ${currentBoard.color}, transparent)` }}
          />

          <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className={cn('w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-500',
                    isGuidePhase && 'guide-icon-pulse')}
                  style={{
                    backgroundColor: currentBoard.color + '20',
                    boxShadow: isGuidePhase
                      ? `0 0 16px ${currentBoard.color}50, 0 0 32px ${currentBoard.color}20`
                      : `0 0 12px ${currentBoard.color}30`,
                  }}
                >
                  {isGuidePhase
                    ? <Lightbulb className="w-3.5 h-3.5" style={{ color: currentBoard.color }} />
                    : <Sparkles className="w-3.5 h-3.5" style={{ color: currentBoard.color }} />
                  }
                </div>

                {isGuidePhase ? (
                  /* Guide: sub-step indicator */
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 font-medium">Подсказка</span>
                    <div
                      className="w-1.5 h-1.5 rounded-full animate-pulse"
                      style={{ backgroundColor: currentBoard.color, boxShadow: `0 0 8px ${currentBoard.color}80` }}
                    />
                    <span className="text-[10px] text-slate-600">{guideStepNum}/{guideTotal}</span>
                  </div>
                ) : (
                  /* Create: step counter + dots */
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 font-medium">Шаг</span>
                    <span className="text-xs font-bold text-white">{step}</span>
                    <span className="text-[10px] text-slate-600">из</span>
                    <span className="text-xs font-bold text-slate-400">{total}</span>
                    <div className="flex items-center gap-1 ml-1">
                      {onboarding.ghostBoardIds.map((_, i) => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                          style={{
                            backgroundColor: i < onboarding.currentIndex ? '#00ff88' : i === onboarding.currentIndex ? currentBoard.color : '#334155',
                            boxShadow: i === onboarding.currentIndex ? `0 0 6px ${currentBoard.color}60` : 'none',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button onClick={dismissOnboarding} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors group" title="Закрыть подсказки">
                <X className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors" />
              </button>
            </div>

            {isGuidePhase && guideStep ? (
              /* ===== GUIDE PHASE with sub-steps ===== */
              <div>
                {/* Board name badge (only on first sub-step) */}
                {onboarding.guideSubIndex === 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <div className="px-2 py-0.5 rounded-md text-[10px] font-semibold" style={{ backgroundColor: currentBoard.color + '15', color: currentBoard.color, border: `1px solid ${currentBoard.color}30` }}>
                      {currentBoard.title}
                    </div>
                    <span className="text-[10px] text-slate-600">✓ создана</span>
                  </div>
                )}

                {/* Sub-step progress dots (only if more than 1 sub-step) */}
                {guideTotal > 1 && (
                  <div className="flex items-center gap-1.5 mb-3">
                    {onboarding.guideSubSteps.map((_, i) => (
                      <div
                        key={i}
                        className="h-1 rounded-full transition-all duration-300"
                        style={{
                          width: i === onboarding.guideSubIndex ? 24 : 8,
                          backgroundColor: i < onboarding.guideSubIndex ? '#00ff88' : i === onboarding.guideSubIndex ? currentBoard.color : '#1e293b',
                          boxShadow: i === onboarding.guideSubIndex ? `0 0 6px ${currentBoard.color}60` : 'none',
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Guide step title */}
                {guideStep.title && (
                  <div className="mb-2">
                    <h3 className="text-sm font-semibold text-white">
                      <span className="guide-text-pulse" style={{ color: currentBoard.color }}>{guideStep.title}</span>
                    </h3>
                  </div>
                )}

                {/* Guide step description */}
                {guideStep.description && (
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">{guideStep.description}</p>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  {guideStep.actionText && guideStep.actionType && onboarding.guideSubIndex === 0 && (
                    <Button
                      size="sm"
                      onClick={handleGuideAction}
                      className="flex-1 h-8 text-xs font-medium gap-1.5 text-white transition-all guide-action-button"
                      style={{
                        background: `linear-gradient(135deg, ${currentBoard.color}, ${currentBoard.color}99)`,
                        boxShadow: `0 0 20px ${currentBoard.color}40, 0 0 40px ${currentBoard.color}15`,
                      }}
                    >
                      {guideStep.actionType === 'open-wizard'
                        ? <><Music className="w-3.5 h-3.5" /> {guideStep.actionText}</>
                        : <><Plus className="w-3.5 h-3.5" /> {guideStep.actionText}</>
                      }
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={advanceGuideSubStep}
                    className="h-8 text-xs text-slate-500 hover:text-slate-300 gap-1.5 hover:bg-white/5"
                  >
                    <ArrowRight className="w-3 h-3" />
                    {isLastGuideStep ? 'Далее' : 'Далее'}
                  </Button>
                </div>
              </div>
            ) : (
              /* ===== CREATE PHASE ===== */
              <div>
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: currentBoard.color, boxShadow: `0 0 8px ${currentBoard.color}80` }} />
                    <h3 className="text-sm font-semibold text-white">{config?.title || currentBoard.title}</h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed pl-4">
                    {config?.description || 'Создайте эту доску для начала работы'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={createOnboardingBoard}
                    className="flex-1 h-8 text-xs font-medium gap-1.5 text-white transition-all"
                    style={{ background: `linear-gradient(135deg, ${currentBoard.color}90, ${currentBoard.color}60)`, boxShadow: `0 0 16px ${currentBoard.color}30` }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Создать
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={skipOnboardingBoard}
                    className="h-8 text-xs text-slate-500 hover:text-slate-300 gap-1.5 hover:bg-white/5"
                  >
                    <SkipForward className="w-3 h-3" />
                    Пропустить
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom glow */}
          <div
            className={cn('absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-8 blur-xl pointer-events-none',
              isGuidePhase && 'guide-bottom-glow')}
            style={{ backgroundColor: currentBoard.color, opacity: isGuidePhase ? 0.3 : 0.2 }}
          />
        </div>
      </motion.div>

      <style>{`
        .guide-icon-pulse { animation: guideIconPulse 2s ease-in-out infinite; }
        @keyframes guideIconPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
        .guide-text-pulse { animation: guideTextPulse 2.5s ease-in-out infinite; }
        @keyframes guideTextPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.8; } }
        .guide-action-button { animation: guideButtonGlow 2s ease-in-out infinite; }
        @keyframes guideButtonGlow { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.15); } }
        .guide-bottom-glow { animation: guideGlowPulse 2.5s ease-in-out infinite; }
        @keyframes guideGlowPulse { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.35; } }
        .onboarding-guide-glow { animation: guideAccentPulse 2s ease-in-out infinite; }
        @keyframes guideAccentPulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
      `}</style>
    </AnimatePresence>
  );
}
