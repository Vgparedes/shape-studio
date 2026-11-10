// Botánica, segunda tanda (Etapa 5): rosa, hongo, cactus, suculenta, frutas y verduras,
// semillas, pasto y enredadera.
import type { Generator, ParamDef } from './types';
import type { SceneNode } from '../../core/types';
import type { Pt } from '../geometry/path';
import { polyline, smoothPath } from '../geometry/path';
import { grow, sampleAt } from '../geometry/curve';
import { ribbon, taper } from '../geometry/ribbon';
import { add, dir, mul, place } from '../geometry/vec';
import { shade } from '../../core/color';
import { leafGeometry, leafProfile, petalOutline } from '../botanical/leaf';
import { flowerHead } from '../botanical/flowerHead';
import { colorParams, leafParams, plantBody, rootParams, stemParams } from '../botanical/plant';
import { circle, clean, colors, ellipse, kit, outlineParams, profileShape, rect } from './kit';

// ---------------------------------------------------------------------------

export const rose: Generator = {
  id: 'bot.rose',
  name: 'Rosa',
  category: 'botanica',
  description: 'Rosa abierta vista de frente (pétalos en espiral) o capullo cerrado, con tallo y hojas dentadas.',
  keywords: ['rosa', 'rosas', 'rose', 'capullo', 'pimpollo'],
  params: [
    { key: 'view', label: 'Forma', group: 'Flor', type: 'select', options: [{ value: 'open', label: 'Abierta' }, { value: 'bud', label: 'Capullo' }], default: 'open' },
    { key: 'size', label: 'Tamaño', group: 'Flor', type: 'number', min: 15, max: 200, step: 1, default: 62, unit: 'px' },
    { key: 'layers', label: 'Capas de pétalos', group: 'Flor', type: 'number', min: 2, max: 8, step: 1, default: 5 },
    { key: 'openness', label: 'Apertura', group: 'Flor', type: 'number', min: 0, max: 1, step: 0.01, default: 0.6 },
    ...stemParams({ length: 230, curve: 0.1, width: 5 }),
    ...leafParams({ count: 4, length: 58, ratio: 0.55, shape: 'ovalada', angle: 50, droop: 0.4, veins: 3, distribution: 'opuesta' }).map((p): ParamDef => (p.key === 'leafSerration' && p.type === 'number' ? { ...p, default: 0.5 } : p)),
    ...rootParams({ show: false, length: 60, depth: 2, count: 3 }),
    ...colorParams({ petalColor: ['Pétalos', '#c7364a'], leafColor: ['Hojas', '#4f7a3a'], stemColor: ['Tallo', '#4a6e33'], rootColor: ['Raíces', '#9a7650'], outlineColor: ['Contorno', '#2b2620'] }),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const body = plantBody(ctx, { stem: k.s('stemColor'), leaf: k.s('leafColor'), root: k.s('rootColor'), outline: k.outlineColor(), outlineWidth: k.outlineWidth() });
    const S = k.n('size');
    const petal = k.s('petalColor');
    const pieces: SceneNode[] = [];
    if (k.s('view') === 'bud') {
      // Capullo: gota cerrada con dos sépalos verdes abrazándola.
      const h = S * 1.5;
      const w = S * (0.75 + k.n('openness') * 0.35);
      pieces.push(k.fill('Pétalos', profileShape(h, (t) => w * Math.sin(Math.PI * Math.min(1, 0.06 + t * 0.94)) ** 0.75 * (0.55 + 0.45 * t)), petal, 'petals'));
      pieces.push(k.fill('Pétalo de adelante', profileShape(h * 0.82, (t) => w * 0.7 * Math.sin(Math.PI * Math.min(1, 0.1 + t * 0.9)) ** 0.8 * (0.4 + 0.6 * t), { shift: (t) => w * 0.12 * (1 - t) }), shade(petal, 0.12), 'petals'));
      for (const s of [-1, 1]) {
        const g = leafGeometry({ length: h * 0.6, width: h * 0.16, profile: leafProfile('lanceolada'), curl: s * 0.25 });
        pieces.push(k.fill('Sépalo', smoothPath(place(g.outline, [0, h * 0.45], -90 + s * 25), true), k.s('leafColor'), 'sepal'));
      }
      pieces.forEach((p) => (p.transform = { ...p.transform, y: p.transform.y - h * 0.45 }));
    } else {
      // Abierta: capas de pétalos redondeados que giran con el ángulo de oro, de afuera hacia adentro.
      const L = Math.round(k.n('layers'));
      for (let layer = 0; layer < L; layer++) {
        const rel = layer / Math.max(1, L - 1);
        const count = Math.max(3, Math.round(5 + (1 - rel) * 3));
        const len = S * (1 - rel * 0.78) * (0.7 + k.n('openness') * 0.3);
        const wid = len * (1.05 + rel * 0.2);
        const color = shade(petal, -0.05 - rel * 0.3);
        let d = '';
        for (let i = 0; i < count; i++) {
          const a = (360 / count) * i + layer * 137.5 + k.rng.jitter(8);
          d += smoothPath(place(petalOutline(len, wid, 'redondeada'), [0, 0], a), true, 0.9);
        }
        pieces.push(k.fill(`Pétalos capa ${layer + 1}`, d, color, 'petals'));
      }
      // Remolino del centro.
      const sp: Pt[] = [];
      for (let i = 0; i <= 40; i++) sp.push(mul(dir(i * 22), S * 0.16 * (i / 40)));
      pieces.push(k.stroke('Centro', smoothPath(sp, false), shade(petal, -0.55), Math.max(1, k.outlineWidth()), 'center'));
    }
    const head = k.group('Flor', pieces, 'flower');
    const extra = k.s('view') === 'bud' ? 0 : S * 0.35;
    k.at(head, body.top.p[0], body.top.p[1] - extra);
    return { kind: 'group', children: [...body.nodes, head] };
  },
};

// ---------------------------------------------------------------------------

