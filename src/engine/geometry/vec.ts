// Operaciones de vectores 2D y 3D.
import type { Pt } from './path';

export type V3 = [number, number, number];

export const DEG = Math.PI / 180;
export const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
export const len = (a: Pt) => Math.hypot(a[0], a[1]);
export const norm = (a: Pt): Pt => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};
/** Perpendicular a la izquierda (girando 90° en sentido antihorario en pantalla). */
export const perp = (a: Pt): Pt => [a[1], -a[0]];
export const dir = (deg: number): Pt => [Math.cos(deg * DEG), Math.sin(deg * DEG)];
export const rotate = (p: Pt, deg: number): Pt => {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
};

/** Lleva puntos dibujados en un sistema local (eje x = "hacia adelante") a una posición y un ángulo. */
export function place(points: Pt[], origin: Pt, headingDeg: number, scale = 1, mirror = false): Pt[] {
  return points.map((p) => add(origin, rotate([p[0] * scale, (mirror ? -p[1] : p[1]) * scale], headingDeg)));
}

export const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const mul3 = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const cross3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm3 = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Ángulo más corto entre dos rumbos, en grados (-180, 180]. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}
