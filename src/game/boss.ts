import { Body, PK } from './entities';
import { E, EType } from './enemy';
import { approach, clamp, rnd, rndi, rndr, sign } from './util';
import { Sfx } from '../systems/sound';
import type { World } from './world';

export enum A { GUN, STOMP, MISSILE, CHARGE, LASER, LEAP, ROAR, BURROW, SPREAD, RAIN, SUMMON, DIVE, WAVE, EGG, TENTACLE, CLAW }
export enum BS { INTRO, IDLE, TELE, ACT, RECOVER, TRANSITION, DEAD }

export interface BossType {
  key: string; title: string; hp: number; phases: number; w: number; h: number; flying: boolean;
  c1: number; c2: number; attacks: A[][]; weak: string;
}

const BT = (key: string, title: string, hp: number, phases: number, w: number, h: number, flying: boolean, c1: number, c2: number, attacks: A[][], weak: string): BossType =>
  ({ key, title, hp, phases, w, h, flying, c1, c2, attacks, weak });

/** Boss specification (GDD §10). Each phase adds at least one new pattern. */
export const BOSSES = {
  IRON_BEAST: BT('ironbeast', 'IRON BEAST', 1200, 2, 3.2, 3.0, false, 0x5b6270, 0xff7a2e,
    [[A.GUN, A.STOMP], [A.GUN, A.STOMP, A.MISSILE]], 'Lõi năng lượng sau lưng'),
  MECHA_TITAN: BT('mechatitan', 'MECHA TITAN', 1600, 2, 3.0, 3.6, false, 0xb0782a, 0x35d0ff,
    [[A.CLAW, A.LASER], [A.CLAW, A.LASER, A.LEAP]], 'Module cánh tay'),
  FOREST_BEAST: BT('forestbeast', 'FOREST BEAST', 1400, 2, 3.4, 2.8, false, 0x4a3a2a, 0x8ce04a,
    [[A.LEAP, A.ROAR], [A.LEAP, A.ROAR, A.CLAW]], 'Miệng — sau tiếng gầm'),
  SAND_WORM: BT('sandworm', 'SAND WORM', 1500, 3, 2.2, 4.2, false, 0xcf9e5a, 0x8a4e2a,
    [[A.BURROW, A.SPREAD], [A.BURROW, A.SPREAD, A.BURROW], [A.BURROW, A.SPREAD, A.RAIN]], 'Đầu khi trồi lên'),
  FROZEN_GOLEM: BT('frozengolem', 'FROZEN GOLEM', 1800, 2, 3.2, 3.6, false, 0x8fc8e8, 0x3af0ff,
    [[A.RAIN, A.STOMP], [A.RAIN, A.STOMP, A.CHARGE]], 'Lõi ngực'),
  BIO_TITAN: BT('biotitan', 'BIO-TITAN', 2200, 3, 3.4, 3.8, false, 0x6e8a4a, 0xe0ff4a,
    [[A.TENTACLE, A.SPREAD], [A.TENTACLE, A.SPREAD, A.SUMMON], [A.TENTACLE, A.SPREAD, A.SUMMON, A.RAIN]], 'Các bọc phát sáng'),
  LAVA_DRAGON: BT('lavadragon', 'LAVA DRAGON', 2400, 3, 3.6, 2.2, true, 0x8a2a1e, 0xffb02e,
    [[A.SPREAD, A.DIVE], [A.SPREAD, A.DIVE, A.WAVE], [A.SPREAD, A.DIVE, A.WAVE, A.RAIN]], 'Đầu'),
  ALIEN_QUEEN: BT('alienqueen', 'ALIEN QUEEN', 2600, 3, 3.6, 3.2, false, 0x4a2a6e, 0x9cff4a,
    [[A.EGG, A.GUN], [A.EGG, A.GUN, A.CHARGE], [A.EGG, A.GUN, A.CHARGE, A.SPREAD]], 'Lõi bụng'),
  OVERLORD: BT('overlord', 'OVERLORD', 5000, 3, 3.6, 4.2, false, 0x2a2e3a, 0xff2e5a,
    [[A.LASER, A.MISSILE], [A.LASER, A.MISSILE, A.SUMMON, A.STOMP], [A.LASER, A.MISSILE, A.SUMMON, A.STOMP, A.GUN, A.CHARGE]], 'Lõi đổi vị trí mỗi phase'),
};

