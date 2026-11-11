// Composition Engine (versión inicial): ejecuta un Plan y arma las figuras ubicadas
// en la mesa de trabajo según la disposición pedida (fila, grilla, círculo, dispersas, agrupadas).
import type { GroupNode, Scene, SceneNode } from '../core/types';
import { createRng, type Rng } from '../core/random';
import { IDENTITY, newId } from '../core/scene';
import { apply } from '../core/transform';
import { createFromGenerator, getGenerator } from '../engine/generators';
import { newFx, getStyle, styleDefaults } from '../engine/style';
import { measureLocal } from '../render/measure';
import type { Layout, Plan } from './types';

const MAX_INSTANCES = 40;
const MAIN_COLOR = ['petalColor', 'fill', 'color', 'bodyColor', 'capColor', 'planetColor', 'sunColor', 'moonColor', 'waterColor', 'wallColor', 'mainColor', 'gearColor', 'grainColor', 'cloudColor', 'iceColor', 'rockColor', 'sandColor', 'front', 'trunkColor', 'leafColor', 'nearColor'];
// Figuras que "apoyan" en el piso: en fila se alinean por la base.
export const GROUNDED = new Set(['botanica', 'agro', 'objetos']);

export function executePlan(plan: Plan, doc: Scene, seed: number, text: string): GroupNode | null {
  const rng = createRng(seed);
  const instances: { gen: string; params: Record<string, unknown>; scale: number }[] = [];
  for (const item of plan.items) {
    const g = getGenerator(item.generator);
    if (!g) continue;
    for (let k = 0; k < item.count && instances.length < MAX_INSTANCES; k++) {
      const params = { ...item.params };
      // Paleta repartida entre las figuras (si la figura no tiene paleta propia ni color pedido).
      if (plan.palette.length && !g.params.some((d) => d.key === 'c1')) {
        const main = MAIN_COLOR.find((key) => g.params.some((d) => d.key === key && d.type === 'color'));
        if (main && params[main] === undefined) {
          params[main] = plan.palette[instances.length % plan.palette.length];
          if (g.params.some((d) => d.key === 'customColor')) params.customColor = true;
        }
      }
      instances.push({ gen: g.id, params, scale: item.scale });
    }
  }
  if (!instances.length) return null;

  const N = instances.length;
  const spacing = plan.spacing;
  const area = targetArea(plan, doc);
  const cells = layoutCells(N, plan.layout, doc, spacing, rng, area);

  const children: SceneNode[] = [];
  const counter = new Map<string, number>();
  instances.forEach((inst, i) => {
    const g = getGenerator(inst.gen)!;
    const node = createFromGenerator(inst.gen, { params: inst.params as never, seed: Math.floor(rng.next() * 2 ** 31) });
    if (!node) return;
    const n = (counter.get(g.id) ?? 0) + 1;
    counter.set(g.id, n);
    node.name = instances.filter((x) => x.gen === inst.gen).length > 1 ? `${g.name} ${n}` : g.name;
    placeInCell(node, cells[i], { spacing, scale: inst.scale, sizeVariation: plan.sizeVariation, grounded: GROUNDED.has(g.category) }, rng);
    children.push(node);
  });

  const group: GroupNode = {
    id: newId(),
    name: `«${text.trim().slice(0, 48)}${text.trim().length > 48 ? '…' : ''}»`,
    kind: 'group',
    children,
    transform: { ...IDENTITY },
    opacity: 1,
    hidden: false,
    locked: false,
    prompt: { text, plan, seed },
  };
  if (plan.style && getStyle(plan.style.id)) {
    const fx = newFx(plan.style.id, seed)!;
    fx.params = { ...styleDefaults(getStyle(plan.style.id)!), ...plan.style.params };
    group.fx = fx;
  }
  return group;
}

/**
 * Dónde ubicar lo nuevo: la zona pedida o, si ya hay figuras en la mesa, el lugar libre más grande.
 * Si no queda lugar libre razonable, toda la mesa (y lo avisa en las notas del plan).
 */
export function targetArea(plan: Plan, doc: Scene): Area | undefined {
  const m = Math.min(doc.width, doc.height) * 0.04;
  if (plan.region) {
    const r = plan.region;
    return { x: r.x * doc.width + m, y: r.y * doc.height + m, w: r.w * doc.width - m * 2, h: r.h * doc.height - m * 2 };
  }
  // Las imágenes de referencia no ocupan lugar: se dibuja encima de ellas.
  const visible = doc.nodes.filter((n) => !n.hidden && !(n.kind === 'image' && n.reference));
  if (!visible.length) return undefined;
  // Grilla de ocupación de 16 × 10 celdas.
  const C = 16;
  const R = 10;
  const cw = doc.width / C;
  const ch = doc.height / R;
  const busy = Array.from({ length: R }, () => Array(C).fill(false));
  for (const n of visible) {
    const b = measureLocal({ ...n, transform: { ...IDENTITY } });
    if (!b) continue;
    const corners = [apply(n.transform, [b.x, b.y]), apply(n.transform, [b.x + b.width, b.y]), apply(n.transform, [b.x, b.y + b.height]), apply(n.transform, [b.x + b.width, b.y + b.height])];
    const x0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[0])) / cw));
    const x1 = Math.min(C - 1, Math.floor(Math.max(...corners.map((c) => c[0])) / cw));
    const y0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[1])) / ch));
    const y1 = Math.min(R - 1, Math.floor(Math.max(...corners.map((c) => c[1])) / ch));
    for (let r = y0; r <= y1; r++) for (let c = x0; c <= x1; c++) busy[r][c] = true;
  }
  // El rectángulo libre más grande (búsqueda completa: la grilla es chica).
  let best = { area: 0, c: 0, r: 0, w: 0, h: 0 };
  for (let r0 = 0; r0 < R; r0++)
    for (let c0 = 0; c0 < C; c0++) {
      if (busy[r0][c0]) continue;
      let maxW = C - c0;
      for (let r1 = r0; r1 < R; r1++) {
        let w = 0;
        while (w < maxW && !busy[r1][c0 + w]) w++;
        maxW = w;
        if (!maxW) break;
        const h = r1 - r0 + 1;
        // Se prefieren zonas no demasiado finas.
        const aspect = (maxW * cw) / (h * ch);
        const score = maxW * h * (aspect > 4 || aspect < 0.25 ? 0.5 : 1);
        if (score > best.area) best = { area: score, c: c0, r: r0, w: maxW, h };
      }
    }
  if (best.w * best.h < C * R * 0.12) {
    plan.notes.push('⚠ No había un lugar libre grande: quedó encima de lo que ya estaba');
    return undefined;
  }
  plan.notes.push('Ubicado en el espacio libre de la mesa');
  return { x: best.c * cw + m, y: best.r * ch + m, w: best.w * cw - m * 2, h: best.h * ch - m * 2 };
}

