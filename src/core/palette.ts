// Paletas automáticas: armonías a partir de un color base.
import { hexToRgb, rgbToHex } from './color';

export function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

export type Harmony = 'analoga' | 'complementaria' | 'triadica' | 'monocromatica' | 'tierra';

export const HARMONIES: { id: Harmony; label: string }[] = [
  { id: 'analoga', label: 'Análoga' },
  { id: 'complementaria', label: 'Complementaria' },
  { id: 'triadica', label: 'Triádica' },
  { id: 'monocromatica', label: 'Monocromática' },
  { id: 'tierra', label: 'Tierra (apagada)' },
];

/** Cinco colores en armonía con el color base. */
export function harmony(base: string, kind: Harmony): string[] {
  const [h, s, l] = hexToHsl(base);
  switch (kind) {
    case 'complementaria':
      return [hslToHex(h, s, l), hslToHex(h, s * 0.7, Math.min(0.85, l + 0.25)), hslToHex(h + 180, s, l), hslToHex(h + 180, s * 0.6, Math.min(0.88, l + 0.3)), hslToHex(h, s * 0.4, 0.18)];
    case 'triadica':
      return [hslToHex(h, s, l), hslToHex(h + 120, s, l), hslToHex(h + 240, s, l), hslToHex(h + 120, s * 0.5, 0.85), hslToHex(h, s * 0.3, 0.2)];
    case 'monocromatica':
      return [0.18, 0.32, 0.48, 0.66, 0.84].map((ll) => hslToHex(h, s * (0.6 + ll * 0.4), ll));
    case 'tierra':
      return [hslToHex(h, 0.35, 0.3), hslToHex(h + 25, 0.3, 0.5), hslToHex(h - 20, 0.28, 0.68), hslToHex(h + 50, 0.25, 0.82), hslToHex(h + 10, 0.2, 0.15)];
    default:
      return [hslToHex(h - 30, s, l), hslToHex(h - 15, s, l + 0.08), hslToHex(h, s, l), hslToHex(h + 15, s, l + 0.08), hslToHex(h + 30, s * 0.8, Math.min(0.9, l + 0.25))];
  }
}
