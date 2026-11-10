// Generadores de formas abstractas y orgánicas (Etapa 4).
import type { Generator, ParamDef } from './types';
import type { SceneNode } from '../../core/types';
import type { Rng } from '../../core/random';
import type { Pt } from '../geometry/path';
import { annularSector, ellipsePath, polyline, regularPolygonPoints, roundedPolygon, roundedRect, smoothPath } from '../geometry/path';
import { fbm1D, noise2D } from '../geometry/noise';
import { ribbon } from '../geometry/ribbon';
import { blobPath, superformulaPoints, type BlobSpec } from '../organic/shapes';
import { compact, filled, line, pathNode, reader } from './build';

// Paleta por defecto: verde oliva, beige, amarillo mostaza y un oscuro cálido.
export const PALETTE = { c1: '#7a7d3a', c2: '#e3d3b4', c3: '#d9a72b', c4: '#3b3a2a' };

const paletteParams = (d: Partial<typeof PALETTE> = {}): ParamDef[] => [
  { key: 'c1', label: 'Color 1', group: 'Colores', type: 'color', default: d.c1 ?? PALETTE.c1 },
  { key: 'c2', label: 'Color 2', group: 'Colores', type: 'color', default: d.c2 ?? PALETTE.c2 },
  { key: 'c3', label: 'Color 3', group: 'Colores', type: 'color', default: d.c3 ?? PALETTE.c3 },
  { key: 'c4', label: 'Color 4', group: 'Colores', type: 'color', default: d.c4 ?? PALETTE.c4 },
];
const paletteOf = (p: Record<string, unknown>) => ['c1', 'c2', 'c3', 'c4'].map((k) => String(p[k]));

const outlineParams = (width = 0): ParamDef[] => [
  { key: 'outlineColor', label: 'Contorno', group: 'Colores', type: 'color', default: '#2b2620' },
  { key: 'outlineWidth', label: 'Grosor del contorno', group: 'Colores', type: 'number', min: 0, max: 12, step: 0.1, default: width, unit: 'px' },
];

// ---------------------------------------------------------------------------
// Blobs y sus variantes: misma máquina (shapes.ts), distintos puntos de partida.

interface BlobDefaults extends Omit<BlobSpec, 'radius'> {
  radius: number;
  fill: string;
}

const blobParams = (d: BlobDefaults): ParamDef[] => [
  { key: 'radius', label: 'Tamaño', group: 'Forma', type: 'number', min: 10, max: 600, step: 1, default: d.radius, unit: 'px' },
  { key: 'vertices', label: 'Vértices', group: 'Forma', type: 'number', min: 3, max: 64, step: 1, default: d.vertices },
  { key: 'smoothness', label: 'Suavidad', group: 'Forma', type: 'number', min: 0, max: 1, step: 0.01, default: d.smoothness },
  { key: 'irregularity', label: 'Irregularidad', group: 'Forma', type: 'number', min: 0, max: 1.5, step: 0.01, default: d.irregularity },
  { key: 'symmetry', label: 'Simetría', group: 'Forma', type: 'number', min: 0, max: 1, step: 0.01, default: d.symmetry },
  { key: 'complexity', label: 'Complejidad', group: 'Forma', type: 'number', min: 1, max: 8, step: 1, default: d.complexity },
  { key: 'stretch', label: 'Proporción (ancho / alto)', group: 'Forma', type: 'number', min: 0.3, max: 3, step: 0.01, default: d.stretch },
  { key: 'tail', label: 'Cola / estiramiento de un lado', group: 'Forma', type: 'number', min: 0, max: 2, step: 0.01, default: d.tail ?? 0 },
  { key: 'tailAngle', label: 'Dirección de la cola', group: 'Forma', type: 'number', min: -180, max: 180, step: 1, default: d.tailAngle ?? 0, unit: '°' },
  { key: 'fill', label: 'Relleno', group: 'Colores', type: 'color', default: d.fill },
  ...outlineParams(0),
];

