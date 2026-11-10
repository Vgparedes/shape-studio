// Animales y seres vivos (Etapa 5): ave, mariposa, insectos, pez, cuadrúpedo y lagartija.
// Las figuras de perfil miran a la derecha o a la izquierda según el parámetro "Mira hacia".
import type { Generator, ParamDef } from './types';
import type { SceneNode } from '../../core/types';
import type { Pt } from '../geometry/path';
import { polyline, smoothPath } from '../geometry/path';
import { ribbon, ribbonOutline } from '../geometry/ribbon';
import { add, dir, mul, place, rotate } from '../geometry/vec';
import { shade } from '../../core/color';
import { silhouette } from './build';
import { circle, clean, clockwise, colors, kit, outlineParams } from './kit';

const facingParam = (group: string): ParamDef => ({ key: 'facing', label: 'Mira hacia', group, type: 'select', options: [{ value: 'right', label: 'La derecha' }, { value: 'left', label: 'La izquierda' }], default: 'right' });

/** Elipse como lista de puntos (para poder espejarla, rotarla o deformarla). */
function ellipsePts(cx: number, cy: number, rx: number, ry: number, rot = 0, n = 28): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return add([cx, cy], rotate([Math.cos(a) * rx, Math.sin(a) * ry], rot));
  });
}

/** Espeja horizontalmente si mira a la izquierda. */
const flipper = (left: boolean) => (pts: Pt[]): Pt[] => (left ? pts.map(([x, y]) => [-x, y] as Pt) : pts);

// ---------------------------------------------------------------------------

