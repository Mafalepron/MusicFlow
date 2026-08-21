'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { hexToRgba } from '@/lib/utils';

/**
 * WaveformProgressBar — audio-waveform-style progress bar.
 *
 * Renders a row of vertical bars of pseudo-random heights (deterministic,
 * seeded by accentColor + barCount) — like an audio waveform / equalizer.
 *
 * The bars fill the ENTIRE frame edge-to-edge (no gaps). The fill is driven
 * by a continuous `displayPct` so each bar is partially filled based on how
 * much of its width falls within the progress — the white playhead line sits
 * exactly at the right edge of the filled area at all times.
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
  const [displayPct, setDisplayPct] = useState(0);
  const [hovered, setHovered] = useState(false);
  const rafRef = useRef<number | null>(null);

  // Deterministic pseudo-random bar heights (seeded by accentColor + barCount)
  // so the waveform shape is stable across renders.
  const waveBars = useMemo(() => {
    const seed = (accentColor + barCount).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const arr: number[] = [];
    let s = seed;
    for (let i = 0; i < barCount; i++) {
      s = (s * 9301 + 49297) % 233280;
      const rnd = s / 233280;
      // Wave-like envelope so it looks like audio
      const envelope = 0.4 + 0.6 * Math.abs(Math.sin((i / barCount) * Math.PI * 3));
      arr.push(0.25 + rnd * 0.75 * envelope);
    }
    return arr;
  }, [accentColor, barCount]);

  // Playback animation: sweeps displayPct from 0 → targetPct.
  const runPlayback = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
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
  };

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
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setDisplayPct(targetPct);
  };

  return (
    <div
      className="relative overflow-hidden"
      style={{
        height: `${height}px`,
        background: 'rgba(0,0,0,0.55)',
        borderRadius: '2px',
        border: `1px solid ${hexToRgba(accentColor, 0.4)}`,
        boxShadow: `inset 0 1px 2px rgba(0,0,0,0.7), 0 0 6px ${hexToRgba(accentColor, 0.12)}`,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Bars layer — fills the ENTIRE frame edge-to-edge (no padding, no gaps).
          Uses an absolute-positioned flex row so bars span 100% width. */}
      <div
        className="absolute inset-0 flex items-stretch"
        style={{ gap: '1px', padding: '1px' }}
      >
        {waveBars.map((barHeight, i) => {
          // Each bar occupies a slice [i/n, (i+1)/n] of the total width.
          // The bar is "filled" up to where the playhead (displayPct) falls.
          // barStart = i/n * 100, barEnd = (i+1)/n * 100.
          const barStart = (i / barCount) * 100;
          const barEnd = ((i + 1) / barCount) * 100;
          // fillPct: how much of THIS bar is filled (0-100).
          // If playhead is past barEnd → fully filled (100).
          // If playhead is before barStart → empty (0).
          // If playhead is within this bar → partial.
          let fillPct: number;
          if (displayPct >= barEnd) {
            fillPct = 100;
          } else if (displayPct <= barStart) {
            fillPct = 0;
          } else {
            fillPct = ((displayPct - barStart) / (barEnd - barStart)) * 100;
          }
          const isFilled = fillPct > 0;
          const h = barHeight * 100; // percentage of bar row height
          return (
            <div
              key={i}
              className="relative flex-1 min-w-0"
              style={{ height: `${h}%`, alignSelf: 'center' }}
            >
              {/* Unfilled base — dim outline bar (the "track" background) */}
              <div
                className="absolute inset-0"
                style={{
                  background: hexToRgba(accentColor, 0.15),
                  border: `0.5px solid ${hexToRgba(accentColor, 0.3)}`,
                  opacity: isFilled ? 0.5 : 0.7,
                  transition: 'opacity 180ms ease',
                }}
              />
              {/* Filled overlay — clips to fillPct from the left.
                  Uses a left-anchored inner div with width = fillPct% so the
                  fill grows continuously as the playhead sweeps through. */}
              {isFilled && (
                <div
                  className="absolute inset-y-0 left-0 overflow-hidden"
                  style={{ width: `${fillPct}%` }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      background: accentColor,
                      boxShadow: `0 0 4px ${hexToRgba(accentColor, 0.8)}, 0 0 8px ${hexToRgba(accentColor, 0.4)}`,
                      transition: 'background 180ms ease, box-shadow 180ms ease',
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Playhead line — exactly at the right edge of the filled area.
          Since the bars now span 100% of the frame (no padding), the playhead
          left = displayPct% of the frame width. */}
      {hasProgress && displayPct > 0 && (
        <div
          className="absolute inset-y-0 pointer-events-none"
          style={{
            left: `${displayPct}%`,
            width: '2px',
            background: '#ffffff',
            boxShadow: `0 0 8px ${accentColor}, 0 0 14px ${hexToRgba(accentColor, 0.6)}`,
            transform: 'translateX(-1px)',
            zIndex: 5,
          }}
        />
      )}

      {/* Playhead glow — centered on the playhead line. */}
      {hovered && hasProgress && displayPct > 0 && (
        <div
          className="absolute inset-y-0 pointer-events-none"
          style={{
            width: '24px',
            left: `${displayPct}%`,
            transform: 'translateX(-12px)',
            background: `linear-gradient(90deg, transparent, ${hexToRgba(accentColor, 0.35)} 40%, ${hexToRgba('#ffffff', 0.5)} 50%, ${hexToRgba(accentColor, 0.35)} 60%, transparent)`,
            boxShadow: `0 0 10px ${hexToRgba(accentColor, 0.5)}`,
            zIndex: 4,
          }}
        />
      )}
    </div>
  );
}

export default WaveformProgressBar;