function makeBlob(meta: Pick<Generator, 'id' | 'name' | 'description' | 'keywords'>, d: BlobDefaults): Generator {
  return {
    ...meta,
    category: 'organicas',
    params: blobParams(d),
    generate: (ctx) => {
      const r = reader(ctx.params);
      const d2 = blobPath(
        {
          radius: r.n('radius'),
          vertices: r.n('vertices'),
          smoothness: r.n('smoothness'),
          irregularity: r.n('irregularity'),
          symmetry: r.n('symmetry'),
          complexity: r.n('complexity'),
          stretch: r.n('stretch'),
          tail: r.n('tail'),
          tailAngle: r.n('tailAngle'),
        },
        ctx.rng,
      );
      return { kind: 'path', d: d2, style: filled(r.s('fill'), r.s('outlineColor'), r.n('outlineWidth')) };
    },
  };
}

export const blob = makeBlob(
  { id: 'org.blob', name: 'Blob', description: 'Forma orgánica cerrada y blanda. Controlás vértices, suavidad, irregularidad, simetría y complejidad.', keywords: ['blob', 'blobs', 'mancha', 'forma orgánica', 'orgánica', 'organica', 'orgánico'] },
  { radius: 150, vertices: 9, smoothness: 1, irregularity: 0.55, symmetry: 0, complexity: 3, stretch: 1.15, fill: PALETTE.c1 },
);

export const fluid = makeBlob(
  { id: 'org.fluid', name: 'Forma fluida', description: 'Gota o forma líquida, estirada hacia un lado.', keywords: ['fluido', 'fluida', 'fluidas', 'líquido', 'liquido', 'gota', 'gotas', 'drop'] },
  { radius: 120, vertices: 14, smoothness: 1, irregularity: 0.25, symmetry: 0.6, complexity: 2, stretch: 1, tail: 0.9, tailAngle: -90, fill: '#4f7fa8' },
);

export const irregular = makeBlob(
  { id: 'org.irregular', name: 'Silueta irregular', description: 'Silueta quebrada y asimétrica, como una piedra o un recorte a mano.', keywords: ['irregular', 'irregulares', 'asimétrica', 'asimetrica', 'asimétricas', 'silueta', 'piedra', 'recorte'] },
  { radius: 150, vertices: 22, smoothness: 0.35, irregularity: 0.7, symmetry: 0, complexity: 6, stretch: 1.3, fill: PALETTE.c4 },
);

export const superShape: Generator = {
  id: 'org.super',
  name: 'Geometría orgánica',
  category: 'organicas',
  also: ['geometria'],
  description: 'Superfórmula: con cuatro números da flores, estrellas blandas, conchas y polígonos redondeados.',
  keywords: ['geométrica orgánica', 'geometrica organica', 'superfórmula', 'superformula', 'polígono blando', 'concha'],
  params: [
    { key: 'size', label: 'Tamaño', group: 'Forma', type: 'number', min: 10, max: 600, step: 1, default: 150, unit: 'px' },
    { key: 'm', label: 'Simetrías (m)', group: 'Forma', type: 'number', min: 0, max: 24, step: 1, default: 6 },
    { key: 'n1', label: 'Curvatura general (n1)', group: 'Forma', type: 'number', min: 0.1, max: 20, step: 0.1, default: 1.2 },
    { key: 'n2', label: 'Forma de los lados (n2)', group: 'Forma', type: 'number', min: 0.1, max: 20, step: 0.1, default: 1.7 },
    { key: 'n3', label: 'Forma de las puntas (n3)', group: 'Forma', type: 'number', min: 0.1, max: 20, step: 0.1, default: 1.7 },
    { key: 'irregularity', label: 'Irregularidad', group: 'Forma', type: 'number', min: 0, max: 1, step: 0.01, default: 0.1 },
    { key: 'fill', label: 'Relleno', group: 'Colores', type: 'color', default: PALETTE.c3 },
    ...outlineParams(0),
  ],
  generate: (ctx) => {
    const r = reader(ctx.params);
    const pts = superformulaPoints({ size: r.n('size'), m: r.n('m'), n1: r.n('n1'), n2: r.n('n2'), n3: r.n('n3'), irregularity: r.n('irregularity') }, ctx.rng, 240);
    return { kind: 'path', d: polyline(pts, true), style: filled(r.s('fill'), r.s('outlineColor'), r.n('outlineWidth')) };
  },
};

