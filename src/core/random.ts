// Aleatoriedad reproducible: la misma semilla siempre da el mismo dibujo.

export interface Rng {
  next(): number; // [0, 1)
  range(min: number, max: number): number;
  int(min: number, max: number): number; // incluye ambos extremos
  pick<T>(items: readonly T[]): T;
  /** Variación simétrica alrededor de 0: [-amount, amount]. */
  jitter(amount: number): number;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0 || 1;
  const next = () => {
    // mulberry32
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    pick: (items) => items[Math.floor(next() * items.length)],
    jitter: (amount) => (next() * 2 - 1) * amount,
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
