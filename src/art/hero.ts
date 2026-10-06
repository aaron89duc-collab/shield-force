import Phaser from 'phaser';
import { canvasTex, darken, hex, lighten, Pen } from './pen';
import { Outfit, PantsDef, ShoeDef, TopDef } from './outfits';
import { hash } from '../game/util';

/**
 * Hero renderer: portrait head (public/hero-head.png) on an original chibi body.
 * Clothing (top / pants / shoes) comes from the wardrobe so every outfit is redrawn into the sprites.
 */
export const HERO_W = 112, HERO_H = 128, HERO_FX = 52, HERO_FY = 122;
export const CHEVRON = 0xf08a24;
type C = CanvasRenderingContext2D;

// ------------------------------------------------------------------ shield
export function drawShield(g: Pen, x: number, y: number, r: number, squash = 1) {
  g.ctx.save(); g.ctx.translate(x, y); g.ctx.scale(squash, 1);
  g.fillStyle(0x4d5a6c); g.fillCircle(0, 0, r);
  g.fillStyle(0xc8d2e0); g.fillCircle(0, 0, r * 0.9);
  g.fillStyle(0x1fb59b); g.fillCircle(0, 0, r * 0.74);
  g.fillStyle(0xeef3f8); g.fillCircle(0, 0, r * 0.5);
  g.fillStyle(CHEVRON);
  const s = r * 0.4;
  g.fillPoints([{ x: -s, y: -s * 0.45 }, { x: 0, y: s * 0.5 }, { x: s, y: -s * 0.45 }, { x: s, y: s * 0.08 }, { x: 0, y: s }, { x: -s, y: s * 0.08 }]);
  const c = g.ctx;
  c.strokeStyle = 'rgba(13,15,26,0.55)'; c.lineWidth = Math.max(1, r * 0.05);
  for (const k of [0.9, 0.74, 0.5]) { c.beginPath(); c.arc(0, 0, r * k, 0, Math.PI * 2); c.stroke(); }
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.flat(() => { g.fillStyle(0x8a96a8); g.fillCircle(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82, Math.max(0.6, r * 0.045)); }); }
  g.flat(() => { g.fillStyle(0xffffff, 0.55); g.fillEllipse(-r * 0.35, -r * 0.42, r * 0.55, r * 0.24); });
  g.ctx.restore();
}

// ------------------------------------------------------------------ shape helpers
export function capsulePath(c: C, x1: number, y1: number, r1: number, x2: number, y2: number, r2: number) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  c.beginPath();
  c.arc(x2, y2, r2, a - Math.PI / 2, a + Math.PI / 2);
  c.arc(x1, y1, r1, a + Math.PI / 2, a + Math.PI * 1.5);
  c.closePath();
}

function pattern(c: C, kind: string | undefined, base: number, dark: number, x: number, y: number, w: number, h: number, seed: number) {
  // Uses Path2D only, so the caller's current path (needed for the outline stroke) is preserved.
  if (!kind) return;
  if (kind === 'camo') {
    for (let i = 0; i < 14; i++) {
      const px = x + hash(seed + i) * w, py = y + hash(seed + i + 50) * h, r = 2.5 + hash(seed + i + 9) * 4;
      const p = new Path2D(); p.ellipse(px, py, r * 1.4, r, hash(seed + i) * 3, 0, Math.PI * 2);
      c.fillStyle = hex(i % 2 ? dark : lighten(base, 0.25), 0.85); c.fill(p);
    }
  } else if (kind === 'stripes' || kind === 'denim') {
    const st = kind === 'stripes';
    c.strokeStyle = st ? hex(dark, 0.7) : hex(lighten(base, 0.25), 0.35); c.lineWidth = st ? 2.6 : 0.6;
    const step = st ? 7 : 2.2, sk = st ? -0.35 : 0.6;
    const p = new Path2D();
    for (let k = -h; k < w + h; k += step) { p.moveTo(x + k, y); p.lineTo(x + k + h * sk, y + h); }
    c.stroke(p);
  } else if (kind === 'shine') {
    const p = new Path2D(); p.moveTo(x + w * 0.2, y); p.lineTo(x + w * 0.42, y); p.lineTo(x + w * 0.12, y + h); p.lineTo(x - w * 0.1, y + h); p.closePath();
    c.fillStyle = 'rgba(255,255,255,0.45)'; c.fill(p);
  }
}

