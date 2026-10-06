import Phaser from 'phaser';
import { Level, GROUND_Y } from '../game/level';
import { SolidType } from '../game/entities';
import { hash, PPU } from '../game/util';

export interface Theme {
  skyTop: number; skyBot: number; far: number; near: number; accent: number;
  ground: number; groundTop: number; plat: number; detail: number;
  farKind: string; nearKind: string; lava?: boolean;
}

export const THEMES: Theme[] = [
  { skyTop: 0x0b1030, skyBot: 0x3a2a5a, far: 0x1a1f3a, near: 0x252a48, accent: 0xffd36a, ground: 0x34373f, groundTop: 0x5a5e6a, plat: 0x6a7080, detail: 0x2a2c33, farKind: 'city', nearKind: 'city' },
  { skyTop: 0x1a1410, skyBot: 0x5a3820, far: 0x2a2018, near: 0x3a2a1e, accent: 0xff8a2e, ground: 0x40342a, groundTop: 0x8a6a3a, plat: 0x7a6a5a, detail: 0x2e241c, farKind: 'factory', nearKind: 'pipes' },
  { skyTop: 0x050a14, skyBot: 0x1a2a3a, far: 0x0e1a1e, near: 0x132620, accent: 0xd8e8ff, ground: 0x2a2015, groundTop: 0x3f7a33, plat: 0x5a4028, detail: 0x1e170f, farKind: 'pines', nearKind: 'pines' },
  { skyTop: 0xe8904a, skyBot: 0xffd890, far: 0xd09858, near: 0xa86e3e, accent: 0xfff0c0, ground: 0xc89a5a, groundTop: 0xe8c080, plat: 0x9a7048, detail: 0xb08048, farKind: 'dunes', nearKind: 'mesa' },
  { skyTop: 0x6a9ad0, skyBot: 0xd8ecff, far: 0xa8c8e8, near: 0x7aa0c8, accent: 0xffffff, ground: 0x9cc4e4, groundTop: 0xf4fbff, plat: 0xb0d4f0, detail: 0x80a8cc, farKind: 'mountains', nearKind: 'mountains' },
  { skyTop: 0x060e12, skyBot: 0x10282e, far: 0x10262e, near: 0x173840, accent: 0x35e0f0, ground: 0x26343a, groundTop: 0x4a6a74, plat: 0x3a5058, detail: 0x1c282c, farKind: 'lab', nearKind: 'tanks' },
  { skyTop: 0x1a0404, skyBot: 0x6a1a0a, far: 0x2a0a08, near: 0x3a1410, accent: 0xff6a1e, ground: 0x2a1a18, groundTop: 0x5a2a1a, plat: 0x4a2a22, detail: 0x1e100e, farKind: 'volcano', nearKind: 'rocks', lava: true },
  { skyTop: 0x14042a, skyBot: 0x5a2a8a, far: 0x2a1048, near: 0x3a1a5a, accent: 0x7cff5a, ground: 0x2a1a4a, groundTop: 0x5a3a8a, plat: 0x4a2a6a, detail: 0x1e1236, farKind: 'spires', nearKind: 'shrooms' },
  { skyTop: 0x0c0c14, skyBot: 0x2a2a3a, far: 0x1a1a24, near: 0x24242e, accent: 0xff5a3a, ground: 0x383842, groundTop: 0x60606e, plat: 0x50505c, detail: 0x2a2a32, farKind: 'towers', nearKind: 'walls' },
  { skyTop: 0x050510, skyBot: 0x3a0a1a, far: 0x14141e, near: 0x1c1c26, accent: 0xff2e5a, ground: 0x262a36, groundTop: 0x3a4050, plat: 0x3a4050, detail: 0x1c1f28, farKind: 'base', nearKind: 'walls' },
];

const BG_W = 1024, BG_H = 540;

