import Phaser from 'phaser';

/** Render resolution multiplier: textures are drawn at Z× and displayed at 1/Z scale (crisp on phones). */
export const Z = 2;

export const hex = (c: number, a = 1) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
export function lighten(c: number, k: number) {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  return (Math.min(255, Math.round(r + (255 - r) * k)) << 16) | (Math.min(255, Math.round(g + (255 - g) * k)) << 8) | Math.min(255, Math.round(b + (255 - b) * k));
}
export function darken(c: number, k: number) {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  return (Math.round(r * k) << 16) | (Math.round(g * k) << 8) | Math.round(b * k);
}

type Pt = { x: number; y: number };
type Radius = number | { tl: number; tr: number; bl: number; br: number };

/**
 * A Canvas2D pen with the same method names as Phaser.Graphics (so drawing code is shared),
 * plus automatic volumetric shading: every fill gets a top-light → bottom-dark gradient (SNES-style
 * cel shading), and textures get a dark outline pass.
 */
export class Pen {
  ctx: CanvasRenderingContext2D;
  private fill: number = 0xffffff;
  private fillA = 1;
  private line = 0x000000;
  private lineA = 1;
  private lineW = 1;
  shade = 0.32; // 0 = flat
  constructor(public canvas: HTMLCanvasElement, scale: number) {
    this.ctx = canvas.getContext('2d')!;
    this.ctx.scale(scale, scale);
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
  }

  fillStyle(c: number, a = 1) { this.fill = c; this.fillA = a; return this; }
  lineStyle(w: number, c: number, a = 1) { this.lineW = w; this.line = c; this.lineA = a; return this; }

  private paint(y0: number, y1: number, x0 = 0, x1 = 0) {
    const ctx = this.ctx;
    if (this.shade > 0 && y1 - y0 > 3) {
      const g = ctx.createLinearGradient(x0, y0, x1 * 0.15 + x0 * 0.85, y1);
      g.addColorStop(0, hex(lighten(this.fill, this.shade * 0.9), this.fillA));
      g.addColorStop(0.45, hex(this.fill, this.fillA));
      g.addColorStop(1, hex(darken(this.fill, 1 - this.shade * 0.85), this.fillA));
      ctx.fillStyle = g;
    } else ctx.fillStyle = hex(this.fill, this.fillA);
    ctx.fill();
  }

