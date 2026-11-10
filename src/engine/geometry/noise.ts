// Ruido procedural suave con semilla: da ondulaciones naturales a tallos, raíces y bordes.
import type { Rng } from '../../core/random';

/** Ruido de valor 1D en [-1, 1], continuo y suave. */
export function noise1D(rng: Rng): (x: number) => number {
  const table = Array.from({ length: 256 }, () => rng.next() * 2 - 1);
  return (x: number) => {
    const i = Math.floor(x);
    const f = x - i;
    const a = table[i & 255];
    const b = table[(i + 1) & 255];
    const t = f * f * (3 - 2 * f);
    return a + (b - a) * t;
  };
}

/** Suma de octavas: más detalle sin perder la forma general. */
export function fbm1D(rng: Rng, octaves = 3): (x: number) => number {
  const layers = Array.from({ length: octaves }, () => noise1D(rng));
  return (x: number) => {
    let sum = 0;
    let amp = 1;
    let total = 0;
    layers.forEach((n, i) => {
      sum += n(x * 2 ** i) * amp;
      total += amp;
      amp *= 0.5;
    });
    return sum / total;
  };
}

/** Ruido de valor 2D en [-1, 1], suave (para campos de flujo y texturas). */
export function noise2D(rng: Rng): (x: number, y: number) => number {
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const vals = Array.from({ length: 256 }, () => rng.next() * 2 - 1);
  const h = (x: number, y: number) => vals[perm[(perm[x & 255] + y) & 255]];
  const s = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = s(x - xi);
    const fy = s(y - yi);
    const a = h(xi, yi) + (h(xi + 1, yi) - h(xi, yi)) * fx;
    const b = h(xi, yi + 1) + (h(xi + 1, yi + 1) - h(xi, yi + 1)) * fx;
    return a + (b - a) * fy;
  };
}
