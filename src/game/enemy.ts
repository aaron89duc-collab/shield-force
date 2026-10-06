import { Body, PK } from './entities';
import { approach, clamp, rnd, rndr } from './util';
import { Sfx } from '../systems/sound';
import type { World } from './world';

export enum B { CHASE, DRONE, SHIELDER, LEAPER, SHOOTER, BOMBER, DROPPER, TREE, BURROW, CHARGER, FIREDASH, SLAMMER }
export enum S { PATROL, CHASE, WINDUP, ATTACK, COOL, LEAP, HANG, BURROW, EMERGE, CHARGE, STUN, FUSE, AIM }

export interface EType {
  key: string; title: string; hp: number; dmg: number; speed: number; w: number; h: number;
  beh: B; flying: boolean; c1: number; c2: number;
}

const T = (key: string, title: string, hp: number, dmg: number, speed: number, w: number, h: number, beh: B, flying: boolean, c1: number, c2: number): EType =>
  ({ key, title, hp, dmg, speed, w, h, beh, flying, c1, c2 });

/** Enemy roster (GDD §7). */
export const E = {
  MUTANT: T('mutant', 'Mutant Soldier', 30, 10, 2.6, 0.8, 1.5, B.CHASE, false, 0x6b8e3a, 0x3e5226),
  DRONE: T('drone', 'Flying Drone', 20, 8, 3.2, 0.95, 0.6, B.DRONE, true, 0x8a93a6, 0xe84a3b),
  SHIELDER: T('shielder', 'Shield Soldier', 50, 12, 2.0, 0.9, 1.55, B.SHIELDER, false, 0x4a5a78, 0x9aa6b8),
  RAT: T('rat', 'Giant Rat', 15, 6, 3.6, 0.95, 0.55, B.LEAPER, false, 0x7a6656, 0x3a2e26),
  ROBOT: T('robot', 'Factory Robot', 45, 10, 1.3, 1.1, 1.5, B.SHOOTER, false, 0xc48a2e, 0x4e4a44),
  BUG: T('bug', 'Explosive Bug', 18, 25, 3.9, 0.8, 0.6, B.BOMBER, false, 0xd94b2b, 0x2b2b2b),
  WEREWOLF: T('werewolf', 'Werewolf', 55, 18, 3.3, 1.0, 1.7, B.LEAPER, false, 0x5e5568, 0x2e2838),
  SPIDER: T('spider', 'Spider', 20, 8, 2.8, 0.95, 0.6, B.DROPPER, false, 0x2e2e36, 0xc03b3b),
  TREE: T('tree', 'Tree Monster', 100, 20, 0, 1.6, 2.6, B.TREE, false, 0x5a4028, 0x3f7a33),
  SCORPION: T('scorpion', 'Scorpion', 35, 12, 1.8, 1.3, 0.8, B.SHOOTER, false, 0xb8862e, 0x6e4e1e),
  SANDMON: T('sandmon', 'Sand Monster', 80, 20, 2.6, 1.2, 1.8, B.BURROW, false, 0xcfae6a, 0x8a6e3a),
  ICEMON: T('icemon', 'Ice Monster', 70, 15, 2.0, 1.3, 1.7, B.CHARGER, false, 0x9ad4f0, 0x4a86b0),
  CYBORG: T('cyborg', 'Cyborg', 60, 18, 1.6, 0.9, 1.6, B.SHOOTER, false, 0x707a88, 0x35e0f0),
  FIREDEMON: T('firedemon', 'Fire Demon', 65, 16, 2.2, 1.0, 1.7, B.FIREDASH, false, 0xd8461e, 0xffc23b),
  LAVAMON: T('lavamon', 'Lava Monster', 120, 25, 1.0, 1.6, 2.0, B.SLAMMER, false, 0x3a2420, 0xff6a1e),
  ALIEN: T('alien', 'Alien Soldier', 45, 14, 1.8, 0.85, 1.6, B.SHOOTER, false, 0x5e3aa8, 0x7cff5a),
  ALIENSPIDER: T('alienspider', 'Alien Spider', 40, 15, 3.0, 1.1, 0.7, B.LEAPER, false, 0x3a7a3a, 0xb8ff5a),
};
export const ALL_ENEMIES: EType[] = Object.values(E);

let nextId = 1;

