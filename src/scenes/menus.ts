import Phaser from 'phaser';
import { buildTextures } from '../art/textures';
import { buildHeroTextures, HERO_FX, HERO_FY, HERO_H, HERO_W } from '../art/hero';
import { resolveOutfit } from '../art/outfits';
import { ensureBackgrounds, THEMES } from '../art/themes';
import { LEVEL_INFO } from '../game/levels';
import { LEVEL_COUNT, persist, resetSave, save, UPGRADE_COST, MAX_HP, SHIELD_DMG, MOVE_SPEED, THROW_DMG, ULT_DMG } from '../systems/save';
import { play, Sfx, unlockAudio, updateMusic } from '../systems/sound';
import { fmtTime } from '../game/util';
import { backdrop, button, FONT, FONT2, goFullscreen, header, initCam, panel, txt, VH, VW } from './ui';

export const APP_NAME = 'Đậu Đậu - Đội trưởng Mỹ';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    initCam(this);
    const W = VW(this), H = VH(this);
    const bar = this.add.graphics();
    const t = txt(this, W / 2, H / 2 - 30, 'ĐẬU ĐẬU - ĐỘI TRƯỞNG MỸ', 28, '#ffe28a');
    this.load.on('progress', (v: number) => { bar.clear(); bar.fillStyle(0x1fb59b); bar.fillRoundedRect(W / 2 - 150, H / 2 + 10, 300 * v, 10, 5); bar.lineStyle(2, 0xffffff); bar.strokeRoundedRect(W / 2 - 150, H / 2 + 10, 300, 10, 5); });
    this.load.once('complete', () => { bar.destroy(); t.destroy(); });
    this.load.image('heroHead', 'hero-head.png');
  }
  create() {
    initCam(this);
    const W = VW(this), H = VH(this);
    const t = txt(this, W / 2, H / 2, 'Đang dựng đồ họa...', 22);
    this.time.delayedCall(30, () => {
      buildTextures(this);
      ensureBackgrounds(this, 0);
      t.destroy();
      const q = new URLSearchParams(location.search);
      const lv = Number(q.get('level'));
      if (q.has('sheet')) this.scene.start('Sheet');
      else if (q.has('scene')) this.scene.start(q.get('scene')!);
      else if (lv >= 1 && lv <= LEVEL_COUNT && (q.has('bot') || q.has('dev'))) this.scene.start('Game', { level: lv });
      else this.scene.start('Menu');
    });
  }
}

