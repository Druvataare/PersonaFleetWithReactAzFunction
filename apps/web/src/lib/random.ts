/* Seeded PRNG from the wireframe. Every helper consumes exactly one random
   number, so the call order below reproduces the wireframe's sample data. */

export function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Random {
  rnd: () => number;
  /** Random element. On an empty array it still consumes a number and returns undefined, like the wireframe. */
  pick: <T>(items: readonly T[]) => T;
  /** Rounded integer between a and b inclusive. */
  iBetween: (a: number, b: number) => number;
}

export function createRandom(seed: number): Random {
  const rnd = mulberry32(seed);
  return {
    rnd,
    pick: <T>(items: readonly T[]) => items[Math.floor(rnd() * items.length)] as T,
    iBetween: (a, b) => Math.round(a + rnd() * (b - a)),
  };
}
