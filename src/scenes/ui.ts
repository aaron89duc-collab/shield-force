import Phaser from 'phaser';
import { play, Sfx, unlockAudio } from '../systems/sound';

export const FONT = 'Arial Black, Arial, Helvetica, sans-serif';
export const FONT2 = 'Arial, Helvetica, sans-serif';

export function txt(scene: Phaser.Scene, x: number, y: number, s: string, size: number, color = '#ffffff', bold = true) {
  return scene.add.text(x, y, s, {
    fontFamily: bold ? FONT : FONT2, fontSize: `${size}px`, color, align: 'center',
    stroke: '#000000', strokeThickness: Math.max(2, Math.round(size / 8)),
  }).setOrigin(0.5);
}

export interface Btn { box: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; setEnabled(v: boolean): void; setText(s: string): void; }

export function button(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, onClick: () => void, color = 0x2bb3a0, size = 22): Btn {
  const box = scene.add.rectangle(x, y, w, h, color, 0.92).setStrokeStyle(3, 0xffffff, 0.8).setInteractive({ useHandCursor: true });
  const t = txt(scene, x, y, label, size);
  let enabled = true;
  box.on('pointerdown', () => { if (!enabled) return; unlockAudio(); box.setScale(0.96); t.setScale(0.96); });
  box.on('pointerout', () => { box.setScale(1); t.setScale(1); });
  box.on('pointerup', () => {
    box.setScale(1); t.setScale(1);
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

/** Animated menu backdrop using a level theme. */
export function backdrop(scene: Phaser.Scene, theme = 0) {
  const W = scene.scale.width, H = scene.scale.height;
  const g = scene.add.graphics();
  const th = [[0x0b1030, 0x3a2a5a]][0];
  g.fillGradientStyle(th[0], th[0], th[1], th[1], 1);
  g.fillRect(0, 0, W, H);
  const far = scene.add.tileSprite(0, 0, W, H, `bg_far_${theme}`).setOrigin(0).setAlpha(0.9);
  const near = scene.add.tileSprite(0, 0, W, H, `bg_near_${theme}`).setOrigin(0);
  scene.events.on('update', (_t: number, dt: number) => { far.tilePositionX += dt * 0.01; near.tilePositionX += dt * 0.03; });
  scene.add.rectangle(0, 0, W, H, 0x000000, 0.35).setOrigin(0);
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