export const bird: Generator = {
  id: 'ani.bird',
  name: 'Ave',
  category: 'animales',
  description: 'Pájaro de perfil, posado en una rama o volando, con pico, cola y alas ajustables.',
  keywords: ['ave', 'aves', 'pájaro', 'pajaro', 'pájaros', 'pajaros', 'bird', 'birds', 'gorrión', 'paloma', 'golondrina'],
  params: [
    { key: 'pose', label: 'Pose', group: 'Ave', type: 'select', options: [{ value: 'perched', label: 'Posada' }, { value: 'flying', label: 'Volando' }], default: 'perched' },
    facingParam('Ave'),
    { key: 'size', label: 'Tamaño', group: 'Ave', type: 'number', min: 20, max: 600, step: 1, default: 200, unit: 'px' },
    { key: 'plump', label: 'Rechoncha', group: 'Ave', type: 'number', min: 0.4, max: 1.2, step: 0.01, default: 0.75 },
    { key: 'beak', label: 'Largo del pico', group: 'Ave', type: 'number', min: 0.05, max: 0.6, step: 0.01, default: 0.16 },
    { key: 'tail', label: 'Largo de la cola', group: 'Ave', type: 'number', min: 0, max: 1, step: 0.01, default: 0.4 },
    { key: 'tailType', label: 'Cola', group: 'Ave', type: 'select', options: [{ value: 'pointed', label: 'En punta' }, { value: 'fan', label: 'Abanico' }, { value: 'forked', label: 'Bifurcada' }], default: 'pointed' },
    { key: 'wingUp', label: 'Alas levantadas (volando)', group: 'Ave', type: 'number', min: -1, max: 1, step: 0.01, default: 0.6 },
    { key: 'branch', label: 'Rama (posada)', group: 'Ave', type: 'boolean', default: true },
    ...colors({ bodyColor: ['Cuerpo', '#4f7fa8'], bellyColor: ['Pecho', '#f0d9b5'], wingColor: ['Alas', '#35597a'], beakColor: ['Pico y patas', '#e8a33a'], branchColor: ['Rama', '#6b5136'] }),
    ...outlineParams(),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const S = k.n('size');
    const F = flipper(k.s('facing') === 'left');
    const flying = k.s('pose') === 'flying';
    const bodyRx = S * 0.36;
    const bodyRy = S * 0.36 * k.n('plump') * 0.62;
    const tilt = flying ? 0 : -18;
    const head: Pt = rotate([bodyRx * 0.85, -bodyRy * 0.75], tilt);
    const headR = S * 0.13;
    const sm = (pts: Pt[]) => smoothPath(F(pts), true, 0.9);
    const body = sm(ellipsePts(0, 0, bodyRx, bodyRy, tilt));
    const belly = sm(ellipsePts(bodyRx * 0.1, bodyRy * 0.35, bodyRx * 0.7, bodyRy * 0.55, tilt));
    const beakL = S * k.n('beak');
    const beak = polyline(F([add(head, [headR * 0.8, -headR * 0.3]), add(head, [headR * 0.8 + beakL, headR * 0.05]), add(head, [headR * 0.75, headR * 0.3])]), true);
    // Cola: sale de atrás del cuerpo.
    const tailBase = rotate([-bodyRx * 0.85, -bodyRy * 0.1], tilt);
    const TL = S * k.n('tail');
    const tailAng = flying ? 180 : 152; // posada: la cola cae hacia atrás y abajo
    let tail = '';
    if (TL > 1) {
      const tt = k.s('tailType');
      const spread = tt === 'fan' ? 26 : tt === 'forked' ? 18 : 8;
      const tip = (a: number, l: number) => add(tailBase, mul(dir(a), l));
      if (tt === 'forked') tail = polyline(F([add(tailBase, [0, -bodyRy * 0.25]), tip(tailAng - spread, TL), tip(tailAng, TL * 0.55), tip(tailAng + spread, TL), add(tailBase, [0, bodyRy * 0.25])]), true);
      else tail = smoothPath(F([add(tailBase, [0, -bodyRy * 0.3]), tip(tailAng - spread, TL), tip(tailAng, TL * (tt === 'fan' ? 1.05 : 1.1)), tip(tailAng + spread, TL), add(tailBase, [0, bodyRy * 0.3])]), true, tt === 'fan' ? 0.8 : 0.3);
    }
    // Ala: hoja alargada sobre el cuerpo; volando, se levanta.
    const wingLen = S * (flying ? 0.62 : 0.45);
    const wingAng = flying ? 200 - k.n('wingUp') * 60 : 190 - tilt;
    const wingBase = rotate([bodyRx * 0.25, -bodyRy * 0.2], tilt);
    const wingPts: Pt[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      wingPts.push([wingLen * t, -S * 0.11 * Math.sin(Math.PI * Math.min(1, t * 1.1)) ** 0.7 * (1 - t * 0.4)]);
    }
    for (let i = 20; i >= 0; i--) {
      const t = i / 20;
      wingPts.push([wingLen * t, S * 0.05 * Math.sin(Math.PI * t) ** 1.2]);
    }
    const wing = smoothPath(F(place(wingPts, wingBase, wingAng)), true, 0.9);
    let farWing = '';
    if (flying) farWing = smoothPath(F(place(wingPts, add(wingBase, [-S * 0.05, -S * 0.02]), wingAng + 22)), true, 0.9);
    // Rayas de plumas en el ala.
    let feathers = '';
    for (let f = 1; f <= 3; f++) feathers += smoothPath(F(place([[wingLen * (0.45 + f * 0.13), -S * 0.02], [wingLen * (0.62 + f * 0.12), S * 0.015]], wingBase, wingAng)), false);
    let legs = '';
    let branchD = '';
    if (!flying) {
      for (const lx of [-0.05, 0.12]) {
        const top = rotate([bodyRx * lx, bodyRy * 0.9], tilt);
        const foot = add(top, [S * 0.02, S * 0.17]);
        legs += polyline(F([top, foot, add(foot, [S * 0.07, 0])]), false) + polyline(F([foot, add(foot, [-S * 0.05, S * 0.01])]), false);
      }
      if (k.b('branch')) {
        const y = rotate([0, bodyRy * 0.9], tilt)[1] + S * 0.17 + S * 0.025;
        const pts: Pt[] = [];
        for (let i = 0; i <= 20; i++) pts.push([-S * 0.75 + S * 1.5 * (i / 20), y + Math.sin(i * 0.4) * S * 0.01]);
        branchD = ribbon(F(pts), (t) => S * 0.05 * (1 - t * 0.5));
      }
    }
    const eye = F([add(head, [headR * 0.35, -headR * 0.15])])[0];
    const hc = F([head])[0];
    return {
      kind: 'group',
      children: clean([
        branchD && k.fill('Rama', branchD, k.s('branchColor'), 'branch'),
        farWing && k.fill('Ala de atrás', farWing, shade(k.s('wingColor'), -0.15), 'wing'),
        tail && k.fill('Cola', tail, k.s('wingColor'), 'tail'),
        legs && k.stroke('Patas', legs, k.s('beakColor'), Math.max(1.5, S * 0.018), 'legs'),
        k.fill('Cuerpo', body, k.s('bodyColor'), 'body'),
        k.flat('Pecho', belly, k.s('bellyColor'), 'belly'),
        k.fill('Pico', beak, k.s('beakColor'), 'beak'),
        k.fill('Cabeza', circle(hc[0], hc[1], headR), k.s('bodyColor'), 'head'),
        k.flat('Ojo', circle(eye[0], eye[1], headR * 0.18), '#1d1a16', 'eye'),
        k.fill('Ala', wing, k.s('wingColor'), 'wing'),
        k.stroke('Plumas', feathers, shade(k.s('wingColor'), -0.3), Math.max(1, S * 0.008), 'feathers'),
      ]),
    };
  },
};

// ---------------------------------------------------------------------------

