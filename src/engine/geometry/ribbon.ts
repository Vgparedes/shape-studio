// Cinta: convierte una línea central en una forma rellena con grosor variable
// (tallos que se afinan, raíces, hojas largas de maíz, cintas abstractas).
import type { Pt } from './path';
import { polyline, smoothPath } from './path';
import { add, mul, norm, perp, sub } from './vec';

export function ribbonOutline(points: Pt[], width: (t: number) => number): Pt[] {
  const n = points.length;
  if (n < 2) return [];
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(n - 1, i + 1)];
    const nrm = perp(norm(sub(b, a)));
    const w = Math.max(0, width(i / (n - 1))) / 2;
    left.push(add(points[i], mul(nrm, w)));
    right.push(add(points[i], mul(nrm, -w)));
  }
  return [...left, ...right.reverse()];
}

export function ribbon(points: Pt[], width: (t: number) => number, smooth = true): string {
  const outline = ribbonOutline(points, width);
  if (outline.length < 3) return '';
  return smooth ? smoothPath(outline, true, 0.85) : polyline(outline, true);
}

/** Ancho que va de w0 en la base a w1 en la punta. */
export const taper = (w0: number, w1: number, curve = 1) => (t: number) => w0 + (w1 - w0) * t ** curve;
