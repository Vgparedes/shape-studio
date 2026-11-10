// Generadores agrícolas (Etapa 3): espigas de trigo y plantas de maíz.
// El girasol y las raíces también aparecen en esta categoría (ver `also` en botanical.ts).
import type { Generator } from './types';
import type { SceneNode } from '../../core/types';
import { polyline, smoothPath } from '../geometry/path';
import { grow, sampleAt } from '../geometry/curve';
import { ribbon, taper } from '../geometry/ribbon';
import { add, dir, mul, place } from '../geometry/vec';
import { leafGeometry, leafProfile } from '../botanical/leaf';
import { colorParams, stemGrowth } from '../botanical/plant';
import { compact, filled, groupNode, line, pathNode, reader, silhouette } from './build';

export const wheat: Generator = {
  id: 'agro.wheat',
  name: 'Espiga de trigo',
  category: 'agro',
  also: ['botanica'],
  description: 'Una o varias espigas de trigo con granos alternados, barbas y hojas finas.',
  keywords: ['trigo', 'espiga', 'espigas', 'wheat', 'cebada', 'cereal', 'cereales'],
  params: [
    { key: 'stalks', label: 'Cantidad de espigas', group: 'Planta', type: 'number', min: 1, max: 12, step: 1, default: 3 },
    { key: 'spread', label: 'Apertura del manojo', group: 'Planta', type: 'number', min: 0, max: 80, step: 1, default: 24, unit: '°' },
    { key: 'height', label: 'Alto', group: 'Planta', type: 'number', min: 60, max: 700, step: 1, default: 320, unit: 'px' },
    { key: 'droop', label: 'Caída de la espiga', group: 'Planta', type: 'number', min: -1, max: 1, step: 0.01, default: 0.3 },
    { key: 'headLength', label: 'Largo de la espiga', group: 'Espiga', type: 'number', min: 20, max: 260, step: 1, default: 90, unit: 'px' },
    { key: 'grains', label: 'Granos por lado', group: 'Espiga', type: 'number', min: 3, max: 30, step: 1, default: 9 },
    { key: 'grainSize', label: 'Tamaño del grano', group: 'Espiga', type: 'number', min: 3, max: 40, step: 0.5, default: 13, unit: 'px' },
    { key: 'grainAngle', label: 'Ángulo de los granos', group: 'Espiga', type: 'number', min: 5, max: 70, step: 1, default: 28, unit: '°' },
    { key: 'awns', label: 'Largo de las barbas', group: 'Espiga', type: 'number', min: 0, max: 150, step: 1, default: 42, unit: 'px' },
    { key: 'leaves', label: 'Hojas por tallo', group: 'Hojas', type: 'number', min: 0, max: 3, step: 1, default: 1 },
    ...colorParams({ grainColor: ['Granos', '#d9a63a'], stemColor: ['Tallo', '#c9a24a'], leafColor: ['Hojas', '#b3a256'], awnColor: ['Barbas', '#8a6a2a'], outlineColor: ['Contorno', '#2b2620'] }),
  ],
  generate: (ctx) => {
    const r = reader(ctx.params);
    const n = r.i('stalks');
    const outline = r.s('outlineColor');
    const ow = r.n('outlineWidth');
    const H = r.n('height');
    const stems: string[] = [];
    let grains = '';
    let awns = '';
    let leaves = '';
    for (let i = 0; i < n; i++) {
      const rel = n === 1 ? 0 : i / (n - 1) - 0.5;
      const lean = rel * r.n('spread') * 2 + ctx.rng.jitter(4);
      const len = H * (1 - Math.abs(rel) * 0.25) * (1 + ctx.rng.jitter(0.06));
      const side = rel === 0 ? (ctx.rng.next() < 0.5 ? -1 : 1) : Math.sign(rel);
      const g = stemGrowth({ length: len, curve: r.n('droop') * side * 0.6, width: 2.5, heading: -90 + lean, wobble: 2 }, ctx.rng);
      const headFrom = Math.max(0.2, 1 - r.n('headLength') / len);
      stems.push(ribbon(g.points.slice(0, Math.ceil(g.points.length * (headFrom + 0.03))), taper(3, 2.2)));
      const k = r.i('grains');
      const gs = r.n('grainSize');
      for (let j = 0; j < k; j++) {
        const tt = headFrom + ((1 - headFrom) * (j + 0.3)) / (k + 0.2);
        const at = sampleAt(g, tt);
        const scale = 1 - (j / k) * 0.25;
        for (const s of [1, -1]) {
          const a = at.heading + s * r.n('grainAngle');
          const geo = leafGeometry({ length: gs * scale, width: gs * 0.55 * scale, profile: leafProfile('ovalada'), curl: -s * 0.08 });
          const base = add(at.p, mul(dir(at.heading + s * 90), 1.2));
          grains += smoothPath(place(geo.outline, base, a), true, 0.9);
          if (r.n('awns') > 0) {
            const tip = add(base, mul(dir(a), gs * scale * 0.95));
            awns += polyline([tip, add(tip, mul(dir(a - s * r.n('grainAngle') * 0.55), r.n('awns') * (0.75 + ctx.rng.next() * 0.3)))], false);
          }
        }
      }
      const tip = sampleAt(g, 1);
      const tg = leafGeometry({ length: gs * 0.8, width: gs * 0.45, profile: leafProfile('ovalada') });
      grains += smoothPath(place(tg.outline, tip.p, tip.heading), true, 0.9);
      if (r.n('awns') > 0) awns += polyline([add(tip.p, mul(dir(tip.heading), gs * 0.75)), add(tip.p, mul(dir(tip.heading), gs * 0.75 + r.n('awns')))], false);
      for (let l = 0; l < r.i('leaves'); l++) {
        const at = sampleAt(g, 0.15 + l * 0.18);
        const ls = l % 2 === 0 ? -side : side;
        const lg = grow(at.p, at.heading + ls * 22, len * 0.38, { bend: ls * 70, steps: 20 });
        leaves += ribbon(lg.points, (t) => 7 * Math.min(1, t * 8) * (1 - t) ** 0.8);
      }
    }
    return {
      kind: 'group',
      children: compact([
        leaves && pathNode(ctx, 'Hojas', leaves, filled(r.s('leafColor'), outline, ow), 'leaves'),
        pathNode(ctx, 'Tallos', stems.join(''), silhouette(r.s('stemColor'), outline, ow * 0.8), 'stem'),
        awns && pathNode(ctx, 'Barbas', awns, line(r.s('awnColor'), Math.max(0.6, ow * 0.7)), 'awns'),
        pathNode(ctx, 'Granos', grains, filled(r.s('grainColor'), outline, ow), 'grains'),
      ]),
    };
  },
};

