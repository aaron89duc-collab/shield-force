import Phaser from 'phaser';
import { buildTextures } from '../art/textures';
import { ensureBackgrounds, THEMES } from '../art/themes';
import { LEVEL_INFO } from '../game/levels';
import { LEVEL_COUNT, persist, resetSave, save, UPGRADE_COST, MAX_HP, SHIELD_DMG, MOVE_SPEED, THROW_DMG, ULT_DMG } from '../systems/save';
import { play, Sfx, unlockAudio, updateMusic } from '../systems/sound';
import { fmtTime } from '../game/util';
import { backdrop, button, FONT2, goFullscreen, initCam, txt, VH, VW } from './ui';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    initCam(this);
    const W = VW(this), H = VH(this);
    const bar = this.add.graphics();
    const t = txt(this, W / 2, H / 2 - 30, 'SHIELD FORCE', 30, '#ffe28a');
    this.load.on('progress', (v: number) => { bar.clear(); bar.fillStyle(0x1fb59b); bar.fillRect(W / 2 - 150, H / 2 + 10, 300 * v, 10); bar.lineStyle(2, 0xffffff); bar.strokeRect(W / 2 - 150, H / 2 + 10, 300, 10); });
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
      else if (lv >= 1 && lv <= LEVEL_COUNT && (q.has('bot') || q.has('dev'))) this.scene.start('Game', { level: lv });
      else this.scene.start('Menu');
    });
  }
}

