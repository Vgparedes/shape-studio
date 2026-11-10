// Paisaje y elementos naturales (Etapa 5).
import type { Generator } from './types';
import type { SceneNode } from '../../core/types';
import type { Pt } from '../geometry/path';
import { polyline, smoothPath, starPoints, roundedPolygon } from '../geometry/path';
import { fbm1D } from '../geometry/noise';
import { ribbon } from '../geometry/ribbon';
import { add, dir, mul, place } from '../geometry/vec';
import { hexToRgb, rgbToHex, shade } from '../../core/color';
import { blobPath } from '../organic/shapes';
import { circle, clean, colors, kit, outlineParams, profileShape, rect } from './kit';

/** Mezcla dos colores HEX (t = 0 → a, t = 1 → b). Sirve para la perspectiva atmosférica. */
function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

export const mountains: Generator = {
  id: 'land.mountains',
  name: 'Montañas',
  category: 'paisaje',
  description: 'Cordones de montañas en capas, con picos quebrados, nieve en las cumbres y perspectiva por color.',
  keywords: ['montaña', 'montañas', 'montana', 'cordillera', 'sierra', 'cerro', 'cerros', 'mountain', 'mountains', 'picos'],
  params: [
    { key: 'layers', label: 'Capas', group: 'Montañas', type: 'number', min: 1, max: 7, step: 1, default: 3 },
    { key: 'width', label: 'Ancho', group: 'Montañas', type: 'number', min: 100, max: 2400, step: 1, default: 900, unit: 'px' },
    { key: 'height', label: 'Alto', group: 'Montañas', type: 'number', min: 30, max: 1000, step: 1, default: 420, unit: 'px' },
    { key: 'peaks', label: 'Picos', group: 'Montañas', type: 'number', min: 1, max: 14, step: 1, default: 3 },
    { key: 'jagged', label: 'Quebrado', group: 'Montañas', type: 'number', min: 0, max: 1, step: 0.01, default: 0.45 },
    { key: 'snow', label: 'Nieve', group: 'Montañas', type: 'number', min: 0, max: 0.6, step: 0.01, default: 0.2 },
    ...colors({ nearColor: ['Capa de adelante', '#3d5a4c'], farColor: ['Capa del fondo', '#a9bfc4'], snowColor: ['Nieve', '#f4f6f6'] }),
    ...outlineParams(0),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const W = k.n('width');
    const H = k.n('height');
    const L = k.i('layers');
    const out: SceneNode[] = [];
    for (let l = 0; l < L; l++) {
      const rel = L === 1 ? 1 : l / (L - 1); // 0 = fondo, 1 = adelante
      const color = mix(k.s('farColor'), k.s('nearColor'), rel);
      const peaks = Math.max(1, Math.round(k.n('peaks') * (1 + (1 - rel) * 0.5)));
      const noise = fbm1D(k.rng, 4);
      const off = k.rng.range(0, 100);
      const top = H * (0.55 + 0.45 * (1 - rel * 0.35));
      const N = 140;
      const ridge: Pt[] = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const tri = 1 - Math.abs(((t * peaks + off * 0.13) % 1) * 2 - 1); // dientes triangulares
        const hh = top * (0.35 + 0.65 * tri ** 1.3) * (0.75 + 0.25 * noise(off + t * 3)) + noise(off * 2 + t * 40) * top * 0.12 * k.n('jagged');
        ridge.push([-W / 2 + W * t, -Math.max(top * 0.08, hh) * (1 - Math.abs(2 * t - 1) ** 6 * 0.3)]);
      }
      out.push(k.fill(`Capa ${l + 1}`, polyline([...ridge, [W / 2, 0], [-W / 2, 0]], true), color, 'mountain'));
      // Nieve: en cada pico local, lo que quede por encima de cierta altura, con borde dentado.
      if (k.n('snow') > 0 && rel > 0.3) {
        let snow = '';
        const maxH = Math.max(...ridge.map((q) => -q[1]));
        const limit = maxH * (1 - k.n('snow') * 1.4);
        let i = 0;
        while (i <= N) {
          if (-ridge[i][1] > limit) {
            const start = i;
            while (i <= N && -ridge[i][1] > limit) i++;
            const seg = ridge.slice(start, i);
            if (seg.length > 2) {
              const a = seg[0];
              const b = seg[seg.length - 1];
              const teeth: Pt[] = [];
              const n = 5;
              for (let j = n; j >= 0; j--) teeth.push([b[0] + ((a[0] - b[0]) * j) / n, -limit + (j % 2 ? top * 0.06 : 0)]);
              snow += polyline([...seg, ...teeth.reverse().reverse()], true);
            }
          }
          i++;
        }
        if (snow) out.push(k.fill(`Nieve ${l + 1}`, snow, k.s('snowColor'), 'snow'));
      }
    }
    return { kind: 'group', children: out };
  },
};

