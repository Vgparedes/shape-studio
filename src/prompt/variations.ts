// Variaciones y acciones rápidas sobre figuras ya generadas: otras semillas, parámetros
// movidos, otra disposición, aleatorio, simplificar, más detalle, otro estilo, otros colores, reinterpretar.
// Nada se pierde: se arma un nodo nuevo y la app lo reemplaza con un paso de deshacer.
import type { GroupNode, ParamValues, Scene, SceneNode } from '../core/types';
import type { ParamDef } from '../engine/generators/types';
import { createRng, randomSeed, type Rng } from '../core/random';
import { newId } from '../core/scene';
import { getGenerator, regenerateNode } from '../engine/generators';
import { STYLES, newFx } from '../engine/style';
import { rgbToHex } from '../core/color';
import { GROUNDED, layoutCells, placeInCell, executePlan } from './execute';
import { measureLocal } from '../render/measure';
import { apply } from '../core/transform';
import { interpretLocal } from './local';
import type { Layout, Plan } from './types';

const LAYOUTS: Layout[] = ['row', 'grid', 'circle', 'scatter', 'cluster', 'column'];
// Lo que define la intención del pedido no se toca en las variaciones.
const KEEP = new Set(['yaw', 'facing', 'pitch', 'customColor', 'type', 'preset', 'kinds', 'view', 'pose', 'mode', 'shape']);

/** Mueve los parámetros numéricos un poco (amount 0..1) y, a veces, cambia una opción. */
export function jitterParams(defs: ParamDef[], params: ParamValues, amount: number, rng: Rng): ParamValues {
  const out = { ...params };
  for (const d of defs) {
    if (KEEP.has(d.key) || d.type === 'color' || d.type === 'boolean') continue;
    if (d.type === 'number') {
      const cur = Number(out[d.key] ?? d.default);
      const span = d.max - d.min;
      let v = cur + rng.jitter(amount) * Math.max(Math.abs(cur) * 0.6, span * 0.15);
      v = Math.max(d.min, Math.min(d.max, v));
      out[d.key] = d.step >= 1 ? Math.round(v) : Math.round(v / d.step) * d.step;
    } else if (d.type === 'select' && rng.next() < amount * 0.25) {
      out[d.key] = d.options[rng.int(0, d.options.length - 1)].value;
    }
  }
  return out;
}

/** Aplica una función a cada figura generada (con generador) dentro del nodo. */
export function mapGenerated(n: SceneNode, fn: (n: SceneNode) => SceneNode): SceneNode {
  if (n.source) return fn(n);
  if (n.kind === 'group') return { ...n, children: n.children.map((c) => mapGenerated(c, fn)) };
  return n;
}

function reseed(n: SceneNode, rng: Rng, amount: number): SceneNode {
  return mapGenerated(n, (x) => {
    const g = getGenerator(x.source!.generator);
    if (!g) return x;
    const params = amount > 0 ? jitterParams(g.params, x.source!.params, amount, rng) : x.source!.params;
    return regenerateNode(x, params, Math.floor(rng.next() * 2 ** 31));
  });
}

/** Vuelve a ubicar las figuras de un grupo con otra disposición (sin cambiarlas). */
export function relayout(group: GroupNode, doc: Scene, layout: Layout, rng: Rng, spacing = 0.5): GroupNode {
  // Se reubica dentro de la zona que ya ocupaba el grupo (si se había puesto en un rincón, sigue ahí).
  const area = occupiedArea(group.children, doc);
  const cells = layoutCells(group.children.length, layout, doc, spacing, rng, area);
  const children = group.children.map((c, i) => {
    const copy = { ...c };
    const g = c.source ? getGenerator(c.source.generator) : null;
    placeInCell(copy, cells[i], { spacing, scale: 1, sizeVariation: 0.15, grounded: !!g && GROUNDED.has(g.category) }, rng);
    return copy;
  });
  const plan = group.prompt?.plan as Plan | undefined;
  return { ...group, children, prompt: group.prompt && plan ? { ...group.prompt, plan: { ...plan, layout } } : group.prompt };
}