export const mushroom: Generator = {
  id: 'bot.mushroom',
  name: 'Hongo',
  category: 'botanica',
  description: 'Hongos sueltos o en grupo, con sombrero de varias formas, laminillas, anillo y manchas.',
  keywords: ['hongo', 'hongos', 'seta', 'setas', 'champiñón', 'champinon', 'mushroom'],
  params: [
    { key: 'count', label: 'Cantidad', group: 'Hongos', type: 'number', min: 1, max: 7, step: 1, default: 1 },
    { key: 'cap', label: 'Sombrero', group: 'Hongos', type: 'select', options: [{ value: 'convex', label: 'Redondeado' }, { value: 'bell', label: 'Campana' }, { value: 'flat', label: 'Plano' }, { value: 'funnel', label: 'Embudo' }], default: 'convex' },
    { key: 'capWidth', label: 'Ancho del sombrero', group: 'Hongos', type: 'number', min: 20, max: 400, step: 1, default: 170, unit: 'px' },
    { key: 'stemHeight', label: 'Alto del pie', group: 'Hongos', type: 'number', min: 10, max: 400, step: 1, default: 130, unit: 'px' },
    { key: 'stemWidth', label: 'Grosor del pie', group: 'Hongos', type: 'number', min: 0.1, max: 0.8, step: 0.01, default: 0.26 },
    { key: 'gills', label: 'Laminillas', group: 'Hongos', type: 'boolean', default: true },
    { key: 'ring', label: 'Anillo', group: 'Hongos', type: 'boolean', default: false },
    { key: 'spots', label: 'Manchas', group: 'Hongos', type: 'number', min: 0, max: 30, step: 1, default: 7 },
    ...colors({ capColor: ['Sombrero', '#c4452f'], stemColor: ['Pie', '#f1e6cf'], spotColor: ['Manchas', '#fbf7ee'], gillColor: ['Laminillas', '#d9c6a3'] }),
    ...outlineParams(),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const n = k.i('count');
    const out: SceneNode[] = [];
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => Math.abs(b - (n - 1) / 2) - Math.abs(a - (n - 1) / 2));
    for (const i of order) {
      const rel = n === 1 ? 0 : i / (n - 1) - 0.5;
      const sc = n === 1 ? 1 : 1 - Math.abs(rel) * 0.7 + k.rng.jitter(0.1);
      const W = k.n('capWidth') * sc;
      const H = k.n('stemHeight') * sc * (1 + k.rng.jitter(0.15));
      const sw = W * k.n('stemWidth');
      const capType = k.s('cap');
      const capH = W * (capType === 'bell' ? 0.62 : capType === 'flat' ? 0.22 : capType === 'funnel' ? 0.3 : 0.45);
      const lean = n === 1 ? 0 : rel * 30 + k.rng.jitter(6);
      // Sombrero: mitad superior de un perfil, base plana o en embudo.
      const top: Pt[] = [];
      for (let j = 0; j <= 30; j++) {
        const t = j / 30;
        const x = -W / 2 + W * t;
        const u = Math.abs(2 * t - 1);
        let y: number;
        if (capType === 'bell') y = -capH * (1 - u ** 2.2) ** 0.7;
        else if (capType === 'flat') y = -capH * (1 - u ** 4) ** 0.5;
        else if (capType === 'funnel') y = -capH * (0.35 + 0.65 * u ** 1.5) * (u < 0.98 ? 1 : 0.6);
        else y = -capH * Math.sqrt(Math.max(0, 1 - u ** 2));
        top.push([x, y]);
      }
      const under = capType === 'funnel' ? [[W * 0.15, capH * 0.15] as Pt, [-W * 0.15, capH * 0.15] as Pt] : [[W * 0.42, capH * 0.12] as Pt, [-W * 0.42, capH * 0.12] as Pt];
      const capPts = [...top, ...under];
      const stem = profileShape(H, (t) => sw * (0.85 + 0.35 * t ** 2), { samples: 16 });
      let spots = '';
      for (let s = 0; s < k.i('spots'); s++) {
        const x = k.rng.range(-W * 0.4, W * 0.4);
        const yTop = top[Math.round(((x + W / 2) / W) * 30)][1];
        const y = yTop * k.rng.range(0.25, 0.8);
        spots += ellipse(x, y, W * k.rng.range(0.03, 0.07), W * k.rng.range(0.025, 0.05));
      }
      let gills = '';
      if (k.b('gills')) for (let g = -6; g <= 6; g++) gills += polyline([[g * W * 0.06, capH * 0.1], [g * W * 0.022, capH * 0.2]], false);
      const node = k.group(`Hongo ${i + 1}`, [
        k.at(k.fill('Pie', stem, k.s('stemColor'), 'stem'), 0, H / 2),
        k.b('ring') && k.fill('Anillo', ellipse(0, H * 0.25, sw * 0.75, sw * 0.18), shade(k.s('stemColor'), -0.08), 'ring'),
        gills && k.fill('Laminillas', smoothPath([[-W * 0.42, capH * 0.12], [0, capH * 0.26], [W * 0.42, capH * 0.12], [0, capH * 0.05]], true), k.s('gillColor'), 'gills'),
        gills && k.stroke('Líneas de laminillas', gills, shade(k.s('gillColor'), -0.3), Math.max(0.6, k.outlineWidth() * 0.6), 'gills'),
        k.fill('Sombrero', smoothPath(capPts, true, 0.8), k.s('capColor'), 'cap'),
        spots && k.fill('Manchas', spots, k.s('spotColor'), 'spots', 0.6),
      ]);
      out.push(k.at(node, rel * k.n('capWidth') * n * 0.55, -H - (n === 1 ? 0 : k.rng.range(-8, 8)) + k.n('stemHeight') / 2, lean));
    }
    return { kind: 'group', children: out };
  },
};

// ---------------------------------------------------------------------------