// ---------------------------------------------------------------------------

export const waves: Generator = {
  id: 'org.waves',
  name: 'Ondas',
  category: 'organicas',
  description: 'Ondas paralelas como líneas o como bandas de color. La amplitud puede crecer o achicarse de una a otra.',
  keywords: ['onda', 'ondas', 'ondulado', 'olas', 'wave', 'waves', 'líneas onduladas'],
  params: [
    { key: 'mode', label: 'Dibujo', group: 'Ondas', type: 'select', options: [{ value: 'lines', label: 'Líneas' }, { value: 'bands', label: 'Bandas de color' }], default: 'lines' },
    { key: 'count', label: 'Cantidad', group: 'Ondas', type: 'number', min: 1, max: 60, step: 1, default: 9 },
    { key: 'length', label: 'Largo', group: 'Ondas', type: 'number', min: 40, max: 1600, step: 1, default: 620, unit: 'px' },
    { key: 'spacing', label: 'Separación', group: 'Ondas', type: 'number', min: 2, max: 120, step: 1, default: 22, unit: 'px' },
    { key: 'amplitude', label: 'Amplitud', group: 'Ondas', type: 'number', min: 0, max: 200, step: 1, default: 28, unit: 'px' },
    { key: 'wavelength', label: 'Largo de onda', group: 'Ondas', type: 'number', min: 10, max: 800, step: 1, default: 190, unit: 'px' },
    { key: 'phase', label: 'Desfase entre ondas', group: 'Ondas', type: 'number', min: -180, max: 180, step: 1, default: 18, unit: '°' },
    { key: 'growth', label: 'Crecimiento de amplitud', group: 'Ondas', type: 'number', min: -1, max: 1, step: 0.01, default: 0.4 },
    { key: 'irregularity', label: 'Irregularidad', group: 'Ondas', type: 'number', min: 0, max: 1, step: 0.01, default: 0.15 },
    { key: 'width', label: 'Grosor de línea', group: 'Ondas', type: 'number', min: 0.2, max: 30, step: 0.1, default: 3, unit: 'px' },
    ...paletteParams(),
  ],
  generate: (ctx) => {
    const r = reader(ctx.params);
    const n = r.i('count');
    const L = r.n('length');
    const steps = Math.max(16, Math.round(L / 8));
    const noise = fbm1D(ctx.rng, 3);
    const lines: Pt[][] = [];
    const bandsMode = r.s('mode') === 'bands';
    const total = bandsMode ? n + 1 : n;
    for (let i = 0; i < total; i++) {
      const rel = total === 1 ? 0 : i / (total - 1) - 0.5;
      const y0 = rel * (total - 1) * r.n('spacing');
      const A = r.n('amplitude') * Math.max(0, 1 + r.n('growth') * rel * 2);
      const pts: Pt[] = [];
      for (let k = 0; k <= steps; k++) {
        const x = -L / 2 + (L * k) / steps;
        const y = y0 + A * Math.sin((2 * Math.PI * x) / r.n('wavelength') + (r.n('phase') * Math.PI * i) / 180) + noise(i * 7.3 + k * 0.08) * r.n('irregularity') * r.n('spacing') * 1.5;
        pts.push([x, y]);
      }
      lines.push(pts);
    }
    const pal = paletteOf(ctx.params);
    if (!bandsMode) return { kind: 'path', d: lines.map((p) => smoothPath(p, false)).join(''), style: line(pal[0], r.n('width')) };
    const bands: SceneNode[] = [];
    for (let i = 0; i < n; i++) {
      const outline = [...lines[i], ...lines[i + 1].slice().reverse()];
      bands.push(pathNode(ctx, `Banda ${i + 1}`, smoothPath(outline, true, 0.6), filled(pal[i % pal.length], pal[3], 0), 'band'));
    }
    return { kind: 'group', children: bands };
  },
};

