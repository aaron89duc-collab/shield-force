import Phaser from 'phaser';
import { Level, GROUND_Y } from '../game/level';
import { SolidType } from '../game/entities';
import { hash, PPU } from '../game/util';
import { Pen, lighten, darken } from './pen';

export interface Theme {
  skyTop: number; skyBot: number; far: number; mid: number; near: number; accent: number;
  ground: number; groundTop: number; plat: number; detail: number;
  farKind: string; midKind: string; nearKind: string; lava?: boolean;
  sky: 'night' | 'dusk' | 'day' | 'cave' | 'space';
  tile: 'brick' | 'plate' | 'dirt' | 'sand' | 'ice' | 'rock';
  top: 'asphalt' | 'rail' | 'grass' | 'sand' | 'snow' | 'metal' | 'crust' | 'goo' | 'stone';
  props: string[];
}

export const THEMES: Theme[] = [
  { sky: 'night', skyTop: 0x0b1030, skyBot: 0x4a2a5a, far: 0x1a1f3a, mid: 0x20264a, near: 0x2a3052, accent: 0xffd36a, ground: 0x34373f, groundTop: 0x5a5e6a, plat: 0x6a7080, detail: 0x2a2c33, farKind: 'city', midKind: 'city', nearKind: 'city', tile: 'brick', top: 'asphalt', props: ['lamp', 'hydrant', 'cone', 'sign', 'bin'] },
  { sky: 'dusk', skyTop: 0x1a1410, skyBot: 0x7a4420, far: 0x2a2018, mid: 0x34281c, near: 0x3a2a1e, accent: 0xff8a2e, ground: 0x40342a, groundTop: 0x8a6a3a, plat: 0x7a6a5a, detail: 0x2e241c, farKind: 'factory', midKind: 'factory', nearKind: 'pipes', tile: 'plate', top: 'rail', props: ['pipe', 'drums', 'gear', 'vent'] },
  { sky: 'night', skyTop: 0x050a14, skyBot: 0x1a2e3e, far: 0x0e1a1e, mid: 0x10221e, near: 0x152a22, accent: 0xd8e8ff, ground: 0x2a2015, groundTop: 0x3f7a33, plat: 0x5a4028, detail: 0x1e170f, farKind: 'pines', midKind: 'pines', nearKind: 'pines', tile: 'dirt', top: 'grass', props: ['bush', 'mushroom', 'fern', 'stump'] },
  { sky: 'day', skyTop: 0xe8804a, skyBot: 0xffd890, far: 0xd09858, mid: 0xbe8650, near: 0xa86e3e, accent: 0xfff0c0, ground: 0xc89a5a, groundTop: 0xe8c080, plat: 0x9a7048, detail: 0xb08048, farKind: 'dunes', midKind: 'mesa', nearKind: 'mesa', tile: 'sand', top: 'sand', props: ['cactus', 'rock', 'skull', 'crateS'] },
  { sky: 'day', skyTop: 0x5a8ac8, skyBot: 0xd8ecff, far: 0xb0cce8, mid: 0x94b6dc, near: 0x7aa0c8, accent: 0xffffff, ground: 0x8cb4d8, groundTop: 0xf4fbff, plat: 0xb0d4f0, detail: 0x70a0c8, farKind: 'mountains', midKind: 'mountains', nearKind: 'mountains', tile: 'ice', top: 'snow', props: ['crystal', 'snowpine', 'rock'] },
  { sky: 'cave', skyTop: 0x060e12, skyBot: 0x12303a, far: 0x10262e, mid: 0x143038, near: 0x173840, accent: 0x35e0f0, ground: 0x26343a, groundTop: 0x4a6a74, plat: 0x3a5058, detail: 0x1c282c, farKind: 'lab', midKind: 'tanks', nearKind: 'tanks', tile: 'plate', top: 'metal', props: ['console', 'tube', 'vent', 'drums'] },
  { sky: 'dusk', skyTop: 0x1a0404, skyBot: 0x8a2a0a, far: 0x2a0a08, mid: 0x320e0a, near: 0x3a1410, accent: 0xff6a1e, ground: 0x2a1a18, groundTop: 0x5a2a1a, plat: 0x4a2a22, detail: 0x1e100e, farKind: 'volcano', midKind: 'rocks', nearKind: 'rocks', lava: true, tile: 'rock', top: 'crust', props: ['lavarock', 'bones', 'rock'] },
  { sky: 'space', skyTop: 0x14042a, skyBot: 0x6a2a9a, far: 0x2a1048, mid: 0x321452, near: 0x3a1a5a, accent: 0x7cff5a, ground: 0x2a1a4a, groundTop: 0x5a3a8a, plat: 0x4a2a6a, detail: 0x1e1236, farKind: 'spires', midKind: 'shrooms', nearKind: 'shrooms', tile: 'rock', top: 'goo', props: ['alienplant', 'pod', 'crystal'] },
  { sky: 'night', skyTop: 0x0c0c14, skyBot: 0x3a2a3a, far: 0x1a1a24, mid: 0x1e1e2a, near: 0x24242e, accent: 0xff5a3a, ground: 0x383842, groundTop: 0x60606e, plat: 0x50505c, detail: 0x2a2a32, farKind: 'towers', midKind: 'towers', nearKind: 'walls', tile: 'brick', top: 'stone', props: ['torch', 'banner', 'drums'] },
  { sky: 'space', skyTop: 0x050510, skyBot: 0x4a0a1a, far: 0x14141e, mid: 0x181822, near: 0x1c1c26, accent: 0xff2e5a, ground: 0x262a36, groundTop: 0x3a4050, plat: 0x3a4050, detail: 0x1c1f28, farKind: 'base', midKind: 'towers', nearKind: 'walls', tile: 'plate', top: 'metal', props: ['console', 'beacon', 'drums', 'vent'] },
];