export const cactus: Generator = {
  id: 'bot.cactus',
  name: 'Cactus',
  category: 'botanica',
  description: 'Cactus columnar con brazos, de barril con costillas o nopal de paletas, con espinas, flores y maceta opcional.',
  keywords: ['cactus', 'cactos', 'nopal', 'saguaro', 'tuna'],
  params: [
    { key: 'type', label: 'Tipo', group: 'Cactus', type: 'select', options: [{ value: 'saguaro', label: 'Columnar con brazos' }, { value: 'barrel', label: 'Barril' }, { value: 'nopal', label: 'Nopal (paletas)' }], default: 'saguaro' },
    { key: 'height', label: 'Alto', group: 'Cactus', type: 'number', min: 40, max: 600, step: 1, default: 280, unit: 'px' },
    { key: 'width', label: 'Ancho', group: 'Cactus', type: 'number', min: 10, max: 300, step: 1, default: 62, unit: 'px' },
    { key: 'arms', label: 'Brazos / paletas', group: 'Cactus', type: 'number', min: 0, max: 8, step: 1, default: 2 },
    { key: 'ribs', label: 'Costillas', group: 'Cactus', type: 'number', min: 0, max: 12, step: 1, default: 3 },
    { key: 'spines', label: 'Espinas', group: 'Cactus', type: 'boolean', default: true },
    { key: 'flowers', label: 'Flores', group: 'Cactus', type: 'number', min: 0, max: 8, step: 1, default: 1 },
    { key: 'pot', label: 'Maceta', group: 'Cactus', type: 'boolean', default: false },
    ...colors({ bodyColor: ['Cactus', '#5f8f55'], flowerColor: ['Flores', '#e0607a'], potColor: ['Maceta', '#c0714a'] }),
    ...outlineParams(),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const H = k.n('height');
    const W = k.n('width');
    const type = k.s('type');
    const body = k.s('bodyColor');
    const ribColor = shade(body, -0.35);
    let shapes = '';
    let caps = ''; // puntas redondeadas de los brazos: van aparte para no hacer agujeros al superponerse
    let ribs = '';
    let spines = '';
    const flowerSpots: Pt[] = [];
    const spineAlong = (x0: number, y0: number, x1: number, y1: number) => {
      const steps = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 14));
      for (let s = 1; s < steps; s++) {
        const p: Pt = [x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps];
        spines += polyline([add(p, [-3, -2]), p, add(p, [3, -2])], false);
      }
    };
    if (type === 'barrel') {
      shapes += profileShape(H, (t) => W * 2 * Math.sin(Math.PI * Math.min(1, 0.08 + t * 0.92)) ** 0.5);
      const nr = Math.max(1, k.i('ribs'));
      for (let i = 1; i <= nr; i++) {
        const x = -W + (2 * W * i) / (nr + 1);
        const bulge = x * 0.12;
        ribs += smoothPath([[x * 0.4, -H / 2 + 4], [x + bulge, 0], [x * 0.75, H / 2 - 4]], false);
        if (k.b('spines')) spineAlong(x * 0.6, -H / 2 + 10, x, H / 2 - 10);
      }
      flowerSpots.push([0, -H / 2]);
    } else if (type === 'nopal') {
      // Paletas que brotan de los bordes de otras paletas.
      const pads: { c: Pt; w: number; h: number; a: number }[] = [{ c: [0, -H * 0.28], w: H * 0.55 * 0.68, h: H * 0.55, a: 0 }];
      for (let i = 0; i < k.i('arms'); i++) {
        const parent = pads[k.rng.int(0, pads.length - 1)];
        const side = k.rng.next() < 0.5 ? -1 : 1;
        const a = parent.a + side * k.rng.range(25, 50);
        const tip = add(parent.c, mul(dir(parent.a - 90 + side * 35), parent.h * 0.45));
        const h = parent.h * k.rng.range(0.6, 0.85);
        pads.push({ c: add(tip, mul(dir(a - 90), h * 0.42)), w: parent.w * (h / parent.h), h, a });
      }
      for (const p of pads) {
        const pts: Pt[] = [];
        for (let j = 0; j < 24; j++) {
          const th = (j / 24) * Math.PI * 2;
          pts.push(add(p.c, place([[Math.cos(th) * (p.h / 2), Math.sin(th) * (p.w / 2)]], [0, 0], p.a - 90)[0]));
        }
        shapes += smoothPath(pts, true);
        if (k.b('spines'))
          for (let s = 0; s < 6; s++) {
            const q = add(p.c, place([[k.rng.range(-0.35, 0.35) * p.h, k.rng.range(-0.3, 0.3) * p.w]], [0, 0], p.a - 90)[0]);
            spines += polyline([add(q, [-3, -3]), add(q, [3, 3])], false) + polyline([add(q, [3, -3]), add(q, [-3, 3])], false);
          }
        flowerSpots.push(add(p.c, mul(dir(p.a - 90), p.h / 2)));
      }
      flowerSpots.shift();
    } else {
      // Columnar: tronco redondeado arriba + brazos en L que suben.
      shapes += rect(-W / 2, -H, W, H, W / 2);
      const nr = k.i('ribs');
      for (let i = 1; i <= nr; i++) {
        const x = -W / 2 + (W * i) / (nr + 1);
        ribs += polyline([[x, -H + W * 0.35], [x, -6]], false);
        if (k.b('spines')) spineAlong(x, -H + W * 0.4, x, -10);
      }
      flowerSpots.push([0, -H]);
      for (let a = 0; a < k.i('arms'); a++) {
        const side = a % 2 === 0 ? 1 : -1;
        const y0 = -H * (0.3 + 0.35 * ((a * 0.37) % 1)) - k.rng.range(0, H * 0.1);
        const reach = W * k.rng.range(0.7, 1.1);
        const up = H * k.rng.range(0.22, 0.38);
        const aw = W * 0.72;
        const g = grow([side * W * 0.3, y0], side > 0 ? 0 : 180, reach + up, { bend: side * -90, steps: 24 });
        shapes += ribbon(g.points, () => aw, true);
        const end = g.points[g.points.length - 1];
        caps += circle(end[0], end[1], aw / 2);
        flowerSpots.push([end[0], end[1] - aw / 2]);
      }
    }
    const fl: string[] = [];
    for (let f = 0; f < Math.min(k.i('flowers'), flowerSpots.length + 3); f++) {
      const base = flowerSpots[f % flowerSpots.length];
      const p = add(base, [f >= flowerSpots.length ? k.rng.jitter(W * 0.3) : 0, 0]);
      let d = '';
      for (let i = 0; i < 6; i++) d += smoothPath(place(petalOutline(W * 0.28, W * 0.14, 'punta'), p, -90 + (i - 2.5) * 22), true);
      fl.push(d);
    }
    const potH = H * 0.28;
    const potW = (type === 'barrel' ? W * 2 : type === 'nopal' ? W * 1.6 : W * 1.5) * 1.15;
    const yBase = type === 'barrel' ? H / 2 - 4 : type === 'nopal' ? 0 : 0;
    return {
      kind: 'group',
      children: clean([
        k.group('Cactus', [
          caps && k.fill('Puntas de los brazos', caps, body, 'body'),
          k.fill('Cuerpo', shapes, body, 'body'),
          ribs && k.stroke('Costillas', ribs, ribColor, Math.max(1, k.outlineWidth()), 'ribs'),
          spines && k.stroke('Espinas', spines, '#f4efe0', 1, 'spines'),
          fl.length > 0 && k.fill('Flores', fl.join(''), k.s('flowerColor'), 'flowers'),
        ], 'body'),
        k.b('pot') &&
          k.group('Maceta', [
            k.fill('Maceta', polyline([[-potW / 2, yBase], [potW / 2, yBase], [potW * 0.38, yBase + potH], [-potW * 0.38, yBase + potH]], true), k.s('potColor'), 'pot'),
            k.fill('Borde', rect(-potW * 0.55, yBase - potH * 0.08, potW * 1.1, potH * 0.24, 3), shade(k.s('potColor'), 0.1), 'pot'),
          ], 'pot'),
      ]),
    };
  },
};

