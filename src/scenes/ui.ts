import Phaser from 'phaser';
import { play, Sfx, unlockAudio } from '../systems/sound';
import { Z } from '../art/pen';
import { ensureBackgrounds } from '../art/themes';
import { save } from '../systems/save';

/** Logical (virtual) screen size; the camera zooms by Z so drawing stays in 540-tall coordinates. */
export const VW = (s: Phaser.Scene) => s.scale.width / Z;
export const VH = (s: Phaser.Scene) => s.scale.height / Z;
export function initCam(s: Phaser.Scene) { s.cameras.main.setOrigin(0, 0).setZoom(Z); }

import { FONT_BODY, FONT_TITLE } from '../fonts';
export const FONT = FONT_TITLE;
export const FONT2 = FONT_BODY;

export function txt(scene: Phaser.Scene, x: number, y: number, s: string, size: number, color = '#ffffff', bold = true) {
  return scene.add.text(x, y, s, {
    fontFamily: bold ? FONT : FONT2, fontSize: `${size}px`, color, align: 'center',
    stroke: '#000000', strokeThickness: Math.max(2, Math.round(size / 8)),
  }).setOrigin(0.5);
}

export interface Btn { box: Phaser.GameObjects.NineSlice; label: Phaser.GameObjects.Text; setEnabled(v: boolean): void; setText(s: string): void; }

export function button(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, onClick: () => void, color = 0x2bb3a0, size = 22): Btn {
  const box = scene.add.nineslice(x, y, 'btn', undefined, w * Z, h * Z, 18 * Z, 18 * Z, 18 * Z, 18 * Z).setScale(1 / Z).setTint(color).setInteractive({ useHandCursor: true });
  const t = txt(scene, x, y - 1, label, size);
  let enabled = true;
  box.on('pointerdown', () => { if (!enabled) return; unlockAudio(); box.setScale(0.96 / Z); t.setScale(0.96); });
  box.on('pointerover', () => { if (enabled) box.setTint(Phaser.Display.Color.ValueToColor(color).lighten(12).color); });
  box.on('pointerout', () => { box.setScale(1 / Z); t.setScale(1); box.setTint(color); });
  box.on('pointerup', () => {
    box.setScale(1 / Z); t.setScale(1);
    if (!enabled) return;
    play(Sfx.CLICK);
    onClick();
  });
  return {
    box, label: t,
    setEnabled(v: boolean) { enabled = v; box.setAlpha(v ? 1 : 0.4); t.setAlpha(v ? 1 : 0.5); },
    setText(s: string) { t.setText(s); },
  };
}

/** Dark glass panel (nine-slice), centered at x,y. */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, tint = 0xffffff, alpha = 1) {
  return scene.add.nineslice(x, y, 'panel', undefined, w * Z, h * Z, 22 * Z, 22 * Z, 22 * Z, 22 * Z).setScale(1 / Z).setTint(tint).setAlpha(alpha);
}

/** Coin counter chip; returns a setter. */
export function coinChip(scene: Phaser.Scene, x: number, y: number, value: number) {
  panel(scene, x - 62, y, 124, 40);
  scene.add.image(x - 104, y, 'pu_7').setScale(0.9 / Z);
  const t = scene.add.text(x - 84, y, String(value), { fontFamily: FONT, fontSize: '19px', color: '#ffe28a', stroke: '#000', strokeThickness: 4 }).setOrigin(0, 0.5);
  return (v: number) => t.setText(String(v));
}

/** Standard screen header: back button, gold title, coin chip. Returns the coin setter. */
export function header(scene: Phaser.Scene, title: string, back = 'Menu') {
  const W = VW(scene);
  const g = scene.add.graphics();
  g.fillGradientStyle(0x060a18, 0x060a18, 0x060a18, 0x060a18, 0.85, 0.85, 0, 0); g.fillRect(0, 0, W, 78);
  button(scene, 74, 36, 116, 42, '◀', () => scene.scene.start(back), 0x5a5f78, 20);
  const t = txt(scene, W / 2, 36, title, 30, '#ffe28a');
  t.setShadow(0, 3, '#c0501a', 0, true, true);
  return coinChip(scene, W - 14, 36, save.coins);
}

/** Animated menu backdrop using a level theme. */
export function backdrop(scene: Phaser.Scene, theme = 0, dim = 0.35) {
  const W = VW(scene), H = VH(scene);
  const k = ensureBackgrounds(scene, theme);
  scene.add.image(0, 0, k.skyKey).setOrigin(0).setDisplaySize(W, H);
  const far = scene.add.tileSprite(0, 0, W, H, k.farKey).setOrigin(0).setTileScale(1);
  const mid = scene.add.tileSprite(0, 0, W, H, k.midKey).setOrigin(0).setTileScale(1);
  const near = scene.add.tileSprite(0, 0, W, H, k.nearKey).setOrigin(0).setTileScale(1);
  scene.events.on('update', (_t: number, dt: number) => { far.tilePositionX += dt * 0.006; mid.tilePositionX += dt * 0.014; near.tilePositionX += dt * 0.03; });
  if (dim > 0) scene.add.rectangle(0, 0, W, H, 0x000000, dim).setOrigin(0);
  scene.add.image(0, 0, 'vignette').setOrigin(0).setDisplaySize(W, H).setAlpha(0.8);
}

/** Request fullscreen + landscape lock on mobile (must be inside a user gesture). */
export function goFullscreen(scene: Phaser.Scene) {
  try {
    if (!scene.scale.isFullscreen && scene.sys.game.device.input.touch) {
      scene.scale.startFullscreen();
      const o: any = (screen as any).orientation;
      o?.lock?.('landscape')?.catch?.(() => {});
    }
  } catch { /* not supported */ }
}