const GROUND_Y = 10;

export class Boss extends Body {
  hp: number; maxHp: number; phase = 0;
  state = BS.INTRO;
  t = 0; anim = 0; flash = 0; stun = 0;
  facing = -1;
  atk: A | -1 = -1; lastAtk: A | -1 = -1;
  count = 0; tx = 0; sub = 0;
  hidden = false;
  weakOpen = 0;
  deathT = 0;
  laserY = -1; laserOn = 0;
  name: string;
  private shieldStamp = -1;
  private phaseStartHp: number;
  sprite: any = null;

  constructor(public type: BossType, public arenaX: number, hpOverride = 0, nameOverride?: string) {
    super();
    this.name = nameOverride ?? type.title;
    this.w = type.w; this.h = type.h;
    this.maxHp = this.hp = hpOverride > 0 ? hpOverride : type.hp;
    this.phaseStartHp = this.maxHp;
    this.x = arenaX + 13;
    this.y = type.flying ? 2.5 : GROUND_Y - this.h;
  }

  dead() { return this.state === BS.DEAD; }
  invulnerable() { return this.state === BS.INTRO || this.state === BS.TRANSITION || this.state === BS.DEAD || this.hidden; }

  /** 2 phases → 50%; 3 phases → 66% / 33%. */
  threshold(ph: number) {
    if (this.type.phases === 2) return ph === 1 ? 0.5 : 0;
    return ph === 1 ? 0.66 : ph === 2 ? 0.33 : 0;
  }

  /** On player respawn mid-fight: HP restored to the start of the current phase (no soft-lock, mild penalty). */
  resetPhase() {
    this.hp = Math.max(this.hp, this.phaseStartHp);
    this.state = BS.IDLE; this.t = 0; this.hidden = false; this.laserOn = 0; this.laserY = -1; this.atk = -1; this.stun = 0;
    this.x = this.arenaX + 13;
    this.y = this.type.flying ? 2.5 : GROUND_Y - this.h;
    this.vx = this.vy = 0;
  }

  private spd() { return 1 + this.phase * 0.18; }

  update(W: World, dt: number) {
    this.anim += dt; this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.weakOpen > 0) this.weakOpen -= dt;
    const p = W.player;
    if (this.laserOn > 0) {
      this.laserOn -= dt;
      if (p.overlaps(this.arenaX, this.laserY - 0.18, 20, 0.36)) W.hurtPlayer(18, this.cx(), true, false);
      if (this.laserOn <= 0) this.laserY = -1;
    }
    if (this.state !== BS.DEAD && this.state !== BS.INTRO && !this.hidden && p.overlaps(this.x + 0.2, this.y + 0.2, this.w - 0.4, this.h - 0.2)) {
      W.hurtPlayer(15, this.cx(), true, true);
    }

