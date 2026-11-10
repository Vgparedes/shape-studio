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