const BG_W = 1024, BG_H = 540;
type Gx = Pen;

function silhouette(g: Gx, kind: string, col: number, accent: number, seed: number, near: boolean) {
  const base = near ? BG_H : BG_H - 60;
  const R = (i: number) => hash(seed * 1000 + i);
  g.fillStyle(col);
  switch (kind) {
    case 'city': {
      let x = 0, i = 0;
      while (x < BG_W) {
        const w = 50 + R(i) * (near ? 110 : 80), h = (near ? 120 : 160) + R(i + 50) * (near ? 160 : 220);
        g.fillStyle(col); g.fillRect(x, base - h, w - 6, h);
        g.fillStyle(accent, near ? 0.25 : 0.45);
        for (let wy = base - h + 12; wy < base - 20; wy += 18) for (let wx = x + 8; wx < x + w - 16; wx += 14) if (R(wx * 7 + wy) > 0.55) g.fillRect(wx, wy, 6, 8);
        x += w; i++;
      }
      break;
    }
    case 'factory': {
      for (let i = 0; i < 8; i++) {
        const x = i * 128 + R(i) * 40, h = 150 + R(i + 9) * 120;
        g.fillStyle(col); g.fillRect(x, base - h, 90, h);
        g.fillRect(x + 20, base - h - 120, 18, 120); g.fillRect(x + 55, base - h - 80, 14, 80);
        g.fillStyle(accent, 0.4); g.fillRect(x + 10, base - h + 30, 70, 6);
      }
      break;
    }
    case 'pipes': {
      g.fillStyle(col);
      for (let i = 0; i < 5; i++) { const y = base - 80 - i * 55; g.fillRect(0, y, BG_W, 14); }
      for (let i = 0; i < 6; i++) { const x = i * 180 + 40; g.fillRect(x, base - 330, 22, 330); g.fillCircle(x + 11, base - 200, 26); }
      break;
    }
    case 'pines': {
      for (let i = 0; i < (near ? 14 : 22); i++) {
        const x = (i / (near ? 14 : 22)) * BG_W + R(i) * 30, h = (near ? 260 : 200) + R(i + 7) * 120, w = h * 0.38;
        g.fillStyle(col);
        g.fillTriangle(x - w / 2, base - 20, x, base - h, x + w / 2, base - 20);
        g.fillRect(x - 6, base - 30, 12, 30);
      }
      break;
    }
    case 'dunes': case 'mesa': {
      g.fillStyle(col);
      const pts: Phaser.Types.Math.Vector2Like[] = [{ x: 0, y: BG_H }];
      for (let x = 0; x <= BG_W; x += 32) {
        const y = kind === 'dunes' ? base - 110 - Math.sin(x / BG_W * Math.PI * 4) * 50 - R(x) * 10
          : base - (Math.floor(x / 160) % 2 ? 230 : 120) - R(Math.floor(x / 160)) * 40;
        pts.push({ x, y });
      }
      pts.push({ x: BG_W, y: BG_H });
      g.fillPoints(pts, true);
      break;
    }
    case 'mountains': {
      for (let i = 0; i < 6; i++) {
        const x = i * 190 + R(i) * 60, h = (near ? 220 : 320) + R(i + 3) * 120, w = h * 1.1;
        g.fillStyle(col); g.fillTriangle(x - w / 2, base, x, base - h, x + w / 2, base);
        g.fillStyle(0xffffff, 0.85); g.fillTriangle(x - w * 0.12, base - h * 0.78, x, base - h, x + w * 0.12, base - h * 0.78);
      }
      break;
    }
    case 'lab': {
      g.fillStyle(col); g.fillRect(0, 60, BG_W, BG_H - 60);
      g.lineStyle(2, accent, 0.15);
      for (let x = 0; x < BG_W; x += 64) g.lineBetween(x, 60, x, BG_H);
      for (let y = 60; y < BG_H; y += 64) g.lineBetween(0, y, BG_W, y);
      g.fillStyle(accent, 0.25); for (let i = 0; i < 10; i++) g.fillRect(R(i) * BG_W, 100 + R(i + 20) * 300, 40, 6);
      break;
    }
    case 'tanks': {
      for (let i = 0; i < 5; i++) {
        const x = i * 210 + 50;
        g.fillStyle(col); g.fillRoundedRect(x, base - 300, 90, 300, 20);
        g.fillStyle(accent, 0.25); g.fillRoundedRect(x + 12, base - 280, 66, 200, 14);
        g.fillStyle(0x9cff4a, 0.25); g.fillCircle(x + 45, base - 200, 18);
      }
      break;
    }
    case 'volcano': {
      for (let i = 0; i < 3; i++) {
        const x = i * 360 + 160, h = 300 + R(i) * 80;
        g.fillStyle(col); g.fillTriangle(x - 260, base, x - 40, base - h, x + 260, base); g.fillRect(x - 40, base - h, 80, h);
        g.fillStyle(accent, 0.6); g.fillRect(x - 30, base - h, 60, 8);
        g.fillStyle(accent, 0.25); g.fillTriangle(x - 30, base - h, x, base - h + 140, x + 30, base - h);
      }
      break;
    }
    case 'rocks': {
      g.fillStyle(col);
      for (let i = 0; i < 10; i++) { const x = i * 110 + R(i) * 40, h = 80 + R(i + 4) * 160; g.fillTriangle(x - 70, base, x, base - h, x + 70, base); }
      break;
    }
    case 'spires': {
      g.fillStyle(col);
      for (let i = 0; i < 9; i++) { const x = i * 120 + R(i) * 40, h = 200 + R(i + 5) * 200; g.fillTriangle(x - 30, base, x, base - h, x + 30, base); g.fillCircle(x, base - h * 0.6, 16); }
      break;
    }
    case 'shrooms': {
      for (let i = 0; i < 8; i++) {
        const x = i * 140 + R(i) * 40, h = 120 + R(i + 2) * 140;
        g.fillStyle(col); g.fillRect(x - 10, base - h, 20, h);
        g.fillEllipse(x, base - h, 120, 50);
        g.fillStyle(accent, 0.3); g.fillCircle(x - 20, base - h - 5, 6); g.fillCircle(x + 22, base - h + 2, 5);
      }
      break;
    }
    case 'towers': case 'base': {
      for (let i = 0; i < 7; i++) {
        const x = i * 150 + R(i) * 30, h = 220 + R(i + 1) * 180;
        g.fillStyle(col); g.fillRect(x, base - h, 70, h);
        for (let k = 0; k < 4; k++) g.fillRect(x + k * 20 - 5, base - h - 16, 12, 16);
        g.fillStyle(accent, 0.6); g.fillRect(x + 30, base - h + 30, 10, 14);
        if (kind === 'base') { g.fillStyle(accent, 0.8); g.fillCircle(x + 35, base - h - 24, 4); }
      }
      break;
    }
    case 'walls': {
      g.fillStyle(col); g.fillRect(0, base - 180, BG_W, 180);
      for (let x = 0; x < BG_W; x += 64) g.fillRect(x, base - 210, 36, 30);
      g.fillStyle(0x000000, 0.25); for (let x = 0; x < BG_W; x += 128) g.fillRect(x + 50, base - 140, 18, 40);
      break;
    }
  }
}


