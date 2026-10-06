import { hex, darken, lighten, Pen } from './pen';
import { fist, rr, seg, shade } from './hero';

/**
 * Detailed humanoid enemy soldiers (original designs). Drawn in a normalized 72-unit-tall frame
 * (feet at 0,0, up is negative) and scaled to the enemy's hitbox height.
 * Frames: 0–3 walk cycle, 4 attack.
 */
type C = CanvasRenderingContext2D;

export interface SoldierSpec {
  skin: number; suit: number; armor: number; pants: number; boots: number; accent: number; eye: number;
  head: 'gasmask' | 'riot' | 'alien' | 'cyber';
  weapon: 'rifle' | 'baton' | 'plasma' | 'cannon';
  riotShield?: boolean;
}

export const SOLDIERS: Record<string, SoldierSpec> = {
  mutant: { skin: 0x7aa04a, suit: 0x55603a, armor: 0x3e4a2a, pants: 0x4a5a34, boots: 0x2a2620, accent: 0xb8862e, eye: 0xff3a2a, head: 'gasmask', weapon: 'rifle' },
  shielder: { skin: 0xe0b48a, suit: 0x2a3a5a, armor: 0x3a4e78, pants: 0x222c44, boots: 0x16161c, accent: 0xf2c94c, eye: 0x9ad4ff, head: 'riot', weapon: 'baton', riotShield: true },
  alien: { skin: 0x8a6ad0, suit: 0x3a2470, armor: 0x5e3aa8, pants: 0x2e1c58, boots: 0x1e123a, accent: 0x7cff5a, eye: 0x7cff5a, head: 'alien', weapon: 'plasma' },
  cyborg: { skin: 0xd0b090, suit: 0x3a4250, armor: 0x7a8494, pants: 0x2e3440, boots: 0x1c2028, accent: 0x35e0f0, eye: 0xff2e5a, head: 'cyber', weapon: 'cannon' },
};

const WALK: [number, number, number, number][] = [ // legA dx, legB dx, liftA, liftB
  [7, -6, 0, 2], [2, -1, 1, 5], [-6, 7, 2, 0], [-1, 2, 5, 1],
];

function boot(c: C, x: number, y: number, col: number, back: boolean) {
  const b = back ? darken(col, 0.8) : col;
  rr(c, x - 3.5, y - 7, 7, 6, 1.5); shade(c, b, x - 3.5, y - 7, 7, 6, undefined, undefined, 1, 1);
  rr(c, x - 4, y - 3.5, 10, 4, [1.5, 3, 1.5, 1]); shade(c, b, x - 4, y - 3.5, 10, 4, undefined, undefined, 1, 1);
  c.fillStyle = '#0d0f1a'; c.fillRect(x - 4, y - 0.8, 10, 1.3);
}

