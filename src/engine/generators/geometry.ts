// Generadores geométricos básicos (Etapa 1). Sirven de base para la biblioteca y para
// probar el ciclo completo: crear, cambiar parámetros, regenerar con otra semilla y exportar.
import type { Generator, GenContext } from './types';
import type { PathNode, Style } from '../../core/types';
import { IDENTITY } from '../../core/scene';
import {
  ellipsePath,
  polar,
  regularPolygonPoints,
  roundedPolygon,
  roundedRect,
  smoothPath,
  starPoints,
  type Pt,
} from '../geometry/path';

const n = (ctx: GenContext, k: string) => Number(ctx.params[k]);

const FILL: Style = { fill: '#e2a93b', stroke: '#2b2620', strokeWidth: 0, lineJoin: 'round' };
const LINE: Style = { fill: null, stroke: '#2b2620', strokeWidth: 4, lineCap: 'round', lineJoin: 'round' };

export const rectangle: Generator = {
  id: 'geo.rectangle',
  name: 'Rectángulo',
  category: 'geometria',
  description: 'Rectángulo o cuadrado con esquinas redondeadas opcionales.',
  keywords: ['rectángulo', 'rectangulo', 'cuadrado', 'square', 'rectangle'],
  params: [
    { key: 'width', label: 'Ancho', type: 'number', min: 4, max: 1200, step: 1, default: 220, unit: 'px' },
    { key: 'height', label: 'Alto', type: 'number', min: 4, max: 1200, step: 1, default: 150, unit: 'px' },
    { key: 'radius', label: 'Radio de esquinas', type: 'number', min: 0, max: 300, step: 1, default: 16, unit: 'px' },
  ],
  generate: (ctx) => ({ kind: 'path', d: roundedRect(n(ctx, 'width'), n(ctx, 'height'), n(ctx, 'radius')), style: { ...FILL, fill: '#4c7a5c' } }),
};

export const ellipse: Generator = {
  id: 'geo.ellipse',
  name: 'Círculo / elipse',
  category: 'geometria',
  description: 'Círculo o elipse definido por sus dos radios.',
  keywords: ['círculo', 'circulo', 'elipse', 'óvalo', 'ovalo', 'circle', 'ellipse'],
  params: [
    { key: 'rx', label: 'Radio horizontal', type: 'number', min: 2, max: 600, step: 1, default: 110, unit: 'px' },
    { key: 'ry', label: 'Radio vertical', type: 'number', min: 2, max: 600, step: 1, default: 110, unit: 'px' },
  ],
  generate: (ctx) => ({ kind: 'path', d: ellipsePath(n(ctx, 'rx'), n(ctx, 'ry')), style: { ...FILL } }),
};

export const polygon: Generator = {
  id: 'geo.polygon',
  name: 'Polígono',
  category: 'geometria',
  description: 'Triángulo, hexágono o cualquier polígono regular, con redondeo e irregularidad.',
  keywords: ['polígono', 'poligono', 'triángulo', 'triangulo', 'hexágono', 'hexagono', 'pentágono', 'octógono', 'polygon', 'hexagon', 'triangle'],
  params: [
    { key: 'sides', label: 'Lados', type: 'number', min: 3, max: 24, step: 1, default: 6 },
    { key: 'radius', label: 'Radio', type: 'number', min: 4, max: 600, step: 1, default: 120, unit: 'px' },
    { key: 'roundness', label: 'Redondeo', type: 'number', min: 0, max: 1, step: 0.01, default: 0 },
    { key: 'irregularity', label: 'Irregularidad', type: 'number', min: 0, max: 0.6, step: 0.01, default: 0 },
  ],
  generate: (ctx) => {
    const sides = Math.round(n(ctx, 'sides'));
    const r = n(ctx, 'radius');
    const irr = n(ctx, 'irregularity');
    const pts = regularPolygonPoints(sides, r).map((p, i): Pt => {
      if (irr <= 0) return p;
      const ang = -90 + (360 / sides) * i + ctx.rng.jitter((180 / sides) * irr);
      return polar(r * (1 + ctx.rng.jitter(irr)), ang);
    });
    return { kind: 'path', d: roundedPolygon(pts, n(ctx, 'roundness')), style: { ...FILL, fill: '#3f6fb5' } };
  },
};