// ---------------------------------------------------------------------------

export const succulent: Generator = {
  id: 'bot.succulent',
  name: 'Suculenta',
  category: 'botanica',
  description: 'Roseta de hojas carnosas en capas (tipo echeveria), vista desde arriba o en ángulo.',
  keywords: ['suculenta', 'suculentas', 'echeveria', 'roseta', 'crasa'],
  params: [
    { key: 'leaves', label: 'Hojas por capa', group: 'Roseta', type: 'number', min: 3, max: 30, step: 1, default: 11 },
    { key: 'layers', label: 'Capas', group: 'Roseta', type: 'number', min: 1, max: 4, step: 1, default: 4 },
    { key: 'length', label: 'Largo de hoja', group: 'Roseta', type: 'number', min: 10, max: 250, step: 1, default: 95, unit: 'px' },
    { key: 'leafWidth', label: 'Ancho de hoja', group: 'Roseta', type: 'number', min: 4, max: 140, step: 1, default: 50, unit: 'px' },
    { key: 'shape', label: 'Forma de hoja', group: 'Roseta', type: 'select', options: [{ value: 'punta', label: 'En punta' }, { value: 'redondeada', label: 'Redondeada' }, { value: 'fina', label: 'Fina' }], default: 'punta' },
    { key: 'pitch', label: 'Ángulo de vista', group: 'Roseta', type: 'number', min: 0, max: 70, step: 1, default: 0, unit: '°' },
    { key: 'cup', label: 'Cierre hacia el centro', group: 'Roseta', type: 'number', min: -20, max: 70, step: 1, default: 18, unit: '°' },
    ...colors({ leafColor: ['Hojas', '#7fa58f'], tipColor: ['Centro', '#a8c7a5'] }),
    ...outlineParams(),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const head = flowerHead(
      {
        yaw: 0,
        pitch: -k.n('pitch'),
        petals: k.i('leaves'),
        petalLength: k.n('length'),
        petalWidth: k.n('leafWidth'),
        petalShape: k.s('shape') as 'punta',
        cup: k.n('cup'),
        layers: k.i('layers'),
        disorder: 0.15,
        centerRadius: k.n('length') * 0.12,
        centerOffset: [0, 0],
        depth: 4,
        seeds: false,
        bracts: false,
      },
      ctx.rng,
    );
    const leaves = head.parts.filter((p) => p.kind === 'petal');
    const base = k.s('leafColor');
    return {
      kind: 'group',
      children: [
        ...leaves.map((p, i) => k.fill(`Hoja ${i + 1}`, p.d, shade(base, 0.25 * (i / leaves.length) - 0.08), 'leaf')),
        k.fill('Centro', circle(0, 0, k.n('length') * 0.14), k.s('tipColor'), 'center'),
      ],
    };
  },
};

// ---------------------------------------------------------------------------