export const hills: Generator = {
  id: 'land.hills',
  name: 'Colinas y campos',
  category: 'paisaje',
  also: ['agro'],
  description: 'Lomas suaves en capas. Con surcos, la de adelante se vuelve un campo sembrado.',
  keywords: ['colina', 'colinas', 'loma', 'lomas', 'campo', 'campos', 'surcos', 'pradera', 'hills', 'field', 'siembra', 'cultivo', 'cultivos'],
  params: [
    { key: 'layers', label: 'Capas', group: 'Colinas', type: 'number', min: 1, max: 7, step: 1, default: 3 },
    { key: 'width', label: 'Ancho', group: 'Colinas', type: 'number', min: 100, max: 2400, step: 1, default: 900, unit: 'px' },
    { key: 'height', label: 'Alto', group: 'Colinas', type: 'number', min: 20, max: 800, step: 1, default: 220, unit: 'px' },
    { key: 'waves', label: 'Ondulación', group: 'Colinas', type: 'number', min: 0.3, max: 6, step: 0.1, default: 1.4 },
    { key: 'furrows', label: 'Surcos en la de adelante', group: 'Campo', type: 'number', min: 0, max: 40, step: 1, default: 12 },
    { key: 'furrowWidth', label: 'Grosor de surcos', group: 'Campo', type: 'number', min: 0.5, max: 12, step: 0.5, default: 3.5, unit: 'px' },
    ...colors({ nearColor: ['Capa de adelante', '#8aa24c'], farColor: ['Capa del fondo', '#cfd9a6'], furrowColor: ['Surcos', '#55682a'] }),
    ...outlineParams(0),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const W = k.n('width');
    const H = k.n('height');
    const L = k.i('layers');
    const out: SceneNode[] = [];
    let frontRidge: Pt[] = [];
    for (let l = 0; l < L; l++) {
      const rel = L === 1 ? 1 : l / (L - 1);
      const noise = fbm1D(k.rng, 2);
      const off = k.rng.range(0, 100);
      const base = H * (1 - rel * 0.55);
      const ridge: Pt[] = [];
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const y = base * (0.55 + 0.3 * Math.sin(t * Math.PI * k.n('waves') + off) + 0.25 * noise(off + t * 2));
        ridge.push([-W / 2 + W * t, -Math.max(4, y)]);
      }
      if (l === L - 1) frontRidge = ridge;
      out.push(k.fill(`Colina ${l + 1}`, smoothPath([...ridge, [W / 2, 0], [-W / 2, 0]], true, 0.8), mix(k.s('farColor'), k.s('nearColor'), rel), 'hill'));
    }
    const nf = k.i('furrows');
    if (nf > 0 && frontRidge.length) {
      // Surcos: líneas que siguen la loma y se juntan hacia un punto de fuga (sensación de campo arado).
      let d = '';
      const vanish: Pt = [W * 0.15, -H * 1.4];
      for (let f = 1; f <= nf; f++) {
        const t = f / (nf + 1);
        const bottom: Pt = [-W / 2 + W * t * 1.2 - W * 0.1, 0];
        const pts: Pt[] = [];
        for (let s = 0; s <= 20; s++) {
          const u = s / 20;
          const p: Pt = [bottom[0] + (vanish[0] - bottom[0]) * u * 0.6, bottom[1] + (vanish[1] - bottom[1]) * u * 0.6];
          const idx = Math.max(0, Math.min(60, Math.round(((p[0] + W / 2) / W) * 60)));
          if (p[1] < frontRidge[idx][1] + 3) break;
          pts.push(p);
        }
        if (pts.length > 1) d += smoothPath(pts, false);
      }
      if (d) out.push(k.stroke('Surcos', d, k.s('furrowColor'), k.n('furrowWidth'), 'furrows'));
    }
    return { kind: 'group', children: out };
  },
};