function weapon(c: C, S: SoldierSpec, hx: number, hy: number, attack: boolean) {
  switch (S.weapon) {
    case 'rifle': {
      const recoil = attack ? -2 : 0;
      c.save(); c.translate(hx + recoil, hy); c.rotate(attack ? -0.5 : -0.04);
      rr(c, -12, -2.5, 8, 5, 1.5); shade(c, 0x6a4a2a, -12, -2.5, 8, 5, undefined, undefined, 1, 0.8);   // stock
      rr(c, -5, -3, 15, 5.5, 1); shade(c, 0x3a3e46, -5, -3, 15, 5.5, undefined, undefined, 1, 0.8);     // body
      c.fillStyle = '#26292e'; c.fillRect(9, -1.8, 9, 2.2);                                            // barrel
      rr(c, 1, 2, 3.5, 6, 1); shade(c, 0x2a2c30, 1, 2, 3.5, 6, undefined, undefined, 1, 0.6);            // magazine
      c.fillStyle = hex(S.accent); c.fillRect(-2, -4.5, 4, 1.6);                                       // sight
      c.restore();
      break;
    }
    case 'baton':
      c.save(); c.translate(hx, hy); c.rotate(attack ? -2.2 : -0.9);
      rr(c, -1.4, -16, 2.8, 17, 1.2); shade(c, 0x1a1a22, -1.4, -16, 2.8, 17, undefined, undefined, 1, 0.6);
      c.fillStyle = hex(S.accent); c.fillRect(-1.6, -3, 3.2, 2);
      c.restore();
      break;
    case 'plasma': {
      c.save(); c.translate(hx, hy); c.rotate(-0.04);
      rr(c, -8, -3.5, 22, 7, 3); shade(c, 0x4a3a7a, -8, -3.5, 22, 7, undefined, undefined, 1, 0.8);
      const gl = c.createRadialGradient(8, 0, 0, 8, 0, 6); gl.addColorStop(0, hex(0xffffff)); gl.addColorStop(0.4, hex(S.accent, 0.9)); gl.addColorStop(1, hex(S.accent, 0));
      c.fillStyle = gl; c.beginPath(); c.arc(8, 0, attack ? 8 : 5, 0, Math.PI * 2); c.fill();
      c.fillStyle = hex(S.accent); for (let i = 0; i < 3; i++) c.fillRect(-4 + i * 3.5, -2.5, 1.5, 5);
      c.restore();
      break;
    }
    case 'cannon':
      break; // integrated into the arm
  }
  if (attack && (S.weapon === 'rifle' || S.weapon === 'plasma')) {
    const fx = hx + (S.weapon === 'rifle' ? 20 : 16), fy = hy - 1;
    const gl = c.createRadialGradient(fx, fy, 0, fx, fy, 8); gl.addColorStop(0, '#ffffff'); gl.addColorStop(0.4, hex(S.weapon === 'plasma' ? S.accent : 0xffd060, 0.9)); gl.addColorStop(1, 'rgba(255,200,80,0)');
    c.fillStyle = gl; c.beginPath(); c.arc(fx, fy, 8, 0, Math.PI * 2); c.fill();
  }
}