  fillRect(x: number, y: number, w: number, h: number) { this.ctx.beginPath(); this.ctx.rect(x, y, w, h); this.paint(y, y + h, x, x + w); return this; }
  fillRoundedRect(x: number, y: number, w: number, h: number, r: Radius = 8) {
    const R = typeof r === 'number' ? { tl: r, tr: r, bl: r, br: r } : r;
    const m = Math.min(w, h) / 2;
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + Math.min(R.tl, m), y);
    c.arcTo(x + w, y, x + w, y + h, Math.min(R.tr, m));
    c.arcTo(x + w, y + h, x, y + h, Math.min(R.br, m));
    c.arcTo(x, y + h, x, y, Math.min(R.bl, m));
    c.arcTo(x, y, x + w, y, Math.min(R.tl, m));
    c.closePath();
    this.paint(y, y + h, x, x + w);
    return this;
  }
  fillCircle(x: number, y: number, r: number) {
    this.ctx.beginPath(); this.ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
    if (this.shade > 0 && r > 3) {
      const g = this.ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
      g.addColorStop(0, hex(lighten(this.fill, this.shade * 0.8), this.fillA));
      g.addColorStop(0.6, hex(this.fill, this.fillA));
      g.addColorStop(1, hex(darken(this.fill, 1 - this.shade * 0.7), this.fillA));
      this.ctx.fillStyle = g; this.ctx.fill();
    } else { this.ctx.fillStyle = hex(this.fill, this.fillA); this.ctx.fill(); }
    return this;
  }
  fillEllipse(x: number, y: number, w: number, h: number) {
    this.ctx.beginPath(); this.ctx.ellipse(x, y, Math.max(0.1, w / 2), Math.max(0.1, h / 2), 0, 0, Math.PI * 2);
    this.paint(y - h / 2, y + h / 2, x - w / 2, x + w / 2);
    return this;
  }
  fillTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
    const c = this.ctx; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.closePath();
    this.paint(Math.min(y1, y2, y3), Math.max(y1, y2, y3), Math.min(x1, x2, x3), Math.max(x1, x2, x3));
    return this;
  }
  fillPoints(pts: Pt[], _close = true) {
    const c = this.ctx; c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.closePath();
    let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9;
    for (const p of pts) { y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); }
    this.paint(y0, y1, x0, x1);
    return this;
  }
  private stroke() { const c = this.ctx; c.strokeStyle = hex(this.line, this.lineA); c.lineWidth = this.lineW; c.stroke(); }
  lineBetween(x1: number, y1: number, x2: number, y2: number) { const c = this.ctx; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); this.stroke(); return this; }
  strokeCircle(x: number, y: number, r: number) { this.ctx.beginPath(); this.ctx.arc(x, y, r, 0, Math.PI * 2); this.stroke(); return this; }
  strokeRect(x: number, y: number, w: number, h: number) { this.ctx.beginPath(); this.ctx.rect(x, y, w, h); this.stroke(); return this; }
  strokeRoundedRect(x: number, y: number, w: number, h: number, r = 8) {
    const c = this.ctx; c.beginPath(); (c as any).roundRect ? (c as any).roundRect(x, y, w, h, r) : c.rect(x, y, w, h); this.stroke(); return this;
  }
  beginPath() { this.ctx.beginPath(); return this; }
  moveTo(x: number, y: number) { this.ctx.moveTo(x, y); return this; }
  lineTo(x: number, y: number) { this.ctx.lineTo(x, y); return this; }
  quad(cx: number, cy: number, x: number, y: number) { this.ctx.quadraticCurveTo(cx, cy, x, y); return this; }
  strokePath() { this.stroke(); return this; }
  fillPath(y0: number, y1: number) { this.ctx.closePath(); this.paint(y0, y1); return this; }
  arc(x: number, y: number, r: number, a0: number, a1: number) { this.ctx.arc(x, y, r, a0, a1); return this; }
  /** flat (unshaded) helpers */
  flat<T>(f: () => T): T { const s = this.shade; this.shade = 0; const r = f(); this.shade = s; return r; }
  glow(x: number, y: number, r: number, c: number, a = 0.6) {
    const g = this.ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hex(c, a)); g.addColorStop(1, hex(c, 0));
    this.ctx.fillStyle = g; this.ctx.beginPath(); this.ctx.arc(x, y, r, 0, Math.PI * 2); this.ctx.fill();
  }
  image(img: CanvasImageSource, x: number, y: number, w: number, h: number) { this.ctx.drawImage(img, x, y, w, h); }
}

/** Dark outline + subtle drop shadow around everything drawn on a canvas. */
function outline(src: HTMLCanvasElement, px: number, color = '#0d0f1a') {
  const out = document.createElement('canvas');
  out.width = src.width; out.height = src.height;
  const o = out.getContext('2d')!;
  const sil = document.createElement('canvas');
  sil.width = src.width; sil.height = src.height;
  const s = sil.getContext('2d')!;
  s.drawImage(src, 0, 0);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = color; s.fillRect(0, 0, sil.width, sil.height);
  const steps = 12;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    o.drawImage(sil, Math.cos(a) * px, Math.sin(a) * px);
  }
  o.drawImage(src, 0, 0);
  return out;
}

export interface TexOpts { outline?: number; shade?: number; }

/**
 * Create a texture by drawing with a Pen at Z× resolution. w/h are logical pixels.
 * Sprites using it must be displayed at scale 1/Z (see `spr`).
 */
export function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (p: Pen) => void, opts: TexOpts = {}) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * Z); c.height = Math.ceil(h * Z);
  const p = new Pen(c, Z);
  if (opts.shade !== undefined) p.shade = opts.shade;
  draw(p);
  const final = opts.outline ? outline(c, opts.outline * Z) : c;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, final);
}