const hx = (c: number, a = 1) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;

function drawSky(p: Pen, th: Theme, seed: number) {
  const c = p.ctx, R = (i: number) => hash(seed * 7777 + i);
  const g = c.createLinearGradient(0, 0, 0, BG_H);
  g.addColorStop(0, hx(th.skyTop)); g.addColorStop(0.65, hx(th.skyBot)); g.addColorStop(1, hx(lighten(th.skyBot, 0.15)));
  c.fillStyle = g; c.fillRect(0, 0, BG_W, BG_H);
  p.shade = 0;
  if (th.sky === 'night' || th.sky === 'space') {
    for (let i = 0; i < 160; i++) { p.fillStyle(0xffffff, 0.3 + R(i) * 0.7); const s = R(i + 999) < 0.9 ? 1.2 : 2.2; p.fillRect(R(i + 1) * BG_W, R(i + 2) * BG_H * 0.75, s, s); }
  }
  if (th.sky === 'night') {
    p.glow(800, 95, 110, 0xd8e8ff, 0.35); p.fillStyle(0xeef4ff); p.fillCircle(800, 95, 38);
    p.fillStyle(0xc8d4e8, 0.7); p.fillCircle(788, 85, 8); p.fillCircle(812, 104, 5); p.fillCircle(806, 80, 4);
    for (let i = 0; i < 5; i++) { p.fillStyle(lighten(th.skyBot, 0.15), 0.35); p.fillEllipse(R(i + 50) * BG_W, 150 + R(i + 60) * 160, 260, 18); }
  } else if (th.sky === 'dusk') {
    p.glow(300, 380, 260, 0xffb050, 0.55); p.fillStyle(0xffd080); p.fillCircle(300, 380, 70);
    for (let i = 0; i < 7; i++) { p.fillStyle(lighten(th.skyBot, 0.3), 0.35); p.fillEllipse(R(i + 50) * BG_W, 120 + R(i + 60) * 220, 300, 14 + R(i) * 10); }
  } else if (th.sky === 'day') {
    p.glow(220, 110, 160, 0xfff4c0, 0.6); p.fillStyle(0xfffbe0); p.fillCircle(220, 110, 44);
    for (let i = 0; i < 6; i++) {
      const x = R(i + 50) * BG_W, y = 70 + R(i + 60) * 170;
      p.fillStyle(0xffffff, 0.75); p.fillEllipse(x, y, 140, 34); p.fillEllipse(x - 40, y + 8, 90, 26); p.fillEllipse(x + 45, y + 6, 100, 28); p.fillEllipse(x + 5, y - 14, 80, 34);
    }
  } else if (th.sky === 'cave') {
    p.fillStyle(darken(th.skyTop, 0.7));
    for (let x = 0; x < BG_W; x += 36) { const h = 40 + R(x) * 120; p.fillTriangle(x, 0, x + 18, h, x + 36, 0); }
    for (let i = 0; i < 40; i++) p.glow(R(i + 3) * BG_W, 120 + R(i + 4) * 360, 6 + R(i) * 8, th.accent, 0.35);
  } else if (th.sky === 'space') {
    p.glow(260, 160, 260, lighten(th.skyBot, 0.2), 0.35); p.glow(760, 240, 220, th.accent, 0.12);
    p.fillStyle(0xb080e0); p.fillCircle(820, 120, 54); p.fillStyle(0x9060c0, 0.8); p.fillEllipse(805, 108, 50, 14);
    c.save(); c.strokeStyle = hx(0xe0c0ff, 0.7); c.lineWidth = 5; c.beginPath(); c.ellipse(820, 120, 96, 18, -0.25, 0, Math.PI * 2); c.stroke(); c.restore();
  }
  p.shade = 0.32;
}