export type Cell = { cx: number; cy: number; w: number; h: number; base?: number };

/** Celdas de la mesa de trabajo según la disposición (fila, grilla, círculo, dispersas, agrupadas). */
export type Area = { x: number; y: number; w: number; h: number };

export function layoutCells(N: number, layoutIn: Layout, doc: Scene, spacing: number, rng: Rng, areaIn?: Area): Cell[] {
  const margin = Math.min(doc.width, doc.height) * 0.06;
  const area = areaIn ?? { x: margin, y: margin, w: doc.width - margin * 2, h: doc.height - margin * 2 };
  const cells: Cell[] = [];
  const layout = N === 1 ? 'single' : layoutIn;
  if (layout === 'single') cells.push({ cx: area.x + area.w / 2, cy: area.y + area.h / 2, w: area.w * 0.8, h: area.h * 0.85 });
  else if (layout === 'row' || layout === 'column') {
    for (let i = 0; i < N; i++) {
      const t = (i + 0.5) / N;
      if (layout === 'row') cells.push({ cx: area.x + area.w * t, cy: area.y + area.h / 2, w: area.w / N, h: area.h * 0.85, base: area.y + area.h * 0.95 });
      else cells.push({ cx: area.x + area.w / 2, cy: area.y + area.h * t, w: area.w * 0.8, h: area.h / N });
    }
  } else if (layout === 'grid') {
    const cols = Math.ceil(Math.sqrt((N * area.w) / area.h));
    const rows = Math.ceil(N / cols);
    for (let i = 0; i < N; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      cells.push({ cx: area.x + (area.w * (c + 0.5)) / cols, cy: area.y + (area.h * (r + 0.5)) / rows, w: area.w / cols, h: area.h / rows });
    }
  } else if (layout === 'circle') {
    const R = Math.min(area.w, area.h) * 0.36;
    const size = Math.min((2 * Math.PI * R) / N, R) * 0.9;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 - Math.PI / 2;
      cells.push({ cx: area.x + area.w / 2 + Math.cos(a) * R, cy: area.y + area.h / 2 + Math.sin(a) * R, w: size, h: size });
    }
  } else {
    // Dispersas o agrupadas: se prueban posiciones al azar y se evitan los choques.
    const size = Math.sqrt((area.w * area.h) / N) * (layout === 'cluster' ? 0.95 : 0.8);
    const placed: { x: number; y: number }[] = [];
    for (let i = 0; i < N; i++) {
      let best = { x: area.x + area.w / 2, y: area.y + area.h / 2 };
      let bestD = -1;
      for (let t = 0; t < 40; t++) {
        const p =
          layout === 'cluster'
            ? { x: area.x + area.w / 2 + rng.jitter(1) * rng.jitter(1) * area.w * 0.55, y: area.y + area.h / 2 + rng.jitter(1) * rng.jitter(1) * area.h * 0.5 }
            : { x: area.x + size / 2 + rng.next() * (area.w - size), y: area.y + size / 2 + rng.next() * (area.h - size) };
        const d = placed.length ? Math.min(...placed.map((q) => Math.hypot(q.x - p.x, q.y - p.y))) : Infinity;
        if (d > size * (0.55 + spacing * 0.5)) {
          best = p;
          break;
        }
        if (d > bestD) {
          bestD = d;
          best = p;
        }
      }
      placed.push(best);
      cells.push({ cx: best.x, cy: best.y, w: size, h: size });
    }
  }

  return cells;
}

/** Escala y ubica una figura dentro de su celda (las que "apoyan" se alinean por la base en fila). */
export function placeInCell(node: SceneNode, cell: Cell, o: { spacing: number; scale: number; sizeVariation: number; grounded: boolean }, rng: Rng) {
  const box = measureLocal({ ...node, transform: { ...IDENTITY } }) ?? { x: -50, y: -50, width: 100, height: 100 };
  const fill = 0.92 - o.spacing * 0.3;
  let s = Math.min((cell.w * fill) / Math.max(1, box.width), (cell.h * fill) / Math.max(1, box.height));
  s *= o.scale * (1 + rng.jitter(o.sizeVariation * 0.45));
  s = Math.max(0.05, Math.min(3, s));
  const grounded = cell.base !== undefined && o.grounded;
  node.transform = {
    ...IDENTITY,
    rotation: 0,
    scale: Math.round(s * 1000) / 1000,
    x: cell.cx - (box.x + box.width / 2) * s,
    y: grounded ? cell.base! - (box.y + box.height) * s : cell.cy - (box.y + box.height / 2) * s,
  };
}