export const clouds: Generator = {
  id: 'land.clouds',
  name: 'Nubes',
  category: 'paisaje',
  description: 'Nubes esponjosas con base plana o redondeada. Una o varias, de distintos tamaños.',
  keywords: ['nube', 'nubes', 'cloud', 'clouds', 'cielo', 'nublado'],
  params: [
    { key: 'count', label: 'Cantidad', group: 'Nubes', type: 'number', min: 1, max: 12, step: 1, default: 1 },
    { key: 'size', label: 'Tamaño', group: 'Nubes', type: 'number', min: 20, max: 700, step: 1, default: 260, unit: 'px' },
    { key: 'puffs', label: 'Bultos', group: 'Nubes', type: 'number', min: 2, max: 12, step: 1, default: 5 },
    { key: 'flat', label: 'Base plana', group: 'Nubes', type: 'boolean', default: true },
    { key: 'spread', label: 'Separación entre nubes', group: 'Nubes', type: 'number', min: 0, max: 2, step: 0.01, default: 1 },
    ...colors({ cloudColor: ['Nube', '#ffffff'] }),
    ...outlineParams(1.6, '#4b5866'),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const n = k.i('count');
    const out: SceneNode[] = [];
    for (let c = 0; c < n; c++) {
      const S = k.n('size') * (n === 1 ? 1 : 0.55 + k.rng.next() * 0.55);
      const p = k.i('puffs');
      let d = '';
      for (let i = 0; i < p; i++) {
        const t = p === 1 ? 0.5 : i / (p - 1);
        const r = S * (0.16 + 0.16 * Math.sin(Math.PI * t) ** 1.5) * (0.85 + k.rng.next() * 0.3);
        const x = -S / 2 + S * (0.12 + 0.76 * t);
        const y = -r * 0.55 - Math.sin(Math.PI * t) * S * 0.08;
        d += circle(x, y, r);
      }
      if (k.b('flat')) d += rect(-S * 0.42, -S * 0.12, S * 0.84, S * 0.12, S * 0.06);
      const node = k.styled('Nube', d, { fill: k.s('cloudColor'), stroke: k.outlineWidth() > 0 ? k.outlineColor() : null, strokeWidth: k.outlineWidth() * 2, paintOrder: 'stroke', lineJoin: 'round' }, 'cloud');
      const x = n === 1 ? 0 : (c - (n - 1) / 2) * k.n('size') * 0.7 * k.n('spread') + k.rng.jitter(30);
      const y = n === 1 ? 0 : k.rng.jitter(k.n('size') * 0.3 * k.n('spread'));
      out.push(k.at(node, x, y));
    }
    return { kind: 'group', children: out };
  },
};

export const sun: Generator = {
  id: 'land.sun',
  name: 'Sol',
  category: 'paisaje',
  also: ['simbolos'],
  description: 'Sol con rayos rectos, en punta, ondulados o sin rayos.',
  keywords: ['sol', 'soles', 'sun', 'solcito', 'amanecer', 'atardecer'],
  params: [
    { key: 'radius', label: 'Radio', group: 'Sol', type: 'number', min: 10, max: 500, step: 1, default: 90, unit: 'px' },
    { key: 'rays', label: 'Rayos', group: 'Sol', type: 'number', min: 0, max: 48, step: 1, default: 12 },
    { key: 'rayStyle', label: 'Tipo de rayo', group: 'Sol', type: 'select', options: [{ value: 'line', label: 'Líneas' }, { value: 'spike', label: 'En punta' }, { value: 'wave', label: 'Ondulados' }, { value: 'alt', label: 'Largos y cortos' }], default: 'spike' },
    { key: 'rayLength', label: 'Largo de rayos', group: 'Sol', type: 'number', min: 0, max: 2, step: 0.01, default: 0.55 },
    { key: 'gap', label: 'Separación del círculo', group: 'Sol', type: 'number', min: 0, max: 1, step: 0.01, default: 0.15 },
    ...colors({ sunColor: ['Sol', '#f2b92c'], rayColor: ['Rayos', '#f08c24'] }),
    ...outlineParams(0),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const R = k.n('radius');
    const n = k.i('rays');
    const r0 = R * (1 + k.n('gap'));
    const len = R * k.n('rayLength');
    const style = k.s('rayStyle');
    let rays = '';
    for (let i = 0; i < n; i++) {
      const a = (360 / n) * i - 90;
      const L = style === 'alt' && i % 2 ? len * 0.55 : len;
      if (style === 'spike') {
        const half = 180 / n * 0.55;
        rays += polyline([add([0, 0], mul(dir(a - half), r0)), mul(dir(a), r0 + L), mul(dir(a + half), r0)], true);
      } else if (style === 'wave') {
        const pts: Pt[] = [];
        for (let s = 0; s <= 12; s++) pts.push(add(mul(dir(a), r0 + (L * s) / 12), mul(dir(a + 90), Math.sin((s / 12) * Math.PI * 2) * R * 0.05)));
        rays += smoothPath(pts, false);
      } else rays += polyline([mul(dir(a), r0), mul(dir(a), r0 + L)], false);
    }
    const stroked = style !== 'spike';
    return {
      kind: 'group',
      children: clean([
        rays && (stroked ? k.stroke('Rayos', rays, k.s('rayColor'), Math.max(2, R * 0.07), 'rays') : k.fill('Rayos', rays, k.s('rayColor'), 'rays')),
        k.fill('Disco', circle(0, 0, R), k.s('sunColor'), 'disk'),
      ]),
    };
  },
};

