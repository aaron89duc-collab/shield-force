import Phaser from 'phaser';
import { ALL_ENEMIES, EType } from '../game/enemy';
import { BOSSES, BossType } from '../game/boss';
import { PU_COLOR, PU_LETTER } from '../game/entities';
import { PPU } from '../game/util';
import { canvasTex, darken, hex, lighten, Pen } from './pen';

/**
 * All art is generated procedurally at boot with a Canvas2D pen (cel-shaded fills + dark outline,
 * SNES run-and-gun look). Characters face RIGHT; sprites flip for left.
 * The hero's head is the user-provided portrait (public/hero-head.png); the body is an original design.
 */
type G = Pen;

export const HERO = {
  suit: 0x203a7a, suit2: 0x2f55a8, plate: 0x3a66c4, accent: 0x1fb59b, chevron: 0xf08a24,
  strap: 0x7a4a26, buckle: 0xf2c94c, glove: 0x1d6f66, boot: 0x2a2236, bootTrim: 0xf08a24, pad: 0x16295a,
};
export const HERO_W = 112, HERO_H = 128, HERO_FX = 52, HERO_FY = 122;

/** Round shield with chevron emblem (original design). */
export function drawShield(g: G, x: number, y: number, r: number, squash = 1) {
  g.ctx.save(); g.ctx.translate(x, y); g.ctx.scale(squash, 1);
  g.fillStyle(0x5d6a7c); g.fillCircle(0, 0, r);
  g.fillStyle(0xb8c4d4); g.fillCircle(0, 0, r * 0.9);
  g.fillStyle(0x1fb59b); g.fillCircle(0, 0, r * 0.74);
  g.fillStyle(0xe8eef6); g.fillCircle(0, 0, r * 0.5);
  g.fillStyle(HERO.chevron);
  const s = r * 0.4;
  g.fillPoints([{ x: -s, y: -s * 0.45 }, { x: 0, y: s * 0.5 }, { x: s, y: -s * 0.45 }, { x: s, y: s * 0.08 }, { x: 0, y: s }, { x: -s, y: s * 0.08 }]);
  g.flat(() => { g.fillStyle(0xffffff, 0.55); g.fillEllipse(-r * 0.35, -r * 0.42, r * 0.5, r * 0.25); });
  g.lineStyle(Math.max(1, r * 0.06), 0x0d0f1a, 0.6); g.strokeCircle(0, 0, r * 0.74);
  g.ctx.restore();
}

/** Cartoon limb: stroked polyline with inner outline + highlight (reads cleanly at small sizes). */
function limb(g: G, pts: number[][], w: number, color: number) {
  const c = g.ctx;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  const path = () => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); };
  path(); c.strokeStyle = hex(darken(color, 0.45)); c.lineWidth = w + 2.4; c.stroke();
  path(); c.strokeStyle = hex(color); c.lineWidth = w; c.stroke();
  c.translate(-w * 0.16, -w * 0.2);
  path(); c.strokeStyle = hex(lighten(color, 0.3), 0.75); c.lineWidth = w * 0.28; c.stroke();
  c.restore();
}

interface Pose {
  legA: number; legB: number; liftA: number; liftB: number;
  crouch: boolean; lean: number; bob: number;
  arm: 'hold' | 'shoot' | 'up' | 'block' | 'throw' | 'victory' | 'dash' | 'hero';
  shield: boolean; swing: number; hurt?: boolean;
}

