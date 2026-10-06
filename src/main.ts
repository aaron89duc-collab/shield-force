import Phaser from 'phaser';
import { BootScene, SheetScene, MenuScene, LevelSelectScene, UpgradeScene, SettingsScene, CreditsScene } from './scenes/menus';
import { GameScene } from './scenes/game';
import { HUDScene } from './scenes/hud';
import { ShopScene } from './scenes/shop';
import { suspendAudio } from './systems/sound';
import { Z } from './art/pen';
import { FONT_TITLE, loadFonts, TEST_STRING } from './fonts';

// All textures are drawn at Z× resolution; images/tile-sprites/text default to that density.
{
  const F = Phaser.GameObjects.GameObjectFactory.prototype as any;
  const oImage = F.image, oTile = F.tileSprite, oText = F.text;
  F.image = function (x: number, y: number, key: string, frame?: string) { return oImage.call(this, x, y, key, frame).setScale(1 / Z); };
  F.tileSprite = function (x: number, y: number, w: number, h: number, key: string, frame?: string) { return oTile.call(this, x, y, w, h, key, frame).setTileScale(1 / Z); };
  F.text = function (x: number, y: number, t: string, style?: any) {
    const st = { resolution: Z, testString: TEST_STRING, padding: { left: 2, right: 2, top: 4, bottom: 3 }, ...(style || {}) };
    if (st.fontFamily === FONT_TITLE) {
      if (!st.fontStyle) st.fontStyle = '800';
      // Baloo 2 has a smaller x-height than Arial Black: scale up so layouts keep the same visual size
      const m = /^(\d+(?:\.\d+)?)px$/.exec(String(st.fontSize ?? ''));
      if (m) st.fontSize = `${Math.round(Number(m[1]) * 1.12)}px`;
    }
    return oText.call(this, x, y, t, st);
  };
}

/** Virtual height is fixed at 540 px (11.25 world units); width follows the device aspect (16:9 … 21:9; narrower screens are letterboxed). */
const H = 540;
function widthFor() {
  const aspect = Math.min(2.4, Math.max(16 / 9, window.innerWidth / Math.max(1, window.innerHeight)));
  return Math.round(H * aspect) * Z;
}

function startGame() {
return new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b1020',
  width: widthFor(),
  height: H * Z,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 5 },
  render: { antialias: true, powerPreference: 'high-performance' },
  fps: { target: 60 },
  scene: [BootScene, SheetScene, MenuScene, LevelSelectScene, UpgradeScene, SettingsScene, CreditsScene, GameScene, HUDScene, ShopScene],
});
}

let game!: Phaser.Game;
loadFonts().then(() => { game = startGame(); (window as any).__game = game; });

// Re-fit the virtual width when the device rotates / window resizes.
let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    const w = widthFor();
    if (Math.abs(w - game.scale.width) > 8 && window.innerWidth > window.innerHeight) {
      game.scale.setGameSize(w, H * Z);
      for (const s of game.scene.getScenes(true)) {
        if (['Menu', 'LevelSelect', 'Upgrade', 'Settings', 'Credits', 'Shop'].includes(s.scene.key)) s.scene.restart();
      }
    }
  }, 150);
});

document.addEventListener('visibilitychange', () => {
  suspendAudio(document.hidden);
  if (document.hidden) {
    const gs = game.scene.getScene('Game') as GameScene | null;
    if (gs && gs.scene.isActive() && gs.world && gs.world.state !== 3) gs.setPaused(true); // pause never loses the checkpoint
  }
});