export const moon: Generator = {
  id: 'land.moon',
  name: 'Luna',
  category: 'paisaje',
  also: ['simbolos'],
  description: 'Luna en cualquier fase (de medialuna fina a llena), con cráteres y estrellitas opcionales.',
  keywords: ['luna', 'lunas', 'moon', 'medialuna', 'creciente', 'menguante', 'noche'],
  params: [
    { key: 'radius', label: 'Radio', group: 'Luna', type: 'number', min: 10, max: 500, step: 1, default: 110, unit: 'px' },
    { key: 'phase', label: 'Fase (0 = fina, 1 = llena)', group: 'Luna', type: 'number', min: 0.05, max: 1, step: 0.01, default: 0.3 },
    { key: 'craters', label: 'Cráteres', group: 'Luna', type: 'number', min: 0, max: 12, step: 1, default: 3 },
    { key: 'stars', label: 'Estrellitas', group: 'Luna', type: 'number', min: 0, max: 20, step: 1, default: 3 },
    ...colors({ moonColor: ['Luna', '#f1e3b0'], starColor: ['Estrellas', '#f1e3b0'] }),
    ...outlineParams(0),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const R = k.n('radius');
    const p = k.n('phase');
    // Lado derecho iluminado: borde exterior + línea del terminador (media elipse).
    const kx = R * Math.abs(1 - 2 * p);
    const d = p >= 0.995 ? circle(0, 0, R) : `M0 ${-R}A${R} ${R} 0 0 1 0 ${R}A${kx} ${R} 0 0 ${p < 0.5 ? 0 : 1} 0 ${-R}Z`;
    let craters = '';
    // Cráteres solo en la parte iluminada: se prueban puntos al azar hasta caer adentro.
    const lit = (x: number, y: number) => {
      const term = kx * Math.sqrt(Math.max(0, 1 - (y / R) ** 2));
      return Math.hypot(x, y) < R * 0.82 && x > (p < 0.5 ? term : -term) + R * 0.08;
    };
    for (let c = 0; c < k.i('craters'); c++) {
      for (let tries = 0; tries < 30; tries++) {
        const cx = k.rng.range(-R, R);
        const cy = k.rng.range(-R, R);
        const cr = R * k.rng.range(0.05, 0.11);
        if (lit(cx - cr, cy) && lit(cx + cr, cy)) {
          craters += circle(cx, cy, cr);
          break;
        }
      }
    }
    let stars = '';
    for (let s = 0; s < k.i('stars'); s++) {
      const pos = mul(dir(k.rng.range(-170, -10) + (s % 2 ? 180 : 0)), R * k.rng.range(1.25, 1.9));
      stars += roundedPolygon(starPoints(4, R * 0.1, R * 0.03).map((q) => add(q, [pos[0] - R * 0.4, pos[1]])), 0.2);
    }
    return {
      kind: 'group',
      children: clean([
        k.fill('Luna', d, k.s('moonColor'), 'moon'),
        craters && k.flat('Cráteres', craters, shade(k.s('moonColor'), -0.12), 'craters'),
        stars && k.fill('Estrellas', stars, k.s('starColor'), 'stars'),
      ]),
    };
  },
};

export const water: Generator = {
  id: 'land.water',
  name: 'Río, lago o gota',
  category: 'paisaje',
  description: 'Río que serpentea y se ensancha, lago con ondas o gota de agua.',
  keywords: ['río', 'rio', 'ríos', 'lago', 'lagos', 'laguna', 'agua', 'gota', 'arroyo', 'river', 'lake', 'water'],
  params: [
    { key: 'type', label: 'Tipo', group: 'Agua', type: 'select', options: [{ value: 'river', label: 'Río' }, { value: 'lake', label: 'Lago' }, { value: 'drop', label: 'Gota' }], default: 'river' },
    { key: 'size', label: 'Tamaño', group: 'Agua', type: 'number', min: 20, max: 1600, step: 1, default: 520, unit: 'px' },
    { key: 'curves', label: 'Curvas del río', group: 'Agua', type: 'number', min: 0, max: 6, step: 0.1, default: 2 },
    { key: 'width', label: 'Ancho del río', group: 'Agua', type: 'number', min: 2, max: 300, step: 1, default: 70, unit: 'px' },
    { key: 'ripples', label: 'Ondas / reflejos', group: 'Agua', type: 'number', min: 0, max: 20, step: 1, default: 5 },
    ...colors({ waterColor: ['Agua', '#5b93c7'], rippleColor: ['Reflejos', '#d8ecf7'] }),
    ...outlineParams(0),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const S = k.n('size');
    const type = k.s('type');
    const color = k.s('waterColor');
    let body = '';
    let ripples = '';
    if (type === 'drop') {
      body = profileShape(S, (t) => S * 0.72 * Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.08)) ** 0.5 * t ** 0.9);
      ripples = smoothPath([[-S * 0.18, S * 0.05], [-S * 0.22, S * 0.2], [-S * 0.1, S * 0.32]], false);
    } else if (type === 'lake') {
      body = blobPath({ radius: S / 2, vertices: 10, smoothness: 1, irregularity: 0.35, symmetry: 0, complexity: 3, stretch: 2.6 }, k.rng);
      for (let i = 0; i < k.i('ripples'); i++) {
        const x = k.rng.range(-S * 0.45, S * 0.45);
        const y = k.rng.range(-S * 0.1, S * 0.1);
        const w = S * k.rng.range(0.05, 0.12);
        ripples += polyline([[x - w, y], [x + w, y]], false);
      }
    } else {
      // Río en perspectiva: angosto arriba (lejos) y ancho abajo (cerca).
      const pts: Pt[] = [];
      const off = k.rng.range(0, 6);
      for (let i = 0; i <= 80; i++) {
        const t = i / 80;
        pts.push([Math.sin(t * Math.PI * k.n('curves') + off) * S * 0.25 * (0.3 + t), -S / 2 + S * t]);
      }
      body = ribbon(pts, (t) => k.n('width') * (0.15 + 0.85 * t ** 1.2));
      for (let i = 0; i < k.i('ripples'); i++) {
        const t = k.rng.range(0.3, 0.95);
        const c = pts[Math.round(t * 80)];
        const w = k.n('width') * t * 0.25;
        ripples += polyline([[c[0] - w, c[1]], [c[0] + w, c[1]]], false);
      }
    }
    return {
      kind: 'group',
      children: clean([k.fill('Agua', body, color, 'water'), ripples && k.stroke('Reflejos', ripples, k.s('rippleColor'), Math.max(1.5, S * 0.008), 'ripples')]),
    };
  },
};

