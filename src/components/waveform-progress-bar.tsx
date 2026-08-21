'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { hexToRgba } from '@/lib/utils';

/**
 * WaveformProgressBar — audio-waveform-style progress bar.
 *
 * Renders a row of vertical bars of pseudo-random heights (deterministic,
 * seeded by accentColor + barCount) — like an audio waveform / equalizer.
 *
 * Animation: on hover (and once on mount), the progress plays back from 0%
 * to the actual progress value — bars fill up left-to-right like a playback
 * cursor sweeping across the waveform until it reaches the current progress.
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
  const targetPct = Math.max(0, Math.min(100, Math.round(progress)));
  const hasProgress = targetPct > 0;

  // displayPct is the animated value that sweeps from 0 → targetPct.
  // It resets to 0 on hover-enter (and on mount), then animates up to targetPct.
  const [displayPct, setDisplayPct] = useState(0);
  const [hovered, setHovered] = useState(false);
  const rafRef = useRef<number | null>(null);
  const animRef = useRef<Animation | null>(null);

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

  // Playback animation: sweeps displayPct from 0 → targetPct.
  // Triggered on mount + on every hover-enter.
  // All setState calls happen inside requestAnimationFrame callbacks (async),
  // never synchronously within an effect body.
  const runPlayback = () => {
    // Cancel any in-flight animation
    if (animRef.current) {
      animRef.current.cancel();
      animRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    // Reset to 0 inside rAF so it's painted before the animation starts
    rafRef.current = requestAnimationFrame(() => {
      setDisplayPct(0);
      rafRef.current = requestAnimationFrame(() => {
        const start = performance.now();
        const duration = 1100; // ms — playback duration
        const tick = (now: number) => {
          const elapsed = now - start;
          const t = Math.min(1, elapsed / duration);
          // ease-out cubic for a natural "filling" feel
          const eased = 1 - Math.pow(1 - t, 3);
          const next = Math.round(eased * targetPct);
          setDisplayPct(next);
          if (t < 1) {
            rafRef.current = requestAnimationFrame(tick);
          } else {
            rafRef.current = null;
          }
        };
        rafRef.current = requestAnimationFrame(tick);
      });
    });
  };

  // One-time playback on mount (and when targetPct changes)
  useEffect(() => {
    rafRef.current = requestAnimationFrame(() => {
      setDisplayPct(0);
      rafRef.current = requestAnimationFrame(() => {
        const start = performance.now();
        const duration = 1100;
        const tick = (now: number) => {
          const elapsed = now - start;
          const t = Math.min(1, elapsed / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplayPct(Math.round(eased * targetPct));
          if (t < 1) {
            rafRef.current = requestAnimationFrame(tick);
          } else {
            rafRef.current = null;
          }
        };
        rafRef.current = requestAnimationFrame(tick);
      });
    });
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [targetPct]);

  const handleMouseEnter = () => {
    setHovered(true);
    runPlayback();
  };
  const handleMouseLeave = () => {
    setHovered(false);
    // Snap to final value when leaving (in case animation was mid-flight)
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setDisplayPct(targetPct);
  };

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
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Vertical equalizer bars — filled based on the animated displayPct */}
      {waveBars.map((barHeight, i) => {
        const barPct = ((i + 1) / barCount) * 100;
        const filled = barPct <= displayPct;
        const h = barHeight * (height - 4);
        return (
          <div
            key={i}
            className="flex-1"
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
              // Smooth transition so each bar fades/fills smoothly as the
              // playhead sweeps past it during the playback animation.
              transition: 'background 180ms ease, box-shadow 180ms ease, opacity 180ms ease, border 180ms ease',
            }}
          />
        );
      })}

      {/* Playhead line — sits exactly at the right edge of the filled bars.
          The bars area starts at left padding (4px) and spans
          `calc(100% - 2 * padding)`. So the playhead left = padding + (displayPct% of bars-area-width). */}
      {hasProgress && (
        <div
          className="absolute inset-y-0 pointer-events-none"
          style={{
            // 4px = container's left padding (px-1). The bars area is the
            // remaining width minus both paddings. Position the playhead at
            // the right edge of the filled bars.
            left: `calc(4px + (100% - 8px) * ${displayPct} / 100 - 1px)`,
            width: '2px',
            background: '#ffffff',
            boxShadow: `0 0 8px ${accentColor}, 0 0 14px ${hexToRgba(accentColor, 0.6)}`,
          }}
        />
      )}

      {/* Playhead glow — centered ON the playhead line (not ahead of it).
          Width 24px, centered so its midpoint aligns with the playhead line. */}
      {hovered && hasProgress && (
        <div
          className="absolute inset-y-0 pointer-events-none"
          style={{
            width: '24px',
            // Center the 24px glow on the playhead line position.
            left: `calc(4px + (100% - 8px) * ${displayPct} / 100 - 12px)`,
            background: `linear-gradient(90deg, transparent, ${hexToRgba(accentColor, 0.35)} 40%, ${hexToRgba('#ffffff', 0.5)} 50%, ${hexToRgba(accentColor, 0.35)} 60%, transparent)`,
            boxShadow: `0 0 10px ${hexToRgba(accentColor, 0.5)}`,
          }}
        />
      )}
    </div>
  );
}

export default WaveformProgressBar;
