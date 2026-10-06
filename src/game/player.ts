import { Body, PK, SolidType } from './entities';
import { approach, clamp } from './util';
import { stats } from '../systems/save';
import { Sfx } from '../systems/sound';
import type { World } from './world';

/** What the player reads each tick (touch controls, keyboard, or the test bot). */
export interface Controls {
  moveX: number; moveY: number;
  fireHeld: boolean; jumpHeld: boolean; shieldHeld: boolean;
  takeJump(): boolean; takeShieldPress(): boolean; takeShieldRelease(): boolean; takeSmash(): boolean; takeSpecial(): boolean;
}

export enum PState { Idle, Run, Jump, Fall, Crouch, Shoot, ShieldThrow, Block, Dash, Hurt, Dead, Respawn, Victory }

const STAND_H = 1.45, CROUCH_H = 1.0;
export const JUMP_V = 11;

/** Player (GDD §3). Movement/state only — shooting & shield are spawned through World/ShieldController. */
export class Player extends Body {
  hp: number; maxHp: number;
  facing = 1;
  jumps = 0; coyote = 0; jumpBuf = 0; dropT = 0;
  invuln = 0; hurtT = 0;
  dead = false; deadT = 0;
  crouch = false; aimUp = 0; // 0 none, 1 diagonal, 2 straight up
  blocking = false; blockT = 0; blockedSomething = false;
  fireCd = 0; throwCd = 0; smashCd = 0; smashT = 0;
  ult = 0; // 0..100
  weapon = 0; weaponT = 0; superT = 0; plasmaT = 0; bombT = 0;
  slowT = 0; anim = 0; shootT = 0; catchT = 0;
  safeX = 0; safeY = 0;
  victory = false;
  state = PState.Idle;
  sprite: any = null;

  constructor(x: number, y: number) {
    super();
    this.w = 0.7; this.h = STAND_H;
    this.x = x; this.y = y - this.h;
    this.maxHp = this.hp = stats.maxHp();
    this.safeX = this.x; this.safeY = this.y;
  }

  setCrouch(c: boolean) {
    if (c === this.crouch) return;
    const bottom = this.y + this.h;
    this.crouch = c;
    this.h = c ? CROUCH_H : STAND_H;
    this.y = bottom - this.h;
  }

