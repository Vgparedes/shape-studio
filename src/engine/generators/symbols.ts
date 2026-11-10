// Símbolos y ornamentación (Etapa 5): mandala, marco, emblema, ornamento y patrón radial.
import type { Generator } from './types';
import type { SceneNode } from '../../core/types';
import type { Pt } from '../geometry/path';
import { polyline, roundedPolygon, smoothPath, starPoints } from '../geometry/path';
import { add, dir, mul, place } from '../geometry/vec';
import { shade } from '../../core/color';
import { petalOutline, leafGeometry, leafProfile } from '../botanical/leaf';
import { blobPoints } from '../organic/shapes';
import { circle, clean, colors, kit, outlineParams, rect } from './kit';

/** Repite una forma local (puntos con la punta hacia +x) alrededor del centro. */
function ring(shape: Pt[], count: number, radius: number, offsetDeg = 0, smooth = true): string {
  let d = '';
  for (let i = 0; i < count; i++) {
    const a = offsetDeg + (360 / count) * i - 90;
    const pts = place(shape, mul(dir(a), radius), a);
    d += smooth ? smoothPath(pts, true, 0.9) : polyline(pts, true);
  }
  return d;
}

export const mandala: Generator = {
  id: 'sym.mandala',
  name: 'Mandala',
  category: 'simbolos',
  description: 'Mandala de anillos concéntricos que alternan pétalos, puntos, arcos y picos, con la simetría que elijas.',
  keywords: ['mandala', 'mandalas', 'rosetón', 'roseton', 'simétrico', 'simetrico', 'radial', 'caleidoscopio'],
  params: [
    { key: 'symmetry', label: 'Simetría (repeticiones)', group: 'Mandala', type: 'number', min: 3, max: 36, step: 1, default: 12 },
    { key: 'rings', label: 'Anillos', group: 'Mandala', type: 'number', min: 1, max: 10, step: 1, default: 5 },
    { key: 'radius', label: 'Radio', group: 'Mandala', type: 'number', min: 20, max: 600, step: 1, default: 220, unit: 'px' },
    { key: 'style', label: 'Estilo', group: 'Mandala', type: 'select', options: [{ value: 'fill', label: 'Relleno de colores' }, { value: 'line', label: 'Solo línea' }], default: 'fill' },
    ...colors({ c1: ['Color 1', '#3f5d7a'], c2: ['Color 2', '#d9a72b'], c3: ['Color 3', '#c4553a'], c4: ['Fondo / línea', '#f1e6cf'] }),
    ...outlineParams(1, '#2b2620'),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const n = k.i('symmetry');
    const R = k.n('radius');
    const rings = k.i('rings');
    const pal = [k.s('c1'), k.s('c2'), k.s('c3')];
    const lineMode = k.s('style') === 'line';
    const kinds = ['petal', 'dots', 'spike', 'arch', 'leaf', 'drop'];
    const out: SceneNode[] = [];
    // Del anillo de afuera hacia adentro, así los de adentro quedan arriba.
    for (let r = rings - 1; r >= 0; r--) {
      const rr = R * ((r + 1) / rings);
      const width = R / rings;
      const kind = k.rng.pick(kinds);
      const count = kind === 'dots' ? n * 2 : n;
      const off = r % 2 ? 180 / count : 0;
      let d = '';
      if (kind === 'petal') d = ring(petalOutline(width * 1.3, ((2 * Math.PI * rr) / count) * 0.9, 'redondeada'), count, rr - width * 1.15, off);
      else if (kind === 'leaf') d = ring(leafGeometry({ length: width * 1.2, width: ((2 * Math.PI * rr) / count) * 0.55, profile: leafProfile('lanceolada') }).outline, count, rr - width * 1.1, off);
      else if (kind === 'spike') d = ring([[0, -((Math.PI * rr) / count) * 0.8], [width * 0.95, 0], [0, ((Math.PI * rr) / count) * 0.8]], count, rr - width, off, false);
      else if (kind === 'drop') d = ring(petalOutline(width * 0.9, ((2 * Math.PI * rr) / count) * 0.5, 'punta'), count, rr - width * 0.95, off);
      else if (kind === 'arch') {
        for (let i = 0; i < count; i++) {
          const a0 = (360 / count) * i + off;
          const a1 = a0 + 360 / count;
          const p0 = mul(dir(a0), rr - width * 0.9);
          const p1 = mul(dir(a1), rr - width * 0.9);
          const top = mul(dir((a0 + a1) / 2), rr - width * 0.1);
          d += smoothPath([p0, top, p1, mul(dir((a0 + a1) / 2), rr - width * 0.6)], true, 0.8);
        }
      } else {
        for (let i = 0; i < count; i++) {
          const c = mul(dir((360 / count) * i + off), rr - width * 0.5);
          d += circle(c[0], c[1], Math.min(width * 0.28, ((Math.PI * rr) / count) * 0.6));
        }
      }
      const color = pal[r % pal.length];
      out.push(lineMode ? k.stroke(`Anillo ${r + 1}`, d, k.outlineColor(), Math.max(1, k.outlineWidth(), R * 0.008), 'ring') : k.fill(`Anillo ${r + 1}`, d, color, 'ring'));
    }
    const center = circle(0, 0, (R / rings) * 0.55);
    out.push(lineMode ? k.stroke('Centro', center, k.outlineColor(), Math.max(1, k.outlineWidth(), R * 0.008), 'center') : k.fill('Centro', center, pal[1], 'center'));
    if (!lineMode) out.unshift(k.flat('Fondo', circle(0, 0, R * 1.03), k.s('c4'), 'background'));
    return { kind: 'group', children: out };
  },
};