/** Fill the current path with a lit gradient, optional clipped pattern, and a dark inner outline. */
export function shade(c: C, base: number, x: number, y: number, w: number, h: number, pat?: string, dark?: number, seed = 1, lw = 1.5) {
  const g = c.createLinearGradient(x, y, x + w * 0.4, y + h);
  g.addColorStop(0, hex(lighten(base, 0.28))); g.addColorStop(0.5, hex(base)); g.addColorStop(1, hex(darken(base, 0.72)));
  c.fillStyle = g; c.fill();
  if (pat) { c.save(); c.clip(); pattern(c, pat, base, dark ?? darken(base, 0.6), x, y, w, h, seed); c.restore(); }
  c.strokeStyle = hex(darken(base, 0.4)); c.lineWidth = lw; c.stroke();
}

export function seg(c: C, x1: number, y1: number, r1: number, x2: number, y2: number, r2: number, base: number, pat?: string, dark?: number, seed = 3) {
  capsulePath(c, x1, y1, r1, x2, y2, r2);
  const x = Math.min(x1, x2) - r1, y = Math.min(y1, y2) - r1;
  shade(c, base, x, y, Math.abs(x2 - x1) + r1 * 2, Math.abs(y2 - y1) + r1 * 2, pat, dark, seed);
}

export function rr(c: C, x: number, y: number, w: number, h: number, r: number | number[]) { c.beginPath(); (c as any).roundRect(x, y, w, h, r); }

// ------------------------------------------------------------------ hands
export function fist(c: C, x: number, y: number, col: number, skin: boolean) {
  rr(c, x - 5, y - 4.5, 10, 9, 3.5); shade(c, col, x - 5, y - 4.5, 10, 9);
  c.strokeStyle = hex(darken(col, 0.45), 0.9); c.lineWidth = 0.9;
  for (const k of [-2.2, 0, 2.2]) { c.beginPath(); c.moveTo(x + 2.5, y + k - 1); c.lineTo(x + 4.6, y + k - 1); c.stroke(); }
  c.beginPath(); c.ellipse(x - 1, y + 3, 3.4, 2, -0.4, 0, Math.PI * 2); c.fillStyle = hex(skin ? darken(col, 0.92) : lighten(col, 0.12)); c.fill(); c.stroke();
}
function openHand(c: C, x: number, y: number, col: number) {
  c.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a = -0.6 + i * 0.32;
    c.strokeStyle = hex(darken(col, 0.45)); c.lineWidth = 3.6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); c.stroke();
    c.strokeStyle = hex(col); c.lineWidth = 2.2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); c.stroke();
  }
  rr(c, x - 4.5, y - 4, 8, 8, 3); shade(c, col, x - 4.5, y - 4, 8, 8);
}