function texCanvas(scene: Phaser.Scene, key: string, draw: (p: Pen) => void) {
  if (scene.textures.exists(key)) return;
  const cv = document.createElement('canvas'); cv.width = BG_W; cv.height = BG_H;
  const p = new Pen(cv, 1);
  draw(p);
  scene.textures.addCanvas(key, cv);
}

/** Backgrounds are generated lazily per level (1× resolution — distant layers are meant to be soft). */
export function ensureBackgrounds(scene: Phaser.Scene, idx: number) {
  const th = THEMES[idx];
  const k = { skyKey: `bg_sky_${idx}`, farKey: `bg_far_${idx}`, midKey: `bg_mid_${idx}`, nearKey: `bg_near_${idx}` };
  texCanvas(scene, k.skyKey, p => drawSky(p, th, idx + 3));
  texCanvas(scene, k.farKey, p => { p.shade = 0.18; silhouette(p, th.farKind, th.far, th.accent, idx * 3 + 1, false); });
  texCanvas(scene, k.midKey, p => { p.shade = 0.25; p.ctx.translate(0, 40); silhouette(p, th.midKind, th.mid, th.accent, idx * 3 + 2, false); });
  texCanvas(scene, k.nearKey, p => { p.shade = 0.3; silhouette(p, th.nearKind, th.near, th.accent, idx * 3 + 3, true); });
  return k;
}

/** Free background textures of other themes (keeps GPU memory low on phones). */
export function releaseBackgrounds(scene: Phaser.Scene, keep: number[]) {
  for (let i = 0; i < THEMES.length; i++) {
    if (keep.includes(i)) continue;
    for (const n of ['sky', 'far', 'mid', 'near']) { const key = `bg_${n}_${i}`; if (scene.textures.exists(key)) scene.textures.remove(key); }
  }
}

// ------------------------------------------------------------------ terrain
type GG = Phaser.GameObjects.Graphics;

function depthShade(g: GG, x: number, y: number, w: number, h: number) {
  g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.55, 0.55);
  g.fillRect(x, y, w, h);
}

function tilePattern(g: GG, th: Theme, x: number, y: number, w: number, h: number, seed: number) {
  const R = (i: number) => hash(seed * 131 + i);
  const d = th.detail, lt = lighten(th.ground, 0.12);
  switch (th.tile) {
    case 'brick':
      for (let row = 0, yy = y + 14; yy < y + h; row++, yy += 18) {
        g.fillStyle(d, 0.9); g.fillRect(x, yy, w, 2);
        for (let xx = x + (row % 2 ? 0 : 18) - 36; xx < x + w; xx += 36) {
          if (xx > x) { g.fillStyle(d, 0.9); g.fillRect(xx, yy, 2, 18); }
          g.fillStyle(lt, 0.35); g.fillRect(Math.max(x, xx + 2), yy + 2, 32, 2);
          if (R(xx + yy) > 0.85) { g.fillStyle(darken(th.ground, 0.8), 0.8); g.fillRect(Math.max(x, xx + 4), yy + 5, 26, 10); }
        }
      }
      break;
    case 'plate':
      for (let yy = y + 12; yy < y + h; yy += 48) for (let xx = x; xx < x + w; xx += 64) {
        const pw = Math.min(64, x + w - xx);
        g.lineStyle(2, d, 1); g.strokeRect(xx + 1, yy + 1, pw - 2, 46);
        g.fillStyle(lt, 0.25); g.fillRect(xx + 3, yy + 3, pw - 6, 3);
        g.fillStyle(lighten(th.ground, 0.3)); for (const [ox, oy] of [[6, 6], [pw - 6, 6], [6, 42], [pw - 6, 42]]) if (ox > 0) g.fillCircle(xx + ox, yy + oy, 2.2);
      }
      break;
    case 'dirt': case 'sand': case 'rock':
      for (let i = 0; i < w * h / 900; i++) {
        const px = x + R(i) * w, py = y + 14 + R(i + 77) * (h - 14), s = 3 + R(i + 5) * (th.tile === 'rock' ? 14 : 7);
        g.fillStyle(R(i + 9) > 0.5 ? d : lt, 0.7); g.fillEllipse(px, py, s * 1.6, s);
      }
      if (th.tile === 'dirt') { g.lineStyle(2, darken(th.ground, 0.7), 0.7); for (let i = 0; i < w / 60; i++) { const px = x + R(i + 300) * w; g.lineBetween(px, y + 10, px + R(i) * 14 - 7, y + 34); } }
      break;
    case 'ice':
      for (let yy = y + 12; yy < y + h; yy += 40) for (let xx = x + (((yy - y) / 40) % 2) * 30 - 30; xx < x + w; xx += 60) {
        g.lineStyle(2, d, 0.8); g.strokeRect(Math.max(x, xx), yy, Math.min(60, x + w - Math.max(x, xx)), 40);
        g.fillStyle(0xffffff, 0.25); g.fillRect(Math.max(x, xx) + 4, yy + 4, 18, 3);
      }
      break;
  }
}

