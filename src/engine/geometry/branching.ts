// Sistema de ramificación recursivo. Lo usan árboles, raíces, ramas y cualquier cosa que se divida.
import type { Rng } from '../../core/random';
import type { Pt } from './path';
import { grow, sampleAt } from './curve';
import { fbm1D } from './noise';
import { ribbon, taper } from './ribbon';

export interface Segment {
  points: Pt[];
  headings: number[];
  w0: number;
  w1: number;
  depth: number;
  terminal: boolean;
}

export interface BranchOptions {
  origin: Pt;
  heading: number;
  length: number;
  width: number;
  /** Cantidad de niveles de ramificación (0 = una sola línea). */
  depth: number;
  /** Cuántas ramas salen de cada rama: [mínimo, máximo]. */
  children: [number, number];
  /** Ángulo de apertura de las ramas hijas, en grados. */
  angle: number;
  /** Variación al azar del ángulo (0 a 1). */
  angleJitter: number;
  lengthRatio: number;
  widthRatio: number;
  /** Desde qué parte de la rama madre pueden salir hijas (0 = base, 1 = punta). */
  spawnFrom: number;
  /** Si la rama sigue creciendo por la punta además de abrir hijas. */
  apical: boolean;
  tropism?: { heading: number; strength: number };
  /** Ondulación en grados. */
  wobble: number;
  /** Probabilidad de que cada hija aparezca (0 a 1). */
  density: number;
}

/** Tope de segmentos: evita que una combinación extrema (muchos niveles y muchas ramas) cuelgue la app. */
export const MAX_SEGMENTS = 1500;

export function branch(o: BranchOptions, rng: Rng): Segment[] {
  const out: Segment[] = [];
  const rec = (origin: Pt, heading: number, length: number, width: number, level: number) => {
    if (out.length >= MAX_SEGMENTS) return;
    const n = fbm1D(rng, 2);
    const off = rng.range(0, 100);
    const g = grow(origin, heading, length, {
      wobble: (t) => n(off + t * 3) * o.wobble,
      tropism: level > 0 ? o.tropism : undefined, // el tronco o eje principal no se dobla
      steps: Math.max(4, Math.min(24, Math.round(length / 10))),
    });
    const w1 = width * Math.max(0.15, o.widthRatio);
    const isLast = level >= o.depth;
    out.push({ points: g.points, headings: g.headings, w0: width, w1: isLast ? width * 0.25 : w1, depth: level, terminal: isLast });
    if (isLast) return;
    const count = rng.int(o.children[0], o.children[1]);
    for (let i = 0; i < count; i++) {
      if (rng.next() > o.density) continue;
      const at = o.apical ? o.spawnFrom + (1 - o.spawnFrom) * ((i + 0.5) / count) * 0.9 : 1;
      const s = sampleAt(g, at);
      const side = o.apical ? (i % 2 === 0 ? 1 : -1) : count === 1 ? 0 : -1 + (2 * i) / (count - 1);
      const ang = s.heading + side * o.angle * (1 + rng.jitter(o.angleJitter));
      const childW = width * o.widthRatio * (o.apical ? 0.8 : 1) * (1 - (at - o.spawnFrom) * 0.3);
      rec(s.p, ang, length * o.lengthRatio * (1 + rng.jitter(0.25)), Math.max(0.4, childW), level + 1);
    }
    if (o.apical) {
      const tip = sampleAt(g, 1);
      rec(tip.p, tip.heading + rng.jitter(o.angle * 0.25), length * o.lengthRatio * 1.05, Math.max(0.4, w1), level + 1);
    }
  };
  rec(o.origin, o.heading, o.length, o.width, 0);
  return out;
}

/** Junta todos los segmentos en un solo path relleno (cada segmento es una cinta que se afina). */
export function segmentsToPath(segments: Segment[]): string {
  return segments.map((s) => ribbon(s.points, taper(s.w0, s.w1))).join('');
}