// ------------------------------------------------------------------ shoes
function shoe(c: C, s: ShoeDef, x: number, y: number, back: boolean) {
  const k = back ? 0.82 : 1;
  const col = (v: number) => (back ? darken(v, 0.82) : v);
  switch (s.style) {
    case 'boot': {
      rr(c, x - 7, y - 15, 13, 12, 3); shade(c, col(s.base), x - 7, y - 15, 13, 12);
      rr(c, x - 8, y - 7, 20, 8, [3, 7, 3, 2] as any); shade(c, col(s.base), x - 8, y - 7, 20, 8);
      c.fillStyle = hex(col(s.sole)); c.fillRect(x - 8, y - 1, 20, 2.6);
      c.fillStyle = hex(col(s.trim)); c.fillRect(x - 7, y - 15, 13, 2.4);
      c.strokeStyle = hex(lighten(s.base, 0.4), 0.8 * k); c.lineWidth = 0.9;
      for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x, y - 12 + i * 3); c.lineTo(x + 4, y - 11 + i * 3); c.stroke(); }
      break;
    }
    case 'sneaker': {
      rr(c, x - 8, y - 9, 20, 9, [4, 8, 3, 2] as any); shade(c, col(s.base), x - 8, y - 9, 20, 9);
      rr(c, x - 9, y - 2, 22, 4, 2); shade(c, col(s.sole), x - 9, y - 2, 22, 4, undefined, undefined, 1, 1);
      c.strokeStyle = hex(col(s.trim)); c.lineWidth = 1.6; c.beginPath(); c.moveTo(x - 5, y - 3); c.quadraticCurveTo(x + 2, y - 8, x + 8, y - 4); c.stroke();
      c.strokeStyle = hex(0xffffff, 0.9); c.lineWidth = 0.9; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x + 1 + i * 2.4, y - 9); c.lineTo(x + 3 + i * 2.4, y - 6.5); c.stroke(); }
      break;
    }
    case 'sandal': {
      rr(c, x - 8, y - 2.5, 21, 4, 2); shade(c, col(s.sole), x - 8, y - 2.5, 21, 4, undefined, undefined, 1, 1);
      c.fillStyle = hex(0xf2c6a0); c.beginPath(); c.ellipse(x + 1, y - 5, 9, 4.5, 0, 0, Math.PI * 2); c.fill();
      for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(x + 8 + i * 0.4, y - 3.5 - i * 1.6, 1.6, 0, Math.PI * 2); c.fill(); }
      rr(c, x - 6, y - 8, 12, 5.5, 2.5); shade(c, col(s.base), x - 6, y - 8, 12, 5.5, undefined, undefined, 1, 1);
      c.fillStyle = hex(col(s.trim), 0.8); for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { c.beginPath(); c.arc(x - 4 + i * 2.7 + j * 1.3, y - 6.5 + j * 2.3, 0.7, 0, Math.PI * 2); c.fill(); }
      break;
    }
    case 'jet': {
      const fl = c.createLinearGradient(x - 14, 0, x - 6, 0); fl.addColorStop(0, 'rgba(255,140,40,0)'); fl.addColorStop(1, 'rgba(120,230,255,0.9)');
      c.fillStyle = fl; c.beginPath(); c.moveTo(x - 7, y - 6); c.lineTo(x - 16, y - 3); c.lineTo(x - 7, y); c.closePath(); c.fill();
      rr(c, x - 7, y - 15, 13, 12, 3); shade(c, col(s.base), x - 7, y - 15, 13, 12, 'shine');
      rr(c, x - 8, y - 7, 20, 8, [3, 7, 3, 2] as any); shade(c, col(s.base), x - 8, y - 7, 20, 8);
      c.fillStyle = hex(col(s.sole)); c.fillRect(x - 8, y - 1, 20, 2.6);
      c.fillStyle = hex(s.trim); c.fillRect(x - 7, y - 11, 13, 1.8); c.beginPath(); c.arc(x - 7, y - 4, 2.4, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'paw': {
      c.beginPath(); c.ellipse(x + 2, y - 5, 11, 6.5, 0, 0, Math.PI * 2); shade(c, col(s.base), x - 9, y - 11, 22, 13);
      c.fillStyle = hex(col(s.sole)); c.fillRect(x - 8, y - 1, 21, 2);
      c.fillStyle = hex(s.trim); c.beginPath(); c.ellipse(x + 8, y - 4, 2.6, 2, 0, 0, Math.PI * 2); c.fill();
      for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x + 11.5, y - 8 + i * 2.6, 1.1, 0, Math.PI * 2); c.fill(); }
      break;
    }
  }
}

// ------------------------------------------------------------------ pose
export interface Pose {
  legA: number; legB: number; liftA: number; liftB: number;
  crouch: boolean; lean: number; bob: number;
  arm: 'hold' | 'shoot' | 'up' | 'block' | 'throw' | 'victory' | 'dash' | 'hero' | 'low' | 'down';
  shield: boolean; swing: number; hurt?: boolean;
}