    switch (this.state) {
      case BS.INTRO:
        this.facing = p.cx() < this.cx() ? -1 : 1;
        if (this.type.flying) this.hover(W, dt, 0.5);
        if (this.t > 2.0) { this.state = BS.IDLE; this.t = 0; }
        break;
      case BS.TRANSITION:
        if (rnd() < 0.5) W.particle(this.x + rnd() * this.w, this.y + rnd() * this.h, rndr(-3, 3), rndr(-5, -1), 0.6, this.type.c2, 0.15, 4);
        if (this.t > 1.5) { this.state = BS.IDLE; this.t = 0; }
        break;
      case BS.IDLE: {
        this.facing = p.cx() < this.cx() ? -1 : 1;
        this.idleMove(W, dt);
        const wait = clamp(1.4 - this.phase * 0.25, 0.7, 1.4);
        if (this.t > wait && !p.dead) this.pickAttack(W);
        break;
      }
      case BS.TELE: case BS.ACT:
        this.runAttack(W, dt);
        break;
      case BS.RECOVER:
        this.vx = approach(this.vx, 0, 20 * dt);
        if (this.type.flying) this.hover(W, dt, 0.5);
        if (this.t > (this.stun > 0 ? this.stun : 1.1)) { this.state = BS.IDLE; this.t = 0; this.stun = 0; }
        break;
      case BS.DEAD:
        this.deathT += dt;
        if (rnd() < 0.3) W.explosionFx(this.x + rnd() * this.w, this.y + rnd() * this.h, 0.8);
        if (this.type.flying) { this.vy += 6 * dt; this.y = Math.min(this.y + this.vy * dt, GROUND_Y - this.h); }
        break;
    }

