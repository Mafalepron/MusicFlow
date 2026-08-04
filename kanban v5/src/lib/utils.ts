import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Convert hex (#rrggbb or #rgb) to rgba string */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3
    ? h.split('').map(c => c + c).join('')
    : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Create a set of CSS variable-like color helpers from a hex color */
export function boardColorStyles(hex: string) {
  return {
    bg: hex,
    bg15: hex + '15',
    bg20: hex + '20',
    bg30: hex + '30',
    bg40: hex + '40',
    bg50: hex + '50',
    bg60: hex + '60',
    bg80: hex + '80',
    shadow: `0 0 12px ${hex}30`,
    shadowGlow: `0 0 20px ${hex}40, 0 0 40px ${hex}15`,
    gradient: `linear-gradient(135deg, ${hex}90, ${hex}60)`,
    gradientFull: `linear-gradient(135deg, ${hex}, ${hex}99)`,
    border: `1px solid ${hex}30`,
    borderStrong: `1px solid ${hex}50`,
    text: hex,
    // for use in style={{ backgroundColor: ... }}
    bgRgba: (a: number) => hexToRgba(hex, a),
  };
}
