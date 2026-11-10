// Mide la caja que ocupa una figura usando el motor SVG del navegador
// (incluye curvas y transformaciones de los hijos, cosa difícil de calcular a mano).
import type { SceneNode } from '../core/types';
import { nodeMarkup } from './svg';

export type BBox = { x: number; y: number; width: number; height: number };

let host: SVGSVGElement | null = null;

function getHost(): SVGSVGElement {
  if (host && host.isConnected) return host;
  host = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:absolute;left:-10000px;top:-10000px;width:10px;height:10px;visibility:hidden;pointer-events:none';
  document.body.appendChild(host);
  return host;
}

/** Caja de la figura en sus coordenadas propias (sin su transformación). */
export function measureLocal(node: SceneNode): BBox | null {
  if (typeof document === 'undefined') return null;
  const h = getHost();
  const bare = { ...node, transform: { x: 0, y: 0, rotation: 0, scale: 1 }, hidden: false } as SceneNode;
  h.innerHTML = nodeMarkup(bare);
  const el = h.firstElementChild as SVGGraphicsElement | null;
  try {
    const b = el?.getBBox();
    if (!b || (!b.width && !b.height)) return null;
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  } catch {
    return null;
  } finally {
    h.innerHTML = '';
  }
}