export const dunes: Generator = {
  id: 'land.dunes',
  name: 'Dunas',
  category: 'paisaje',
  description: 'Dunas en capas con cresta marcada (lado de sombra) y ondulaciones de arena.',
  keywords: ['duna', 'dunas', 'desierto', 'arena', 'médano', 'medano', 'dunes', 'desert'],
  params: [
    { key: 'layers', label: 'Capas', group: 'Dunas', type: 'number', min: 1, max: 6, step: 1, default: 3 },
    { key: 'width', label: 'Ancho', group: 'Dunas', type: 'number', min: 100, max: 2400, step: 1, default: 900, unit: 'px' },
    { key: 'height', label: 'Alto', group: 'Dunas', type: 'number', min: 20, max: 800, step: 1, default: 240, unit: 'px' },
    { key: 'ripples', label: 'Ondulaciones de arena', group: 'Dunas', type: 'number', min: 0, max: 20, step: 1, default: 6 },
    ...colors({ sandColor: ['Arena', '#e3b778'], shadowColor: ['Sombra', '#b9824a'] }),
    ...outlineParams(0),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const W = k.n('width');
    const H = k.n('height');
    const L = k.i('layers');
    const out: SceneNode[] = [];
    for (let l = 0; l < L; l++) {
      const rel = L === 1 ? 1 : l / (L - 1);
      const crestX = k.rng.range(-W * 0.25, W * 0.25);
      const crestY = -H * (0.5 + 0.5 * (1 - rel * 0.5)) * (0.8 + k.rng.next() * 0.3);
      const left: Pt = [-W / 2, -H * 0.25 * (1 - rel) - k.rng.range(0, H * 0.15)];
      const right: Pt = [W / 2, -H * 0.2 * (1 - rel) - k.rng.range(0, H * 0.1)];
      const sand = mix(shade(k.s('sandColor'), 0.3), k.s('sandColor'), rel);
      // Lado al viento: curva suave; lado de sombra: más empinado.
      const windward = smoothPath([left, [(left[0] + crestX) / 2, (left[1] + crestY) / 2 - H * 0.08], [crestX, crestY], [crestX + W * 0.08, crestY + H * 0.22], right, [W / 2, 0], [-W / 2, 0]], true, 0.7);
      out.push(k.fill(`Duna ${l + 1}`, windward, sand, 'dune'));
      const shadow = smoothPath([[crestX, crestY], [crestX + W * 0.08, crestY + H * 0.22], right, [W / 2, 0], [crestX + W * 0.25, 0], [crestX + W * 0.04, crestY + H * 0.4]], true, 0.6);
      out.push(k.flat(`Sombra ${l + 1}`, shadow, mix(shade(k.s('shadowColor'), 0.3), k.s('shadowColor'), rel), 'shadow'));
      if (l === L - 1 && k.i('ripples') > 0) {
        let d = '';
        for (let r = 0; r < k.i('ripples'); r++) {
          const y = crestY * (0.15 + r * 0.12);
          const x0 = -W * 0.45 + r * 20;
          d += smoothPath([[x0, y], [x0 + W * 0.12, y - 8], [x0 + W * 0.25, y + 2]], false);
        }
        out.push(k.stroke('Ondulaciones', d, shade(k.s('sandColor'), -0.15), 2, 'ripples'));
      }
    }
    return { kind: 'group', children: out };
  },
};

