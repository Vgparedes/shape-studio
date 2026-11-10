// Operaciones inmutables sobre el árbol de nodos.
import type { Scene, SceneNode, Transform } from './types';

export function newId(prefix = 'n'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

export const IDENTITY: Transform = { x: 0, y: 0, rotation: 0, scale: 1 };

export function emptyScene(width = 1200, height = 800): Scene {
  return { width, height, background: '#ffffff', nodes: [] };
}

export function findNode(nodes: SceneNode[], id: string): SceneNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.kind === 'group') {
      const f = findNode(n.children, id);
      if (f) return f;
    }
  }
  return null;
}

/** Devuelve el padre (null si está en la raíz) y la lista de hermanos donde vive el nodo. */
export function locate(nodes: SceneNode[], id: string, parent: SceneNode | null = null): { parent: SceneNode | null; siblings: SceneNode[]; index: number } | null {
  const index = nodes.findIndex((n) => n.id === id);
  if (index >= 0) return { parent, siblings: nodes, index };
  for (const n of nodes) {
    if (n.kind === 'group') {
      const f = locate(n.children, id, n);
      if (f) return f;
    }
  }
  return null;
}

export function mapNode(nodes: SceneNode[], id: string, fn: (n: SceneNode) => SceneNode): SceneNode[] {
  let changed = false;
  const out = nodes.map((n) => {
    if (n.id === id) {
      changed = true;
      return fn(n);
    }
    if (n.kind === 'group') {
      const children = mapNode(n.children, id, fn);
      if (children !== n.children) {
        changed = true;
        return { ...n, children };
      }
    }
    return n;
  });
  return changed ? out : nodes;
}

export function removeNodes(nodes: SceneNode[], ids: Set<string>): SceneNode[] {
  return nodes
    .filter((n) => !ids.has(n.id))
    .map((n) => (n.kind === 'group' ? { ...n, children: removeNodes(n.children, ids) } : n));
}

/** Copia profunda con ids nuevos. */
export function cloneNode(n: SceneNode, rename = true): SceneNode {
  const base = { ...n, id: newId(), name: rename ? `${n.name} copia` : n.name };
  if (n.kind === 'group') return { ...base, kind: 'group', children: n.children.map((c) => cloneNode(c, false)) };
  return { ...base, kind: 'path', d: n.d, style: { ...n.style } } as SceneNode;
}

/** Mueve un nodo dentro de sus hermanos. delta +1 = un lugar más arriba (se dibuja encima). */
export function reorderNode(nodes: SceneNode[], id: string, delta: number): SceneNode[] {
  const index = nodes.findIndex((n) => n.id === id);
  if (index >= 0) {
    const to = Math.max(0, Math.min(nodes.length - 1, index + delta));
    if (to === index) return nodes;
    const out = nodes.slice();
    const [item] = out.splice(index, 1);
    out.splice(to, 0, item);
    return out;
  }
  let changed = false;
  const out = nodes.map((n) => {
    if (n.kind !== 'group') return n;
    const children = reorderNode(n.children, id, delta);
    if (children === n.children) return n;
    changed = true;
    return { ...n, children };
  });
  return changed ? out : nodes;
}

export function countNodes(nodes: SceneNode[]): number {
  return nodes.reduce((acc, n) => acc + 1 + (n.kind === 'group' ? countNodes(n.children) : 0), 0);
}
