// Generadores botánicos (Etapa 3). Cada planta separa sus partes en grupos con nombre
// y rol (Pétalos, Centro, Tallo, Hojas, Raíces) para poder editarlas por separado.
import type { Generator, ParamDef } from './types';
import type { SceneNode } from '../../core/types';
import { shade } from '../../core/color';
import type { Pt } from '../geometry/path';
import { polyline, smoothPath } from '../geometry/path';
import { grow, sampleAt } from '../geometry/curve';
import { ribbon, taper } from '../geometry/ribbon';
import { branch, segmentsToPath } from '../geometry/branching';
import { add, dir, mul, place, rotate } from '../geometry/vec';
import { LEAF_SHAPES, PETAL_SHAPES, leafGeometry, leafProfile, type LeafShape, type PetalShape } from '../botanical/leaf';
import { flowerHead } from '../botanical/flowerHead';
import { colorParams, leafParams, leavesAlong, plantBody, rootParams, rootsPath, stemGrowth, stemParams } from '../botanical/plant';
import { compact, filled, groupNode, line, pathNode, reader, silhouette } from './build';

// ---------------------------------------------------------------------------
// Plantas con flor (girasol, margarita, flor genérica): misma estructura, distintos valores de base.

interface FlowerDefaults {
  petals: number;
  petalLength: number;
  petalWidth: number;
  petalShape: PetalShape;
  layers: number;
  cup: number;
  center: number;
  seeds: boolean;
  bracts: boolean;
  depth: number;
  stem: { length: number; curve: number; width: number };
  leaves: Parameters<typeof leafParams>[0];
  roots: Parameters<typeof rootParams>[0];
  colors: { petal: string; center: string; seed: string; leaf: string; stem: string; root: string; outline: string };
}

function flowerParams(d: FlowerDefaults): ParamDef[] {
  return [
    { key: 'yaw', label: 'Orientación (+ derecha, − izquierda)', group: 'Flor', type: 'number', min: -85, max: 85, step: 1, default: 0, unit: '°' },
    { key: 'pitch', label: 'Inclinación (+ cabizbaja)', group: 'Flor', type: 'number', min: -60, max: 70, step: 1, default: 0, unit: '°' },
    { key: 'disorder', label: 'Naturalidad / desorden', group: 'Flor', type: 'number', min: 0, max: 1, step: 0.01, default: 0.3 },
    { key: 'petals', label: 'Cantidad', group: 'Pétalos', type: 'number', min: 3, max: 64, step: 1, default: d.petals },
    { key: 'petalLength', label: 'Largo', group: 'Pétalos', type: 'number', min: 5, max: 200, step: 1, default: d.petalLength, unit: 'px' },
    { key: 'petalWidth', label: 'Ancho', group: 'Pétalos', type: 'number', min: 1, max: 90, step: 0.5, default: d.petalWidth, unit: 'px' },
    { key: 'petalShape', label: 'Forma', group: 'Pétalos', type: 'select', options: PETAL_SHAPES, default: d.petalShape },
    { key: 'layers', label: 'Coronas', group: 'Pétalos', type: 'number', min: 1, max: 4, step: 1, default: d.layers },
    { key: 'cup', label: 'Apertura en copa', group: 'Pétalos', type: 'number', min: -30, max: 80, step: 1, default: d.cup, unit: '°' },
    { key: 'center', label: 'Tamaño', group: 'Centro', type: 'number', min: 2, max: 160, step: 1, default: d.center, unit: 'px' },
    { key: 'centerX', label: 'Posición horizontal', group: 'Centro', type: 'number', min: -0.5, max: 0.5, step: 0.01, default: 0 },
    { key: 'centerY', label: 'Posición vertical', group: 'Centro', type: 'number', min: -0.5, max: 0.5, step: 0.01, default: 0 },
    { key: 'seeds', label: 'Semillas en espiral', group: 'Centro', type: 'boolean', default: d.seeds },
    { key: 'bracts', label: 'Brácteas (hojitas de atrás)', group: 'Centro', type: 'boolean', default: d.bracts },
    ...stemParams(d.stem),
    ...leafParams(d.leaves),
    ...rootParams(d.roots),
    ...colorParams({
      petalColor: ['Pétalos', d.colors.petal],
      centerColor: ['Centro', d.colors.center],
      seedColor: ['Semillas', d.colors.seed],
      leafColor: ['Hojas', d.colors.leaf],
      stemColor: ['Tallo', d.colors.stem],
      rootColor: ['Raíces', d.colors.root],
      outlineColor: ['Contorno', d.colors.outline],
    }),
  ];
}

