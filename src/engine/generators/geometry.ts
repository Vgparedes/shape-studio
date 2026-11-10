// Generadores geométricos básicos (Etapa 1). Sirven de base para la biblioteca y para
// probar el ciclo completo: crear, cambiar parámetros, regenerar con otra semilla y exportar.
import type { Generator, GenContext } from './types';
import type { PathNode, Style } from '../../core/types';
import { IDENTITY } from '../../core/scene';
import {
  annularSector,
  ellipsePath,
  polyline,
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
  also: ['simbolos'],
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
  also: ['organicas'],
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

export const arc: Generator = {
  id: 'geo.arc',
  name: 'Arco',
  category: 'geometria',
  description: 'Arco con grosor: desde una línea curva hasta un semicírculo o una porción de torta.',
  keywords: ['arco', 'arcos', 'semicírculo', 'semicirculo', 'medialuna', 'arc'],
  params: [
    { key: 'radius', label: 'Radio', type: 'number', min: 5, max: 600, step: 1, default: 150, unit: 'px' },
    { key: 'thickness', label: 'Grosor (0 = torta)', type: 'number', min: 0, max: 1, step: 0.01, default: 0.3 },
    { key: 'start', label: 'Desde', type: 'number', min: -360, max: 360, step: 1, default: 180, unit: '°' },
    { key: 'sweep', label: 'Abertura', type: 'number', min: 1, max: 360, step: 1, default: 180, unit: '°' },
  ],
  generate: (ctx) => {
    const R = n(ctx, 'radius');
    const start = n(ctx, 'start');
    return { kind: 'path', d: annularSector(R, R * (1 - n(ctx, 'thickness')), start, start + n(ctx, 'sweep')), style: { ...FILL, fill: '#c4553a' } };
  },
};

export const network: Generator = {
  id: 'geo.network',
  name: 'Red geométrica',
  category: 'geometria',
  description: 'Malla cuadrada, triangular o hexagonal, con nodos y deformación opcional.',
  keywords: ['red', 'redes', 'malla', 'grilla', 'retícula', 'reticula', 'panal', 'hexagonal', 'network', 'grid'],
  params: [
    {
      key: 'type',
      label: 'Tipo',
      type: 'select',
      options: [
        { value: 'square', label: 'Cuadrada' },
        { value: 'triangle', label: 'Triangular' },
        { value: 'hex', label: 'Hexagonal (panal)' },
      ],
      default: 'hex',
    },
    { key: 'cols', label: 'Columnas', type: 'number', min: 1, max: 40, step: 1, default: 7 },
    { key: 'rows', label: 'Filas', type: 'number', min: 1, max: 40, step: 1, default: 5 },
    { key: 'cell', label: 'Tamaño de celda', type: 'number', min: 4, max: 200, step: 1, default: 44, unit: 'px' },
    { key: 'jitter', label: 'Deformación', type: 'number', min: 0, max: 0.5, step: 0.01, default: 0 },
    { key: 'nodes', label: 'Tamaño de los nodos', type: 'number', min: 0, max: 30, step: 0.5, default: 4, unit: 'px' },
    { key: 'width', label: 'Grosor de líneas', type: 'number', min: 0.2, max: 12, step: 0.1, default: 2, unit: 'px' },
    { key: 'color', label: 'Color', type: 'color', default: '#2b2620' },
  ],
  generate: (ctx) => {
    const cols = Math.round(n(ctx, 'cols'));
    const rows = Math.round(n(ctx, 'rows'));
    const c = n(ctx, 'cell');
    const jit = n(ctx, 'jitter') * c;
    const color = String(ctx.params.color);
    // Los vértices compartidos se deforman igual en todas las celdas que los usan.
    const cache = new Map<string, Pt>();
    const v = (x: number, y: number): Pt => {
      const key = `${Math.round(x * 10)},${Math.round(y * 10)}`;
      let p = cache.get(key);
      if (!p) cache.set(key, (p = [x + ctx.rng.jitter(jit), y + ctx.rng.jitter(jit)]));
      return p;
    };
    const edges = new Set<string>();
    let lines = '';
    const edge = (a: Pt, b: Pt) => {
      const k = [a, b].map((p) => p.join(',')).sort().join('|');
      if (edges.has(k)) return;
      edges.add(k);
      lines += polyline([a, b], false);
    };
    const type = ctx.params.type;
    if (type === 'hex') {
      const w = Math.sqrt(3) * c;
      const ox = -((cols - 0.5) * w) / 2;
      const oy = -((rows - 1) * 1.5 * c) / 2;
      for (let r = 0; r < rows; r++)
        for (let q = 0; q < cols; q++) {
          const cx = ox + q * w + (r % 2) * (w / 2);
          const cy = oy + r * 1.5 * c;
          const pts = Array.from({ length: 6 }, (_, i) => v(cx + Math.cos(((60 * i - 30) * Math.PI) / 180) * c, cy + Math.sin(((60 * i - 30) * Math.PI) / 180) * c));
          pts.forEach((p, i) => edge(p, pts[(i + 1) % 6]));
        }
    } else if (type === 'triangle') {
      const h = (c * Math.sqrt(3)) / 2;
      const ox = -(cols * c) / 2;
      const oy = -(rows * h) / 2;
      for (let r = 0; r <= rows; r++)
        for (let q = 0; q <= cols; q++) {
          const shift = (r % 2) * (c / 2);
          const p = v(ox + q * c + shift, oy + r * h);
          if (q < cols) edge(p, v(ox + (q + 1) * c + shift, oy + r * h));
          if (r < rows) {
            const ns = ((r + 1) % 2) * (c / 2);
            const a = v(ox + q * c + ns, oy + (r + 1) * h);
            edge(p, a);
            const bx = shift ? ox + (q + 1) * c + ns : ox + (q - 1) * c + ns;
            if (bx >= ox - 1e-6 && bx <= ox + cols * c + c / 2 + 1e-6) edge(p, v(bx, oy + (r + 1) * h));
          }
        }
    } else {
      const ox = -(cols * c) / 2;
      const oy = -(rows * c) / 2;
      for (let r = 0; r <= rows; r++)
        for (let q = 0; q <= cols; q++) {
          const p = v(ox + q * c, oy + r * c);
          if (q < cols) edge(p, v(ox + (q + 1) * c, oy + r * c));
          if (r < rows) edge(p, v(ox + q * c, oy + (r + 1) * c));
        }
    }
    const children: PathNode[] = [
      { id: ctx.uid(), name: 'Líneas', kind: 'path', d: lines, style: { ...LINE, stroke: color, strokeWidth: n(ctx, 'width') }, transform: { ...IDENTITY }, opacity: 1, hidden: false, locked: false },
    ];
    const nr = n(ctx, 'nodes');
    if (nr > 0) {
      const dots = [...cache.values()].map(([x, y]) => `M${x - nr} ${y}a${nr} ${nr} 0 1 0 ${nr * 2} 0a${nr} ${nr} 0 1 0 ${-nr * 2} 0Z`).join('');
      children.push({ id: ctx.uid(), name: 'Nodos', kind: 'path', d: dots, style: { fill: color, stroke: null, strokeWidth: 0 }, transform: { ...IDENTITY }, opacity: 1, hidden: false, locked: false });
    }
    return { kind: 'group', children };
  },
};

function koch(a: Pt, b: Pt, depth: number, out: Pt[]) {
  if (depth === 0) {
    out.push(a);
    return;
  }
  const d: Pt = [(b[0] - a[0]) / 3, (b[1] - a[1]) / 3];
  const p1: Pt = [a[0] + d[0], a[1] + d[1]];
  const p3: Pt = [a[0] + 2 * d[0], a[1] + 2 * d[1]];
  const ang = Math.atan2(d[1], d[0]) - Math.PI / 3;
  const L = Math.hypot(d[0], d[1]);
  const p2: Pt = [p1[0] + Math.cos(ang) * L, p1[1] + Math.sin(ang) * L];
  koch(a, p1, depth - 1, out);
  koch(p1, p2, depth - 1, out);
  koch(p2, p3, depth - 1, out);
  koch(p3, b, depth - 1, out);
}

export const fractal: Generator = {
  id: 'geo.fractal',
  name: 'Fractal',
  category: 'geometria',
  description: 'Copo de Koch, triángulo y alfombra de Sierpinski o curva del dragón, con la profundidad que elijas.',
  keywords: ['fractal', 'fractales', 'koch', 'sierpinski', 'dragón', 'dragon', 'copo'],
  params: [
    {
      key: 'type',
      label: 'Tipo',
      type: 'select',
      options: [
        { value: 'koch', label: 'Copo de Koch' },
        { value: 'sierpinski', label: 'Triángulo de Sierpinski' },
        { value: 'carpet', label: 'Alfombra de Sierpinski' },
        { value: 'dragon', label: 'Curva del dragón' },
      ],
      default: 'koch',
    },
    { key: 'depth', label: 'Profundidad', type: 'number', min: 0, max: 6, step: 1, default: 3 },
    { key: 'size', label: 'Tamaño', type: 'number', min: 20, max: 800, step: 1, default: 300, unit: 'px' },
    { key: 'color', label: 'Color', type: 'color', default: '#3f6fb5' },
  ],
  generate: (ctx) => {
    const type = ctx.params.type;
    const S = n(ctx, 'size');
    const color = String(ctx.params.color);
    // Topes por tipo: más allá, la cantidad de piezas crece tanto que el archivo deja de ser práctico.
    const depth = Math.min(Math.round(n(ctx, 'depth')), type === 'carpet' ? 4 : type === 'koch' ? 5 : 6);
    if (type === 'sierpinski') {
      let d = '';
      const tri = (a: Pt, b: Pt, c: Pt, k: number) => {
        if (k === 0) {
          d += polyline([a, b, c], true);
          return;
        }
        const ab: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const bc: Pt = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2];
        const ca: Pt = [(c[0] + a[0]) / 2, (c[1] + a[1]) / 2];
        tri(a, ab, ca, k - 1);
        tri(ab, b, bc, k - 1);
        tri(ca, bc, c, k - 1);
      };
      const pts = regularPolygonPoints(3, S / Math.sqrt(3));
      tri(pts[0], pts[1], pts[2], depth);
      return { kind: 'path', d, style: { fill: color, stroke: null, strokeWidth: 0 } };
    }
    if (type === 'carpet') {
      let d = roundedRect(S, S, 0);
      // Los agujeros se dibujan como subcaminos en sentido contrario.
      const hole = (x: number, y: number, s: number, k: number) => {
        if (k === 0) return;
        const t = s / 3;
        d += `M${x + t} ${y + t}V${y + 2 * t}H${x + 2 * t}V${y + t}Z`;
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (i !== 1 || j !== 1) hole(x + i * t, y + j * t, t, k - 1);
      };
      hole(-S / 2, -S / 2, S, depth);
      return { kind: 'path', d, style: { fill: color, stroke: null, strokeWidth: 0 } };
    }
    if (type === 'dragon') {
      let turns: number[] = [];
      const iters = depth * 2 + 2;
      for (let i = 0; i < iters; i++) turns = [...turns, 1, ...turns.slice().reverse().map((t) => -t)];
      let ang = 0;
      let p: Pt = [0, 0];
      const pts: Pt[] = [p];
      const step = 1;
      for (const t of [0, ...turns]) {
        ang += (t * Math.PI) / 2;
        p = [p[0] + Math.cos(ang) * step, p[1] + Math.sin(ang) * step];
        pts.push(p);
      }
      const xs = pts.map((q) => q[0]);
      const ys = pts.map((q) => q[1]);
      const w = Math.max(...xs) - Math.min(...xs) || 1;
      const h = Math.max(...ys) - Math.min(...ys) || 1;
      const k = S / Math.max(w, h);
      const mx = (Math.max(...xs) + Math.min(...xs)) / 2;
      const my = (Math.max(...ys) + Math.min(...ys)) / 2;
      return { kind: 'path', d: polyline(pts.map(([x, y]) => [(x - mx) * k, (y - my) * k] as Pt), false), style: { ...LINE, stroke: color, strokeWidth: Math.max(0.6, k * 0.45) } };
    }
    const tri = regularPolygonPoints(3, S / Math.sqrt(3), -90);
    const out: Pt[] = [];
    // Recorrido en sentido horario para que los picos apunten hacia afuera.
    koch(tri[0], tri[1], depth, out);
    koch(tri[1], tri[2], depth, out);
    koch(tri[2], tri[0], depth, out);
    return { kind: 'path', d: polyline(out, true), style: { fill: color, stroke: null, strokeWidth: 0 } };
  },
};

export const geometryGenerators: Generator[] = [rectangle, ellipse, polygon, star, arc, spiral, concentric, network, fractal];
