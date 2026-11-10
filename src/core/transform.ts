// Matemática de transformaciones (trasladar · rotar · escalar uniforme).
// Como la escala es uniforme, componer dos transformaciones da otra del mismo tipo.
import type { Transform } from './types';

type P = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;

/** Lleva un punto local a coordenadas del padre. */
export function apply(t: Transform, [x, y]: P): P {
  const c = Math.cos(rad(t.rotation));
  const s = Math.sin(rad(t.rotation));
  return [t.x + t.scale * (c * x - s * y), t.y + t.scale * (s * x + c * y)];
}

/** Inversa de apply: del padre al sistema local. */
export function invert(t: Transform, [x, y]: P): P {
  const dx = (x - t.x) / t.scale;
  const dy = (y - t.y) / t.scale;
  const c = Math.cos(rad(-t.rotation));
  const s = Math.sin(rad(-t.rotation));
  return [c * dx - s * dy, s * dx + c * dy];
}

/** parent ∘ child: la transformación del hijo expresada en el sistema del abuelo. */
export function compose(parent: Transform, child: Transform): Transform {
  const [x, y] = apply(parent, [child.x, child.y]);
  return { x, y, rotation: parent.rotation + child.rotation, scale: parent.scale * child.scale };
}

/** child expresado relativo a un nuevo padre (inversa de compose). */
export function relativeTo(parent: Transform, world: Transform): Transform {
  const [x, y] = invert(parent, [world.x, world.y]);
  return { x, y, rotation: world.rotation - parent.rotation, scale: world.scale / parent.scale };
}

/**
 * Cambia rotación y/o escala manteniendo fijo un punto del padre (por ejemplo, el centro de la figura).
 */
export function aroundPoint(t: Transform, pivot: P, next: { rotation?: number; scale?: number }): Transform {
  const q = invert(t, pivot);
  const r = next.rotation ?? t.rotation;
  const s = next.scale ?? t.scale;
  const c = Math.cos(rad(r));
  const sn = Math.sin(rad(r));
  return { x: pivot[0] - s * (c * q[0] - sn * q[1]), y: pivot[1] - s * (sn * q[0] + c * q[1]), rotation: r, scale: s };
}

export const round = (t: Transform): Transform => ({
  x: Math.round(t.x * 100) / 100,
  y: Math.round(t.y * 100) / 100,
  rotation: Math.round(t.rotation * 100) / 100,
  scale: Math.round(t.scale * 1000) / 1000,
});
