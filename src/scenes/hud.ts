import Phaser from 'phaser';
import { TouchControls, safeInsets } from '../systems/controls';
import { WS } from '../game/world';
import { BS } from '../game/boss';
import { PU, PU_COLOR, PU_LETTER, PU_NAME } from '../game/entities';
import { persist, save, LEVEL_COUNT } from '../systems/save';
import { updateMusic, unlockAudio } from '../systems/sound';
import { fmtTime } from '../game/util';
import { LEVEL_INFO } from '../game/levels';
import { button, Btn, FONT, FONT2, initCam, panel, txt, VH, VW } from './ui';
import type { GameScene } from './game';
import { lighten } from '../art/pen';

interface VictoryInfo { time: number; deaths: number; coins: number; reward: number; total: number; kills: number; }

/** HUD (GDD §13): HP, Ultimate meter, coins, pause, boss bar, banners, pause/victory overlays + touch controls. */
export class HUDScene extends Phaser.Scene {
  gs!: GameScene;
  controls!: TouchControls;
  private g!: Phaser.GameObjects.Graphics;
  private face!: Phaser.GameObjects.Image;
  private hpT!: Phaser.GameObjects.Text;
  private coinT!: Phaser.GameObjects.Text;
  private coinIcon!: Phaser.GameObjects.Image;
  private bossT!: Phaser.GameObjects.Text;
  private bannerT!: Phaser.GameObjects.Text;
  private bannerSub!: Phaser.GameObjects.Text;
  private hintT!: Phaser.GameObjects.Text;
  private respawnT!: Phaser.GameObjects.Text;
  private toastT!: Phaser.GameObjects.Text;
  private toastTime = 0;
  private puTexts: Phaser.GameObjects.Text[] = [];
  private pauseLayer: Phaser.GameObjects.GameObject[] = [];
  private victoryLayer: Phaser.GameObjects.GameObject[] = [];
  private insetL = 0; private insetR = 0; private insetT = 0;
  private touch = true;
  private pauseZone!: Phaser.GameObjects.Zone;

  constructor() { super('HUD'); }

  init(data: { game: GameScene }) { this.gs = data.game; this.pauseLayer = []; this.victoryLayer = []; this.puTexts = []; }