export const star: Generator = {
  id: 'geo.star',
  name: 'Estrella',
  category: 'geometria',
  description: 'Estrella de N puntas con proporción interior y redondeo.',
  keywords: ['estrella', 'estrellas', 'star'],
  params: [
    { key: 'tips', label: 'Puntas', type: 'number', min: 3, max: 40, step: 1, default: 5 },
    { key: 'outer', label: 'Radio exterior', type: 'number', min: 4, max: 600, step: 1, default: 130, unit: 'px' },
    { key: 'inner', label: 'Proporción interior', type: 'number', min: 0.05, max: 0.95, step: 0.01, default: 0.45 },
    { key: 'roundness', label: 'Redondeo', type: 'number', min: 0, max: 1, step: 0.01, default: 0 },
  ],
  generate: (ctx) => {
    const outer = n(ctx, 'outer');
    const pts = starPoints(Math.round(n(ctx, 'tips')), outer, outer * n(ctx, 'inner'));
    return { kind: 'path', d: roundedPolygon(pts, n(ctx, 'roundness')), style: { ...FILL } };
  },
};

export const spiral: Generator = {
  id: 'geo.spiral',
  name: 'Espiral',
  category: 'geometria',
  description: 'Espiral de trazo, arquimediana (vueltas parejas) o logarítmica (se abre cada vez más).',
  keywords: ['espiral', 'espirales', 'spiral', 'caracol'],
  params: [
    { key: 'turns', label: 'Vueltas', type: 'number', min: 0.5, max: 14, step: 0.1, default: 4 },
    { key: 'radius', label: 'Radio', type: 'number', min: 10, max: 600, step: 1, default: 140, unit: 'px' },
    {
      key: 'mode',
      label: 'Tipo',
      type: 'select',
      options: [
        { value: 'archimedean', label: 'Arquimediana' },
        { value: 'log', label: 'Logarítmica' },
      ],
      default: 'archimedean',
    },
  ],
  generate: (ctx) => {
    const turns = n(ctx, 'turns');
    const R = n(ctx, 'radius');
    const steps = Math.max(12, Math.round(turns * 28));
    const pts: Pt[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const r = ctx.params.mode === 'log' ? R * (Math.exp(t * 3) - 1) / (Math.exp(3) - 1) : R * t;
      pts.push(polar(r, t * turns * 360));
    }
    return { kind: 'path', d: smoothPath(pts, false), style: { ...LINE } };
  },
};

export const concentric: Generator = {
  id: 'geo.concentric',
  name: 'Figuras concéntricas',
  category: 'geometria',
  description: 'Anillos de la misma forma, uno dentro del otro. Devuelve un grupo editable.',
  keywords: ['concéntrico', 'concentrico', 'concéntricas', 'anillos', 'concentric'],
  params: [
    { key: 'count', label: 'Cantidad', type: 'number', min: 2, max: 30, step: 1, default: 6 },
    { key: 'radius', label: 'Radio', type: 'number', min: 10, max: 600, step: 1, default: 150, unit: 'px' },
    {
      key: 'shape',
      label: 'Forma',
      type: 'select',
      options: [
        { value: 'circle', label: 'Círculo' },
        { value: 'square', label: 'Cuadrado' },
        { value: 'hexagon', label: 'Hexágono' },
        { value: 'star', label: 'Estrella' },
      ],
      default: 'circle',
    },
    { key: 'filled', label: 'Alternar rellenos', type: 'boolean', default: false },
  ],
  generate: (ctx) => {
    const count = Math.round(n(ctx, 'count'));
    const R = n(ctx, 'radius');
    const children: PathNode[] = [];
    for (let i = 0; i < count; i++) {
      const r = R * (1 - i / count);
      let d: string;
      switch (ctx.params.shape) {
        case 'square':
          d = roundedRect(r * 2, r * 2, 0);
          break;
        case 'hexagon':
          d = roundedPolygon(regularPolygonPoints(6, r), 0);
          break;
        case 'star':
          d = roundedPolygon(starPoints(5, r, r * 0.5), 0);
          break;
        default:
          d = ellipsePath(r, r);
      }
      const style: Style = ctx.params.filled
        ? { fill: i % 2 === 0 ? '#2b2620' : '#f1e6cf', stroke: null, strokeWidth: 0 }
        : { ...LINE, strokeWidth: 3 };
      children.push({ id: ctx.uid(), name: `Anillo ${i + 1}`, kind: 'path', d, style, transform: { ...IDENTITY }, opacity: 1, hidden: false, locked: false });
    }
    return { kind: 'group', children };
  },
};

export const geometryGenerators: Generator[] = [rectangle, ellipse, polygon, star, spiral, concentric];