export const rocks: Generator = {
  id: 'land.rocks',
  name: 'Piedras y rocas',
  category: 'paisaje',
  description: 'Piedras redondeadas o rocas facetadas, sueltas o apiladas.',
  keywords: ['piedra', 'piedras', 'roca', 'rocas', 'canto', 'rock', 'rocks', 'stone', 'stones'],
  params: [
    { key: 'count', label: 'Cantidad', group: 'Rocas', type: 'number', min: 1, max: 15, step: 1, default: 4 },
    { key: 'size', label: 'Tamaño', group: 'Rocas', type: 'number', min: 10, max: 500, step: 1, default: 110, unit: 'px' },
    { key: 'style', label: 'Estilo', group: 'Rocas', type: 'select', options: [{ value: 'faceted', label: 'Facetadas' }, { value: 'smooth', label: 'Canto rodado' }], default: 'faceted' },
    { key: 'pile', label: 'Apiladas', group: 'Rocas', type: 'boolean', default: true },
    ...colors({ rockColor: ['Roca', '#8d8c86'] }),
    ...outlineParams(1.4),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const n = k.i('count');
    const faceted = k.s('style') === 'faceted';
    const out: SceneNode[] = [];
    const sizes = Array.from({ length: n }, () => k.n('size') * (0.5 + k.rng.next() * 0.6)).sort((a, b) => b - a);
    let x = 0;
    sizes.forEach((S, i) => {
      const base = k.s('rockColor');
      const color = shade(base, k.rng.jitter(0.12));
      const spec = { radius: S / 2, vertices: faceted ? k.rng.int(6, 9) : 12, smoothness: faceted ? 0.15 : 1, irregularity: faceted ? 0.35 : 0.2, symmetry: 0, complexity: 2, stretch: 1.4 };
      const body = blobPath(spec, k.rng);
      let facets = '';
      if (faceted) {
        const c: Pt = [k.rng.jitter(S * 0.12), -S * 0.12];
        for (let f = 0; f < 3; f++) facets += polyline([c, mul(dir(-150 + f * 60 + k.rng.jitter(15)), S * 0.42)], false);
      }
      const rock = k.group(`Roca ${i + 1}`, [k.fill('Roca', body, color, 'rock'), facets && k.stroke('Facetas', facets, shade(color, -0.3), Math.max(1, k.outlineWidth()), 'facets')]);
      if (k.b('pile')) {
        // Pila: filas de abajo hacia arriba (las más grandes abajo); cada fila tiene una piedra menos.
        const perRow = Math.max(1, Math.ceil(Math.sqrt(n * 2)) - 1);
        let row = 0;
        let idx = i;
        let cap = perRow;
        while (idx >= cap && cap > 1) {
          idx -= cap;
          row++;
          cap--;
        }
        const px = (idx - (cap - 1) / 2) * k.n('size') * 0.8 + k.rng.jitter(8);
        out.push(k.at(rock, px, -S * 0.3 - row * k.n('size') * 0.45));
      } else {
        out.push(k.at(rock, x + S / 2, -S * 0.3));
        x += S * 1.05;
      }
    });
    if (!k.b('pile')) out.forEach((r) => (r.transform.x -= x / 2));
    return { kind: 'group', children: out };
  },
};