/** Caja que ocupan unas figuras en la mesa de trabajo. Si ocupan casi toda la mesa, se usa la mesa entera. */
function occupiedArea(nodes: SceneNode[], doc: Scene) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const n of nodes) {
    const b = measureLocal({ ...n, transform: { x: 0, y: 0, rotation: 0, scale: 1 } });
    if (!b) continue;
    for (const c of [apply(n.transform, [b.x, b.y]), apply(n.transform, [b.x + b.width, b.y + b.height]), apply(n.transform, [b.x + b.width, b.y]), apply(n.transform, [b.x, b.y + b.height])]) {
      x0 = Math.min(x0, c[0]);
      y0 = Math.min(y0, c[1]);
      x1 = Math.max(x1, c[0]);
      y1 = Math.max(y1, c[1]);
    }
  }
  if (!Number.isFinite(x0) || (x1 - x0) * (y1 - y0) > doc.width * doc.height * 0.6) return undefined;
  const padX = Math.max(0, (doc.width * 0.3 - (x1 - x0)) / 2);
  const padY = Math.max(0, (doc.height * 0.3 - (y1 - y0)) / 2);
  return { x: Math.max(0, x0 - padX), y: Math.max(0, y0 - padY), w: Math.min(doc.width, x1 - x0 + padX * 2), h: Math.min(doc.height, y1 - y0 + padY * 2) };
}

/** Una variación del nodo. k elige el énfasis (semillas, proporciones, disposición, todo junto). */
/** ¿Tiene figuras generadas adentro (con parámetros)? */
function hasGenerated(n: SceneNode): boolean {
  return !!n.source || (n.kind === 'group' && n.children.some(hasGenerated));
}

// Para dibujos sin parámetros (SVG importados, vectorizados, editados a mano): variantes de tratamiento
// que conservan la silueta y la orientación.
const SHAPE_KEEPING: { style: string; params: Record<string, number | string | boolean> }[] = [
  { style: 'minimalist', params: { detail: 0.15, minSize: 12 } },
  { style: 'organic', params: { amount: 5, freq: 0.05 } },
  { style: 'geometric', params: { facets: 0.04 } },
  { style: 'minimalist', params: { detail: 0.45, minSize: 6 } },
  { style: 'handdrawn', params: { rough: 2, offset: 3 } },
  { style: 'lineart', params: { width: 2 } },
  { style: 'engraving', params: {} },
  { style: 'dotwork', params: {} },
];

export function variantOf(node: SceneNode, doc: Scene, k: number, seed: number): SceneNode {
  const rng = createRng(seed);
  if (!hasGenerated(node)) {
    const v = SHAPE_KEEPING[k % SHAPE_KEEPING.length];
    const fx = newFx(v.style, seed);
    return { ...node, id: newId(), fx: fx ? { ...fx, params: { ...fx.params, ...v.params } } : undefined };
  }
  const mode = k % 4;
  let out: SceneNode;
  if (node.kind === 'group' && node.prompt && node.children.length > 1 && mode === 2) {
    const plan = node.prompt.plan as Plan;
    const options = LAYOUTS.filter((l) => l !== plan.layout);
    out = relayout(reseed(node, rng, 0) as GroupNode, doc, options[rng.int(0, options.length - 1)], rng, plan.spacing);
  } else out = reseed(node, rng, mode === 0 ? 0 : mode === 1 ? 0.25 : 0.4);
  return { ...out, id: newId() };
}

export function variationsOf(node: SceneNode, doc: Scene, count: number): SceneNode[] {
  const base = randomSeed();
  return Array.from({ length: count }, (_, k) => variantOf(node, doc, k, base + k * 7919));
}

/** Aleatorio: semilla nueva y parámetros movidos bastante. */
export const randomize = (node: SceneNode) => ({ ...reseed(node, createRng(randomSeed()), 0.6), id: node.id });

const SIMPLIFY: Record<string, (v: number) => number> = {
  veins: () => 0, leafVeins: () => 0, serration: () => 0, leafSerration: () => 0,
  layers: () => 1, depth: (v) => Math.max(1, v - 1), rootDepth: (v) => Math.max(0, v - 1), complexity: (v) => Math.max(1, v - 2),
  vertices: (v) => Math.max(4, Math.round(v * 0.7)), petals: (v) => Math.max(5, Math.round(v * 0.7)), disorder: (v) => v * 0.4,
  irregularity: (v) => v * 0.6, spots: (v) => Math.round(v * 0.5), detail: () => 0, slats: (v) => Math.round(v / 2), bands: (v) => Math.round(v / 2),
  grains: (v) => Math.max(3, Math.round(v * 0.7)), leafCount: (v) => Math.max(1, Math.round(v * 0.7)), count: (v) => Math.max(1, Math.round(v * 0.75)),
  rings: (v) => Math.max(1, v - 1), pinnae: (v) => Math.max(3, Math.round(v * 0.7)), tendrils: (v) => Math.round(v / 2), craters: (v) => Math.round(v / 2),
};
const DETAIL: Record<string, (v: number) => number> = {
  veins: (v) => Math.max(4, v + 2), leafVeins: (v) => Math.max(3, v + 2), layers: (v) => v + 1, depth: (v) => v + 1, rootDepth: (v) => v + 1,
  complexity: (v) => v + 2, vertices: (v) => Math.round(v * 1.4), petals: (v) => Math.round(v * 1.3), disorder: (v) => Math.min(1, v + 0.2),
  spots: (v) => Math.round(v * 1.6 + 2), detail: () => 1, bands: (v) => v + 2, grains: (v) => Math.round(v * 1.3), leafCount: (v) => Math.round(v * 1.4 + 1),
  rings: (v) => v + 1, pinnae: (v) => Math.round(v * 1.3), tendrils: (v) => v + 2, seeds: () => 1,
};

