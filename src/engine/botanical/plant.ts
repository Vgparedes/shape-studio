// Partes comunes de las plantas: tallo, hojas a lo largo del tallo y raíces.
// La planta crece desde (0, 0) hacia arriba; las raíces van hacia abajo.
import type { Rng } from '../../core/random';
import type { SceneNode } from '../../core/types';
import type { Pt } from '../geometry/path';
import { polyline, smoothPath } from '../geometry/path';
import { grow, sampleAt, type Growth } from '../geometry/curve';
import { fbm1D } from '../geometry/noise';
import { ribbon, taper } from '../geometry/ribbon';
import { branch, segmentsToPath } from '../geometry/branching';
import { add, dir, mul, place } from '../geometry/vec';
import { leafGeometry, leafProfile, type LeafShape } from './leaf';
import type { GenContext, ParamDef } from '../generators/types';
import { compact, filled, groupNode, line, pathNode, silhouette } from '../generators/build';
import { LEAF_SHAPES } from './leaf';

export interface StemSpec {
  length: number;
  /** -1 a 1: hacia qué lado y cuánto se curva. */
  curve: number;
  width: number;
  heading?: number;
  origin?: Pt;
  wobble?: number;
}

export function stemGrowth(s: StemSpec, rng: Rng): Growth {
  const n = fbm1D(rng, 2);
  const off = rng.range(0, 50);
  return grow(s.origin ?? [0, 0], s.heading ?? -90, s.length, {
    bend: s.curve * 70,
    wobble: (t) => n(off + t * 2.5) * (s.wobble ?? 4) * t,
    steps: Math.max(12, Math.round(s.length / 10)),
  });
}

export interface LeavesSpec {
  count: number;
  length: number;
  widthRatio: number;
  shape: LeafShape;
  distribution: 'alterna' | 'opuesta';
  angle: number;
  droop: number;
  veins: number;
  serration: number;
  /** Tramo del tallo donde salen hojas. */
  from: number;
  to: number;
  /** Cuánto se achican hacia arriba (0 = todas iguales). */
  shrink: number;
  petiole: number;
}

export interface LeafDrawing {
  fills: string[];
  veins: string;
}

/** Dibuja hojas a lo largo de una línea crecida (tallo o rama). */
export function leavesAlong(g: Growth, s: LeavesSpec, rng: Rng): LeafDrawing {
  const fills: string[] = [];
  let veins = '';
  const total = Math.max(0, Math.round(s.count));
  if (!total) return { fills, veins };
  const slots = s.distribution === 'opuesta' ? Math.ceil(total / 2) : total;
  let placed = 0;
  for (let k = 0; k < slots && placed < total; k++) {
    const rel = slots === 1 ? 0.5 : k / (slots - 1);
    const t = s.from + (s.to - s.from) * rel;
    const at = sampleAt(g, t);
    const sides = s.distribution === 'opuesta' ? [1, -1] : [k % 2 === 0 ? 1 : -1];
    for (const side of sides) {
      if (placed++ >= total) break;
      const size = 1 - s.shrink * rel;
      const heading = at.heading + side * (s.angle + rng.jitter(6));
      const geo = leafGeometry({
        length: s.length * size * (1 + rng.jitter(0.08)),
        width: s.length * size * s.widthRatio,
        profile: leafProfile(s.shape),
        curl: s.droop * side * 0.35,
        serration: s.serration,
        teeth: 8,
        veins: s.veins,
      });
      const base = add(at.p, mul(dir(heading), s.petiole));
      if (s.petiole > 0) veins += polyline([at.p, base], false);
      const outline = place(geo.outline, base, heading);
      fills.push(geo.jagged ? polyline(outline, true) : smoothPath(outline, true, 0.9));
      if (s.veins > 0 || s.length > 30) veins += smoothPath(place(geo.midrib, base, heading), false);
      for (const v of geo.veins) veins += smoothPath(place(v, base, heading), false);
    }
  }
  return { fills, veins };
}