  update(W: World, c: Controls, dt: number) {
    this.anim += dt;
    for (const k of ['invuln', 'hurtT', 'fireCd', 'throwCd', 'smashCd', 'slowT', 'shootT', 'catchT', 'dropT', 'coyote', 'jumpBuf'] as const) {
      if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);
    }
    for (const k of ['weaponT', 'superT', 'plasmaT', 'bombT'] as const) if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);
    if (this.weaponT <= 0) this.weapon = 0;
    if (this.victory) {
      this.vx = approach(this.vx, 0, 30 * dt);
      this.vy += W.gravity * dt; this.move(W.solids, dt, false, true);
      this.state = PState.Victory;
      return;
    }

    // ---- shield: press = raise (block) immediately; quick release = throw ----
    if (c.takeShieldPress() && !W.shield.active && this.smashT <= 0) {
      this.blocking = true; this.blockT = 0; this.blockedSomething = false;
    }
    if (this.blocking) this.blockT += dt;
    const released = c.takeShieldRelease();
    if (this.blocking && (released || !c.shieldHeld)) {
      this.blocking = false;
      if (this.blockT < 0.2 && !this.blockedSomething && this.throwCd <= 0 && !W.shield.active) {
        W.shield.throwFrom(W, this, c.moveY < -0.5);
      }
    }

    // ---- smash (dash + knockback) ----
    if (c.takeSmash() && this.smashCd <= 0 && !this.blocking) {
      this.smashT = 0.32; this.smashCd = 4.0;
      if (c.moveX !== 0) this.facing = c.moveX > 0 ? 1 : -1;
      this.setCrouch(false);
      W.onSmashStart();
    }
    // ---- ultimate ----
    if (c.takeSpecial() && this.ult >= 100) W.ultimate();

    const g = W.gravity;
    if (this.smashT > 0) {
      this.smashT -= dt;
      this.vx = this.facing * 15;
      this.vy = 0;
      this.state = PState.Dash;
      this.move(W.solids, dt, false, true);
      W.smashHits(this);
      if (this.hitWall) this.smashT = 0;
      return;
    }

    // ---- movement ----
    const wantCrouch = this.onGround && c.moveY > 0.6 && Math.abs(c.moveX) < 0.5;
    this.setCrouch(wantCrouch);
    if (!this.blocking && c.moveX !== 0) this.facing = c.moveX > 0 ? 1 : -1;
    if (this.blocking && c.moveX !== 0 && this.blockT < 0.05) this.facing = c.moveX > 0 ? 1 : -1;

    const speed = stats.moveSpeed() * (this.slowT > 0 ? 0.55 : 1);
    const target = this.blocking || this.crouch ? 0 : c.moveX * speed;
    const ice = this.ground?.ice ?? false;
    const accel = this.onGround ? (ice ? 7 : 70) : 40;
    if (this.hurtT <= 0) this.vx = approach(this.vx, target, accel * dt);

    if (c.takeJump()) this.jumpBuf = 0.12;
    if (this.jumpBuf > 0 && !this.blocking) {
      if ((this.onGround || this.coyote > 0) && this.crouch && this.ground?.type === SolidType.ONEWAY) {
        this.dropT = 0.25; this.jumpBuf = 0; this.setCrouch(false);
      } else if (this.onGround || this.coyote > 0) {
        this.setCrouch(false);
        this.vy = -JUMP_V; this.jumps = 1; this.coyote = 0; this.jumpBuf = 0; this.onGround = false;
        W.sfx(Sfx.JUMP);
      } else if (this.jumps < 2) {
        this.vy = -JUMP_V * 0.92; this.jumps = 2; this.jumpBuf = 0;
        W.particles(this.cx(), this.y + this.h, 6, 0xbfe9ff, 2.5, 0.3, 0.08, 0);
        W.sfx(Sfx.JUMP);
      }
    }
    // variable jump height
    if (!c.jumpHeld && this.vy < -4) this.vy += g * 1.3 * dt;
    this.vy = Math.min(this.vy + g * dt, 20);

    if (this.onGround && this.ground && this.ground.conveyor !== 0) this.x += this.ground.conveyor * dt;
    this.move(W.solids, dt, this.dropT > 0, true);

    if (this.onGround) {
      this.jumps = 0; this.coyote = 0.1;
      const s = this.ground;
      if (s && s.type !== SolidType.WALL && this.x > s.x + 0.3 && this.x + this.w < s.x + s.w - 0.3 && !W.inLava(this)) {
        this.safeX = this.x; this.safeY = this.y + this.h;
      }
    }

    // ---- aiming / shooting ----
    this.aimUp = c.moveY < -0.5 ? (Math.abs(c.moveX) > 0.3 ? 1 : 2) : 0;
    if (c.fireHeld && !this.blocking && this.fireCd <= 0) {
      this.fire(W);
    }

    // ---- state for animation ----
    if (this.hurtT > 0) this.state = PState.Hurt;
    else if (this.blocking) this.state = PState.Block;
    else if (!this.onGround) this.state = this.vy < 0 ? PState.Jump : PState.Fall;
    else if (this.crouch) this.state = PState.Crouch;
    else if (Math.abs(this.vx) > 0.5) this.state = PState.Run;
    else if (this.shootT > 0) this.state = PState.Shoot;
    else this.state = PState.Idle;
  }

  private fire(W: World) {
    const mode = this.weapon;
    this.fireCd = mode === 2 ? 0.18 : 0.15;
    this.shootT = 0.2;
    const base = mode === 0 ? 10 : mode === 1 ? 15 : 20;
    const dmg = Math.round(base * stats.shieldMul() * (this.superT > 0 ? 1.5 : 1));
    let ang: number;
    if (this.aimUp === 2) ang = -Math.PI / 2;
    else if (this.aimUp === 1) ang = this.facing > 0 ? -Math.PI / 4 : -Math.PI * 3 / 4;
    else ang = this.facing > 0 ? 0 : Math.PI;
    const mx = this.aimUp === 2 ? this.cx() + this.facing * 0.15 : this.cx() + this.facing * 0.55;
    const my = this.aimUp === 2 ? this.y - 0.1 : this.y + (this.crouch ? 0.45 : 0.55);
    const speed = 18;
    const shots: number[] = mode === 2 ? [-0.22, 0, 0.22] : [0];
    const offs: number[] = mode === 1 ? [-0.16, 0.16] : [0];
    for (const da of shots) for (const off of offs) {
      const a = ang + da;
      const ox = -Math.sin(ang) * off, oy = Math.cos(ang) * off;
      const pr = W.firePlayer(this.plasmaT > 0 ? PK.PLASMA : PK.SHOT, mx + ox, my + oy, Math.cos(a) * speed, Math.sin(a) * speed, dmg);
      if (pr && this.plasmaT > 0) pr.pierce = 3;
      if (pr && mode > 0) pr.bossMul = 0.5;
    }
    W.sfx(Sfx.SHOT);
  }

  /** Respawn helper. */
  respawn(x: number, y: number) {
    this.setCrouch(false);
    this.x = x; this.y = y - this.h; this.vx = this.vy = 0;
    this.maxHp = stats.maxHp();
    this.hp = this.maxHp;
    this.dead = false; this.deadT = 0;
    this.invuln = 2.0; this.hurtT = 0;
    this.blocking = false; this.smashT = 0; this.jumps = 0;
    this.state = PState.Respawn;
  }

  frontOf(fromX: number) { return (fromX - this.cx()) * this.facing > 0; }

  clampHp() { this.hp = clamp(this.hp, 0, this.maxHp); }
}