  create() {
    initCam(this);
    this.touch = this.sys.game.device.input.touch || new URLSearchParams(location.search).has('touch');
    this.add.image(0, 0, 'vignette').setOrigin(0).setDisplaySize(VW(this), VH(this)).setAlpha(0.55).setDepth(0);
    this.g = this.add.graphics().setDepth(5);
    this.face = this.add.image(0, 0, 'heroHead').setDisplaySize(38, 46).setDepth(6);
    const st = (size: number, color = '#ffffff') => ({ fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#000000', strokeThickness: 4 });
    this.hpT = this.add.text(0, 0, '', st(14)).setDepth(6);
    this.coinT = this.add.text(0, 0, '', st(18, '#ffe28a')).setDepth(6);
    this.coinIcon = this.add.image(0, 0, 'pu_7').setScale(0.75 / 2).setDepth(6);
    this.bossT = this.add.text(0, 0, '', st(16)).setOrigin(0.5, 1).setDepth(6);
    this.bannerT = this.add.text(0, 0, '', st(48)).setOrigin(0.5).setDepth(20);
    this.bannerSub = this.add.text(0, 0, '', st(20, '#9fe8dc')).setOrigin(0.5).setDepth(20);
    this.hintT = this.add.text(0, 0, '', { fontFamily: FONT2, fontSize: '17px', color: '#ffffff', backgroundColor: '#000000aa', padding: { x: 12, y: 6 }, align: 'center' }).setOrigin(0.5).setDepth(19);
    this.respawnT = this.add.text(0, 0, 'Đang hồi sinh...', st(34)).setOrigin(0.5).setDepth(20).setVisible(false);
    this.toastT = this.add.text(0, 0, '', st(22, '#7fffe0')).setOrigin(0.5).setDepth(20).setAlpha(0);
    for (let i = 0; i < 5; i++) this.puTexts.push(this.add.text(0, 0, '', st(13)).setDepth(6));

    this.controls = new TouchControls(this);
    this.controls.setVisible(this.touch);
    this.pauseZone = this.add.zone(0, 0, 70, 60).setOrigin(0.5).setInteractive().setDepth(30);
    this.pauseZone.on('pointerup', () => { if (!this.gs.paused && this.gs.world.state !== WS.Complete) this.gs.setPaused(true); });
    const kb = this.input.keyboard;
    kb?.on('keydown-ESC', () => this.togglePause());
    kb?.on('keydown-P', () => this.togglePause());
    this.relayout();
    this.scale.on('resize', this.relayout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.relayout, this));
    this.input.on('pointerdown', () => unlockAudio());
  }

  private togglePause() {
    if (this.gs.world.state === WS.Complete) return;
    this.gs.setPaused(!this.gs.paused);
  }

  private relayout() {
    const W = VW(this), H = VH(this);
    const ins = safeInsets();
    const k = H / Math.max(1, window.innerHeight);
    this.insetL = Math.min(60, ins.left * k + 8); this.insetR = Math.min(60, ins.right * k + 8); this.insetT = ins.top * k;
    this.controls.layout(W, H, this.insetL, this.insetR, save.buttonLayout);
    this.pauseZone.setPosition(W - this.insetR - 34, 34);
    this.bannerT.setPosition(W / 2, H * 0.4);
    this.bannerSub.setPosition(W / 2, H * 0.4 + 44);
    this.respawnT.setPosition(W / 2, H * 0.42);
    this.toastT.setPosition(W / 2, 160);
    this.hintT.setPosition(W / 2, this.touch ? 108 : H - 40);
    this.hintT.setWordWrapWidth(Math.min(700, W - 80));
  }

  update(time: number, delta: number) {
    const w = this.gs.world;
    if (!w) return;
    const W = VW(this), H = VH(this), p = w.player;
    const g = this.g;
    g.clear();

    // screen flash / sandstorm
    if (w.flashT > 0) { g.fillStyle(w.flashColor, Math.min(0.6, w.flashT * 2)); g.fillRect(0, 0, W, H); }
    if (w.storming) {
      g.fillStyle(0xd8a860, 0.32); g.fillRect(0, 0, W, H);
      g.fillStyle(0xfff0c0, 0.5);
      for (let i = 0; i < 40; i++) { const x = (W - ((time * 0.9 + i * 137) % (W + 200))), y = (i * 53) % H; g.fillRect(x, y, 40, 2); }
    }

    // HP + ultimate
    const x0 = this.insetL + 12, y0 = 14, bx0 = x0 + 62, bw0 = 200;
    g.fillStyle(0x000000, 0.5); g.fillRoundedRect(x0 - 6, y0 - 8, bw0 + 82, 62, 12);
    g.lineStyle(2, 0x1fb59b, 0.6); g.strokeRoundedRect(x0 - 6, y0 - 8, bw0 + 82, 62, 12);
    // portrait frame
    const hurtFlash = p.hurtT > 0 || p.dead;
    g.fillStyle(hurtFlash ? 0xe84a3b : 0x1fb59b); g.fillCircle(x0 + 24, y0 + 22, 27);
    g.fillStyle(0x0d1630); g.fillCircle(x0 + 24, y0 + 22, 24);
    this.face.setPosition(x0 + 24, y0 + 24).setTint(hurtFlash ? 0xff8080 : 0xffffff);
    const hpf = Math.max(0, p.hp / p.maxHp);
    const hpc = hpf > 0.5 ? 0x3bd67b : hpf > 0.25 ? 0xf2c94c : 0xe84a3b;
    g.fillStyle(0x2a0c10); g.fillRoundedRect(bx0, y0, bw0, 18, 5);
    if (hpf > 0) { g.fillGradientStyle(lighten(hpc, 0.35), lighten(hpc, 0.35), hpc, hpc, 1); g.fillRoundedRect(bx0, y0, Math.max(10, bw0 * hpf), 18, 5); }
    g.fillStyle(0x000000, 0.35); for (let k = 1; k < 10; k++) g.fillRect(bx0 + k * bw0 / 10, y0 + 2, 1.5, 14);
    g.lineStyle(2, 0x0d0f1a, 1); g.strokeRoundedRect(bx0, y0, bw0, 18, 5);
    this.hpT.setText(`${Math.max(0, Math.ceil(p.hp))}/${p.maxHp}`).setPosition(bx0 + 6, y0 + 1);
    const uf = p.ult / 100;
    g.fillStyle(0x140a24); g.fillRoundedRect(bx0, y0 + 25, bw0, 12, 4);
    if (uf > 0) { const uc = uf >= 1 ? (Math.floor(time / 120) % 2 ? 0xf0c0ff : 0xc06cff) : 0x9a4be8; g.fillGradientStyle(lighten(uc, 0.4), lighten(uc, 0.4), uc, uc, 1); g.fillRoundedRect(bx0, y0 + 25, Math.max(8, bw0 * uf), 12, 4); }
    g.lineStyle(2, 0x0d0f1a, 1); g.strokeRoundedRect(bx0, y0 + 25, bw0, 12, 4);
    this.coinT.setText(`${save.coins + (w.rewarded ? 0 : w.coinsEarned)}`).setPosition(x0 + 20, y0 + 59);
    this.coinIcon.setPosition(x0 + 8, y0 + 71);

    // power-ups
    const pus: [PU, number][] = [];
    if (p.weapon === 1) pus.push([PU.DOUBLE, p.weaponT]);
    if (p.weapon === 2) pus.push([PU.TRIPLE, p.weaponT]);
    if (p.superT > 0) pus.push([PU.SUPER, p.superT]);
    if (p.plasmaT > 0) pus.push([PU.PLASMA, p.plasmaT]);
    if (p.bombT > 0) pus.push([PU.BOMB, p.bombT]);
    for (let i = 0; i < 5; i++) {
      const tt = this.puTexts[i];
      if (i < pus.length) {
        const [type, tm] = pus[i];
        const px = x0 + 310 + i * 62, py = y0 + 14;
        g.fillStyle(PU_COLOR[type], 0.9); g.fillRoundedRect(px - 14, py - 14, 28, 28, 8);
        tt.setText(`${PU_LETTER[type]} ${Math.ceil(tm)}`).setPosition(px - 10, py - 8).setVisible(true);
      } else tt.setVisible(false);
    }

    // pause button
    const pbx = W - this.insetR - 34;
    g.fillStyle(0x000000, 0.5); g.fillCircle(pbx, 34, 24);
    g.fillStyle(0xffffff, 0.9); g.fillRect(pbx - 8, 24, 6, 20); g.fillRect(pbx + 2, 24, 6, 20);

    // boss bar (top-center, phase markers at 66/33 or 50)
    const b = w.boss;
    if (b && !(b.state === BS.DEAD && b.deathT > 1)) {
      const bw = Math.min(460, W - 2 * (this.insetL + 290) + 140), bx = W / 2 - bw / 2, by = 60;
      g.fillStyle(0x000000, 0.6); g.fillRoundedRect(bx - 6, by - 6, bw + 12, 26, 6);
      g.fillStyle(0x401010); g.fillRect(bx, by, bw, 14);
      const f = b.hp / b.maxHp;
      g.fillStyle(b.invulnerable() ? 0x8888aa : 0xe8333b); g.fillRect(bx, by, bw * f, 14);
      g.fillStyle(0xffffff, 0.25); g.fillRect(bx, by, bw * f, 4);
      for (let ph = 1; ph < b.type.phases; ph++) { const tx = bx + bw * b.threshold(ph); g.fillStyle(0xffffff); g.fillRect(tx - 1.5, by - 4, 3, 22); }
      g.lineStyle(2, 0xffffff, 0.8); g.strokeRect(bx, by, bw, 14);
      this.bossT.setText(`${b.name}  •  PHASE ${b.phase + 1}/${b.type.phases}`).setPosition(W / 2, by - 6).setVisible(true);
    } else this.bossT.setVisible(false);

    // banner
    const ba = w.bannerT > 0 ? Math.min(1, w.bannerT * 2, (2.2 - w.bannerT) * 4) : 0;
    this.bannerT.setText(w.banner).setAlpha(ba);
    this.bannerSub.setText(w.bannerSub).setAlpha(ba);
    this.hintT.setText(w.hintText).setVisible(w.hintT > 0 && !!w.hintText).setAlpha(Math.min(1, w.hintT));
    this.respawnT.setVisible(w.state === WS.Dying);

    // events → toasts
    while (w.events.length) {
      const e = w.events.shift()!;
      if (e === 'perfect') this.toast('PERFECT BLOCK!', '#7fffe0');
      else if (e === 'checkpoint') this.toast('CHECKPOINT', '#5aff8c');
      else if (e === 'ultready') this.toast('ULTIMATE SẴN SÀNG!', '#e0a0ff');
      else if (e.startsWith('pickup:')) this.toast(PU_NAME[Number(e.slice(7))], '#ffffff');
    }
    if (this.toastTime > 0) { this.toastTime -= delta / 1000; this.toastT.setAlpha(Math.min(1, this.toastTime * 2)); this.toastT.y = 160 - (1.2 - this.toastTime) * 12; }

    // controls
    const c = this.controls;
    c.enabled = !this.gs.paused && w.state !== WS.Complete;
    c.cooldown[2] = w.shield.active ? 1 : Math.min(1, p.throwCd / 2.0);
    c.cooldown[3] = Math.min(1, p.smashCd / 4.0);
    c.cooldown[4] = p.ult >= 100 ? 0 : 1 - p.ult / 100;
    c.glow[4] = p.ult >= 100;
    if (this.touch && w.state !== WS.Complete) c.draw(time / 1000); else c.setVisible(false);
    if (this.touch && w.state !== WS.Complete && !this.gs.paused) c.setVisible(true);
  }

  private toast(s: string, color: string) {
    this.toastT.setText(s).setColor(color).setAlpha(1);
    this.toastTime = 1.2;
  }

  // ------------------------------------------------------------------ pause menu
  showPause(show: boolean) {
    for (const o of this.pauseLayer) o.destroy();
    this.pauseLayer = [];
    this.controls?.reset();
    if (!show) return;
    this.controls.setVisible(false);
    const W = VW(this), H = VH(this);
    const L = this.pauseLayer;
    L.push(this.add.rectangle(0, 0, W, H, 0x000000, 0.7).setOrigin(0).setDepth(40).setInteractive());
    L.push(panel(this, W / 2, 262, 400, 420).setDepth(40.5));
    L.push(txt(this, W / 2, 70, 'TẠM DỪNG', 40).setDepth(41));
    L.push(txt(this, W / 2, 112, `Màn ${this.gs.levelNum}: ${LEVEL_INFO[this.gs.levelNum - 1].name}`, 16, '#9fe8dc', false).setDepth(41));
    const add = (b: Btn) => { b.box.setDepth(41); b.label.setDepth(42); L.push(b.box, b.label); return b; };
    L.push(this.add.image(W - 150, H - 20, 'hero_portrait').setOrigin(52 / 112, 122 / 128).setScale(0.32).setDepth(41));
    add(button(this, W / 2, 170, 320, 50, '▶ TIẾP TỤC', () => this.gs.setPaused(false), 0x2bb3a0));
    add(button(this, W / 2, 230, 320, 46, 'CHƠI LẠI TỪ CHECKPOINT', () => { this.gs.world.restartFromCheckpoint(); this.gs.setPaused(false); }, 0x2b6fb3, 18));
    const sb = add(button(this, W / 2 - 82, 290, 156, 46, '', () => { save.soundEnabled = !save.soundEnabled; persist(); sb.setText(`Âm thanh: ${save.soundEnabled ? 'BẬT' : 'TẮT'}`); }, 0x5a5f78, 15));
    sb.setText(`Âm thanh: ${save.soundEnabled ? 'BẬT' : 'TẮT'}`);
    const mb = add(button(this, W / 2 + 82, 290, 156, 46, '', () => { save.musicEnabled = !save.musicEnabled; persist(); updateMusic(); mb.setText(`Nhạc: ${save.musicEnabled ? 'BẬT' : 'TẮT'}`); }, 0x5a5f78, 15));
    mb.setText(`Nhạc: ${save.musicEnabled ? 'BẬT' : 'TẮT'}`);
    const lb = add(button(this, W / 2 - 82, 346, 156, 46, '', () => {
      save.buttonLayout = (save.buttonLayout + 1) % 3; persist(); this.relayout(); lb.setText(['Nút: Mặc định', 'Nút: Đảo bên', 'Nút: Lớn'][save.buttonLayout]);
    }, 0x5a5f78, 15));
    lb.setText(['Nút: Mặc định', 'Nút: Đảo bên', 'Nút: Lớn'][save.buttonLayout]);
    const vb = add(button(this, W / 2 + 82, 346, 156, 46, '', () => { save.vibrationEnabled = !save.vibrationEnabled; persist(); vb.setText(`Rung: ${save.vibrationEnabled ? 'BẬT' : 'TẮT'}`); }, 0x5a5f78, 15));
    vb.setText(`Rung: ${save.vibrationEnabled ? 'BẬT' : 'TẮT'}`);
    add(button(this, W / 2, 410, 320, 46, 'VỀ MENU CHÍNH', () => this.gs.scene.start('Menu'), 0x8a2a2a, 18));
  }

  // ------------------------------------------------------------------ victory
  showVictory(v: VictoryInfo) {
    this.controls.setVisible(false);
    const W = VW(this), H = VH(this);
    const L = this.victoryLayer;
    L.push(this.add.rectangle(0, 0, W, H, 0x000000, 0.65).setOrigin(0).setDepth(40).setInteractive());
    L.push(panel(this, W / 2, 238, 480, 300).setDepth(40.5));
    L.push(txt(this, W / 2, 70, 'HOÀN THÀNH MÀN!', 44, '#f2c94c').setDepth(41));
    const n = this.gs.levelNum;
    L.push(txt(this, W / 2, 118, `Màn ${n}: ${LEVEL_INFO[n - 1].name}`, 18, '#9fe8dc', false).setDepth(41));
    const rows = [
      ['Thời gian', fmtTime(v.time) + (save.bestTime[n - 1] === Math.ceil(v.time) ? '  ★ Kỷ lục' : '')],
      ['Số lần chết', String(v.deaths)],
      ['Quái hạ gục', String(v.kills)],
      ['Xu nhặt được', `+${v.coins}`],
      ['Thưởng màn', `+${v.reward}`],
      ['Tổng xu', `● ${save.coins}`],
    ];
    rows.forEach(([k, val], i) => {
      L.push(this.add.text(W / 2 - 170, 160 + i * 34, k, { fontFamily: FONT2, fontSize: '19px', color: '#c0c8e0' }).setDepth(41));
      L.push(this.add.text(W / 2 + 170, 160 + i * 34, val, { fontFamily: FONT, fontSize: '19px', color: '#ffffff' }).setOrigin(1, 0).setDepth(41));
    });
    const add = (b: Btn) => { b.box.setDepth(41); b.label.setDepth(42); L.push(b.box, b.label); };
    if (n < LEVEL_COUNT) add(button(this, W / 2 + 220, H - 70, 200, 52, `MÀN ${n + 1} ▶`, () => this.gs.scene.start('Game', { level: n + 1 }), 0xe8553b, 20));
    else L.push(txt(this, W / 2, H - 130, 'Bạn đã đánh bại Overlord! Cảm ơn đã chơi!', 20, '#7fffe0').setDepth(41));
    add(button(this, W / 2 - 220, H - 70, 200, 52, 'NÂNG CẤP', () => this.gs.scene.start('Upgrade'), 0x2bb3a0, 20));
    add(button(this, W / 2, H - 70, 200, 52, 'TỦ ĐỒ', () => this.gs.scene.start('Shop'), 0xb04be8, 20));
    if (n >= LEVEL_COUNT) add(button(this, W / 2 + 220, H - 70, 200, 52, 'MENU', () => this.gs.scene.start('Menu'), 0x5a5f78, 20));
  }
}

function drawIcon(g: Phaser.GameObjects.Graphics, x: number, y: number, c: number) {
  g.fillStyle(c); g.fillCircle(x, y, 8); g.fillStyle(0xffffff, 0.8); g.fillCircle(x - 2, y - 2, 3);
}
