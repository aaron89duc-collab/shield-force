/** Math helpers + deterministic RNG. World units: 1 unit = PPU pixels, y grows downward. */
export const PPU = 48;

let seed = 0x2545f491;
export function reseed(s: number) { seed = (s >>> 0) || 1; }
/** xorshift32 in [0,1) */
export function rnd(): number {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed / 4294967296;
}
export const rndr = (a: number, b: number) => a + (b - a) * rnd();
export const rndi = (n: number) => Math.floor(rnd() * n) % Math.max(1, n);
export function hash(i: number): number {
  let x = Math.imul(i, 374761393) + 668265263;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x = x ^ (x >>> 16);
  return (x & 0xffffff) / 0x1000000;
}
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const sign = (v: number) => (v < 0 ? -1 : 1);
export function approach(v: number, target: number, delta: number) {
  return v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);
}
export function overlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
export function fmtTime(sec: number) {
  const s = Math.floor(sec), m = Math.floor(s / 60), r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}
