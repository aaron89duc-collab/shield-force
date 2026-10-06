import Phaser from 'phaser';
import { buildTextures } from '../art/textures';
import { darkenC, ensureBackgrounds, THEMES } from '../art/themes';
import { LEVEL_INFO } from '../game/levels';
import { LEVEL_COUNT, persist, resetSave, save, UPGRADE_COST, MAX_HP, SHIELD_DMG, MOVE_SPEED, THROW_DMG, ULT_DMG } from '../systems/save';
import { play, Sfx, unlockAudio, updateMusic } from '../systems/sound';
import { fmtTime } from '../game/util';
import { backdrop, button, FONT2, goFullscreen, txt } from './ui';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() {
    const W = this.scale.width, H = this.scale.height;
    const t = txt(this, W / 2, H / 2, 'Đang tải...', 26);
    this.time.delayedCall(30, () => {
      buildTextures(this);
      for (let i = 0; i < THEMES.length; i++) ensureBackgrounds(this, i);
      t.destroy();
      const q = new URLSearchParams(location.search);
      const lv = Number(q.get('level'));
      if (lv >= 1 && lv <= LEVEL_COUNT && (q.has('bot') || q.has('dev'))) this.scene.start('Game', { level: lv });
      else this.scene.start('Menu');
    });
  }
}

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }
  create() {
    const W = this.scale.width, H = this.scale.height;
    backdrop(this, 0);
    const shield = this.add.image(W / 2 - 250, 110, 'shield').setScale(2.6);
    this.tweens.add({ targets: shield, angle: 360, duration: 6000, repeat: -1 });
    txt(this, W / 2 + 20, 92, 'SHIELD FORCE', 64, '#ffffff').setShadow(0, 6, '#1fa58f', 0, true, true);
    txt(this, W / 2 + 20, 148, '2D Run-and-Gun Action Platformer', 18, '#9fe8dc', false);
    const hero = this.add.image(W / 2 - 300, H - 70, 'hero_victory').setScale(2).setOrigin(0.5, 1);
    this.tweens.add({ targets: hero, y: H - 76, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    const cx = W / 2 + 80;
    const next = Math.min(save.highestUnlockedLevel, LEVEL_COUNT);
    button(this, cx, 215, 300, 54, `▶  CHƠI — MÀN ${next}`, () => { goFullscreen(this); this.scene.start('Game', { level: next }); }, 0xe8553b, 24);
    button(this, cx, 280, 300, 46, 'CHỌN MÀN', () => this.scene.start('LevelSelect'), 0x2b6fb3);
    button(this, cx, 336, 300, 46, 'NÂNG CẤP', () => this.scene.start('Upgrade'), 0x2bb3a0);
    button(this, cx, 392, 300, 46, 'CÀI ĐẶT', () => this.scene.start('Settings'), 0x5a5f78);
    button(this, cx, 448, 300, 46, 'CREDITS', () => this.scene.start('Credits'), 0x5a5f78);
    txt(this, W - 16, H - 16, `💰 ${save.coins}`, 20, '#f2c94c').setOrigin(1, 1);
    txt(this, 16, H - 14, 'v1.0 • Phaser + TypeScript', 13, '#8890a8', false).setOrigin(0, 1);
    this.input.once('pointerdown', () => unlockAudio());
  }
}

export class LevelSelectScene extends Phaser.Scene {
  constructor() { super('LevelSelect'); }
  create() {
    const W = this.scale.width, H = this.scale.height;
    backdrop(this, 2);
    txt(this, W / 2, 44, 'CHỌN MÀN', 38);
    const cols = 5, cw = Math.min(170, (W - 80) / cols), ch = 150;
    const x0 = W / 2 - (cols - 1) * cw / 2;
    for (let i = 0; i < LEVEL_COUNT; i++) {
      const n = i + 1;
      const x = x0 + (i % cols) * cw, y = 150 + Math.floor(i / cols) * (ch + 14);
      const unlocked = n <= save.highestUnlockedLevel;
      const done = save.completedLevels.includes(n);
      const th = THEMES[i];
      const card = this.add.rectangle(x, y, cw - 16, ch, unlocked ? darkenC(th.skyBot, 0.45) : 0x222630, 1).setStrokeStyle(3, done ? 0xf2c94c : 0xffffff, unlocked ? 0.9 : 0.3);
      this.add.image(x, y + 6, `bg_near_${i}`).setDisplaySize(cw - 22, ch - 30).setAlpha(unlocked ? 0.5 : 0.12).setCrop(0, 200, 1024, 340);
      txt(this, x, y - 46, `${n}`, 34, unlocked ? '#ffffff' : '#666a78');
      const name = this.add.text(x, y - 6, LEVEL_INFO[i].name, { fontFamily: FONT2, fontSize: '14px', color: unlocked ? '#ffffff' : '#666a78', align: 'center', wordWrap: { width: cw - 26 }, stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
      void name;
      txt(this, x, y + 30, unlocked ? `Boss: ${LEVEL_INFO[i].boss}` : '🔒 Khóa', 12, unlocked ? '#ffd36a' : '#666a78', false);
      if (done) txt(this, x, y + 54, `★ ${fmtTime(save.bestTime[i])}`, 14, '#f2c94c');
      if (unlocked) {
        card.setInteractive({ useHandCursor: true }).on('pointerup', () => { unlockAudio(); play(Sfx.CLICK); goFullscreen(this); this.scene.start('Game', { level: n }); });
      }
    }
    button(this, 90, H - 40, 140, 44, '◀ QUAY LẠI', () => this.scene.start('Menu'), 0x5a5f78, 18);
  }
}

export class UpgradeScene extends Phaser.Scene {
  constructor() { super('Upgrade'); }
  create() {
    const W = this.scale.width, H = this.scale.height;
    backdrop(this, 1);
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
    const W = this.scale.width, H = this.scale.height;
    backdrop(this, 4);
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
    const W = this.scale.width, H = this.scale.height;
    backdrop(this, 7);
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