export const frame: Generator = {
  id: 'sym.frame',
  name: 'Marco',
  category: 'simbolos',
  description: 'Marco rectangular, ovalado o con esquinas recortadas, con doble línea, adornos en las esquinas o borde de puntos.',
  keywords: ['marco', 'marcos', 'borde', 'recuadro', 'cuadro', 'frame', 'border', 'etiqueta'],
  params: [
    { key: 'shape', label: 'Forma', group: 'Marco', type: 'select', options: [{ value: 'rect', label: 'Rectangular' }, { value: 'oval', label: 'Ovalado' }, { value: 'notched', label: 'Esquinas recortadas' }, { value: 'arch', label: 'Arco arriba' }], default: 'notched' },
    { key: 'width', label: 'Ancho', group: 'Marco', type: 'number', min: 40, max: 1600, step: 1, default: 520, unit: 'px' },
    { key: 'height', label: 'Alto', group: 'Marco', type: 'number', min: 40, max: 1600, step: 1, default: 340, unit: 'px' },
    { key: 'double', label: 'Doble línea', group: 'Marco', type: 'boolean', default: true },
    { key: 'corners', label: 'Adornos en las esquinas', group: 'Marco', type: 'select', options: [{ value: 'none', label: 'Ninguno' }, { value: 'dots', label: 'Puntos' }, { value: 'leaves', label: 'Hojitas' }, { value: 'stars', label: 'Estrellas' }], default: 'leaves' },
    { key: 'dotted', label: 'Borde de puntos', group: 'Marco', type: 'boolean', default: false },
    { key: 'lineWidth', label: 'Grosor', group: 'Marco', type: 'number', min: 0.5, max: 20, step: 0.5, default: 3, unit: 'px' },
    ...colors({ lineColor: ['Línea', '#3b3a2a'], ornamentColor: ['Adornos', '#7a7d3a'] }),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const W = k.n('width');
    const H = k.n('height');
    const lw = k.n('lineWidth');
    const shapeOf = (w: number, h: number) => {
      const s = k.s('shape');
      if (s === 'oval') return `M${-w / 2} 0A${w / 2} ${h / 2} 0 1 1 ${w / 2} 0A${w / 2} ${h / 2} 0 1 1 ${-w / 2} 0Z`;
      if (s === 'arch') return `M${-w / 2} ${h / 2}V${-h / 2 + w / 4}A${w / 2} ${w / 4} 0 0 1 ${w / 2} ${-h / 2 + w / 4}V${h / 2}Z`;
      if (s === 'notched') {
        const c = Math.min(w, h) * 0.08;
        return polyline([[-w / 2 + c, -h / 2], [w / 2 - c, -h / 2], [w / 2, -h / 2 + c], [w / 2, h / 2 - c], [w / 2 - c, h / 2], [-w / 2 + c, h / 2], [-w / 2, h / 2 - c], [-w / 2, -h / 2 + c]], true);
      }
      return rect(-w / 2, -h / 2, w, h);
    };
    let lines = shapeOf(W, H);
    if (k.b('double')) lines += shapeOf(W - lw * 5, H - lw * 5);
    let dots = '';
    if (k.b('dotted') && k.s('shape') === 'oval') {
      // Puntos siguiendo el óvalo, espaciados parejo.
      const rx = W / 2 - lw * 5;
      const ry = H / 2 - lw * 5;
      const count = Math.max(8, Math.round((Math.PI * (rx + ry)) / (lw * 5)));
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        dots += circle(Math.cos(a) * rx, Math.sin(a) * ry, lw * 0.7);
      }
    } else if (k.b('dotted')) {
      const step = lw * 5;
      const iw = W - lw * 10;
      const ih = H - lw * 10;
      for (let x = -iw / 2; x <= iw / 2; x += step) dots += circle(x, -ih / 2, lw * 0.7) + circle(x, ih / 2, lw * 0.7);
      for (let y = -ih / 2 + step; y < ih / 2; y += step) dots += circle(-iw / 2, y, lw * 0.7) + circle(iw / 2, y, lw * 0.7);
    }
    let orn = '';
    const corners: Pt[] = [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]];
    const c = k.s('corners');
    const sz = Math.min(W, H) * 0.09;
    corners.forEach((p, i) => {
      const inward = 45 + 90 * i; // apunta hacia adentro del marco
      const q = add(p, mul(dir(inward), sz * 0.9));
      if (c === 'dots') orn += circle(q[0], q[1], sz * 0.22);
      if (c === 'stars') orn += roundedPolygon(starPoints(4, sz * 0.5, sz * 0.15).map((s) => add(s, q)), 0.1);
      if (c === 'leaves')
        for (const da of [-35, 35]) {
          const g = leafGeometry({ length: sz * 1.1, width: sz * 0.45, profile: leafProfile('ovalada') });
          orn += smoothPath(place(g.outline, q, inward + 180 + da + 180), true);
        }
    });
    return {
      kind: 'group',
      children: clean([
        k.stroke('Marco', lines, k.s('lineColor'), lw, 'frame'),
        dots && k.flat('Puntos', dots, k.s('lineColor'), 'dots'),
        orn && k.flat('Adornos', orn, k.s('ornamentColor'), 'ornaments'),
      ]),
    };
  },
};