function makeFlower(meta: Pick<Generator, 'id' | 'name' | 'description' | 'keywords' | 'also'>, d: FlowerDefaults): Generator {
  return {
    ...meta,
    category: 'botanica',
    params: flowerParams(d),
    generate: (ctx) => {
      const r = reader(ctx.params);
      const outline = r.s('outlineColor');
      const ow = r.n('outlineWidth');
      const body = plantBody(ctx, { stem: r.s('stemColor'), leaf: r.s('leafColor'), root: r.s('rootColor'), outline, outlineWidth: ow });
      const head = flowerHead(
        {
          yaw: r.n('yaw'),
          pitch: r.n('pitch'),
          petals: r.i('petals'),
          petalLength: r.n('petalLength'),
          petalWidth: r.n('petalWidth'),
          petalShape: r.s('petalShape') as PetalShape,
          cup: r.n('cup'),
          layers: r.i('layers'),
          disorder: r.n('disorder'),
          centerRadius: r.n('center'),
          centerOffset: [r.n('centerX'), r.n('centerY')],
          depth: Math.max(4, r.n('center') * 0.35),
          seeds: r.b('seeds'),
          bracts: r.b('bracts'),
        },
        ctx.rng,
      );
      // La cabeza se ubica de forma que su parte de atrás quede sobre la punta del tallo.
      const center: Pt = [body.top.p[0] - head.attach[0], body.top.p[1] - head.attach[1]];
      const petalStyle = filled(r.s('petalColor'), outline, ow);
      const backOrdered: SceneNode[] = []; // pétalos y brácteas de atrás, en el orden de profundidad que da flowerHead
      const frontPetals: SceneNode[] = [];
      const centerNodes: SceneNode[] = [];
      let pi = 0;
      for (const part of head.parts) {
        if (part.kind === 'petal') (part.front ? frontPetals : backOrdered).push(pathNode(ctx, `Pétalo ${++pi}`, part.d, petalStyle, 'petal'));
        else if (part.kind === 'bract') backOrdered.push(pathNode(ctx, 'Bráctea', part.d, filled(r.s('leafColor'), outline, ow), 'bract'));
        else if (part.kind === 'receptacle') centerNodes.push(pathNode(ctx, 'Receptáculo', part.d, filled(shade(r.s('leafColor'), -0.1), outline, ow), 'receptacle'));
        else if (part.kind === 'disk') centerNodes.push(pathNode(ctx, 'Disco', part.d, filled(r.s('centerColor'), outline, ow), 'center'));
        else centerNodes.push(pathNode(ctx, 'Semillas', part.d, filled(r.s('seedColor'), outline, 0), 'seeds'));
      }
      const headGroup = groupNode(
        ctx,
        'Flor',
        compact([
          groupNode(ctx, 'Pétalos de atrás', backOrdered, 'petals'),
          groupNode(ctx, 'Centro', centerNodes, 'center'),
          groupNode(ctx, 'Pétalos de adelante', frontPetals, 'petals'),
        ]),
        'flower',
      );
      headGroup.transform = { ...headGroup.transform, x: center[0], y: center[1] };
      return { kind: 'group', children: [...body.nodes, headGroup] };
    },
  };
}

export const sunflower = makeFlower(
  {
    id: 'bot.sunflower',
    name: 'Girasol',
    description: 'Girasol completo: cabeza con semillas en espiral, pétalos, tallo, hojas y raíces. Se puede ver de frente, de perfil o cabizbajo.',
    keywords: ['girasol', 'girasoles', 'sunflower', 'helianthus'],
    also: ['agro'],
  },
  {
    petals: 28,
    petalLength: 58,
    petalWidth: 15,
    petalShape: 'punta',
    layers: 2,
    cup: 12,
    center: 48,
    seeds: true,
    bracts: true,
    depth: 16,
    stem: { length: 320, curve: 0.15, width: 9 },
    leaves: { count: 4, length: 95, ratio: 0.72, shape: 'ancha', angle: 52, droop: 0.6, veins: 4 },
    roots: { show: true, length: 90, depth: 2, count: 4 },
    colors: { petal: '#e8b422', center: '#6b4423', seed: '#3d2614', leaf: '#5b8a3c', stem: '#4f7a34', root: '#9a7650', outline: '#2b2620' },
  },
);

export const daisy = makeFlower(
  {
    id: 'bot.daisy',
    name: 'Margarita',
    description: 'Margarita de pétalos blancos redondeados y centro amarillo.',
    keywords: ['margarita', 'margaritas', 'daisy', 'manzanilla'],
  },
  {
    petals: 22,
    petalLength: 46,
    petalWidth: 11,
    petalShape: 'redondeada',
    layers: 1,
    cup: 6,
    center: 22,
    seeds: true,
    bracts: false,
    depth: 6,
    stem: { length: 260, curve: -0.2, width: 4 },
    leaves: { count: 4, length: 60, ratio: 0.28, shape: 'lanceolada', angle: 40, droop: 0.3, veins: 0 },
    roots: { show: false, length: 60, depth: 2, count: 3 },
    colors: { petal: '#fbfaf6', center: '#e9b52a', seed: '#c48a12', leaf: '#5f8f45', stem: '#4f7a34', root: '#9a7650', outline: '#2b2620' },
  },
);