export const corn: Generator = {
  id: 'agro.corn',
  name: 'Planta de maíz',
  category: 'agro',
  also: ['botanica'],
  description: 'Planta de maíz con caña de nudos, hojas largas arqueadas, panoja arriba y choclos con chala.',
  keywords: ['maíz', 'maiz', 'choclo', 'choclos', 'corn', 'mazorca', 'pisingallo'],
  params: [
    { key: 'height', label: 'Alto', group: 'Caña', type: 'number', min: 120, max: 800, step: 1, default: 440, unit: 'px' },
    { key: 'width', label: 'Grosor', group: 'Caña', type: 'number', min: 2, max: 30, step: 0.5, default: 10, unit: 'px' },
    { key: 'curve', label: 'Curvatura', group: 'Caña', type: 'number', min: -0.6, max: 0.6, step: 0.01, default: 0.06 },
    { key: 'leaves', label: 'Cantidad', group: 'Hojas', type: 'number', min: 0, max: 16, step: 1, default: 8 },
    { key: 'leafLength', label: 'Largo', group: 'Hojas', type: 'number', min: 30, max: 420, step: 1, default: 200, unit: 'px' },
    { key: 'leafWidth', label: 'Ancho', group: 'Hojas', type: 'number', min: 3, max: 60, step: 0.5, default: 17, unit: 'px' },
    { key: 'arch', label: 'Arqueo', group: 'Hojas', type: 'number', min: 0, max: 1.6, step: 0.01, default: 0.85 },
    { key: 'ears', label: 'Choclos', group: 'Choclos', type: 'number', min: 0, max: 3, step: 1, default: 1 },
    { key: 'earSize', label: 'Tamaño', group: 'Choclos', type: 'number', min: 15, max: 180, step: 1, default: 72, unit: 'px' },
    { key: 'tassel', label: 'Panoja (flor de arriba)', group: 'Panoja', type: 'boolean', default: true },
    { key: 'tasselBranches', label: 'Ramitas', group: 'Panoja', type: 'number', min: 1, max: 14, step: 1, default: 7 },
    ...colorParams({
      stalkColor: ['Caña', '#6f9a45'],
      leafColor: ['Hojas', '#74a64c'],
      earColor: ['Granos', '#e8c14a'],
      huskColor: ['Chala', '#b5cc84'],
      tasselColor: ['Panoja', '#c9a25a'],
      silkColor: ['Barba del choclo', '#a8652f'],
      outlineColor: ['Contorno', '#2b2620'],
    }),
  ],
  generate: (ctx) => {
    const r = reader(ctx.params);
    const outline = r.s('outlineColor');
    const ow = r.n('outlineWidth');
    const H = r.n('height');
    const w = r.n('width');
    const g = stemGrowth({ length: H, curve: r.n('curve'), width: w, wobble: 2 }, ctx.rng);
    const stalk = ribbon(g.points, taper(w, w * 0.55));
    const nLeaves = r.i('leaves');
    let leaves = '';
    let ribs = '';
    let nodes = '';
    const leafSides: number[] = [];
    for (let k = 0; k < nLeaves; k++) {
      const t = 0.08 + (0.78 * k) / Math.max(1, nLeaves - 1);
      const at = sampleAt(g, t);
      const side = k % 2 === 0 ? 1 : -1;
      leafSides.push(side);
      const size = 0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, t * 1.3));
      const lg = grow(at.p, at.heading + side * (28 + ctx.rng.range(0, 14)), r.n('leafLength') * size, { bend: side * r.n('arch') * 120 * (0.8 + ctx.rng.next() * 0.4), steps: 28 });
      const lw = r.n('leafWidth') * (0.75 + size * 0.25);
      leaves += ribbon(lg.points, (tt) => lw * Math.min(1, tt * 5 + 0.25) * (1 - tt) ** 0.65);
      ribs += smoothPath(lg.points.slice(0, Math.round(lg.points.length * 0.85)), false);
      const nw = w * (1 - t * 0.45) * 0.62;
      const nrm = dir(at.heading + 90);
      nodes += polyline([add(at.p, mul(nrm, nw)), add(at.p, mul(nrm, -nw))], false);
    }

    const ears: SceneNode[] = [];
    const nEars = r.i('ears');
    for (let e = 0; e < nEars; e++) {
      const t = 0.42 + e * 0.1;
      const at = sampleAt(g, t);
      const side = e % 2 === 0 ? -1 : 1;
      const L = r.n('earSize') * (1 - e * 0.15);
      const a = at.heading + side * 24;
      const base = add(at.p, mul(dir(at.heading + side * 90), w * 0.4));
      const cob = leafGeometry({ length: L, width: L * 0.34, profile: (x) => Math.sin(Math.PI * Math.min(1, 0.12 + x * 0.88)) ** 0.45 * (1 - 0.3 * x) });
      const cobPts = place(cob.outline, base, a);
      // Granos: filas de óvalos chiquitos en la parte que asoma de la chala.
      let kernels = '';
      for (let row = -1; row <= 1; row++) {
        for (let c = 0; c < 5; c++) {
          const along = L * (0.62 + c * 0.065);
          const across = row * L * 0.075 * (1 - c * 0.12);
          const kp = place([[along, across]], base, a)[0];
          const kg = leafGeometry({ length: L * 0.06, width: L * 0.06, profile: leafProfile('redonda') });
          kernels += smoothPath(place(kg.outline, add(kp, mul(dir(a), -L * 0.03)), a), true);
        }
      }
      const husk: string[] = [];
      for (const s of [1, -1]) {
        const hg = leafGeometry({ length: L * 0.86, width: L * 0.3, profile: leafProfile('lanceolada'), curl: s * 0.18 });
        husk.push(smoothPath(place(hg.outline, base, a + s * 7), true, 0.9));
      }
      const tipPt = place([[L, 0]], base, a)[0];
      let silk = '';
      for (let s = 0; s < 6; s++) {
        const sg = grow(tipPt, a + ctx.rng.range(-35, 35), L * 0.35 * (0.6 + ctx.rng.next() * 0.5), { bend: ctx.rng.range(-70, 70), steps: 8 });
        silk += smoothPath(sg.points, false);
      }
      ears.push(
        groupNode(
          ctx,
          `Choclo ${e + 1}`,
          compact([
            pathNode(ctx, 'Barba', silk, line(r.s('silkColor'), Math.max(0.6, ow * 0.7)), 'silk'),
            pathNode(ctx, 'Mazorca', smoothPath(cobPts, true, 0.9), filled(r.s('earColor'), outline, ow), 'ear'),
            pathNode(ctx, 'Granos', kernels, filled(r.s('earColor'), outline, ow * 0.6), 'grains'),
            pathNode(ctx, 'Chala', husk.join(''), filled(r.s('huskColor'), outline, ow), 'husk'),
          ]),
          'ear',
        ),
      );
    }

    let tassel = '';
    if (r.b('tassel')) {
      const top = sampleAt(g, 1);
      const spike = grow(top.p, top.heading, H * 0.12, { bend: 8, steps: 8 });
      tassel += smoothPath(spike.points, false);
      const nb = r.i('tasselBranches');
      for (let b = 0; b < nb; b++) {
        const at = sampleAt(spike, (b / nb) * 0.7);
        const s = b % 2 === 0 ? 1 : -1;
        const bg = grow(at.p, at.heading + s * (35 + ctx.rng.range(0, 25)), H * (0.08 + ctx.rng.next() * 0.05), { bend: s * 70, steps: 10 });
        tassel += smoothPath(bg.points, false);
      }
    }

    const tasselW = Math.max(1.2, w * 0.22);
    return {
      kind: 'group',
      children: compact([
        groupNode(ctx, 'Choclos', ears.filter((_, i) => i % 2 === 1), 'ears'),
        pathNode(ctx, 'Caña', stalk, filled(r.s('stalkColor'), outline, ow), 'stem'),
        pathNode(ctx, 'Nudos', nodes, line(outline, Math.max(0.6, ow * 0.8)), 'nodes'),
        groupNode(
          ctx,
          'Hojas',
          compact([pathNode(ctx, 'Láminas', leaves, filled(r.s('leafColor'), outline, ow), 'leaf'), ribs && pathNode(ctx, 'Nervaduras', ribs, line(outline, Math.max(0.5, ow * 0.5)), 'veins')]),
          'leaves',
        ),
        groupNode(ctx, 'Choclos de adelante', ears.filter((_, i) => i % 2 === 0), 'ears'),
        tassel && pathNode(ctx, 'Panoja', tassel, line(r.s('tasselColor'), tasselW), 'tassel'),
      ]),
    };
  },
};

export const agroGenerators: Generator[] = [wheat, corn];