export const emblem: Generator = {
  id: 'sym.emblem',
  name: 'Emblema / escudo',
  category: 'simbolos',
  description: 'Escudo, insignia circular o sello dentado, con franja, borde y un símbolo al centro.',
  keywords: ['emblema', 'emblemas', 'escudo', 'escudos', 'insignia', 'sello', 'badge', 'logo', 'medalla', 'blasón'],
  params: [
    { key: 'shape', label: 'Forma', group: 'Emblema', type: 'select', options: [{ value: 'shield', label: 'Escudo' }, { value: 'circle', label: 'Insignia redonda' }, { value: 'seal', label: 'Sello dentado' }, { value: 'hex', label: 'Hexágono' }], default: 'shield' },
    { key: 'size', label: 'Tamaño', group: 'Emblema', type: 'number', min: 30, max: 800, step: 1, default: 300, unit: 'px' },
    { key: 'band', label: 'Franja', group: 'Emblema', type: 'select', options: [{ value: 'none', label: 'Ninguna' }, { value: 'horizontal', label: 'Horizontal' }, { value: 'diagonal', label: 'Diagonal' }, { value: 'chevron', label: 'En V' }], default: 'chevron' },
    { key: 'symbol', label: 'Símbolo central', group: 'Emblema', type: 'select', options: [{ value: 'star', label: 'Estrella' }, { value: 'leaf', label: 'Hoja' }, { value: 'circle', label: 'Círculo' }, { value: 'none', label: 'Ninguno' }], default: 'star' },
    { key: 'border', label: 'Borde interior', group: 'Emblema', type: 'boolean', default: true },
    ...colors({ baseColor: ['Fondo', '#2f4a6a'], bandColor: ['Franja', '#d9a72b'], symbolColor: ['Símbolo', '#f1e6cf'] }),
    ...outlineParams(2),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const S = k.n('size');
    const shape = k.s('shape');
    const outlineOf = (s: number): Pt[] => {
      if (shape === 'circle') return Array.from({ length: 48 }, (_, i) => mul(dir((i / 48) * 360), s / 2));
      if (shape === 'hex') return Array.from({ length: 6 }, (_, i) => mul(dir(i * 60 - 90), s / 2));
      if (shape === 'seal') return Array.from({ length: 64 }, (_, i) => mul(dir((i / 64) * 360), (s / 2) * (i % 2 ? 0.92 : 1)));
      // Escudo: arriba recto, costados que bajan y terminan en punta.
      const pts: Pt[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        pts.push([(s / 2) * (1 - t ** 2.4), -s * 0.45 + s * 0.95 * t]);
      }
      const left: Pt = [-s / 2, -s * 0.45];
      return [left, ...pts, ...pts.slice(0, -1).reverse().map(([x, y]) => [-x, y] as Pt)];
    };
    const smoothShape = shape === 'shield' || shape === 'circle';
    const draw = (pts: Pt[]) => (smoothShape && shape === 'circle' ? smoothPath(pts, true) : shape === 'shield' ? smoothPath(pts, true, 0.25) : polyline(pts, true));
    const base = draw(outlineOf(S));
    const inner = draw(outlineOf(S * 0.86));
    // Franja: polígono recortado aproximadamente al interior con los mismos límites del escudo.
    const halfAt = (y: number) => {
      const pts = outlineOf(S * 0.86);
      const xs = pts.filter((p) => Math.abs(p[1] - y) < S * 0.06).map((p) => Math.abs(p[0]));
      return xs.length ? Math.max(...xs) : S * 0.35;
    };
    let band = '';
    const bw = S * 0.14;
    const b = k.s('band');
    if (b === 'horizontal') band = polyline([[-halfAt(-bw / 2), -bw / 2], [halfAt(-bw / 2), -bw / 2], [halfAt(bw / 2), bw / 2], [-halfAt(bw / 2), bw / 2]], true);
    if (b === 'diagonal') band = polyline([[-halfAt(-S * 0.3) * 0.95, -S * 0.3 - bw / 2], [-halfAt(-S * 0.3) * 0.95, -S * 0.3 + bw / 2], [halfAt(S * 0.25) * 0.9, S * 0.25 + bw / 2], [halfAt(S * 0.25) * 0.9, S * 0.25 - bw / 2]], true);
    if (b === 'chevron') {
      const y = S * 0.05;
      band = polyline([[-halfAt(y) * 0.98, y - bw * 0.2], [0, y - S * 0.25], [halfAt(y) * 0.98, y - bw * 0.2], [halfAt(y + bw) * 0.98, y + bw * 0.8], [0, y - S * 0.25 + bw], [-halfAt(y + bw) * 0.98, y + bw * 0.8]], true);
    }
    let symbol = '';
    const sy = b === 'chevron' ? -S * 0.2 : -S * 0.02;
    if (k.s('symbol') === 'star') symbol = roundedPolygon(starPoints(5, S * 0.14, S * 0.06).map((p) => add(p, [0, sy])), 0.1);
    if (k.s('symbol') === 'circle') symbol = circle(0, sy, S * 0.1);
    if (k.s('symbol') === 'leaf') {
      const g = leafGeometry({ length: S * 0.28, width: S * 0.13, profile: leafProfile('ovalada') });
      symbol = smoothPath(place(g.outline, [0, sy + S * 0.14], -90), true);
    }
    return {
      kind: 'group',
      children: clean([
        k.fill('Fondo', base, k.s('baseColor'), 'base'),
        band && k.flat('Franja', band, k.s('bandColor'), 'band'),
        k.b('border') && k.stroke('Borde interior', inner, k.s('bandColor'), Math.max(1.5, S * 0.012), 'border'),
        symbol && k.flat('Símbolo', symbol, k.s('symbolColor'), 'symbol'),
      ]),
    };
  },
};