export const butterfly: Generator = {
  id: 'ani.butterfly',
  name: 'Mariposa',
  category: 'animales',
  description: 'Mariposa simétrica vista de frente, con alas abiertas o semicerradas, manchas, nervaduras y colas opcionales.',
  keywords: ['mariposa', 'mariposas', 'polilla', 'butterfly', 'moth'],
  params: [
    { key: 'span', label: 'Envergadura', group: 'Mariposa', type: 'number', min: 30, max: 900, step: 1, default: 320, unit: 'px' },
    { key: 'open', label: 'Apertura de alas', group: 'Mariposa', type: 'number', min: 0.2, max: 1, step: 0.01, default: 1 },
    { key: 'upper', label: 'Alas de arriba (redondez)', group: 'Mariposa', type: 'number', min: 0, max: 1, step: 0.01, default: 0.55 },
    { key: 'lowerSize', label: 'Tamaño de alas de abajo', group: 'Mariposa', type: 'number', min: 0.3, max: 1.2, step: 0.01, default: 0.7 },
    { key: 'tails', label: 'Colitas en las alas de abajo', group: 'Mariposa', type: 'boolean', default: false },
    { key: 'spots', label: 'Manchas por ala', group: 'Mariposa', type: 'number', min: 0, max: 8, step: 1, default: 3 },
    { key: 'veins', label: 'Nervaduras', group: 'Mariposa', type: 'boolean', default: true },
    ...colors({ wingColor: ['Alas', '#e58a2e'], edgeColor: ['Borde y nervaduras', '#2b2620'], spotColor: ['Manchas', '#fbf3e0'], bodyColor: ['Cuerpo', '#2b2620'] }),
    ...outlineParams(1.2),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const S = k.n('span') / 2;
    const open = k.n('open');
    const squash = (pts: Pt[]) => pts.map(([x, y]) => [x * open, y] as Pt);
    const upperWing = (side: number): Pt[] => {
      const r = k.n('upper');
      const pts: Pt[] = [];
      for (let i = 0; i <= 30; i++) {
        const a = -100 + (i / 30) * 130; // de arriba hacia el costado
        const rr = S * (0.55 + 0.45 * Math.sin(((i / 30) * Math.PI) ** 1) ** (1 - r * 0.7)) * (1 - 0.15 * (i / 30));
        pts.push(mul(dir(a), rr));
      }
      pts.push([S * 0.05, S * 0.05]);
      pts.push([S * 0.03, -S * 0.02]);
      return squash(pts.map(([x, y]) => [side * x, y]));
    };
    const lowerWing = (side: number): Pt[] => {
      const L = k.n('lowerSize');
      const pts: Pt[] = [[S * 0.03, S * 0.02]];
      for (let i = 0; i <= 24; i++) {
        const a = 15 + (i / 24) * 85;
        let rr = S * L * (0.55 + 0.35 * Math.sin((i / 24) * Math.PI));
        if (k.b('tails') && i > 17 && i < 22) rr *= 1 + (1 - Math.abs(i - 19.5) / 2.5) * 0.45;
        pts.push(mul(dir(a), rr));
      }
      pts.push([S * 0.02, S * 0.15]);
      return squash(pts.map(([x, y]) => [side * x, y]));
    };
    const wings: string[] = [];
    let spots = '';
    let veins = '';
    for (const side of [-1, 1]) {
      wings.push(smoothPath(upperWing(side), true, 0.8), smoothPath(lowerWing(side), true, 0.8));
      for (let s = 0; s < k.i('spots'); s++) {
        const a = -70 + s * (90 / Math.max(1, k.i('spots')));
        const p = mul(dir(a), S * 0.72);
        spots += circle(side * p[0] * open, p[1], S * 0.045);
        const q = mul(dir(30 + s * 15), S * k.n('lowerSize') * 0.62);
        if (s < 2) spots += circle(side * q[0] * open, q[1], S * 0.04);
      }
      if (k.b('veins'))
        for (let v = 0; v < 5; v++) {
          const a = -85 + v * 22;
          veins += polyline(squash([[side * S * 0.05, 0], mul([side * Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)], S * 0.6)]), false);
          const b = 25 + v * 15;
          veins += polyline(squash([[side * S * 0.04, S * 0.06], mul([side * Math.cos((b * Math.PI) / 180), Math.sin((b * Math.PI) / 180)], S * k.n('lowerSize') * 0.55)]), false);
        }
    }
    const antennae = [-1, 1].map((s) => smoothPath([[s * S * 0.02, -S * 0.2], [s * S * 0.12, -S * 0.42], [s * S * 0.2, -S * 0.5]], false)).join('');
    const knobs = circle(-S * 0.2, -S * 0.5, S * 0.025) + circle(S * 0.2, -S * 0.5, S * 0.025);
    const body = smoothPath(ellipsePts(0, S * 0.05, S * 0.045, S * 0.32, 0, 16), true) + circle(0, -S * 0.25, S * 0.06);
    return {
      kind: 'group',
      children: clean([
        k.fill('Alas', wings.join(''), k.s('wingColor'), 'wings'),
        veins && k.stroke('Nervaduras', veins, k.s('edgeColor'), Math.max(1, S * 0.012), 'veins'),
        spots && k.flat('Manchas', spots, k.s('spotColor'), 'spots'),
        k.stroke('Antenas', antennae, k.s('bodyColor'), Math.max(1, S * 0.012), 'antennae'),
        k.flat('Puntas de antenas', knobs, k.s('bodyColor'), 'antennae'),
        k.fill('Cuerpo', body, k.s('bodyColor'), 'body'),
      ]),
    };
  },
};

// ---------------------------------------------------------------------------

/** Franjas dentro de una elipse vertical (sin máscaras). */
function bandsInEllipse(cx: number, cy: number, rx: number, ry: number, count: number, fill = 0.45): string {
  let d = '';
  for (let b = 0; b < count; b++) {
    const y1 = cy - ry + ((2 * ry) / count) * (b + (1 - fill) / 2 + 0.25);
    const y2 = y1 + ((2 * ry) / count) * fill;
    const pts: Pt[] = [];
    for (let s = 0; s <= 8; s++) {
      const y = y1 + ((y2 - y1) * s) / 8;
      pts.push([cx + rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2)), y]);
    }
    for (let s = 8; s >= 0; s--) {
      const y = y1 + ((y2 - y1) * s) / 8;
      pts.push([cx - rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2)), y]);
    }
    d += polyline(pts, true);
  }
  return d;
}

