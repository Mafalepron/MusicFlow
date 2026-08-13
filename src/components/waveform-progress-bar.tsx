'use client';

import { useState, useMemo } from 'react';
import { hexToRgba } from '@/lib/utils';

/**
 * WaveformProgressBar — animated equalizer-style progress bar.
 *
 * Extracted from src/components/views/home-view.tsx so it can be shared by
 * the Home view cards and the Track-detail progress panel.
 *
 * Visual language: dark recessed track, gold/cyan waveform bars, animated
 * "playhead sweep" on hover, percentage label in the top-right corner.
 * Relies on the global `kb5-eq-bounce` and `kb5-playhead-sweep` keyframes
 * defined in `src/app/cyberpunk.css`.
 */
export function WaveformProgressBar({
  progress,
  accentColor,
  height = 40,
  bars: barCount = 32,
}: {
  progress: number;
  accentColor: string;
  height?: number;
  bars?: number;
}) {
  const [hovered, setHovered] = useState(false);
  const [h, setH] = useState(false);
  // Clamp + normalize
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const hasProgress = pct > 0;
  // Deterministic waveform shape (pseudo-random from accentColor + bars count for stability)
  const waveBars = useMemo(() => {
    const seed = accentColor.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + barCount * 17;
    return Array.from({ length: barCount }, (_, i) => {
      const base = 0.45 + 0.35 * Math.sin((i / barCount) * Math.PI * 4 + (seed % 7));
      const harm = 0.15 * Math.sin((i / barCount) * Math.PI * 11 + (seed % 13));
      const noise = ((seed * (i + 3) * 7) % 23) / 100 - 0.1;
      return Math.max(0.15, Math.min(0.95, base + harm + noise));
    });
  }, [accentColor, barCount]);

  return (
    <div
      className="relative overflow-hidden"
      style={{
        height: `${height}px`,
        background: 'rgba(0,0,0,0.4)',
        borderRadius: '2px',
        border: `0.5px solid ${hexToRgba(accentColor, 0.2)}`,
      }}
      onMouseEnter={() => { setHovered(true); setH(true); }}
      onMouseLeave={() => { setHovered(false); setH(false); }}
    >
      {/* Center axis line */}
      <div className="absolute left-0 right-0 top-1/2 h-px pointer-events-none" style={{ background: hexToRgba(accentColor, 0.15) }} />

      {/* Waveform bars */}
      <div className="absolute inset-0 flex items-center justify-between px-1 pointer-events-none">
        {waveBars.map((v, i) => {
          // Bar is "filled" if it's within the progress region (left→right)
          const barProgressPct = ((i + 1) / barCount) * 100;
          const isFilled = hasProgress && barProgressPct <= pct;
          // On hover with progress, bars up to pct animate; bars beyond pct stay muted
          const shouldAnimate = hovered && hasProgress && isFilled;
          return (
            <div
              key={i}
              style={{
                width: '2px',
                height: `${Math.round(v * 100)}%`,
                background: isFilled ? accentColor : hexToRgba(accentColor, 0.18),
                opacity: isFilled ? (h ? 1 : 0.75) : 0.5,
                boxShadow: isFilled ? `0 0 3px ${hexToRgba(accentColor, 0.7)}` : 'none',
                transformOrigin: 'center',
                borderRadius: '0.5px',
                // CSS variable for equalizer base height (so keyframe can scale around it)
                ['--kb5-base' as string]: v,
                animation: shouldAnimate ? `kb5-eq-bounce ${0.9 + (i % 5) * 0.18}s ease-in-out ${(i * 0.05).toFixed(2)}s infinite` : 'none',
                transition: 'opacity 280ms ease, background 280ms ease, box-shadow 280ms ease',
              }}
            />
          );
        })}
      </div>

      {/* Playhead sweep — only animates on hover AND when there's progress */}
      {hovered && hasProgress && (
        <div
          className="absolute inset-y-0 pointer-events-none"
          style={{
            width: '24px',
            background: `linear-gradient(90deg, transparent, ${hexToRgba(accentColor, 0.3)} 40%, ${hexToRgba('#ffffff', 0.4)} 50%, ${hexToRgba(accentColor, 0.3)} 60%, transparent)`,
            ['--kb5-progress' as string]: `${pct}%`,
            animation: 'kb5-playhead-sweep 1.6s ease-out',
            boxShadow: `0 0 10px ${hexToRgba(accentColor, 0.5)}`,
          }}
        >
          {/* Playhead vertical line */}
          <div className="absolute inset-y-0 left-1/2 w-px" style={{ background: '#ffffff', boxShadow: `0 0 6px ${accentColor}` }} />
        </div>
      )}
    </div>
  );
}

export default WaveformProgressBar;