function silhouette(g: Phaser.GameObjects.Graphics, kind: string, col: number, accent: number, seed: number, near: boolean) {
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
      if (!near) { g.fillStyle(0xe8f0ff, 0.9); g.fillCircle(820, 90, 34); g.fillStyle(col, 0.0); }
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
      if (kind === 'dunes') { g.fillStyle(0xfff4c0, 0.9); g.fillCircle(260, 110, 46); }
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
      g.fillStyle(0xd0a0ff, 0.5); g.fillCircle(780, 120, 70); g.fillStyle(0x7cff5a, 0.4); g.fillCircle(240, 80, 22);
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

export function ensureBackgrounds(scene: Phaser.Scene, idx: number) {
  const th = THEMES[idx];
  const farKey = `bg_far_${idx}`, nearKey = `bg_near_${idx}`;
  if (!scene.textures.exists(farKey)) {
    const g = scene.make.graphics({}, false);
    silhouette(g, th.farKind, th.far, th.accent, idx * 2 + 1, false);
    g.generateTexture(farKey, BG_W, BG_H); g.destroy();
  }
  if (!scene.textures.exists(nearKey)) {
    const g = scene.make.graphics({}, false);
    silhouette(g, th.nearKind, th.near, th.accent, idx * 2 + 2, true);
    g.generateTexture(nearKey, BG_W, BG_H); g.destroy();
  }
  return { farKey, nearKey };
}

/** Static terrain, drawn once per level in world pixel space. */
export function drawTerrain(g: Phaser.GameObjects.Graphics, L: Level) {
  const th = THEMES[L.theme];
  const P = PPU;
  // props behind terrain
  for (const p of L.props) {
    const x = p.x * P, y = p.y * P;
    switch (p.kind) {
      case 'car':
        g.fillStyle(0x7a2a2a); g.fillRoundedRect(x, y - 40, 125, 30, 8); g.fillRoundedRect(x + 25, y - 62, 70, 26, 10);
        g.fillStyle(0x9ad4f0, 0.6); g.fillRect(x + 32, y - 58, 26, 16); g.fillRect(x + 62, y - 58, 26, 16);
        g.fillStyle(0x111111); g.fillCircle(x + 25, y - 10, 11); g.fillCircle(x + 100, y - 10, 11);
        break;
      case 'pillar':
        g.fillStyle(0x4a4e58); g.fillRect(x, y * 1, 40, (GROUND_Y + 2) * P - y);
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
  for (const s of L.solids) {
    if (s.type === SolidType.WALL) continue;
    const x = s.x * P, y = s.y * P, w = s.w * P, h = s.h * P;
    if (s.type === SolidType.ONEWAY) {
      g.fillStyle(darkenC(th.plat, 0.6)); g.fillRect(x + 6, y + 10, 6, 26); g.fillRect(x + w - 12, y + 10, 6, 26);
      g.fillStyle(th.plat); g.fillRoundedRect(x, y, w, h + 4, 4);
      g.fillStyle(th.groundTop); g.fillRect(x, y, w, 5);
      continue;
    }
    g.fillStyle(th.ground); g.fillRect(x, y, w, h);
    // texture detail
    g.fillStyle(th.detail);
    for (let i = 0; i < w / 40; i++) {
      const r = hash(Math.floor(s.x * 10) + i * 31);
      g.fillRect(x + i * 40 + r * 20, y + 18 + r * 50, 14 + r * 16, 6);
    }
    if (s.type === SolidType.BLOCK) { g.lineStyle(3, th.detail); g.strokeRect(x + 1, y + 1, w - 2, h - 2); }
    g.fillStyle(th.groundTop); g.fillRect(x, y, w, 8);
    if (s.ice) { g.fillStyle(0xffffff, 0.5); g.fillRect(x, y + 2, w, 3); }
    if (s.conveyor !== 0) {
      g.fillStyle(0x222222); g.fillRect(x, y, w, 12);
      g.fillStyle(0xffd04a);
      const dir = Math.sign(s.conveyor);
      for (let ax = x + 20; ax < x + w - 10; ax += 48) {
        g.fillTriangle(ax, y + 2, ax + dir * 10, y + 6, ax, y + 10);
      }
    }
  }
}

export function darkenC(c: number, k: number) {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  return (Math.round(r * k) << 16) | (Math.round(g * k) << 8) | Math.round(b * k);
}
