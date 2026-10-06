import Phaser from 'phaser';
import { ALL_ENEMIES, EType } from '../game/enemy';
import { BOSSES, BossType } from '../game/boss';
import { PU_COLOR, PU_LETTER } from '../game/entities';
import { PPU } from '../game/util';

/**
 * All art is generated procedurally at boot (placeholder art per GDD §23 — no external assets).
 * Characters face RIGHT; sprites flip for left. Origin convention: bottom-center = feet.
 */
type G = Phaser.GameObjects.Graphics;

const HERO = {
  suit: 0x1d2b53, suit2: 0x2a3d70, accent: 0x1fa58f, chevron: 0xf08a24,
  helmet: 0x34405a, visor: 0xffb347, skin: 0xe0b48a, boot: 0x141a2c, glove: 0x2b2f3a,
};

function darken(c: number, k: number) {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  return (Math.round(r * k) << 16) | (Math.round(g * k) << 8) | Math.round(b * k);
}
function lighten(c: number, k: number) {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  return (Math.min(255, Math.round(r + (255 - r) * k)) << 16) | (Math.min(255, Math.round(g + (255 - g) * k)) << 8) | Math.min(255, Math.round(b + (255 - b) * k));
}

function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, Math.ceil(w), Math.ceil(h));
  g.destroy();
}

/** Round shield with chevron emblem (original design). */
export function drawShield(g: G, x: number, y: number, r: number) {
  g.fillStyle(0x6d7a8c); g.fillCircle(x, y, r);
  g.fillStyle(0x9aa6b8); g.fillCircle(x, y, r * 0.9);
  g.fillStyle(0x1fa58f); g.fillCircle(x, y, r * 0.75);
  g.fillStyle(0xc9d3e0); g.fillCircle(x, y, r * 0.52);
  g.fillStyle(HERO.chevron);
  const s = r * 0.42;
  g.fillPoints([{ x: x - s, y: y - s * 0.45 }, { x, y: y + s * 0.5 }, { x: x + s, y: y - s * 0.45 }, { x: x + s, y: y + s * 0.05 }, { x, y: y + s }, { x: x - s, y: y + s * 0.05 }], true);
  g.fillStyle(0xffffff, 0.35); g.fillCircle(x - r * 0.3, y - r * 0.35, r * 0.18);
}

interface Pose {
  legA: number; legB: number;  // horizontal foot offsets
  liftA: number; liftB: number; // foot lift
  crouch: boolean; lean: number;
  arm: 'hold' | 'shoot' | 'up' | 'block' | 'throw' | 'victory';
  shield: boolean; bob: number;
}

function drawHero(g: G, P: Pose) {
  const fx = 34, fy = 79;
  const ch = P.crouch ? 16 : 0;
  const top = fy - 70 + ch + P.bob;
  // back leg
  const leg = (dx: number, lift: number, col: number) => {
    const lh = P.crouch ? 14 : 26;
    g.fillStyle(col); g.fillRoundedRect(fx - 5 + dx, fy - lh - 4 - lift, 10, lh, 3);
    g.fillStyle(HERO.boot); g.fillRoundedRect(fx - 6 + dx, fy - 9 - lift, 14, 9, 3);
  };
  leg(P.legB, P.liftB, darken(HERO.suit, 0.75));
  // back arm
  g.fillStyle(darken(HERO.suit, 0.75)); g.fillRoundedRect(fx - 14 + P.lean, top + 22, 8, 20, 3);
  // torso
  g.fillStyle(HERO.suit); g.fillRoundedRect(fx - 12 + P.lean, top + 18, 24, 30 - (P.crouch ? 4 : 0), 6);
  g.fillStyle(HERO.suit2); g.fillRect(fx - 12 + P.lean, top + 18, 24, 6);
  g.fillStyle(HERO.accent); g.fillRect(fx - 12 + P.lean, top + 40 - (P.crouch ? 4 : 0), 24, 4);
  g.fillStyle(HERO.chevron);
  const cx = fx + P.lean, cy = top + 28;
  g.fillPoints([{ x: cx - 7, y: cy - 3 }, { x: cx, y: cy + 3 }, { x: cx + 7, y: cy - 3 }, { x: cx + 7, y: cy + 1 }, { x: cx, y: cy + 7 }, { x: cx - 7, y: cy + 1 }], true);
  // front leg
  leg(P.legA, P.liftA, HERO.suit);
  // head + helmet
  const hx = fx + 2 + P.lean, hy = top + 9;
  g.fillStyle(HERO.skin); g.fillCircle(hx, hy + 2, 9);
  g.fillStyle(HERO.helmet); g.fillRoundedRect(hx - 10, hy - 9, 20, 13, { tl: 9, tr: 9, bl: 2, br: 2 });
  g.fillStyle(HERO.accent); g.fillRect(hx - 2, hy - 10, 4, 10);
  g.fillStyle(HERO.visor); g.fillRoundedRect(hx + 1, hy - 1, 10, 5, 2);
  g.fillStyle(0xffffff, 0.6); g.fillRect(hx + 3, hy, 4, 1.5);
  // front arm + shield
  const sx = fx + P.lean;
  switch (P.arm) {
    case 'hold':
      g.fillStyle(HERO.suit2); g.fillRoundedRect(sx + 4, top + 22, 8, 18, 3);
      if (P.shield) drawShield(g, sx + 13, top + 34, 13);
      break;
    case 'shoot':
      g.fillStyle(HERO.suit2); g.fillRoundedRect(sx + 4, top + 22, 18, 8, 3);
      g.fillStyle(HERO.glove); g.fillCircle(sx + 22, top + 26, 4);
      if (P.shield) drawShield(g, sx + 23, top + 27, 12);
      break;
    case 'up':
      g.fillStyle(HERO.suit2); g.fillRoundedRect(sx + 4, top + 4, 8, 22, 3);
      if (P.shield) drawShield(g, sx + 10, top + 1, 12);
      break;
    case 'block':
      g.fillStyle(HERO.suit2); g.fillRoundedRect(sx + 4, top + 20, 14, 8, 3);
      if (P.shield) drawShield(g, sx + 20, top + 27, 17);
      break;
    case 'throw':
      g.fillStyle(HERO.suit2); g.fillRoundedRect(sx + 4, top + 20, 20, 7, 3);
      g.fillStyle(HERO.glove); g.fillCircle(sx + 25, top + 23, 4);
      break;
    case 'victory':
      g.fillStyle(HERO.suit2); g.fillRoundedRect(sx + 4, top + 2, 8, 24, 3);
      if (P.shield) drawShield(g, sx + 9, top - 2, 12);
      break;
  }
}