/** Simplificar o sumar detalle. Si se indica una lista de claves, solo toca esas (por ejemplo, las de una parte). */
export function adjustDetail(node: SceneNode, more: boolean, onlyKeys?: string[]): SceneNode {
  const table = more ? DETAIL : SIMPLIFY;
  return mapGenerated(node, (x) => {
    const g = getGenerator(x.source!.generator);
    if (!g) return x;
    const params = { ...x.source!.params };
    for (const d of g.params) {
      const f = table[d.key];
      if (!f || (onlyKeys && !onlyKeys.includes(d.key))) continue;
      if (d.type === 'number') params[d.key] = Math.max(d.min, Math.min(d.max, f(Number(params[d.key] ?? d.default))));
      else if (d.type === 'boolean') params[d.key] = Boolean(f(params[d.key] ? 1 : 0));
    }
    return regenerateNode(x, params, x.source!.seed);
  });
}

/** Otro estilo visual al azar (distinto del actual). */
export function changeStyle(node: SceneNode): SceneNode {
  const options = STYLES.filter((s) => s.id !== node.fx?.style);
  const st = options[Math.floor(Math.random() * options.length)];
  return { ...node, fx: newFx(st.id, randomSeed()) ?? undefined };
}

// ---------------------------------------------------------------------------
// Paletas automáticas.

function hsl(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

export function randomPalette(rng: Rng = createRng(randomSeed())): string[] {
  const h = rng.range(0, 360);
  const scheme = rng.int(0, 2);
  const hues = scheme === 0 ? [h, h + 25, h - 25, h + 50] : scheme === 1 ? [h, h + 180, h + 15, h + 195] : [h, h + 120, h + 240, h + 60];
  return hues.map((hh, i) => hsl(((hh % 360) + 360) % 360, 0.45 + rng.next() * 0.3, [0.45, 0.62, 0.35, 0.78][i]));
}

// Colores de "estructura" que conviene conservar al cambiar la paleta (contornos, verdes de la planta).
const KEEP_COLORS = new Set(['outlineColor', 'leafColor', 'stemColor', 'rootColor', 'veinColor', 'lineColor', 'ink', 'edgeColor', 'darkColor', 'eyeColor', 'stalkColor', 'huskColor', 'branchColor', 'trunkColor']);

export function applyPalette(node: SceneNode, palette: string[]): SceneNode {
  let i = 0;
  return mapGenerated(node, (x) => {
    const g = getGenerator(x.source!.generator);
    if (!g) return x;
    const params = { ...x.source!.params };
    for (const d of g.params) {
      if (d.type !== 'color' || KEEP_COLORS.has(d.key)) continue;
      params[d.key] = palette[i++ % palette.length];
    }
    if (g.params.some((d) => d.key === 'customColor')) params.customColor = true;
    return regenerateNode(x, params, x.source!.seed);
  });
}

/** Reinterpretar: vuelve a leer el pedido con otra semilla (otras decisiones creativas). */
export function reinterpret(node: SceneNode, doc: Scene): SceneNode | null {
  if (node.kind === 'group' && node.prompt) {
    const seed = randomSeed();
    const plan = interpretLocal(node.prompt.text, seed);
    const prev = node.prompt.plan as Plan;
    // Se conserva el estilo y la paleta si el pedido nuevo no los define.
    if (!plan.style && prev.style) plan.style = prev.style;
    // Sin el grupo viejo en la mesa, para que no se esquive a sí mismo al buscar lugar.
    const g = executePlan(plan, { ...doc, nodes: doc.nodes.filter((n) => n.id !== node.id) }, seed, node.prompt.text);
    return g ? { ...g, id: node.id, transform: node.transform } : null;
  }
  return { ...reseed(node, createRng(randomSeed()), 0.8), id: node.id };
}