function topSurface(g: GG, th: Theme, x: number, y: number, w: number, seed: number) {
  const R = (i: number) => hash(seed * 71 + i);
  switch (th.top) {
    case 'asphalt':
      g.fillStyle(0x2a2c32); g.fillRect(x, y, w, 12); g.fillStyle(0x8a8f9a); g.fillRect(x, y, w, 3);
      g.fillStyle(0xf2c94c, 0.8); for (let xx = x + 10; xx < x + w - 30; xx += 70) g.fillRect(xx, y + 6, 32, 2.5);
      break;
    case 'rail':
      g.fillStyle(0x2a2a2a); g.fillRect(x, y, w, 10);
      for (let xx = x; xx < x + w; xx += 20) { g.fillStyle(0xf2c94c); g.fillTriangle(xx, y + 10, xx + 10, y, xx + 20, y); g.fillTriangle(xx, y + 10, xx + 10, y + 10, xx + 20, y); }
      g.fillStyle(0xaaaaaa); g.fillRect(x, y, w, 2);
      break;
    case 'grass':
      g.fillStyle(0x2f6a28); g.fillRect(x, y, w, 10); g.fillStyle(0x5aa83a); g.fillRect(x, y, w, 4);
      for (let xx = x + 2; xx < x + w - 4; xx += 7) { const h = 5 + R(xx) * 9; g.fillStyle(R(xx + 1) > 0.5 ? 0x5aa83a : 0x3f8a33); g.fillTriangle(xx, y + 2, xx + 3, y - h, xx + 6, y + 2); }
      g.fillStyle(0x2f6a28); for (let xx = x + 6; xx < x + w - 6; xx += 23) g.fillTriangle(xx, y + 9, xx + 4, y + 18 + R(xx) * 8, xx + 8, y + 9);
      break;
    case 'sand':
      g.fillStyle(th.groundTop); g.fillRect(x, y, w, 9); g.fillStyle(0xfff0c8, 0.6); g.fillRect(x, y, w, 2);
      g.lineStyle(1.5, darken(th.groundTop, 0.85), 0.8); for (let xx = x + 8; xx < x + w - 20; xx += 28) g.lineBetween(xx, y + 5, xx + 14, y + 4);
      break;
    case 'snow':
      g.fillStyle(0xffffff); g.fillRect(x, y - 2, w, 11);
      for (let xx = x; xx < x + w; xx += 14) g.fillCircle(xx + 7, y - 1, 6 + R(xx) * 3);
      g.fillStyle(0xd8ecff); for (let xx = x + 8; xx < x + w - 8; xx += 31) g.fillTriangle(xx, y + 8, xx + 3, y + 16 + R(xx) * 10, xx + 6, y + 8);
      break;
    case 'metal':
      g.fillStyle(0x5a6a74); g.fillRect(x, y, w, 10); g.fillStyle(0xa8b8c4); g.fillRect(x, y, w, 2.5);
      g.fillStyle(0x2a3238); for (let xx = x + 6; xx < x + w; xx += 24) g.fillCircle(xx, y + 6, 1.8);
      g.fillStyle(th.accent, 0.5); g.fillRect(x, y + 8, w, 1.5);
      break;
    case 'crust':
      g.fillStyle(0x1a0e0c); g.fillRect(x, y, w, 10);
      g.lineStyle(2, 0xff6a1e, 0.85); for (let xx = x + 10; xx < x + w - 20; xx += 40) { g.lineBetween(xx, y + 3, xx + 9, y + 9); g.lineBetween(xx + 9, y + 9, xx + 18, y + 4); }
      g.fillStyle(0x5a2a1a); g.fillRect(x, y, w, 2);
      break;
    case 'goo':
      g.fillStyle(0x4a2a7a); g.fillRect(x, y, w, 10); g.fillStyle(0x7cff5a, 0.85); g.fillRect(x, y, w, 3);
      for (let xx = x + 8; xx < x + w - 8; xx += 26) { const h = 6 + R(xx) * 14; g.fillStyle(0x7cff5a, 0.7); g.fillRoundedRect(xx, y + 2, 5, h, 2.5); g.fillCircle(xx + 2.5, y + 2 + h, 3.5); }
      break;
    case 'stone':
      for (let xx = x; xx < x + w; xx += 40) { g.fillStyle(R(xx) > 0.5 ? 0x70707e : 0x62626e); g.fillRect(xx, y, Math.min(38, x + w - xx), 12); g.fillStyle(0x8a8a98); g.fillRect(xx, y, Math.min(38, x + w - xx), 2.5); }
      break;
  }
}