type FruitDef = { color: string; h: number; w: (t: number) => number; leaf?: boolean; stem?: boolean; extra?: string };
const FRUITS: Record<string, FruitDef & { label: string }> = {
  apple: { label: 'Manzana', color: '#c8323a', h: 1, w: (t) => 1.1 * Math.sin(Math.PI * Math.min(1, 0.08 + t * 0.9)) ** 0.55 * (1 - 0.15 * Math.max(0, t - 0.75) * 4), leaf: true, stem: true },
  pear: { label: 'Pera', color: '#b7c24a', h: 1.35, w: (t) => (0.45 + 0.6 * t ** 1.4) * Math.sin(Math.PI * Math.min(1, 0.05 + t * 0.95)) ** 0.45, leaf: true, stem: true },
  orange: { label: 'Naranja', color: '#ef8f22', h: 1, w: (t) => Math.sin(Math.PI * t) ** 0.5, leaf: true, extra: 'dots' },
  lemon: { label: 'Limón', color: '#f1d332', h: 1.35, w: (t) => 0.82 * Math.sin(Math.PI * t) ** 0.75 },
  strawberry: { label: 'Frutilla', color: '#d6303b', h: 1.15, w: (t) => 1 * Math.sin(Math.PI * Math.min(1, 0.25 + t * 0.75)) ** 0.7 * (1 - 0.6 * t ** 2), extra: 'seeds' },
  cherry: { label: 'Cerezas', color: '#a3162a', h: 0.5, w: (t) => 0.5 * Math.sin(Math.PI * t) ** 0.5, extra: 'pair' },
  grapes: { label: 'Uvas', color: '#6a3a7a', h: 1.4, w: () => 0, extra: 'grapes' },
  tomato: { label: 'Tomate', color: '#d8402c', h: 0.85, w: (t) => 1.1 * Math.sin(Math.PI * t) ** 0.45, extra: 'calyx' },
  carrot: { label: 'Zanahoria', color: '#e67a24', h: 1.8, w: (t) => 0.42 * (1 - t) ** 0.8 * Math.min(1, t * 12 + 0.6), extra: 'greens' },
  eggplant: { label: 'Berenjena', color: '#4b2a5c', h: 1.6, w: (t) => (0.3 + 0.45 * t ** 1.2) * Math.sin(Math.PI * Math.min(1, 0.04 + t * 0.96)) ** 0.5 * 1.2, extra: 'calyx' },
};

export const fruit: Generator = {
  id: 'bot.fruit',
  name: 'Fruta o verdura',
  category: 'botanica',
  also: ['agro'],
  description: 'Manzana, pera, naranja, limón, frutilla, cerezas, uvas, tomate, zanahoria o berenjena, con hojita, cabo y brillo.',
  keywords: ['fruta', 'frutas', 'verdura', 'verduras', 'manzana', 'pera', 'naranja', 'limón', 'limon', 'frutilla', 'fresa', 'cereza', 'cerezas', 'uva', 'uvas', 'tomate', 'zanahoria', 'berenjena', 'fruit', 'vegetable'],
  params: [
    { key: 'type', label: 'Tipo', group: 'Fruta', type: 'select', options: Object.entries(FRUITS).map(([value, f]) => ({ value, label: f.label })), default: 'apple' },
    { key: 'size', label: 'Tamaño', group: 'Fruta', type: 'number', min: 20, max: 500, step: 1, default: 180, unit: 'px' },
    { key: 'leaf', label: 'Hojita / cabo', group: 'Fruta', type: 'boolean', default: true },
    { key: 'shine', label: 'Brillo', group: 'Fruta', type: 'boolean', default: true },
    { key: 'customColor', label: 'Usar mi color', group: 'Colores', type: 'boolean', default: false },
    { key: 'color', label: 'Color propio', group: 'Colores', type: 'color', default: '#c8323a' },
    ...colors({ leafColor: ['Hojas', '#5b8a3c'], stemColor: ['Cabo', '#6b4a2d'] }),
    ...outlineParams(),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const f = FRUITS[k.s('type')] ?? FRUITS.apple;
    const S = k.n('size');
    const color = k.b('customColor') ? k.s('color') : f.color;
    const H = S * f.h;
    const parts: (SceneNode | null | false)[] = [];
    const leafNode = (p: Pt, a: number, len: number) => {
      const g = leafGeometry({ length: len, width: len * 0.5, profile: leafProfile('ovalada'), curl: 0.15, veins: 0 });
      return k.fill('Hoja', smoothPath(place(g.outline, p, a), true), k.s('leafColor'), 'leaf');
    };
    const shine = (cx: number, cy: number, rx: number, ry: number) => k.b('shine') && k.flat('Brillo', ellipse(cx, cy, rx, ry), shade(color, 0.45), 'shine');
    if (f.extra === 'grapes') {
      const r = S * 0.13;
      let d = '';
      const rows = [4, 4, 3, 3, 2, 1];
      rows.forEach((cnt, row) => {
        for (let i = 0; i < cnt; i++) d += circle((i - (cnt - 1) / 2) * r * 1.75 + k.rng.jitter(r * 0.1), -S * 0.3 + row * r * 1.55, r);
      });
      parts.push(k.fill('Uvas', d, color, 'fruit'));
      if (k.b('leaf')) parts.push(k.stroke('Cabo', polyline([[0, -S * 0.3 - r], [S * 0.05, -S * 0.55]], false), k.s('stemColor'), Math.max(2, S * 0.025), 'stem'), leafNode([S * 0.04, -S * 0.5], -30, S * 0.4));
    } else if (f.extra === 'pair') {
      for (const s of [-1, 1]) {
        const cx = s * S * 0.2;
        const cy = S * 0.15;
        parts.push(k.stroke('Cabo', smoothPath([[cx, cy - S * 0.2], [s * S * 0.08, -S * 0.2], [0, -S * 0.45]], false), k.s('stemColor'), Math.max(1.5, S * 0.02), 'stem'));
        parts.push(k.fill('Cereza', profileShape(S * 0.42, (t) => S * 0.46 * Math.sin(Math.PI * t) ** 0.5 * (1 - 0.12 * Math.exp(-(((t - 0.05) / 0.08) ** 2)))), color, 'fruit'));
        k.at(parts[parts.length - 1] as SceneNode, cx, cy);
        parts.push(shine(cx - S * 0.08, cy - S * 0.05, S * 0.04, S * 0.06));
      }
      if (k.b('leaf')) parts.push(leafNode([0, -S * 0.45], -20, S * 0.35));
    } else {
      parts.push(k.fill('Fruta', profileShape(H, (t) => S * f.w(t)), color, 'fruit'));
      if (f.extra === 'seeds') {
        let d = '';
        for (let i = 0; i < 26; i++) {
          const t = 0.15 + 0.75 * k.rng.next();
          const w = S * f.w(t) * 0.38;
          d += ellipse(k.rng.jitter(w), -H / 2 + H * t, S * 0.012, S * 0.02);
        }
        parts.push(k.flat('Semillitas', d, '#f3d46a', 'seeds'));
      }
      if (f.extra === 'dots') {
        let d = '';
        for (let i = 0; i < 40; i++) {
          const t = 0.1 + 0.8 * k.rng.next();
          d += circle(k.rng.jitter(S * f.w(t) * 0.42), -H / 2 + H * t, S * 0.008);
        }
        parts.push(k.flat('Poros', d, shade(color, -0.15), 'texture'));
      }
      parts.push(shine(-S * 0.18, -H * 0.15, S * 0.06, S * 0.11));
      const top: Pt = [0, -H / 2];
      if (f.extra === 'greens') {
        let d = '';
        for (let i = -2; i <= 2; i++) {
          const g = grow(top, -90 + i * 16, S * 0.6 * (1 - Math.abs(i) * 0.12), { bend: i * 10, steps: 12 });
          d += ribbon(g.points, (t) => S * 0.05 * (1 - t) + 1);
        }
        parts.push(k.fill('Hojas', d, k.s('leafColor'), 'leaves'));
        let lines = '';
        for (let i = 0; i < 6; i++) {
          const y = -H / 2 + H * (0.15 + i * 0.12);
          const w = S * f.w((y + H / 2) / H) * 0.3;
          lines += polyline([[-w, y], [w * 0.2, y + 3]], false);
        }
        parts.push(k.stroke('Marcas', lines, shade(color, -0.3), Math.max(1, S * 0.008), 'texture'));
      } else if (f.extra === 'calyx' || f.extra === 'seeds') {
        let d = '';
        const n = f.extra === 'seeds' ? 7 : 5;
        for (let i = 0; i < n; i++) d += smoothPath(place(petalOutline(S * 0.2, S * 0.08, 'punta'), add(top, [0, S * 0.03]), -180 + (180 / (n - 1)) * i), true); // abanico hacia arriba
        parts.push(k.fill('Cáliz', d, k.s('leafColor'), 'calyx'));
        parts.push(k.stroke('Cabo', polyline([top, add(top, [S * 0.02, -S * 0.1])], false), k.s('leafColor'), Math.max(2, S * 0.03), 'stem'));
      } else if (k.b('leaf')) {
        if (f.stem !== false) parts.push(k.stroke('Cabo', smoothPath([add(top, [0, S * 0.05]), add(top, [S * 0.02, -S * 0.08]), add(top, [S * 0.06, -S * 0.16])], false), k.s('stemColor'), Math.max(2, S * 0.03), 'stem'));
        if (f.leaf) parts.push(leafNode(add(top, [S * 0.03, -S * 0.1]), -35, S * 0.32));
      }
    }
    return { kind: 'group', children: clean(parts) };
  },
};