function headPart(c: C, S: SoldierSpec, x: number, y: number) {
  switch (S.head) {
    case 'gasmask': {
      c.beginPath(); c.ellipse(x, y, 6.5, 7.5, 0, 0, Math.PI * 2); shade(c, S.skin, x - 6.5, y - 7.5, 13, 15);
      c.strokeStyle = hex(darken(S.skin, 0.5)); c.lineWidth = 0.8; c.beginPath(); c.moveTo(x - 4, y - 5); c.lineTo(x - 1, y - 3); c.stroke();
      rr(c, x - 1, y - 2.5, 8.5, 8, 3); shade(c, 0x3a3e40, x - 1, y - 2.5, 8.5, 8, undefined, undefined, 1, 0.9);
      c.fillStyle = hex(S.eye); c.beginPath(); c.arc(x + 3, y - 0.5, 1.8, 0, Math.PI * 2); c.fill();
      c.fillStyle = hex(S.eye, 0.35); c.beginPath(); c.arc(x + 3, y - 0.5, 3.2, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(x + 6.5, y + 4, 2.6, 0, Math.PI * 2); shade(c, 0x5a6064, x + 4, y + 1.5, 5, 5, undefined, undefined, 1, 0.8);
      c.fillStyle = hex(S.armor); c.fillRect(x - 6.5, y - 1, 3, 2);
      break;
    }
    case 'riot': {
      c.beginPath(); c.arc(x, y, 7.5, Math.PI, 0); c.lineTo(x + 7.5, y + 5); c.lineTo(x - 7.5, y + 5); c.closePath(); shade(c, S.armor, x - 7.5, y - 7.5, 15, 13);
      rr(c, x - 1, y - 3, 8.5, 7, 2); c.fillStyle = hex(0x9ad4ff, 0.75); c.fill(); c.strokeStyle = '#0d0f1a'; c.lineWidth = 1; c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(x + 1, y - 2, 2.5, 1.2);
      c.fillStyle = hex(S.accent); c.fillRect(x - 7.5, y - 1, 15, 1.4);
      break;
    }
    case 'alien': {
      c.beginPath(); c.ellipse(x - 1, y - 2, 7, 9, -0.35, 0, Math.PI * 2); shade(c, S.skin, x - 8, y - 11, 14, 18);
      c.fillStyle = '#0d0f1a'; c.beginPath(); c.ellipse(x + 3, y, 3, 1.8, -0.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = hex(S.eye); c.beginPath(); c.ellipse(x + 3.2, y - 0.2, 1.8, 1.1, -0.5, 0, Math.PI * 2); c.fill();
      rr(c, x - 6, y + 3, 11, 4, 1.5); shade(c, S.armor, x - 6, y + 3, 11, 4, undefined, undefined, 1, 0.8);
      c.fillStyle = hex(S.accent, 0.8); c.beginPath(); c.arc(x - 4, y - 7, 1.4, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'cyber': {
      c.beginPath(); c.ellipse(x, y, 6.5, 7.5, 0, 0, Math.PI * 2); shade(c, S.skin, x - 6.5, y - 7.5, 13, 15);
      c.beginPath(); c.moveTo(x - 6.5, y - 2); c.arc(x, y, 7.6, Math.PI * 0.9, Math.PI * 1.7); c.lineTo(x, y + 6); c.closePath(); shade(c, S.armor, x - 7, y - 7.5, 9, 14);
      rr(c, x - 1, y - 2.5, 8, 3.2, 1.5); c.fillStyle = '#0d0f1a'; c.fill();
      c.fillStyle = hex(S.eye); c.fillRect(x + 1, y - 1.8, 5, 1.8);
      c.fillStyle = hex(S.eye, 0.35); c.fillRect(x, y - 3, 8, 4);
      c.strokeStyle = hex(S.accent); c.lineWidth = 0.8; c.beginPath(); c.moveTo(x - 5, y + 2); c.lineTo(x - 2, y + 5); c.stroke();
      break;
    }
  }
}

/** Draw a soldier frame into a canvas of size W×H (logical px). h = hitbox height in px. */
export function drawSoldier(g: Pen, S: SoldierSpec, frame: number, W: number, H: number, h: number) {
  const c = g.ctx;
  const s = h / 72;
  c.save();
  c.translate(W / 2, H - 4);
  c.scale(s, s);
  const attack = frame === 4;
  const [la, lb, lfa, lfb] = attack ? [5, -5, 0, 0] : WALK[frame % 4];
  const bob = attack ? 0 : (frame % 2 ? -1 : 0);
  const hip = -30 + bob, sh = -54 + bob;
  // shadow
  c.fillStyle = 'rgba(0,0,0,0.28)'; c.beginPath(); c.ellipse(0, 0, 13, 2.6, 0, 0, Math.PI * 2); c.fill();

  const leg = (side: number, dx: number, lift: number, back: boolean) => {
    const hx = side * 4, ax = dx, ay = -6 - lift;
    const kx = (hx + ax) / 2 + 1.5, ky = (hip + ay) / 2;
    const col = back ? darken(S.pants, 0.78) : S.pants;
    seg(c, hx, hip, 4.4, kx, ky, 3.7, col);
    seg(c, kx, ky, 3.7, ax, ay, 3.1, col);
    rr(c, kx - 2.5, ky - 3, 5.5, 6, 1.5); shade(c, back ? darken(S.armor, 0.8) : S.armor, kx - 2.5, ky - 3, 5.5, 6, undefined, undefined, 1, 0.7);
    boot(c, ax, ay + 6, S.boots, back);
  };

  // riot shield arm in the back plane
  leg(-1, lb, lfb, true);
  // back arm (support hand on weapon)
  const handF = S.weapon === 'cannon' ? [15, sh + 12] : S.weapon === 'baton' ? [11, sh + 13] : [13, sh + 10];
  const handB = S.weapon === 'baton' ? [-9, sh + 20] : [5, sh + 12];
  seg(c, -7, sh + 3, 3.4, (handB[0] - 7) / 2 - 1, sh + 12, 3, darken(S.suit, 0.78));
  seg(c, (handB[0] - 7) / 2 - 1, sh + 12, 3, handB[0], handB[1], 2.6, darken(S.suit, 0.78));
  fist(c, handB[0], handB[1], darken(S.boots, 1.2), false);

  // torso
  c.beginPath(); c.moveTo(-10, sh); c.lineTo(10, sh); c.lineTo(7, hip + 1); c.lineTo(-7, hip + 1); c.closePath(); shade(c, S.suit, -10, sh, 20, hip - sh);
  // armor vest
  rr(c, -8, sh + 2, 16, 17, 3); shade(c, S.armor, -8, sh + 2, 16, 17);
  for (let i = 0; i < 3; i++) { rr(c, -7 + i * 5, sh + 12, 4, 5.5, 1); shade(c, darken(S.armor, 0.75), -7 + i * 5, sh + 12, 4, 5.5, undefined, undefined, 1, 0.6); }
  c.fillStyle = hex(S.accent); c.fillRect(-6, sh + 4, 4, 2);
  // belt
  rr(c, -8, hip - 3, 16, 4, 1); shade(c, 0x2a2420, -8, hip - 3, 16, 4, undefined, undefined, 1, 0.7);
  c.fillStyle = hex(S.accent); c.fillRect(-1.5, hip - 3, 3, 4);

  leg(1, la, lfa, false);

  // shoulder pads + head
  for (const x of [-9, 9]) { c.beginPath(); c.ellipse(x, sh + 2, 4.2, 3.6, 0, 0, Math.PI * 2); shade(c, S.armor, x - 4, sh - 1.5, 8.4, 7.2, undefined, undefined, 1, 0.8); }
  rr(c, -3, sh - 4, 6, 5, 2); shade(c, darken(S.suit, 0.85), -3, sh - 4, 6, 5, undefined, undefined, 1, 0.6);
  headPart(c, S, 1, sh - 10);

  // front arm + weapon
  if (S.weapon === 'cannon') {
    seg(c, 8, sh + 3, 3.6, 10, sh + 12, 3.3, S.suit);
    rr(c, 8, sh + 8, 15, 8, 3); shade(c, S.armor, 8, sh + 8, 15, 8);
    c.fillStyle = '#16181e'; c.fillRect(22, sh + 10, 4, 4);
    c.fillStyle = hex(S.accent); for (let i = 0; i < 3; i++) c.fillRect(11 + i * 3.5, sh + 9.5, 1.4, 5);
    if (attack) { const gl = c.createRadialGradient(27, sh + 12, 0, 27, sh + 12, 9); gl.addColorStop(0, '#ffffff'); gl.addColorStop(0.4, hex(S.accent, 0.9)); gl.addColorStop(1, hex(S.accent, 0)); c.fillStyle = gl; c.beginPath(); c.arc(27, sh + 12, 9, 0, Math.PI * 2); c.fill(); }
  } else {
    const el = [9, sh + 11];
    weapon(c, S, handF[0], handF[1], attack);
    seg(c, 8, sh + 3, 3.6, el[0], el[1], 3.2, S.suit);
    seg(c, el[0], el[1], 3.2, handF[0], handF[1], 2.8, S.suit);
    fist(c, handF[0], handF[1], darken(S.boots, 1.2), false);
  }
  if (S.riotShield) {
    const sx = attack ? 14 : 16;
    rr(c, sx - 3, sh - 4, 7, 38, 3);
    const gr = c.createLinearGradient(sx - 3, 0, sx + 4, 0); gr.addColorStop(0, hex(0xb8d8ff, 0.55)); gr.addColorStop(1, hex(0x5a7aa8, 0.75));
    c.fillStyle = gr; c.fill(); c.strokeStyle = '#0d0f1a'; c.lineWidth = 1.4; c.stroke();
    c.fillStyle = hex(S.accent); c.fillRect(sx - 2.5, sh + 6, 6, 2);
    c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(sx - 1.5, sh - 2, 1.4, 30);
  }
  c.restore();
}

export { lighten };