export const ornament: Generator = {
  id: 'sym.ornament',
  name: 'Ornamento',
  category: 'simbolos',
  description: 'Filete decorativo simétrico de volutas en espiral, con hojitas y punto central. Sirve de separador.',
  keywords: ['ornamento', 'ornamentos', 'adorno', 'adornos', 'voluta', 'volutas', 'filete', 'separador', 'floritura', 'ornament', 'flourish', 'decorativo'],
  params: [
    { key: 'width', label: 'Ancho', group: 'Ornamento', type: 'number', min: 40, max: 1600, step: 1, default: 560, unit: 'px' },
    { key: 'curls', label: 'Volutas por lado', group: 'Ornamento', type: 'number', min: 1, max: 4, step: 1, default: 2 },
    { key: 'curl', label: 'Enrulado', group: 'Ornamento', type: 'number', min: 0.3, max: 2, step: 0.01, default: 1.1 },
    { key: 'leaves', label: 'Hojitas', group: 'Ornamento', type: 'boolean', default: true },
    { key: 'lineWidth', label: 'Grosor', group: 'Ornamento', type: 'number', min: 0.5, max: 20, step: 0.5, default: 4, unit: 'px' },
    ...colors({ lineColor: ['Línea', '#3b3a2a'], accentColor: ['Hojitas y centro', '#7a7d3a'] }),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const W = k.n('width') / 2;
    const n = k.i('curls');
    let lines = '';
    let leaves = '';
    for (const side of [-1, 1]) {
      // Eje que se aleja del centro con una leve onda, y de él salen volutas que se enrulan.
      const axis: Pt[] = [];
      for (let i = 0; i <= 30; i++) {
        const t = i / 30;
        axis.push([side * (W * 0.08 + W * 0.9 * t), Math.sin(t * Math.PI * n) * W * 0.06]);
      }
      lines += smoothPath(axis, false);
      for (let c = 0; c < n; c++) {
        const t = (c + 0.65) / (n + 0.2);
        const base = axis[Math.round(t * 30)];
        const up = c % 2 === 0 ? -1 : 1;
        const R = W * 0.13 * (1 - t * 0.35) * k.n('curl');
        const sp: Pt[] = [];
        for (let j = 0; j <= 40; j++) {
          const u = j / 40;
          const a = (side > 0 ? 180 : 0) + side * up * (90 + u * 540);
          sp.push(add(add(base, [side * R * 0.2, up * R * 1.1]), mul(dir(a), R * (1 - u * 0.85))));
        }
        lines += smoothPath([base, ...sp], false);
        if (k.b('leaves')) {
          const g = leafGeometry({ length: R * 1.1, width: R * 0.45, profile: leafProfile('ovalada') });
          leaves += smoothPath(place(g.outline, base, side > 0 ? -up * 50 : 180 + up * 50), true);
        }
      }
      // Remate de la punta.
      const tip = axis[30];
      lines += smoothPath([tip, add(tip, [side * W * 0.04, -W * 0.03]), add(tip, [side * W * 0.02, -W * 0.06])], false);
    }
    const centerD = roundedPolygon([[0, -W * 0.07], [W * 0.05, 0], [0, W * 0.07], [-W * 0.05, 0]], 0.3);
    return {
      kind: 'group',
      children: clean([
        k.stroke('Volutas', lines, k.s('lineColor'), k.n('lineWidth'), 'scrolls'),
        leaves && k.flat('Hojitas', leaves, k.s('accentColor'), 'leaves'),
        k.flat('Centro', centerD, k.s('accentColor'), 'center'),
      ]),
    };
  },
};