export interface RootsSpec {
  count: number;
  length: number;
  depth: number;
  spread: number;
  width: number;
}

export function rootsPath(s: RootsSpec, rng: Rng, origin: Pt = [0, 0]): string {
  const segs = [];
  const count = Math.max(1, Math.round(s.count));
  for (let k = 0; k < count; k++) {
    const rel = count === 1 ? 0 : k / (count - 1) - 0.5;
    segs.push(
      ...branch(
        {
          origin,
          heading: 90 + rel * s.spread + rng.jitter(8),
          length: s.length * (k === Math.floor(count / 2) ? 1 : 0.75 + rng.next() * 0.25),
          width: s.width * (1 - Math.abs(rel) * 0.5),
          depth: Math.round(s.depth),
          children: [1, 3],
          angle: 38,
          angleJitter: 0.5,
          lengthRatio: 0.55,
          widthRatio: 0.6,
          spawnFrom: 0.2,
          apical: true,
          tropism: { heading: 90, strength: 0.25 },
          wobble: 18,
          density: 0.9,
        },
        rng,
      ),
    );
  }
  return segmentsToPath(segs);
}

// ---------------------------------------------------------------------------
// Parámetros compartidos por las plantas con flor (girasol, margarita, flor...).

export const stemParams = (d: { length: number; curve: number; width: number }): ParamDef[] => [
  { key: 'stemLength', label: 'Largo', group: 'Tallo', type: 'number', min: 0, max: 700, step: 1, default: d.length, unit: 'px' },
  { key: 'stemCurve', label: 'Curvatura', group: 'Tallo', type: 'number', min: -1, max: 1, step: 0.01, default: d.curve },
  { key: 'stemWidth', label: 'Grosor', group: 'Tallo', type: 'number', min: 1, max: 40, step: 0.5, default: d.width, unit: 'px' },
];

export const leafParams = (d: { count: number; length: number; ratio: number; shape: LeafShape; angle: number; droop: number; veins: number; distribution?: 'alterna' | 'opuesta' }): ParamDef[] => [
  { key: 'leafCount', label: 'Cantidad', group: 'Hojas', type: 'number', min: 0, max: 16, step: 1, default: d.count },
  { key: 'leafLength', label: 'Largo', group: 'Hojas', type: 'number', min: 5, max: 260, step: 1, default: d.length, unit: 'px' },
  { key: 'leafRatio', label: 'Ancho (proporción)', group: 'Hojas', type: 'number', min: 0.08, max: 1.2, step: 0.01, default: d.ratio },
  { key: 'leafShape', label: 'Forma', group: 'Hojas', type: 'select', options: LEAF_SHAPES, default: d.shape },
  {
    key: 'leafDistribution',
    label: 'Distribución',
    group: 'Hojas',
    type: 'select',
    options: [
      { value: 'alterna', label: 'Alterna' },
      { value: 'opuesta', label: 'Opuesta (de a pares)' },
    ],
    default: d.distribution ?? 'alterna',
  },
  { key: 'leafAngle', label: 'Ángulo con el tallo', group: 'Hojas', type: 'number', min: 5, max: 110, step: 1, default: d.angle, unit: '°' },
  { key: 'leafDroop', label: 'Caída', group: 'Hojas', type: 'number', min: -1, max: 1.5, step: 0.01, default: d.droop },
  { key: 'leafVeins', label: 'Nervaduras', group: 'Hojas', type: 'number', min: 0, max: 10, step: 1, default: d.veins },
  { key: 'leafSerration', label: 'Borde dentado', group: 'Hojas', type: 'number', min: 0, max: 1, step: 0.01, default: 0 },
];

