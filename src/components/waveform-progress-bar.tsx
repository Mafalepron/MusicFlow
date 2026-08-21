'use client';

import { useState, useMemo } from 'react';
import { hexToRgba } from '@/lib/utils';

/**
 * WaveformProgressBar — audio-waveform-style progress bar.
 *
 * Renders a row of vertical bars of pseudo-random heights (deterministic,
 * seeded by accentColor + barCount) — like an audio waveform / equalizer.
 * Bars are "filled" (colored + glowing) up to the progress %, "unfilled"
 * (dim outline) for the remainder.
 *
 * Visual language:
 *  - Vertical equalizer bars that look like an audio waveform
 *  - Filled bars use accentColor + neon glow + bounce animation on hover
 *  - Unfilled bars use a thin accentColor outline (stroke around the scale)
 *  - Playhead sweep animation on hover
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
  // Clamp + normalize
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const hasProgress = pct > 0;

  // Deterministic pseudo-random bar heights (seeded by accentColor + barCount)
  // so the waveform shape is stable across renders.
  const waveBars = useMemo(() => {
    const seed = (accentColor + barCount).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const arr: number[] = [];
    let s = seed;
    for (let i = 0; i < barCount; i++) {
      // Simple LCG pseudo-random
      s = (s * 9301 + 49297) % 233280;
      const rnd = s / 233280;
      // Bar height: between 25% and 100% of available height
      // Create a wave-like envelope so it looks like audio
      const envelope = 0.4 + 0.6 * Math.abs(Math.sin((i / barCount) * Math.PI * 3));
      arr.push(0.25 + rnd * 0.75 * envelope);
    }
    return arr;
  }, [accentColor, barCount]);

  return (
    <div
      className="relative overflow-hidden flex items-center gap-[2px] px-1"
      style={{
        height: `${height}px`,
        background: 'rgba(0,0,0,0.55)',
        borderRadius: '2px',
        // Stroke / outline around the whole scale — neon accent border
        border: `1px solid ${hexToRgba(accentColor, 0.4)}`,
        boxShadow: `inset 0 1px 2px rgba(0,0,0,0.7), 0 0 6px ${hexToRgba(accentColor, 0.12)}`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Vertical equalizer bars */}
      {waveBars.map((barHeight, i) => {
        const filled = ((i + 1) / barCount) * 100 <= pct;
        const h = barHeight * (height - 4);
        return (
          <div
            key={i}
            className="flex-1 transition-all duration-200"
            style={{
              height: `${h}px`,
              minWidth: '2px',
              maxWidth: '4px',
              background: filled
                ? accentColor
                : hexToRgba(accentColor, 0.18),
              boxShadow: filled
                ? `0 0 4px ${hexToRgba(accentColor, 0.8)}, 0 0 8px ${hexToRgba(accentColor, 0.4)}`
                : 'none',
              border: filled
                ? 'none'
                : `0.5px solid ${hexToRgba(accentColor, 0.3)}`,
              opacity: filled ? 1 : 0.6,
              animation: filled && hovered
                ? 'kb5-eq-bounce 0.6s ease-in-out infinite'
                : 'none',
              animationDelay: filled ? `${(i % 8) * 60}ms` : '0ms',
              transform: filled && hovered ? 'scaleY(1.05)' : 'scaleY(1)',
            }}
          />
        );
      })}

      {/* Playhead line at the fill boundary */}
      {hasProgress && (
        <div
          className="absolute inset-y-0 pointer-events-none"
          style={{
            left: `calc(${pct}% - 1px)`,
            width: '2px',
            background: '#ffffff',
            boxShadow: `0 0 8px ${accentColor}, 0 0 14px ${hexToRgba(accentColor, 0.6)}`,
            transition: 'left 320ms ease',
          }}
        />
      )}

      {/* Playhead sweep — only animates on hover AND when there's progress */}
      {hovered && hasProgress && (
        <div
          className="absolute inset-y-0 pointer-events-none"
          style={{
            width: '24px',
            background: `linear-gradient(90deg, transparent, ${hexToRgba(accentColor, 0.3)} 40%, ${hexToRgba('#ffffff', 0.4)} 50%, ${hexToRgba(accentColor, 0.3)} 60%, transparent)`,
            animation: 'kb5-playhead-sweep 1.6s ease-out',
            boxShadow: `0 0 10px ${hexToRgba(accentColor, 0.5)}`,
          }}
        />
      )}

      {/* Inline keyframes for bounce + sweep animations */}
      <style>{`
        @keyframes kb5-eq-bounce {
          0%, 100% { transform: scaleY(0.85); }
          50% { transform: scaleY(1.15); }
        }
        @keyframes kb5-playhead-sweep {
          0% { transform: translateX(-100%); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateX(calc(100% + 24px)); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default WaveformProgressBar;