export const genericFlower = makeFlower(
  {
    id: 'bot.flower',
    name: 'Flor',
    description: 'Flor genérica de pétalos anchos y dos coronas. Base para cualquier flor simple.',
    keywords: ['flor', 'flores', 'flower', 'florcita'],
  },
  {
    petals: 6,
    petalLength: 50,
    petalWidth: 34,
    petalShape: 'ancha',
    layers: 2,
    cup: 18,
    center: 14,
    seeds: false,
    bracts: false,
    depth: 6,
    stem: { length: 240, curve: 0.25, width: 5 },
    leaves: { count: 2, length: 70, ratio: 0.42, shape: 'ovalada', angle: 48, droop: 0.4, veins: 3 },
    roots: { show: false, length: 60, depth: 2, count: 3 },
    colors: { petal: '#d9607a', center: '#f0c43a', seed: '#b0801a', leaf: '#5f8f45', stem: '#4f7a34', root: '#9a7650', outline: '#2b2620' },
  },
);

// ---------------------------------------------------------------------------

export const tulip: Generator = {
  id: 'bot.tulip',
  name: 'Tulipán',
  category: 'botanica',
  description: 'Tulipán de perfil con pétalos en copa y hojas largas que abrazan el tallo.',
  keywords: ['tulipán', 'tulipan', 'tulipanes', 'tulip'],
  params: [
    { key: 'cupHeight', label: 'Alto de la copa', group: 'Flor', type: 'number', min: 20, max: 200, step: 1, default: 78, unit: 'px' },
    { key: 'cupWidth', label: 'Ancho de la copa', group: 'Flor', type: 'number', min: 15, max: 200, step: 1, default: 58, unit: 'px' },
    { key: 'openness', label: 'Apertura', group: 'Flor', type: 'number', min: 0, max: 1, step: 0.01, default: 0.25 },
    { key: 'pointy', label: 'Puntas', group: 'Flor', type: 'number', min: 0, max: 1, step: 0.01, default: 0.5 },
    ...stemParams({ length: 260, curve: 0.12, width: 6 }),
    { key: 'leafCount', label: 'Cantidad', group: 'Hojas', type: 'number', min: 0, max: 4, step: 1, default: 2 },
    { key: 'leafLength', label: 'Largo', group: 'Hojas', type: 'number', min: 20, max: 300, step: 1, default: 170, unit: 'px' },
    { key: 'leafWidth', label: 'Ancho', group: 'Hojas', type: 'number', min: 5, max: 80, step: 1, default: 36, unit: 'px' },
    ...rootParams({ show: false, length: 70, depth: 2, count: 5 }),
    ...colorParams({
      petalColor: ['Pétalos', '#d8434e'],
      leafColor: ['Hojas', '#6a9a55'],
      stemColor: ['Tallo', '#5a8a44'],
      rootColor: ['Raíces', '#c9b48a'],
      outlineColor: ['Contorno', '#2b2620'],
    }),
  ],
  generate: (ctx) => {
    const r = reader(ctx.params);
    const outline = r.s('outlineColor');
    const ow = r.n('outlineWidth');
    const stem = stemGrowth({ length: r.n('stemLength'), curve: r.n('stemCurve'), width: r.n('stemWidth') }, ctx.rng);
    const top = sampleAt(stem, 1);
    const H = r.n('cupHeight');
    const W = r.n('cupWidth');
    const open = r.n('openness');
    const pointy = r.n('pointy');

    // Pétalo en coordenadas locales: base en (0,0), crece hacia -y.
    const petal = (w: number, h: number, lean: number): string => {
      const steps = 16;
      const left: Pt[] = [];
      const right: Pt[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const half = (w / 2) * Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.05)) ** (0.6 + pointy * 0.6) * (1 - 0.25 * t * t);
        const shift = lean * h * 0.5 * t * t;
        left.push([shift - half, -h * t]);
        right.push([shift + half, -h * t]);
      }
      return smoothPath([...left, ...right.slice(0, -1).reverse()], true, 0.9);
    };
    const toWorld = (d: string, angle: number): SceneNode => {
      const n = pathNode(ctx, 'Pétalo', d, filled(ctx.params.petalColor as string, outline, ow), 'petal');
      n.transform = { x: top.p[0], y: top.p[1], rotation: top.heading + 90 + angle, scale: 1 };
      return n;
    };
    const spread = 8 + open * 40;
    const petalColor = r.s('petalColor');
    const back = [toWorld(petal(W * 0.62, H * 0.98, -open), -spread * 1.2), toWorld(petal(W * 0.62, H * 0.98, open), spread * 1.2)];
    back.forEach((n) => n.kind === 'path' && (n.style = filled(shade(petalColor, -0.18), outline, ow)));
    const front = [toWorld(petal(W * 0.66, H, -open * 0.8), -spread * 0.55), toWorld(petal(W * 0.66, H, open * 0.8), spread * 0.55), toWorld(petal(W * 0.7, H * 1.02, 0), 0)];

    const leaves: SceneNode[] = [];
    for (let k = 0; k < r.i('leafCount'); k++) {
      const side = k % 2 === 0 ? -1 : 1;
      const g = grow([side * 2, 0], -90 + side * (4 + k * 5), r.n('leafLength') * (1 - k * 0.12), { bend: side * (14 + ctx.rng.range(0, 22)), steps: 24 });
      const prof = (t: number) => r.n('leafWidth') * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.85)) ** 0.8 * (1 - t * 0.2);
      leaves.push(pathNode(ctx, `Hoja ${k + 1}`, ribbon(g.points, prof), filled(r.s('leafColor'), outline, ow), 'leaf'));
    }
    const roots = r.b('rootsShow') ? rootsPath({ count: r.n('rootCount'), length: r.n('rootLength'), depth: r.n('rootDepth'), spread: 120, width: 1.6 }, ctx.rng) : '';
    const w = r.n('stemWidth');
    return {
      kind: 'group',
      children: compact([
        roots && pathNode(ctx, 'Raíces', roots, silhouette(r.s('rootColor'), outline, ow * 0.8), 'roots'),
        r.b('ground') && pathNode(ctx, 'Suelo', 'M-120 0H120', line(outline, Math.max(1, ow)), 'ground'),
        pathNode(ctx, 'Tallo', ribbon(stem.points, taper(w, w * 0.8)), filled(r.s('stemColor'), outline, ow), 'stem'),
        groupNode(ctx, 'Hojas', leaves, 'leaves'),
        groupNode(ctx, 'Flor', [groupNode(ctx, 'Pétalos de atrás', back, 'petals'), groupNode(ctx, 'Pétalos de adelante', front, 'petals')], 'flower'),
      ]),
    };
  },
};

