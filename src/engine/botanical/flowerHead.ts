// Cabeza de flor en 3D proyectada a 2D: la misma flor se puede ver de frente, de perfil,
// de tres cuartos o cabizbaja. Los pétalos se ordenan por profundidad para que se tapen bien.
import type { Rng } from '../../core/random';
import type { Pt } from '../geometry/path';
import { smoothPath } from '../geometry/path';
import { DEG, cross3, norm3, type V3 } from '../geometry/vec';
import { petalOutline, type PetalShape } from './leaf';

export interface HeadSpec {
  /** Grados. 0 = de frente; +90 = mirando a la derecha; -90 = a la izquierda. */
  yaw: number;
  /** Grados. Positivo = cabizbaja (mira hacia abajo). */
  pitch: number;
  petals: number;
  petalLength: number;
  petalWidth: number;
  petalShape: PetalShape;
  /** Apertura en copa: 0 = pétalos planos; valores altos = pétalos que se cierran hacia adelante. */
  cup: number;
  layers: number;
  /** Desorden natural (0 a 1). */
  disorder: number;
  centerRadius: number;
  /** Corrimiento del centro dentro de la flor, en proporción al radio (-0.5 a 0.5). */
  centerOffset: Pt;
  /** Espesor del receptáculo (la parte de atrás de la flor). */
  depth: number;
  seeds: boolean;
  bracts: boolean;
}

export interface HeadPart {
  d: string;
  kind: 'petal' | 'bract' | 'receptacle' | 'disk' | 'seeds';
  front?: boolean;
}

export interface HeadResult {
  parts: HeadPart[];
  /** Dónde se une el tallo, relativo al centro de la flor. */
  attach: Pt;
}

function basis(yaw: number, pitch: number) {
  const y = yaw * DEG;
  const p = pitch * DEG;
  const n: V3 = [Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p)];
  const u: V3 = norm3([Math.cos(y), 0, -Math.sin(y)]);
  const v: V3 = norm3(cross3(n, u));
  return { n, u, v };
}

const comb = (terms: [V3, number][]): V3 => terms.reduce<V3>((acc, [vec, k]) => [acc[0] + vec[0] * k, acc[1] + vec[1] * k, acc[2] + vec[2] * k], [0, 0, 0]);

function hull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const crossZ = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && crossZ(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (const p of pts.reverse()) {
    while (upper.length >= 2 && crossZ(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

export function flowerHead(s: HeadSpec, rng: Rng): HeadResult {
  const { n, u, v } = basis(s.yaw, s.pitch);
  const P = (vec: V3): Pt => [vec[0], vec[1]];
  const Rc = s.centerRadius;
  const ring = (radius: number, h: number, off: Pt = [0, 0], steps = 48): V3[] =>
    Array.from({ length: steps }, (_, i) => {
      const a = (i / steps) * Math.PI * 2;
      return comb([
        [u, Math.cos(a) * radius + off[0]],
        [v, Math.sin(a) * radius + off[1]],
        [n, h],
      ]);
    });

  type Item = { d: string; z: number; kind: HeadPart['kind']; front: boolean };
  const items: Item[] = [];

  const addPetal = (theta: number, length: number, width: number, cupDeg: number, baseR: number, baseH: number, kind: 'petal' | 'bract', shape: PetalShape) => {
    const r = comb([
      [u, Math.cos(theta)],
      [v, Math.sin(theta)],
    ]);
    const t = comb([
      [u, -Math.sin(theta)],
      [v, Math.cos(theta)],
    ]);
    const c = cupDeg * DEG;
    const d = comb([
      [r, Math.cos(c)],
      [n, Math.sin(c)],
    ]);
    const base = comb([
      [r, baseR],
      [n, baseH],
    ]);
    const outline = petalOutline(length, width, shape).map(([a, b]) => P(comb([[base, 1], [d, a], [t, b]])));
    const mid = comb([[base, 1], [d, length * 0.5]]);
    // Va adelante del disco solo si está del lado que mira al espectador.
    const front = kind === 'petal' && r[2] + Math.sin(c) * n[2] * 0.3 > 0.22;
    items.push({ d: smoothPath(outline, true, 0.9), z: mid[2], kind, front });
  };

  const N = Math.max(3, Math.round(s.petals));
  for (let layer = Math.max(1, Math.round(s.layers)) - 1; layer >= 0; layer--) {
    for (let j = 0; j < N; j++) {
      const theta = (j / N) * Math.PI * 2 + (layer * Math.PI) / N + rng.jitter((Math.PI / N) * 0.6 * s.disorder);
      const len = s.petalLength * (1 - 0.13 * layer) * (1 + rng.jitter(0.18 * s.disorder));
      const wid = s.petalWidth * (1 + rng.jitter(0.15 * s.disorder));
      const cup = s.cup + layer * 10 + rng.jitter(14 * s.disorder);
      addPetal(theta, len, wid, cup, Rc * 0.9, 0, 'petal', s.petalShape);
    }
  }
  if (s.bracts) {
    const nb = Math.max(8, Math.round(N * 0.8));
    for (let j = 0; j < nb; j++) {
      const theta = (j / nb) * Math.PI * 2 + rng.jitter(0.15);
      addPetal(theta, Rc * 0.55, Rc * 0.28, -40 + rng.jitter(10), Rc * 0.95, -s.depth * 0.5, 'bract', 'punta');
    }
  }

  const back = items.filter((i) => !i.front).sort((a, b) => a.z - b.z);
  const front = items.filter((i) => i.front).sort((a, b) => a.z - b.z);

  const parts: HeadPart[] = back.map((i) => ({ d: i.d, kind: i.kind }));

  // Receptáculo: envolvente entre el anillo del disco y el de atrás. Se ve cuando la flor está girada.
  const rim = [...ring(Rc * 1.02, 0), ...ring(Rc * 0.8, -s.depth)].map(P);
  parts.push({ d: smoothPath(hull(rim), true, 0.5), kind: 'receptacle' });

  const off: Pt = [s.centerOffset[0] * Rc, s.centerOffset[1] * Rc];
  parts.push({ d: smoothPath(ring(Rc, 0.5, off, 40).map(P), true), kind: 'disk' });

  // Semillas en espiral (filotaxis, el ángulo de oro). Se omiten si el disco se ve muy de canto.
  const squash = Math.min(Math.hypot(u[0], u[1]), Math.hypot(v[0], v[1]));
  if (s.seeds && squash > 0.35) {
    const dotR = Math.max(0.9, Rc * 0.055);
    const count = Math.min(360, Math.round((Rc / (dotR * 2.1)) ** 2));
    let d = '';
    for (let k = 1; k < count; k++) {
      const rr = Rc * 0.92 * Math.sqrt(k / count);
      const a = k * 137.508 * DEG;
      const size = dotR * (0.55 + 0.45 * (rr / Rc));
      const ctr: Pt = [Math.cos(a) * rr + off[0], Math.sin(a) * rr + off[1]];
      const dot = Array.from({ length: 5 }, (_, i) => {
        const b = (i / 5) * Math.PI * 2;
        return P(comb([[u, ctr[0] + Math.cos(b) * size], [v, ctr[1] + Math.sin(b) * size], [n, 1]]));
      });
      d += smoothPath(dot, true);
    }
    parts.push({ d, kind: 'seeds' });
  }

  for (const i of front) parts.push({ d: i.d, kind: i.kind, front: true });
  const attach = P(comb([[n, -s.depth * 1.1]]));
  return { parts, attach };
}
