import type { Controls } from '../game/player';
import type { World } from '../game/world';
import { WS } from '../game/world';
import { GROUND_Y } from '../game/level';

/**
 * Automated test player (enabled with ?bot). Not part of normal gameplay.
 * Runs right, shoots constantly, jumps gaps/walls, throws the shield and uses the ultimate.
 */
export class Bot implements Controls {
  moveX = 1; moveY = 0; fireHeld = true; jumpHeld = false; shieldHeld = false;
  private jump = false; private shield = false; private smash = false; private special = false;
  private t = 0; private jumpHold = 0; private stuckT = 0; private lastX = 0;

  constructor(private w: World) {}

  think(dt: number) {
    const w = this.w, p = w.player;
    this.t += dt;
    if (p.dead || w.state === WS.Complete) { this.moveX = 0; return; }
    this.fireHeld = true;
    this.moveY = 0;
    const b = w.boss && !w.boss.dead() ? w.boss : null;
    if (b) {
      // keep distance from boss, face it
      const d = b.cx() - p.cx();
      const ax = w.level.arenaX;
      const pinned = p.x < ax + 1.5 || p.x > ax + 17.8;
      if (Math.abs(d) < 3 && pinned) { this.moveX = Math.sign(d); if (p.onGround) { this.jump = true; this.jumpHold = 0.35; } }
      else if (Math.abs(d) < 3) this.moveX = -Math.sign(d);
      else this.moveX = Math.sign(d) * (Math.abs(d) > 7 ? 1 : 0.25);
      if (b.y + b.h < p.y) this.moveY = -1; // flying boss above → aim up
    } else {
      this.moveX = 1;
      // aim at drones above
      for (const e of w.enemies) if (e.alive && e.type.flying && Math.abs(e.cx() - p.cx()) < 3 && e.y < p.y - 1) this.moveY = -1;
    }
    // jumping logic
    if (this.jumpHold > 0) { this.jumpHold -= dt; this.jumpHeld = true; } else this.jumpHeld = false;
    const dir = this.moveX >= 0 ? 1 : -1;
    const aheadX = dir > 0 ? p.x + p.w + 0.8 : p.x - 0.8;
    const gapAhead = p.onGround && !w.solidAt(aheadX, p.y + p.h + 0.4) && !w.solidAt(aheadX, p.y + p.h + 2.5);
    const wallAhead = p.onGround && w.solidAt(aheadX, p.y + p.h - 0.5);
    let danger = false;
    for (const pr of w.projs) if (pr.active && pr.team === 1 && (pr.kind === 8 || pr.kind === 13) && Math.abs(pr.x - p.cx()) < 2.4 && Math.sign(p.cx() - pr.x) === Math.sign(pr.vx)) danger = true;
    if (b && b.laserY > GROUND_Y - 0.8 && b.laserY > 0) danger = true;
    if (Math.abs(p.x - this.lastX) < 0.01 && Math.abs(this.moveX) > 0.5 && !b) this.stuckT += dt; else this.stuckT = 0;
    this.lastX = p.x;
    if ((gapAhead || wallAhead || danger || this.stuckT > 0.3) && p.onGround) { this.jump = true; this.jumpHold = 0.35; this.stuckT = 0; }
    // double jump over gaps when falling with nothing below
    if (!p.onGround && p.jumps < 2 && p.vy > 0.5 && !this.below(p.cx(), p.y + p.h, 4) && !this.below(p.cx() + dir * 1.2, p.y + p.h, 4)) { this.jump = true; this.jumpHold = 0.3; }
    if (b && b.laserY > 0 && b.laserY < GROUND_Y - 1) this.moveY = 1; // duck high laser
    if (Math.floor(this.t * 2) % 5 === 0 && p.throwCd <= 0) this.shield = true;
    if (p.ult >= 100) this.special = true;
    if (p.smashCd <= 0) for (const e of w.enemies) if (e.alive && Math.abs(e.cx() - p.cx()) < 2.2 && Math.abs(e.cy() - p.cy()) < 1.5) this.smash = true;
  }

  private below(x: number, y: number, depth: number) {
    for (let d = 0; d <= depth; d += 0.2) if (this.w.solidAt(x, y + d)) return true;
    return false;
  }

  takeJump() { const v = this.jump; this.jump = false; return v; }
  takeShieldPress() { return this.shield; }
  takeShieldRelease() { const v = this.shield; this.shield = false; return v; }
  takeSmash() { const v = this.smash; this.smash = false; return v; }
  takeSpecial() { const v = this.special; this.special = false; return v; }
}