/** Dev-only sprite sheet viewer (?sheet). */
export class SheetScene extends Phaser.Scene {
  constructor() { super('Sheet'); }
  create() {
    initCam(this);
    const q = new URLSearchParams(location.search);
    const pre = q.get('sheet') || 'hero_';
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
    backdrop(this, 0, 0.15);
    // ground strip + spotlight for the hero
    const g = this.add.graphics();
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.75, 0.75); g.fillRect(0, H * 0.55, W, H * 0.45);
    const hx = Math.max(170, W * 0.25);
    this.add.image(hx, H - 150, 'glow').setScale(9).setTint(0x1fb59b).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    g.fillStyle(0x000000, 0.45); g.fillEllipse(hx, H - 22, 230, 30);
    const hero = this.add.image(hx, H - 18, 'hero_portrait').setOrigin(52 / 112, 122 / 128);
    this.tweens.add({ targets: hero, y: H - 26, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // floating sparks
    for (let i = 0; i < 18; i++) {
      const sp = this.add.image(Math.random() * W, H + 10, 'spark').setBlendMode(Phaser.BlendModes.ADD).setTint(i % 2 ? 0xffd890 : 0x7fffe0).setAlpha(0.8);
      this.tweens.add({ targets: sp, y: -20, x: '+=' + (Math.random() * 80 - 40), duration: 5000 + Math.random() * 5000, delay: Math.random() * 6000, repeat: -1 });
    }
    const cx = Math.min(W - 190, W * 0.66);
    const logo = this.add.image(cx, 88, 'logo');
    this.tweens.add({ targets: logo, scale: logo.scale * 1.03, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const next = Math.min(save.highestUnlockedLevel, LEVEL_COUNT);
    button(this, cx, 205, 310, 56, `▶  CHƠI — MÀN ${next}`, () => { goFullscreen(this); this.scene.start('Game', { level: next }); }, 0xe8553b, 24);
    button(this, cx, 272, 310, 46, 'CHỌN MÀN', () => this.scene.start('LevelSelect'), 0x2b6fb3);
    button(this, cx, 328, 310, 46, 'NÂNG CẤP', () => this.scene.start('Upgrade'), 0x22a08c);
    button(this, cx - 79, 386, 152, 46, 'CÀI ĐẶT', () => this.scene.start('Settings'), 0x5a5f78, 18);
    button(this, cx + 79, 386, 152, 46, 'CREDITS', () => this.scene.start('Credits'), 0x5a5f78, 18);
    txt(this, cx, 440, `💰 ${save.coins}    ★ ${save.completedLevels.length}/${LEVEL_COUNT}`, 20, '#f2c94c');
    txt(this, W - 12, H - 12, 'v1.1', 12, '#8890a8', false).setOrigin(1, 1);
    this.input.once('pointerdown', () => unlockAudio());
  }
}

export class LevelSelectScene extends Phaser.Scene {
  constructor() { super('LevelSelect'); }
  create() {
    initCam(this);
    const W = VW(this), H = VH(this);
    backdrop(this, 0, 0.45);
    txt(this, W / 2, 40, 'CHỌN MÀN', 36, '#ffe28a');
    const cols = 5, cw = Math.min(176, (W - 60) / cols), ch = 158;
    const x0 = W / 2 - (cols - 1) * cw / 2;
    for (let i = 0; i < LEVEL_COUNT; i++) {
      const n = i + 1;
      const x = x0 + (i % cols) * cw, y = 150 + Math.floor(i / cols) * (ch + 14);
      const unlocked = n <= save.highestUnlockedLevel;
      const done = save.completedLevels.includes(n);
      const th = THEMES[i];
      const w = cw - 14, l = x - w / 2, tp = y - ch / 2;
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.5); g.fillRoundedRect(l + 3, tp + 5, w, ch, 12);
      if (unlocked) { g.fillGradientStyle(th.skyTop, th.skyTop, th.skyBot, th.skyBot, 1); } else g.fillStyle(0x222630);
      g.fillRoundedRect(l, tp, w, ch, 12);
      if (unlocked) {
        g.fillStyle(th.near, 0.9); for (let k = 0; k < 5; k++) g.fillTriangle(l + k * w / 4 - 30, tp + ch - 34, l + k * w / 4, tp + ch - 70 - (k % 2) * 20, l + k * w / 4 + 30, tp + ch - 34);
        g.fillStyle(th.ground); g.fillRect(l, tp + ch - 34, w, 22); g.fillStyle(th.groundTop); g.fillRect(l, tp + ch - 34, w, 5);
        g.fillStyle(0x000000, 0.45); g.fillRect(l, tp + ch - 12, w, 12);
      }
      g.lineStyle(3, done ? 0xf2c94c : 0x0d0f1a, 1); g.strokeRoundedRect(l, tp, w, ch, 12);
      txt(this, x, y - 52, `${n}`, 34, unlocked ? '#ffffff' : '#666a78');
      this.add.text(x, y - 14, LEVEL_INFO[i].name, { fontFamily: FONT2, fontSize: '14px', fontStyle: 'bold', color: unlocked ? '#ffffff' : '#666a78', align: 'center', wordWrap: { width: w - 12 }, stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);
      txt(this, x, y + 14, unlocked ? `Boss: ${LEVEL_INFO[i].boss}` : '🔒 Khóa', 12, unlocked ? '#ffd36a' : '#666a78', false);
      if (done) txt(this, x, y + 68, `★ ${fmtTime(save.bestTime[i])}`, 13, '#f2c94c');
      if (unlocked) {
        const zone = this.add.zone(x, y, w, ch).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => g.setAlpha(0.8));
        zone.on('pointerout', () => g.setAlpha(1));
        zone.on('pointerup', () => { unlockAudio(); play(Sfx.CLICK); goFullscreen(this); this.scene.start('Game', { level: n }); });
      }
    }
    button(this, 90, H - 36, 140, 44, '◀ QUAY LẠI', () => this.scene.start('Menu'), 0x5a5f78, 18);
  }
}

export class UpgradeScene extends Phaser.Scene {
  constructor() { super('Upgrade'); }
  create() {
    initCam(this);
    const W = VW(this), H = VH(this);
    backdrop(this, 0, 0.5);
    txt(this, W / 2, 40, 'NÂNG CẤP', 38);
    const coinT = txt(this, W - 20, 40, '', 24, '#f2c94c').setOrigin(1, 0.5);
    const rows: { name: string; key: 'hpUpgrade' | 'shieldUpgrade' | 'speedUpgrade' | 'throwUpgrade' | 'ultimateUpgrade'; vals: string[] }[] = [
      { name: 'Máu tối đa', key: 'hpUpgrade', vals: MAX_HP.map(String) },
      { name: 'Sát thương khiên', key: 'shieldUpgrade', vals: SHIELD_DMG.map(v => Math.round(v * 100) + '%') },
      { name: 'Tốc độ chạy', key: 'speedUpgrade', vals: MOVE_SPEED.map(v => v.toFixed(1)) },
      { name: 'Ném khiên', key: 'throwUpgrade', vals: THROW_DMG.map(String) },
      { name: 'Đòn tối thượng', key: 'ultimateUpgrade', vals: ULT_DMG.map(String) },
    ];
    const refreshers: (() => void)[] = [];
    rows.forEach((r, i) => {
      const y = 110 + i * 74;
      this.add.rectangle(W / 2, y, Math.min(820, W - 40), 64, 0x10142a, 0.75).setStrokeStyle(2, 0xffffff, 0.25);
      const left = W / 2 - Math.min(820, W - 40) / 2;
      this.add.text(left + 20, y, r.name, { fontFamily: FONT2, fontSize: '20px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0, 0.5);
      const pips = this.add.graphics();
      const valT = this.add.text(left + 380, y, '', { fontFamily: FONT2, fontSize: '18px', color: '#9fe8dc' }).setOrigin(0, 0.5);
      const btn = button(this, left + Math.min(820, W - 40) - 110, y, 190, 46, '', () => {
        const lv = save[r.key];
        if (lv >= 5) return;
        const cost = UPGRADE_COST[lv];
        if (save.coins < cost) { play(Sfx.HURT); return; }
        save.coins -= cost; save[r.key] = lv + 1; persist();
        play(Sfx.PICKUP);
        refreshAll();
      }, 0x2bb3a0, 17);
      refreshers.push(() => {
        const lv = save[r.key];
        pips.clear();
        for (let k = 0; k < 5; k++) { pips.fillStyle(k < lv ? 0x2bd67b : 0x3a3f55); pips.fillRoundedRect(left + 220 + k * 30, y - 10, 24, 20, 4); }
        valT.setText(lv < 5 ? `${r.vals[lv - 1]} → ${r.vals[lv]}` : `${r.vals[4]} (MAX)`);
        if (lv >= 5) { btn.setText('TỐI ĐA'); btn.setEnabled(false); }
        else { btn.setText(`💰 ${UPGRADE_COST[lv]}`); btn.setEnabled(save.coins >= UPGRADE_COST[lv]); }
      });
    });
    const refreshAll = () => { coinT.setText(`💰 ${save.coins}`); refreshers.forEach(f => f()); };
    refreshAll();
    txt(this, W / 2, H - 40, 'Mỗi màn thưởng 100–300 xu + xu nhặt được trong màn', 15, '#c0c8e0', false);
    button(this, 90, H - 40, 140, 44, '◀ QUAY LẠI', () => this.scene.start('Menu'), 0x5a5f78, 18);
  }
}

export class SettingsScene extends Phaser.Scene {
  constructor() { super('Settings'); }
  create() {
    initCam(this);
    const W = VW(this), H = VH(this);
    backdrop(this, 0, 0.5);
    txt(this, W / 2, 44, 'CÀI ĐẶT', 38);
    const layouts = ['Mặc định', 'Đảo trái/phải', 'Nút lớn'];
    const items: { label: () => string; act: () => void }[] = [
      { label: () => `Âm thanh: ${save.soundEnabled ? 'BẬT' : 'TẮT'}`, act: () => { save.soundEnabled = !save.soundEnabled; } },
      { label: () => `Nhạc nền: ${save.musicEnabled ? 'BẬT' : 'TẮT'}`, act: () => { save.musicEnabled = !save.musicEnabled; unlockAudio(); updateMusic(); } },
      { label: () => `Rung (haptic): ${save.vibrationEnabled ? 'BẬT' : 'TẮT'}`, act: () => { save.vibrationEnabled = !save.vibrationEnabled; } },
      { label: () => `Bố cục nút: ${layouts[save.buttonLayout]}`, act: () => { save.buttonLayout = (save.buttonLayout + 1) % 3; } },
      { label: () => `Toàn màn hình: ${this.scale.isFullscreen ? 'BẬT' : 'TẮT'}`, act: () => { if (this.scale.isFullscreen) this.scale.stopFullscreen(); else this.scale.startFullscreen(); } },
    ];
    items.forEach((it, i) => {
      const b = button(this, W / 2, 105 + i * 56, 420, 46, it.label(), () => { it.act(); persist(); this.time.delayedCall(60, () => b.setText(it.label())); }, 0x2b6fb3, 20);
    });
    let confirm = false;
    const rb = button(this, W / 2, 105 + items.length * 56 + 12, 420, 44, 'Xóa toàn bộ tiến trình', () => {
      if (!confirm) { confirm = true; rb.setText('Nhấn lần nữa để XÁC NHẬN'); return; }
      resetSave(); this.scene.restart();
    }, 0x8a2a2a, 18);
    txt(this, W / 2 + 60, H - 70, 'Bàn phím: ←→↑↓/WASD di chuyển • J bắn • K/Space nhảy • L khiên • U smash • I special • Esc tạm dừng', 13, '#c0c8e0', false);
    button(this, 90, H - 40, 140, 44, '◀ QUAY LẠI', () => this.scene.start('Menu'), 0x5a5f78, 18);
  }
}

export class CreditsScene extends Phaser.Scene {
  constructor() { super('Credits'); }
  create() {
    initCam(this);
    const W = VW(this), H = VH(this);
    backdrop(this, 0, 0.5);
    txt(this, W / 2, 50, 'CREDITS', 38);
    const lines = [
      'SHIELD FORCE — prototype theo GDD v1.0',
      '',
      'Engine: Phaser 3 + TypeScript + Vite',
      'Hình ảnh & âm thanh: tạo thủ tục bằng code (placeholder, không dùng asset bản quyền)',
      'Nhân vật, quái vật, boss: thiết kế nguyên bản cho prototype',
      '',
      'Cảm hứng nhịp độ: các game run-and-gun cổ điển',
    ];
    lines.forEach((l, i) => txt(this, W / 2, 130 + i * 36, l, 18, '#ffffff', false));
    button(this, 90, H - 40, 140, 44, '◀ QUAY LẠI', () => this.scene.start('Menu'), 0x5a5f78, 18);
  }
}