export const HERO_FRAMES = ['idle', 'idle2', 'run0', 'run1', 'run2', 'run3', 'run4', 'run5', 'jump', 'fall', 'crouch', 'block', 'hurt', 'dash', 'victory', 'up', 'shoot', 'throw', 'crouchshoot', 'shootdown'] as const;

export function heroPose(f: string, shield: boolean): Pose {
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
    case 'crouchshoot': P.crouch = true; P.legA = 13; P.legB = -11; P.arm = 'low'; break;
    case 'shootdown': P.arm = 'down'; P.legA = 9; P.legB = -8; P.lean = 2; break;
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

// ------------------------------------------------------------------ body
export function drawHero(g: Pen, P: Pose, head: CanvasImageSource | null, O: Outfit, fx = HERO_FX, fy = HERO_FY) {
  const c = g.ctx;
  const T: TopDef = O.top, PA: PantsDef = O.pants, SH: ShoeDef = O.shoes;
  const cr = P.crouch ? 12 : 0;
  const hipY = fy - 40 + cr + P.bob;
  const top = fy - 74 + cr + P.bob;
  const L = P.lean;
  const skinHands = T.handStyle === 'skin';
  g.flat(() => { g.fillStyle(0x000000, 0.25); g.fillEllipse(fx, fy - 1, 48, 7); });

  // --- legs
  const leg = (side: number, dx: number, lift: number, back: boolean) => {
    const hx = fx + side * 7 + L * 0.3, footX = fx + dx, footY = fy - lift;
    const ankleX = footX - 1, ankleY = footY - 9;
    const kneeX = (hx + ankleX) / 2 + (P.crouch ? 10 : 2), kneeY = (hipY + ankleY) / 2 - (P.crouch ? 4 : 0);
    const base = back ? darken(PA.base, 0.78) : PA.base;
    seg(c, hx, hipY, 7.2, kneeX, kneeY, 6, base, PA.pattern, PA.dark, 11 + side);
    seg(c, kneeX, kneeY, 6, ankleX, ankleY, 4.8, base, PA.pattern, PA.dark, 17 + side);
    if (PA.kneePad) { rr(c, kneeX - 4, kneeY - 4.5, 9, 9, 3); shade(c, back ? darken(PA.kneePad, 0.8) : PA.kneePad, kneeX - 4, kneeY - 4.5, 9, 9); }
    else { c.strokeStyle = hex(darken(base, 0.55), 0.7); c.lineWidth = 1; c.beginPath(); c.moveTo(kneeX - 3, kneeY + 1); c.quadraticCurveTo(kneeX, kneeY + 3, kneeX + 3, kneeY); c.stroke(); }
    shoe(c, SH, footX, footY, back);
  };

  // --- arm helpers
  const sleeve = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, back: boolean) => {
    const base = back ? darken(T.base, 0.78) : T.base;
    seg(c, x1, y1, 5.8, x2, y2, 5.2, base, T.pattern, T.dark, back ? 21 : 23);
    seg(c, x2, y2, 5.2, x3, y3, 4.5, T.style === 'armor' ? (back ? darken(T.light, 0.78) : T.light) : base, T.style === 'armor' ? undefined : T.pattern, T.dark, back ? 27 : 29);
    if (T.style === 'shirt' || T.style === 'hoodie') { const a = Math.atan2(y3 - y2, x3 - x2); c.save(); c.translate(x3, y3); c.rotate(a); rr(c, -3, -5, 4, 10, 1.5); shade(c, back ? darken(T.trim, 0.8) : T.trim, -3, -5, 4, 10, undefined, undefined, 1, 1); c.restore(); }
    if (T.style === 'ninja') { c.strokeStyle = hex(darken(T.light, back ? 0.7 : 0.9)); c.lineWidth = 1; for (let i = 0; i < 4; i++) { const t = 0.3 + i * 0.17; const px = x2 + (x3 - x2) * t, py = y2 + (y3 - y2) * t; c.beginPath(); c.moveTo(px - 4, py - 2); c.lineTo(px + 4, py + 2); c.stroke(); } }
  };

  // back arm
  const bsx = fx - 17 + L, bsy = top + 6;
  let bel = [bsx - 4, top + 18], bh = [fx - 20 - P.swing + L, top + 29];
  if (P.arm === 'shoot' || P.arm === 'block' || P.arm === 'dash' || P.arm === 'throw') { bel = [fx - 8 + L, top + 20]; bh = [fx + 4 + L, top + 18]; }
  if (P.arm === 'hero') { bel = [bsx - 8, top + 16]; bh = [fx - 12 + L, hipY - 4]; }
  sleeve(bsx, bsy, bel[0], bel[1], bh[0], bh[1], true);
  fist(c, bh[0], bh[1] + 1, darken(T.hand, 0.85), skinHands);

  leg(-1, P.legB, P.liftB, true);

  // pelvis
  rr(c, fx - 14 + L * 0.5, hipY - 3, 28, 10, 4); shade(c, PA.base, fx - 14, hipY - 3, 28, 10, PA.pattern, PA.dark, 5);

  // hoodie hood behind head
  if (T.style === 'hoodie') { c.beginPath(); c.ellipse(fx - 4 + L, top - 3, 15, 8, -0.2, 0, Math.PI * 2); shade(c, T.base, fx - 19, top - 11, 30, 16, T.pattern, T.dark, 41); }

  // torso
  const tl = fx - 20 + L, tr = fx + 20 + L, wl = fx - 15 + L * 0.6, wr = fx + 15 + L * 0.6;
  const torsoPath = () => {
    c.beginPath(); c.moveTo(tl + 3, top); c.lineTo(tr - 3, top); c.quadraticCurveTo(tr + 1, top + 2, tr, top + 8);
    c.lineTo(wr, hipY + (T.style === 'armor' ? -2 : 3)); c.lineTo(wl, hipY + (T.style === 'armor' ? -2 : 3)); c.lineTo(tl, top + 8); c.quadraticCurveTo(tl - 1, top + 2, tl + 3, top); c.closePath();
  };
  torsoPath(); shade(c, T.base, tl, top, 40, hipY - top + 3, T.style === 'armor' ? T.pattern : T.pattern, T.dark, 7, 1.6);

  if (T.style === 'armor') {
    // pecs + abs plates
    for (const sx of [-1, 1]) { rr(c, fx + L + (sx < 0 ? -17 : 1), top + 3, 16, 13, 5); shade(c, T.light, fx - 17, top + 3, 16, 13, T.pattern, T.dark, 9); }
    for (let r = 0; r < 2; r++) for (const sx of [-1, 1]) { rr(c, fx + L * 0.8 + (sx < 0 ? -9 : 1), top + 19 + r * 6, 8, 5, 2); shade(c, darken(T.base, 0.92), fx - 9, top + 19, 8, 5, undefined, undefined, 1, 1); }
    c.fillStyle = hex(T.trim); c.fillRect(fx - 1.8 + L, top + 2, 3.6, 16);
    g.fillStyle(T.emblem);
    const cx = fx + L, cy = top + 10;
    g.fillPoints([{ x: cx - 8, y: cy - 3 }, { x: cx, y: cy + 3 }, { x: cx + 8, y: cy - 3 }, { x: cx + 8, y: cy + 1.5 }, { x: cx, y: cy + 7.5 }, { x: cx - 8, y: cy + 1.5 }]);
  } else if (T.style === 'shirt' || T.style === 'hoodie') {
    // hem band, collar, print/pocket
    rr(c, wl - 1, hipY - 1, wr - wl + 2, 6, 2.5); shade(c, T.trim, wl, hipY - 1, wr - wl, 6, undefined, undefined, 1, 1);
    c.strokeStyle = hex(darken(T.base, 0.6), 0.7); c.lineWidth = 1;
    c.beginPath(); c.moveTo(fx - 12 + L, top + 14); c.quadraticCurveTo(fx - 6 + L, top + 18, fx - 9 + L, top + 24); c.stroke();
    c.beginPath(); c.moveTo(fx + 13 + L, top + 16); c.quadraticCurveTo(fx + 7 + L, top + 21, fx + 10 + L, top + 27); c.stroke();
    if (T.style === 'hoodie') {
      rr(c, fx - 10 + L * 0.7, hipY - 13, 20, 10, 4); shade(c, darken(T.base, 0.9), fx - 10, hipY - 13, 20, 10, undefined, undefined, 1, 1);
      c.strokeStyle = hex(0xffffff, 0.9); c.lineWidth = 1.2; for (const sx of [-3, 3]) { c.beginPath(); c.moveTo(fx + sx + L, top + 2); c.lineTo(fx + sx + L, top + 12); c.stroke(); }
      c.fillStyle = hex(T.emblem); c.beginPath(); c.arc(fx + L, top + 17, 3, 0, Math.PI * 2); c.fill();
    }
    if (T.text) {
      c.font = "800 11px 'Baloo 2'"; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 3; c.strokeStyle = '#ffffff'; c.strokeText(T.text, fx + L, top + 15);
      c.fillStyle = hex(T.emblem); c.fillText(T.text, fx + L, top + 15);
    }
  } else if (T.style === 'ninja') {
    c.strokeStyle = hex(T.light); c.lineWidth = 3; c.beginPath(); c.moveTo(fx - 10 + L, top); c.lineTo(fx + 6 + L * 0.7, hipY - 4); c.stroke();
    c.strokeStyle = hex(darken(T.base, 0.5)); c.lineWidth = 1; c.beginPath(); c.moveTo(fx - 8 + L, top); c.lineTo(fx + 8 + L * 0.7, hipY - 4); c.stroke();
    rr(c, wl - 1, hipY - 7, wr - wl + 2, 7, 2); shade(c, T.trim, wl, hipY - 7, wr - wl, 7);
    c.beginPath(); c.moveTo(wl + 2, hipY - 3); c.lineTo(wl - 8, hipY + 9); c.lineTo(wl - 3, hipY + 10); c.lineTo(wl + 5, hipY); c.closePath(); shade(c, T.trim, wl - 8, hipY - 3, 13, 13);
  } else if (T.style === 'camo') {
    rr(c, fx - 14 + L, top + 4, 28, hipY - top - 10, 4); shade(c, T.dark, fx - 14, top + 4, 28, hipY - top - 10);
    for (let i = 0; i < 3; i++) { rr(c, fx - 12 + i * 8.5 + L, top + 16, 7, 9, 1.5); shade(c, darken(T.base, 0.85), fx - 12 + i * 8.5, top + 16, 7, 9, undefined, undefined, 1, 1); }
    c.fillStyle = hex(T.emblem); c.fillRect(fx - 11 + L, top + 7, 7, 4);
  }
  // belt (armor/camo)
  if (T.style === 'armor' || T.style === 'camo') {
    rr(c, wl - 1, hipY - 7, wr - wl + 2, 7, 2); shade(c, PA.belt, wl, hipY - 7, wr - wl, 7);
    rr(c, fx - 4 + L * 0.6, hipY - 8, 8, 9, 2); shade(c, PA.buckle, fx - 4, hipY - 8, 8, 9, undefined, undefined, 1, 1);
    rr(c, fx + 8 + L * 0.6, hipY - 6, 7, 9, 2); shade(c, darken(PA.belt, 0.8), fx + 8, hipY - 6, 7, 9, undefined, undefined, 1, 1);
    // diagonal strap
    c.beginPath(); c.moveTo(fx + 13 + L, top); c.lineTo(fx + 19 + L, top + 2); c.lineTo(fx - 9 + L * 0.6, hipY - 6); c.lineTo(fx - 15 + L * 0.6, hipY - 8); c.closePath(); shade(c, PA.belt, fx - 15, top, 34, hipY - top);
  }

  leg(1, P.legA, P.liftA, false);

  // collar + head
  c.beginPath(); c.ellipse(fx + L, top + 1, 13, 4.5, 0, 0, Math.PI * 2); shade(c, T.style === 'armor' ? T.dark : T.trim, fx - 13, top - 3, 26, 9);
  const hw = 41, hh = hw * 360 / 297;
  const hx = fx + L - hw / 2 + 1, hy = top - hh + 7;
  if (head) {
    c.save();
    if (P.hurt) { c.translate(hx + hw / 2, hy + hh); c.rotate(-0.14); c.translate(-(hx + hw / 2), -(hy + hh)); }
    g.image(head, hx, hy, hw, hh);
    c.restore();
  } else { g.fillStyle(0xe8b88a); g.fillCircle(fx + L, top - 22, 20); }
  // shoulders
  for (const sx of [-1, 1]) {
    const px = fx + L + (sx < 0 ? -24 : 12);
    if (T.style === 'armor') { rr(c, px, top - 1, 12, 11, 5); shade(c, T.dark, px, top - 1, 12, 11, T.pattern, T.dark, 13); c.fillStyle = hex(T.trim); c.fillRect(px, top + 7, 12, 2.2); }
  }

  // front arm + shield
  const sx = fx + 17 + L, sy = top + 6;
  const arm = (el: number[], hand: number[], open = false) => {
    sleeve(sx, sy, el[0], el[1], hand[0], hand[1], false);
    if (open) openHand(c, hand[0], hand[1], T.hand); else fist(c, hand[0], hand[1], T.hand, skinHands);
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
      if (P.shield) { c.save(); c.translate(sx + 8, sy - 31); c.scale(1, 0.45); drawShield(g, 0, 0, 17); c.restore(); }
      break;
    case 'low':
      arm([sx + 10, sy + 12], [sx + 20, sy + 18]);
      if (P.shield) drawShield(g, sx + 25, sy + 19, 16, 0.45);
      break;
    case 'down':
      arm([sx + 8, sy + 13], [sx + 17, sy + 24]);
      if (P.shield) { c.save(); c.translate(sx + 22, sy + 27); c.rotate(0.6); drawShield(g, 0, 0, 16, 0.45); c.restore(); }
      break;
    case 'block': case 'dash':
      arm([sx + 9, sy + 9], [sx + 16, sy + 8]);
      if (P.shield) drawShield(g, sx + 21, sy + 7, 23, 0.5);
      break;
    case 'throw':
      arm([sx + 13, sy + 1], [sx + 25, sy - 4], true);
      break;
    case 'victory':
      arm([sx + 10, sy - 10], [sx + 12, sy - 26]);
      if (P.shield) drawShield(g, sx + 14, sy - 38, 16);
      break;
  }
}

function headImg(scene: Phaser.Scene) {
  return scene.textures.exists('heroHead') ? scene.textures.get('heroHead').getSourceImage() as CanvasImageSource : null;
}

/** (Re)build every hero frame for the given outfit. Called at boot and after changing clothes. */
export function buildHeroTextures(scene: Phaser.Scene, O: Outfit) {
  const head = headImg(scene);
  for (const f of HERO_FRAMES) {
    canvasTex(scene, 'hero_' + f, HERO_W, HERO_H, g => drawHero(g, heroPose(f, true), head, O), { outline: 1.6 });
    canvasTex(scene, 'heroNS_' + f, HERO_W, HERO_H, g => drawHero(g, heroPose(f, false), head, O), { outline: 1.6 });
  }
}

/** Large hero art (title screen, wardrobe preview). */
export function buildHeroPortrait(scene: Phaser.Scene, key: string, scale: number, frame: string, O: Outfit) {
  const head = headImg(scene);
  canvasTex(scene, key, HERO_W * scale, HERO_H * scale, g => { g.ctx.scale(scale, scale); drawHero(g, heroPose(frame, true), head, O); }, { outline: 3 });
}