export const flowCurves: Generator = {
  id: 'org.flow',
  name: 'Curvas fluidas',
  category: 'organicas',
  description: 'Trazos que siguen un campo de flujo invisible, como corrientes o vetas. Cada trazo se afina en las puntas.',
  keywords: ['curva', 'curvas', 'flujo', 'trazos', 'vetas', 'corrientes', 'líneas fluidas', 'flow'],
  params: [
    { key: 'count', label: 'Cantidad de trazos', group: 'Curvas', type: 'number', min: 1, max: 250, step: 1, default: 40 },
    { key: 'length', label: 'Largo', group: 'Curvas', type: 'number', min: 10, max: 900, step: 1, default: 260, unit: 'px' },
    { key: 'width', label: 'Grosor', group: 'Curvas', type: 'number', min: 0.3, max: 40, step: 0.1, default: 7, unit: 'px' },
    { key: 'scale', label: 'Escala del flujo', group: 'Curvas', type: 'number', min: 0.2, max: 6, step: 0.01, default: 1 },
    { key: 'turbulence', label: 'Turbulencia', group: 'Curvas', type: 'number', min: 0, max: 2, step: 0.01, default: 0.5 },
    { key: 'direction', label: 'Dirección general', group: 'Curvas', type: 'number', min: -180, max: 180, step: 1, default: 0, unit: '°' },
    { key: 'areaW', label: 'Ancho del área', group: 'Área', type: 'number', min: 20, max: 1600, step: 1, default: 560, unit: 'px' },
    { key: 'areaH', label: 'Alto del área', group: 'Área', type: 'number', min: 20, max: 1600, step: 1, default: 380, unit: 'px' },
    ...paletteParams(),
  ],
  generate: (ctx) => {
    const r = reader(ctx.params);
    const field = noise2D(ctx.rng);
    const W = r.n('areaW');
    const H = r.n('areaH');
    const sc = r.n('scale') / 200;
    const base = (r.n('direction') * Math.PI) / 180;
    // Sin el color 2 (beige): sobre fondo claro los trazos finos casi no se verían.
    const pal = [0, 2, 3].map((i) => paletteOf(ctx.params)[i]);
    const byColor = pal.map(() => '');
    const steps = Math.max(8, Math.min(60, Math.round(r.n('length') / 12)));
    const ds = r.n('length') / steps;
    for (let i = 0; i < r.i('count'); i++) {
      let p: Pt = [ctx.rng.range(-W / 2, W / 2), ctx.rng.range(-H / 2, H / 2)];
      const pts: Pt[] = [p];
      for (let k = 0; k < steps; k++) {
        const a = base + field(p[0] * sc, p[1] * sc) * Math.PI * r.n('turbulence');
        p = [p[0] + Math.cos(a) * ds, p[1] + Math.sin(a) * ds];
        pts.push(p);
      }
      const w = r.n('width') * (0.6 + ctx.rng.next() * 0.6);
      const ci = ctx.rng.int(0, pal.length - 1);
      byColor[ci] += ribbon(pts, (t) => w * Math.sin(Math.PI * t) ** 0.6 + 0.2);
    }
    return { kind: 'group', children: compact(byColor.map((d, i) => d && pathNode(ctx, `Trazos color ${i + 1}`, d, filled(pal[i], pal[i], 0), 'strokes'))) };
  },
};