// ---------------------------------------------------------------------------

const SEEDS: Record<string, string> = {
  sunflower: 'Pipa de girasol',
  corn: 'Grano de maíz',
  bean: 'Poroto',
  almond: 'Almendra',
  wheat: 'Grano de trigo',
  generic: 'Semilla simple',
};

export const seeds: Generator = {
  id: 'bot.seeds',
  name: 'Semillas y granos',
  category: 'agro',
  also: ['botanica'],
  description: 'Pipas de girasol, granos de maíz y trigo, porotos o almendras: sueltos, en fila, en grilla o desparramados.',
  keywords: ['semilla', 'semillas', 'grano', 'granos', 'pipa', 'pipas', 'poroto', 'porotos', 'almendra', 'seed', 'seeds', 'confitero'],
  params: [
    { key: 'type', label: 'Tipo', group: 'Semillas', type: 'select', options: Object.entries(SEEDS).map(([value, label]) => ({ value, label })), default: 'sunflower' },
    { key: 'count', label: 'Cantidad', group: 'Semillas', type: 'number', min: 1, max: 80, step: 1, default: 9 },
    { key: 'size', label: 'Tamaño', group: 'Semillas', type: 'number', min: 6, max: 300, step: 1, default: 70, unit: 'px' },
    { key: 'layout', label: 'Distribución', group: 'Semillas', type: 'select', options: [{ value: 'scatter', label: 'Desparramadas' }, { value: 'row', label: 'En fila' }, { value: 'grid', label: 'En grilla' }, { value: 'radial', label: 'En ronda' }], default: 'scatter' },
    { key: 'rotation', label: 'Variación de giro', group: 'Semillas', type: 'number', min: 0, max: 180, step: 1, default: 60, unit: '°' },
    { key: 'details', label: 'Rayas y detalles', group: 'Semillas', type: 'boolean', default: true },
    { key: 'customColor', label: 'Usar mi color', group: 'Colores', type: 'boolean', default: false },
    { key: 'color', label: 'Color propio', group: 'Colores', type: 'color', default: '#3a3530' },
    ...outlineParams(),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const S = k.n('size');
    const type = k.s('type');
    const base: Record<string, string> = { sunflower: '#3a3530', corn: '#eab53a', bean: '#c9a27a', almond: '#b07a4a', wheat: '#d2a356', generic: '#8a6a45' };
    const color = k.b('customColor') ? k.s('color') : base[type];
    const one = (): { body: string; detail: string; detailColor: string } => {
      if (type === 'sunflower') {
        const body = profileShape(S, (t) => S * 0.5 * Math.sin(Math.PI * Math.min(1, 0.04 + t * 0.96)) ** 0.7 * (0.35 + 0.65 * t));
        let detail = '';
        for (const x of [-0.14, 0, 0.14]) detail += smoothPath([[x * S * 0.5, -S * 0.42], [x * S * 1.1, 0], [x * S * 1.4, S * 0.42]], false);
        return { body, detail, detailColor: '#e9e2d0' };
      }
      if (type === 'corn') {
        const body = profileShape(S, (t) => S * 0.8 * (0.45 + 0.55 * (1 - t) ** 0.6) * Math.sin(Math.PI * Math.min(1, 0.05 + t * 0.95)) ** 0.35);
        return { body, detail: ellipse(0, S * 0.18, S * 0.12, S * 0.2), detailColor: '#f6e2a6' };
      }
      if (type === 'bean') {
        const pts: Pt[] = [];
        for (let i = 0; i < 32; i++) {
          const a = (i / 32) * Math.PI * 2;
          const dent = Math.exp(-(((a - Math.PI / 2) / 0.4) ** 2)) * 0.25;
          pts.push([Math.cos(a) * S * 0.55, Math.sin(a) * S * 0.33 * (1 - dent * 1.6)]);
        }
        return { body: smoothPath(pts, true), detail: ellipse(0, S * 0.16, S * 0.07, S * 0.03), detailColor: '#f1ead9' };
      }
      if (type === 'almond') {
        const body = profileShape(S, (t) => S * 0.62 * Math.sin(Math.PI * Math.min(1, 0.02 + t * 0.98)) ** 0.85 * (0.5 + 0.5 * t));
        let detail = '';
        for (let i = 0; i < 6; i++) detail += smoothPath([[k.rng.jitter(S * 0.15), -S * 0.3 + i * S * 0.12], [k.rng.jitter(S * 0.15), -S * 0.25 + i * S * 0.12]], false);
        return { body, detail, detailColor: shade(color, -0.25) };
      }
      if (type === 'wheat') {
        const body = profileShape(S, (t) => S * 0.5 * Math.sin(Math.PI * t) ** 0.7);
        return { body, detail: smoothPath([[0, -S * 0.4], [S * 0.03, 0], [0, S * 0.4]], false), detailColor: shade(color, -0.3) };
      }
      return { body: profileShape(S, (t) => S * 0.55 * Math.sin(Math.PI * t) ** 0.6 * (0.6 + 0.4 * t)), detail: '', detailColor: color };
    };
    const n = k.i('count');
    const cols = Math.ceil(Math.sqrt(n));
    const out: SceneNode[] = [];
    for (let i = 0; i < n; i++) {
      let x = 0;
      let y = 0;
      let rot = k.rng.jitter(k.n('rotation'));
      const layout = k.s('layout');
      if (layout === 'row') x = (i - (n - 1) / 2) * S * 0.85;
      else if (layout === 'grid') {
        x = ((i % cols) - (cols - 1) / 2) * S * 0.85;
        y = (Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2) * S * 1.2;
      } else if (layout === 'radial') {
        const a = (i / n) * 360;
        [x, y] = mul(dir(a - 90), n === 1 ? 0 : S * (0.35 + n * 0.09));
        rot = a + k.rng.jitter(k.n('rotation') * 0.2);
      } else {
        const rr = S * 0.6 * Math.sqrt(i) * 1.1;
        const a = i * 137.5;
        [x, y] = mul(dir(a), rr);
        x += k.rng.jitter(S * 0.2);
        y += k.rng.jitter(S * 0.2);
      }
      const s = one();
      out.push(k.at(k.group(`Semilla ${i + 1}`, [k.fill('Cuerpo', s.body, color, 'seed'), k.b('details') && s.detail && k.stroke('Detalle', s.detail, s.detailColor, Math.max(1, S * 0.03), 'detail')], 'seed'), x, y, rot));
    }
    return { kind: 'group', children: out };
  },
};