// ---------------------------------------------------------------------------

const leafShapeParam = (def: LeafShape): ParamDef => ({ key: 'shape', label: 'Forma', group: 'Hoja', type: 'select', options: LEAF_SHAPES, default: def });

export const leaf: Generator = {
  id: 'bot.leaf',
  name: 'Hoja',
  category: 'botanica',
  description: 'Hoja suelta con nervaduras, borde liso o dentado, curvatura y pecíolo.',
  keywords: ['hoja', 'hojas', 'leaf', 'leaves'],
  params: [
    leafShapeParam('ovalada'),
    { key: 'length', label: 'Largo', group: 'Hoja', type: 'number', min: 10, max: 600, step: 1, default: 220, unit: 'px' },
    { key: 'ratio', label: 'Ancho (proporción)', group: 'Hoja', type: 'number', min: 0.05, max: 1.2, step: 0.01, default: 0.5 },
    { key: 'curl', label: 'Curvatura', group: 'Hoja', type: 'number', min: -1, max: 1, step: 0.01, default: 0.15 },
    { key: 'asymmetry', label: 'Asimetría', group: 'Hoja', type: 'number', min: -0.5, max: 0.5, step: 0.01, default: 0.05 },
    { key: 'serration', label: 'Borde dentado', group: 'Hoja', type: 'number', min: 0, max: 1, step: 0.01, default: 0 },
    { key: 'teeth', label: 'Dientes', group: 'Hoja', type: 'number', min: 3, max: 40, step: 1, default: 12 },
    { key: 'veins', label: 'Pares de nervaduras', group: 'Nervaduras', type: 'number', min: 0, max: 16, step: 1, default: 6 },
    { key: 'midrib', label: 'Nervadura central', group: 'Nervaduras', type: 'boolean', default: true },
    { key: 'petiole', label: 'Pecíolo (cabito)', group: 'Hoja', type: 'number', min: 0, max: 200, step: 1, default: 30, unit: 'px' },
    { key: 'angle', label: 'Ángulo', group: 'Hoja', type: 'number', min: -180, max: 180, step: 1, default: -60, unit: '°' },
    ...colorParams({ leafColor: ['Hoja', '#5b8a3c'], veinColor: ['Nervaduras', '#2f4a22'], outlineColor: ['Contorno', '#2b2620'] }),
  ],
  generate: (ctx) => {
    const r = reader(ctx.params);
    const L = r.n('length');
    const geo = leafGeometry({
      length: L,
      width: L * r.n('ratio'),
      profile: leafProfile(r.s('shape') as LeafShape),
      curl: r.n('curl'),
      serration: r.n('serration'),
      teeth: r.n('teeth'),
      veins: r.n('veins'),
      asymmetry: r.n('asymmetry'),
    });
    const ang = r.n('angle');
    const pet = r.n('petiole');
    // Centrada aproximadamente: la hoja + el pecíolo quedan alrededor de (0, 0).
    const base = mul(dir(ang), -(L + pet) / 2 + pet);
    const pl = (pts: Pt[]) => place(pts, base, ang);
    const outline = pl(geo.outline);
    let veins = '';
    if (pet > 0) veins += polyline([add(base, mul(dir(ang), -pet)), base], false);
    if (r.b('midrib')) veins += smoothPath(pl(geo.midrib), false);
    for (const v of geo.veins) veins += smoothPath(pl(v), false);
    const ow = r.n('outlineWidth');
    return {
      kind: 'group',
      children: compact([
        pathNode(ctx, 'Lámina', geo.jagged ? polyline(outline, true) : smoothPath(outline, true, 0.9), filled(r.s('leafColor'), r.s('outlineColor'), ow), 'leaf'),
        veins && pathNode(ctx, 'Nervaduras', veins, line(r.s('veinColor'), Math.max(0.8, ow)), 'veins'),
      ]),
    };
  },
};