export const ribbonShape: Generator = {
  id: 'org.ribbon',
  name: 'Cinta',
  category: 'organicas',
  description: 'Cinta que ondula y se retuerce mostrando sus dos caras en colores distintos.',
  keywords: ['cinta', 'cintas', 'listón', 'liston', 'ribbon', 'banda'],
  params: [
    { key: 'length', label: 'Largo', group: 'Cinta', type: 'number', min: 50, max: 1600, step: 1, default: 620, unit: 'px' },
    { key: 'width', label: 'Ancho', group: 'Cinta', type: 'number', min: 2, max: 200, step: 1, default: 46, unit: 'px' },
    { key: 'amplitude', label: 'Ondulación', group: 'Cinta', type: 'number', min: 0, max: 400, step: 1, default: 90, unit: 'px' },
    { key: 'waves', label: 'Ondas', group: 'Cinta', type: 'number', min: 0.2, max: 8, step: 0.1, default: 1.6 },
    { key: 'twists', label: 'Vueltas (giros)', group: 'Cinta', type: 'number', min: 0, max: 10, step: 0.5, default: 2.5 },
    { key: 'irregularity', label: 'Irregularidad', group: 'Cinta', type: 'number', min: 0, max: 1, step: 0.01, default: 0.25 },
    { key: 'front', label: 'Cara de adelante', group: 'Colores', type: 'color', default: PALETTE.c3 },
    { key: 'back', label: 'Cara de atrás', group: 'Colores', type: 'color', default: '#a97c18' },
    ...outlineParams(0),
  ],
  generate: (ctx) => {
    const r = reader(ctx.params);
    const L = r.n('length');
    const noise = fbm1D(ctx.rng, 3);
    const off = ctx.rng.range(0, 50);
    const steps = 160;
    const pts: Pt[] = [];
    const tw: number[] = [];
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      pts.push([-L / 2 + L * t, r.n('amplitude') * Math.sin(t * Math.PI * 2 * r.n('waves')) + noise(off + t * 3) * r.n('irregularity') * r.n('amplitude')]);
      tw.push(Math.cos(t * Math.PI * r.n('twists') + 0.3));
    }
    // Cada tramo entre dos giros es una cara: adelante (coseno positivo) o atrás (negativo).
    const runs: { from: number; to: number; front: boolean }[] = [];
    let start = 0;
    for (let k = 1; k <= steps; k++) {
      if (k === steps || Math.sign(tw[k]) !== Math.sign(tw[start])) {
        runs.push({ from: start, to: k, front: tw[start] >= 0 });
        start = k;
      }
    }
    let front = '';
    let back = '';
    const W = r.n('width');
    for (const run of runs) {
      const seg = pts.slice(run.from, run.to + 1);
      const ws = tw.slice(run.from, run.to + 1);
      if (seg.length < 2) continue;
      const d = ribbon(seg, (t) => Math.max(0.6, W * Math.abs(ws[Math.round(t * (ws.length - 1))])));
      if (run.front) front += d;
      else back += d;
    }
    const outline = r.s('outlineColor');
    const ow = r.n('outlineWidth');
    return {
      kind: 'group',
      children: compact([back && pathNode(ctx, 'Cara de atrás', back, filled(r.s('back'), outline, ow), 'back'), front && pathNode(ctx, 'Cara de adelante', front, filled(r.s('front'), outline, ow), 'front')]),
    };
  },
};

// ---------------------------------------------------------------------------
// Composición abstracta: un conjunto de formas ubicadas con criterio (equilibrio, separación, espacio negativo).

type Piece = { kind: string; r: number; x: number; y: number; rot: number; color: string };