// ---------------------------------------------------------------------------

export const grass: Generator = {
  id: 'bot.grass',
  name: 'Pasto y hierbas',
  category: 'botanica',
  also: ['agro', 'paisaje'],
  description: 'Mata de pasto o hierbas, con hojas finas que se curvan y espigas o flores chiquitas opcionales.',
  keywords: ['pasto', 'césped', 'cesped', 'hierba', 'hierbas', 'yuyo', 'grass', 'mata', 'matorral'],
  params: [
    { key: 'blades', label: 'Hojas', group: 'Mata', type: 'number', min: 1, max: 80, step: 1, default: 22 },
    { key: 'height', label: 'Alto', group: 'Mata', type: 'number', min: 10, max: 600, step: 1, default: 190, unit: 'px' },
    { key: 'spread', label: 'Apertura', group: 'Mata', type: 'number', min: 0, max: 160, step: 1, default: 70, unit: '°' },
    { key: 'width', label: 'Ancho de hoja', group: 'Mata', type: 'number', min: 1, max: 30, step: 0.5, default: 7, unit: 'px' },
    { key: 'curve', label: 'Curvatura', group: 'Mata', type: 'number', min: 0, max: 1.5, step: 0.01, default: 0.6 },
    { key: 'base', label: 'Ancho de la base', group: 'Mata', type: 'number', min: 0, max: 200, step: 1, default: 24, unit: 'px' },
    { key: 'heads', label: 'Espigas / flores', group: 'Mata', type: 'select', options: [{ value: 'none', label: 'Ninguna' }, { value: 'spike', label: 'Espiguitas' }, { value: 'flower', label: 'Florcitas' }], default: 'none' },
    { key: 'headCount', label: 'Cantidad de espigas', group: 'Mata', type: 'number', min: 0, max: 20, step: 1, default: 4 },
    ...colors({ grassColor: ['Pasto', '#5f9a48'], headColor: ['Espigas / flores', '#d9b54a'] }),
    ...outlineParams(0.8),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const n = k.i('blades');
    let back = '';
    let front = '';
    for (let i = 0; i < n; i++) {
      const rel = n === 1 ? 0 : i / (n - 1) - 0.5;
      const a = -90 + rel * k.n('spread') * 2 + k.rng.jitter(8);
      const len = k.n('height') * (1 - Math.abs(rel) * 0.5) * (0.75 + k.rng.next() * 0.4);
      const bend = Math.sign(rel || k.rng.jitter(1)) * k.n('curve') * 70 * (0.6 + k.rng.next() * 0.6);
      const g = grow([rel * k.n('base') * 2, 0], a, len, { bend, steps: 16 });
      const d = ribbon(g.points, taper(k.n('width'), 0.2, 0.9));
      if (i % 2 === 0) back += d;
      else front += d;
    }
    let heads = '';
    let stalks = '';
    if (k.s('heads') !== 'none')
      for (let h = 0; h < k.i('headCount'); h++) {
        const a = -90 + k.rng.jitter(k.n('spread') * 0.7);
        const g = grow([k.rng.jitter(k.n('base')), 0], a, k.n('height') * k.rng.range(0.9, 1.25), { bend: k.rng.jitter(30), steps: 14 });
        stalks += smoothPath(g.points, false);
        const tip = sampleAt(g, 1);
        if (k.s('heads') === 'spike') {
          for (let j = 0; j < 7; j++) {
            const at = sampleAt(g, 0.82 + j * 0.025);
            for (const s of [-1, 1]) {
              const geo = leafGeometry({ length: 9, width: 4.5, profile: leafProfile('ovalada') });
              heads += smoothPath(place(geo.outline, at.p, at.heading + s * 30), true);
            }
          }
        } else {
          for (let p = 0; p < 5; p++) heads += smoothPath(place(petalOutline(8, 6, 'redondeada'), tip.p, p * 72), true);
        }
      }
    const shadeC = shade(k.s('grassColor'), -0.18);
    return {
      kind: 'group',
      children: clean([
        k.fill('Hojas de atrás', back, shadeC, 'blades'),
        stalks && k.stroke('Tallitos', stalks, shadeC, 1.4, 'stems'),
        k.fill('Hojas de adelante', front, k.s('grassColor'), 'blades'),
        heads && k.fill('Espigas', heads, k.s('headColor'), 'heads', 0.7),
      ]),
    };
  },
};

