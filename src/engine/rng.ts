export type Rng = () => number;
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = <T,>(r: Rng, a: T[]): T => a[Math.floor(r() * a.length)];
export function pickW<T extends { w: number }>(r: Rng, a: T[]): T {
  let t = 0;
  for (const x of a) t += x.w;
  let v = r() * t;
  for (const x of a) { v -= x.w; if (v <= 0) return x; }
  return a[a.length - 1];
}
