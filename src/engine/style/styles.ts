// Style Engine: 20 estilos visuales. Cada estilo reconstruye la geometría de cada path
// (puntos, tramas, líneas, facetas…). No es un filtro de color: lo que sale es vector nuevo.
import type { ParamDef, GenContext } from '../generators/types';
import type { PathNode, SceneNode, Style } from '../../core/types';
import type { Pt } from '../geometry/path';
import { polyline, smoothPath } from '../geometry/path';
import { ribbon } from '../geometry/ribbon';
import { fbm1D } from '../geometry/noise';
import { hexToRgb, rgbToHex, shade } from '../../core/color';
import { pathNode } from '../generators/build';
import { darkness, dotsPath, gridInside, hatchInside, isClosed, simplify, toneAt, withShape, wobble, type Box, type ShapeInfo } from './geometry';

export interface StyleDef {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  params: ParamDef[];
  /** Transforma un path (en sus coordenadas locales). Puede devolver varios nodos. */
  path(node: PathNode, ctx: GenContext): SceneNode[];
  /** Retoque opcional sobre la figura completa (por ejemplo, cotas del estilo técnico). */
  decorate?(box: Box, ctx: GenContext): SceneNode[];
}

// ---------------------------------------------------------------------------
// Ayudas

const num = (ctx: GenContext, k: string) => Number(ctx.params[k]);
const str = (ctx: GenContext, k: string) => String(ctx.params[k]);
const bool = (ctx: GenContext, k: string) => Boolean(ctx.params[k]);

const baseColor = (n: PathNode) => n.style.fill ?? n.style.stroke ?? '#2b2620';
const isLine = (n: PathNode) => !n.style.fill;
const lineStyle = (color: string, width: number): Style => ({ fill: null, stroke: color, strokeWidth: width, lineCap: 'round', lineJoin: 'round' });
const fillStyle = (color: string, stroke: string | null = null, width = 0): Style => ({ fill: color, stroke: width > 0 ? stroke : null, strokeWidth: width, lineJoin: 'round', lineCap: 'round' });

function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

const inkParams = (def = 'ink'): ParamDef[] => [
  { key: 'colorMode', label: 'Color', type: 'select', options: [{ value: 'ink', label: 'Tinta única' }, { value: 'own', label: 'El color de cada parte' }], default: def },
  { key: 'ink', label: 'Tinta', type: 'color', default: '#2b2620' },
];
const inkOf = (n: PathNode, ctx: GenContext, darken = 0) => (str(ctx, 'colorMode') === 'own' ? shade(baseColor(n), darken) : str(ctx, 'ink'));

const lightParams = (angle = -135, strength = 0.6): ParamDef[] => [
  { key: 'light', label: 'Luz desde', type: 'number', min: -180, max: 180, step: 1, default: angle, unit: '°' },
  { key: 'shading', label: 'Sombreado', type: 'number', min: 0, max: 1.5, step: 0.01, default: strength },
];

/** Fondo de papel: tapa lo que está detrás, como en un grabado o un dibujo sobre hoja. */
const paperParams = (on: boolean): ParamDef[] => [
  { key: 'paper', label: 'Fondo de papel (tapa lo de atrás)', type: 'boolean', default: on },
  { key: 'paperColor', label: 'Papel', type: 'color', default: '#ffffff' },
];
const withPaper = (n: PathNode, ctx: GenContext, nodes: SceneNode[]): SceneNode[] =>
  bool(ctx, 'paper') && !isLine(n) ? [pathNode(ctx, `${n.name} · papel`, n.d, fillStyle(str(ctx, 'paperColor')), 'paper'), ...nodes] : nodes;

const contourPaths = (s: ShapeInfo, fn: (pts: Pt[], closed: boolean) => string) => s.contours.map((c) => fn(c, isClosed(c))).join('');

function shapeOr<T>(n: PathNode, fn: (s: ShapeInfo) => T, fallback: T, step = 3): T {
  return withShape(n.d, fn, step) ?? fallback;
}