/** ShieldController — throw state machine OUTBOUND → RETURN → CATCH (GDD §4.1). */
export class Shield {
  active = false;
  state: 'out' | 'back' = 'out';
  x = 0; y = 0; vx = 0; vy = 0;
  dist = 0; spin = 0; t = 0;
  ricochet = false; bounces = 0;
  stamp = 0; dmg = 35; bomb = false; exploded = false;

  throwFrom(W: World, p: Player, up: boolean) {
    this.active = true; this.state = 'out'; this.t = 0; this.dist = 0; this.bounces = 0; this.exploded = false;
    this.ricochet = up;
    this.stamp++;
    this.x = p.cx() + p.facing * 0.4; this.y = p.y + 0.6;
    const sp = 17;
    if (up) { this.vx = p.facing * sp * 0.707; this.vy = -sp * 0.707; }
    else { this.vx = p.facing * sp; this.vy = 0; }
    this.dmg = Math.round((up ? stats.throwDmg() * 45 / 35 : stats.throwDmg()) * (p.superT > 0 ? 1.5 : 1));
    this.bomb = p.bombT > 0;
    p.throwCd = up ? 2.2 : 2.0;
    W.sfx(Sfx.THROW);
  }

  update(W: World, dt: number) {
    if (!this.active) return;
    const p = W.player;
    this.t += dt;
    this.spin += dt * 25;
    if (this.state === 'out') {
      const px = this.x, py = this.y;
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.dist += Math.hypot(this.vx, this.vy) * dt;
      if (W.solidAt(this.x, this.y)) {
        if (this.ricochet && this.bounces < 3) {
          this.bounces++;
          if (W.solidAt(px, this.y)) this.vy = -this.vy; else this.vx = -this.vx;
          this.x = px; this.y = py;
          W.sfx(Sfx.BLOCK);
          W.particles(this.x, this.y, 5, 0xffffff, 3, 0.2, 0.06, 0);
        } else this.goBack();
      }
      if (this.dist >= (this.ricochet ? 14 : 8.5)) this.goBack();
    } else {
      const dx = p.cx() - this.x, dy = p.y + 0.6 - this.y;
      const d = Math.hypot(dx, dy);
      const sp = Math.min(24, 14 + this.t * 6);
      this.vx = approach(this.vx, dx / Math.max(d, 0.001) * sp, 90 * dt);
      this.vy = approach(this.vy, dy / Math.max(d, 0.001) * sp, 90 * dt);
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (d < 0.7 || this.t > 4 || p.dead) { // always comes back (never lost)
        this.active = false;
        if (!p.dead) { p.catchT = 0.2; W.sfx(Sfx.CATCH); }
      }
    }
    W.shieldHits(this);
  }

  goBack() {
    if (this.state === 'back') return;
    this.state = 'back'; this.t = 0; this.stamp++;
  }

  /** Called on enemy hit while ricocheting: redirect toward the next enemy. */
  redirect(tx: number, ty: number) {
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy) || 1;
    this.vx = dx / d * 17; this.vy = dy / d * 17;
    this.bounces++;
    this.stamp++;
    if (this.bounces > 3) this.goBack();
  }
}