export const branchWithLeaves: Generator = {
  id: 'bot.branch',
  name: 'Rama con hojas',
  category: 'botanica',
  description: 'Rama curva con hojas alternas u opuestas que se achican hacia la punta.',
  keywords: ['rama', 'ramas', 'ramita', 'branch', 'twig'],
  params: [
    { key: 'length', label: 'Largo', group: 'Rama', type: 'number', min: 30, max: 900, step: 1, default: 360, unit: 'px' },
    { key: 'curve', label: 'Curvatura', group: 'Rama', type: 'number', min: -1.5, max: 1.5, step: 0.01, default: 0.45 },
    { key: 'width', label: 'Grosor', group: 'Rama', type: 'number', min: 0.5, max: 30, step: 0.5, default: 5, unit: 'px' },
    { key: 'angle0', label: 'Dirección', group: 'Rama', type: 'number', min: -180, max: 180, step: 1, default: -20, unit: '°' },
    { key: 'leafCount', label: 'Cantidad', group: 'Hojas', type: 'number', min: 0, max: 40, step: 1, default: 6 },
    { key: 'leafLength', label: 'Largo', group: 'Hojas', type: 'number', min: 5, max: 250, step: 1, default: 70, unit: 'px' },
    { key: 'leafRatio', label: 'Ancho (proporción)', group: 'Hojas', type: 'number', min: 0.08, max: 1.2, step: 0.01, default: 0.48 },
    { key: 'leafShape', label: 'Forma', group: 'Hojas', type: 'select', options: LEAF_SHAPES, default: 'ovalada' },
    {
      key: 'leafDistribution',
      label: 'Distribución',
      group: 'Hojas',
      type: 'select',
      options: [
        { value: 'alterna', label: 'Alterna' },
        { value: 'opuesta', label: 'Opuesta (de a pares)' },
      ],
      default: 'alterna',
    },
    { key: 'leafAngle', label: 'Ángulo con la rama', group: 'Hojas', type: 'number', min: 5, max: 110, step: 1, default: 45, unit: '°' },
    { key: 'leafDroop', label: 'Caída', group: 'Hojas', type: 'number', min: -1, max: 1.5, step: 0.01, default: 0.25 },
    { key: 'leafVeins', label: 'Nervaduras', group: 'Hojas', type: 'number', min: 0, max: 10, step: 1, default: 3 },
    { key: 'shrink', label: 'Se achican hacia la punta', group: 'Hojas', type: 'number', min: 0, max: 0.9, step: 0.01, default: 0.35 },
    { key: 'terminal', label: 'Hoja en la punta', group: 'Hojas', type: 'boolean', default: true },
    ...colorParams({ leafColor: ['Hojas', '#5b8a3c'], branchColor: ['Rama', '#6b5136'], outlineColor: ['Contorno', '#2b2620'] }),
  ],
  generate: (ctx) => {
    const r = reader(ctx.params);
    const L = r.n('length');
    const start: Pt = mul(dir(r.n('angle0')), -L / 2);
    const g = stemGrowth({ length: L, curve: r.n('curve'), width: r.n('width'), heading: r.n('angle0'), origin: start, wobble: 3 }, ctx.rng);
    const leaves = leavesAlong(
      g,
      {
        count: r.n('leafCount'),
        length: r.n('leafLength'),
        widthRatio: r.n('leafRatio'),
        shape: r.s('leafShape') as LeafShape,
        distribution: r.s('leafDistribution') === 'opuesta' ? 'opuesta' : 'alterna',
        angle: r.n('leafAngle'),
        droop: r.n('leafDroop'),
        veins: r.n('leafVeins'),
        serration: 0,
        from: 0.12,
        to: 0.92,
        shrink: r.n('shrink'),
        petiole: Math.min(10, r.n('leafLength') * 0.1),
      },
      ctx.rng,
    );
    const outline = r.s('outlineColor');
    const ow = r.n('outlineWidth');
    const fills = [...leaves.fills];
    let veins = leaves.veins;
    if (r.b('terminal')) {
      const tip = sampleAt(g, 1);
      const len = r.n('leafLength') * (1 - r.n('shrink') * 0.8);
      const geo = leafGeometry({ length: len, width: len * r.n('leafRatio'), profile: leafProfile(r.s('leafShape') as LeafShape), veins: r.n('leafVeins') });
      fills.push(smoothPath(place(geo.outline, tip.p, tip.heading), true, 0.9));
      veins += smoothPath(place(geo.midrib, tip.p, tip.heading), false);
      for (const v of geo.veins) veins += smoothPath(place(v, tip.p, tip.heading), false);
    }
    const w = r.n('width');
    return {
      kind: 'group',
      children: compact([
        pathNode(ctx, 'Rama', ribbon(g.points, taper(w, w * 0.3)), filled(r.s('branchColor'), outline, ow), 'stem'),
        groupNode(
          ctx,
          'Hojas',
          compact([...fills.map((d, i) => pathNode(ctx, `Hoja ${i + 1}`, d, filled(r.s('leafColor'), outline, ow), 'leaf')), veins && pathNode(ctx, 'Nervaduras', veins, line(outline, Math.max(0.6, ow * 0.7)), 'veins')]),
          'leaves',
        ),
      ]),
    };
  },
};