function pieceGeometry(kind: string, size: number, rng: Rng): { d: string; stroke?: boolean } {
  switch (kind) {
    case 'blob':
      return { d: blobPath({ radius: size, vertices: 8, smoothness: 1, irregularity: 0.5, symmetry: 0, complexity: 3, stretch: 1 + rng.jitter(0.35) }, rng) };
    case 'drop':
      return { d: blobPath({ radius: size * 0.8, vertices: 12, smoothness: 1, irregularity: 0.15, symmetry: 0.7, complexity: 2, stretch: 1, tail: 0.8, tailAngle: rng.range(-180, 180) }, rng) };
    case 'pebble':
      return { d: blobPath({ radius: size, vertices: 10, smoothness: 0.9, irregularity: 0.3, symmetry: 0.3, complexity: 2, stretch: 1.5 }, rng) };
    case 'circle':
      return { d: ellipsePath(size, size) };
    case 'half':
      return { d: annularSector(size, 0, 180, 360) };
    case 'arc':
      return { d: annularSector(size, size * 0.62, rng.pick([0, 90, 180, 270]), rng.pick([0, 90, 180, 270]) + rng.pick([90, 180, 270])) };
    case 'ring':
      return { d: annularSector(size, size * 0.7, 0, 360) };
    case 'rect':
      return { d: roundedRect(size * 1.6, size * 1.1, size * 0.2) };
    case 'tri':
      return { d: roundedPolygon(regularPolygonPoints(3, size * 1.1), 0.15) };
    case 'waves': {
      let d = '';
      for (let i = 0; i < 3; i++) {
        const pts: Pt[] = [];
        for (let k = 0; k <= 24; k++) {
          const x = -size + (2 * size * k) / 24;
          pts.push([x, (i - 1) * size * 0.35 + Math.sin((x / size) * Math.PI * 1.5) * size * 0.15]);
        }
        d += smoothPath(pts, false);
      }
      return { d, stroke: true };
    }
    default: {
      // Puntos en grilla
      let d = '';
      const step = size * 0.55;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) d += `M${i * step - size * 0.1} ${j * step}a${size * 0.1} ${size * 0.1} 0 1 0 ${size * 0.2} 0a${size * 0.1} ${size * 0.1} 0 1 0 ${-size * 0.2} 0Z`;
      return { d };
    }
  }
}

const KINDS: Record<string, string[]> = {
  mixto: ['blob', 'blob', 'circle', 'half', 'arc', 'pebble', 'waves', 'dots', 'drop'],
  organico: ['blob', 'blob', 'pebble', 'drop'],
  geometrico: ['circle', 'half', 'arc', 'ring', 'rect', 'tri', 'dots'],
};