function drawHero(g: G, P: Pose, head: CanvasImageSource | null, fx = HERO_FX, fy = HERO_FY) {
  const cr = P.crouch ? 12 : 0;
  const hipY = fy - 40 + cr + P.bob;
  const top = fy - 74 + cr + P.bob; // shoulder line
  const L = P.lean;
  g.flat(() => { g.fillStyle(0x000000, 0.25); g.fillEllipse(fx, fy - 1, 46, 7); });

  const leg = (side: number, dx: number, lift: number, col: number) => {
    const hx = fx + side * 7 + L * 0.3, footX = fx + dx, footY = fy - 8 - lift;
    const kneeX = (hx + footX) / 2 + (P.crouch ? 10 : 1.5), kneeY = (hipY + footY) / 2 - (P.crouch ? 4 : 0);
    limb(g, [[hx, hipY], [kneeX, kneeY], [footX, footY]], 12, col);
    // boot
    g.fillStyle(HERO.boot); g.fillRoundedRect(footX - 8, footY - 6, 20, 13, { tl: 4, tr: 8, bl: 2, br: 4 });
    g.flat(() => { g.fillStyle(HERO.bootTrim); g.fillRect(footX - 8, footY - 6, 13, 3); g.fillStyle(0x0d0f1a); g.fillRect(footX - 8, footY + 5, 20, 2.5); });
  };
  // back arm
  const bsx = fx - 17 + L, bsy = top + 6;
  let bel = [bsx - 4, top + 18], bh = [fx - 20 - P.swing + L, top + 29];
  if (P.arm === 'shoot' || P.arm === 'block' || P.arm === 'dash' || P.arm === 'throw') { bel = [fx - 8 + L, top + 20]; bh = [fx + 4 + L, top + 18]; }
  if (P.arm === 'hero') { bel = [bsx - 8, top + 16]; bh = [fx - 12 + L, hipY - 4]; }
  limb(g, [[bsx, bsy], bel, bh], 10, darken(HERO.suit2, 0.75));
  g.fillStyle(darken(HERO.glove, 0.8)); g.fillCircle(bh[0], bh[1], 5.5);

  leg(-1, P.legB, P.liftB, darken(HERO.suit2, 0.72));

  // torso
  g.fillStyle(HERO.suit);
  g.fillPoints([{ x: fx - 20 + L, y: top }, { x: fx + 20 + L, y: top }, { x: fx + 15 + L * 0.6, y: hipY - 2 }, { x: fx - 15 + L * 0.6, y: hipY - 2 }]);
  // pecs
  g.fillStyle(HERO.plate); g.fillRoundedRect(fx - 17 + L, top + 3, 16, 13, 5); g.fillRoundedRect(fx + 1 + L, top + 3, 16, 13, 5);
  g.flat(() => { g.fillStyle(HERO.accent); g.fillRect(fx - 1.8 + L, top + 2, 3.6, 22); });
  g.fillStyle(HERO.chevron);
  const cx = fx + L, cy = top + 10;
  g.fillPoints([{ x: cx - 8, y: cy - 3 }, { x: cx, y: cy + 3 }, { x: cx + 8, y: cy - 3 }, { x: cx + 8, y: cy + 1.5 }, { x: cx, y: cy + 7.5 }, { x: cx - 8, y: cy + 1.5 }]);
  g.flat(() => {
    g.lineStyle(1.3, darken(HERO.suit, 0.55), 0.9);
    g.lineBetween(fx - 6 + L, top + 20, fx - 5 + L * 0.7, hipY - 5); g.lineBetween(fx + 6 + L, top + 20, fx + 5 + L * 0.7, hipY - 5);
    g.lineBetween(fx - 9 + L, top + 22, fx + 9 + L, top + 22); g.lineBetween(fx - 8 + L, top + 27, fx + 8 + L, top + 27);
  });
  // strap, belt, pouch
  g.fillStyle(HERO.strap); g.fillPoints([{ x: fx + 13 + L, y: top }, { x: fx + 19 + L, y: top + 2 }, { x: fx - 9 + L * 0.6, y: hipY - 2 }, { x: fx - 15 + L * 0.6, y: hipY - 4 }]);
  g.fillStyle(HERO.strap); g.fillRoundedRect(fx - 16 + L * 0.6, hipY - 7, 32, 7, 2);
  g.fillStyle(HERO.buckle); g.fillRoundedRect(fx - 4 + L * 0.6, hipY - 8, 8, 9, 2);
  g.fillStyle(0x5a3a1e); g.fillRoundedRect(fx + 8 + L * 0.6, hipY - 6, 8, 10, 2);
  g.fillStyle(darken(HERO.suit2, 0.8)); g.fillRoundedRect(fx - 14 + L * 0.5, hipY - 1, 28, 8, 4);

  leg(1, P.legA, P.liftA, HERO.suit2);

  // collar + head
  g.fillStyle(HERO.pad); g.fillEllipse(fx + L, top + 1, 24, 8);
  const hw = 41, hh = hw * 360 / 297;
  const hx = fx + L - hw / 2 + 1, hy = top - hh + 7;
  if (head) {
    g.ctx.save();
    if (P.hurt) { g.ctx.translate(hx + hw / 2, hy + hh); g.ctx.rotate(-0.14); g.ctx.translate(-(hx + hw / 2), -(hy + hh)); }
    g.image(head, hx, hy, hw, hh);
    g.ctx.restore();
  } else { g.fillStyle(0xe8b88a); g.fillCircle(fx + L, top - 22, 20); }
  // shoulder pads
  g.fillStyle(HERO.pad); g.fillRoundedRect(fx - 24 + L, top - 1, 12, 11, 5); g.fillRoundedRect(fx + 12 + L, top - 1, 12, 11, 5);
  g.flat(() => { g.fillStyle(HERO.accent); g.fillRect(fx - 24 + L, top + 7, 12, 2.2); g.fillRect(fx + 12 + L, top + 7, 12, 2.2); });

  // front arm + shield
  const sx = fx + 17 + L, sy = top + 6;
  const arm = (el: number[], hand: number[]) => {
    limb(g, [[sx, sy], el, hand], 10.5, HERO.suit2);
    g.fillStyle(HERO.glove); g.fillCircle(hand[0], hand[1], 6);
    g.flat(() => { g.fillStyle(lighten(HERO.glove, 0.25)); g.fillRoundedRect(hand[0] - 5, hand[1] - 9, 10, 4, 2); });
  };
  switch (P.arm) {
    case 'hold': case 'hero':
      arm([sx + 4, sy + 13], [sx + 7 + P.swing * 0.4, sy + 24]);
      if (P.shield) drawShield(g, sx + 11, sy + 19, 18, 0.62);
      break;
    case 'shoot':
      arm([sx + 12, sy + 5], [sx + 23, sy + 2]);
      if (P.shield) drawShield(g, sx + 28, sy + 1, 17, 0.45);
      break;
    case 'up':
      arm([sx + 7, sy - 10], [sx + 8, sy - 24]);
      if (P.shield) { g.ctx.save(); g.ctx.translate(sx + 8, sy - 31); g.ctx.scale(1, 0.45); drawShield(g, 0, 0, 17); g.ctx.restore(); }
      break;
    case 'block': case 'dash':
      arm([sx + 9, sy + 9], [sx + 16, sy + 8]);
      if (P.shield) drawShield(g, sx + 21, sy + 7, 23, 0.5);
      break;
    case 'throw':
      arm([sx + 13, sy + 1], [sx + 26, sy - 4]);
      break;
    case 'victory':
      arm([sx + 10, sy - 10], [sx + 12, sy - 26]);
      if (P.shield) drawShield(g, sx + 14, sy - 38, 16);
      break;
  }
}

export const HERO_FRAMES = ['idle', 'idle2', 'run0', 'run1', 'run2', 'run3', 'run4', 'run5', 'jump', 'fall', 'crouch', 'block', 'hurt', 'dash', 'victory', 'up', 'shoot', 'throw', 'crouchshoot'] as const;

function heroPose(f: string, shield: boolean): Pose {
  const P: Pose = { legA: 6, legB: -6, liftA: 0, liftB: 0, crouch: false, lean: 0, arm: 'hold', shield, bob: 0, swing: 0 };
  const run = (a: number, b: number, la: number, lb: number, bob: number, sw: number) => { P.legA = a; P.legB = b; P.liftA = la; P.liftB = lb; P.bob = bob; P.lean = 3; P.arm = 'shoot'; P.swing = sw; };
  switch (f) {
    case 'idle2': P.bob = 1; break;
    case 'run0': run(15, -14, 0, 4, 0, 4); break;
    case 'run1': run(8, -6, 2, 10, -2, 2); break;
    case 'run2': run(-2, 4, 7, 4, -3, -2); break;
    case 'run3': run(-14, 15, 4, 0, 0, -4); break;
    case 'run4': run(-6, 8, 10, 2, -2, -2); break;
    case 'run5': run(4, -2, 4, 7, -3, 2); break;
    case 'jump': P.legA = 10; P.legB = -8; P.liftA = 14; P.liftB = 5; P.arm = 'shoot'; P.bob = -2; break;
    case 'fall': P.legA = 6; P.legB = -10; P.liftA = 4; P.liftB = 9; P.arm = 'shoot'; break;
    case 'crouch': P.crouch = true; P.legA = 13; P.legB = -11; P.arm = 'hold'; break;
    case 'crouchshoot': P.crouch = true; P.legA = 13; P.legB = -11; P.arm = 'shoot'; break;
    case 'block': P.legA = 11; P.legB = -11; P.arm = 'block'; P.lean = -1; break;
    case 'hurt': P.legA = -3; P.legB = -13; P.lean = -5; P.arm = 'hold'; P.hurt = true; break;
    case 'dash': P.legA = 17; P.legB = -17; P.lean = 7; P.liftB = 5; P.arm = 'dash'; break;
    case 'victory': P.arm = 'victory'; P.legA = 9; P.legB = -9; break;
    case 'hero': P.arm = 'hero'; P.legA = 11; P.legB = -11; break;
    case 'up': P.arm = 'up'; break;
    case 'shoot': P.arm = 'shoot'; break;
    case 'throw': P.arm = 'throw'; P.legA = 11; P.legB = -9; P.lean = 4; break;
  }
  return P;
}