export const roots: Generator = {
  id: 'bot.roots',
  name: 'Raíces',
  category: 'botanica',
  also: ['agro'],
  description: 'Sistema de raíces ramificadas que crecen hacia abajo.',
  keywords: ['raíz', 'raiz', 'raíces', 'raices', 'roots', 'root'],
  params: [
    { key: 'count', label: 'Raíces principales', group: 'Raíces', type: 'number', min: 1, max: 12, step: 1, default: 5 },
    { key: 'length', label: 'Largo', group: 'Raíces', type: 'number', min: 20, max: 600, step: 1, default: 240, unit: 'px' },
    { key: 'depth', label: 'Ramificación', group: 'Raíces', type: 'number', min: 0, max: 5, step: 1, default: 3 },
    { key: 'spread', label: 'Apertura', group: 'Raíces', type: 'number', min: 0, max: 180, step: 1, default: 110, unit: '°' },
    { key: 'width', label: 'Grosor', group: 'Raíces', type: 'number', min: 0.5, max: 30, step: 0.5, default: 6, unit: 'px' },
    ...colorParams({ rootColor: ['Raíces', '#9a7650'], outlineColor: ['Contorno', '#2b2620'] }),
  ],
  generate: (ctx) => {
    const r = reader(ctx.params);
    const d = rootsPath({ count: r.n('count'), length: r.n('length'), depth: r.n('depth'), spread: r.n('spread'), width: r.n('width') }, ctx.rng, [0, -r.n('length') * 0.45]);
    return { kind: 'path', d, style: silhouette(r.s('rootColor'), r.s('outlineColor'), r.n('outlineWidth')) };
  },
};