export const composition: Generator = {
  id: 'org.composition',
  name: 'Composición abstracta',
  category: 'organicas',
  description: 'Conjunto de formas con paleta propia. Controlás cantidad, distribución, separación, escala, rotación, equilibrio y espacio negativo.',
  keywords: ['composición', 'composicion', 'abstracta', 'abstracto', 'abstractas', 'conjunto', 'collage'],
  params: [
    {
      key: 'kinds',
      label: 'Tipo de formas',
      group: 'Formas',
      type: 'select',
      options: [
        { value: 'mixto', label: 'Mixtas' },
        { value: 'organico', label: 'Orgánicas' },
        { value: 'geometrico', label: 'Geométricas' },
      ],
      default: 'mixto',
    },
    { key: 'count', label: 'Cantidad', group: 'Formas', type: 'number', min: 1, max: 60, step: 1, default: 11 },
    { key: 'sizeMax', label: 'Tamaño máximo', group: 'Formas', type: 'number', min: 10, max: 400, step: 1, default: 120, unit: 'px' },
    { key: 'sizeVar', label: 'Variación de tamaños', group: 'Formas', type: 'number', min: 0, max: 0.95, step: 0.01, default: 0.7 },
    { key: 'rotation', label: 'Rotación', group: 'Formas', type: 'number', min: 0, max: 180, step: 1, default: 90, unit: '°' },
    {
      key: 'layout',
      label: 'Distribución',
      group: 'Composición',
      type: 'select',
      options: [
        { value: 'libre', label: 'Libre' },
        { value: 'agrupada', label: 'Agrupada al centro' },
        { value: 'fila', label: 'En fila horizontal' },
        { value: 'diagonal', label: 'En diagonal' },
        { value: 'circulo', label: 'En círculo' },
      ],
      default: 'libre',
    },
    { key: 'spacing', label: 'Separación', group: 'Composición', type: 'number', min: 0, max: 1, step: 0.01, default: 0.45 },
    { key: 'balance', label: 'Equilibrio visual', group: 'Composición', type: 'number', min: 0, max: 1, step: 0.01, default: 0.8 },
    { key: 'negative', label: 'Espacio negativo', group: 'Composición', type: 'number', min: 0, max: 1, step: 0.01, default: 0.4 },
    { key: 'areaW', label: 'Ancho del área', group: 'Composición', type: 'number', min: 50, max: 2000, step: 1, default: 760, unit: 'px' },
    { key: 'areaH', label: 'Alto del área', group: 'Composición', type: 'number', min: 50, max: 2000, step: 1, default: 480, unit: 'px' },
    ...paletteParams(),
    ...outlineParams(0),
  ],
  generate: (ctx) => {
    const r = reader(ctx.params);
    const rng = ctx.rng;
    const W = r.n('areaW');
    const H = r.n('areaH');
    const n = r.i('count');
    const kinds = KINDS[r.s('kinds')] ?? KINDS.mixto;
    const pal = paletteOf(ctx.params);
    // El espacio negativo achica todo en proporción: más espacio libre = formas más chicas.
    const maxR = r.n('sizeMax') * (1.25 - r.n('negative') * 0.75);
    const sizes = Array.from({ length: n }, () => maxR * (1 - r.n('sizeVar') * rng.next() ** 0.7)).sort((a, b) => b - a);
    const gap = r.n('spacing');
    const placed: Piece[] = [];
    sizes.forEach((size, i) => {
      let rr = size;
      for (let attempt = 0; attempt < 120; attempt++) {
        let x: number;
        let y: number;
        const layout = r.s('layout');
        if (layout === 'agrupada') {
          x = rng.jitter(1) * rng.jitter(1) * W * 0.5;
          y = rng.jitter(1) * rng.jitter(1) * H * 0.5;
        } else if (layout === 'fila') {
          x = -W / 2 + rr + ((W - 2 * rr) * (i + rng.next() * 0.6)) / Math.max(1, n);
          y = rng.jitter(H * 0.18);
        } else if (layout === 'diagonal') {
          const t = rng.next();
          x = -W / 2 + W * t + rng.jitter(W * 0.08);
          y = H / 2 - H * t + rng.jitter(H * 0.12);
        } else if (layout === 'circulo') {
          const a = (i / n) * Math.PI * 2 + rng.jitter(0.2);
          x = Math.cos(a) * (W / 2 - rr) * 0.85;
          y = Math.sin(a) * (H / 2 - rr) * 0.85;
        } else {
          x = rng.range(-W / 2 + rr, W / 2 - rr);
          y = rng.range(-H / 2 + rr, H / 2 - rr);
        }
        const ok = placed.every((p) => Math.hypot(p.x - x, p.y - y) >= (p.r + rr) * (0.35 + gap * 0.9));
        if (ok || attempt === 119) {
          placed.push({ kind: rng.pick(kinds), r: rr, x, y, rot: rng.jitter(r.n('rotation')), color: pal[(i + rng.int(0, 3)) % pal.length] });
          break;
        }
        if (attempt % 30 === 29) rr *= 0.85; // no entra: se achica un poco y vuelve a probar
      }
    });
    // Equilibrio: el centro de "peso" visual (área) se lleva hacia el centro del área.
    const mass = placed.reduce((a, p) => a + p.r * p.r, 0) || 1;
    const cx = placed.reduce((a, p) => a + p.x * p.r * p.r, 0) / mass;
    const cy = placed.reduce((a, p) => a + p.y * p.r * p.r, 0) / mass;
    const outline = r.s('outlineColor');
    const ow = r.n('outlineWidth');
    const children = placed.map((p, i) => {
      const geo = pieceGeometry(p.kind, p.r, rng);
      const style = geo.stroke ? line(p.color, Math.max(1.5, p.r * 0.06)) : filled(p.color, outline, ow);
      const node = pathNode(ctx, `Forma ${i + 1}`, geo.d, style, 'shape');
      node.transform = { x: p.x - cx * r.n('balance'), y: p.y - cy * r.n('balance'), rotation: p.rot, scale: 1 };
      return node;
    });
    return { kind: 'group', children };
  },
};

export const organicGenerators: Generator[] = [blob, fluid, irregular, superShape, waves, flowCurves, ribbonShape, composition];
