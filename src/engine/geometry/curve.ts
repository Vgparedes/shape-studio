// Crecimiento de líneas: una curva que avanza cambiando de rumbo. Es la base de tallos, ramas y raíces.
import type { Pt } from './path';
import { add, angleDiff, dir, mul } from './vec';

export interface Growth {
  points: Pt[];
  headings: number[]; // rumbo en grados en cada punto (0 = derecha, -90 = arriba)
}

export interface GrowOptions {
  /** Giro total a lo largo de toda la curva, en grados. Positivo = horario en pantalla. */
  bend?: number;
  /** Ondulación: devuelve grados extra según t ∈ [0, 1]. */
  wobble?: (t: number) => number;
  /** Tropismo: rumbo hacia el que tiende (por ejemplo, 90 = abajo para raíces) y con qué fuerza (0 a 1). */
  tropism?: { heading: number; strength: number };
  steps?: number;
}

export function grow(start: Pt, heading: number, length: number, opts: GrowOptions = {}): Growth {
  const steps = Math.max(2, opts.steps ?? Math.ceil(Math.max(8, length / 10)));
  const ds = length / steps;
  const points: Pt[] = [start];
  const headings: number[] = [];
  let h = heading;
  let p = start;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    let hh = h + (opts.bend ?? 0) * t + (opts.wobble ? opts.wobble(t) : 0);
    headings.push(hh);
    if (opts.tropism) h += angleDiff(hh, opts.tropism.heading) * opts.tropism.strength * (1 / steps) * 3;
    p = add(p, mul(dir(hh), ds));
    points.push(p);
    if (i === steps - 1) {
      hh = h + (opts.bend ?? 0) + (opts.wobble ? opts.wobble(1) : 0);
      headings.push(hh);
    }
  }
  return { points, headings };
}

/** Punto y rumbo en la posición t ∈ [0, 1] de una curva crecida. */
export function sampleAt(g: Growth, t: number): { p: Pt; heading: number } {
  const n = g.points.length - 1;
  const x = Math.max(0, Math.min(1, t)) * n;
  const i = Math.min(n - 1, Math.floor(x));
  const f = x - i;
  const a = g.points[i];
  const b = g.points[i + 1];
  return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], heading: g.headings[i] + angleDiff(g.headings[i], g.headings[i + 1]) * f };
}

/** Recorta una curva crecida hasta t (para que algo crezca solo una parte). */
export function slice(g: Growth, from: number, to: number, steps = 16): Growth {
  const points: Pt[] = [];
  const headings: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const s = sampleAt(g, from + ((to - from) * i) / steps);
    points.push(s.p);
    headings.push(s.heading);
  }
  return { points, headings };
}
