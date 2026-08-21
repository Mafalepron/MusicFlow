'use client';

import { useState } from 'react';
import { hexToRgba } from '@/lib/utils';

/**
 * WaveformProgressBar — solid HUD-style progress bar.
 *
 * Redesigned from individual equalizer bars to a single solid fill bar
 * with a neon outline around the unfilled portion of the track.
 *
 * Visual language:
 *  - Solid filled portion (width = progress%) using accentColor + glow
 *  - Outlined unfilled portion (the remaining track space) with accentColor stroke
 *  - Subtle HUD scanlines in the unfilled area for cyberpunk feel
 *  - Playhead sweep animation on hover
 */
export function WaveformProgressBar({
  progress,
  accentColor,
  height = 40,
  bars: _barCount = 32,
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

  return (
    <div
      className="relative overflow-hidden"
      style={{
        height: `${height}px`,
        background: 'rgba(0,0,0,0.55)',
        borderRadius: '2px',
        // Stroke / outline around the (unfilled) scale — neon accent border
        border: `1px solid ${hexToRgba(accentColor, 0.45)}`,
        boxShadow: `inset 0 1px 2px rgba(0,0,0,0.7), 0 0 6px ${hexToRgba(accentColor, 0.12)}`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Solid filled portion (left→right up to pct%) */}
      <div
        className="absolute inset-y-0 left-0"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(to right, ${hexToRgba(accentColor, 0.85)}, ${accentColor})`,
          boxShadow: `0 0 10px ${hexToRgba(accentColor, 0.7)}, inset 0 1px 0 ${hexToRgba('#ffffff', 0.25)}`,
          transition: 'width 320ms ease',
        }}
      />

      {/* Subtle HUD scanlines in the unfilled portion for cyberpunk feel */}
      <div
        className="absolute inset-y-0 right-0 pointer-events-none"
        style={{
          width: `${100 - pct}%`,
          backgroundImage: `repeating-linear-gradient(90deg, ${hexToRgba(accentColor, 0.07)} 0, ${hexToRgba(accentColor, 0.07)} 1px, transparent 1px, transparent 8px)`,
          opacity: hovered ? 0.95 : 0.55,
          transition: 'opacity 240ms ease',
        }}
      />

      {/* Center axis line — subtle horizontal mid line */}
      <div
        className="absolute left-0 right-0 top-1/2 h-px pointer-events-none"
        style={{ background: hexToRgba('#ffffff', 0.06) }}
      />

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
            ['--kb5-progress' as string]: `${pct}%`,
            animation: 'kb5-playhead-sweep 1.6s ease-out',
            boxShadow: `0 0 10px ${hexToRgba(accentColor, 0.5)}`,
          }}
        />
      )}
    </div>
  );
}

export default WaveformProgressBar;