export const radialPattern: Generator = {
  id: 'sym.radial',
  name: 'Composición simétrica',
  category: 'simbolos',
  also: ['organicas'],
  description: 'Un motivo orgánico generado al azar repetido en simetría radial (tipo caleidoscopio), con espejo opcional.',
  keywords: ['simétrica', 'simetrica', 'simétrico', 'composición simétrica', 'caleidoscopio', 'patrón radial', 'patron radial', 'roseta', 'radial'],
  params: [
    { key: 'repeats', label: 'Repeticiones', group: 'Composición', type: 'number', min: 2, max: 24, step: 1, default: 8 },
    { key: 'mirror', label: 'Espejo en cada repetición', group: 'Composición', type: 'boolean', default: true },
    { key: 'radius', label: 'Radio', group: 'Composición', type: 'number', min: 20, max: 600, step: 1, default: 220, unit: 'px' },
    { key: 'motifs', label: 'Motivos por gajo', group: 'Composición', type: 'number', min: 1, max: 5, step: 1, default: 3 },
    ...colors({ c1: ['Color 1', '#7a7d3a'], c2: ['Color 2', '#d9a72b'], c3: ['Color 3', '#3b3a2a'] }),
    ...outlineParams(0),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const n = k.i('repeats');
    const R = k.n('radius');
    const pal = [k.s('c1'), k.s('c2'), k.s('c3')];
    const out: SceneNode[] = [];
    const sector = 360 / n;
    for (let m = 0; m < k.i('motifs'); m++) {
      // Un motivo: blob chico ubicado dentro de medio gajo.
      const dist = R * (0.25 + 0.65 * k.rng.next());
      const ang = k.rng.range(0.1, 0.45) * sector;
      const size = Math.min(R * (0.04 + 0.07 * k.rng.next()) * (dist / R + 0.5), ((Math.PI * dist) / n) * 0.35);
      const shape = blobPoints({ radius: size, vertices: 7, smoothness: 1, irregularity: 0.6, symmetry: 0, complexity: 3, stretch: 1.3 }, k.rng).map((p) => add(p, mul(dir(ang - 90), dist)));
      let d = '';
      for (let i = 0; i < n; i++) {
        const rot = i * sector;
        const r = (pts: Pt[]) => pts.map(([x, y]) => {
          const a = (rot * Math.PI) / 180;
          return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)] as Pt;
        });
        d += smoothPath(r(shape), true);
        if (k.b('mirror')) d += smoothPath(r(shape.map(([x, y]) => [-x, y] as Pt).reverse()), true);
      }
      out.push(k.fill(`Motivo ${m + 1}`, d, pal[m % pal.length], 'motif'));
    }
    out.push(k.fill('Centro', circle(0, 0, R * 0.08), shade(pal[1], -0.1), 'center'));
    return { kind: 'group', children: out };
  },
};

export const symbolGenerators: Generator[] = [mandala, frame, emblem, ornament, radialPattern];