/** Regular enemy with FSM (GDD §7.1). */
export class Enemy extends Body {
  readonly id = nextId++;
  hp: number; maxHp: number;
  state = S.PATROL;
  t = 0; cd = rndr(0.3, 1.2); flash = 0; anim = rnd() * 10;
  facing = -1;
  homeX: number;
  alive = true; awake = false; invulnerable = false;
  shots = 0; shieldStamp = -1; minion = false;
  private patrolDir = -1;
  private alt = 0;
  sprite: any = null;

  constructor(public type: EType, x: number, y: number) {
    super();
    this.w = type.w; this.h = type.h;
    this.x = x - this.w / 2; this.y = y - this.h;
    this.homeX = this.x;
    this.hp = this.maxHp = type.hp;
    if (type.beh === B.DROPPER) this.state = S.HANG;
    if (type.beh === B.BURROW) { this.state = S.BURROW; this.invulnerable = true; }
  }

  hidden() { return this.state === S.BURROW; }

  update(W: World, dt: number) {
    const p = W.player;
    this.anim += dt; this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.cd > 0) this.cd -= dt;
    const dx = p.cx() - this.cx(), dy = p.cy() - this.cy(), adx = Math.abs(dx);
    const sees = !p.dead && adx < 11 && Math.abs(dy) < 6;
    if (sees) this.awake = true;
    const ty = this.type;

    switch (ty.beh) {
      case B.DRONE: this.drone(W, dt, dx, sees); break;
      case B.TREE: this.tree(W, dt, dx, adx, sees); break;
      case B.DROPPER:
        if (this.state === S.HANG) {
          this.vx = 0; this.vy = 0;
          if (adx < 2.6 && dy > -1 && !p.dead) { this.state = S.CHASE; this.t = 0; W.sfx(Sfx.JUMP); }
          return;
        }
        this.walker(W, dt, dx, adx, dy, sees, ty.speed, 0.32, 1.0);
        break;
      case B.BURROW: this.burrow(W, dt, dx, adx, sees); break;
      case B.CHASE: this.walker(W, dt, dx, adx, dy, sees, ty.speed, 0.35, 1.1); break;
      case B.SHIELDER: this.walker(W, dt, dx, adx, dy, sees, ty.speed, 0.45, 1.2); break;
      case B.LEAPER: this.leaper(W, dt, dx, adx, dy, sees); break;
      case B.SHOOTER: this.shooter(W, dt, dx, adx, sees); break;
      case B.BOMBER: this.bomber(W, dt, dx, adx, dy, sees); break;
      case B.CHARGER: this.charger(W, dt, dx, adx, dy, sees, false); break;
      case B.FIREDASH: this.charger(W, dt, dx, adx, dy, sees, true); break;
      case B.SLAMMER: this.slammer(W, dt, dx, adx, dy, sees); break;
    }