export const tree: Generator = {
  id: 'bot.tree',
  name: 'Árbol',
  category: 'botanica',
  description: 'Árbol por ramificación recursiva, con follaje de hojas, copas redondeadas o solo ramas.',
  keywords: ['árbol', 'arbol', 'árboles', 'arboles', 'tree', 'trees'],
  params: [
    { key: 'height', label: 'Alto del tronco', group: 'Tronco', type: 'number', min: 20, max: 400, step: 1, default: 150, unit: 'px' },
    { key: 'width', label: 'Grosor', group: 'Tronco', type: 'number', min: 1, max: 60, step: 0.5, default: 16, unit: 'px' },
    { key: 'lean', label: 'Inclinación', group: 'Tronco', type: 'number', min: -40, max: 40, step: 1, default: 0, unit: '°' },
    { key: 'depth', label: 'Niveles de ramas', group: 'Ramas', type: 'number', min: 1, max: 8, step: 1, default: 6 },
    { key: 'angle', label: 'Apertura', group: 'Ramas', type: 'number', min: 5, max: 80, step: 1, default: 28, unit: '°' },
    { key: 'ratio', label: 'Achique por nivel', group: 'Ramas', type: 'number', min: 0.4, max: 0.9, step: 0.01, default: 0.74 },
    { key: 'children', label: 'Ramas por nudo', group: 'Ramas', type: 'number', min: 1, max: 4, step: 1, default: 2 },
    { key: 'irregular', label: 'Irregularidad', group: 'Ramas', type: 'number', min: 0, max: 1, step: 0.01, default: 0.45 },
    { key: 'gravity', label: 'Caída de las ramas', group: 'Ramas', type: 'number', min: -0.4, max: 0.6, step: 0.01, default: 0 },
    {
      key: 'foliage',
      label: 'Follaje',
      group: 'Follaje',
      type: 'select',
      options: [
        { value: 'hojas', label: 'Hojas' },
        { value: 'copas', label: 'Copas redondeadas' },
        { value: 'ninguno', label: 'Sin follaje (ramas)' },
      ],
      default: 'copas',
    },
    { key: 'foliageSize', label: 'Tamaño del follaje', group: 'Follaje', type: 'number', min: 2, max: 80, step: 1, default: 30, unit: 'px' },
    ...rootParams({ show: false, length: 90, depth: 2, count: 5 }),
    ...colorParams({ trunkColor: ['Tronco', '#6b5136'], leafColor: ['Follaje', '#5f8f45'], rootColor: ['Raíces', '#7d5f40'], outlineColor: ['Contorno', '#2b2620'] }),
  ],
  generate: (ctx) => {
    const r = reader(ctx.params);
    const h = r.n('height');
    const irr = r.n('irregular');
    const g = r.n('gravity');
    const segs = branch(
      {
        origin: [0, 0],
        heading: -90 + r.n('lean'),
        length: h,
        width: r.n('width'),
        depth: r.i('depth'),
        children: [Math.max(1, r.i('children') - (irr > 0.5 ? 1 : 0)), r.i('children') + (irr > 0.3 ? 1 : 0)],
        angle: r.n('angle'),
        angleJitter: irr * 0.8,
        lengthRatio: r.n('ratio'),
        widthRatio: 0.66,
        spawnFrom: 0.55,
        apical: false,
        tropism: g === 0 ? undefined : { heading: g > 0 ? 90 : -90, strength: Math.abs(g) },
        wobble: 6 + irr * 14,
        density: 1 - irr * 0.15,
      },
      ctx.rng,
    );
    const outline = r.s('outlineColor');
    const ow = r.n('outlineWidth');
    const size = r.n('foliageSize');
    let foliage = '';
    const mode = r.s('foliage');
    const tips = segs.filter((s) => s.terminal);
    if (mode === 'hojas') {
      for (const s of tips) {
        const tip = s.points[s.points.length - 1];
        // Con muchas puntas se ponen menos hojas por punta, para que el archivo no explote.
        const k = Math.min(ctx.rng.int(2, 4), Math.max(1, Math.floor(1500 / tips.length)));
        for (let i = 0; i < k; i++) {
          const ang = s.headings[s.headings.length - 1] + ctx.rng.range(-70, 70);
          const geo = leafGeometry({ length: size, width: size * 0.5, profile: leafProfile('ovalada') });
          foliage += smoothPath(place(geo.outline, tip, ang), true, 0.9);
        }
      }
    } else if (mode === 'copas') {
      // Nubes de follaje: círculos agrupados en las puntas de las ramas, del mismo color.
      for (const s of tips) {
        const tip = s.points[s.points.length - 1];
        const rr = size * (0.7 + ctx.rng.next() * 0.6);
        const c = add(tip, rotate([ctx.rng.jitter(size * 0.4), ctx.rng.jitter(size * 0.4)], 0));
        foliage += smoothPath(
          Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            const wob = 1 + ctx.rng.jitter(0.12);
            return [c[0] + Math.cos(a) * rr * wob, c[1] + Math.sin(a) * rr * wob] as Pt;
          }),
          true,
        );
      }
    }
    const rootsD = r.b('rootsShow') ? rootsPath({ count: r.n('rootCount'), length: r.n('rootLength'), depth: r.n('rootDepth'), spread: 140, width: r.n('width') * 0.5 }, ctx.rng) : '';
    return {
      kind: 'group',
      children: compact([
        rootsD && pathNode(ctx, 'Raíces', rootsD, silhouette(r.s('rootColor'), outline, ow * 0.8), 'roots'),
        r.b('ground') && pathNode(ctx, 'Suelo', `M${-h * 1.2} 0H${h * 1.2}`, line(outline, Math.max(1, ow)), 'ground'),
        pathNode(ctx, 'Tronco y ramas', segmentsToPath(segs), silhouette(r.s('trunkColor'), outline, ow), 'trunk'),
        foliage && pathNode(ctx, 'Follaje', foliage, mode === 'copas' ? silhouette(r.s('leafColor'), outline, ow) : filled(r.s('leafColor'), outline, ow), 'foliage'),
      ]),
    };
  },
};

