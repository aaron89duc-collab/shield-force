import { Hazard, HZ, PU, Solid, SolidType } from './entities';
import type { EType } from './enemy';
import type { BossType } from './boss';

export const GROUND_Y = 10;
export const FLOOR_BOTTOM = 16;
export const ARENA_W = 20;

export interface Spawn { type: EType; x: number; y: number; }
export interface BossSpec { type: BossType; hp?: number; name?: string; }

/** Hand-authored level definition built with a tiny DSL (no procedural generation — GDD §1.2). */
export class Level {
  solids: Solid[] = [];
  spawns: Spawn[] = [];
  pickups: { type: PU; x: number; y: number }[] = [];
  hazards: Hazard[] = [];
  checkpoints: number[] = [];
  hints: { x: number; text: string }[] = [];
  lavaPits: { x0: number; x1: number }[] = [];
  arenaX = 0;
  bosses: BossSpec[] = [];
  gravity = 25;
  sandstorm = false;
  ice = false;
  startX = 2;
  reward = 150;
  /** decoration props: [kind, x, y] interpreted by the theme renderer */
  props: { kind: string; x: number; y: number; w?: number; h?: number }[] = [];

  constructor(public index: number, public name: string, public place: string, public theme: number) {}

  ground(x0: number, x1: number, y = GROUND_Y) { this.solids.push(new Solid(x0, y, x1 - x0, FLOOR_BOTTOM - y, SolidType.GROUND)); return this; }
  plat(x: number, y: number, w: number) { this.solids.push(new Solid(x, y, w, 0.4, SolidType.ONEWAY)); return this; }
  block(x: number, y: number, w: number, h: number) { this.solids.push(new Solid(x, y, w, h, SolidType.BLOCK)); return this; }
  belt(x0: number, x1: number, speed: number) {
    const s = new Solid(x0, GROUND_Y, x1 - x0, FLOOR_BOTTOM - GROUND_Y, SolidType.GROUND);
    s.conveyor = speed;
    this.solids.push(s);
    return this;
  }
  e(type: EType, x: number, y = GROUND_Y) { this.spawns.push({ type, x, y }); return this; }
  many(type: EType, xs: number[], y = GROUND_Y) { for (const x of xs) this.e(type, x, y); return this; }
  pk(type: PU, x: number, y: number) { this.pickups.push({ type, x, y }); return this; }
  coins(x0: number, y: number, n: number, gap = 0.9) { for (let i = 0; i < n; i++) this.pk(PU.COIN, x0 + i * gap, y); return this; }
  hz(type: HZ, x: number, y: number, w: number, h: number, period = 3, offset = 0) {
    const hz = new Hazard(type, x, y, w, h);
    hz.period = period; hz.offset = offset;
    if (type === HZ.CRATE) hz.hp = 20;
    this.hazards.push(hz);
    return this;
  }
  barrel(x: number, y = GROUND_Y) { return this.hz(HZ.BARREL, x, y - 1.0, 0.8, 1.0); }
  crate(x: number, y = GROUND_Y) { return this.hz(HZ.CRATE, x, y - 0.9, 0.9, 0.9); }
  lava(x0: number, x1: number) { this.lavaPits.push({ x0, x1 }); return this; }
  cp(x: number) { this.checkpoints.push(x); return this; }
  hint(x: number, text: string) { this.hints.push({ x, text }); return this; }
  prop(kind: string, x: number, y = GROUND_Y, w?: number, h?: number) { this.props.push({ kind, x, y, w, h }); return this; }

  /** Boss arena: lockable walls (GDD §15.1 invisible walls + CameraBounds) and two dodge platforms. */
  arena(x: number, ...bosses: BossSpec[]) {
    this.arenaX = x;
    this.bosses = bosses;
    this.ground(x - 6, x + ARENA_W + 8);
    const left = new Solid(x - 0.6, -20, 0.6, 30, SolidType.WALL);
    left.enabled = false;
    this.solids.push(left);
    this.solids.push(new Solid(x + ARENA_W, -20, 0.6, 30, SolidType.WALL));
    this.plat(x + 3, 7.0, 3.2);
    this.plat(x + ARENA_W - 6.2, 7.0, 3.2);
    this.cp(x - 3);
    return this;
  }

  finish() {
    if (this.ice) for (const s of this.solids) if (s.type !== SolidType.WALL) s.ice = true;
    this.checkpoints.sort((a, b) => a - b);
    return this;
  }
}