export const fire: Generator = {
  id: 'land.fire',
  name: 'Fuego',
  category: 'paisaje',
  also: ['simbolos'],
  description: 'Llama de capas (roja, naranja y amarilla) con lenguas laterales y fogata opcional.',
  keywords: ['fuego', 'llama', 'llamas', 'fogata', 'hoguera', 'fire', 'flame', 'vela'],
  params: [
    { key: 'height', label: 'Alto', group: 'Fuego', type: 'number', min: 20, max: 700, step: 1, default: 260, unit: 'px' },
    { key: 'width', label: 'Ancho', group: 'Fuego', type: 'number', min: 0.2, max: 1.2, step: 0.01, default: 0.55 },
    { key: 'tongues', label: 'Lenguas', group: 'Fuego', type: 'number', min: 1, max: 7, step: 1, default: 3 },
    { key: 'sway', label: 'Movimiento', group: 'Fuego', type: 'number', min: -1, max: 1, step: 0.01, default: 0.25 },
    { key: 'layers', label: 'Capas de color', group: 'Fuego', type: 'number', min: 1, max: 3, step: 1, default: 3 },
    { key: 'logs', label: 'Leños (fogata)', group: 'Fuego', type: 'boolean', default: false },
    ...colors({ outer: ['Afuera', '#d8402c'], middle: ['Medio', '#f08c24'], inner: ['Adentro', '#f6d24a'], logColor: ['Leños', '#6b4a2d'] }),
    ...outlineParams(0),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const H = k.n('height');
    const sway = k.n('sway');
    // Llama con la base en y = 0 y la punta arriba, corrida en x.
    const flame = (h: number, w: number, s: number, x: number) =>
      profileShape(h, (t) => w * Math.sin(Math.PI * Math.min(1, t ** 1.6 * 0.95 + 0.05)) ** 0.7 * (t < 0.92 ? 1 : 1 - (t - 0.92) * 6), { shift: (t) => s * h * 0.18 * Math.sin((1 - t) * Math.PI * 1.2) * (1 - t), samples: 40, offset: [x, -h / 2] });
    const layersC = [k.s('outer'), k.s('middle'), k.s('inner')].slice(0, k.i('layers'));
    const out: SceneNode[] = [];
    layersC.forEach((color, li) => {
      const scale = 1 - li * 0.28;
      let d = '';
      const n = k.i('tongues');
      for (let i = 0; i < n; i++) {
        const rel = n === 1 ? 0 : i / (n - 1) - 0.5;
        const h = H * scale * (1 - Math.abs(rel) * 0.7);
        const w = H * k.n('width') * scale * (1 - Math.abs(rel) * 0.4) * (n === 1 ? 1 : 0.75);
        d += flame(h, w, sway + rel * 1.2, rel * H * k.n('width') * 0.9 * scale);
      }
      out.push(k.styled(`Llama ${li + 1}`, d, { fill: color, stroke: null, strokeWidth: 0 }, 'flame'));
    });
    if (k.b('logs')) {
      const lw = H * 0.75;
      const lh = H * 0.1;
      out.unshift(k.at(k.fill('Leño', rect(-lw / 2, -lh / 2, lw, lh, lh / 2), k.s('logColor'), 'log'), 0, lh * 0.2, 14));
      out.unshift(k.at(k.fill('Leño', rect(-lw / 2, -lh / 2, lw, lh, lh / 2), shade(k.s('logColor'), -0.15), 'log'), 0, lh * 0.2, -14));
    }
    return { kind: 'group', children: out };
  },
};

export const ice: Generator = {
  id: 'land.ice',
  name: 'Copo de nieve / hielo',
  category: 'paisaje',
  also: ['simbolos'],
  description: 'Copo de nieve de seis brazos con ramificaciones, o cristales de hielo facetados.',
  keywords: ['hielo', 'nieve', 'copo', 'copos', 'cristal', 'cristales', 'ice', 'snowflake', 'escarcha', 'invierno'],
  params: [
    { key: 'type', label: 'Tipo', group: 'Hielo', type: 'select', options: [{ value: 'flake', label: 'Copo de nieve' }, { value: 'crystal', label: 'Cristales de hielo' }], default: 'flake' },
    { key: 'size', label: 'Tamaño', group: 'Hielo', type: 'number', min: 20, max: 700, step: 1, default: 260, unit: 'px' },
    { key: 'branches', label: 'Ramitas por brazo', group: 'Hielo', type: 'number', min: 0, max: 6, step: 1, default: 3 },
    { key: 'branchAngle', label: 'Ángulo de ramitas', group: 'Hielo', type: 'number', min: 20, max: 80, step: 1, default: 50, unit: '°' },
    { key: 'level2', label: 'Ramitas en las ramitas', group: 'Hielo', type: 'boolean', default: true },
    { key: 'width', label: 'Grosor', group: 'Hielo', type: 'number', min: 0.5, max: 30, step: 0.5, default: 7, unit: 'px' },
    ...colors({ iceColor: ['Hielo', '#7fb4d9'] }),
    ...outlineParams(0),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const S = k.n('size') / 2;
    const color = k.s('iceColor');
    if (k.s('type') === 'crystal') {
      let d = '';
      let facets = '';
      const n = 5;
      for (let i = 0; i < n; i++) {
        const a = -90 + k.rng.jitter(55);
        const len = S * k.rng.range(0.5, 1);
        const w = len * k.rng.range(0.18, 0.3);
        const base: Pt = [k.rng.jitter(S * 0.3), S * 0.4];
        const shard: Pt[] = [[0, -w / 2], [len * 0.8, -w / 2], [len, 0], [len * 0.8, w / 2], [0, w / 2]];
        d += polyline(place(shard, base, a), true);
        facets += polyline(place([[0, 0], [len, 0]], base, a), false);
      }
      return { kind: 'group', children: [k.fill('Cristales', d, color, 'crystal'), k.stroke('Facetas', facets, shade(color, 0.5), 1.5, 'facets')] };
    }
    let d = '';
    const w = k.n('width');
    for (let arm = 0; arm < 6; arm++) {
      const a = arm * 60 - 90;
      d += ribbon([[0, 0], mul(dir(a), S)], () => w, false);
      for (let b = 1; b <= k.i('branches'); b++) {
        const t = b / (k.i('branches') + 1);
        const p = mul(dir(a), S * t);
        const len = S * 0.42 * (1 - t * 0.6);
        for (const s of [-1, 1]) {
          const ba = a + s * k.n('branchAngle');
          const end = add(p, mul(dir(ba), len));
          d += ribbon([p, end], () => w * 0.75, false);
          if (k.b('level2') && len > S * 0.15) {
            const q = add(p, mul(dir(ba), len * 0.55));
            d += ribbon([q, add(q, mul(dir(ba - s * k.n('branchAngle')), len * 0.35))], () => w * 0.55, false);
          }
        }
      }
    }
    d += circle(0, 0, w * 1.4);
    return { kind: 'path', d, style: { fill: color, stroke: null, strokeWidth: 0 } };
  },
};