    if (!ty.flying) {
      this.vy = Math.min(this.vy + W.gravity * dt, 18);
      this.move(W.solids, dt, false, true);
    }
    if (this.y > W.killY + 2) this.alive = false;
    // contact damage (half), except hidden/hanging
    if (this.alive && !this.hidden() && this.state !== S.HANG && p.overlaps(this.x + 0.1, this.y + 0.1, this.w - 0.2, this.h - 0.1)) {
      W.hurtPlayer(Math.ceil(ty.dmg * 0.5), this.cx(), true, true);
    }
  }

  private groundAhead(W: World, dir: number) {
    const px = dir > 0 ? this.x + this.w + 0.15 : this.x - 0.15;
    return W.solidAt(px, this.y + this.h + 0.3);
  }

  private walk(W: World, speed: number, dir: number, dt: number) {
    this.facing = dir;
    if (this.onGround && !this.groundAhead(W, dir)) { this.vx = 0; return; }
    this.vx = approach(this.vx, dir * speed, 30 * dt);
    if (this.hitWall && this.onGround) this.vy = -8.5;
  }

  private patrol(W: World, dt: number) {
    if (this.type.speed <= 0) { this.vx = 0; return; }
    if (this.x < this.homeX - 2) this.patrolDir = 1;
    if (this.x > this.homeX + 2) this.patrolDir = -1;
    if (this.onGround && !this.groundAhead(W, this.patrolDir)) this.patrolDir = -this.patrolDir;
    this.walk(W, this.type.speed * 0.35, this.patrolDir, dt);
  }

  private melee(W: World, reach: number) {
    const hx = this.facing > 0 ? this.x + this.w : this.x - reach;
    if (W.player.overlaps(hx, this.y + 0.1, reach, this.h - 0.1)) W.hurtPlayer(this.type.dmg, this.cx(), true, true);
  }

  private walker(W: World, dt: number, dx: number, adx: number, dy: number, sees: boolean, spd: number, windup: number, reach: number) {
    switch (this.state) {
      case S.PATROL: this.patrol(W, dt); if (sees) this.state = S.CHASE; break;
      case S.CHASE:
        if (!sees && this.t > 3) { this.state = S.PATROL; break; }
        if (adx < reach + 0.15 && Math.abs(dy) < 1.4 && this.cd <= 0) {
          this.state = S.WINDUP; this.t = 0; this.vx = 0; this.facing = dx > 0 ? 1 : -1;
        } else if (adx > 0.4) this.walk(W, spd, dx > 0 ? 1 : -1, dt);
        else this.vx = 0;
        break;
      case S.WINDUP:
        this.vx = approach(this.vx, 0, 30 * dt);
        if (this.t > windup) { this.state = S.ATTACK; this.t = 0; this.melee(W, reach); }
        break;
      case S.ATTACK: if (this.t > 0.18) { this.state = S.COOL; this.t = 0; this.cd = 0.8; } break;
      case S.COOL: this.vx = approach(this.vx, 0, 20 * dt); if (this.t > 0.35) { this.state = S.CHASE; this.t = 0; } break;
      default: this.state = S.CHASE;
    }
  }

  private leaper(W: World, dt: number, dx: number, adx: number, dy: number, sees: boolean) {
    const rat = this.type === E.RAT;
    const leapV = this.type === E.WEREWOLF ? 10.5 : rat ? 7.5 : 9;
    switch (this.state) {
      case S.PATROL: this.patrol(W, dt); if (sees) this.state = S.CHASE; break;
      case S.CHASE:
        if (this.type === E.ALIENSPIDER && this.cd <= 0 && adx > 3 && adx < 8 && this.alt++ % 2 === 0) {
          this.facing = dx > 0 ? 1 : -1;
          const pr = W.fireEnemy(PK.WEB, this.cx() + this.facing * 0.5, this.cy(), this.facing * 7, -1.5, 6);
          if (pr) pr.grav = 4;
          this.cd = 1.5;
          break;
        }
        if (this.onGround && this.cd <= 0 && adx < (rat ? 4 : 5.5) && adx > 1.2 && Math.abs(dy) < 2.5) {
          this.state = S.WINDUP; this.t = 0; this.vx = 0; this.facing = dx > 0 ? 1 : -1;
        } else this.walk(W, this.type.speed, dx > 0 ? 1 : -1, dt);
        break;
      case S.WINDUP:
        this.vx = 0;
        if (this.t > (rat ? 0.2 : 0.38)) {
          this.state = S.LEAP; this.t = 0;
          this.vy = -leapV;
          this.vx = this.facing * clamp(adx * 1.6, 4, rat ? 6.5 : 8.5);
          this.onGround = false;
        }
        break;
      case S.LEAP:
        if (W.player.overlaps(this.x, this.y, this.w, this.h)) W.hurtPlayer(this.type.dmg, this.cx(), true, true);
        if (this.t > 0.15 && this.onGround) { this.state = S.COOL; this.t = 0; this.cd = rat ? 0.6 : 1.1; this.vx = 0; }
        break;
      case S.COOL: this.vx = approach(this.vx, 0, 25 * dt); if (this.t > 0.4) { this.state = S.CHASE; this.t = 0; } break;
      default: this.state = S.CHASE;
    }
  }

  private shooter(W: World, dt: number, dx: number, adx: number, sees: boolean) {
    const ty = this.type;
    const burst = ty === E.ROBOT || ty === E.CYBORG ? 3 : ty === E.ALIEN ? 2 : 1;
    const interval = ty === E.CYBORG ? 0.12 : ty === E.ALIEN ? 0.25 : 0.16;
    switch (this.state) {
      case S.PATROL: this.patrol(W, dt); if (sees) this.state = S.CHASE; break;
      case S.CHASE:
        this.facing = dx > 0 ? 1 : -1;
        if (adx > 6.5) this.walk(W, ty.speed, this.facing, dt);
        else if (adx < 2.5) this.walk(W, ty.speed * 0.7, -this.facing, dt);
        else this.vx = approach(this.vx, 0, 20 * dt);
        this.facing = dx > 0 ? 1 : -1;
        if (this.cd <= 0 && sees && adx < 10) { this.state = S.AIM; this.t = 0; this.shots = 0; }
        break;
      case S.AIM:
        this.vx = approach(this.vx, 0, 30 * dt);
        this.facing = dx > 0 ? 1 : -1;
        if (this.t > 0.45) { this.state = S.ATTACK; this.t = interval; }
        break;
      case S.ATTACK:
        this.vx = 0;
        if (this.t >= interval) {
          this.t = 0;
          const p = W.player;
          let sx = this.cx() + this.facing * (this.w * 0.5 + 0.2), sy = this.y + this.h * 0.35;
          if (ty === E.SCORPION) {
            sy = this.y;
            const time = 0.9;
            const pr = W.fireEnemy(PK.ACID, sx, sy, (p.cx() - sx) / time, (p.cy() - sy) / time - 0.5 * 14 * time, ty.dmg);
            if (pr) pr.grav = 14;
          } else {
            let ang = Math.atan2(p.cy() - sy, p.cx() - sx);
            const maxA = 0.5;
            if (this.facing > 0) ang = clamp(ang, -maxA, maxA);
            else {
              if (ang > 0 && ang < Math.PI - maxA) ang = Math.PI - maxA;
              if (ang < 0 && ang > -Math.PI + maxA) ang = -Math.PI + maxA;
            }
            const kind = ty === E.CYBORG ? PK.LASER : ty === E.ALIEN ? PK.PLASMA : PK.BULLET;
            const sp = ty === E.CYBORG ? 12 : 8;
            W.fireEnemy(kind, sx, sy, Math.cos(ang) * sp, Math.sin(ang) * sp, ty.dmg);
          }
          if (++this.shots >= burst) { this.state = S.COOL; this.t = 0; this.cd = rndr(1.6, 2.4); }
        }
        break;
      case S.COOL: if (this.t > 0.4) { this.state = S.CHASE; this.t = 0; } break;
      default: this.state = S.CHASE;
    }
  }

  private bomber(W: World, dt: number, dx: number, adx: number, dy: number, sees: boolean) {
    switch (this.state) {
      case S.PATROL: this.patrol(W, dt); if (sees) this.state = S.CHASE; break;
      case S.CHASE:
        this.walk(W, this.type.speed, dx > 0 ? 1 : -1, dt);
        if (adx < 1.0 && Math.abs(dy) < 1.5) { this.state = S.FUSE; this.t = 0; }
        break;
      case S.FUSE:
        this.vx = approach(this.vx, 0, 15 * dt);
        if (this.t > 0.3) this.explodeSelf(W);
        break;
      default: this.state = S.CHASE;
    }
  }

  explodeSelf(W: World) {
    if (!this.alive) return;
    this.alive = false;
    W.explode(this.cx(), this.cy(), 1.9, 40, this.type.dmg, false);
    W.onEnemyKilled(this, false);
  }

  private tree(W: World, dt: number, dx: number, adx: number, sees: boolean) {
    this.vx = 0;
    this.facing = dx > 0 ? 1 : -1;
    switch (this.state) {
      case S.PATROL: case S.CHASE:
        if (!sees) break;
        if (adx < 2.1 && this.cd <= 0) { this.state = S.WINDUP; this.t = 0; }
        else if (this.cd <= 0) { this.state = S.AIM; this.t = 0; }
        break;
      case S.AIM:
        if (this.t > 0.55) {
          const p = W.player;
          for (let i = 0; i < 3; i++) {
            const time = 0.8 + i * 0.18, sx = this.cx(), sy = this.y + 0.4, tx = p.cx() + (i - 1) * 1.2;
            const pr = W.fireEnemy(PK.ROCK, sx, sy, (tx - sx) / time, (p.cy() - sy) / time - 7 * time, 10);
            if (pr) pr.grav = 14;
          }
          this.state = S.COOL; this.t = 0; this.cd = 2.2;
        }
        break;
      case S.WINDUP: if (this.t > 0.5) { this.state = S.ATTACK; this.t = 0; this.melee(W, 1.8); W.shake(0.12, 0.15); } break;
      case S.ATTACK: if (this.t > 0.25) { this.state = S.COOL; this.t = 0; this.cd = 1.2; } break;
      case S.COOL: if (this.t > 0.4) this.state = S.CHASE; break;
    }
  }

  private burrow(W: World, dt: number, dx: number, adx: number, sees: boolean) {
    switch (this.state) {
      case S.BURROW:
        this.invulnerable = true;
        if (sees) {
          this.walk(W, this.type.speed * 1.2, dx > 0 ? 1 : -1, dt);
          if (rnd() < 0.3) W.particle(this.cx() + rndr(-0.5, 0.5), this.y + this.h, rndr(-1, 1), -rndr(1, 3), 0.4, this.type.c2, 0.12, 10);
          if (adx < 0.9 && this.cd <= 0) {
            this.state = S.EMERGE; this.t = 0; this.vx = 0;
            W.addWarn(this.x - 0.2, this.y + this.h - 0.3, this.w + 0.4, 0.3, 0.55, 0);
          }
        } else this.vx = 0;
        break;
      case S.EMERGE:
        this.vx = 0;
        if (this.t > 0.55) {
          this.state = S.ATTACK; this.t = 0; this.invulnerable = false;
          W.particles(this.cx(), this.y + this.h, 14, this.type.c1, 4, 0.6, 0.15, 12);
          if (W.player.overlaps(this.x - 0.2, this.y - 0.5, this.w + 0.4, this.h + 0.5)) W.hurtPlayer(this.type.dmg, this.cx(), false, true);
        }
        break;
      case S.ATTACK: if (this.t > 0.3) { this.state = S.CHASE; this.t = 0; } break;
      case S.CHASE:
        this.invulnerable = false;
        if (adx < 1.4 && this.t > 0.4 && this.cd <= 0) { this.state = S.WINDUP; this.t = 0; this.vx = 0; this.facing = dx > 0 ? 1 : -1; }
        else this.walk(W, this.type.speed * 0.5, dx > 0 ? 1 : -1, dt);
        if (this.t > 2.6) { this.state = S.BURROW; this.t = 0; this.cd = 1.2; }
        break;
      case S.WINDUP: if (this.t > 0.4) { this.melee(W, 1.2); this.state = S.COOL; this.t = 0; this.cd = 1; } break;
      case S.COOL: if (this.t > 0.5) this.state = S.CHASE; break;
      default: this.state = S.BURROW;
    }
  }

  private charger(W: World, dt: number, dx: number, adx: number, dy: number, sees: boolean, fire: boolean) {
    switch (this.state) {
      case S.PATROL: this.patrol(W, dt); if (sees) this.state = S.CHASE; break;
      case S.CHASE:
        this.facing = dx > 0 ? 1 : -1;
        if (fire && this.cd <= 0 && adx > 3 && this.alt % 2 === 0) { this.state = S.AIM; this.t = 0; this.vx = 0; }
        else if (this.cd <= 0 && adx < 7 && Math.abs(dy) < 1.6) { this.state = S.WINDUP; this.t = 0; this.vx = 0; }
        else if (adx > 1.5) this.walk(W, this.type.speed, this.facing, dt);
        else this.vx = 0;
        break;
      case S.AIM:
        if (this.t > 0.45) {
          const p = W.player, sx = this.cx() + this.facing * 0.6, sy = this.y + 0.5;
          const ang = Math.atan2(p.cy() - sy, p.cx() - sx);
          W.fireEnemy(PK.FIRE, sx, sy, Math.cos(ang) * 7.5, Math.sin(ang) * 7.5, this.type.dmg);
          this.alt++;
          this.state = S.COOL; this.t = 0; this.cd = 1.0;
        }
        break;
      case S.WINDUP:
        this.vx = 0;
        if (this.t > (fire ? 0.45 : 0.6)) { this.state = S.CHARGE; this.t = 0; this.alt++; }
        break;
      case S.CHARGE:
        this.vx = this.facing * (fire ? 8.5 : 9.5);
        if (fire && rnd() < 0.5) W.particle(this.cx(), this.cy(), -this.vx * 0.1, -1, 0.35, this.type.c2, 0.15, -2);
        if (W.player.overlaps(this.x, this.y, this.w, this.h)) W.hurtPlayer(this.type.dmg, this.cx(), true, true);
        if (this.hitWall || this.t > 1.1 || (this.onGround && !this.groundAhead(W, this.facing))) {
          this.vx = 0; this.state = S.STUN; this.t = 0; this.cd = 1.6;
        }
        break;
      case S.STUN: this.vx = 0; if (this.t > 0.9) { this.state = S.CHASE; this.t = 0; } break;
      case S.COOL: this.vx = 0; if (this.t > 0.5) { this.state = S.CHASE; this.t = 0; } break;
      default: this.state = S.CHASE;
    }
  }

  private slammer(W: World, dt: number, dx: number, adx: number, dy: number, sees: boolean) {
    switch (this.state) {
      case S.PATROL: this.patrol(W, dt); if (sees) this.state = S.CHASE; break;
      case S.CHASE:
        this.facing = dx > 0 ? 1 : -1;
        if (this.cd <= 0 && adx < 7) { this.state = S.WINDUP; this.t = 0; this.vx = 0; }
        else this.walk(W, this.type.speed, this.facing, dt);
        break;
      case S.WINDUP:
        this.vx = 0;
        if (this.t > 0.8) {
          this.state = S.ATTACK; this.t = 0;
          W.shake(0.15, 0.2); W.sfx(Sfx.SMASH);
          for (const d of [-1, 1]) {
            const pr = W.fireEnemy(PK.WAVE, this.cx() + d, this.y + this.h - 0.4, d * 6.5, 0, this.type.dmg);
            if (pr) { pr.w = 0.7; pr.h = 0.8; pr.reflectable = false; pr.life = 1.6; pr.hitsGround = false; }
          }
          if (adx < 1.6 && Math.abs(dy) < 1.5) this.melee(W, 1.4);
        }
        break;
      case S.ATTACK: if (this.t > 0.5) { this.state = S.CHASE; this.t = 0; this.cd = 2.4; } break;
      default: this.state = S.CHASE;
    }
  }

  private drone(W: World, dt: number, dx: number, sees: boolean) {
    const p = W.player;
    if (!sees && !this.awake) { this.y += Math.sin(this.anim * 2) * 0.5 * dt; return; }
    const side = this.cx() < p.cx() ? -1 : 1;
    const tx = p.cx() + side * 4.2 - this.w * 0.5;
    let ty = p.y - 3.2 + Math.sin(this.anim * 1.7) * 0.6;
    ty = Math.max(ty, W.camY + 0.6);
    const spd = this.type.speed;
    this.vx = approach(this.vx, clamp((tx - this.x) * 2, -spd, spd), 12 * dt);
    this.vy = approach(this.vy, clamp((ty - this.y) * 2, -spd, spd), 12 * dt);
    const k = this.state === S.AIM || this.state === S.ATTACK ? 0.3 : 1;
    this.x += this.vx * dt * k; this.y += this.vy * dt * k;
    this.facing = p.cx() > this.cx() ? 1 : -1;
    switch (this.state) {
      case S.PATROL: case S.CHASE:
        this.state = S.CHASE;
        if (this.cd <= 0 && Math.abs(dx) < 9.5) { this.state = S.AIM; this.t = 0; this.shots = 0; }
        break;
      case S.AIM: if (this.t > 0.35) { this.state = S.ATTACK; this.t = 0.2; } break;
      case S.ATTACK:
        if (this.t >= 0.16) {
          this.t = 0;
          const sx = this.cx(), sy = this.y + this.h;
          const ang = Math.atan2(p.cy() - sy, p.cx() - sx);
          W.fireEnemy(PK.BULLET, sx, sy, Math.cos(ang) * 7, Math.sin(ang) * 7, this.type.dmg);
          if (++this.shots >= 3) { this.state = S.CHASE; this.cd = rndr(2.0, 2.8); }
        }
        break;
      default: this.state = S.CHASE;
    }
  }

  /** Returns true if damage applied. Shield Soldiers block frontal shots unless breaksGuard. */
  hurt(W: World, dmg: number, fromX: number, breaksGuard: boolean): boolean {
    if (!this.alive || this.invulnerable) return false;
    if (this.type.beh === B.SHIELDER && !breaksGuard && this.state !== S.WINDUP && this.state !== S.ATTACK) {
      if ((fromX - this.cx()) * this.facing > 0) {
        W.particles(this.cx() + this.facing * 0.5, this.cy(), 4, 0xffffff, 3, 0.2, 0.06, 0);
        W.sfx(Sfx.BLOCK);
        return false;
      }
    }
    this.hp -= dmg;
    this.flash = 0.1;
    W.addMeter(dmg * 0.04);
    if (this.state === S.HANG) { this.state = S.CHASE; this.t = 0; }
    if (this.hp <= 0) {
      if (this.type.beh === B.BOMBER) { this.explodeSelf(W); return true; }
      this.alive = false;
      W.onEnemyKilled(this, true);
    } else {
      this.awake = true;
      if (this.state === S.PATROL) this.state = S.CHASE;
    }
    return true;
  }
}
