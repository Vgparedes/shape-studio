// Kit para escribir generadores rápido: siluetas por perfil, círculos, nodos con estilo
// tomado de los parámetros de contorno, y repetición radial.
import type { ParamDef, GenContext } from './types';
import type { PathNode, SceneNode, Style } from '../../core/types';
import type { Pt } from '../geometry/path';
import { pt, smoothPath, polyline } from '../geometry/path';
import { filled, groupNode, line, pathNode, reader } from './build';

export { pt };

/**
 * Silueta simétrica a partir de un perfil de ancho: sirve para jarrones, botellas, frutas,
 * peces, llamas, torres... t va de 0 (arriba) a 1 (abajo) y width(t) es el ancho total en ese punto.
 * Con `axis: 'x'` la figura queda acostada (t de izquierda a derecha).
 */
export function profileShape(height: number, width: (t: number) => number, opts: { axis?: 'x' | 'y'; samples?: number; smooth?: boolean; shift?: (t: number) => number; offset?: Pt } = {}): string {
  const n = opts.samples ?? 40;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = Math.max(0, width(t)) / 2;
    const y = -height / 2 + height * t;
    const s = opts.shift?.(t) ?? 0;
    left.push([s - w, y]);
    right.push([s + w, y]);
  }
  let pts = [...right, ...left.reverse()];
  if (opts.axis === 'x') pts = pts.map(([x, y]) => [y, x] as Pt);
  if (opts.offset) pts = pts.map(([x, y]) => [x + opts.offset![0], y + opts.offset![1]] as Pt);
  return opts.smooth === false ? polyline(pts, true) : smoothPath(pts, true, 0.9);
}

export function circle(cx: number, cy: number, r: number): string {
  // Sentido horario, igual que rect(): así al superponerse en un mismo path no se generan agujeros.
  return `M${cx - r} ${cy}a${r} ${r} 0 1 1 ${r * 2} 0a${r} ${r} 0 1 1 ${-r * 2} 0Z`;
}

export function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 1 ${rx * 2} 0a${rx} ${ry} 0 1 1 ${-rx * 2} 0Z`;
}

export function rect(x: number, y: number, w: number, h: number, r = 0): string {
  if (r <= 0) return `M${x} ${y}h${w}v${h}h${-w}Z`;
  const rr = Math.min(r, w / 2, h / 2);
  return `M${x + rr} ${y}h${w - 2 * rr}a${rr} ${rr} 0 0 1 ${rr} ${rr}v${h - 2 * rr}a${rr} ${rr} 0 0 1 ${-rr} ${rr}h${-(w - 2 * rr)}a${rr} ${rr} 0 0 1 ${-rr} ${-rr}v${-(h - 2 * rr)}a${rr} ${rr} 0 0 1 ${rr} ${-rr}Z`;
}

/** Espeja puntos respecto del eje vertical y los junta (para dibujar media figura). */
export function mirrored(half: Pt[]): Pt[] {
  return [...half, ...half.slice().reverse().map(([x, y]) => [-x, y] as Pt)];
}

/** Parámetros de contorno estándar. */
export const outlineParams = (width = 1.4, color = '#2b2620'): ParamDef[] => [
  { key: 'outlineColor', label: 'Contorno', group: 'Colores', type: 'color', default: color },
  { key: 'outlineWidth', label: 'Grosor del contorno', group: 'Colores', type: 'number', min: 0, max: 8, step: 0.1, default: width, unit: 'px' },
];

export const colors = (d: Record<string, [string, string]>): ParamDef[] =>
  Object.entries(d).map(([key, [label, value]]): ParamDef => ({ key, label, group: 'Colores', type: 'color', default: value }));

/** Atajos ligados al contexto: relleno con el contorno de los parámetros, líneas, grupos. */
export function kit(ctx: GenContext) {
  const r = reader(ctx.params);
  const oc = () => (ctx.params.outlineColor ? String(ctx.params.outlineColor) : '#2b2620');
  const ow = () => (ctx.params.outlineWidth !== undefined ? Number(ctx.params.outlineWidth) : 1.4);
  return {
    ...r,
    rng: ctx.rng,
    /** Forma rellena con el contorno elegido. */
    fill: (name: string, d: string, color: string, role?: string, outlineScale = 1): PathNode => pathNode(ctx, name, d, filled(color, oc(), ow() * outlineScale), role),
    /** Forma rellena sin contorno. */
    flat: (name: string, d: string, color: string, role?: string): PathNode => pathNode(ctx, name, d, filled(color, color, 0), role),
    /** Trazo. */
    stroke: (name: string, d: string, color: string, width: number, role?: string): PathNode => pathNode(ctx, name, d, line(color, width), role),
    styled: (name: string, d: string, style: Style, role?: string): PathNode => pathNode(ctx, name, d, style, role),
    group: (name: string, children: (SceneNode | null | false | '' | undefined)[], role?: string) =>
      groupNode(
        ctx,
        name,
        children.filter((c): c is SceneNode => !!c && (c.kind === 'path' ? c.d.length > 0 : c.children.length > 0)),
        role,
      ),
    /** Ubica un nodo (traslada, rota, escala). */
    at: <T extends SceneNode>(node: T, x: number, y: number, rotation = 0, scale = 1): T => {
      node.transform = { x, y, rotation, scale };
      return node;
    },
    outlineColor: oc,
    outlineWidth: ow,
  };
}

/** Saca huecos (false, '', null) y paths vacíos de una lista de nodos. */
export function clean(items: unknown[]): SceneNode[] {
  return items.filter((x): x is SceneNode => !!x && typeof x === 'object' && ((x as SceneNode).kind === 'group' ? (x as { children: SceneNode[] }).children.length > 0 : ((x as { d: string }).d ?? '').length > 0));
}

/**
 * Orienta un contorno siempre en el mismo sentido (horario en pantalla).
 * Cuando varias formas se juntan en un solo path, si unas van en un sentido y otras en el otro,
 * donde se superponen aparecen agujeros. Esto lo evita.
 */
export function clockwise(pts: Pt[]): Pt[] {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    area += x1 * y2 - x2 * y1;
  }
  return area < 0 ? pts.slice().reverse() : pts;
}