export const planet: Generator = {
  id: 'land.planet',
  name: 'Planeta',
  category: 'paisaje',
  description: 'Planeta con franjas, cráteres y anillo inclinado que pasa por delante y por detrás.',
  keywords: ['planeta', 'planetas', 'saturno', 'júpiter', 'jupiter', 'planet', 'espacio', 'anillo'],
  params: [
    { key: 'radius', label: 'Radio', group: 'Planeta', type: 'number', min: 10, max: 500, step: 1, default: 120, unit: 'px' },
    { key: 'bands', label: 'Franjas', group: 'Planeta', type: 'number', min: 0, max: 12, step: 1, default: 4 },
    { key: 'craters', label: 'Cráteres', group: 'Planeta', type: 'number', min: 0, max: 12, step: 1, default: 0 },
    { key: 'ring', label: 'Anillo', group: 'Planeta', type: 'boolean', default: true },
    { key: 'ringSize', label: 'Tamaño del anillo', group: 'Planeta', type: 'number', min: 1.1, max: 2.6, step: 0.01, default: 1.75 },
    { key: 'tilt', label: 'Inclinación', group: 'Planeta', type: 'number', min: -60, max: 60, step: 1, default: -18, unit: '°' },
    ...colors({ planetColor: ['Planeta', '#e0a35a'], bandColor: ['Franjas', '#c27a3a'], ringColor: ['Anillo', '#d9c7a0'] }),
    ...outlineParams(0),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const R = k.n('radius');
    let bands = '';
    for (let b = 0; b < k.i('bands'); b++) {
      // Franja = parte del círculo entre dos alturas (sin máscaras: la geometría ya queda recortada).
      const y1 = -R + ((2 * R) / (k.i('bands') + 1)) * (b + 0.7) + k.rng.jitter(R * 0.05);
      const y2 = y1 + R * k.rng.range(0.08, 0.2);
      const pts: Pt[] = [];
      for (let s = 0; s <= 12; s++) {
        const y = y1 + ((y2 - y1) * s) / 12;
        pts.push([Math.sqrt(Math.max(0, R * R - y * y)), y]);
      }
      for (let s = 12; s >= 0; s--) {
        const y = y1 + ((y2 - y1) * s) / 12;
        pts.push([-Math.sqrt(Math.max(0, R * R - y * y)), y]);
      }
      bands += polyline(pts, true);
    }
    let craters = '';
    for (let c = 0; c < k.i('craters'); c++) {
      const a = k.rng.range(0, 360);
      const rr = R * Math.sqrt(k.rng.next()) * 0.75;
      const cp = mul(dir(a), rr);
      craters += circle(cp[0], cp[1], R * k.rng.range(0.05, 0.12));
    }
    const ringOuter = R * k.n('ringSize');
    const ringInner = ringOuter * 0.78;
    const ry = 0.28;
    // Mitad de atrás del anillo (arriba) y mitad de adelante (abajo), como bandas elípticas.
    const half = (top: boolean) => `M${-ringOuter} 0A${ringOuter} ${ringOuter * ry} 0 0 ${top ? 1 : 0} ${ringOuter} 0L${ringInner} 0A${ringInner} ${ringInner * ry} 0 0 ${top ? 0 : 1} ${-ringInner} 0Z`;
    const ring = k.b('ring');
    const g = k.group('Planeta', [
      ring && k.fill('Anillo de atrás', half(true), shade(k.s('ringColor'), -0.12), 'ring'),
      k.fill('Planeta', circle(0, 0, R), k.s('planetColor'), 'planet'),
      bands && k.flat('Franjas', bands, k.s('bandColor'), 'bands'),
      craters && k.flat('Cráteres', craters, shade(k.s('planetColor'), -0.15), 'craters'),
      ring && k.fill('Anillo de adelante', half(false), k.s('ringColor'), 'ring'),
    ]);
    return { kind: 'group', children: [k.at(g, 0, 0, k.n('tilt'))] };
  },
};

export const landscapeGenerators: Generator[] = [mountains, hills, clouds, sun, moon, water, dunes, rocks, fire, ice, planet];