/** Large hero art for the title screen. */
export function buildHeroPortrait(scene: Phaser.Scene, key: string, scale: number, frame = 'victory') {
  const head = scene.textures.exists('heroHead') ? scene.textures.get('heroHead').getSourceImage() as CanvasImageSource : null;
  canvasTex(scene, key, HERO_W * scale, HERO_H * scale, g => { g.ctx.scale(scale, scale); drawHero(g, heroPose(frame, true), head); }, { outline: 3 });
}

// ------------------------------------------------------------------ enemies
function drawEnemy(g: G, t: EType, frame: number, W: number, H: number) {
  const w = t.w * PPU, h = t.h * PPU;
  const fx = W / 2, fy = H - 2;
  const x = fx - w / 2, y = fy - h;
  const c1 = t.c1, c2 = t.c2;
  const step = frame === 1 ? 4 : frame === 2 ? 0 : -4;
  const atk = frame === 2;
  const eye = (ex: number, ey: number, r: number, col = 0xffe04a) => { g.fillStyle(col); g.fillCircle(ex, ey, r); g.fillStyle(0xffffff, 0.8); g.fillCircle(ex + r * 0.3, ey - r * 0.3, r * 0.35); };
  const legs = (n: number, lw: number, lh: number, col: number) => {
    for (let i = 0; i < n; i++) {
      const lx = x + w * (0.25 + 0.5 * (i / Math.max(1, n - 1))) - lw / 2 + (i % 2 ? step : -step);
      g.fillStyle(col); g.fillRoundedRect(lx, fy - lh, lw, lh, 2);
    }
  };
  switch (t.key) {
    case 'mutant': case 'shielder': case 'alien': case 'cyborg': {
      legs(2, w * 0.28, h * 0.38, darken(c1, 0.7));
      g.fillStyle(c1); g.fillRoundedRect(x + w * 0.1, y + h * 0.22, w * 0.8, h * 0.45, 6);
      g.fillStyle(darken(c1, 0.8)); g.fillRect(x + w * 0.1, y + h * 0.55, w * 0.8, h * 0.06);
      const hc = t.key === 'alien' ? c1 : t.key === 'cyborg' ? 0x9aa2ae : lighten(c1, 0.15);
      g.fillStyle(hc); g.fillRoundedRect(x + w * 0.2, y, w * 0.62, h * 0.26, 7);
      if (t.key === 'alien') { g.fillStyle(c2); g.fillEllipse(x + w * 0.66, y + h * 0.12, w * 0.3, h * 0.08); }
      else if (t.key === 'cyborg') { g.fillStyle(c2); g.fillRect(x + w * 0.5, y + h * 0.09, w * 0.36, h * 0.05); }
      else eye(x + w * 0.66, y + h * 0.12, 3, t.key === 'mutant' ? 0xff4a3a : 0xffe04a);
      // weapon arm
      g.fillStyle(darken(c1, 0.85));
      if (atk) g.fillRoundedRect(x + w * 0.55, y + h * 0.3, w * 0.75, h * 0.1, 3);
      else g.fillRoundedRect(x + w * 0.55, y + h * 0.28, w * 0.25, h * 0.32, 3);
      if (t.key === 'alien' || t.key === 'cyborg') { g.fillStyle(0x30343c); g.fillRect(x + w * 0.65, y + h * 0.33, w * 0.55, h * 0.07); g.fillStyle(c2); g.fillCircle(x + w * 1.2, y + h * 0.365, 2.5); }
      if (t.key === 'shielder') {
        g.fillStyle(c2); g.fillRoundedRect(x + w * 0.78, y + h * 0.15, w * 0.28, h * 0.62, 4);
        g.fillStyle(0x5d6b85); g.fillRect(x + w * 0.86, y + h * 0.2, w * 0.08, h * 0.52);
      }
      break;
    }
    case 'drone': {
      g.fillStyle(0x30343c); g.fillRect(x + w * 0.05, y + h * 0.05, w * 0.9, h * 0.1);
      g.fillStyle(0xcccccc, frame === 1 ? 0.8 : 0.4); g.fillEllipse(x + w * 0.15, y + h * 0.05, w * 0.35, h * 0.12); g.fillEllipse(x + w * 0.85, y + h * 0.05, w * 0.35, h * 0.12);
      g.fillStyle(c1); g.fillRoundedRect(x + w * 0.15, y + h * 0.2, w * 0.7, h * 0.6, 8);
      g.fillStyle(atk ? 0xffffff : c2); g.fillCircle(x + w * 0.5, y + h * 0.55, h * 0.2);
      g.fillStyle(0x222222); g.fillRect(x + w * 0.45, y + h * 0.78, w * 0.1, h * 0.2);
      break;
    }
    case 'rat': case 'alienspider': case 'spider': case 'scorpion': {
      const many = t.key !== 'rat';
      if (many) { for (let i = 0; i < 4; i++) { const lx = x + w * (0.15 + i * 0.22) + (i % 2 ? step : -step) * 0.5; g.lineStyle(3, darken(c1, 0.6)); g.lineBetween(lx, fy - h * 0.5, lx - 4, fy); } }
      else legs(2, 6, h * 0.35, darken(c1, 0.7));
      g.fillStyle(c1); g.fillEllipse(x + w * 0.45, y + h * 0.5, w * 0.8, h * 0.7);
      g.fillStyle(lighten(c1, 0.1)); g.fillEllipse(x + w * 0.85, y + h * 0.5, w * 0.35, h * 0.5);
      eye(x + w * 0.92, y + h * 0.42, 2.5, many ? c2 : 0xff4a3a);
      if (t.key === 'rat') { g.lineStyle(3, darken(c1, 0.8)); g.lineBetween(x + w * 0.08, y + h * 0.5, x - w * 0.12, y + h * 0.2); }
      if (t.key === 'scorpion') { g.lineStyle(5, c2); g.beginPath(); g.moveTo(x + w * 0.1, y + h * 0.4); g.lineTo(x + w * 0.05, y - h * 0.1); g.lineTo(x + w * 0.35, y - h * (atk ? 0.35 : 0.2)); g.strokePath(); g.fillStyle(0xff7a2e); g.fillCircle(x + w * 0.37, y - h * (atk ? 0.35 : 0.2), 4); }
      if (t.key === 'spider') { g.fillStyle(c2); g.fillCircle(x + w * 0.35, y + h * 0.45, 4); }
      if (t.key === 'alienspider') { g.fillStyle(c2, 0.8); g.fillCircle(x + w * 0.3, y + h * 0.4, 5); }
      break;
    }
    case 'bug': {
      legs(3, 4, h * 0.4, 0x222222);
      g.fillStyle(c2); g.fillEllipse(x + w * 0.45, y + h * 0.5, w * 0.85, h * 0.8);
      g.fillStyle(atk ? 0xffffff : c1); g.fillEllipse(x + w * 0.4, y + h * 0.45, w * 0.6, h * 0.55);
      g.fillStyle(0xffd04a); g.fillCircle(x + w * 0.4, y + h * 0.45, 4);
      eye(x + w * 0.88, y + h * 0.45, 2.5, 0xffffff);
      break;
    }
    case 'robot': {
      g.fillStyle(0x333333); g.fillRoundedRect(x + w * 0.1, fy - h * 0.18, w * 0.8, h * 0.18, 5);
      g.fillStyle(0x666666); for (let i = 0; i < 3; i++) g.fillCircle(x + w * (0.25 + i * 0.25) + step * 0.3, fy - h * 0.09, 4);
      g.fillStyle(c1); g.fillRoundedRect(x + w * 0.12, y + h * 0.2, w * 0.76, h * 0.62, 4);
      g.fillStyle(0x222222); g.fillRect(x + w * 0.22, y + h * 0.3, w * 0.56, h * 0.18);
      g.fillStyle(atk ? 0xffffff : 0xff4a3a); g.fillRect(x + w * 0.5, y + h * 0.35, w * 0.2, h * 0.08);
      g.fillStyle(darken(c1, 0.7)); g.fillRect(x + w * 0.35, y + h * 0.05, w * 0.3, h * 0.15);
      g.fillStyle(0x444444); g.fillRect(x + w * 0.7, y + h * 0.5, w * 0.5, h * 0.1);
      g.fillStyle(0xd0c060); for (let i = 0; i < 3; i++) g.fillRect(x + w * 0.2 + i * 6, y + h * 0.65, 3, h * 0.12);
      break;
    }
    case 'werewolf': {
      legs(2, w * 0.25, h * 0.4, darken(c1, 0.7));
      g.fillStyle(c1); g.fillEllipse(x + w * 0.5, y + h * 0.48, w * 0.95, h * 0.55);
      g.fillStyle(lighten(c1, 0.15)); g.fillEllipse(x + w * 0.75, y + h * 0.2, w * 0.55, h * 0.3);
      g.fillTriangle(x + w * 0.55, y + h * 0.1, x + w * 0.62, y - h * 0.05, x + w * 0.7, y + h * 0.08);
      g.fillStyle(darken(c1, 0.6)); g.fillEllipse(x + w * 1.0, y + h * 0.24, w * 0.3, h * 0.12);
      eye(x + w * 0.85, y + h * 0.17, 3, 0xff3a3a);
      g.fillStyle(0xffffff); for (let i = 0; i < 3; i++) g.fillTriangle(x + w * (0.25 + i * 0.12), y + h * 0.6, x + w * (0.3 + i * 0.12), y + h * (atk ? 0.85 : 0.75), x + w * (0.35 + i * 0.12), y + h * 0.6);
      break;
    }
    case 'tree': {
      g.fillStyle(c1); g.fillRoundedRect(x + w * 0.2, y + h * 0.25, w * 0.6, h * 0.75, 8);
      g.fillStyle(darken(c1, 0.7)); for (let i = 0; i < 4; i++) g.fillRect(x + w * (0.28 + i * 0.12), y + h * 0.35, 3, h * 0.6);
      g.fillStyle(c2); g.fillCircle(x + w * 0.5, y + h * 0.22, w * 0.42); g.fillCircle(x + w * 0.2, y + h * 0.3, w * 0.25); g.fillCircle(x + w * 0.8, y + h * 0.28, w * 0.27);
      g.fillStyle(darken(c2, 0.7)); g.fillCircle(x + w * 0.6, y + h * 0.15, w * 0.15);
      eye(x + w * 0.4, y + h * 0.45, 4, 0xffd04a); eye(x + w * 0.62, y + h * 0.45, 4, 0xffd04a);
      g.fillStyle(0x221a10); g.fillRoundedRect(x + w * 0.38, y + h * 0.56, w * 0.3, h * (atk ? 0.12 : 0.05), 3);
      g.lineStyle(6, c1); g.lineBetween(x + w * 0.2, y + h * 0.45, x - w * 0.05, y + h * (atk ? 0.2 : 0.65));
      g.lineBetween(x + w * 0.8, y + h * 0.45, x + w * 1.05, y + h * (atk ? 0.2 : 0.65));
      break;
    }
    case 'sandmon': case 'icemon': case 'lavamon': case 'firedemon': {
      const big = t.key !== 'firedemon';
      legs(2, w * 0.3, h * 0.35, darken(c1, 0.75));
      g.fillStyle(c1); g.fillRoundedRect(x + w * 0.05, y + h * 0.18, w * 0.9, h * 0.55, big ? 12 : 8);
      g.fillStyle(lighten(c1, 0.2)); g.fillRoundedRect(x + w * 0.28, y, w * 0.5, h * 0.28, 8);
      if (t.key === 'lavamon') { g.fillStyle(c2); for (let i = 0; i < 5; i++) g.fillRect(x + w * (0.15 + i * 0.15), y + h * (0.25 + (i % 2) * 0.15), 4, h * 0.25); }
      if (t.key === 'icemon') { g.fillStyle(0xffffff, 0.8); g.fillTriangle(x + w * 0.2, y + h * 0.2, x + w * 0.3, y - h * 0.08, x + w * 0.4, y + h * 0.2); g.fillTriangle(x + w * 0.6, y + h * 0.2, x + w * 0.7, y - h * 0.1, x + w * 0.8, y + h * 0.2); }
      if (t.key === 'firedemon') { g.fillStyle(c2); g.fillTriangle(x + w * 0.3, y + h * 0.05, x + w * 0.4, y - h * 0.15, x + w * 0.5, y + h * 0.05); g.fillTriangle(x + w * 0.55, y + h * 0.05, x + w * 0.68, y - h * 0.18, x + w * 0.78, y + h * 0.05); }
      if (t.key === 'sandmon') { g.fillStyle(c2); g.fillCircle(x + w * 0.3, y + h * 0.4, 5); g.fillCircle(x + w * 0.6, y + h * 0.55, 4); }
      eye(x + w * 0.66, y + h * 0.12, 3.5, t.key === 'icemon' ? 0x3af0ff : 0xffe04a);
      g.fillStyle(darken(c1, 0.8));
      g.fillRoundedRect(x + w * (atk ? 0.75 : 0.7), y + h * (atk ? 0.05 : 0.3), w * 0.3, h * 0.35, 6);
      break;
    }
    default:
      g.fillStyle(c1); g.fillRect(x, y, w, h);
  }
}