export const rootParams = (d: { show: boolean; length: number; depth: number; count: number }): ParamDef[] => [
  { key: 'rootsShow', label: 'Mostrar raíces', group: 'Raíces', type: 'boolean', default: d.show },
  { key: 'rootLength', label: 'Largo', group: 'Raíces', type: 'number', min: 5, max: 400, step: 1, default: d.length, unit: 'px' },
  { key: 'rootDepth', label: 'Ramificación', group: 'Raíces', type: 'number', min: 0, max: 4, step: 1, default: d.depth },
  { key: 'rootCount', label: 'Raíces principales', group: 'Raíces', type: 'number', min: 1, max: 9, step: 1, default: d.count },
  { key: 'ground', label: 'Línea de suelo', group: 'Raíces', type: 'boolean', default: false },
];

export interface PlantColors {
  stem: string;
  leaf: string;
  root: string;
  outline: string;
  outlineWidth: number;
}

/** Tallo + hojas + raíces armados como nodos, con el punto y el rumbo de la punta del tallo. */
export function plantBody(ctx: GenContext, colors: PlantColors, opts: { stemFrom?: number } = {}) {
  const p = ctx.params;
  const num = (k: string) => Number(p[k]);
  const stem = stemGrowth({ length: num('stemLength'), curve: num('stemCurve'), width: num('stemWidth') }, ctx.rng);
  const w = num('stemWidth');
  const stemD = num('stemLength') > 0 ? ribbon(stem.points, taper(w, w * 0.7)) : '';
  const leaves = leavesAlong(
    stem,
    {
      count: num('leafCount'),
      length: num('leafLength'),
      widthRatio: num('leafRatio'),
      shape: String(p.leafShape) as LeafShape,
      distribution: p.leafDistribution === 'opuesta' ? 'opuesta' : 'alterna',
      angle: num('leafAngle'),
      droop: num('leafDroop'),
      veins: num('leafVeins'),
      serration: num('leafSerration'),
      from: opts.stemFrom ?? 0.15,
      to: 0.72,
      shrink: 0.35,
      petiole: Math.min(12, num('leafLength') * 0.08),
    },
    ctx.rng,
  );
  const vw = Math.max(0.6, colors.outlineWidth * 0.8);
  const leafNodes: SceneNode[] = leaves.fills.map((d, i) => pathNode(ctx, `Hoja ${i + 1}`, d, filled(colors.leaf, colors.outline, colors.outlineWidth), 'leaf'));
  if (leaves.veins) leafNodes.push(pathNode(ctx, 'Nervaduras', leaves.veins, line(colors.outline, vw), 'veins'));

  const roots = p.rootsShow
    ? rootsPath({ count: num('rootCount'), length: num('rootLength'), depth: num('rootDepth'), spread: 110, width: Math.max(1.5, w * 0.7) }, ctx.rng)
    : '';
  const groundW = Math.max(60, num('leafLength') * 2.4);
  const nodes = compact([
    roots && pathNode(ctx, 'Raíces', roots, silhouette(colors.root, colors.outline, colors.outlineWidth * 0.8), 'roots'),
    p.ground && pathNode(ctx, 'Suelo', `M${-groundW} 0H${groundW}`, line(colors.outline, Math.max(1, colors.outlineWidth)), 'ground'),
    stemD && pathNode(ctx, 'Tallo', stemD, filled(colors.stem, colors.outline, colors.outlineWidth), 'stem'),
    leafNodes.length > 0 && groupNode(ctx, 'Hojas', leafNodes, 'leaves'),
  ]);
  return { nodes, top: sampleAt(stem, 1), stem };
}

export const colorParams = (d: Record<string, [string, string]>): ParamDef[] => [
  ...Object.entries(d).map(([key, [label, value]]): ParamDef => ({ key, label, group: 'Colores', type: 'color', default: value })),
  { key: 'outlineWidth', label: 'Grosor del contorno', group: 'Colores', type: 'number', min: 0, max: 6, step: 0.1, default: 1.4, unit: 'px' },
];