/** Dev-only sprite sheet viewer (?sheet=prefix). */
export class SheetScene extends Phaser.Scene {
  constructor() { super('Sheet'); }
  create() {
    initCam(this);
    const q = new URLSearchParams(location.search);
    const pre = q.get('sheet') || 'hero_';
    const of = q.get('outfit');
    if (of) { const [top, pants, shoes] = of.split(','); buildHeroTextures(this, resolveOutfit({ top, pants, shoes })); }
    const keys = this.textures.getTextureKeys().filter(k => k.startsWith(pre));
    const sc = Number(q.get('s') || 1.5);
    this.add.rectangle(0, 0, VW(this), VH(this), Number('0x' + (q.get('bg') || '3a4a6a'))).setOrigin(0);
    let x = 10, y = 10, rowH = 0;
    for (const k of keys) {
      const img = this.add.image(x, y, k).setOrigin(0);
      img.setScale(img.scaleX * sc);
      if (x + img.displayWidth > VW(this)) { x = 10; y += rowH + 4; rowH = 0; img.setPosition(x, y); }
      x += img.displayWidth + 4; rowH = Math.max(rowH, img.displayHeight);
    }
  }
}

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }
  create() {
    initCam(this);
    const W = VW(this), H = VH(this);
    backdrop(this, 0, 0.12);
    const g = this.add.graphics();
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.8, 0.8); g.fillRect(0, H * 0.5, W, H * 0.5);
    g.fillGradientStyle(0x050814, 0x050814, 0x050814, 0x050814, 0, 0.75, 0, 0.75); g.fillRect(W * 0.45, 0, W * 0.55, H);
    // hero spotlight
    const hx = Math.max(170, W * 0.24);
    this.add.image(hx, H - 170, 'glow').setScale(10).setTint(0x1fb59b).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    this.add.image(hx, H - 240, 'glow').setScale(6).setTint(0xffd890).setAlpha(0.25).setBlendMode(Phaser.BlendModes.ADD);
    g.fillStyle(0x000000, 0.5); g.fillEllipse(hx, H - 20, 240, 30);
    const hero = this.add.image(hx, H - 16, 'hero_portrait').setOrigin(HERO_FX / HERO_W, HERO_FY / HERO_H);
    this.tweens.add({ targets: hero, y: H - 24, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    for (let i = 0; i < 20; i++) {
      const sp = this.add.image(Math.random() * W, H + 10, 'spark').setBlendMode(Phaser.BlendModes.ADD).setTint(i % 2 ? 0xffd890 : 0x7fffe0).setAlpha(0.8);
      this.tweens.add({ targets: sp, y: -20, x: '+=' + (Math.random() * 80 - 40), duration: 5000 + Math.random() * 5000, delay: Math.random() * 6000, repeat: -1 });
    }
    const cx = Math.min(W - 200, W * 0.68);
    const logo = this.add.image(cx, 92, 'logo');
    logo.setScale(logo.scaleX * 0.82);
    this.tweens.add({ targets: logo, scale: logo.scale * 1.03, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const next = Math.min(save.highestUnlockedLevel, LEVEL_COUNT);
    const bw = 330, half = (bw - 10) / 2;
    button(this, cx, 214, bw, 58, `▶  CHƠI — MÀN ${next}`, () => { goFullscreen(this); this.scene.start('Game', { level: next }); }, 0xe8553b, 25);
    button(this, cx - half / 2 - 5, 282, half, 50, 'CHỌN MÀN', () => this.scene.start('LevelSelect'), 0x2b6fb3, 19);
    button(this, cx + half / 2 + 5, 282, half, 50, 'TỦ ĐỒ', () => this.scene.start('Shop'), 0xb04be8, 19);
    button(this, cx - half / 2 - 5, 342, half, 50, 'NÂNG CẤP', () => this.scene.start('Upgrade'), 0x22a08c, 19);
    button(this, cx + half / 2 + 5, 342, half, 50, 'CÀI ĐẶT', () => this.scene.start('Settings'), 0x5a5f78, 19);
    panel(this, cx, 412, bw, 46);
    this.add.image(cx - 120, 412, 'pu_7').setScale(0.9 / 2);
    this.add.text(cx - 100, 412, `${save.coins}`, { fontFamily: FONT, fontSize: '20px', color: '#ffe28a', stroke: '#000', strokeThickness: 4 }).setOrigin(0, 0.5);
    this.add.text(cx + 140, 412, `★ ${save.completedLevels.length}/${LEVEL_COUNT} màn`, { fontFamily: FONT, fontSize: '18px', color: '#ffffff', stroke: '#000', strokeThickness: 4 }).setOrigin(1, 0.5);
    const cr = this.add.text(cx, 462, 'Credits', { fontFamily: FONT2, fontSize: '15px', color: '#9fb0d0', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    cr.on('pointerup', () => { play(Sfx.CLICK); this.scene.start('Credits'); });
    txt(this, W - 10, H - 10, 'v1.2', 12, '#8890a8', false).setOrigin(1, 1);
    this.input.once('pointerdown', () => unlockAudio());
  }
}

export class LevelSelectScene extends Phaser.Scene {
  constructor() { super('LevelSelect'); }
  create() {
    initCam(this);
    const W = VW(this);
    backdrop(this, 0, 0.5);
    header(this, 'CHỌN MÀN');
    const cols = 5, cw = Math.min(180, (W - 40) / cols), ch = 190;
    const x0 = W / 2 - (cols - 1) * cw / 2;
    for (let i = 0; i < LEVEL_COUNT; i++) {
      const n = i + 1;
      const x = x0 + (i % cols) * cw, y = 190 + Math.floor(i / cols) * (ch + 16);
      const unlocked = n <= save.highestUnlockedLevel;
      const done = save.completedLevels.includes(n);
      const th = THEMES[i];
      const w = cw - 14, l = x - w / 2, tp = y - ch / 2;
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.5); g.fillRoundedRect(l + 3, tp + 6, w, ch, 14);
      if (unlocked) g.fillGradientStyle(th.skyTop, th.skyTop, th.skyBot, th.skyBot, 1); else g.fillStyle(0x1c2030);
      g.fillRoundedRect(l, tp, w, ch, 14);
      if (unlocked) {
        g.fillStyle(th.far, 0.9); for (let k = 0; k < 6; k++) g.fillRect(l + 6 + k * (w - 12) / 6, tp + ch - 80 - ((k * 37) % 30), (w - 12) / 6 - 3, 50);
        g.fillStyle(th.near, 0.95); for (let k = 0; k < 4; k++) { const mx = l + 20 + k * (w - 40) / 3; g.fillTriangle(mx - 20, tp + ch - 40, mx, tp + ch - 72 - (k % 2) * 14, mx + 20, tp + ch - 40); }
        g.fillStyle(th.ground); g.fillRect(l, tp + ch - 40, w, 26); g.fillStyle(th.groundTop); g.fillRect(l, tp + ch - 40, w, 5);
        g.fillStyle(0x000000, 0.55); g.fillRoundedRect(l, tp + ch - 30, w, 30, { tl: 0, tr: 0, bl: 14, br: 14 });
      }
      g.lineStyle(3, done ? 0xf2c94c : unlocked ? 0x7fd8cc : 0x3a3f55, 1); g.strokeRoundedRect(l, tp, w, ch, 14);
      g.fillStyle(0x0d0f1a, 0.85); g.fillCircle(x, tp + 30, 22); g.lineStyle(2.5, unlocked ? 0xffe28a : 0x555a6a); g.strokeCircle(x, tp + 30, 22);
      txt(this, x, tp + 30, `${n}`, 24, unlocked ? '#ffe28a' : '#666a78');
      this.add.text(x, tp + 72, LEVEL_INFO[i].name, { fontFamily: FONT2, fontSize: '14px', fontStyle: 'bold', color: unlocked ? '#ffffff' : '#666a78', align: 'center', wordWrap: { width: w - 12 }, stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);
      txt(this, x, tp + 100, unlocked ? `Boss: ${LEVEL_INFO[i].boss}` : '🔒 Khóa', 12, unlocked ? '#ffd36a' : '#666a78', false);
      txt(this, x, tp + ch - 15, done ? `★ ${fmtTime(save.bestTime[i])}` : unlocked ? 'CHƠI ▶' : '', 13, done ? '#f2c94c' : '#9ff0e2');
      if (unlocked) {
        const zone = this.add.zone(x, y, w, ch).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => g.setAlpha(0.8));
        zone.on('pointerout', () => g.setAlpha(1));
        zone.on('pointerup', () => { unlockAudio(); play(Sfx.CLICK); goFullscreen(this); this.scene.start('Game', { level: n }); });
      }
    }
  }
}

export class UpgradeScene extends Phaser.Scene {
  constructor() { super('Upgrade'); }
  create() {
    initCam(this);
    const W = VW(this), H = VH(this);
    backdrop(this, 0, 0.5);
    const setCoins = header(this, 'NÂNG CẤP');
    const rows: { name: string; desc: string; key: 'hpUpgrade' | 'shieldUpgrade' | 'speedUpgrade' | 'throwUpgrade' | 'ultimateUpgrade'; vals: string[]; color: number }[] = [
      { name: 'Máu tối đa', desc: 'Chịu đòn tốt hơn', key: 'hpUpgrade', vals: MAX_HP.map(String), color: 0x3bd67b },
      { name: 'Sát thương khiên', desc: 'Đạn khiên mạnh hơn', key: 'shieldUpgrade', vals: SHIELD_DMG.map(v => Math.round(v * 100) + '%'), color: 0x5fd8ff },
      { name: 'Tốc độ chạy', desc: 'Di chuyển nhanh hơn', key: 'speedUpgrade', vals: MOVE_SPEED.map(v => v.toFixed(1)), color: 0xf2c94c },
      { name: 'Ném khiên', desc: 'Boomerang mạnh hơn', key: 'throwUpgrade', vals: THROW_DMG.map(String), color: 0x2bb3a0 },
      { name: 'Đòn tối thượng', desc: 'Nổ năng lượng mạnh hơn', key: 'ultimateUpgrade', vals: ULT_DMG.map(String), color: 0xc06cff },
    ];
    const pw = Math.min(860, W - 30), left = W / 2 - pw / 2;
    const refreshers: (() => void)[] = [];
    rows.forEach((r, i) => {
      const y = 116 + i * 80;
      panel(this, W / 2, y, pw, 70);
      const g = this.add.graphics();
      g.fillStyle(r.color, 0.9); g.fillRoundedRect(left + 12, y - 22, 8, 44, 4);
      this.add.text(left + 32, y - 11, r.name, { fontFamily: FONT, fontSize: '19px', color: '#ffffff', stroke: '#000', strokeThickness: 3 }).setOrigin(0, 0.5);
      this.add.text(left + 32, y + 14, r.desc, { fontFamily: FONT2, fontSize: '13px', color: '#9fb0d0' }).setOrigin(0, 0.5);
      const pips = this.add.graphics();
      const valT = this.add.text(left + 420, y, '', { fontFamily: FONT, fontSize: '17px', color: '#9ff0e2', stroke: '#000', strokeThickness: 3 }).setOrigin(0, 0.5);
      const btn = button(this, left + pw - 96, y, 168, 48, '', () => {
        const lv = save[r.key];
        if (lv >= 5) return;
        const cost = UPGRADE_COST[lv];
        if (save.coins < cost) { play(Sfx.HURT); return; }
        save.coins -= cost; save[r.key] = lv + 1; persist();
        play(Sfx.PICKUP);
        refreshAll();
      }, 0xe8a13b, 17);
      refreshers.push(() => {
        const lv = save[r.key];
        pips.clear();
        for (let k = 0; k < 5; k++) { pips.fillStyle(k < lv ? r.color : 0x2a2f45); pips.fillRoundedRect(left + 250 + k * 30, y - 10, 24, 20, 5); pips.lineStyle(1.5, 0x0d0f1a); pips.strokeRoundedRect(left + 250 + k * 30, y - 10, 24, 20, 5); }
        valT.setText(lv < 5 ? `${r.vals[lv - 1]} → ${r.vals[lv]}` : `${r.vals[4]}  MAX`);
        if (lv >= 5) { btn.setText('TỐI ĐA'); btn.setEnabled(false); }
        else { btn.setText(`● ${UPGRADE_COST[lv]}`); btn.setEnabled(save.coins >= UPGRADE_COST[lv]); }
      });
    });
    const refreshAll = () => { setCoins(save.coins); refreshers.forEach(f => f()); };
    refreshAll();
    txt(this, W / 2, H - 22, 'Mỗi màn thưởng 100–300 xu + xu nhặt được trong màn', 14, '#c0c8e0', false);
  }
}

export class SettingsScene extends Phaser.Scene {
  constructor() { super('Settings'); }
  create() {
    initCam(this);
    const W = VW(this), H = VH(this);
    backdrop(this, 0, 0.5);
    header(this, 'CÀI ĐẶT');
    const layouts = ['Mặc định', 'Đảo trái/phải', 'Nút lớn'];
    const items: { name: string; value: () => string; act: () => void }[] = [
      { name: 'Âm thanh', value: () => (save.soundEnabled ? 'BẬT' : 'TẮT'), act: () => { save.soundEnabled = !save.soundEnabled; } },
      { name: 'Nhạc nền', value: () => (save.musicEnabled ? 'BẬT' : 'TẮT'), act: () => { save.musicEnabled = !save.musicEnabled; unlockAudio(); updateMusic(); } },
      { name: 'Rung (haptic)', value: () => (save.vibrationEnabled ? 'BẬT' : 'TẮT'), act: () => { save.vibrationEnabled = !save.vibrationEnabled; } },
      { name: 'Bố cục nút', value: () => layouts[save.buttonLayout], act: () => { save.buttonLayout = (save.buttonLayout + 1) % 3; } },
      { name: 'Toàn màn hình', value: () => (this.scale.isFullscreen ? 'BẬT' : 'TẮT'), act: () => { if (this.scale.isFullscreen) this.scale.stopFullscreen(); else this.scale.startFullscreen(); } },
    ];
    const pw = Math.min(560, W - 40);
    panel(this, W / 2, 128 + (items.length - 1) * 30, pw, items.length * 60 + 14);
    items.forEach((it, i) => {
      const y = 128 + i * 60;
      this.add.text(W / 2 - pw / 2 + 28, y, it.name, { fontFamily: FONT, fontSize: '19px', color: '#ffffff', stroke: '#000', strokeThickness: 3 }).setOrigin(0, 0.5);
      const on = () => it.value() === 'BẬT';
      const b = button(this, W / 2 + pw / 2 - 110, y, 180, 44, it.value(), () => {
        it.act(); persist();
        this.time.delayedCall(60, () => { b.setText(it.value()); b.box.setTint(on() ? 0x22a08c : 0x5a5f78); });
      }, on() ? 0x22a08c : 0x5a5f78, 18);
    });
    let confirm = false;
    const rb = button(this, W / 2, H - 92, 360, 44, 'Xóa toàn bộ tiến trình', () => {
      if (!confirm) { confirm = true; rb.setText('Nhấn lần nữa để XÁC NHẬN'); return; }
      resetSave(); buildHeroTextures(this, resolveOutfit(save.outfit)); this.scene.restart();
    }, 0x8a2a2a, 17);
    txt(this, W / 2, H - 40, 'Bàn phím: ←→↑↓/WASD di chuyển • J bắn • K/Space nhảy • L khiên • U smash • I special • Esc tạm dừng', 13, '#c0c8e0', false);
  }
}

export class CreditsScene extends Phaser.Scene {
  constructor() { super('Credits'); }
  create() {
    initCam(this);
    const W = VW(this);
    backdrop(this, 0, 0.5);
    header(this, 'CREDITS');
    panel(this, W / 2, 290, Math.min(760, W - 40), 330);
    const lines: [string, string][] = [
      [APP_NAME, '#ffe28a'],
      ['', ''],
      ['Game hành động bắn súng màn hình ngang 2D', '#ffffff'],
      ['Engine: Phaser 3 + TypeScript + Vite', '#ffffff'],
      ['Hình ảnh & âm thanh tạo bằng code', '#ffffff'],
      ['Nhân vật chính: Đậu Đậu', '#9ff0e2'],
      ['', ''],
      ['Trò chơi dành cho mục đích cá nhân / gia đình', '#9fb0d0'],
    ];
    lines.forEach(([l, c], i) => txt(this, W / 2, 150 + i * 36, l, i === 0 ? 26 : 17, c, i === 0));
  }
}
