import { overlap } from './util';

export enum SolidType { GROUND, ONEWAY, WALL, BLOCK }

/** Static collision geometry (world units). */
export class Solid {
  conveyor = 0;      // surface speed for factory belts
  ice = false;       // low friction
  enabled = true;
  constructor(public x: number, public y: number, public w: number, public h: number, public type: SolidType) {}
}

/** Axis-aligned body. x,y = top-left. y grows downward. */
export class Body {
  x = 0; y = 0; w = 1; h = 1; vx = 0; vy = 0;
  onGround = false; hitWall = false;
  ground: Solid | null = null;

  cx() { return this.x + this.w * 0.5; }
  cy() { return this.y + this.h * 0.5; }
  overlaps(ox: number, oy: number, ow: number, oh: number) { return overlap(this.x, this.y, this.w, this.h, ox, oy, ow, oh); }

  move(solids: Solid[], dt: number, dropThrough: boolean, walls: boolean) {
    this.hitWall = false;
    this.x += this.vx * dt;
    for (const s of solids) {
      if (!s.enabled || s.type === SolidType.ONEWAY || (s.type === SolidType.WALL && !walls)) continue;
      if (this.x < s.x + s.w && this.x + this.w > s.x && this.y < s.y + s.h - 0.001 && this.y + this.h > s.y + 0.001) {
        if (this.vx > 0 || (this.vx === 0 && this.cx() < s.x + s.w * 0.5)) this.x = s.x - this.w; else this.x = s.x + s.w;
        this.hitWall = true;
      }
    }
    const prevBottom = this.y + this.h, prevTop = this.y;
    this.y += this.vy * dt;
    this.onGround = false;
    this.ground = null;
    for (const s of solids) {
      if (!s.enabled || (s.type === SolidType.WALL && !walls)) continue;
      if (this.x < s.x + s.w - 0.001 && this.x + this.w > s.x + 0.001 && this.y < s.y + s.h && this.y + this.h > s.y) {
        if (s.type === SolidType.ONEWAY) {
          if (this.vy >= 0 && prevBottom <= s.y + 0.06 && !dropThrough) this.land(s);
        } else if (this.vy >= 0 && prevBottom <= s.y + 0.3) {
          this.land(s);
        } else if (this.vy < 0 && prevTop >= s.y + s.h - 0.3) {
          this.y = s.y + s.h; this.vy = 0;
        } else if (this.vy >= 0) {
          this.land(s);
        }
      }
    }
  }

  private land(s: Solid) {
    this.y = s.y - this.h; this.vy = 0; this.onGround = true; this.ground = s;
  }
}

export enum PK { // projectile kinds
  SHOT, BULLET, PLASMA, FIRE, ICE, SAND, ACID, LASER, WAVE, MISSILE, EGG, WEB, SHARD, LAVAWAVE, ROCK, REFLECT, PILLAR,
}

export class Proj {
  active = false;
  team = 0; // 0 player, 1 enemy
  kind = PK.SHOT;
  x = 0; y = 0; vx = 0; vy = 0; w = 0.3; h = 0.3;
  dmg = 0; life = 1; grav = 0; age = 0; pierce = 0;
  reflectable = true; bomb = false; hitsGround = true;
  lastHitId = -1;
  bossMul = 1; // multi-shot projectiles deal reduced boss damage (keeps boss fights meaningful)
  color = 0xffffff;

  reset() {
    this.active = true; this.age = 0; this.grav = 0; this.pierce = 0; this.reflectable = true;
    this.bomb = false; this.hitsGround = true; this.lastHitId = -1; this.bossMul = 1;
  }
}

export enum HZ { BARREL, CRATE, CRUSHER, LASER, GEYSER, LAVA, SPIKES, ICICLE, CONVEYOR }

export class Hazard {
  period = 3; offset = 0; t = 0; hp = 10; alive = true; hurtCd = 0;
  falling = false; fallV = 0; triggered = 0;
  constructor(public type: HZ, public x: number, public y: number, public w: number, public h: number) {}
  phase() { return ((this.t + this.offset) % this.period) / this.period; }
}

export enum PU { SUPER, DOUBLE, TRIPLE, PLASMA, BOMB, HEALTH, ULT, COIN }
export const PU_LETTER = ['S', 'D', 'T', 'P', 'B', 'H', 'U', 'C'];
export const PU_COLOR = [0xe84a3b, 0x3b9be8, 0x6a3be8, 0x3be8d2, 0xe8873b, 0x3be85a, 0xe83bcb, 0xf2c94c];
export const PU_NAME = ['Super Shield', 'Double Shot', 'Triple Shot', 'Plasma Shield', 'Bomb Shield', 'Health', 'Ultimate', 'Coin'];

export class Pickup {
  active = true; vy = 0; t = 0; life: number;
  constructor(public type: PU, public x: number, public y: number, public floating: boolean) {
    this.life = floating ? 1e9 : 14;
  }
}

/** Telegraph marker. style 0 ground marker, 1 horizontal beam line, 2 vertical column */
export class Warn {
  active = false; x = 0; y = 0; w = 0; h = 0; t = 0; dur = 0; style = 0;
}

export class Particle {
  active = false; x = 0; y = 0; vx = 0; vy = 0; life = 0; max = 1; color = 0xffffff; size = 0.1; grav = 0;
}