export const HERO_FRAMES = ['idle', 'idle2', 'run0', 'run1', 'run2', 'run3', 'jump', 'fall', 'crouch', 'block', 'hurt', 'dash', 'victory', 'up', 'shoot', 'throw', 'crouchshoot'] as const;

function heroPose(f: string, shield: boolean): Pose {
  const P: Pose = { legA: 0, legB: -4, liftA: 0, liftB: 0, crouch: false, lean: 0, arm: 'hold', shield, bob: 0 };
  switch (f) {
    case 'idle2': P.bob = 1; break;
    case 'run0': P.legA = 9; P.legB = -9; P.lean = 2; P.liftB = 3; P.arm = 'shoot'; break;
    case 'run1': P.legA = 3; P.legB = -3; P.lean = 2; P.liftA = 5; P.bob = -2; P.arm = 'shoot'; break;
    case 'run2': P.legA = -9; P.legB = 9; P.lean = 2; P.liftA = 3; P.arm = 'shoot'; break;
    case 'run3': P.legA = -3; P.legB = 3; P.lean = 2; P.liftB = 5; P.bob = -2; P.arm = 'shoot'; break;
    case 'jump': P.legA = 6; P.legB = -6; P.liftA = 8; P.liftB = 2; P.arm = 'shoot'; break;
    case 'fall': P.legA = 3; P.legB = -7; P.liftA = 2; P.liftB = 6; P.arm = 'shoot'; break;
    case 'crouch': P.crouch = true; P.legA = 6; P.legB = -6; P.arm = 'hold'; break;
    case 'crouchshoot': P.crouch = true; P.legA = 6; P.legB = -6; P.arm = 'shoot'; break;
    case 'block': P.legA = 6; P.legB = -8; P.arm = 'block'; P.lean = -1; break;
    case 'hurt': P.legA = -4; P.legB = -10; P.lean = -4; P.arm = 'hold'; break;
    case 'dash': P.legA = 10; P.legB = -12; P.lean = 6; P.liftB = 4; P.arm = 'block'; break;
    case 'victory': P.arm = 'victory'; P.legA = 4; P.legB = -5; break;
    case 'up': P.arm = 'up'; break;
    case 'shoot': P.arm = 'shoot'; break;
    case 'throw': P.arm = 'throw'; P.legA = 7; P.legB = -6; P.lean = 3; break;
  }
  return P;
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
  // hero, with and without shield in hand
  for (const f of HERO_FRAMES) {
    tex(scene, 'hero_' + f, 72, 82, g => drawHero(g, heroPose(f, true)));
    tex(scene, 'heroNS_' + f, 72, 82, g => drawHero(g, heroPose(f, false)));
  }
  tex(scene, 'shield', 36, 36, g => drawShield(g, 18, 18, 17));

  for (const t of ALL_ENEMIES) {
    const W = Math.ceil(t.w * PPU * 1.6 + 30), H = Math.ceil(t.h * PPU + 30);
    for (let f = 0; f < 3; f++) tex(scene, `e_${t.key}_${f}`, W, H, g => drawEnemy(g, t, f, W, H));
  }
  for (const b of Object.values(BOSSES)) {
    const W = Math.ceil(b.w * PPU * 1.5 + 40), H = Math.ceil(b.h * PPU * 1.4 + 20);
    tex(scene, `b_${b.key}`, W, H, g => drawBoss(g, b, false, W, H));
    tex(scene, `b_${b.key}_a`, W, H, g => drawBoss(g, b, true, W, H));
  }

  // projectiles
  tex(scene, 'pr_shot', 22, 12, g => { g.fillStyle(0x7fe0ff, 0.4); g.fillEllipse(11, 6, 22, 12); g.fillStyle(0xe6fbff); g.fillEllipse(13, 6, 12, 6); });
  tex(scene, 'pr_plasma', 26, 16, g => { g.fillStyle(0x3be8d2, 0.45); g.fillEllipse(13, 8, 26, 16); g.fillStyle(0xd9fff9); g.fillEllipse(15, 8, 14, 8); });
  tex(scene, 'pr_reflect', 24, 24, g => { g.fillStyle(0x7fffe0, 0.45); g.fillCircle(12, 12, 12); g.fillStyle(0xffffff); g.fillCircle(12, 12, 6); });
  tex(scene, 'pr_bullet', 14, 14, g => { g.fillStyle(0xff7a2e, 0.5); g.fillCircle(7, 7, 7); g.fillStyle(0xffe0a0); g.fillCircle(7, 7, 4); });
  tex(scene, 'pr_laser', 28, 8, g => { g.fillStyle(0xff2e5a, 0.5); g.fillRoundedRect(0, 0, 28, 8, 4); g.fillStyle(0xffd0dc); g.fillRoundedRect(3, 2, 22, 4, 2); });
  tex(scene, 'pr_fire', 22, 22, g => { g.fillStyle(0xff4a1e, 0.5); g.fillCircle(11, 11, 11); g.fillStyle(0xffb02e); g.fillCircle(11, 11, 7); g.fillStyle(0xfff0a0); g.fillCircle(11, 11, 3); });
  tex(scene, 'pr_ice', 20, 20, g => { g.fillStyle(0x9ad4f0); g.fillTriangle(10, 0, 20, 10, 10, 20); g.fillTriangle(10, 0, 0, 10, 10, 20); });
  tex(scene, 'pr_sand', 18, 18, g => { g.fillStyle(0xcf9e5a, 0.6); g.fillCircle(9, 9, 9); g.fillStyle(0xf0d090); g.fillCircle(9, 9, 5); });
  tex(scene, 'pr_acid', 18, 18, g => { g.fillStyle(0x9cff4a, 0.5); g.fillCircle(9, 9, 9); g.fillStyle(0xe0ff9a); g.fillCircle(9, 9, 5); });
  tex(scene, 'pr_rock', 18, 18, g => { g.fillStyle(0x6a4a2a); g.fillCircle(9, 9, 8); g.fillStyle(0x8ce04a); g.fillCircle(6, 6, 3); });
  tex(scene, 'pr_web', 26, 26, g => { g.lineStyle(2, 0xeeeeee, 0.9); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; g.lineBetween(13 - Math.cos(a) * 12, 13 - Math.sin(a) * 12, 13 + Math.cos(a) * 12, 13 + Math.sin(a) * 12); } g.strokeCircle(13, 13, 6); g.strokeCircle(13, 13, 11); });
  tex(scene, 'pr_shard', 20, 30, g => { g.fillStyle(0xbfe9ff); g.fillTriangle(10, 30, 0, 0, 20, 0); g.fillStyle(0xffffff, 0.7); g.fillTriangle(10, 24, 6, 2, 12, 2); });
  tex(scene, 'pr_missile', 20, 40, g => { g.fillStyle(0x666b78); g.fillRoundedRect(4, 0, 12, 32, 5); g.fillStyle(0xff4a3a); g.fillTriangle(4, 30, 16, 30, 10, 40); g.fillStyle(0x444444); g.fillTriangle(0, 4, 4, 0, 4, 10); g.fillTriangle(20, 4, 16, 0, 16, 10); });
  tex(scene, 'pr_egg', 30, 34, g => { g.fillStyle(0x5e3a7a); g.fillEllipse(15, 18, 28, 32); g.fillStyle(0x9cff4a, 0.7); g.fillEllipse(15, 18, 12, 16); });
  tex(scene, 'pr_wave', 36, 40, g => { g.fillStyle(0xffffff, 0.25); g.fillTriangle(0, 40, 18, 0, 36, 40); g.fillStyle(0xffe0a0, 0.6); g.fillTriangle(6, 40, 18, 12, 30, 40); });
  tex(scene, 'pr_lavawave', 70, 80, g => { g.fillStyle(0xff4a1e, 0.85); g.fillRoundedRect(0, 10, 70, 70, 20); g.fillStyle(0xffb02e); g.fillRoundedRect(8, 20, 54, 60, 16); g.fillStyle(0xfff0a0, 0.8); g.fillEllipse(35, 18, 50, 16); });
  tex(scene, 'pr_pillar', 40, 150, g => { g.fillStyle(0x4a6a2a); g.fillRoundedRect(4, 10, 32, 140, 14); g.fillStyle(0xe0ff4a, 0.8); for (let i = 0; i < 5; i++) g.fillCircle(20, 25 + i * 26, 5); g.fillStyle(0x6e8a4a); g.fillTriangle(4, 20, 20, 0, 36, 20); });

  // pickups (capsule + letter)
  for (let i = 0; i < PU_LETTER.length; i++) {
    const key = 'pu_' + i;
    const rt = scene.make.renderTexture({ width: 40, height: 40 }, false);
    const g = scene.make.graphics({}, false);
    if (i === 7) {
      g.fillStyle(0xb8860b); g.fillCircle(20, 20, 13); g.fillStyle(0xf2c94c); g.fillCircle(20, 20, 11); g.fillStyle(0xfff3b0); g.fillRect(18, 13, 4, 14);
    } else {
      g.fillStyle(0xffffff, 0.25); g.fillCircle(20, 20, 19);
      g.fillStyle(PU_COLOR[i]); g.fillRoundedRect(4, 6, 32, 28, 12);
      g.lineStyle(2, 0xffffff, 0.9); g.strokeRoundedRect(4, 6, 32, 28, 12);
    }
    rt.draw(g);
    if (i !== 7) {
      const t = scene.make.text({ text: PU_LETTER[i], style: { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '20px', color: '#ffffff', fontStyle: 'bold' } }, false);
      t.setOrigin(0.5); rt.draw(t, 20, 20); t.destroy();
    }
    rt.saveTexture(key);
    g.destroy();
  }

  // hazards
  tex(scene, 'barrel', 40, 48, g => { g.fillStyle(0xb8321e); g.fillRoundedRect(2, 0, 36, 48, 6); g.fillStyle(0x7a1e12); g.fillRect(2, 8, 36, 4); g.fillRect(2, 36, 36, 4); g.fillStyle(0xffd04a); g.fillTriangle(20, 16, 12, 32, 28, 32); g.fillStyle(0x222222); g.fillRect(19, 21, 2, 6); });
  tex(scene, 'crate', 44, 44, g => { g.fillStyle(0x9a6a3a); g.fillRect(0, 0, 44, 44); g.lineStyle(3, 0x5a3a1a); g.strokeRect(2, 2, 40, 40); g.lineBetween(2, 2, 42, 42); g.lineBetween(42, 2, 2, 42); });
  tex(scene, 'crusher', 88, 64, g => { g.fillStyle(0x555b66); g.fillRect(0, 0, 88, 52); g.fillStyle(0x30343c); for (let i = 0; i < 6; i++) g.fillTriangle(i * 15, 52, i * 15 + 7, 64, i * 15 + 14, 52); g.fillStyle(0xffd04a); for (let i = 0; i < 4; i++) g.fillRect(6 + i * 22, 8, 10, 6); });
  tex(scene, 'icicle', 24, 48, g => { g.fillStyle(0xbfe9ff); g.fillTriangle(0, 0, 24, 0, 12, 48); g.fillStyle(0xffffff, 0.7); g.fillTriangle(4, 0, 10, 0, 9, 30); });
  tex(scene, 'flag_off', 40, 130, g => { g.fillStyle(0x888888); g.fillRect(4, 0, 5, 130); g.fillStyle(0x666666); g.fillTriangle(9, 4, 38, 16, 9, 28); g.fillStyle(0x444444); g.fillRect(0, 124, 14, 6); });
  tex(scene, 'flag_on', 40, 130, g => { g.fillStyle(0xdddddd); g.fillRect(4, 0, 5, 130); g.fillStyle(0x2bd67b); g.fillTriangle(9, 4, 38, 16, 9, 28); g.fillStyle(0xffffff); g.fillCircle(18, 16, 3); g.fillStyle(0x444444); g.fillRect(0, 124, 14, 6); });
  tex(scene, 'dot', 8, 8, g => { g.fillStyle(0xffffff); g.fillRect(0, 0, 8, 8); });
  tex(scene, 'glow', 64, 64, g => { for (let i = 8; i > 0; i--) { g.fillStyle(0xffffff, 0.06); g.fillCircle(32, 32, i * 4); } });
}