export const insect: Generator = {
  id: 'ani.insect',
  name: 'Insecto',
  category: 'animales',
  description: 'Abeja, escarabajo, hormiga o vaquita de San Antonio vistos desde arriba, con patas, antenas y alas.',
  keywords: ['insecto', 'insectos', 'abeja', 'abejas', 'escarabajo', 'hormiga', 'hormigas', 'vaquita', 'mariquita', 'bicho', 'bug', 'bee', 'ant', 'beetle', 'ladybug'],
  params: [
    { key: 'type', label: 'Tipo', group: 'Insecto', type: 'select', options: [{ value: 'bee', label: 'Abeja' }, { value: 'beetle', label: 'Escarabajo' }, { value: 'ant', label: 'Hormiga' }, { value: 'ladybug', label: 'Vaquita de San Antonio' }], default: 'bee' },
    { key: 'size', label: 'Tamaño', group: 'Insecto', type: 'number', min: 20, max: 600, step: 1, default: 220, unit: 'px' },
    { key: 'legBend', label: 'Patas abiertas', group: 'Insecto', type: 'number', min: 0, max: 1, step: 0.01, default: 0.6 },
    { key: 'wings', label: 'Alas', group: 'Insecto', type: 'boolean', default: true },
    { key: 'customColor', label: 'Usar mi color', group: 'Colores', type: 'boolean', default: false },
    ...colors({ color: ['Color propio', '#d9a72b'], darkColor: ['Oscuro', '#2b2620'], wingColor: ['Alas', '#dceef7'] }),
    ...outlineParams(1.2),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const S = k.n('size');
    const type = k.s('type');
    const base: Record<string, string> = { bee: '#f2b92c', beetle: '#3f6b4f', ant: '#5a3324', ladybug: '#d6303b' };
    const color = k.b('customColor') ? k.s('color') : base[type];
    const dark = k.s('darkColor');
    // Segmentos (de la cabeza a la cola, a lo largo del eje vertical).
    const seg = {
      bee: [[0.09, 0.09, -0.36], [0.14, 0.13, -0.17], [0.17, 0.25, 0.2]],
      beetle: [[0.09, 0.07, -0.4], [0.17, 0.11, -0.26], [0.24, 0.32, 0.12]],
      ant: [[0.11, 0.1, -0.38], [0.08, 0.13, -0.13], [0.15, 0.2, 0.22]],
      ladybug: [[0.1, 0.07, -0.33], [0.13, 0.06, -0.24], [0.27, 0.27, 0.05]],
    }[type as 'bee'] ?? [];
    let legs = '';
    const thorax = seg[1];
    for (const side of [-1, 1])
      for (let l = 0; l < 3; l++) {
        const y = thorax[2] * S + (l - 1) * S * 0.07;
        const knee: Pt = [side * S * (0.2 + 0.08 * k.n('legBend')), y + (l - 1) * S * 0.12 - S * 0.03];
        const foot: Pt = [side * S * (0.28 + 0.06 * k.n('legBend')), y + (l - 1) * S * 0.22 + S * 0.05];
        legs += polyline([[side * S * 0.05, y], knee, foot], false);
      }
    const head = seg[0];
    const antennae = [-1, 1].map((s) => smoothPath([[s * S * 0.03, (head[2] - head[1]) * S], [s * S * 0.1, (head[2] - head[1] - 0.12) * S], [s * S * 0.17, (head[2] - head[1] - 0.15) * S]], false)).join('');
    const parts: (SceneNode | false | '')[] = [k.stroke('Patas', legs, dark, Math.max(1.5, S * 0.015), 'legs'), k.stroke('Antenas', antennae, dark, Math.max(1, S * 0.011), 'antennae')];
    if (k.b('wings') && (type === 'bee' || type === 'ant')) {
      const w = (side: number) => smoothPath(ellipsePts(side * S * 0.2, thorax[2] * S + S * 0.08, S * 0.2, S * 0.09, side * 35, 20), true);
      parts.push(k.styled('Alas', w(-1) + w(1), { fill: k.s('wingColor'), stroke: k.outlineColor(), strokeWidth: k.outlineWidth(), lineJoin: 'round' }, 'wings'));
      parts[parts.length - 1] && ((parts[parts.length - 1] as SceneNode).opacity = 0.8);
    }
    seg.forEach(([rx, ry, cy], i) => {
      const segColor = type === 'bee' && i < 2 ? dark : i === 0 && type !== 'ant' ? dark : color;
      parts.push(k.fill(['Cabeza', 'Tórax', 'Abdomen'][i], smoothPath(ellipsePts(0, cy * S, rx * S, ry * S, 0, 24), true), segColor, ['head', 'thorax', 'abdomen'][i]));
    });
    const ab = seg[2];
    if (type === 'bee') {
      parts.push(k.flat('Rayas', bandsInEllipse(0, ab[2] * S, ab[0] * S, ab[1] * S, 4), dark, 'stripes'));
      parts.push(k.fill('Aguijón', polyline([[-S * 0.02, (ab[2] + ab[1]) * S - 2], [0, (ab[2] + ab[1]) * S + S * 0.05], [S * 0.02, (ab[2] + ab[1]) * S - 2]], true), dark, 'stinger'));
    }
    if (type === 'ladybug' || type === 'beetle') {
      parts.push(k.stroke('Línea de las alas', polyline([[0, (ab[2] - ab[1]) * S + 2], [0, (ab[2] + ab[1]) * S - 2]], false), dark, Math.max(1.2, S * 0.012), 'elytra'));
      if (type === 'ladybug') {
        let spots = '';
        for (const [x, y, r] of [[-0.12, -0.08, 0.05], [0.12, -0.08, 0.05], [-0.15, 0.08, 0.055], [0.15, 0.08, 0.055], [-0.07, 0.2, 0.045], [0.07, 0.2, 0.045]]) spots += circle(x * S, (ab[2] + y) * S, r * S);
        parts.push(k.flat('Lunares', spots, dark, 'spots'));
      } else {
        parts.push(k.flat('Brillo', smoothPath(ellipsePts(-S * 0.1, ab[2] * S - S * 0.08, S * 0.04, S * 0.12, 10, 16), true), shade(color, 0.35), 'shine'));
      }
    }
    parts.push(k.flat('Ojos', circle(-head[0] * S * 0.55, head[2] * S - S * 0.01, S * 0.022) + circle(head[0] * S * 0.55, head[2] * S - S * 0.01, S * 0.022), type === 'bee' || type === 'ladybug' ? '#f4efe0' : '#111', 'eyes'));
    return { kind: 'group', children: clean(parts) };
  },
};