/** Puntos a lo largo de los contornos, cada `gap` px. */
function alongContours(s: ShapeInfo, gap: number): Pt[] {
  const out: Pt[] = [];
  for (const c of s.contours) {
    let acc = 0;
    for (let i = 1; i < c.length; i++) {
      acc += Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]);
      if (acc >= gap) {
        out.push(c[i]);
        acc = 0;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Estilos

const lineArt: StyleDef = {
  id: 'lineart',
  name: 'Line Art',
  description: 'Solo trazos vectoriales limpios, del mismo grosor, sin rellenos.',
  keywords: ['line art', 'lineart', 'lineal', 'línea', 'linea', 'trazo', 'contorno fino'],
  params: [{ key: 'width', label: 'Grosor', type: 'number', min: 0.3, max: 12, step: 0.1, default: 1.6, unit: 'px' }, ...inkParams(), ...paperParams(false)],
  path: (n, ctx) => withPaper(n, ctx, [pathNode(ctx, n.name, n.d, lineStyle(inkOf(n, ctx, -0.35), num(ctx, 'width')), n.role)]),
};

const outline: StyleDef = {
  id: 'outline',
  name: 'Outline',
  description: 'Formas rellenas de un color de papel con contorno grueso, tipo sticker o libro para colorear.',
  keywords: ['outline', 'contorno', 'contorno grueso', 'para colorear', 'sticker', 'delineado'],
  params: [
    { key: 'width', label: 'Grosor del contorno', type: 'number', min: 0.5, max: 16, step: 0.1, default: 3.5, unit: 'px' },
    { key: 'paper', label: 'Relleno', type: 'color', default: '#ffffff' },
    ...inkParams(),
  ],
  path: (n, ctx) => [pathNode(ctx, n.name, n.d, isLine(n) ? lineStyle(inkOf(n, ctx, -0.35), num(ctx, 'width')) : fillStyle(str(ctx, 'paper'), inkOf(n, ctx, -0.35), num(ctx, 'width')), n.role)],
};

const solid: StyleDef = {
  id: 'solid',
  name: 'Solid',
  description: 'Siluetas planas rellenas, sin contornos.',
  keywords: ['solid', 'sólido', 'solido', 'relleno', 'silueta', 'siluetas', 'plano'],
  params: [{ key: 'mono', label: 'Todo de un color', type: 'boolean', default: false }, { key: 'color', label: 'Color', type: 'color', default: '#2b2620' }],
  path: (n, ctx) => {
    const c = bool(ctx, 'mono') ? str(ctx, 'color') : baseColor(n);
    return [pathNode(ctx, n.name, n.d, isLine(n) ? lineStyle(c, Math.max(n.style.strokeWidth, 1)) : fillStyle(c), n.role)];
  },
};

const minimalist: StyleDef = {
  id: 'minimalist',
  name: 'Minimalist',
  description: 'Simplifica la geometría: menos puntos, sin detalles chicos, colores reducidos.',
  keywords: ['minimalista', 'minimal', 'minimalist', 'simple', 'simplificado', 'limpio'],
  params: [
    { key: 'detail', label: 'Detalle', type: 'number', min: 0, max: 1, step: 0.01, default: 0.35 },
    { key: 'minSize', label: 'Quitar piezas más chicas que', type: 'number', min: 0, max: 60, step: 1, default: 8, unit: 'px' },
    { key: 'mono', label: 'Un solo color', type: 'boolean', default: false },
    { key: 'color', label: 'Color', type: 'color', default: '#2b2620' },
  ],
  path: (n, ctx) => {
    const color = bool(ctx, 'mono') ? str(ctx, 'color') : baseColor(n);
    const d = shapeOr(
      n,
      (s) => {
        const diag = Math.hypot(s.box.width, s.box.height);
        if (diag < num(ctx, 'minSize')) return '';
        const eps = Math.max(0.5, diag * (0.08 - 0.075 * num(ctx, 'detail')));
        return contourPaths(s, (c, closed) => {
          const xs = c.map((p) => p[0]);
          const ys = c.map((p) => p[1]);
          if (Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) < num(ctx, 'minSize')) return '';
          // Las piezas finitas (tallos, raíces) no se pueden simplificar tanto como su largo: se aplastarían.
          const thin = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
          const simple = simplify(c, Math.max(0.4, Math.min(eps, thin * 0.2)));
          return simple.length < 3 && closed ? '' : smoothPath(closed ? simple.slice(0, -1) : simple, closed, 1);
        });
      },
      n.d,
      4,
    );
    if (!d) return [];
    return [pathNode(ctx, n.name, d, isLine(n) ? lineStyle(color, Math.max(1.5, n.style.strokeWidth)) : fillStyle(color), n.role)];
  },
};

const botanicalStyle: StyleDef = {
  id: 'botanical',
  name: 'Botanical',
  description: 'Lámina de ilustración botánica: colores suaves, contorno fino y sombreado con rayitas del lado de la sombra.',
  keywords: ['botánico', 'botanico', 'botanical', 'lámina', 'lamina', 'ilustración científica', 'acuarela'],
  params: [
    { key: 'soft', label: 'Suavidad del color', type: 'number', min: 0, max: 0.8, step: 0.01, default: 0.35 },
    { key: 'spacing', label: 'Separación de rayitas', type: 'number', min: 1.5, max: 20, step: 0.5, default: 4, unit: 'px' },
    { key: 'width', label: 'Grosor de línea', type: 'number', min: 0.2, max: 4, step: 0.1, default: 0.8, unit: 'px' },
    ...lightParams(-135, 0.9),
    { key: 'ink', label: 'Tinta', type: 'color', default: '#3a2e22' },
  ],
  path: (n, ctx) => {
    if (isLine(n)) return [pathNode(ctx, n.name, n.d, lineStyle(str(ctx, 'ink'), num(ctx, 'width')), n.role)];
    const base = baseColor(n);
    const hatch = shapeOr(
      n,
      (s) =>
        hatchInside(s, num(ctx, 'spacing'), num(ctx, 'light') + 90 + 35)
          .map((run) => run.filter((p) => toneAt(0.35, p, s.box, num(ctx, 'light'), num(ctx, 'shading')) > 0.5))
          .filter((run) => run.length > 1)
          .map((run) => polyline([run[0], run[run.length - 1]], false))
          .join(''),
      '',
    );
    return [
      pathNode(ctx, n.name, n.d, fillStyle(shade(base, num(ctx, 'soft')), str(ctx, 'ink'), num(ctx, 'width')), n.role),
      ...(hatch ? [pathNode(ctx, `${n.name} · sombra`, hatch, lineStyle(shade(base, -0.45), num(ctx, 'width') * 0.7), 'hatch')] : []),
    ];
  },
};

const geometric: StyleDef = {
  id: 'geometric',
  name: 'Geometric',
  description: 'Convierte las curvas en facetas rectas, como un low-poly.',
  keywords: ['geométrico', 'geometrico', 'geometric', 'facetado', 'low poly', 'lowpoly', 'anguloso', 'poligonal'],
  params: [
    { key: 'facets', label: 'Tamaño de las facetas', type: 'number', min: 0.005, max: 0.25, step: 0.005, default: 0.03 },
    { key: 'snap', label: 'Ángulos de 45°', type: 'boolean', default: false },
  ],
  path: (n, ctx) => {
    const d = shapeOr(
      n,
      (s) => {
        const eps = Math.max(0.8, Math.hypot(s.box.width, s.box.height) * num(ctx, 'facets'));
        return contourPaths(s, (c, closed) => {
          let simple = simplify(c, eps);
          if (bool(ctx, 'snap') && simple.length > 2) {
            const out: Pt[] = [simple[0]];
            for (let i = 1; i < simple.length; i++) {
              const p = out[out.length - 1];
              const dx = simple[i][0] - p[0];
              const dy = simple[i][1] - p[1];
              const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
              const L = Math.hypot(dx, dy);
              out.push([p[0] + Math.cos(a) * L, p[1] + Math.sin(a) * L]);
            }
            simple = out;
          }
          return polyline(closed ? simple.slice(0, -1) : simple, closed);
        });
      },
      n.d,
      4,
    );
    return [pathNode(ctx, n.name, d, { ...n.style, lineJoin: 'miter' }, n.role)];
  },
};

const organic: StyleDef = {
  id: 'organic',
  name: 'Organic',
  description: 'Ablanda y ondula los contornos para que todo se vea más orgánico y blando.',
  keywords: ['orgánico', 'organico', 'organic', 'blando', 'fluido', 'ondulado'],
  params: [
    { key: 'amount', label: 'Ondulación', type: 'number', min: 0, max: 30, step: 0.5, default: 6, unit: 'px' },
    { key: 'freq', label: 'Frecuencia', type: 'number', min: 0.01, max: 0.4, step: 0.01, default: 0.06 },
  ],
  path: (n, ctx) => {
    const noise = fbm1D(ctx.rng, 2);
    const d = shapeOr(
      n,
      (s) => contourPaths(s, (c, closed) => smoothPath(wobble(simplify(c, 0.6), num(ctx, 'amount'), noise, ctx.rng.range(0, 100), num(ctx, 'freq')), closed, 1)),
      n.d,
      4,
    );
    return [pathNode(ctx, n.name, d, n.style, n.role)];
  },
};

const dotwork: StyleDef = {
  id: 'dotwork',
  name: 'Dotwork',
  description: 'Reconstruye superficies y contornos con puntos. Las zonas oscuras y de sombra llevan puntos más grandes.',
  keywords: ['dotwork', 'puntos', 'puntillismo', 'punteado', 'dots'],
  params: [
    { key: 'spacing', label: 'Separación', type: 'number', min: 1.5, max: 30, step: 0.5, default: 4.5, unit: 'px' },
    { key: 'size', label: 'Tamaño de punto', type: 'number', min: 0.2, max: 10, step: 0.1, default: 1.5, unit: 'px' },
    { key: 'contour', label: 'Contorno de puntos', type: 'boolean', default: true },
    ...lightParams(-135, 0.7),
    ...inkParams(),
    ...paperParams(true),
  ],
  path: (n, ctx) => {
    const ink = inkOf(n, ctx, -0.2);
    const sp = num(ctx, 'spacing');
    const size = num(ctx, 'size');
    const d = shapeOr(
      n,
      (s) => {
        let out = '';
        if (!isLine(n)) {
          const base = 0.15 + darkness(n.style.fill) * 0.75;
          const pts = gridInside(s, sp, 0, 0.35, ctx.rng);
          out += dotsPath(pts, (p) => {
            const t = toneAt(base, p, s.box, num(ctx, 'light'), num(ctx, 'shading'));
            return ctx.rng.next() > t * 1.2 ? 0 : size * Math.sqrt(t);
          });
        }
        if (bool(ctx, 'contour') || isLine(n)) out += dotsPath(alongContours(s, sp * 0.8), () => size * (isLine(n) ? Math.max(0.6, n.style.strokeWidth / 3) : 0.9));
        return out;
      },
      '',
      2,
    );
    return withPaper(n, ctx, d ? [pathNode(ctx, n.name, d, fillStyle(ink), n.role)] : []);
  },
};

const stippling: StyleDef = {
  id: 'stippling',
  name: 'Stippling',
  description: 'Puntillismo al azar: la densidad de puntos marca las luces y las sombras, sin grilla.',
  keywords: ['stippling', 'estipple', 'puntillismo', 'puntillado', 'puntos al azar'],
  params: [
    { key: 'density', label: 'Densidad', type: 'number', min: 0.05, max: 1.5, step: 0.01, default: 0.45 },
    { key: 'size', label: 'Tamaño de punto', type: 'number', min: 0.2, max: 6, step: 0.1, default: 0.9, unit: 'px' },
    { key: 'contour', label: 'Contorno de puntos', type: 'boolean', default: true },
    ...lightParams(-135, 1),
    ...inkParams(),
    ...paperParams(true),
  ],
  path: (n, ctx) => {
    const ink = inkOf(n, ctx, -0.2);
    const size = num(ctx, 'size');
    const d = shapeOr(
      n,
      (s) => {
        const pts: Pt[] = [];
        if (!isLine(n)) {
          const base = 0.1 + darkness(n.style.fill) * 0.7;
          const tries = Math.min(12000, Math.round(s.box.width * s.box.height * 0.12 * num(ctx, 'density')));
          for (let i = 0; i < tries; i++) {
            const p: Pt = [s.box.x + ctx.rng.next() * s.box.width, s.box.y + ctx.rng.next() * s.box.height];
            const t = toneAt(base, p, s.box, num(ctx, 'light'), num(ctx, 'shading'));
            if (ctx.rng.next() < t ** 1.4 && s.inside(p[0], p[1])) pts.push(p);
          }
        }
        let out = dotsPath(pts, () => size);
        if (bool(ctx, 'contour') || isLine(n)) out += dotsPath(alongContours(s, size * 2.6), () => size);
        return out;
      },
      '',
      2,
    );
    return withPaper(n, ctx, d ? [pathNode(ctx, n.name, d, fillStyle(ink), n.role)] : []);
  },
};

const halftone: StyleDef = {
  id: 'halftone',
  name: 'Halftone',
  description: 'Semitono de imprenta: grilla girada de puntos cuyo tamaño sigue el tono.',
  keywords: ['halftone', 'semitono', 'trama de puntos', 'imprenta', 'pop art', 'cómic', 'comic'],
  params: [
    { key: 'spacing', label: 'Separación', type: 'number', min: 2, max: 40, step: 0.5, default: 7, unit: 'px' },
    { key: 'angle', label: 'Ángulo de la trama', type: 'number', min: 0, max: 90, step: 1, default: 45, unit: '°' },
    { key: 'gain', label: 'Tamaño máximo', type: 'number', min: 0.2, max: 1, step: 0.01, default: 0.62 },
    ...lightParams(-135, 0.8),
    ...inkParams('own'),
    ...paperParams(false),
  ],
  path: (n, ctx) => {
    const ink = inkOf(n, ctx, -0.1);
    const sp = num(ctx, 'spacing');
    const d = shapeOr(
      n,
      (s) => {
        if (isLine(n)) return dotsPath(alongContours(s, sp * 0.5), () => Math.max(0.6, n.style.strokeWidth / 2));
        const base = 0.25 + darkness(n.style.fill) * 0.6;
        return dotsPath(gridInside(s, sp, num(ctx, 'angle')), (p) => sp * num(ctx, 'gain') * Math.sqrt(toneAt(base, p, s.box, num(ctx, 'light'), num(ctx, 'shading'))));
      },
      '',
      2,
    );
    return withPaper(n, ctx, d ? [pathNode(ctx, n.name, d, fillStyle(ink), n.role)] : []);
  },
};

const engraving: StyleDef = {
  id: 'engraving',
  name: 'Engraving',
  description: 'Grabado: sombras hechas con líneas paralelas que engordan en las zonas oscuras, contrahachurado y contorno.',
  keywords: ['grabado', 'engraving', 'xilografía', 'xilografia', 'billete', 'antiguo', 'aguafuerte', 'tramado', 'hatching'],
  params: [
    { key: 'spacing', label: 'Separación de líneas', type: 'number', min: 1.5, max: 20, step: 0.5, default: 4, unit: 'px' },
    { key: 'angle', label: 'Ángulo', type: 'number', min: -90, max: 90, step: 1, default: 35, unit: '°' },
    { key: 'weight', label: 'Grosor máximo', type: 'number', min: 0.2, max: 6, step: 0.1, default: 2, unit: 'px' },
    { key: 'cross', label: 'Contrahachurado en sombras', type: 'boolean', default: true },
    { key: 'contourW', label: 'Grosor del contorno', type: 'number', min: 0, max: 6, step: 0.1, default: 1.4, unit: 'px' },
    ...lightParams(-135, 1),
    ...inkParams(),
    ...paperParams(true),
  ],
  path: (n, ctx) => {
    const ink = inkOf(n, ctx, -0.35);
    const res = shapeOr(
      n,
      (s) => {
        if (isLine(n)) return { lines: '', cross: '' };
        const base = 0.1 + darkness(n.style.fill) * 0.7;
        const w = num(ctx, 'weight');
        const tone = (p: Pt) => toneAt(base, p, s.box, num(ctx, 'light'), num(ctx, 'shading'));
        let lines = '';
        for (const run of hatchInside(s, num(ctx, 'spacing'), num(ctx, 'angle'), 2)) {
          lines += ribbon(run, (t) => Math.max(0.15, w * tone(run[Math.round(t * (run.length - 1))])), false);
        }
        let cross = '';
        if (bool(ctx, 'cross'))
          for (const run of hatchInside(s, num(ctx, 'spacing') * 1.3, num(ctx, 'angle') + 70, 2)) {
            const dark = run.filter((p) => tone(p) > 0.62);
            if (dark.length > 1) cross += polyline([dark[0], dark[dark.length - 1]], false);
          }
        return { lines, cross };
      },
      { lines: '', cross: '' },
      2,
    );
    const out: SceneNode[] = [];
    if (res.lines) out.push(pathNode(ctx, `${n.name} · líneas`, res.lines, fillStyle(ink), 'hatch'));
    if (res.cross) out.push(pathNode(ctx, `${n.name} · contrahachurado`, res.cross, lineStyle(ink, num(ctx, 'weight') * 0.35), 'hatch'));
    const cw = isLine(n) ? Math.max(0.8, n.style.strokeWidth) : num(ctx, 'contourW');
    if (cw > 0) out.push(pathNode(ctx, `${n.name} · contorno`, n.d, lineStyle(ink, cw), n.role));
    return withPaper(n, ctx, out);
  },
};

const sketch: StyleDef = {
  id: 'sketch',
  name: 'Sketch',
  description: 'Boceto a lápiz: varias pasadas de trazo temblado sobre el contorno y rayado suelto en las sombras.',
  keywords: ['sketch', 'boceto', 'lápiz', 'lapiz', 'dibujo', 'bosquejo', 'esbozo'],
  params: [
    { key: 'passes', label: 'Pasadas', type: 'number', min: 1, max: 5, step: 1, default: 3 },
    { key: 'rough', label: 'Temblor', type: 'number', min: 0, max: 8, step: 0.1, default: 1.6, unit: 'px' },
    { key: 'hatch', label: 'Rayado en sombras', type: 'boolean', default: true },
    { key: 'width', label: 'Grosor', type: 'number', min: 0.2, max: 4, step: 0.1, default: 0.9, unit: 'px' },
    ...lightParams(-135, 1),
    { key: 'ink', label: 'Lápiz', type: 'color', default: '#3d3a36' },
    ...paperParams(true),
  ],
  path: (n, ctx) => {
    const noise = fbm1D(ctx.rng, 2);
    const res = shapeOr(
      n,
      (s) => {
        let lines = '';
        for (let pass = 0; pass < num(ctx, 'passes'); pass++) {
          const off: Pt = [ctx.rng.jitter(num(ctx, 'rough')), ctx.rng.jitter(num(ctx, 'rough'))];
          lines += contourPaths(s, (c) => {
            // Cada pasada arranca y termina un poco corrida, como un trazo a mano.
            const start = Math.floor(ctx.rng.next() * c.length * 0.1);
            const end = c.length - Math.floor(ctx.rng.next() * c.length * 0.08);
            const seg = simplify(c.slice(start, Math.max(start + 2, end)), 0.5).map((p) => [p[0] + off[0], p[1] + off[1]] as Pt);
            return smoothPath(wobble(seg, num(ctx, 'rough'), noise, ctx.rng.range(0, 100), 0.15), false, 1);
          });
        }
        let hatch = '';
        if (bool(ctx, 'hatch') && !isLine(n)) {
          const base = 0.1 + darkness(n.style.fill) * 0.6;
          for (const run of hatchInside(s, 5, num(ctx, 'light') + 135, 3)) {
            const dark = run.filter((p) => toneAt(base, p, s.box, num(ctx, 'light'), num(ctx, 'shading')) > 0.55);
            if (dark.length > 1) hatch += polyline([[dark[0][0] + ctx.rng.jitter(2), dark[0][1] + ctx.rng.jitter(2)], [dark[dark.length - 1][0] + ctx.rng.jitter(2), dark[dark.length - 1][1] + ctx.rng.jitter(2)]], false);
          }
        }
        return { lines, hatch };
      },
      { lines: n.d, hatch: '' },
      3,
    );
    return withPaper(n, ctx, [
      pathNode(ctx, n.name, res.lines, lineStyle(str(ctx, 'ink'), num(ctx, 'width')), n.role),
      ...(res.hatch ? [pathNode(ctx, `${n.name} · rayado`, res.hatch, lineStyle(str(ctx, 'ink'), num(ctx, 'width') * 0.6), 'hatch')] : []),
    ]);
  },
};

const handDrawn: StyleDef = {
  id: 'handdrawn',
  name: 'Hand Drawn',
  description: 'Dibujado a mano: contorno irregular y el color corrido un poco, como pintado fuera de la línea.',
  keywords: ['a mano', 'hecho a mano', 'hand drawn', 'handdrawn', 'dibujado', 'artesanal', 'infantil'],
  params: [
    { key: 'rough', label: 'Irregularidad', type: 'number', min: 0, max: 10, step: 0.1, default: 2.2, unit: 'px' },
    { key: 'offset', label: 'Corrimiento del color', type: 'number', min: 0, max: 20, step: 0.5, default: 4, unit: 'px' },
    { key: 'width', label: 'Grosor de línea', type: 'number', min: 0.3, max: 8, step: 0.1, default: 2, unit: 'px' },
    { key: 'ink', label: 'Línea', type: 'color', default: '#2b2620' },
  ],
  path: (n, ctx) => {
    const noise = fbm1D(ctx.rng, 2);
    const off = num(ctx, 'offset');
    const res = shapeOr(
      n,
      (s) => ({
        fill: contourPaths(s, (c, closed) => smoothPath(wobble(simplify(c, 1).map((p) => [p[0] + off, p[1] + off * 0.6] as Pt), num(ctx, 'rough') * 1.5, noise, 30, 0.1), closed, 1)),
        line: contourPaths(s, (c, closed) => smoothPath(wobble(simplify(c, 0.6), num(ctx, 'rough'), noise, 70, 0.12), closed, 1)),
      }),
      { fill: n.d, line: n.d },
      3,
    );
    return [
      ...(isLine(n) ? [] : [pathNode(ctx, `${n.name} · color`, res.fill, fillStyle(baseColor(n)), n.role)]),
      pathNode(ctx, n.name, res.line, lineStyle(str(ctx, 'ink'), isLine(n) ? Math.max(n.style.strokeWidth, num(ctx, 'width')) : num(ctx, 'width')), n.role),
    ];
  },
};

const vintage: StyleDef = {
  id: 'vintage',
  name: 'Vintage',
  description: 'Impresión vieja: colores apagados hacia sepia, registro corrido entre color y línea, y grano de puntitos.',
  keywords: ['vintage', 'retro', 'antiguo', 'viejo', 'sepia', 'gastado', 'clásico'],
  params: [
    { key: 'sepia', label: 'Sepia', type: 'number', min: 0, max: 1, step: 0.01, default: 0.45 },
    { key: 'shift', label: 'Registro corrido', type: 'number', min: 0, max: 12, step: 0.5, default: 2.5, unit: 'px' },
    { key: 'grain', label: 'Grano', type: 'number', min: 0, max: 1, step: 0.01, default: 0.35 },
    { key: 'ink', label: 'Línea', type: 'color', default: '#4a3426' },
  ],
  path: (n, ctx) => {
    const base = baseColor(n);
    const sep = mix(mix(base, '#9b8467', 0.35 * num(ctx, 'sepia') + 0.1), '#f1e3c6', 0.25 * num(ctx, 'sepia'));
    const grain = isLine(n)
      ? ''
      : shapeOr(
          n,
          (s) => {
            const pts: Pt[] = [];
            const tries = Math.min(3000, Math.round(s.box.width * s.box.height * 0.004 * num(ctx, 'grain')));
            for (let i = 0; i < tries; i++) {
              const p: Pt = [s.box.x + ctx.rng.next() * s.box.width, s.box.y + ctx.rng.next() * s.box.height];
              if (s.inside(p[0], p[1])) pts.push(p);
            }
            return dotsPath(pts, () => 0.5 + ctx.rng.next() * 0.6);
          },
          '',
        );
    const sh = num(ctx, 'shift');
    const fillNode = pathNode(ctx, `${n.name} · color`, n.d, fillStyle(sep), n.role);
    fillNode.transform = { x: sh, y: sh * 0.5, rotation: 0, scale: 1 };
    return [
      ...(isLine(n) ? [] : [fillNode]),
      ...(grain ? [pathNode(ctx, `${n.name} · grano`, grain, fillStyle(shade(sep, -0.3)), 'grain')] : []),
      pathNode(ctx, n.name, n.d, lineStyle(str(ctx, 'ink'), Math.max(1, n.style.strokeWidth || 1.2)), n.role),
    ];
  },
};

const technical: StyleDef = {
  id: 'technical',
  name: 'Technical Illustration',
  description: 'Dibujo técnico: líneas finas y parejas, sin relleno, con cotas de ancho y alto de la figura.',
  keywords: ['técnico', 'tecnico', 'technical', 'plano', 'blueprint', 'cotas', 'dibujo técnico'],
  params: [
    { key: 'width', label: 'Grosor de línea', type: 'number', min: 0.2, max: 4, step: 0.1, default: 1, unit: 'px' },
    { key: 'dims', label: 'Cotas', type: 'boolean', default: true },
    { key: 'ink', label: 'Línea', type: 'color', default: '#1f3a5f' },
  ],
  path: (n, ctx) => [pathNode(ctx, n.name, n.d, lineStyle(str(ctx, 'ink'), num(ctx, 'width')), n.role)],
  decorate: (box, ctx) => {
    if (!bool(ctx, 'dims')) return [];
    const g = Math.max(10, Math.max(box.width, box.height) * 0.06);
    const a = Math.max(3, g * 0.35);
    const y = box.y + box.height + g;
    const x = box.x + box.width + g;
    const arrowH = (px: number, py: number, dir: number) => polyline([[px + dir * a, py - a * 0.5], [px, py], [px + dir * a, py + a * 0.5]], false);
    const arrowV = (px: number, py: number, dir: number) => polyline([[px - a * 0.5, py + dir * a], [px, py], [px + a * 0.5, py + dir * a]], false);
    let d = polyline([[box.x, y], [box.x + box.width, y]], false) + arrowH(box.x, y, 1) + arrowH(box.x + box.width, y, -1);
    d += polyline([[box.x, box.y + box.height + 2], [box.x, y + a]], false) + polyline([[box.x + box.width, box.y + box.height + 2], [box.x + box.width, y + a]], false);
    d += polyline([[x, box.y], [x, box.y + box.height]], false) + arrowV(x, box.y, 1) + arrowV(x, box.y + box.height, -1);
    d += polyline([[box.x + box.width + 2, box.y], [x + a, box.y]], false) + polyline([[box.x + box.width + 2, box.y + box.height], [x + a, box.y + box.height]], false);
    // Líneas de centro.
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    let center = '';
    for (let t = box.y - g * 0.5; t < box.y + box.height + g * 0.5; t += 12) center += polyline([[cx, t], [cx, Math.min(t + 6, box.y + box.height + g * 0.5)]], false);
    for (let t = box.x - g * 0.5; t < box.x + box.width + g * 0.5; t += 12) center += polyline([[t, cy], [Math.min(t + 6, box.x + box.width + g * 0.5), cy]], false);
    return [pathNode(ctx, 'Cotas', d, lineStyle(str(ctx, 'ink'), num(ctx, 'width') * 0.7), 'dims'), pathNode(ctx, 'Ejes', center, lineStyle(str(ctx, 'ink'), num(ctx, 'width') * 0.5), 'axes')];
  },
};

const monochrome: StyleDef = {
  id: 'monochrome',
  name: 'Monochrome',
  description: 'Un solo color en varios tonos: cada parte toma un tono según qué tan oscura era, con contorno del tono más oscuro.',
  keywords: ['monocromo', 'monocromático', 'monocromatico', 'monochrome', 'un color', 'blanco y negro', 'escala de grises'],
  params: [
    { key: 'color', label: 'Color', type: 'color', default: '#2f5d50' },
    { key: 'levels', label: 'Cantidad de tonos', type: 'number', min: 2, max: 8, step: 1, default: 4 },
    { key: 'width', label: 'Contorno', type: 'number', min: 0, max: 6, step: 0.1, default: 1, unit: 'px' },
  ],
  path: (n, ctx) => {
    const lv = Math.round(num(ctx, 'levels'));
    const t = Math.round(darkness(baseColor(n)) * (lv - 1)) / (lv - 1);
    const c = mix('#f4f1ea', str(ctx, 'color'), 0.15 + t * 0.85);
    const dark = shade(str(ctx, 'color'), -0.45);
    return [pathNode(ctx, n.name, n.d, isLine(n) ? lineStyle(dark, Math.max(1, n.style.strokeWidth)) : fillStyle(c, dark, num(ctx, 'width')), n.role)];
  },
};

const flat: StyleDef = {
  id: 'flat',
  name: 'Flat Illustration',
  description: 'Ilustración plana: sin contornos, colores enteros y una sombra proyectada simple.',
  keywords: ['flat', 'plano', 'ilustración plana', 'ilustracion plana', 'vectorial plano', 'moderno'],
  params: [
    { key: 'shadow', label: 'Sombra proyectada', type: 'boolean', default: true },
    { key: 'distance', label: 'Distancia de sombra', type: 'number', min: 0, max: 40, step: 0.5, default: 6, unit: 'px' },
    { key: 'angle', label: 'Dirección de sombra', type: 'number', min: -180, max: 180, step: 1, default: 45, unit: '°' },
    { key: 'saturate', label: 'Intensidad de color', type: 'number', min: -0.5, max: 0.5, step: 0.01, default: 0.1 },
  ],
  path: (n, ctx) => {
    const base = baseColor(n);
    const c = num(ctx, 'saturate') >= 0 ? shade(base, -num(ctx, 'saturate') * 0.4) : shade(base, -num(ctx, 'saturate'));
    const main = pathNode(ctx, n.name, n.d, isLine(n) ? lineStyle(c, Math.max(1, n.style.strokeWidth)) : fillStyle(c), n.role);
    if (!bool(ctx, 'shadow') || isLine(n)) return [main];
    const a = (num(ctx, 'angle') * Math.PI) / 180;
    const sh = pathNode(ctx, `${n.name} · sombra`, n.d, fillStyle(shade(base, -0.35)), 'shadow');
    sh.transform = { x: Math.cos(a) * num(ctx, 'distance'), y: Math.sin(a) * num(ctx, 'distance'), rotation: 0, scale: 1 };
    sh.opacity = 0.55;
    return [sh, main];
  },
};

const duotone: StyleDef = {
  id: 'duotone',
  name: 'Duotone',
  description: 'Dos colores: cada parte va al color oscuro o al claro según su tono, con trama de puntos en los medios tonos.',
  keywords: ['duotono', 'duotone', 'dos colores', 'bicolor', 'dos tintas'],
  params: [
    { key: 'dark', label: 'Color oscuro', type: 'color', default: '#2a2f5a' },
    { key: 'light', label: 'Color claro', type: 'color', default: '#f2a65a' },
    { key: 'threshold', label: 'Umbral', type: 'number', min: 0.1, max: 0.9, step: 0.01, default: 0.45 },
    { key: 'midDots', label: 'Puntos en medios tonos', type: 'boolean', default: true },
  ],
  path: (n, ctx) => {
    const dk = darkness(baseColor(n));
    const isDark = dk > num(ctx, 'threshold');
    const color = isDark ? str(ctx, 'dark') : str(ctx, 'light');
    // Las líneas de detalle suelen ser más oscuras que su relleno: se invierten para que se vean sobre el color oscuro.
    if (isLine(n)) return [pathNode(ctx, n.name, n.d, lineStyle(isDark ? str(ctx, 'light') : str(ctx, 'dark'), Math.max(1, n.style.strokeWidth)), n.role)];
    const out: SceneNode[] = [pathNode(ctx, n.name, n.d, fillStyle(color), n.role)];
    // Medios tonos: parte clara pero no tanto → puntitos del color oscuro encima.
    if (bool(ctx, 'midDots') && !isDark && dk > num(ctx, 'threshold') - 0.25) {
      const dots = shapeOr(n, (s) => dotsPath(gridInside(s, 6, 45), () => 1.3), '');
      if (dots) out.push(pathNode(ctx, `${n.name} · trama`, dots, fillStyle(str(ctx, 'dark')), 'dots'));
    }
    return out;
  },
};

const isometric: StyleDef = {
  id: 'isometric',
  name: 'Isometric',
  description: 'Lleva la figura a un plano isométrico (30°) y le da espesor, como una pieza recortada en 3D.',
  keywords: ['isométrico', 'isometrico', 'isometric', '3d', 'volumen', 'extruido', 'relieve'],
  params: [
    { key: 'depth', label: 'Espesor', type: 'number', min: 0, max: 60, step: 0.5, default: 12, unit: 'px' },
    { key: 'side', label: 'Plano', type: 'select', options: [{ value: 'left', label: 'Pared izquierda' }, { value: 'right', label: 'Pared derecha' }, { value: 'floor', label: 'Piso' }], default: 'left' },
  ],
  path: (n, ctx) => {
    const side = str(ctx, 'side');
    const c30 = Math.cos(Math.PI / 6);
    const iso = ([x, y]: Pt): Pt => (side === 'floor' ? [(x - y) * c30, (x + y) * 0.5] : side === 'right' ? [x * c30, y - x * 0.5] : [x * c30, y + x * 0.5]);
    const contours = shapeOr(n, (s) => s.contours.map((c) => ({ pts: simplify(c, 0.5).map(iso), closed: isClosed(c) })), [] as { pts: Pt[]; closed: boolean }[], 3);
    if (!contours.length) return [];
    const draw = (dx: number, dy: number) => contours.map((c) => smoothPath(c.pts.map(([x, y]) => [x + dx, y + dy] as Pt), c.closed, 0.9)).join('');
    const base = baseColor(n);
    const depth = num(ctx, 'depth');
    // Dirección del espesor: hacia atrás del plano elegido.
    const ex: Pt = side === 'floor' ? [0, 1] : side === 'right' ? [c30, 0.5] : [-c30, 0.5];
    const out: SceneNode[] = [];
    const steps = Math.max(1, Math.round(depth / 2));
    if (depth > 0 && !isLine(n)) {
      let back = '';
      for (let i = steps; i >= 1; i--) back += draw(ex[0] * (depth * i) / steps, ex[1] * (depth * i) / steps);
      out.push(pathNode(ctx, `${n.name} · espesor`, back, isLine(n) ? lineStyle(shade(base, -0.4), Math.max(1, n.style.strokeWidth)) : fillStyle(shade(base, -0.35)), 'extrusion'));
    }
    out.push(pathNode(ctx, n.name, draw(0, 0), isLine(n) ? lineStyle(base, Math.max(1, n.style.strokeWidth)) : { ...n.style, fill: base }, n.role));
    return out;
  },
};

const abstract: StyleDef = {
  id: 'abstract',
  name: 'Abstract',
  description: 'Reinterpreta cada parte como una forma geométrica básica (círculo, cápsula, triángulo) del mismo color y lugar.',
  keywords: ['abstracto', 'abstracta', 'abstract', 'reinterpretado', 'formas básicas', 'bauhaus'],
  params: [
    { key: 'jitter', label: 'Desorden', type: 'number', min: 0, max: 1, step: 0.01, default: 0.25 },
    { key: 'scale', label: 'Escala de las formas', type: 'number', min: 0.3, max: 1.5, step: 0.01, default: 0.9 },
  ],
  path: (n, ctx) => {
    if (isLine(n)) return []; // las líneas sueltas (nervaduras, rayitas) no tienen una forma que reinterpretar
    const box = shapeOr(n, (s) => s.box, null as Box | null);
    if (!box || box.width < 0.5 || box.height < 0.5) return [];
    const k = num(ctx, 'scale');
    // La forma se dibuja centrada en (0, 0) y se ubica con transform, así puede rotar sobre su centro.
    const px = box.x + box.width / 2 + ctx.rng.jitter(box.width * 0.15 * num(ctx, 'jitter'));
    const py = box.y + box.height / 2 + ctx.rng.jitter(box.height * 0.15 * num(ctx, 'jitter'));
    const w = (box.width / 2) * k;
    const h = (box.height / 2) * k;
    const aspect = w / h;
    let d: string;
    if (aspect > 0.75 && aspect < 1.33) {
      const r = (w + h) / 2;
      d = ctx.rng.next() < 0.7 ? `M${-r} 0a${r} ${r} 0 1 1 ${r * 2} 0a${r} ${r} 0 1 1 ${-r * 2} 0Z` : polyline([[0, -r], [r, r * 0.8], [-r, r * 0.8]], true);
    } else {
      // Cápsula a lo largo del lado largo.
      const r = Math.min(w, h);
      d = aspect >= 1 ? `M${-w + r} ${-r}H${w - r}A${r} ${r} 0 0 1 ${w - r} ${r}H${-w + r}A${r} ${r} 0 0 1 ${-w + r} ${-r}Z` : `M${-r} ${-h + r}A${r} ${r} 0 0 1 ${r} ${-h + r}V${h - r}A${r} ${r} 0 0 1 ${-r} ${h - r}Z`;
    }
    const node = pathNode(ctx, n.name, d, fillStyle(baseColor(n)), n.role);
    node.transform = { x: px, y: py, rotation: ctx.rng.jitter(25 * num(ctx, 'jitter')), scale: 1 };
    return [node];
  },
};

export const STYLES: StyleDef[] = [lineArt, outline, solid, minimalist, botanicalStyle, geometric, organic, dotwork, stippling, halftone, engraving, sketch, handDrawn, vintage, technical, monochrome, flat, duotone, isometric, abstract];

export const getStyle = (id: string) => STYLES.find((s) => s.id === id) ?? null;

export function styleDefaults(s: StyleDef) {
  return Object.fromEntries(s.params.map((p) => [p.key, p.default]));
}