    const airborneScript = this.type.flying || (this.atk === A.BURROW && (this.state === BS.TELE || this.state === BS.ACT));
    if (!airborneScript && this.state !== BS.DEAD) {
      this.vy += W.gravity * dt;
      this.move(W.solids, dt, true, true);
    }
    this.x = clamp(this.x, this.arenaX + 0.3, this.arenaX + 20 - this.w - 0.3);
  }

  private idleMove(W: World, dt: number) {
    const p = W.player;
    if (this.type.flying) { this.hover(W, dt, 1); return; }
    if (this.type === BOSSES.SAND_WORM) { this.vx = 0; return; }
    const d = p.cx() - this.cx();
    const want = Math.abs(d) > 5 ? sign(d) * 1.6 * this.spd() : Math.abs(d) < 3 ? -sign(d) * 1.2 : 0;
    this.vx = approach(this.vx, want, 10 * dt);
  }

  private hover(W: World, dt: number, k: number) {
    const hx = this.arenaX + 10 + Math.sin(this.anim * 0.6) * 6.5 - this.w / 2;
    const hy = 2.4 + Math.sin(this.anim * 1.3) * 0.6;
    this.vx = approach(this.vx, clamp((hx - this.x) * 1.5, -5, 5) * k, 10 * dt);
    this.vy = approach(this.vy, clamp((hy - this.y) * 1.5, -5, 5) * k, 10 * dt);
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.facing = W.player.cx() < this.cx() ? -1 : 1;
  }

  private pickAttack(W: World) {
    const list = this.type.attacks[Math.min(this.phase, this.type.attacks.length - 1)];
    let a = list[rndi(list.length)];
    if (a === this.lastAtk && list.length > 1) a = list[(list.indexOf(a) + 1 + rndi(list.length - 1)) % list.length];
    if (a === A.SUMMON && W.minionCount() >= 3) a = list[0];
    if (a === A.EGG && W.minionCount() >= 4) a = A.GUN;
    this.atk = a; this.lastAtk = a;
    this.state = BS.TELE; this.t = 0; this.count = 0; this.sub = 0;
    this.startTele(W);
  }

  private finish(recover: number) { this.state = BS.RECOVER; this.t = 0; this.stun = recover; this.atk = -1; }

  private startTele(W: World) {
    const p = W.player;
    this.vx = 0;
    const ax = this.arenaX;
    switch (this.atk) {
      case A.MISSILE: {
        const n = 3 + this.phase;
        for (let i = 0; i < n; i++) {
          const mx = clamp(p.cx() + (i - (n - 1) / 2) * 2.6 + rndr(-0.4, 0.4), ax + 1, ax + 19);
          W.addWarn(mx - 0.6, GROUND_Y - 0.25, 1.2, 0.25, 0.95, 0);
          W.queueStrike(mx, 0.95 + i * 0.08, PK.MISSILE);
        }
        break;
      }
      case A.RAIN: {
        const n = 5 + this.phase * 2;
        const kind = this.type === BOSSES.FROZEN_GOLEM ? PK.SHARD : this.type === BOSSES.LAVA_DRAGON ? PK.FIRE : this.type === BOSSES.BIO_TITAN ? PK.ACID : PK.SAND;
        for (let i = 0; i < n; i++) {
          const mx = i === 0 ? clamp(p.cx(), ax + 1, ax + 19) : ax + 1.2 + rnd() * 17.6;
          W.addWarn(mx - 0.35, -2, 0.7, 12, 0.9, 2);
          W.queueStrike(mx, 0.9 + i * 0.05, kind);
        }
        break;
      }
      case A.TENTACLE: {
        const n = 3 + this.phase;
        for (let i = 0; i < n; i++) {
          const mx = clamp(p.cx() + (i - (n - 1) / 2) * 2.2, ax + 1, ax + 19);
          W.addWarn(mx - 0.45, GROUND_Y - 0.3, 0.9, 0.3, 0.8, 0);
          W.queueStrike(mx, 0.8, PK.PILLAR);
        }
        break;
      }
      case A.LASER: {
        this.laserY = rnd() < 0.5 ? GROUND_Y - 0.45 : GROUND_Y - 1.25;
        W.addWarn(ax, this.laserY - 0.05, 20, 0.1, 0.85, 1);
        break;
      }
      case A.WAVE:
        this.tx = p.cx() < ax + 10 ? 1 : -1;
        W.addWarn(this.tx > 0 ? ax : ax + 17, GROUND_Y - 1.6, 3, 1.6, 0.9, 0);
        break;
    }
    W.sfx(Sfx.ENEMY_SHOT);
  }

  teleTime(): number {
    switch (this.atk) {
      case A.GUN: return 0.55; case A.STOMP: return 0.5; case A.MISSILE: return 0.4; case A.CHARGE: return 0.75;
      case A.LASER: return 0.85; case A.LEAP: return 0.5; case A.ROAR: return 0.45; case A.BURROW: return 0.6;
      case A.SPREAD: return 0.5; case A.RAIN: return 0.35; case A.SUMMON: return 0.6; case A.DIVE: return 0.5;
      case A.WAVE: return 0.9; case A.EGG: return 0.55; case A.TENTACLE: return 0.5; case A.CLAW: return 0.45;
    }
    return 0.5;
  }

  private shockwaves(W: World, speed: number) {
    W.shake(0.2, 0.3); W.sfx(Sfx.SMASH);
    for (const d of [-1, 1]) {
      const pr = W.fireEnemy(PK.WAVE, this.cx() + d * this.w * 0.5, GROUND_Y - 0.4, d * speed, 0, 15);
      if (pr) { pr.w = 0.7; pr.h = 0.8; pr.reflectable = false; pr.hitsGround = false; pr.life = 3; }
    }
  }

  private runAttack(W: World, dt: number) {
    const p = W.player;
    if (this.state === BS.TELE) {
      if (this.type.flying && this.atk !== A.DIVE) this.hover(W, dt, 0.4);
      if (this.atk === A.CHARGE || this.atk === A.CLAW) this.facing = p.cx() < this.cx() ? -1 : 1;
      if (this.atk === A.BURROW) {
        this.y += 6 * dt; // sinking
        if (this.t > 0.4) this.hidden = true;
      }
      if (this.atk === A.DIVE) { this.vy = approach(this.vy, -6, 20 * dt); this.y = Math.max(-1.5, this.y + this.vy * dt); }
      if (this.t >= this.teleTime()) { this.state = BS.ACT; this.t = 0; this.beginAct(W); }
      return;
    }
    const ax = this.arenaX;
    switch (this.atk) {
      case A.GUN: {
        const n = 7 + this.phase * 3;
        this.facing = p.cx() < this.cx() ? -1 : 1;
        if (this.type.flying) this.hover(W, dt, 0.3);
        if (this.t > 0.1) {
          this.t = 0;
          const sx = this.cx() + this.facing * this.w * 0.45, sy = this.y + this.h * 0.35;
          const ang = Math.atan2(p.cy() - sy, p.cx() - sx) + rndr(-0.12, 0.12);
          const kind = this.type === BOSSES.ALIEN_QUEEN ? PK.PLASMA : this.type === BOSSES.OVERLORD ? PK.LASER : PK.BULLET;
          W.fireEnemy(kind, sx, sy, Math.cos(ang) * 9.5, Math.sin(ang) * 9.5, 10);
          if (++this.count >= n) this.finish(1.1);
        }
        break;
      }
      case A.STOMP: case A.LEAP:
        if (this.t > 0.1 && this.onGround) {
          this.shockwaves(W, this.atk === A.STOMP ? 7.5 : 6);
          this.vx = 0;
          this.finish(this.atk === A.STOMP ? 1.0 : 1.3);
        } else if (this.t > 2.5) this.finish(0.8);
        break;
      case A.CHARGE:
        this.vx = this.facing * (11 + this.phase);
        if (rnd() < 0.6) W.particle(this.cx() - this.facing * this.w * 0.5, this.y + this.h, -this.facing * 2, -1, 0.4, 0xdddddd, 0.15, 0);
        if (this.hitWall || this.t > 2.2) {
          this.vx = 0; W.shake(0.2, 0.35); W.sfx(Sfx.SMASH);
          this.finish(1.6); // stunned → counterattack window
        }
        break;
      case A.CLAW:
        if (this.count === 0) {
          this.vx = this.facing * 7;
          if (this.t > 0.25) {
            this.count = 1; this.t = 0; this.vx = 0;
            const hx = this.facing > 0 ? this.x + this.w : this.x - 2.2;
            if (p.overlaps(hx, this.y + this.h * 0.3, 2.2, this.h * 0.7)) W.hurtPlayer(20, this.cx(), true, true);
            W.particles(this.facing > 0 ? this.x + this.w + 0.8 : this.x - 0.8, this.y + this.h * 0.6, 8, 0xffffff, 4, 0.3, 0.08, 0);
            W.sfx(Sfx.SMASH);
          }
        } else if (this.t > 0.3) {
          if (this.phase >= 1 && this.sub < 1) { // combo: second swipe in phase 2
            this.sub++; this.count = 0; this.t = -0.15; this.facing = p.cx() < this.cx() ? -1 : 1;
          } else this.finish(1.2);
        }
        break;
      case A.LASER:
        if (this.t > 0.75) this.finish(0.9);
        break;
      case A.ROAR:
        if (this.t < 1.0) {
          if (Math.abs(p.cx() - this.cx()) < 9) p.vx += sign(p.cx() - this.cx()) * 18 * dt;
          if (rnd() < 0.4) W.particle(this.cx() + this.facing * this.w * 0.4, this.y + this.h * 0.35, this.facing * rndr(3, 7), rndr(-2, 2), 0.5, 0xffffff, 0.2, 0);
        } else { this.weakOpen = 2.6; this.finish(2.4); }
        break;
      case A.BURROW:
        if (this.count === 0) {
          this.tx = clamp(p.cx() - this.w / 2, ax + 0.5, ax + 19.5 - this.w);
          W.addWarn(this.tx - 0.3, GROUND_Y - 0.3, this.w + 0.6, 0.3, 0.8 - this.phase * 0.1, 0);
          this.count = 1; this.t = 0;
        } else if (this.count === 1) {
          if (rnd() < 0.5) W.particle(this.tx + rnd() * this.w, GROUND_Y, rndr(-1, 1), -rndr(2, 4), 0.4, this.type.c1, 0.12, 10);
          if (this.t > 0.8 - this.phase * 0.1) {
            this.x = this.tx; this.hidden = false; this.count = 2; this.t = 0;
            this.y = GROUND_Y - this.h;
            W.shake(0.2, 0.25);
            W.particles(this.cx(), GROUND_Y, 20, this.type.c1, 6, 0.7, 0.18, 12);
            if (p.overlaps(this.x - 0.2, this.y, this.w + 0.4, this.h)) W.hurtPlayer(22, this.cx(), false, true);
          }
        } else if (this.t > 0.3) this.finish(2.4);
        break;
      case A.SPREAD: {
        const n = 5 + this.phase * 2;
        const kind = this.type === BOSSES.SAND_WORM ? PK.SAND : this.type === BOSSES.BIO_TITAN ? PK.ACID : this.type === BOSSES.LAVA_DRAGON ? PK.FIRE : PK.PLASMA;
        const sx = this.cx() + this.facing * this.w * 0.4, sy = this.y + this.h * 0.3;
        for (let i = 0; i < n; i++) {
          const time = 1.0 + i * 0.08, target = p.cx() + (i - (n - 1) / 2) * 1.5, g = 12;
          const pr = W.fireEnemy(kind, sx, sy, (target - sx) / time, (GROUND_Y - 0.3 - sy) / time - 0.5 * g * time, 12);
          if (pr) pr.grav = g;
        }
        this.finish(1.2);
        break;
      }
      case A.RAIN: case A.MISSILE: case A.TENTACLE:
        if (this.type.flying) this.hover(W, dt, 0.4);
        if (this.t > 1.2) this.finish(1.0);
        break;
      case A.SUMMON: {
        const ov = this.type === BOSSES.OVERLORD;
        const m: EType = ov ? (rnd() < 0.5 ? E.ALIEN : E.CYBORG) : E.MUTANT;
        W.spawnMinion(m, ax + 1.5, GROUND_Y);
        W.spawnMinion(ov ? E.DRONE : m, ax + 18.5, ov ? 3.5 : GROUND_Y);
        this.finish(1.0);
        break;
      }
      case A.DIVE:
        if (this.count === 0) {
          this.tx = clamp(p.cx() - this.w / 2, ax + 0.3, ax + 19.7 - this.w);
          W.addWarn(this.tx, GROUND_Y - 0.25, this.w, 0.25, 0.6, 0);
          this.count = 1; this.t = 0;
        } else if (this.count === 1) {
          if (this.t > 0.6) { this.count = 2; this.t = 0; this.x = this.tx; }
        } else if (this.count === 2) {
          this.y += 16 * dt;
          if (this.y >= GROUND_Y - this.h) { this.y = GROUND_Y - this.h; this.count = 3; this.t = 0; this.shockwaves(W, 6.5); }
        } else if (this.t > 1.6) this.finish(0.3); // grounded = vulnerable window
        break;
      case A.WAVE:
        if (this.count === 0) {
          const pr = W.fireEnemy(PK.LAVAWAVE, this.tx > 0 ? ax + 0.5 : ax + 19.5, GROUND_Y - 0.8, this.tx * 6.5, 0, 20);
          if (pr) { pr.w = 1.4; pr.h = 1.6; pr.reflectable = false; pr.hitsGround = false; pr.life = 3.6; }
          this.count = 1;
        }
        if (this.type.flying) this.hover(W, dt, 0.4);
        if (this.t > 2.4) this.finish(0.6);
        break;
      case A.EGG: {
        const n = 2 + (this.phase > 1 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const pr = W.fireEnemy(PK.EGG, this.cx(), this.y + this.h * 0.6, (i - (n - 1) / 2) * 3.5 + this.facing * 1.5, -6, 0);
          if (pr) { pr.grav = 16; pr.life = 2.4; pr.reflectable = false; pr.hitsGround = false; pr.w = 0.6; pr.h = 0.7; }
        }
        this.finish(1.0);
        break;
      }
      default: this.finish(1.0);
    }
  }

  private beginAct(W: World) {
    const p = W.player;
    switch (this.atk) {
      case A.STOMP: this.vy = -9; this.onGround = false; this.vx = 0; break;
      case A.LEAP: {
        const time = 1.0;
        const target = clamp(p.cx() - this.w / 2, this.arenaX + 0.3, this.arenaX + 19.7 - this.w);
        this.vx = (target - this.x) / time; this.vy = -0.5 * W.gravity * time; this.onGround = false;
        break;
      }
      case A.LASER: this.laserOn = 0.7; W.sfx(Sfx.ULT); W.shake(0.1, 0.1); break;
      case A.ROAR: W.shake(0.6, 0.25); W.sfx(Sfx.BOSS_PHASE); break;
      case A.BURROW: this.hidden = true; break;
    }
  }

  /** Weak-point multiplier by hit location. */
  private weakMul(hx: number, hy: number): number {
    const { x, y, w, h } = this;
    const back = this.facing > 0 ? x : x + w * 0.5;
    switch (this.type) {
      case BOSSES.IRON_BEAST:
        return hx > back - 0.3 && hx < back + w * 0.5 + 0.3 && hy < y + h * 0.7 ? 2 : 0.75;
      case BOSSES.MECHA_TITAN: {
        const fx = this.facing > 0 ? x + w * 0.6 : x - 0.2;
        return hx > fx && hx < fx + w * 0.6 && hy > y + h * 0.35 ? 1.8 : 0.8;
      }
      case BOSSES.FOREST_BEAST: return this.weakOpen > 0 ? 2.5 : 0.8;
      case BOSSES.SAND_WORM: return hy < y + 1.4 ? 2 : 1;
      case BOSSES.FROZEN_GOLEM: return Math.abs(hx - this.cx()) < 0.7 && hy > y + h * 0.25 && hy < y + h * 0.6 ? 2 : 0.7;
      case BOSSES.BIO_TITAN: return hy < y + h * 0.4 ? 1.8 : 1;
      case BOSSES.LAVA_DRAGON: {
        const head = this.facing > 0 ? x + w * 0.65 : x;
        return hx > head - 0.3 && hx < head + w * 0.35 + 0.3 ? 2 : 1;
      }
      case BOSSES.ALIEN_QUEEN: return hx > back - 0.3 && hx < back + w * 0.5 + 0.3 && hy > y + h * 0.4 ? 2 : 0.85;
      case BOSSES.OVERLORD: {
        const cy = this.coreY();
        return Math.abs(hy - cy) < 0.7 && Math.abs(hx - this.cx()) < 1.0 ? 2 : 0.65;
      }
    }
    return 1;
  }

  coreY() { return this.phase === 0 ? this.y + this.h * 0.4 : this.phase === 1 ? this.y + this.h * 0.15 : this.y + this.h * 0.65; }

  hitTest(px: number, py: number, pw: number, ph: number) {
    return this.state !== BS.DEAD && !this.hidden && this.overlaps(px, py, pw, ph);
  }

  shieldHit(stamp: number) {
    if (stamp === this.shieldStamp) return false;
    this.shieldStamp = stamp;
    return true;
  }

  /** returns damage dealt */
  hurt(W: World, dmg: number, hx: number, hy: number): number {
    if (this.invulnerable()) return 0;
    const d = Math.max(1, Math.round(dmg * this.weakMul(hx, hy)));
    this.hp -= d;
    this.flash = 0.08;
    W.addMeter(d * 0.04);
    if (d > dmg) W.particles(hx, hy, 5, 0xffe04a, 4, 0.3, 0.08, 0);
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = BS.DEAD; this.t = 0; this.deathT = 0; this.laserOn = 0; this.laserY = -1; this.hidden = false; this.vy = 0;
      W.onBossKilled(this);
    } else if (this.phase + 1 < this.type.phases && this.hp <= this.maxHp * this.threshold(this.phase + 1)) {
      this.phase++;
      this.phaseStartHp = this.hp;
      this.state = BS.TRANSITION; this.t = 0; this.hidden = false; this.laserOn = 0; this.laserY = -1; this.atk = -1;
      if (!this.type.flying) this.y = Math.min(this.y, GROUND_Y - this.h);
      W.onBossPhase(this);
    }
    return d;
  }
}