// ------------------------------------------------------------------ bosses
function drawBoss(g: G, b: BossType, atk: boolean, W: number, H: number) {
  const w = b.w * PPU, h = b.h * PPU;
  const x = W / 2 - w / 2, y = H - 4 - h;
  const c1 = b.c1, c2 = b.c2;
  const glow = (gx: number, gy: number, r: number, col = c2) => { g.fillStyle(col, 0.35); g.fillCircle(gx, gy, r * 1.6); g.fillStyle(col); g.fillCircle(gx, gy, r); g.fillStyle(0xffffff, 0.8); g.fillCircle(gx - r * 0.3, gy - r * 0.3, r * 0.35); };
  switch (b.key) {
    case 'ironbeast': {
      g.fillStyle(darken(c1, 0.6)); g.fillRoundedRect(x + w * 0.1, y + h * 0.65, w * 0.25, h * 0.35, 6); g.fillRoundedRect(x + w * 0.62, y + h * 0.65, w * 0.25, h * 0.35, 6);
      g.fillStyle(c1); g.fillRoundedRect(x, y + h * 0.2, w, h * 0.52, 14);
      g.fillStyle(darken(c1, 0.8)); g.fillRoundedRect(x + w * 0.55, y + h * 0.05, w * 0.42, h * 0.32, 10);
      g.fillStyle(0xffd04a); g.fillRect(x + w * 0.75, y + h * 0.15, w * 0.15, h * 0.06);
      glow(x + w * 0.18, y + h * 0.38, 12); // back core
      g.fillStyle(0x2a2e36); g.fillRect(x + w * 0.7, y + h * 0.42, w * 0.45, h * 0.12);
      g.fillRect(x + w * 0.7, y + h * 0.56, w * 0.4, h * 0.08);
      if (atk) { g.fillStyle(0xffd04a); g.fillCircle(x + w * 1.15, y + h * 0.48, 7); }
      g.fillStyle(0x777f8c); g.fillRect(x + w * 0.2, y + h * 0.02, w * 0.18, h * 0.22);
      break;
    }
    case 'mechatitan': {
      g.fillStyle(darken(c1, 0.6)); g.fillRect(x + w * 0.2, y + h * 0.7, w * 0.2, h * 0.3); g.fillRect(x + w * 0.6, y + h * 0.7, w * 0.2, h * 0.3);
      g.fillStyle(c1); g.fillRoundedRect(x + w * 0.1, y + h * 0.22, w * 0.8, h * 0.52, 10);
      g.fillStyle(darken(c1, 0.75)); g.fillRoundedRect(x + w * 0.3, y, w * 0.4, h * 0.25, 8);
      g.fillStyle(c2); g.fillRect(x + w * 0.45, y + h * 0.08, w * 0.22, h * 0.05);
      g.fillStyle(darken(c1, 0.85)); g.fillRoundedRect(x + w * (atk ? 0.85 : 0.72), y + h * 0.38, w * 0.4, h * 0.22, 8);
      glow(x + w * (atk ? 1.1 : 0.98), y + h * 0.49, 9);
      g.fillRoundedRect(x - w * 0.05, y + h * 0.3, w * 0.22, h * 0.32, 6);
      break;
    }
    case 'forestbeast': {
      g.fillStyle(darken(c1, 0.7)); for (let i = 0; i < 4; i++) g.fillRoundedRect(x + w * (0.08 + i * 0.22), y + h * 0.6, w * 0.13, h * 0.4, 5);
      g.fillStyle(c1); g.fillEllipse(x + w * 0.45, y + h * 0.48, w * 0.9, h * 0.6);
      g.fillStyle(c2); for (let i = 0; i < 6; i++) g.fillTriangle(x + w * (0.1 + i * 0.12), y + h * 0.28, x + w * (0.15 + i * 0.12), y + h * 0.05, x + w * (0.2 + i * 0.12), y + h * 0.28);
      g.fillStyle(lighten(c1, 0.1)); g.fillEllipse(x + w * 0.85, y + h * 0.42, w * 0.38, h * 0.42);
      g.fillStyle(atk ? 0xff3a3a : 0x221510); g.fillEllipse(x + w * 0.95, y + h * 0.55, w * 0.18, h * (atk ? 0.2 : 0.06));
      glow(x + w * 0.88, y + h * 0.35, 5, 0xffe04a);
      break;
    }
    case 'sandworm': {
      for (let i = 0; i < 5; i++) { g.fillStyle(i % 2 ? c1 : darken(c1, 0.85)); g.fillRoundedRect(x + w * 0.05, y + h * (0.25 + i * 0.15), w * 0.9, h * 0.17, 10); }
      g.fillStyle(lighten(c1, 0.1)); g.fillRoundedRect(x, y, w, h * 0.3, 18);
      g.fillStyle(c2); g.fillEllipse(x + w * 0.5, y + h * 0.12, w * 0.7, h * (atk ? 0.14 : 0.06));
      g.fillStyle(0xffffff); for (let i = 0; i < 5; i++) g.fillTriangle(x + w * (0.22 + i * 0.13), y + h * 0.09, x + w * (0.27 + i * 0.13), y + h * 0.15, x + w * (0.32 + i * 0.13), y + h * 0.09);
      glow(x + w * 0.3, y + h * 0.05, 4, 0xff4a3a); glow(x + w * 0.7, y + h * 0.05, 4, 0xff4a3a);
      break;
    }
    case 'frozengolem': {
      g.fillStyle(darken(c1, 0.7)); g.fillRoundedRect(x + w * 0.15, y + h * 0.68, w * 0.25, h * 0.32, 6); g.fillRoundedRect(x + w * 0.6, y + h * 0.68, w * 0.25, h * 0.32, 6);
      g.fillStyle(c1); g.fillRoundedRect(x + w * 0.05, y + h * 0.18, w * 0.9, h * 0.55, 14);
      g.fillStyle(lighten(c1, 0.3)); g.fillRoundedRect(x + w * 0.3, y, w * 0.4, h * 0.22, 10);
      g.fillStyle(0xffffff, 0.8); for (let i = 0; i < 4; i++) g.fillTriangle(x + w * (0.1 + i * 0.25), y + h * 0.2, x + w * (0.18 + i * 0.25), y + h * 0.02, x + w * (0.26 + i * 0.25), y + h * 0.2);
      glow(x + w * 0.5, y + h * 0.42, 13);
      g.fillStyle(darken(c1, 0.8)); g.fillRoundedRect(x - w * 0.08, y + h * (atk ? 0.15 : 0.3), w * 0.2, h * 0.4, 8); g.fillRoundedRect(x + w * 0.88, y + h * (atk ? 0.15 : 0.3), w * 0.2, h * 0.4, 8);
      glow(x + w * 0.6, y + h * 0.1, 4, 0x3af0ff);
      break;
    }
    case 'biotitan': {
      g.fillStyle(darken(c1, 0.7)); g.fillRoundedRect(x + w * 0.1, y + h * 0.7, w * 0.8, h * 0.3, 12);
      g.fillStyle(c1); g.fillEllipse(x + w * 0.5, y + h * 0.45, w, h * 0.75);
      g.fillStyle(lighten(c1, 0.15)); g.fillEllipse(x + w * 0.7, y + h * 0.2, w * 0.4, h * 0.3);
      glow(x + w * 0.25, y + h * 0.2, 8); glow(x + w * 0.5, y + h * 0.12, 7); glow(x + w * 0.4, y + h * 0.32, 6);
      glow(x + w * 0.78, y + h * 0.18, 4, 0xff4a3a);
      g.lineStyle(8, darken(c1, 0.8)); g.lineBetween(x + w * 0.85, y + h * 0.45, x + w * 1.1, y + h * (atk ? 0.15 : 0.7));
      break;
    }
    case 'lavadragon': {
      g.fillStyle(darken(c1, 0.8)); g.fillTriangle(x + w * 0.25, y + h * 0.35, x + w * 0.4, y - h * (atk ? 0.3 : 0.1), x + w * 0.6, y + h * 0.35);
      g.fillStyle(c1); g.fillEllipse(x + w * 0.45, y + h * 0.5, w * 0.7, h * 0.55);
      g.fillStyle(c1); g.fillTriangle(x, y + h * 0.4, x + w * 0.2, y + h * 0.5, x + w * 0.15, y + h * 0.7);
      g.fillStyle(lighten(c1, 0.15)); g.fillEllipse(x + w * 0.82, y + h * 0.4, w * 0.32, h * 0.4);
      g.fillStyle(c2); g.fillEllipse(x + w * 0.45, y + h * 0.6, w * 0.45, h * 0.18);
      g.fillStyle(atk ? 0xffe04a : 0x3a0a05); g.fillEllipse(x + w * 0.95, y + h * 0.48, w * 0.12, h * (atk ? 0.16 : 0.05));
      glow(x + w * 0.85, y + h * 0.33, 4, 0xffe04a);
      g.fillStyle(0xffffff, 0.9); g.fillTriangle(x + w * 0.78, y + h * 0.22, x + w * 0.74, y + h * 0.05, x + w * 0.83, y + h * 0.2);
      break;
    }
    case 'alienqueen': {
      for (let i = 0; i < 3; i++) { g.lineStyle(5, darken(c1, 0.7)); g.lineBetween(x + w * (0.2 + i * 0.25), y + h * 0.6, x + w * (0.1 + i * 0.28), y + h); }
      g.fillStyle(c1); g.fillEllipse(x + w * 0.3, y + h * 0.58, w * 0.6, h * 0.42);
      glow(x + w * 0.22, y + h * 0.62, 11);
      g.fillStyle(lighten(c1, 0.1)); g.fillRoundedRect(x + w * 0.5, y + h * 0.15, w * 0.3, h * 0.5, 10);
      g.fillStyle(lighten(c1, 0.2)); g.fillEllipse(x + w * 0.75, y + h * 0.15, w * 0.35, h * 0.28);
      g.fillStyle(darken(c1, 0.7)); g.fillTriangle(x + w * 0.6, y + h * 0.1, x + w * 0.55, y - h * 0.05, x + w * 0.75, y + h * 0.03);
      glow(x + w * 0.85, y + h * 0.12, 4, 0x9cff4a);
      g.lineStyle(5, lighten(c1, 0.1)); g.lineBetween(x + w * 0.75, y + h * 0.35, x + w * (atk ? 1.1 : 0.95), y + h * (atk ? 0.3 : 0.55));
      break;
    }
    case 'overlord': {
      g.fillStyle(darken(c1, 0.6)); g.fillRoundedRect(x + w * 0.15, y + h * 0.7, w * 0.25, h * 0.3, 6); g.fillRoundedRect(x + w * 0.6, y + h * 0.7, w * 0.25, h * 0.3, 6);
      g.fillStyle(c1); g.fillRoundedRect(x + w * 0.05, y + h * 0.15, w * 0.9, h * 0.6, 12);
      g.fillStyle(lighten(c1, 0.15)); g.fillRoundedRect(x + w * 0.28, y, w * 0.44, h * 0.2, 10);
      g.fillStyle(c2); g.fillRect(x + w * 0.38, y + h * 0.08, w * 0.24, h * 0.04);
      g.fillStyle(0x4a4f5e); g.fillRoundedRect(x - w * 0.1, y + h * 0.18, w * 0.22, h * 0.14, 6); g.fillRoundedRect(x + w * 0.88, y + h * 0.18, w * 0.22, h * 0.14, 6);
      g.fillStyle(0x30343c); g.fillRect(x + w * 0.75, y + h * (atk ? 0.32 : 0.4), w * 0.45, h * 0.08);
      g.lineStyle(3, c2, 0.6); g.strokeRoundedRect(x + w * 0.05, y + h * 0.15, w * 0.9, h * 0.6, 12);
      break;
    }
  }
}

