// Hojas y pétalos: perfiles de ancho a lo largo de una línea central que puede curvarse.
// Todo se dibuja en un sistema local: base en (0, 0) y punta hacia +x.
import type { Pt } from '../geometry/path';
import { add, mul, norm, perp, sub } from '../geometry/vec';

export type LeafShape = 'ovalada' | 'lanceolada' | 'ancha' | 'redonda' | 'aguja' | 'espatulada';

export const LEAF_SHAPES: { value: LeafShape; label: string }[] = [
  { value: 'ovalada', label: 'Ovalada' },
  { value: 'lanceolada', label: 'Lanceolada (alargada)' },
  { value: 'ancha', label: 'Base ancha (tipo girasol)' },
  { value: 'redonda', label: 'Redonda' },
  { value: 'espatulada', label: 'Espatulada (ancha en la punta)' },
  { value: 'aguja', label: 'Aguja / fina' },
];

/** Ancho relativo (0 a 1) en la posición t ∈ [0, 1] de la línea central. */
export function leafProfile(shape: LeafShape): (t: number) => number {
  switch (shape) {
    case 'lanceolada':
      return (t) => Math.sin(Math.PI * t ** 0.75) ** 0.9 * (1 - 0.25 * t);
    case 'ancha':
      return (t) => Math.sin(Math.PI * t ** 0.55) ** 0.7;
    case 'redonda':
      return (t) => Math.sqrt(Math.max(0, Math.sin(Math.PI * t)));
    case 'espatulada':
      return (t) => Math.sin(Math.PI * t ** 1.6) ** 0.7;
    case 'aguja':
      return (t) => Math.sin(Math.PI * t ** 0.5) ** 1.4 * (1 - t) ** 0.3;
    default:
      return (t) => Math.sin(Math.PI * t) ** 0.85;
  }
}

export interface LeafSpec {
  length: number;
  width: number;
  profile: (t: number) => number;
  /** Curvatura de la nervadura central: desplazamiento lateral de la punta en proporción al largo. */
  curl?: number;
  /** Borde dentado: 0 = liso, 1 = muy dentado. */
  serration?: number;
  teeth?: number;
  /** Cantidad de pares de nervaduras secundarias. */
  veins?: number;
  /** Asimetría: la mitad izquierda más ancha (+) o más angosta (-). */
  asymmetry?: number;
  /** Puntos por lado. Las piezas chicas (pínnulas, granos) no necesitan tantos. */
  resolution?: number;
}

export interface LeafGeometry {
  outline: Pt[]; // cerrado
  midrib: Pt[];
  veins: Pt[][];
  jagged: boolean; // si es dentada conviene dibujarla con rectas
}

function centerline(length: number, curl: number, n: number): { c: Pt[]; nrm: Pt[] } {
  const c: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    c.push([length * t, curl * length * t * t]);
  }
  const nrm = c.map((_, i) => perp(norm(sub(c[Math.min(n, i + 1)], c[Math.max(0, i - 1)]))));
  return { c, nrm };
}

export function leafGeometry(s: LeafSpec): LeafGeometry {
  const serr = s.serration ?? 0;
  const teeth = Math.max(2, Math.round(s.teeth ?? 9));
  const n = serr > 0 ? teeth * 4 : Math.max(6, Math.round(s.resolution ?? (s.length < 25 ? 10 : s.length < 60 ? 16 : 28)));
  const { c, nrm } = centerline(s.length, s.curl ?? 0, n);
  const asym = s.asymmetry ?? 0;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let hw = (s.width / 2) * s.profile(t);
    if (serr > 0 && t > 0.05 && t < 0.97) {
      const f = (t * teeth) % 1; // diente de sierra que apunta hacia la punta
      hw *= 1 - serr * 0.35 * f;
    }
    left.push(add(c[i], mul(nrm[i], hw * (1 + asym))));
    right.push(add(c[i], mul(nrm[i], -hw * (1 - asym))));
  }
  const outline = [...left, ...right.slice(1, -1).reverse()];

  const veins: Pt[][] = [];
  const pairs = Math.round(s.veins ?? 0);
  for (let k = 1; k <= pairs; k++) {
    const t0 = (k / (pairs + 1)) * 0.85 + 0.03;
    const t1 = Math.min(0.98, t0 + 0.14);
    const i0 = Math.round(t0 * n);
    const i1 = Math.round(t1 * n);
    for (const side of [1, -1]) {
      const hw = (s.width / 2) * s.profile(t1) * 0.82 * (side > 0 ? 1 + asym : 1 - asym);
      const end = add(c[i1], mul(nrm[i1], hw * side));
      const mid = add(c[Math.round((i0 + i1) / 2)], mul(nrm[Math.round((i0 + i1) / 2)], hw * side * 0.55));
      veins.push([c[i0], mid, end]);
    }
  }
  return { outline, midrib: c.slice(0, Math.round(n * 0.94) + 1), veins, jagged: serr > 0 };
}

export type PetalShape = 'punta' | 'redondeada' | 'fina' | 'muesca' | 'ancha';

export const PETAL_SHAPES: { value: PetalShape; label: string }[] = [
  { value: 'punta', label: 'En punta' },
  { value: 'redondeada', label: 'Redondeada' },
  { value: 'fina', label: 'Fina' },
  { value: 'ancha', label: 'Ancha' },
  { value: 'muesca', label: 'Con muesca en la punta' },
];

export function petalProfile(shape: PetalShape): (t: number) => number {
  switch (shape) {
    case 'redondeada':
      return (t) => Math.sqrt(Math.max(0, Math.sin(Math.PI * Math.min(1, t ** 1.5)))) * (t < 0.08 ? t / 0.08 : 1) ** 0.5;
    case 'fina':
      return (t) => Math.sin(Math.PI * t) ** 1.3 * (1 - 0.3 * t);
    case 'ancha':
      return (t) => Math.sin(Math.PI * t ** 1.2) ** 0.55;
    case 'muesca':
      return (t) => Math.sqrt(Math.max(0, Math.sin(Math.PI * Math.min(1, t ** 1.6)))) * (t > 0.9 ? 1 - (t - 0.9) * 4 : 1);
    default:
      return (t) => Math.sin(Math.PI * t ** 1.15) ** 0.8;
  }
}

/** Contorno de pétalo en coordenadas locales (a lo largo, a lo ancho). */
export function petalOutline(length: number, width: number, shape: PetalShape, curl = 0): Pt[] {
  const g = leafGeometry({ length, width, profile: petalProfile(shape), curl });
  if (shape !== 'muesca') return g.outline;
  // Muesca: la punta se hunde hacia el centro.
  return g.outline.map((p) => {
    const t = p[0] / length;
    if (t < 0.92) return p;
    const centerish = 1 - Math.min(1, Math.abs(p[1]) / (width * 0.25));
    return [p[0] - centerish * length * 0.08, p[1]] as Pt;
  });
}
