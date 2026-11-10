// Aplica el estilo de un nodo (y de sus hijos) en el momento de dibujar o exportar.
// La figura original queda intacta en el documento; esto produce la versión estilizada.
import type { SceneNode, StyleFx } from '../../core/types';
import { createRng } from '../../core/random';
import { newId } from '../../core/scene';
import { measureLocal } from '../../render/measure';
import type { GenContext } from '../generators/types';
import { getStyle, styleDefaults } from './styles';

export { STYLES, getStyle, styleDefaults } from './styles';

const cache = new Map<string, SceneNode>();
const CACHE_MAX = 120;

const IDENT = { x: 0, y: 0, rotation: 0, scale: 1 };

function styleSubtree(n: SceneNode, ctx: GenContext, styleId: string): SceneNode {
  if (n.hidden) return n;
  // Un hijo con su propio estilo manda sobre el del padre.
  if (n.fx) return applyFx(n);
  if (n.kind === 'group') return { ...n, children: n.children.map((c) => styleSubtree(c, ctx, styleId)) };
  const def = getStyle(styleId)!;
  const parts = def.path(n, ctx);
  const t = parts[0]?.transform;
  if (parts.length === 1 && parts[0].kind === 'path' && t && !t.x && !t.y && !t.rotation && t.scale === 1) {
    return { ...parts[0], id: n.id, name: n.name, transform: n.transform, opacity: n.opacity * parts[0].opacity, locked: n.locked, role: n.role };
  }
  return { id: n.id, name: n.name, kind: 'group', children: parts, transform: n.transform, opacity: n.opacity, hidden: false, locked: n.locked, role: n.role };
}

/** Devuelve el nodo ya estilizado (sin `fx`). Si no tiene estilo, lo devuelve igual. */
export function applyFx(node: SceneNode): SceneNode {
  const fx = node.fx;
  if (!fx) return node;
  const def = getStyle(fx.style);
  const { fx: _drop, ...plain } = node;
  void _drop;
  if (!def) return plain as SceneNode;
  // La posición, opacidad y nombre del nodo no cambian el resultado: se dejan afuera de la clave.
  const key = JSON.stringify({ ...plain, transform: null, opacity: null, name: null, locked: null, fx });
  const hit = cache.get(key);
  if (hit) return { ...hit, transform: node.transform, opacity: node.opacity, name: node.name, locked: node.locked };

  const ctx: GenContext = { params: { ...styleDefaults(def), ...fx.params }, rng: createRng(fx.seed), uid: () => newId() };
  let out = styleSubtree({ ...(plain as SceneNode), transform: IDENT }, ctx, fx.style);
  if (def.decorate) {
    const box = measureLocal(out);
    if (box) {
      const extra = def.decorate(box, ctx);
      if (extra.length) out = out.kind === 'group' ? { ...out, children: [...out.children, ...extra] } : { id: out.id, name: out.name, kind: 'group', children: [{ ...out, id: newId() }, ...extra], transform: IDENT, opacity: 1, hidden: false, locked: false, role: out.role };
    }
  }
  cache.set(key, out);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  return { ...out, transform: node.transform, opacity: node.opacity, name: node.name, locked: node.locked };
}

export function newFx(styleId: string, seed: number): StyleFx | null {
  const def = getStyle(styleId);
  return def ? { style: styleId, params: styleDefaults(def), seed } : null;
}
