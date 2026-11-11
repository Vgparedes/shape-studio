// Ayudas para que los generadores armen nodos sin repetir código.
import type { GroupNode, ParamValues, PathNode, SceneNode, Style } from '../../core/types';
import { IDENTITY } from '../../core/scene';
import type { GenContext } from './types';

export function pathNode(ctx: GenContext, name: string, d: string, style: Style, role?: string): PathNode {
  return { id: ctx.uid(), name, kind: 'path', d, style, transform: { ...IDENTITY }, opacity: 1, hidden: false, locked: false, ...(role ? { role } : {}) };
}

export function groupNode(ctx: GenContext, name: string, children: SceneNode[], role?: string): GroupNode {
  return { id: ctx.uid(), name, kind: 'group', children, transform: { ...IDENTITY }, opacity: 1, hidden: false, locked: false, ...(role ? { role } : {}) };
}

/** Relleno con contorno fino (aspecto de ilustración). Con grosor 0 queda sin contorno. */
export const filled = (fill: string, outline: string, width: number): Style => ({
  fill,
  stroke: width > 0 ? outline : null,
  strokeWidth: width,
  lineJoin: 'round',
  lineCap: 'round',
});

/**
 * Silueta: varias formas superpuestas que se ven como una sola, con contorno solo por fuera
 * (tronco y ramas, copas, raíces). El trazo va al doble porque la mitad queda tapada por el relleno.
 */
export const silhouette = (fill: string, outline: string, width: number): Style => ({
  ...filled(fill, outline, width * 2),
  paintOrder: 'stroke',
});

export const line = (color: string, width: number): Style => ({ fill: null, stroke: color, strokeWidth: width, lineCap: 'round', lineJoin: 'round' });

/** Lectores tipados de parámetros. */
export const reader = (p: ParamValues) => ({
  n: (k: string) => Number(p[k]),
  i: (k: string) => Math.round(Number(p[k])),
  s: (k: string) => String(p[k]),
  b: (k: string) => Boolean(p[k]),
});

/** Saca los nodos vacíos (por ejemplo, un grupo de hojas cuando hay 0 hojas). */
export const compact = (nodes: (SceneNode | null | false | undefined | '' | 0)[]): SceneNode[] =>
  nodes.filter((n): n is SceneNode => !!n && (n.kind === 'path' ? n.d.length > 0 : n.kind === 'group' ? n.children.length > 0 : true));