function drawProp(g: GG, th: Theme, kind: string, x: number, y: number, seed: number) {
  const R = (i: number) => hash(seed * 13 + i);
  switch (kind) {
    case 'lamp':
      g.fillStyle(0xffe8a0, 0.08); g.fillTriangle(x + 22, y - 118, x - 30, y, x + 74, y);
      g.fillStyle(0x3a3e4a); g.fillRect(x - 3, y - 120, 6, 120); g.fillRect(x - 3, y - 120, 30, 5); g.fillRect(x - 8, y - 6, 16, 6);
      g.fillStyle(0x2a2e38); g.fillRoundedRect(x + 14, y - 122, 18, 9, 3); g.fillStyle(0xffe8a0); g.fillRect(x + 16, y - 114, 14, 3);
      break;
    case 'hydrant':
      g.fillStyle(0xc0392b); g.fillRoundedRect(x - 7, y - 26, 14, 26, 4); g.fillRect(x - 11, y - 18, 22, 6); g.fillCircle(x, y - 26, 7); g.fillStyle(0xe8604a); g.fillRect(x - 5, y - 24, 3, 20);
      break;
    case 'cone':
      g.fillStyle(0xf08a24); g.fillTriangle(x - 10, y - 2, x, y - 28, x + 10, y - 2); g.fillStyle(0xffffff); g.fillRect(x - 6, y - 15, 12, 4); g.fillStyle(0x2a2a2a); g.fillRect(x - 13, y - 3, 26, 3);
      break;
    case 'sign':
      g.fillStyle(0x6a6e78); g.fillRect(x - 2, y - 70, 4, 70); g.fillStyle(0x2b8a3e); g.fillRoundedRect(x - 26, y - 82, 52, 22, 3); g.fillStyle(0xffffff, 0.85); g.fillRect(x - 20, y - 74, 30, 3); g.fillRect(x - 20, y - 68, 20, 3);
      break;
    case 'bin':
      g.fillStyle(0x3a5a3a); g.fillRoundedRect(x - 12, y - 32, 24, 32, 3); g.fillStyle(0x2a442a); g.fillRect(x - 14, y - 34, 28, 5); g.fillStyle(0x4a704a); g.fillRect(x - 8, y - 26, 3, 22); g.fillRect(x + 2, y - 26, 3, 22);
      break;
    case 'pipe':
      g.fillStyle(0x5a4a3a); g.fillRect(x - 9, y - 140, 18, 140); g.fillStyle(0x7a6a5a); g.fillRect(x - 9, y - 140, 5, 140);
      g.fillStyle(0x4a3a2a); g.fillRect(x - 13, y - 90, 26, 8); g.fillRect(x - 13, y - 40, 26, 8); g.fillStyle(0xc0392b); g.fillCircle(x + 16, y - 70, 7); g.fillRect(x + 8, y - 72, 8, 4);
      break;
    case 'drums':
      for (const [ox, oy] of [[-14, 0], [14, 0], [0, -34]]) { g.fillStyle(oy ? 0x3a6a8a : 0x5a6a3a); g.fillRoundedRect(x + ox - 13, y + oy - 34, 26, 34, 4); g.fillStyle(0x000000, 0.25); g.fillRect(x + ox - 13, y + oy - 26, 26, 3); g.fillRect(x + ox - 13, y + oy - 12, 26, 3); g.fillStyle(0xffffff, 0.15); g.fillRect(x + ox - 9, y + oy - 32, 4, 30); }
      break;
    case 'gear': {
      g.fillStyle(0x4a3e34);
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; g.fillRect(x + Math.cos(a) * 34 - 6, y - 10 + Math.sin(a) * 34 - 6, 12, 12); }
      g.fillCircle(x, y - 10, 32); g.fillStyle(0x2e241c); g.fillCircle(x, y - 10, 12); g.fillStyle(0x6a5a4a); g.fillCircle(x, y - 10, 5);
      break;
    }
    case 'vent':
      g.fillStyle(0x3a3e48); g.fillRect(x - 24, y - 30, 48, 30); g.fillStyle(0x1a1e26); for (let i = 0; i < 4; i++) g.fillRect(x - 20, y - 26 + i * 7, 40, 3);
      g.fillStyle(0xffffff, 0.06); g.fillEllipse(x, y - 46, 50, 26);
      break;
    case 'bush':
      g.fillStyle(0x1e4a22); g.fillCircle(x - 16, y - 10, 15); g.fillCircle(x + 14, y - 10, 14); g.fillStyle(0x2a6a2e); g.fillCircle(x, y - 18, 18); g.fillStyle(0x3f8a3a, 0.8); g.fillCircle(x - 5, y - 24, 7);
      break;
    case 'mushroom':
      g.fillStyle(0xe8dcc0); g.fillRect(x - 4, y - 18, 8, 18); g.fillStyle(0xc0392b); g.fillEllipse(x, y - 20, 34, 18); g.fillStyle(0xffffff); g.fillCircle(x - 8, y - 22, 3); g.fillCircle(x + 6, y - 24, 2.5); g.fillCircle(x + 2, y - 18, 2);
      break;
    case 'fern':
      g.lineStyle(3, 0x2f6a28); for (let i = -3; i <= 3; i++) g.lineBetween(x, y, x + i * 9, y - 30 + Math.abs(i) * 5);
      break;
    case 'stump':
      g.fillStyle(0x5a4028); g.fillRect(x - 16, y - 24, 32, 24); g.fillStyle(0xa8875a); g.fillEllipse(x, y - 24, 32, 9); g.lineStyle(1.5, 0x5a4028); g.strokeCircle(x, y - 24, 6);
      break;
    case 'cactus':
      g.fillStyle(0x3f7a33); g.fillRoundedRect(x - 7, y - 64, 14, 64, 7); g.fillRoundedRect(x - 22, y - 44, 10, 26, 5); g.fillRect(x - 22, y - 22, 16, 8); g.fillRoundedRect(x + 12, y - 52, 10, 22, 5); g.fillRect(x + 6, y - 34, 16, 8);
      g.fillStyle(0x5aa83a, 0.7); g.fillRect(x - 3, y - 60, 3, 56);
      break;
    case 'rock':
      g.fillStyle(darken(th.ground, 0.75)); g.fillEllipse(x, y - 10, 46, 26); g.fillStyle(lighten(th.ground, 0.15)); g.fillEllipse(x - 6, y - 15, 22, 10);
      break;
    case 'skull':
      g.fillStyle(0xe8e0c8); g.fillCircle(x, y - 10, 9); g.fillRect(x - 5, y - 4, 10, 5); g.fillStyle(0x3a2a1a); g.fillCircle(x - 3.5, y - 11, 2.5); g.fillCircle(x + 3.5, y - 11, 2.5);
      break;
    case 'crateS':
      g.fillStyle(0x9a6a3a); g.fillRect(x - 16, y - 32, 32, 32); g.lineStyle(3, 0x5a3a1a); g.strokeRect(x - 14, y - 30, 28, 28); g.lineBetween(x - 14, y - 30, x + 14, y - 2);
      break;
    case 'crystal':
      g.fillStyle(th.top === 'goo' ? 0x9cff4a : 0x9ad8ff, 0.85); g.fillTriangle(x - 10, y, x - 4, y - 40, x + 2, y); g.fillTriangle(x - 2, y, x + 6, y - 30, x + 14, y); g.fillTriangle(x - 18, y, x - 13, y - 22, x - 8, y);
      g.fillStyle(0xffffff, 0.6); g.fillTriangle(x - 6, y - 6, x - 4, y - 34, x - 2, y - 6);
      break;
    case 'snowpine':
      g.fillStyle(0x5a4028); g.fillRect(x - 4, y - 16, 8, 16);
      for (let i = 0; i < 3; i++) { g.fillStyle(0x2a5a4a); g.fillTriangle(x - 26 + i * 5, y - 12 - i * 22, x, y - 46 - i * 22, x + 26 - i * 5, y - 12 - i * 22); g.fillStyle(0xffffff); g.fillTriangle(x - 10 + i * 2, y - 34 - i * 22, x, y - 46 - i * 22, x + 10 - i * 2, y - 34 - i * 22); }
      break;
    case 'console':
      g.fillStyle(0x2a3a44); g.fillRect(x - 22, y - 46, 44, 46); g.fillStyle(0x0a1418); g.fillRect(x - 17, y - 41, 34, 20);
      g.fillStyle(th.accent, 0.85); for (let i = 0; i < 4; i++) g.fillRect(x - 14, y - 38 + i * 5, 10 + R(i) * 18, 2);
      g.fillStyle(0xff4a3a); g.fillCircle(x - 12, y - 12, 3); g.fillStyle(0x5aff8c); g.fillCircle(x - 2, y - 12, 3); g.fillStyle(0xf2c94c); g.fillCircle(x + 8, y - 12, 3);
      break;
    case 'tube':
      g.fillStyle(0x3a4a54); g.fillRect(x - 18, y - 12, 36, 12); g.fillRect(x - 18, y - 94, 36, 10);
      g.fillStyle(0x7cff5a, 0.35); g.fillRect(x - 14, y - 84, 28, 72); g.fillStyle(0xffffff, 0.3); g.fillRect(x - 11, y - 82, 4, 68);
      g.fillStyle(0x9cff4a, 0.6); for (let i = 0; i < 4; i++) g.fillCircle(x - 6 + R(i) * 12, y - 20 - i * 15, 2.5);
      break;
    case 'lavarock':
      g.fillStyle(0x2a1410); g.fillTriangle(x - 30, y, x - 6, y - 50, x + 26, y); g.lineStyle(2.5, 0xff6a1e, 0.9); g.lineBetween(x - 8, y - 40, x - 2, y - 22); g.lineBetween(x - 2, y - 22, x + 6, y - 8);
      break;
    case 'bones':
      g.fillStyle(0xe8e0c8); g.fillRect(x - 18, y - 6, 36, 4); g.fillCircle(x - 18, y - 6, 3.5); g.fillCircle(x + 18, y - 6, 3.5); g.fillCircle(x + 10, y - 14, 7); g.fillStyle(0x2a1a14); g.fillCircle(x + 8, y - 15, 1.8);
      break;
    case 'alienplant':
      g.lineStyle(4, 0x3a7a3a); g.lineBetween(x, y, x - 10, y - 40); g.lineBetween(x, y, x + 12, y - 52); g.lineBetween(x, y, x + 2, y - 28);
      g.fillStyle(0x7cff5a, 0.3); g.fillCircle(x - 10, y - 42, 12); g.fillCircle(x + 12, y - 54, 14);
      g.fillStyle(0xb8ff5a); g.fillCircle(x - 10, y - 42, 6); g.fillCircle(x + 12, y - 54, 7); g.fillCircle(x + 2, y - 30, 4);
      break;
    case 'pod':
      g.fillStyle(0x5e3a7a); g.fillEllipse(x, y - 18, 30, 36); g.fillStyle(0x9cff4a, 0.5); g.fillEllipse(x, y - 18, 12, 20);
      break;
    case 'torch':
      g.fillStyle(0x4a3a2a); g.fillRect(x - 3, y - 60, 6, 60); g.fillStyle(0x6a6a74); g.fillRect(x - 8, y - 64, 16, 6);
      g.fillStyle(0xff8a2e, 0.25); g.fillCircle(x, y - 74, 22); g.fillStyle(0xff6a1e); g.fillTriangle(x - 7, y - 64, x, y - 86, x + 7, y - 64); g.fillStyle(0xffd04a); g.fillTriangle(x - 3, y - 64, x, y - 76, x + 3, y - 64);
      break;
    case 'banner':
      g.fillStyle(0x4a4a54); g.fillRect(x - 2, y - 110, 4, 110); g.fillRect(x - 2, y - 110, 30, 4);
      g.fillStyle(0x8a1e2a); g.fillPoints([{ x: x + 2, y: y - 106 }, { x: x + 28, y: y - 106 }, { x: x + 28, y: y - 50 }, { x: x + 15, y: y - 60 }, { x: x + 2, y: y - 50 }], true);
      g.fillStyle(0xf2c94c); g.fillCircle(x + 15, y - 86, 6);
      break;
    case 'beacon':
      g.fillStyle(0x3a3e48); g.fillRect(x - 10, y - 20, 20, 20); g.fillStyle(th.accent, 0.3); g.fillCircle(x, y - 26, 16); g.fillStyle(th.accent); g.fillCircle(x, y - 26, 7);
      break;
  }
}

