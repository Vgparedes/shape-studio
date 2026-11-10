// Organic Shape Engine: contornos cerrados definidos por un radio que varía con el ángulo.
// Controla vértices, suavidad, irregularidad, simetría, complejidad, proporciones y "cola".
import type { Rng } from '../../core/random';
import type { Pt } from '../geometry/path';
import { smoothPath } from '../geometry/path';

export interface BlobSpec {
  radius: number;
  /** Puntos del contorno. Pocos = forma más simple; muchos = más detalle. */
  vertices: number;
  /** 0 = sin variación (círculo) … 1 = muy irregular. */
  irregularity: number;
  /** 0 = esquinas vivas (polígono) … 1 = curvas totalmente suaves. */
  smoothness: number;
  /** 0 = asimétrica … 1 = espejada respecto del eje vertical. */
  symmetry: number;
  /** Cantidad de ondulaciones superpuestas (1 a 8). */
  complexity: number;
  /** Proporción ancho / alto. */
  stretch: number;
  /** Estira un lado como una gota o un fluido (0 = nada). */
  tail?: number;
  /** Ángulo de la cola, en grados. */
  tailAngle?: number;
}

/** Radio relativo r(θ) armado con armónicos al azar (reproducible con la semilla). */
function harmonics(rng: Rng, complexity: number) {
  const k = Math.max(1, Math.round(complexity));
  const terms = Array.from({ length: k }, (_, i) => ({
    freq: i + 2,
    amp: (rng.next() * 0.7 + 0.3) / (i + 1) ** 0.9,
    phase: rng.next() * Math.PI * 2,
  }));
  const total = terms.reduce((a, t) => a + t.amp, 0);
  return (theta: number) => terms.reduce((a, t) => a + t.amp * Math.sin(t.freq * theta + t.phase), 0) / total;
}

export function blobPoints(s: BlobSpec, rng: Rng): Pt[] {
  const h = harmonics(rng, s.complexity);
  const n = Math.max(3, Math.round(s.vertices));
  const jitter = Array.from({ length: n }, () => rng.jitter(1));
  const tailA = ((s.tailAngle ?? 0) * Math.PI) / 180;
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    // Simetría: se mezcla el radio en θ con el de su espejo (π − θ).
    const mirror = Math.PI - th;
    const j = jitter[i] * 0.25;
    const raw = h(th) + j;
    const mirrorIdx = (((Math.round((mirror / (Math.PI * 2)) * n) % n) + n) % n);
    const rawM = h(mirror) + jitter[mirrorIdx] * 0.25;
    const v = raw + ((raw + rawM) / 2 - raw) * s.symmetry;
    let r = s.radius * (1 + s.irregularity * 0.55 * v);
    if (s.tail) {
      const d = Math.atan2(Math.sin(th - tailA), Math.cos(th - tailA));
      r += s.radius * s.tail * Math.exp(-((d / 0.45) ** 2));
    }
    r = Math.max(s.radius * 0.08, r);
    pts.push([Math.cos(th) * r * Math.sqrt(s.stretch), Math.sin(th) * r / Math.sqrt(s.stretch)]);
  }
  return pts;
}

export const blobPath = (s: BlobSpec, rng: Rng) => smoothPath(blobPoints(s, rng), true, s.smoothness);

export interface SuperSpec {
  size: number;
  m: number;
  n1: number;
  n2: number;
  n3: number;
  a?: number;
  b?: number;
  irregularity: number;
}

/** Superfórmula de Gielis: con pocos números da estrellas, flores, conchas, gotas y polígonos blandos. */
export function superformulaPoints(s: SuperSpec, rng: Rng, steps = 360): Pt[] {
  const h = harmonics(rng, 4);
  const raw: number[] = [];
  for (let i = 0; i < steps; i++) {
    const phi = (i / steps) * Math.PI * 2;
    const t1 = Math.abs(Math.cos((s.m * phi) / 4) / (s.a ?? 1)) ** s.n2;
    const t2 = Math.abs(Math.sin((s.m * phi) / 4) / (s.b ?? 1)) ** s.n3;
    const r = (t1 + t2) ** (-1 / Math.max(0.05, s.n1));
    raw.push(Number.isFinite(r) ? r : 0);
  }
  const max = Math.max(...raw) || 1;
  return raw.map((r, i) => {
    const phi = (i / steps) * Math.PI * 2;
    const rr = (r / max) * s.size * (1 + s.irregularity * 0.4 * h(phi));
    return [Math.cos(phi) * rr, Math.sin(phi) * rr];
  });
}
