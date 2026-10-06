import Phaser from 'phaser';
import type { Controls } from '../game/player';

export const BTN = { FIRE: 0, JUMP: 1, SHIELD: 2, SMASH: 3, SPECIAL: 4 } as const;
const LABEL = ['FIRE', 'JUMP', 'SHIELD', 'SMASH', 'SPECIAL'];
const COLOR = [0xe8553b, 0x3b8de8, 0x2bb3a0, 0xe8a13b, 0xb04be8];

/** Read CSS safe-area insets (notches) in CSS px. */
export function safeInsets() {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(d);
  const cs = getComputedStyle(d);
  const r = { left: parseFloat(cs.paddingLeft) || 0, right: parseFloat(cs.paddingRight) || 0, top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
  d.remove();
  return r;
}

/**
 * Virtual touch controls (GDD §5): floating joystick left, FIRE/JUMP/SHIELD/SMASH/SPECIAL right.
 * Multi-touch, 64dp+ touch targets, layout options (default / mirrored / large). Keyboard also works.
 */
export class TouchControls implements Controls {
  moveX = 0; moveY = 0;
  fireHeld = false; jumpHeld = false; shieldHeld = false;
  private jumpL = false; private shPressL = false; private shRelL = false; private smashL = false; private specL = false;

  bx: number[] = []; by: number[] = []; br: number[] = [];
  private pressed = [false, false, false, false, false];
  private ptrRole = new Map<number, number>(); // pointer id → 0..4 button, 99 joystick
  private joyId = -1; private joyBX = 0; private joyBY = 0; private joyX = 0; private joyY = 0;
  readonly joyR = 70;
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private kb = { left: false, right: false, up: false, down: false, fire: false, jump: false, shield: false };
  private mirrored = false;
  private W = 960; private H = 540; private insetL = 0; private insetR = 0;
  enabled = true;
  bot: Controls | null = null; // automated tests

  private gfx: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  cooldown = [0, 0, 0, 0, 0];
  glow = [false, false, false, false, false];

  constructor(private scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(50);
    for (let i = 0; i < 5; i++) {
      this.labels.push(scene.add.text(0, 0, LABEL[i], { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: i < 2 ? '19px' : '14px', color: '#ffffff' }).setOrigin(0.5).setDepth(51).setAlpha(0.95));
    }
    const inp = scene.input;
    inp.addPointer(4);
    inp.on('pointerdown', this.down, this);
    inp.on('pointermove', this.moveP, this);
    inp.on('pointerup', this.up, this);
    inp.on('pointerupoutside', this.up, this);
    inp.on('gameout', () => this.reset());
    const kb = inp.keyboard;
    if (kb) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      const map: Record<string, number[]> = {
        left: [K.LEFT, K.A], right: [K.RIGHT, K.D], up: [K.UP, K.W], down: [K.DOWN, K.S],
        fire: [K.J, K.X], jump: [K.K, K.SPACE, K.Z], shield: [K.L, K.C], smash: [K.U, K.V], special: [K.I, K.B],
      };
      for (const [name, codes] of Object.entries(map)) {
        for (const code of codes) {
          const key = kb.addKey(code, true, false);
          this.keys[name + code] = key;
          key.on('down', () => this.onKey(name, true));
          key.on('up', () => this.onKey(name, false));
        }
      }
    }
  }

  layout(W: number, H: number, insetL: number, insetR: number, mode: number) {
    this.W = W; this.H = H; this.insetL = insetL; this.insetR = insetR;
    this.mirrored = mode === 1;
    const s = mode === 2 ? 1.18 : 1;
    const right = W - insetR;
    const set = (i: number, x: number, y: number, r: number) => { this.bx[i] = x; this.by[i] = y; this.br[i] = r; };
    set(0, right - 100 * s, H - 100 * s, 60 * s);
    set(1, right - 235 * s, H - 72 * s, 56 * s);
    set(2, right - 82 * s, H - 238 * s, 47 * s);
    set(3, right - 205 * s, H - 205 * s, 41 * s);
    set(4, right - 330 * s, H - 175 * s, 40 * s);
    if (this.mirrored) for (let i = 0; i < 5; i++) this.bx[i] = W - this.bx[i] - insetR + insetL;
    for (let i = 0; i < 5; i++) this.labels[i].setPosition(this.bx[i], this.by[i]);
  }

  setVisible(v: boolean) { this.gfx.setVisible(v); for (const l of this.labels) l.setVisible(v); }

  reset() {
    this.ptrRole.clear(); this.joyId = -1;
    this.pressed.fill(false);
    this.fireHeld = this.jumpHeld = this.shieldHeld = false;
    this.jumpL = this.shPressL = this.shRelL = this.smashL = this.specL = false;
    for (const k of Object.keys(this.kb) as (keyof typeof this.kb)[]) this.kb[k] = false;
    this.recompute();
  }

  private hit(x: number, y: number) {
    let best = -1, bd = 1e9;
    for (let i = 0; i < 5; i++) {
      const d = (x - this.bx[i]) ** 2 + (y - this.by[i]) ** 2, r = this.br[i] + 14;
      if (d < r * r && d < bd) { bd = d; best = i; }
    }
    return best;
  }

  private down(p: Phaser.Input.Pointer) {
    if (!this.enabled) return;
    const b = this.hit(p.x, p.y);
    if (b >= 0) { this.ptrRole.set(p.id, b); this.press(b); }
    else if ((this.mirrored ? p.x > this.W * 0.55 : p.x < this.W * 0.45) && this.joyId < 0 && p.y > 70) {
      this.ptrRole.set(p.id, 99); this.joyId = p.id;
      this.joyBX = Phaser.Math.Clamp(p.x, this.insetL + this.joyR + 10, this.W - this.insetR - this.joyR - 10);
      this.joyBY = Phaser.Math.Clamp(p.y, this.H * 0.35, this.H - this.joyR - 10);
      this.joyX = p.x; this.joyY = p.y;
    }
    this.recompute();
  }

  private moveP(p: Phaser.Input.Pointer) {
    const role = this.ptrRole.get(p.id);
    if (role === undefined) return;
    if (role === 99) { this.joyX = p.x; this.joyY = p.y; }
    else if (role === 0 || role === 1) { // slide between FIRE and JUMP
      const b = this.hit(p.x, p.y);
      if ((b === 0 || b === 1) && b !== role) { this.release(role); this.ptrRole.set(p.id, b); this.press(b); }
    }
    this.recompute();
  }

  private up(p: Phaser.Input.Pointer) {
    const role = this.ptrRole.get(p.id);
    if (role === undefined) return;
    if (role === 99) this.joyId = -1; else this.release(role);
    this.ptrRole.delete(p.id);
    this.recompute();
  }

  private press(b: number) {
    this.pressed[b] = true;
    if (b === 1) this.jumpL = true;
    if (b === 2) this.shPressL = true;
    if (b === 3) this.smashL = true;
    if (b === 4) this.specL = true;
  }
  private release(b: number) {
    this.pressed[b] = false;
    if (b === 2) this.shRelL = true;
  }

  private onKey(name: string, d: boolean) {
    if (!this.enabled && d) return;
    const k = this.kb as any;
    const was = k[name];
    if (name in this.kb) k[name] = d;
    if (d && !was) {
      if (name === 'jump') this.jumpL = true;
      if (name === 'shield') this.shPressL = true;
      if (name === 'smash') this.smashL = true;
      if (name === 'special') this.specL = true;
    }
    if (!d && was && name === 'shield') this.shRelL = true;
    this.recompute();
  }

  private recompute() {
    let mx = 0, my = 0;
    if (this.joyId >= 0) {
      let dx = (this.joyX - this.joyBX) / this.joyR, dy = (this.joyY - this.joyBY) / this.joyR;
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      mx = Math.abs(dx) < 0.22 ? 0 : dx;
      my = Math.abs(dy) < 0.3 ? 0 : dy;
    }
    if (this.kb.left) mx = -1;
    if (this.kb.right) mx = 1;
    if (this.kb.up) my = -1;
    if (this.kb.down) my = 1;
    this.moveX = mx; this.moveY = my;
    this.fireHeld = this.pressed[0] || this.kb.fire;
    this.jumpHeld = this.pressed[1] || this.kb.jump;
    this.shieldHeld = this.pressed[2] || this.kb.shield;
  }

  takeJump() { const v = this.jumpL; this.jumpL = false; return v; }
  takeShieldPress() { const v = this.shPressL; this.shPressL = false; return v; }
  takeShieldRelease() { const v = this.shRelL; this.shRelL = false; return v; }
  takeSmash() { const v = this.smashL; this.smashL = false; return v; }
  takeSpecial() { const v = this.specL; this.specL = false; return v; }

  draw(time: number) {
    const g = this.gfx;
    g.clear();
    if (this.joyId >= 0) {
      g.fillStyle(0xffffff, 0.15); g.fillCircle(this.joyBX, this.joyBY, this.joyR);
      g.lineStyle(3, 0xffffff, 0.5); g.strokeCircle(this.joyBX, this.joyBY, this.joyR);
      let dx = this.joyX - this.joyBX, dy = this.joyY - this.joyBY;
      const len = Math.hypot(dx, dy);
      if (len > this.joyR) { dx = dx / len * this.joyR; dy = dy / len * this.joyR; }
      g.fillStyle(0xffffff, 0.55); g.fillCircle(this.joyBX + dx, this.joyBY + dy, 32);
    } else {
      const hx = this.mirrored ? this.W - this.insetR - 140 : this.insetL + 140, hy = this.H - 120;
      g.fillStyle(0xffffff, 0.08); g.fillCircle(hx, hy, this.joyR);
      g.lineStyle(2, 0xffffff, 0.3); g.strokeCircle(hx, hy, this.joyR);
      g.fillStyle(0xffffff, 0.22); g.fillCircle(hx, hy, 30);
    }
    for (let i = 0; i < 5; i++) {
      const x = this.bx[i], y = this.by[i], r = this.br[i];
      let a = this.pressed[i] ? 0.75 : 0.3;
      if (this.glow[i]) {
        const p = 0.5 + 0.5 * Math.sin(time * 8);
        g.fillStyle(COLOR[i], 0.35); g.fillCircle(x, y, r + 8 + p * 4);
        a = 0.8;
      }
      g.fillStyle(COLOR[i], a); g.fillCircle(x, y, r);
      g.lineStyle(3, 0xffffff, 0.6); g.strokeCircle(x, y, r);
      const cd = this.cooldown[i];
      if (cd > 0) {
        g.fillStyle(0x000000, 0.4); g.fillCircle(x, y, r - 2);
        g.lineStyle(6, 0xffffff, 0.8);
        g.beginPath(); g.arc(x, y, r - 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cd, false); g.strokePath();
      }
    }
  }
}