// ---------------------------------------------------------------------------

export const fish: Generator = {
  id: 'ani.fish',
  name: 'Pez',
  category: 'animales',
  description: 'Pez de perfil con aletas, cola horquillada, redonda o en abanico, escamas y rayas opcionales.',
  keywords: ['pez', 'peces', 'pescado', 'fish', 'pececito', 'mar', 'acuario'],
  params: [
    facingParam('Pez'),
    { key: 'length', label: 'Largo', group: 'Pez', type: 'number', min: 30, max: 900, step: 1, default: 320, unit: 'px' },
    { key: 'depth', label: 'Alto del cuerpo', group: 'Pez', type: 'number', min: 0.15, max: 0.9, step: 0.01, default: 0.42 },
    { key: 'tail', label: 'Cola', group: 'Pez', type: 'select', options: [{ value: 'forked', label: 'Horquillada' }, { value: 'round', label: 'Redonda' }, { value: 'fan', label: 'Abanico' }], default: 'forked' },
    { key: 'fins', label: 'Tamaño de aletas', group: 'Pez', type: 'number', min: 0, max: 1.5, step: 0.01, default: 0.7 },
    { key: 'scales', label: 'Escamas', group: 'Pez', type: 'boolean', default: true },
    { key: 'stripes', label: 'Rayas', group: 'Pez', type: 'number', min: 0, max: 8, step: 1, default: 0 },
    ...colors({ bodyColor: ['Cuerpo', '#4f93b8'], finColor: ['Aletas', '#2f6f93'], bellyColor: ['Panza', '#cfe6ef'], stripeColor: ['Rayas', '#f1c34a'] }),
    ...outlineParams(1.4),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const L = k.n('length');
    const D = L * k.n('depth');
    const F = flipper(k.s('facing') === 'left');
    // Perfil del cuerpo: punta redondeada adelante (derecha), se afina hacia la cola.
    const w = (t: number) => D * Math.sin(Math.PI * Math.min(1, 0.04 + t * 0.96)) ** 0.62 * (0.35 + 0.65 * (1 - t) ** 0.25);
    const top: Pt[] = [];
    const bottom: Pt[] = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      const x = L * 0.4 - L * 0.78 * t;
      top.push([x, -w(t) / 2]);
      bottom.push([x, w(t) / 2 * 0.95]);
    }
    const body = smoothPath(F([...top, ...bottom.reverse()]), true, 0.9);
    const tailX = L * 0.4 - L * 0.78;
    const th = D * 0.75;
    const tt = k.s('tail');
    const tail =
      tt === 'forked'
        ? polyline(F([[tailX + 6, -D * 0.05], [tailX - L * 0.2, -th * 0.6], [tailX - L * 0.12, 0], [tailX - L * 0.2, th * 0.6], [tailX + 6, D * 0.05]]), true)
        : smoothPath(F([[tailX + 6, -D * 0.05], [tailX - L * (tt === 'fan' ? 0.22 : 0.15), -th * (tt === 'fan' ? 0.65 : 0.4)], [tailX - L * (tt === 'fan' ? 0.25 : 0.2), 0], [tailX - L * (tt === 'fan' ? 0.22 : 0.15), th * (tt === 'fan' ? 0.65 : 0.4)], [tailX + 6, D * 0.05]]), true, 0.7);
    const fs = k.n('fins');
    const dorsal = smoothPath(F([[L * 0.12, -w(0.35) / 2 + 2], [-L * 0.02, -w(0.4) / 2 - D * 0.35 * fs], [-L * 0.18, -w(0.6) / 2 + 2]]), true, 0.6);
    const ventral = smoothPath(F([[-L * 0.02, w(0.5) / 2 - 2], [-L * 0.12, w(0.55) / 2 + D * 0.22 * fs], [-L * 0.2, w(0.65) / 2 - 2]]), true, 0.6);
    const pectoral = smoothPath(F([[L * 0.18, D * 0.08], [L * 0.04, D * 0.1 + D * 0.18 * fs], [L * 0.08, D * 0.05]]), true, 0.7);
    const belly = smoothPath(F([[L * 0.32, D * 0.12], [0, w(0.45) / 2 * 0.92], [-L * 0.28, w(0.75) / 2 * 0.85], [0, D * 0.12]]), true, 0.8);
    let scales = '';
    if (k.b('scales'))
      for (let col = 0; col < 7; col++)
        for (let row = -2; row <= 2; row++) {
          const x = L * 0.12 - col * L * 0.07;
          const t = (L * 0.4 - x) / (L * 0.78);
          const y = row * w(t) * 0.17 + (col % 2) * w(t) * 0.08;
          if (Math.abs(y) > w(t) * 0.38) continue;
          const r = w(t) * 0.12;
          scales += smoothPath(F([[x, y - r], [x - r * 0.9, y], [x, y + r]]), false);
        }
    let stripes = '';
    for (let s = 0; s < k.i('stripes'); s++) {
      const t = 0.15 + (s / Math.max(1, k.i('stripes'))) * 0.6;
      const x = L * 0.4 - L * 0.78 * t;
      stripes += polyline(F([[x, -w(t) / 2 * 0.85], [x - L * 0.03, w(t) / 2 * 0.8]]), false);
    }
    const eyeC = F([[L * 0.27, -D * 0.08]])[0];
    const gill = smoothPath(F([[L * 0.2, -D * 0.22], [L * 0.16, 0], [L * 0.2, D * 0.18]]), false);
    return {
      kind: 'group',
      children: clean([
        k.fill('Cola', tail, k.s('finColor'), 'tail'),
        k.fill('Aleta dorsal', dorsal, k.s('finColor'), 'fins'),
        k.fill('Aleta de abajo', ventral, k.s('finColor'), 'fins'),
        k.fill('Cuerpo', body, k.s('bodyColor'), 'body'),
        k.flat('Panza', belly, k.s('bellyColor'), 'belly'),
        stripes && k.stroke('Rayas', stripes, k.s('stripeColor'), Math.max(2, L * 0.025), 'stripes'),
        scales && k.stroke('Escamas', scales, shade(k.s('bodyColor'), -0.25), Math.max(0.8, L * 0.004), 'scales'),
        k.stroke('Agalla', gill, shade(k.s('bodyColor'), -0.35), Math.max(1, L * 0.006), 'gill'),
        k.fill('Aleta del costado', pectoral, k.s('finColor'), 'fins'),
        k.fill('Ojo', circle(eyeC[0], eyeC[1], D * 0.09), '#fbf7ee', 'eye'),
        k.flat('Pupila', circle(eyeC[0] + (k.s('facing') === 'left' ? -1 : 1) * D * 0.02, eyeC[1], D * 0.045), '#1d1a16', 'eye'),
      ]),
    };
  },
};