// ------------------------------------------------------------------ builders
export function buildTextures(scene: Phaser.Scene) {
  const head = scene.textures.exists('heroHead') ? scene.textures.get('heroHead').getSourceImage() as CanvasImageSource : null;
  for (const f of HERO_FRAMES) {
    canvasTex(scene, 'hero_' + f, HERO_W, HERO_H, g => drawHero(g, heroPose(f, true), head), { outline: 1.6 });
    canvasTex(scene, 'heroNS_' + f, HERO_W, HERO_H, g => drawHero(g, heroPose(f, false), head), { outline: 1.6 });
  }
  canvasTex(scene, 'shield', 44, 44, g => drawShield(g, 22, 22, 19), { outline: 1.5 });

  for (const t of ALL_ENEMIES) {
    const W = Math.ceil(t.w * PPU * 1.6 + 34), H = Math.ceil(t.h * PPU + 34);
    for (let f = 0; f < 3; f++) canvasTex(scene, `e_${t.key}_${f}`, W, H, g => { g.ctx.translate(0, -2); drawEnemy(g, t, f, W, H); }, { outline: 2.2 });
  }
  for (const b of Object.values(BOSSES)) {
    const W = Math.ceil(b.w * PPU * 1.5 + 44), H = Math.ceil(b.h * PPU * 1.4 + 24);
    canvasTex(scene, `b_${b.key}`, W, H, g => { g.ctx.translate(0, -2); drawBoss(g, b, false, W, H); }, { outline: 3 });
    canvasTex(scene, `b_${b.key}_a`, W, H, g => { g.ctx.translate(0, -2); drawBoss(g, b, true, W, H); }, { outline: 3 });
  }

  // ---- projectiles (glowing cores) ----
  const orb = (key: string, s: number, c: number, core = 0xffffff) => canvasTex(scene, key, s, s, g => {
    g.glow(s / 2, s / 2, s / 2, c, 0.75); g.flat(() => { g.fillStyle(lighten(c, 0.4)); g.fillCircle(s / 2, s / 2, s * 0.26); g.fillStyle(core); g.fillCircle(s / 2, s / 2, s * 0.13); });
  });
  const bolt = (key: string, w: number, h: number, c: number) => canvasTex(scene, key, w, h, g => {
    g.glow(w * 0.6, h / 2, h * 0.9, c, 0.6);
    g.flat(() => { g.fillStyle(c, 0.6); g.fillEllipse(w / 2, h / 2, w, h * 0.8); g.fillStyle(lighten(c, 0.6)); g.fillEllipse(w * 0.6, h / 2, w * 0.6, h * 0.4); g.fillStyle(0xffffff); g.fillEllipse(w * 0.68, h / 2, w * 0.3, h * 0.22); });
  });
  bolt('pr_shot', 30, 16, 0x5fd8ff);
  bolt('pr_plasma', 36, 20, 0x3be8d2);
  bolt('pr_laser', 34, 10, 0xff2e5a);
  orb('pr_reflect', 30, 0x7fffe0);
  orb('pr_bullet', 18, 0xff7a2e, 0xfff0c0);
  orb('pr_fire', 28, 0xff4a1e, 0xfff0a0);
  orb('pr_sand', 22, 0xcf9e5a, 0xfff0c0);
  orb('pr_acid', 22, 0x9cff4a, 0xf0ffd0);
  canvasTex(scene, 'pr_ice', 20, 20, g => { g.fillStyle(0x9ad4f0); g.fillPoints([{ x: 10, y: 0 }, { x: 20, y: 10 }, { x: 10, y: 20 }, { x: 0, y: 10 }]); }, { outline: 1 });
  canvasTex(scene, 'pr_rock', 20, 20, g => { g.fillStyle(0x6a4a2a); g.fillCircle(10, 10, 8); g.fillStyle(0x8ce04a); g.fillCircle(7, 7, 3); }, { outline: 1 });
  canvasTex(scene, 'pr_web', 28, 28, g => { g.lineStyle(1.6, 0xeeeeee, 0.9); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; g.lineBetween(14 - Math.cos(a) * 12, 14 - Math.sin(a) * 12, 14 + Math.cos(a) * 12, 14 + Math.sin(a) * 12); } g.strokeCircle(14, 14, 6); g.strokeCircle(14, 14, 11); });
  canvasTex(scene, 'pr_shard', 22, 32, g => { g.fillStyle(0xbfe9ff); g.fillTriangle(11, 31, 1, 1, 21, 1); g.flat(() => { g.fillStyle(0xffffff, 0.8); g.fillTriangle(11, 24, 7, 3, 13, 3); }); }, { outline: 1 });
  canvasTex(scene, 'pr_missile', 22, 44, g => {
    g.glow(11, 4, 10, 0xffb03a, 0.7);
    g.fillStyle(0x6a7080); g.fillRoundedRect(5, 2, 12, 32, 5); g.fillStyle(0xff4a3a); g.fillTriangle(5, 32, 17, 32, 11, 43);
    g.fillStyle(0x3a3f4c); g.fillTriangle(1, 6, 5, 2, 5, 14); g.fillTriangle(21, 6, 17, 2, 17, 14); g.fillStyle(0xf2c94c); g.fillRect(5, 22, 12, 3);
  }, { outline: 1 });
  canvasTex(scene, 'pr_egg', 32, 36, g => { g.fillStyle(0x5e3a7a); g.fillEllipse(16, 19, 28, 32); g.flat(() => g.glow(16, 20, 10, 0x9cff4a, 0.8)); g.lineStyle(1.5, 0x2a1238, 0.8); g.lineBetween(10, 8, 14, 16); g.lineBetween(22, 10, 19, 18); }, { outline: 1.2 });
  canvasTex(scene, 'pr_wave', 40, 44, g => { g.glow(20, 40, 22, 0xffe0a0, 0.6); g.flat(() => { g.fillStyle(0xffffff, 0.35); g.fillTriangle(2, 44, 20, 2, 38, 44); g.fillStyle(0xfff0c0, 0.75); g.fillTriangle(8, 44, 20, 14, 32, 44); }); });
  canvasTex(scene, 'pr_lavawave', 74, 84, g => {
    g.glow(37, 50, 40, 0xff6a1e, 0.6);
    g.fillStyle(0xd8321e); g.fillRoundedRect(2, 12, 70, 72, 22); g.fillStyle(0xffa02e); g.fillRoundedRect(10, 22, 54, 62, 16);
    g.flat(() => { g.fillStyle(0xfff0a0, 0.85); g.fillEllipse(37, 20, 52, 16); });
  }, { outline: 1.5 });
  canvasTex(scene, 'pr_pillar', 44, 152, g => {
    g.fillStyle(0x4a6a2a); g.fillRoundedRect(6, 12, 32, 140, 14); g.fillStyle(0x6e8a4a); g.fillTriangle(6, 24, 22, 0, 38, 24);
    g.flat(() => { for (let i = 0; i < 5; i++) g.glow(22, 30 + i * 25, 7, 0xe0ff4a, 0.9); });
  }, { outline: 1.5 });

  // ---- pickups: glossy capsules ----
  for (let i = 0; i < PU_LETTER.length; i++) {
    canvasTex(scene, 'pu_' + i, 44, 44, g => {
      if (i === 7) {
        g.fillStyle(0xb8860b); g.fillCircle(22, 22, 13); g.fillStyle(0xf2c94c); g.fillCircle(22, 22, 10.5);
        g.flat(() => { g.fillStyle(0xfff3b0); g.fillRoundedRect(20, 15, 4, 14, 2); });
      } else {
        g.glow(22, 22, 22, PU_COLOR[i], 0.5);
        g.fillStyle(darken(PU_COLOR[i], 0.7)); g.fillRoundedRect(5, 8, 34, 28, 13);
        g.fillStyle(PU_COLOR[i]); g.fillRoundedRect(7, 10, 30, 24, 11);
        g.flat(() => { g.fillStyle(0xffffff, 0.45); g.fillRoundedRect(11, 12, 22, 6, 3); });
        const c = g.ctx; c.font = 'bold 19px Arial Black, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineWidth = 3.5; c.strokeStyle = 'rgba(13,15,26,0.9)'; c.strokeText(PU_LETTER[i], 22, 23.5);
        c.fillStyle = '#ffffff'; c.fillText(PU_LETTER[i], 22, 23.5);
      }
    }, { outline: 1.2 });
  }

  // ---- hazards / props ----
  canvasTex(scene, 'barrel', 42, 50, g => {
    g.fillStyle(0xb8321e); g.fillRoundedRect(3, 1, 36, 48, 7); g.fillStyle(0x7a1e12); g.fillRect(3, 9, 36, 4); g.fillRect(3, 37, 36, 4);
    g.fillStyle(0xffd04a); g.fillTriangle(21, 16, 13, 32, 29, 32); g.flat(() => { g.fillStyle(0x222222); g.fillRect(20, 21, 2, 6); g.fillRect(20, 28.5, 2, 2); g.fillStyle(0xffffff, 0.25); g.fillRect(8, 3, 4, 44); });
  }, { outline: 1.4 });
  canvasTex(scene, 'crate', 46, 46, g => {
    g.fillStyle(0xa8743e); g.fillRect(1, 1, 44, 44);
    g.lineStyle(4, 0x5a3a1a); g.strokeRect(4, 4, 38, 38); g.lineBetween(5, 5, 41, 41);
    g.flat(() => { g.fillStyle(0xd0a060, 0.4); for (let y = 8; y < 42; y += 9) g.fillRect(6, y, 34, 2); });
  }, { outline: 1.4 });
  canvasTex(scene, 'crusher', 90, 66, g => {
    g.fillStyle(0x5d6470); g.fillRoundedRect(1, 1, 88, 52, 6);
    g.fillStyle(0x30343c); for (let i = 0; i < 6; i++) g.fillTriangle(1 + i * 15, 52, 8 + i * 15, 65, 15 + i * 15, 52);
    g.flat(() => { for (let i = 0; i < 5; i++) { g.fillStyle(i % 2 ? 0x222222 : 0xffd04a); g.fillPoints([{ x: 4 + i * 17, y: 10 }, { x: 14 + i * 17, y: 10 }, { x: 8 + i * 17, y: 22 }, { x: -2 + i * 17, y: 22 }]); } });
    g.fillStyle(0x8a919c); for (const x of [8, 82]) g.fillCircle(x, 40, 3);
  }, { outline: 1.4 });
  canvasTex(scene, 'icicle', 26, 50, g => { g.fillStyle(0xbfe9ff); g.fillTriangle(1, 1, 25, 1, 13, 49); g.flat(() => { g.fillStyle(0xffffff, 0.7); g.fillTriangle(5, 1, 11, 1, 10, 32); }); }, { outline: 1.2 });
  const flag = (key: string, on: boolean) => canvasTex(scene, key, 44, 134, g => {
    g.fillStyle(0x4a4f5e); g.fillRoundedRect(0, 124, 18, 9, 3);
    g.fillStyle(on ? 0xe0e6ee : 0x8a8f9a); g.fillRect(7, 4, 5, 122); g.fillCircle(9.5, 4, 4);
    g.fillStyle(on ? 0x2bd67b : 0x666a74); g.fillPoints([{ x: 12, y: 8 }, { x: 42, y: 15 }, { x: 36, y: 22 }, { x: 42, y: 30 }, { x: 12, y: 34 }]);
    if (on) g.flat(() => g.glow(25, 20, 18, 0x5aff8c, 0.5));
  }, { outline: 1.2 });
  flag('flag_off', false); flag('flag_on', true);

  // ---- UI ----
  canvasTex(scene, 'btn', 48, 48, g => {
    const c = g.ctx, gr = c.createLinearGradient(0, 0, 0, 48);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#d8d8d8'); gr.addColorStop(1, '#8a8a8a');
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); (c as any).roundRect(2, 5, 44, 42, 12); c.fill();
    c.fillStyle = gr; c.beginPath(); (c as any).roundRect(2, 2, 44, 42, 12); c.fill();
    c.strokeStyle = 'rgba(13,15,26,0.95)'; c.lineWidth = 2.5; c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); (c as any).roundRect(7, 5, 34, 7, 4); c.fill();
  }, { shade: 0 });
  {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 288;
    const c = cv.getContext('2d')!; const gr = c.createRadialGradient(256, 144, 90, 256, 144, 300);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.75)'); c.fillStyle = gr; c.fillRect(0, 0, 512, 288);
    if (scene.textures.exists('vignette')) scene.textures.remove('vignette');
    scene.textures.addCanvas('vignette', cv);
  }
  canvasTex(scene, 'logo', 560, 150, g => {
    const c = g.ctx;
    c.font = '900 76px Arial Black, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillText('SHIELD FORCE', 283, 80);
    c.lineWidth = 14; c.strokeStyle = '#0d0f1a'; c.strokeText('SHIELD FORCE', 280, 72);
    c.lineWidth = 6; c.strokeStyle = '#1fb59b'; c.strokeText('SHIELD FORCE', 280, 72);
    const gr = c.createLinearGradient(0, 36, 0, 108);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, '#ffe28a'); gr.addColorStop(0.55, '#f0a028'); gr.addColorStop(1, '#c0501a');
    c.fillStyle = gr; c.fillText('SHIELD FORCE', 280, 72);
    c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(0, 36, 560, 16); c.globalCompositeOperation = 'source-over';
    c.font = 'bold 20px Arial, sans-serif'; c.lineWidth = 5; c.strokeStyle = '#0d0f1a';
    c.strokeText('— 2D RUN & GUN ACTION —', 280, 128); c.fillStyle = '#9ff0e2'; c.fillText('— 2D RUN & GUN ACTION —', 280, 128);
  }, { shade: 0 });
  buildHeroPortrait(scene, 'hero_portrait', 2.4, 'hero');
  buildHeroPortrait(scene, 'hero_portrait_run', 2.4, 'shoot');

  // ---- fx ----
  canvasTex(scene, 'dot', 8, 8, g => g.flat(() => { g.fillStyle(0xffffff); g.fillRect(0, 0, 8, 8); }));
  canvasTex(scene, 'glow', 64, 64, g => g.glow(32, 32, 32, 0xffffff, 0.9));
  canvasTex(scene, 'flash', 40, 40, g => {
    g.glow(20, 20, 20, 0xfff0a0, 0.9);
    g.flat(() => { g.fillStyle(0xffffff); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.fillTriangle(20 + Math.cos(a + 0.25) * 4, 20 + Math.sin(a + 0.25) * 4, 20 + Math.cos(a) * 18, 20 + Math.sin(a) * 18, 20 + Math.cos(a - 0.25) * 4, 20 + Math.sin(a - 0.25) * 4); } g.fillCircle(20, 20, 6); });
  });
  canvasTex(scene, 'ring', 64, 64, g => { g.lineStyle(5, 0xffffff, 0.9); g.strokeCircle(32, 32, 28); g.lineStyle(2, 0xffffff, 0.5); g.strokeCircle(32, 32, 22); });
  canvasTex(scene, 'smoke', 32, 32, g => g.glow(16, 16, 16, 0x8a8f9a, 0.8));
  canvasTex(scene, 'spark', 16, 16, g => { g.glow(8, 8, 8, 0xffffff, 1); g.flat(() => { g.fillStyle(0xffffff); g.fillRect(7, 0, 2, 16); g.fillRect(0, 7, 16, 2); }); });
}
