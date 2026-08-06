'use client';

import React, { useState, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover, PopoverTrigger, PopoverContent,
} from '@/components/ui/popover';
import {
  CalendarDays, Clock, AlertTriangle, Check, X, Zap, Flame,
} from 'lucide-react';
import { cn, hexToRgba } from '@/lib/utils';

interface DeadlinePickerProps {
  value: string | null; // ISO string or null
  onChange: (date: string | null) => void;
  size?: 'sm' | 'md';
  isDone?: boolean;
  inline?: boolean;
  className?: string;
  boardColor?: string;
}

const MONTHS_RU = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function getPresetDate(preset: string): Date {
  const now = new Date();
  switch (preset) {
    case 'today':
      return now;
    case 'tomorrow': {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      return d;
    }
    case '3days': {
      const d = new Date(now);
      d.setDate(d.getDate() + 3);
      return d;
    }
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() + 7);
      return d;
    }
    case '2weeks': {
      const d = new Date(now);
      d.setDate(d.getDate() + 14);
      return d;
    }
    case 'month': {
      const d = new Date(now);
      d.setMonth(d.getMonth() + 1, 0);
      return d;
    }
    default:
      return now;
  }
}

const PRESETS: { key: string; label: string; icon: typeof Zap }[] = [
  { key: 'today', label: 'Сегодня', icon: Zap },
  { key: 'tomorrow', label: 'Завтра', icon: Clock },
  { key: '3days', label: 'Через 3 дня', icon: Clock },
  { key: 'week', label: 'Через неделю', icon: CalendarDays },
  { key: '2weeks', label: 'Через 2 недели', icon: CalendarDays },
  { key: 'month', label: 'Конец месяца', icon: Flame },
];