// ---------------------------------------------------------------------------

export const quadruped: Generator = {
  id: 'ani.quadruped',
  name: 'Cuadrúpedo (silueta)',
  category: 'animales',
  description: 'Silueta de mamífero de cuatro patas: con patas, cuello, orejas, hocico y cola ajustables da perro, gato, caballo, ciervo, vaca u oveja.',
  keywords: ['animal', 'mamífero', 'mamifero', 'cuadrúpedo', 'perro', 'gato', 'caballo', 'ciervo', 'vaca', 'oveja', 'silueta', 'dog', 'cat', 'horse', 'deer'],
  params: [
    facingParam('Animal'),
    { key: 'preset', label: 'Punto de partida', group: 'Animal', type: 'select', options: [{ value: 'custom', label: 'Con los valores de abajo' }, { value: 'dog', label: 'Perro' }, { value: 'cat', label: 'Gato' }, { value: 'horse', label: 'Caballo' }, { value: 'deer', label: 'Ciervo' }, { value: 'cow', label: 'Vaca' }], default: 'dog' },
    { key: 'size', label: 'Tamaño', group: 'Animal', type: 'number', min: 30, max: 900, step: 1, default: 320, unit: 'px' },
    { key: 'bodyLen', label: 'Largo del cuerpo', group: 'Forma', type: 'number', min: 0.4, max: 1.4, step: 0.01, default: 0.8 },
    { key: 'bodyDepth', label: 'Alto del cuerpo', group: 'Forma', type: 'number', min: 0.15, max: 0.6, step: 0.01, default: 0.3 },
    { key: 'legs', label: 'Largo de patas', group: 'Forma', type: 'number', min: 0.1, max: 1, step: 0.01, default: 0.4 },
    { key: 'neck', label: 'Largo del cuello', group: 'Forma', type: 'number', min: 0, max: 0.8, step: 0.01, default: 0.2 },
    { key: 'snout', label: 'Hocico', group: 'Forma', type: 'number', min: 0, max: 0.4, step: 0.01, default: 0.14 },
    { key: 'ears', label: 'Orejas', group: 'Forma', type: 'select', options: [{ value: 'pointed', label: 'Puntiagudas' }, { value: 'floppy', label: 'Caídas' }, { value: 'round', label: 'Redondas' }, { value: 'antlers', label: 'Astas' }, { value: 'horns', label: 'Cuernos' }], default: 'floppy' },
    { key: 'tail', label: 'Cola', group: 'Forma', type: 'number', min: 0, max: 1, step: 0.01, default: 0.35 },
    { key: 'tailUp', label: 'Cola levantada', group: 'Forma', type: 'number', min: -1, max: 1, step: 0.01, default: 0.5 },
    ...colors({ bodyColor: ['Silueta', '#3b3a2a'], eyeColor: ['Ojo', '#f4efe0'] }),
    ...outlineParams(0),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const presets: Record<string, Record<string, number | string>> = {
      dog: { bodyLen: 0.8, bodyDepth: 0.32, legs: 0.38, neck: 0.18, snout: 0.12, ears: 'floppy', tail: 0.28, tailUp: 0.5 },
      cat: { bodyLen: 0.72, bodyDepth: 0.28, legs: 0.3, neck: 0.08, snout: 0.03, ears: 'pointed', tail: 0.55, tailUp: 0.9 },
      horse: { bodyLen: 0.95, bodyDepth: 0.36, legs: 0.62, neck: 0.5, snout: 0.26, ears: 'pointed', tail: 0.55, tailUp: -0.6 },
      deer: { bodyLen: 0.8, bodyDepth: 0.3, legs: 0.62, neck: 0.45, snout: 0.16, ears: 'antlers', tail: 0.1, tailUp: 0.6 },
      cow: { bodyLen: 1.05, bodyDepth: 0.46, legs: 0.38, neck: 0.12, snout: 0.16, ears: 'horns', tail: 0.5, tailUp: -0.8 },
    };
    const pre = presets[k.s('preset')];
    const num = (key: string) => (pre && key in pre ? Number(pre[key]) : k.n(key));
    const ears = pre ? String(pre.ears) : k.s('ears');
    const S = k.n('size');
    const F = flipper(k.s('facing') === 'left');
    const BL = S * num('bodyLen');
    const BD = S * num('bodyDepth');
    const LL = S * num('legs');
    let d = smoothPath(clockwise(F(ellipsePts(0, 0, BL / 2, BD / 2, 0, 24))), true);
    // Patas: cintas que se afinan, un par adelante y otro atrás.
    for (const [x, back] of [[BL * 0.32, false], [BL * 0.2, false], [-BL * 0.3, true], [-BL * 0.4, true]] as [number, boolean][]) {
      const knee: Pt = [x + (back ? BL * 0.04 : -BL * 0.02), BD * 0.2 + LL * 0.5];
      d += smoothPath(clockwise(ribbonOutline(F([[x, 0], knee, [x + (back ? -BL * 0.01 : 0), BD * 0.35 + LL]]), (t) => S * (0.11 - t * 0.055))), true, 0.85);
    }
    // Cuello y cabeza.
    const neckL = S * num('neck');
    const neckBase: Pt = [BL * 0.4, -BD * 0.15];
    const headC: Pt = add(neckBase, [neckL * 0.45 + S * 0.05, -neckL * 0.9 - S * 0.06]);
    d += smoothPath(clockwise(ribbonOutline(F([neckBase, add(neckBase, [neckL * 0.25, -neckL * 0.5]), headC]), (t) => S * (0.21 - t * 0.07))), true, 0.85);
    const hr = S * 0.12;
    d += smoothPath(clockwise(F(ellipsePts(headC[0], headC[1], hr * 1.05, hr * 0.9, 0, 20))), true);
    const sn = S * num('snout');
    if (sn > 1) d += smoothPath(clockwise(F(ellipsePts(headC[0] + hr * 0.6 + sn * 0.45, headC[1] + hr * 0.25, sn * 0.6 + hr * 0.25, hr * 0.5, 8, 18))), true);
    // Orejas / astas / cuernos.
    let antlers = '';
    if (ears === 'pointed') d += polyline(clockwise(F([add(headC, [-hr * 0.5, -hr * 0.5]), add(headC, [-hr * 0.35, -hr * 1.9]), add(headC, [hr * 0.15, -hr * 0.7])])), true);
    else if (ears === 'floppy') d += smoothPath(clockwise(F([add(headC, [-hr * 0.55, hr * 0.4]), add(headC, [-hr * 1.05, hr * 0.9]), add(headC, [-hr * 1.2, -hr * 0.1]), add(headC, [-hr * 0.5, -hr * 0.6])])), true, 0.8);
    else if (ears === 'round') d += smoothPath(clockwise(F(ellipsePts(headC[0] - hr * 0.4, headC[1] - hr * 0.95, hr * 0.42, hr * 0.42, 0, 14))), true);
    else if (ears === 'horns') d += smoothPath(clockwise(F([add(headC, [-hr * 0.3, -hr * 0.7]), add(headC, [-hr * 0.9, -hr * 1.6]), add(headC, [-hr * 0.4, -hr * 1.5]), add(headC, [hr * 0.1, -hr * 0.8])])), true, 0.6);
    else if (ears === 'antlers') {
      const base = add(headC, [-hr * 0.2, -hr * 0.8]);
      const main: Pt[] = [base, add(base, [-hr * 0.6, -hr * 1.4]), add(base, [-hr * 0.4, -hr * 2.6])];
      antlers += smoothPath(F(main), false);
      antlers += polyline(F([add(base, [-hr * 0.5, -hr * 1.2]), add(base, [hr * 0.4, -hr * 1.9])]), false);
      antlers += polyline(F([add(base, [-hr * 0.5, -hr * 2.0]), add(base, [hr * 0.25, -hr * 2.7])]), false);
      d += polyline(clockwise(F([add(headC, [-hr * 0.6, -hr * 0.4]), add(headC, [-hr * 1.3, -hr * 0.9]), add(headC, [-hr * 0.5, -hr * 0.1])])), true);
    }
    // Cola.
    const TL = S * num('tail');
    if (TL > 2) {
      const up = num('tailUp');
      const tb: Pt = [-BL * 0.48, -BD * 0.2];
      const tip: Pt = add(tb, mul(dir(180 - up * 70), TL));
      d += smoothPath(clockwise(ribbonOutline(F([tb, add(tb, mul(dir(180 - up * 40), TL * 0.5)), tip]), (t) => S * (0.05 - t * 0.035))), true, 0.85);
    }
    const eye = F([add(headC, [hr * 0.25, -hr * 0.2])])[0];
    const color = k.s('bodyColor');
    return {
      kind: 'group',
      children: clean([
        antlers && k.stroke('Astas', antlers, color, Math.max(2, S * 0.022), 'antlers'),
        k.styled('Silueta', d, silhouette(color, k.outlineWidth() > 0 ? k.outlineColor() : color, k.outlineWidth()), 'body'),
        k.flat('Ojo', circle(eye[0], eye[1], S * 0.014), k.s('eyeColor'), 'eye'),
      ]),
    };
  },
};