/** Static terrain + background props, baked once per level. */
export function drawTerrain(g: GG, L: Level) {
  const th = THEMES[L.theme];
  const P = PPU;
  // legacy hand-placed props
  for (const p of L.props) {
    const x = p.x * P, y = p.y * P;
    switch (p.kind) {
      case 'car':
        g.fillStyle(0x7a2a2a); g.fillRoundedRect(x, y - 40, 125, 30, 8); g.fillStyle(0x9a3a3a); g.fillRoundedRect(x + 25, y - 62, 70, 26, 10);
        g.fillStyle(0x9ad4f0, 0.6); g.fillRect(x + 32, y - 58, 26, 16); g.fillRect(x + 62, y - 58, 26, 16);
        g.fillStyle(0xffe8a0); g.fillRect(x + 118, y - 34, 6, 6); g.fillStyle(0xff4a3a); g.fillRect(x + 1, y - 34, 5, 6);
        g.fillStyle(0x111111); g.fillCircle(x + 25, y - 10, 11); g.fillCircle(x + 100, y - 10, 11); g.fillStyle(0x777777); g.fillCircle(x + 25, y - 10, 4); g.fillCircle(x + 100, y - 10, 4);
        break;
      case 'pillar':
        g.fillStyle(0x4a4e58); g.fillRect(x, y, 40, (GROUND_Y + 3) * P - y); g.fillStyle(0x5e636e); g.fillRect(x, y, 8, (GROUND_Y + 3) * P - y);
        break;
      case 'overhang':
        g.fillStyle(th.detail); g.fillRoundedRect(x - 20, y - 60, (p.w ?? 3) * P + 40, 60, 14);
        g.fillStyle(th.groundTop); g.fillRect(x - 20, y - 14, (p.w ?? 3) * P + 40, 10);
        break;
      case 'dune':
        g.fillStyle(th.detail, 0.6); g.fillEllipse(x, y + 4, 300, 60);
        break;
    }
  }
  // procedural-looking but deterministic background props along the ground
  let si = 0;
  for (const s of L.solids) {
    si++;
    if (s.type !== SolidType.GROUND || s.w < 5) continue;
    for (let ux = s.x + 2.5; ux < s.x + s.w - 2.5; ux += 5 + hash(Math.floor(ux * 7) + si) * 6) {
      if (ux > L.arenaX - 2 && ux < L.arenaX + 21) continue;
      const r = hash(Math.floor(ux * 13) + 7 * si);
      if (r < 0.25) continue;
      drawProp(g, th, th.props[Math.floor(r * 997) % th.props.length], ux * P, s.y * P, Math.floor(ux * 31));
    }
  }
  for (const s of L.solids) {
    if (s.type === SolidType.WALL) continue;
    const x = s.x * P, y = s.y * P, w = s.w * P, h = Math.min(s.h * P, 14 * P - y);
    if (s.type === SolidType.ONEWAY) {
      g.fillStyle(darken(th.plat, 0.55)); g.fillRect(x + 6, y + 10, 6, 34); g.fillRect(x + w - 12, y + 10, 6, 34);
      g.lineStyle(2, darken(th.plat, 0.55)); g.lineBetween(x + 9, y + 40, x + w - 9, y + 14); g.lineBetween(x + w - 9, y + 40, x + 9, y + 14);
      g.fillStyle(0x0d0f1a); g.fillRoundedRect(x - 2, y - 2, w + 4, h + 8, 5);
      g.fillStyle(th.plat); g.fillRoundedRect(x, y, w, h + 4, 4);
      g.fillStyle(lighten(th.plat, 0.3)); g.fillRect(x + 2, y + 1, w - 4, 3);
      g.fillStyle(darken(th.plat, 0.7)); for (let xx = x + 16; xx < x + w - 8; xx += 20) g.fillRect(xx, y + 5, 2, h - 3);
      continue;
    }
    g.fillStyle(0x0d0f1a); g.fillRect(x - 2, y - 2, w + 4, h + 2);
    g.fillStyle(th.ground); g.fillRect(x, y, w, h);
    tilePattern(g, th, x, y, w, h, Math.floor(s.x * 10));
    depthShade(g, x, y + 16, w, h - 16);
    // exposed side faces
    g.fillStyle(lighten(th.ground, 0.15), 0.6); g.fillRect(x, y, 4, h);
    g.fillStyle(0x000000, 0.35); g.fillRect(x + w - 5, y, 5, h);
    if (s.type === SolidType.BLOCK) { g.lineStyle(3, th.detail); g.strokeRect(x + 1, y + 1, w - 2, h - 2); }
    topSurface(g, th, x, y, w, Math.floor(s.x * 10));
    if (s.conveyor !== 0) {
      g.fillStyle(0x1e1e22); g.fillRect(x, y, w, 14);
      g.fillStyle(0x3a3a40); for (let xx = x + 8; xx < x + w; xx += 16) g.fillCircle(xx, y + 7, 5);
      g.fillStyle(0xffd04a);
      const dir = Math.sign(s.conveyor);
      for (let ax = x + 20; ax < x + w - 10; ax += 48) g.fillTriangle(ax, y + 2, ax + dir * 12, y + 7, ax, y + 12);
    }
  }
}

export function darkenC(c: number, k: number) { return darken(c, k); }