// ---------------------------------------------------------------------------

export const vine: Generator = {
  id: 'bot.vine',
  name: 'Enredadera',
  category: 'botanica',
  description: 'Tallo que serpentea con hojas acorazonadas alternas y zarcillos en espiral.',
  keywords: ['enredadera', 'enredaderas', 'hiedra', 'parra', 'vid', 'vine', 'trepadora', 'zarcillo'],
  params: [
    { key: 'length', label: 'Largo', group: 'Enredadera', type: 'number', min: 50, max: 1400, step: 1, default: 600, unit: 'px' },
    { key: 'direction', label: 'Dirección', group: 'Enredadera', type: 'number', min: -180, max: 180, step: 1, default: 0, unit: '°' },
    { key: 'waves', label: 'Ondas', group: 'Enredadera', type: 'number', min: 0, max: 10, step: 0.1, default: 2.5 },
    { key: 'amplitude', label: 'Amplitud', group: 'Enredadera', type: 'number', min: 0, max: 200, step: 1, default: 45, unit: 'px' },
    { key: 'leaves', label: 'Hojas', group: 'Enredadera', type: 'number', min: 0, max: 40, step: 1, default: 11 },
    { key: 'leafSize', label: 'Tamaño de hoja', group: 'Enredadera', type: 'number', min: 5, max: 200, step: 1, default: 52, unit: 'px' },
    { key: 'tendrils', label: 'Zarcillos', group: 'Enredadera', type: 'number', min: 0, max: 20, step: 1, default: 5 },
    { key: 'width', label: 'Grosor del tallo', group: 'Enredadera', type: 'number', min: 0.5, max: 16, step: 0.5, default: 3.5, unit: 'px' },
    ...colors({ leafColor: ['Hojas', '#4f8a44'], stemColor: ['Tallo', '#5d6b34'] }),
    ...outlineParams(),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const L = k.n('length');
    const ang = k.n('direction');
    const pts: Pt[] = [];
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const local: Pt = [-L / 2 + L * t, Math.sin(t * Math.PI * 2 * k.n('waves')) * k.n('amplitude')];
      pts.push(place([local], [0, 0], ang)[0]);
    }
    const headings = pts.map((_, i) => {
      const q = pts[Math.min(pts.length - 1, i + 1)];
      const o = pts[Math.max(0, i - 1)];
      return (Math.atan2(q[1] - o[1], q[0] - o[0]) * 180) / Math.PI;
    });
    const g = { points: pts, headings };
    let leaves = '';
    let petioles = '';
    for (let i = 0; i < k.i('leaves'); i++) {
      const at = sampleAt(g, (i + 0.5) / k.i('leaves'));
      const side = i % 2 === 0 ? 1 : -1;
      const size = k.n('leafSize') * (0.8 + k.rng.next() * 0.35);
      const base = add(at.p, mul(dir(at.heading + side * 60), size * 0.25));
      petioles += polyline([at.p, base], false);
      const geo = leafGeometry({ length: size, width: size * 0.85, profile: leafProfile('ancha'), curl: side * 0.1, veins: 0 });
      leaves += smoothPath(place(geo.outline, base, at.heading + side * 55), true);
    }
    let tendrils = '';
    for (let i = 0; i < k.i('tendrils'); i++) {
      const at = sampleAt(g, k.rng.range(0.05, 0.95));
      const side = k.rng.next() < 0.5 ? -1 : 1;
      const sp: Pt[] = [];
      const R = k.n('leafSize') * 0.35;
      for (let j = 0; j <= 40; j++) {
        const t = j / 40;
        const a = at.heading + side * (40 + t * 600);
        sp.push(add(add(at.p, mul(dir(at.heading + side * 40), R * 1.2 * Math.min(1, t * 4))), mul(dir(a), R * (1 - t) * Math.min(1, t * 3))));
      }
      tendrils += smoothPath(sp, false);
    }
    const w = k.n('width');
    return {
      kind: 'group',
      children: clean([
        k.fill('Tallo', ribbon(pts, taper(w, w * 0.4)), k.s('stemColor'), 'stem'),
        tendrils && k.stroke('Zarcillos', tendrils, k.s('stemColor'), Math.max(0.8, w * 0.35), 'tendrils'),
        k.stroke('Cabitos', petioles, k.s('stemColor'), Math.max(0.8, w * 0.5), 'stem'),
        leaves && k.fill('Hojas', leaves, k.s('leafColor'), 'leaves'),
      ]),
    };
  },
};

export const botanicalExtraGenerators: Generator[] = [rose, mushroom, cactus, succulent, fruit, seeds, grass, vine];