// ---------------------------------------------------------------------------

export const lizard: Generator = {
  id: 'ani.lizard',
  name: 'Lagartija',
  category: 'animales',
  description: 'Reptil visto desde arriba: cuerpo que serpentea, cuatro patas con dedos, cola larga y manchas.',
  keywords: ['lagartija', 'lagarto', 'reptil', 'reptiles', 'iguana', 'gecko', 'salamandra', 'lizard', 'reptile'],
  params: [
    { key: 'length', label: 'Largo', group: 'Lagartija', type: 'number', min: 40, max: 900, step: 1, default: 380, unit: 'px' },
    { key: 'curve', label: 'Ondulación', group: 'Lagartija', type: 'number', min: 0, max: 1.5, step: 0.01, default: 0.6 },
    { key: 'width', label: 'Grosor', group: 'Lagartija', type: 'number', min: 0.05, max: 0.25, step: 0.005, default: 0.11 },
    { key: 'legLen', label: 'Largo de patas', group: 'Lagartija', type: 'number', min: 0.05, max: 0.3, step: 0.005, default: 0.13 },
    { key: 'tailLen', label: 'Proporción de cola', group: 'Lagartija', type: 'number', min: 0.2, max: 0.7, step: 0.01, default: 0.48 },
    { key: 'spots', label: 'Manchas', group: 'Lagartija', type: 'number', min: 0, max: 40, step: 1, default: 12 },
    ...colors({ bodyColor: ['Cuerpo', '#6f9a45'], spotColor: ['Manchas', '#e8d27a'] }),
    ...outlineParams(1.2),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const L = k.n('length');
    const W = L * k.n('width');
    const tailFrac = k.n('tailLen');
    const spine: Pt[] = [];
    const N = 60;
    for (let i = 0; i <= N; i++) {
      const t = i / N; // 0 = hocico, 1 = punta de la cola
      spine.push([L * 0.5 - L * t, Math.sin(t * Math.PI * 2 * 0.9 + 0.4) * L * 0.08 * k.n('curve') * (0.3 + t)]);
    }
    const bodyEnd = 1 - tailFrac;
    const width = (t: number) => {
      if (t < 0.12) return W * (0.55 + 0.45 * Math.sin((t / 0.12) * Math.PI * 0.5)) * (t < 0.02 ? 0.6 : 1); // cabeza
      if (t < 0.17) return W * 0.7; // cuello
      if (t < bodyEnd) return W * (0.75 + 0.25 * Math.sin(((t - 0.17) / (bodyEnd - 0.17)) * Math.PI));
      return W * 0.8 * (1 - (t - bodyEnd) / tailFrac) ** 0.9 + 0.5;
    };
    let body = ribbon(spine, width, true);
    const at = (t: number) => {
      const i = Math.round(t * N);
      const a = spine[Math.max(0, i - 1)];
      const b = spine[Math.min(N, i + 1)];
      return { p: spine[i], h: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI };
    };
    // Patas: delanteras y traseras, con tres dedos.
    let toes = '';
    for (const [t, ang] of [[0.22, 60], [bodyEnd - 0.04, 120]] as [number, number][]) {
      const s = at(t);
      for (const side of [-1, 1]) {
        const a = s.h + 180 + side * ang;
        const elbow = add(s.p, mul(dir(a), L * k.n('legLen') * 0.55));
        const foot = add(elbow, mul(dir(a + side * (t < 0.5 ? 50 : -50)), L * k.n('legLen') * 0.55));
        body += ribbon([s.p, elbow, foot], (u) => W * (0.35 - u * 0.15), true);
        for (const da of [-35, 0, 35]) toes += polyline([foot, add(foot, mul(dir(a + side * (t < 0.5 ? 50 : -50) + da), W * 0.35))], false);
      }
    }
    let spots = '';
    for (let s = 0; s < k.i('spots'); s++) {
      const t = 0.18 + k.rng.next() * (bodyEnd + tailFrac * 0.5 - 0.18);
      const c = at(t);
      const off = mul(dir(c.h + 90), k.rng.jitter(width(t) * 0.25));
      spots += circle(c.p[0] + off[0], c.p[1] + off[1], width(t) * k.rng.range(0.08, 0.16));
    }
    const head = at(0.05);
    const eyeOff = mul(dir(head.h + 90), W * 0.3);
    const color = k.s('bodyColor');
    return {
      kind: 'group',
      children: clean([
        k.stroke('Dedos', toes, color, Math.max(1.5, W * 0.12), 'toes'),
        k.styled('Cuerpo', body, silhouette(color, k.outlineColor(), k.outlineWidth()), 'body'),
        spots && k.flat('Manchas', spots, k.s('spotColor'), 'spots'),
        k.flat('Ojos', circle(head.p[0] + eyeOff[0], head.p[1] + eyeOff[1], W * 0.09) + circle(head.p[0] - eyeOff[0], head.p[1] - eyeOff[1], W * 0.09), '#1d1a16', 'eyes'),
      ]),
    };
  },
};

export const animalGenerators: Generator[] = [bird, butterfly, insect, fish, quadruped, lizard];