export const fern: Generator = {
  id: 'bot.fern',
  name: 'Helecho',
  category: 'botanica',
  description: 'Fronda de helecho: eje curvo con pinnas que se achican hacia la punta y, con más detalle, pínnulas (fractal).',
  keywords: ['helecho', 'helechos', 'fern', 'fronda'],
  params: [
    { key: 'length', label: 'Largo', group: 'Fronda', type: 'number', min: 40, max: 900, step: 1, default: 380, unit: 'px' },
    { key: 'curve', label: 'Curvatura', group: 'Fronda', type: 'number', min: -1.5, max: 1.5, step: 0.01, default: 0.5 },
    { key: 'pinnae', label: 'Pares de pinnas', group: 'Fronda', type: 'number', min: 3, max: 40, step: 1, default: 16 },
    { key: 'pinnaLength', label: 'Largo de pinna', group: 'Fronda', type: 'number', min: 5, max: 250, step: 1, default: 80, unit: 'px' },
    { key: 'pinnaAngle', label: 'Ángulo', group: 'Fronda', type: 'number', min: 20, max: 100, step: 1, default: 62, unit: '°' },
    { key: 'detail', label: 'Detalle (pínnulas)', group: 'Fronda', type: 'number', min: 0, max: 1, step: 1, default: 1 },
    { key: 'width', label: 'Grosor del eje', group: 'Fronda', type: 'number', min: 0.5, max: 12, step: 0.5, default: 3, unit: 'px' },
    ...colorParams({ leafColor: ['Hojas', '#4f8a44'], stemColor: ['Eje', '#4a6a2f'], outlineColor: ['Contorno', '#2b2620'] }),
  ],
  generate: (ctx) => {
    const r = reader(ctx.params);
    const L = r.n('length');
    const g = stemGrowth({ length: L, curve: r.n('curve'), width: r.n('width'), origin: [0, L * 0.45], wobble: 2 }, ctx.rng);
    const pairs = r.i('pinnae');
    let fills = '';
    let ribs = '';
    for (let k = 0; k < pairs; k++) {
      const t = 0.1 + 0.88 * (k / pairs);
      const at = sampleAt(g, t);
      const size = r.n('pinnaLength') * Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.95)) ** 0.8 * (1 - t * 0.55);
      for (const side of [1, -1]) {
        const heading = at.heading + side * r.n('pinnaAngle');
        if (r.i('detail') >= 1 && size > 14) {
          // Pinna compuesta: un eje chiquito con pínnulas a los dos lados.
          const pg = grow(at.p, heading, size, { bend: side * 18, steps: 10 });
          ribs += smoothPath(pg.points, false);
          const n = Math.max(3, Math.round(size / 7));
          for (let j = 0; j < n; j++) {
            const tt = (j + 0.6) / (n + 0.4);
            const pa = sampleAt(pg, tt);
            const ps = (size / n) * 1.6 * (1 - tt * 0.6);
            for (const s2 of [1, -1]) {
              const geo = leafGeometry({ length: ps, width: ps * 0.55, profile: leafProfile('ovalada'), curl: s2 * 0.1 });
              fills += smoothPath(place(geo.outline, pa.p, pa.heading + s2 * 58), true, 0.9);
            }
          }
          const tipGeo = leafGeometry({ length: size * 0.18, width: size * 0.1, profile: leafProfile('lanceolada') });
          const tip = sampleAt(pg, 1);
          fills += smoothPath(place(tipGeo.outline, tip.p, tip.heading), true, 0.9);
        } else {
          const geo = leafGeometry({ length: size, width: size * 0.32, profile: leafProfile('lanceolada'), curl: side * 0.12 });
          fills += smoothPath(place(geo.outline, at.p, heading), true, 0.9);
        }
      }
    }
    const tip = sampleAt(g, 1);
    const tipGeo = leafGeometry({ length: r.n('pinnaLength') * 0.25, width: r.n('pinnaLength') * 0.1, profile: leafProfile('lanceolada') });
    fills += smoothPath(place(tipGeo.outline, tip.p, tip.heading), true, 0.9);
    const outline = r.s('outlineColor');
    const ow = r.n('outlineWidth');
    const w = r.n('width');
    return {
      kind: 'group',
      children: compact([
        pathNode(ctx, 'Eje', ribbon(g.points, taper(w, w * 0.25)), filled(r.s('stemColor'), outline, ow * 0.8), 'stem'),
        ribs && pathNode(ctx, 'Ejes de pinnas', ribs, line(r.s('stemColor'), Math.max(0.6, w * 0.4)), 'stem'),
        pathNode(ctx, 'Pinnas', fills, silhouette(r.s('leafColor'), outline, ow * 0.7), 'leaves'),
      ]),
    };
  },
};

export const botanicalGenerators: Generator[] = [sunflower, daisy, genericFlower, tulip, leaf, branchWithLeaves, roots, tree, fern];