export default function DeadlinePicker({
  value, onChange, size = 'sm', isDone = false, inline = false, className, boardColor = '#00d9ff',
}: DeadlinePickerProps) {
  const [open, setOpen] = useState(false);

  const deadlineDate = value ? new Date(value) : null;
  const { daysLeft, status } = useMemo(() => getDeadlineInfo(value), [value]);

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      onChange(null);
    } else {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      onChange(`${y}-${m}-${d}`);
    }
    setOpen(false);
  };

  const handlePreset = (presetKey: string) => {
    const d = getPresetDate(presetKey);
    handleSelect(d);
  };

  const handleClear = () => {
    onChange(null);
    setOpen(false);
  };

  if (inline) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-all duration-150 cursor-pointer border border-transparent',
              !value && 'text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10',
              value && status === 'overdue' && !isDone && 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/20',
              value && status === 'urgent' && !isDone && 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/20',
              value && status === 'soon' && !isDone && 'bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-500/20',
              value && !isDone && status === 'ok' && 'bg-slate-700/30 hover:bg-slate-700/50',
            )}
          >
            <CalendarDays className={cn(
              size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5',
              !value ? 'text-slate-500' :
              status === 'overdue' && !isDone ? 'text-rose-400' :
              status === 'urgent' && !isDone ? 'text-amber-400' :
              status === 'soon' && !isDone ? 'text-cyan-400' :
              isDone ? 'text-emerald-500' : 'text-slate-400'
            )} />
            {value ? (
              <>
                <span className={cn(
                  'font-medium transition-colors',
                  size === 'sm' ? 'text-[9px]' : 'text-[10px]',
                  status === 'overdue' && !isDone ? 'text-rose-400' :
                  status === 'urgent' && !isDone ? 'text-amber-400' :
                  status === 'soon' && !isDone ? 'text-cyan-400' :
                  isDone ? 'text-emerald-500' : 'text-slate-300',
                )}>
                  {String(new Date(value).getDate()).padStart(2, '0')} {MONTHS_RU[new Date(value).getMonth()]}
                </span>
                {status === 'overdue' && !isDone && (
                  <span className="text-[8px] font-bold text-rose-400 animate-pulse">!</span>
                )}
              </>
            ) : (
              <span className={size === 'sm' ? 'text-[9px]' : 'text-[10px]'}>дедлайн</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 shadow-2xl shadow-black/40 z-[60] border-0 rounded-none"
          style={{
            background: 'rgba(8, 10, 18, 0.97)',
            border: `1.5px solid ${hexToRgba(boardColor, 0.4)}`,
            clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
            boxShadow: `0 0 24px ${hexToRgba(boardColor, 0.15)}, 0 8px 32px rgba(0,0,0,0.6)`,
          }}
          align="start"
          sideOffset={8}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {/* Presets row */}
          <div className="border-b border-slate-800/80 px-3 py-2">
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((p) => {
                const PresetIcon = p.icon;
                return (
                  <button
                    key={p.key}
                    onClick={() => handlePreset(p.key)}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md
                      bg-slate-800/60 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10
                      transition-all duration-150 hover:scale-[1.03] active:scale-95"
                  >
                    <PresetIcon className="w-2.5 h-2.5" />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Calendar */}
          <div className="p-2">
            <Calendar
              mode="single"
              selected={deadlineDate || undefined}
              onSelect={handleSelect}
              defaultMonth={deadlineDate || new Date()}
              className="bg-transparent p-0 [--cell-size:1.5rem]"
              classNames={{
                root: 'w-fit',
                months: 'flex flex-col w-full',
                month: 'flex flex-col w-full gap-1',
                nav: 'flex items-center justify-between w-full px-1',
                button_previous: 'h-6 w-6 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded',
                button_next: 'h-6 w-6 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded',
                month_caption: 'flex items-center justify-center h-6 w-full text-slate-300 font-medium text-xs',
                caption_label: 'text-xs text-slate-300',
                table: 'w-full border-collapse mt-1',
                weekdays: 'flex w-full',
                weekday: 'text-slate-600 text-[10px] font-normal flex-1 text-center py-0.5',
                week: 'flex w-full mt-0.5',
                day: 'relative w-full p-0 text-center aspect-square select-none',
                today: 'rounded-md',
                outside: 'text-slate-700',
                disabled: 'text-slate-700 opacity-40',
                hidden: 'invisible',
              }}
              formatters={{
                formatCaption: (date) => MONTHS_RU[date.getMonth()],
                formatWeekdayName: (date) => WEEKDAYS_SHORT[date.getDay() === 0 ? 6 : date.getDay() - 1],
              }}
              components={{
                DayButton: ({ day, modifiers, ...props }) => {
                  const isSelected = modifiers.selected;
                  const isToday = modifiers.today;
                  const d = day.date;

                  return (
                    <button
                      {...props}
                      className={cn(
                        'w-6 h-6 text-[10px] rounded-md flex items-center justify-center transition-all duration-150 relative',
                        !isSelected && 'hover:bg-slate-800 text-slate-300 hover:text-white',
                        isToday && !isSelected && 'ring-1 ring-cyan-500/40 text-cyan-400 font-semibold',
                        isSelected && 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-md shadow-cyan-500/20 scale-105',
                      )}
                    >
                      {d.getDate()}
                    </button>
                  );
                },
              }}
            />
          </div>

          {/* Footer */}
          {value && (
            <div className="border-t border-slate-800/80 px-3 py-2 flex items-center justify-between">
              <DeadlineTimeInfo daysLeft={daysLeft} status={status} isDone={isDone} />
              <button
                onClick={handleClear}
                className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-rose-400
                  transition-colors duration-150 px-1.5 py-0.5 rounded hover:bg-rose-500/10"
              >
                <X className="w-3 h-3" />
                Сбросить
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'group flex items-center gap-1.5 rounded-lg transition-all duration-200',
            size === 'sm' ? 'px-2 py-1' : 'px-2.5 py-1.5',
            'hover:bg-slate-800/80',
            status === 'overdue' && !isDone && 'hover:bg-rose-500/10',
            status === 'urgent' && !isDone && 'hover:bg-amber-500/10',
            className,
          )}
        >
          {value ? (
            <DeadlineDisplay deadlineDate={deadlineDate!} daysLeft={daysLeft} status={status} isDone={isDone} size={size} />
          ) : (
            <DeadlinePlaceholder size={size} />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 shadow-2xl shadow-black/40 border-0 rounded-none"
        style={{
          background: 'rgba(8, 10, 18, 0.97)',
          border: `1.5px solid ${hexToRgba(boardColor, 0.4)}`,
          clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
          boxShadow: `0 0 24px ${hexToRgba(boardColor, 0.15)}, 0 8px 32px rgba(0,0,0,0.6)`,
        }}
        align="start"
        sideOffset={8}
      >
        {/* Presets row */}
        <div className="border-b border-slate-800/80 px-3 py-2">
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => {
              const PresetIcon = p.icon;
              return (
                <button
                  key={p.key}
                  onClick={() => handlePreset(p.key)}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md
                    bg-slate-800/60 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10
                    transition-all duration-150 hover:scale-[1.03] active:scale-95"
                >
                  <PresetIcon className="w-2.5 h-2.5" />
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Calendar */}
        <div className="p-2">
          <Calendar
            mode="single"
            selected={deadlineDate || undefined}
            onSelect={handleSelect}
            disabled={{ before: new Date() }}
            defaultMonth={deadlineDate || new Date()}
            className="bg-transparent p-0 [--cell-size:1.5rem]"
            classNames={{
              root: 'w-fit',
              months: 'flex flex-col w-full',
              month: 'flex flex-col w-full gap-1',
              nav: 'flex items-center justify-between w-full px-1',
              button_previous: 'h-6 w-6 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded',
              button_next: 'h-6 w-6 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded',
              month_caption: 'flex items-center justify-center h-6 w-full text-slate-300 font-medium text-xs',
              caption_label: 'text-xs text-slate-300',
              table: 'w-full border-collapse mt-1',
              weekdays: 'flex w-full',
              weekday: 'text-slate-600 text-[10px] font-normal flex-1 text-center py-0.5',
              week: 'flex w-full mt-0.5',
              day: 'relative w-full p-0 text-center aspect-square select-none',
              today: 'rounded-md',
              outside: 'text-slate-700',
              disabled: 'text-slate-700 opacity-40',
              hidden: 'invisible',
            }}
            formatters={{
              formatCaption: (date) => MONTHS_RU[date.getMonth()],
              formatWeekdayName: (date) => WEEKDAYS_SHORT[date.getDay() === 0 ? 6 : date.getDay() - 1],
            }}
            components={{
              DayButton: ({ day, modifiers, ...props }) => {
                const isSelected = modifiers.selected;
                const isToday = modifiers.today;
                const isDisabled = modifiers.disabled;
                const d = day.date;
                const dlInfo = value ? getDeadlineInfo(value) : null;
                const isDeadline = dlInfo && d.toDateString() === new Date(value!).toDateString();
                
                return (
                  <button
                    {...props}
                    disabled={isDisabled}
                    className={cn(
                      'w-6 h-6 text-[10px] rounded-md flex items-center justify-center transition-all duration-150 relative',
                      isDisabled && 'opacity-30 cursor-not-allowed',
                      !isDisabled && !isSelected && 'hover:bg-slate-800 text-slate-300 hover:text-white',
                      isToday && !isSelected && 'ring-1 ring-cyan-500/40 text-cyan-400 font-semibold',
                      isSelected && 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-md shadow-cyan-500/20 scale-105',
                    )}
                  >
                    {d.getDate()}
                    {isDeadline && (
                      <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-0.5 h-0.5 rounded-full bg-cyan-400" />
                    )}
                  </button>
                );
              },
            }}
          />
        </div>

        {/* Footer */}
        {value && (
          <div className="border-t border-slate-800/80 px-3 py-2 flex items-center justify-between">
            <DeadlineTimeInfo daysLeft={daysLeft} status={status} isDone={isDone} />
            <button
              onClick={handleClear}
              className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-rose-400
                transition-colors duration-150 px-1.5 py-0.5 rounded hover:bg-rose-500/10"
            >
              <X className="w-3 h-3" />
              Сбросить
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ── Sub-components ──────────────────────────── */

function DeadlineDisplay({
  deadlineDate, daysLeft, status, isDone, size,
}: {
  deadlineDate: Date;
  daysLeft: number;
  status: 'ok' | 'soon' | 'urgent' | 'overdue' | 'done';
  isDone: boolean;
  size: 'sm' | 'md';
}) {
  const day = String(deadlineDate.getDate()).padStart(2, '0');
  const month = MONTHS_RU[deadlineDate.getMonth()];
  const isSmall = size === 'sm';

  return (
    <>
      <CalendarDays className={cn(
        'flex-shrink-0 transition-colors duration-200',
        isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4',
        status === 'overdue' && !isDone ? 'text-rose-400' :
        status === 'urgent' && !isDone ? 'text-amber-400' :
        status === 'soon' && !isDone ? 'text-cyan-400' :
        isDone ? 'text-emerald-500' : 'text-slate-500',
      )} />
      <span className={cn(
        'font-medium transition-colors duration-200',
        isSmall ? 'text-[11px]' : 'text-xs',
        status === 'overdue' && !isDone ? 'text-rose-400' :
        status === 'urgent' && !isDone ? 'text-amber-400' :
        status === 'soon' && !isDone ? 'text-cyan-300' :
        isDone ? 'text-emerald-500' : 'text-slate-300',
      )}>
        {day} {month}
      </span>
      {!isDone && status !== 'ok' && (
        <DeadlineBadge daysLeft={daysLeft} status={status} />
      )}
      {isDone && (
        <Check className="w-3 h-3 text-emerald-500" />
      )}
    </>
  );
}

function DeadlineBadge({ daysLeft, status }: { daysLeft: number; status: string }) {
  if (status === 'overdue') {
    return (
      <span className="flex items-center gap-0.5 text-[9px] font-bold text-rose-400 bg-rose-500/15 px-1.5 py-0.5 rounded-full animate-pulse">
        <AlertTriangle className="w-2.5 h-2.5" />
        {Math.abs(daysLeft)}д
      </span>
    );
  }
  if (status === 'urgent') {
    return (
      <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-full">
        <Flame className="w-2.5 h-2.5" />
        {daysLeft}д
      </span>
    );
  }
  if (status === 'soon') {
    return (
      <span className="text-[9px] font-medium text-cyan-400 bg-cyan-500/15 px-1.5 py-0.5 rounded-full">
        {daysLeft}д
      </span>
    );
  }
  return null;
}

function DeadlinePlaceholder({ size }: { size: 'sm' | 'md' }) {
  return (
    <>
      <CalendarDays className={cn(
        'text-slate-700 group-hover:text-slate-500 transition-colors',
        size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4',
      )} />
      <span className={cn(
        'text-slate-600 group-hover:text-slate-400 transition-colors',
        size === 'sm' ? 'text-[11px]' : 'text-xs',
      )}>
        Дедлайн
      </span>
    </>
  );
}

function DeadlineTimeInfo({ daysLeft, status, isDone }: { daysLeft: number; status: string; isDone: boolean }) {
  if (isDone) {
    return (
      <span className="text-[10px] text-emerald-500 font-medium">Завершено ✓</span>
    );
  }
  if (status === 'overdue') {
    const days = Math.abs(daysLeft);
    const text = days === 1 ? 'Просрочен на 1 день' : `Просрочен на ${days} дн.`;
    return (
      <span className="text-[10px] text-rose-400 font-medium flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        {text}
      </span>
    );
  }
  if (status === 'urgent') {
    const text = daysLeft === 1 ? 'Остался 1 день!' : `Осталось ${daysLeft} дн.!`;
    return (
      <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
        <Flame className="w-3 h-3" />
        {text}
      </span>
    );
  }
  if (status === 'soon') {
    const text = daysLeft === 1 ? 'Остался 1 день' : `Осталось ${daysLeft} дн.`;
    return (
      <span className="text-[10px] text-cyan-400 font-medium flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {text}
      </span>
    );
  }
  return (
    <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
      <Check className="w-3 h-3" />
      Дедлайн установлен
    </span>
  );
}

const InlineDeadlineButton = React.forwardRef<
  HTMLSpanElement,
  {
    value: string | null;
    daysLeft: number;
    status: 'ok' | 'soon' | 'urgent' | 'overdue' | 'done';
    isDone: boolean;
    size: 'sm' | 'md';
  }
>(function InlineDeadlineButton({ value, daysLeft, status, isDone, size }, ref) {
  if (!value) {
    return (
      <span
        ref={ref}
        role="button"
        tabIndex={0}
        className="flex items-center gap-1 text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer px-1.5 py-0.5 rounded-md hover:bg-cyan-500/10 border border-transparent select-none"
      >
        <CalendarDays className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        <span className={size === 'sm' ? 'text-[9px]' : 'text-[10px]'}>дедлайн</span>
      </span>
    );
  }
  const d = new Date(value);
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTHS_RU[d.getMonth()];
  const isSmall = size === 'sm';

  return (
    <span
      ref={ref}
      role="button"
      tabIndex={0}
      className={cn(
        'flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-all duration-150 cursor-pointer border border-transparent select-none',
        status === 'overdue' && !isDone && 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/20',
        status === 'urgent' && !isDone && 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/20',
        status === 'soon' && !isDone && 'bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-500/20',
        !isDone && status === 'ok' && 'bg-slate-700/30 hover:bg-slate-700/50',
      )}
    >
      <CalendarDays className={cn(
        isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5',
        status === 'overdue' && !isDone ? 'text-rose-400' :
        status === 'urgent' && !isDone ? 'text-amber-400' :
        status === 'soon' && !isDone ? 'text-cyan-400' :
        isDone ? 'text-emerald-500' : 'text-slate-400'
      )} />
      <span className={cn(
        'font-medium transition-colors',
        isSmall ? 'text-[9px]' : 'text-[10px]',
        status === 'overdue' && !isDone ? 'text-rose-400' :
        status === 'urgent' && !isDone ? 'text-amber-400' :
        status === 'soon' && !isDone ? 'text-cyan-400' :
        isDone ? 'text-emerald-500' : 'text-slate-300',
      )}>
        {day} {month}
      </span>
      {status === 'overdue' && !isDone && (
        <span className="text-[8px] font-bold text-rose-400 animate-pulse">!</span>
      )}
    </span>
  );
});

/* ── Helpers ──────────────────────────────────── */

function getDeadlineInfo(value: string | null): { daysLeft: number; status: 'ok' | 'soon' | 'urgent' | 'overdue' | 'done' } {
  if (!value) return { daysLeft: 0, status: 'ok' };
  const deadline = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  const diffMs = deadline.getTime() - today.getTime();
  const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return { daysLeft, status: 'overdue' };
  if (daysLeft === 0) return { daysLeft, status: 'urgent' };
  if (daysLeft <= 3) return { daysLeft, status: 'urgent' };
  if (daysLeft <= 7) return { daysLeft, status: 'soon' };
  return { daysLeft, status: 'ok' };
}

export { getDeadlineInfo, MONTHS_RU };
