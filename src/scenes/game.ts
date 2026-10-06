import Phaser from 'phaser';
import { World, WS, VIEW_H } from '../game/world';
import { HZ, PK, SolidType } from '../game/entities';
import { Enemy, S } from '../game/enemy';
import { BS } from '../game/boss';
import { PState, Controls } from '../game/player';
import { GROUND_Y } from '../game/level';
import { PPU, rndr } from '../game/util';
import { drawTerrain, ensureBackgrounds, FORE_H, releaseBackgrounds, THEMES } from '../art/themes';
import { HERO_FX, HERO_FY, HERO_H, HERO_W } from '../art/textures';
import { persist, save, LEVEL_COUNT } from '../systems/save';
import { Bot } from './bot';
import type { HUDScene } from './hud';
import { initCam, VH, VW } from './ui';
import { Z } from '../art/pen';

const PR_TEX: Record<number, string> = {
  [PK.SHOT]: 'pr_shot', [PK.BULLET]: 'pr_bullet', [PK.PLASMA]: 'pr_plasma', [PK.FIRE]: 'pr_fire', [PK.ICE]: 'pr_ice',
  [PK.SAND]: 'pr_sand', [PK.ACID]: 'pr_acid', [PK.LASER]: 'pr_laser', [PK.WAVE]: 'pr_wave', [PK.MISSILE]: 'pr_missile',
  [PK.EGG]: 'pr_egg', [PK.WEB]: 'pr_web', [PK.SHARD]: 'pr_shard', [PK.LAVAWAVE]: 'pr_lavawave', [PK.ROCK]: 'pr_rock',
  [PK.REFLECT]: 'pr_reflect', [PK.PILLAR]: 'pr_pillar',
};
const ROTATE = new Set([PK.SHOT, PK.PLASMA, PK.LASER, PK.BULLET]);
const STEP = 1 / 60;

export class GameScene extends Phaser.Scene {
  world!: World;
  levelNum = 1;
  paused = false;
  private acc = 0;
  private speed = 1; // test-only time scale (?speed=N with ?bot)
  private sky!: Phaser.GameObjects.Image;
  private far!: Phaser.GameObjects.TileSprite;
  private mid!: Phaser.GameObjects.TileSprite;
  private fore!: Phaser.GameObjects.TileSprite;
  private fxAdd!: Phaser.GameObjects.Graphics;
  private flash!: Phaser.GameObjects.Image;
  private fxPool: Phaser.GameObjects.Image[] = [];
  private wasGround = true;
  private near!: Phaser.GameObjects.TileSprite;
  private fxBack!: Phaser.GameObjects.Graphics;
  private fxFront!: Phaser.GameObjects.Graphics;
  private playerSpr!: Phaser.GameObjects.Image;
  private shieldSpr!: Phaser.GameObjects.Image;
  private projSpr: Phaser.GameObjects.Image[] = [];
  private pickupSpr = new Map<object, Phaser.GameObjects.Image>();
  private hazardSpr = new Map<object, Phaser.GameObjects.Image>();
  private flags: Phaser.GameObjects.Image[] = [];
  private chunks: Phaser.GameObjects.RenderTexture[] = [];
  private bossSpr: Phaser.GameObjects.Image | null = null;
  private bossRef: object | null = null;
  private completed = false;
  hud!: HUDScene;
  bot: Bot | null = null;

  constructor() { super('Game'); }

  init(data: { level?: number }) {
    this.levelNum = Math.min(LEVEL_COUNT, Math.max(1, data.level ?? 1));
    this.paused = false; this.acc = 0; this.completed = false;
    this.chunks = []; this.projSpr = []; this.pickupSpr = new Map(); this.hazardSpr = new Map(); this.flags = [];
    this.bossSpr = null; this.bossRef = null;
  }

  create() {
    initCam(this);
    const W = VW(this), H = VH(this);
    const world = this.world = new World(this.levelNum);
    world.viewW = W / PPU;
    const q = new URLSearchParams(location.search);
    if (q.has('god')) world.god = true;
    if (q.has('x') && (q.has('bot') || q.has('dev'))) { world.player.x = Number(q.get('x')); world.player.y = world.groundTopAt(world.player.x) - world.player.h - 0.5; }
    if (q.has('bot')) { this.bot = new Bot(world); this.speed = Math.min(16, Math.max(1, Number(q.get('speed')) || 1)); }
    const th = THEMES[world.level.theme];
    void th;
    releaseBackgrounds(this, [0, world.level.theme]);
    const { skyKey, farKey, midKey, nearKey, foreKey } = ensureBackgrounds(this, world.level.theme);

    this.sky = this.add.image(0, 0, skyKey).setOrigin(0).setScrollFactor(0).setDepth(-10).setDisplaySize(W, H);
    this.far = this.add.tileSprite(0, 0, W, H, farKey).setOrigin(0).setScrollFactor(0).setDepth(-9).setTileScale(1);
    this.mid = this.add.tileSprite(0, 0, W, H, midKey).setOrigin(0).setScrollFactor(0).setDepth(-8.5).setTileScale(1).setAlpha(0.95);
    this.near = this.add.tileSprite(0, 0, W, H, nearKey).setOrigin(0).setScrollFactor(0).setDepth(-8).setTileScale(1);
    this.fore = this.add.tileSprite(0, H - FORE_H * 0.62, W, FORE_H * 0.62, foreKey).setOrigin(0).setScrollFactor(0).setDepth(18).setTileScale(0.62);

    this.fxBack = this.add.graphics().setDepth(0);
    this.bakeTerrain();

    for (const cp of world.level.checkpoints) {
      const gy = world.groundTopAt(cp + 0.35);
      this.flags.push(this.add.image(cp * PPU, gy * PPU, 'flag_off').setOrigin(0.1, 1).setDepth(2));
    }
    for (const h of world.hazards) {
      let key = '';
      if (h.type === HZ.BARREL) key = 'barrel';
      else if (h.type === HZ.CRATE) key = 'crate';
      else if (h.type === HZ.CRUSHER) key = 'crusher';
      else if (h.type === HZ.ICICLE) key = 'icicle';
      if (key) this.hazardSpr.set(h, this.add.image(h.x * PPU, h.y * PPU, key).setOrigin(0).setDisplaySize(h.w * PPU, key === 'crusher' ? 1.3 * PPU : h.h * PPU).setDepth(3));
    }

    this.playerSpr = this.add.image(0, 0, 'hero_idle').setOrigin(HERO_FX / HERO_W, HERO_FY / HERO_H).setDepth(10);
    this.shieldSpr = this.add.image(0, 0, 'shield').setDepth(11).setVisible(false);
    for (let i = 0; i < world.projs.length; i++) this.projSpr.push(this.add.image(0, 0, 'pr_shot').setVisible(false).setDepth(12));
    this.fxFront = this.add.graphics().setDepth(15);
    this.fxAdd = this.add.graphics().setDepth(16).setBlendMode(Phaser.BlendModes.ADD);
    this.flash = this.add.image(0, 0, 'flash').setDepth(13).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.fxPool = [];

    world.snapCamera();
    this.cameras.main.setRoundPixels(false);

    this.scene.launch('HUD', { game: this });
    this.hud = this.scene.get('HUD') as HUDScene;
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => { this.scale.off('resize', this.onResize, this); this.scene.stop('HUD'); });
    (window as any).__sf = this; // test hook
  }

  /** Static terrain is drawn once and baked into 1024px RenderTexture chunks (Graphics would re-tessellate every frame). */
  private bakeTerrain() {
    const g = this.make.graphics({}, false);
    drawTerrain(g, this.world.level);
    let minX = 0, maxX = 0;
    for (const s of this.world.solids) { minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x + s.w); }
    const y0 = -4 * PPU, hh = Math.ceil(13 * PPU - y0), CW = 1024;
    for (let x = Math.floor(minX * PPU); x < maxX * PPU; x += CW) {
      const rt = this.add.renderTexture(x, y0, CW * Z, hh * Z).setOrigin(0).setDepth(1).setScale(1 / Z);
      g.setScale(Z);
      rt.draw(g, -x * Z, -y0 * Z);
      this.chunks.push(rt);
    }
    g.destroy();
  }

  setPaused(p: boolean) {
    this.paused = p;
    this.hud?.showPause(p);
  }

  private onResize(size: Phaser.Structs.Size) {
    const W = size.width / Z, H = size.height / Z;
    this.world.viewW = W / PPU;
    this.far.setSize(W, H); this.mid.setSize(W, H); this.near.setSize(W, H);
    this.fore.setSize(W, FORE_H * 0.62).setPosition(0, H - FORE_H * 0.62);
    this.sky.setDisplaySize(W, H);
  }

  /** One-shot additive sprite effect (explosion ring / glow burst). */
  private burst(key: string, x: number, y: number, s0: number, s1: number, dur: number, tint = 0xffffff, alpha = 1) {
    let img = this.fxPool.find(i => !i.visible);
    if (!img) { img = this.add.image(0, 0, key).setBlendMode(Phaser.BlendModes.ADD).setDepth(14); this.fxPool.push(img); }
    img.setTexture(key).setVisible(true).setPosition(x, y).setScale(s0 / Z).setAlpha(alpha).setTint(tint);
    this.tweens.killTweensOf(img);
    this.tweens.add({ targets: img, scale: s1 / Z, alpha: 0, duration: dur, ease: 'Cubic.out', onComplete: () => img!.setVisible(false) });
  }

  controls(): Controls { return this.bot ?? this.hud.controls; }

  update(_t: number, delta: number) {
    if (!this.hud?.controls) return;
    const w = this.world;
    if (!this.paused) {
      this.acc += Math.min(delta / 1000, 0.1) * this.speed;
      let n = 0;
      while (this.acc >= STEP && n < 5 * this.speed) {
        this.bot?.think(STEP);
        w.update(STEP, this.controls());
        this.acc -= STEP; n++;
      }
      if (w.state === WS.Complete && w.stateT > 1.6 && !this.completed) this.complete();
    }
    this.render();
  }

  private complete() {
    this.completed = true;
    const w = this.world, n = this.levelNum;
    w.rewarded = true;
    const reward = w.level.reward;
    const total = w.coinsEarned + reward;
    save.coins += total;
    if (!save.completedLevels.includes(n)) save.completedLevels.push(n);
    save.highestUnlockedLevel = Math.min(LEVEL_COUNT, Math.max(save.highestUnlockedLevel, n + 1));
    const t = Math.ceil(w.levelTime);
    if (!save.bestTime[n - 1] || t < save.bestTime[n - 1]) save.bestTime[n - 1] = t;
    persist();
    this.hud.showVictory({ time: w.levelTime, deaths: w.deaths, coins: w.coinsEarned, reward, total, kills: w.kills });
  }

  // ------------------------------------------------------------------ rendering
  private render() {
    const w = this.world, cam = this.cameras.main;
    let sx = 0, sy = 0;
    if (w.shakeT > 0 && !this.paused) { sx = rndr(-1, 1) * w.shakeMag * PPU * 0.5; sy = rndr(-1, 1) * w.shakeMag * PPU * 0.5; }
    cam.setScroll(w.camX * PPU + sx, w.camY * PPU + sy);
    const dy = (w.camY - (12 - VIEW_H)) * PPU;
    this.far.tilePositionX = w.camX * PPU * 0.1; this.far.tilePositionY = dy * 0.05;
    this.mid.tilePositionX = w.camX * PPU * 0.22; this.mid.tilePositionY = dy * 0.1;
    this.near.tilePositionX = w.camX * PPU * 0.4; this.near.tilePositionY = dy * 0.2;
    this.fore.tilePositionX = w.camX * PPU * 1.3 / 0.62; this.fore.tilePositionY = Math.max(0, -dy * 0.6) / 0.62;
    // world fx events (explosions etc.)
    while (w.fx.length) {
      const f = w.fx.shift()!;
      if (f.k === 'boom') { this.burst('glow', f.x * PPU, f.y * PPU, 0.6 * f.s, 3.2 * f.s, 380, 0xffb050); this.burst('ring', f.x * PPU, f.y * PPU, 0.3 * f.s, 2.6 * f.s, 420, 0xffd890, 0.9); }
      else if (f.k === 'hit') this.burst('spark', f.x * PPU, f.y * PPU, 0.8, 2.2, 160, 0xffffff);
      else if (f.k === 'ult') { this.burst('ring', f.x * PPU, f.y * PPU, 0.5, 14, 600, 0xd0a0ff); this.burst('glow', f.x * PPU, f.y * PPU, 1, 12, 500, 0xc98cff); }
      else if (f.k === 'perfect') this.burst('ring', f.x * PPU, f.y * PPU, 0.3, 2.4, 300, 0x7fffe0);
    }

    const vx0 = w.camX * PPU - 64, vx1 = (w.camX + w.viewW) * PPU + 64;
    for (const c of this.chunks) c.setVisible(c.x < vx1 && c.x + c.displayWidth > vx0);
    const fb = this.fxBack, ff = this.fxFront, fa = this.fxAdd;
    fb.clear(); ff.clear(); fa.clear();
    const t = w.time;
    this.drawLava(fb, t);
    this.drawHazards(fb, ff, t);
    for (let i = 0; i < this.flags.length; i++) if (i <= w.cpIndex && this.flags[i].texture.key !== 'flag_on') this.flags[i].setTexture('flag_on');

    this.renderPlayer();
    this.renderEnemies(fb, ff);
    this.renderBoss(ff);
    this.renderProjs();
    this.renderPickups();
    this.renderWarnings(ff, t);
    // particles: bright ones glow additively, dull ones (smoke/dust/debris) draw normally
    for (const p of w.particlesArr) {
      if (!p.active) continue;
      const a = Math.min(1, p.life / p.max * 1.5);
      const s = p.size * PPU;
      const c = p.color, lum = (((c >> 16) & 255) * 3 + ((c >> 8) & 255) * 6 + (c & 255)) / 10;
      const sat = Math.max((c >> 16) & 255, (c >> 8) & 255, c & 255) - Math.min((c >> 16) & 255, (c >> 8) & 255, c & 255);
      if (lum > 150 || sat > 120) {
        fa.fillStyle(c, a * 0.35); fa.fillCircle(p.x * PPU, p.y * PPU, s * 1.3);
        fa.fillStyle(c, a); fa.fillRect(p.x * PPU - s / 2, p.y * PPU - s / 2, s, s);
      } else {
        ff.fillStyle(c, a * 0.85); ff.fillCircle(p.x * PPU, p.y * PPU, s * 0.6);
      }
    }
    // projectile glows
    for (const p of w.projs) {
      if (!p.active || p.kind === PK.PILLAR || p.kind === PK.EGG || p.kind === PK.WAVE) continue;
      const col = p.team === 0 ? (p.kind === PK.REFLECT ? 0x7fffe0 : 0x5fd8ff) : p.kind === PK.LASER ? 0xff2e5a : p.kind === PK.ACID || p.kind === PK.PLASMA ? 0x9cff4a : 0xff8a2e;
      fa.fillStyle(col, 0.18); fa.fillCircle(p.x * PPU, p.y * PPU, p.kind === PK.LAVAWAVE ? 60 : 16);
    }
  }

  private renderPlayer() {
    const w = this.world, p = w.player, spr = this.playerSpr;
    spr.setVisible(!p.dead);
    if (p.dead) { this.shieldSpr.setVisible(false); return; }
    let f = 'idle';
    switch (p.state) {
      case PState.Run: f = p.aimUp ? 'up' : 'run' + (Math.floor(p.anim * 11) % 4); break;
      case PState.Jump: f = p.aimUp ? 'up' : 'jump'; break;
      case PState.Fall: f = p.aimUp ? 'up' : 'fall'; break;
      case PState.Crouch: f = p.shootT > 0 ? 'crouchshoot' : 'crouch'; break;
      case PState.Block: f = 'block'; break;
      case PState.Hurt: f = 'hurt'; break;
      case PState.Dash: f = 'dash'; break;
      case PState.Victory: f = 'victory'; break;
      default: f = p.aimUp ? 'up' : p.shootT > 0 ? 'shoot' : Math.floor(p.anim * 1.5) % 2 ? 'idle' : 'idle2';
    }
    if (w.shield.active && w.shield.t < 0.15 && w.shield.state === 'out') f = 'throw';
    spr.setTexture((w.shield.active ? 'heroNS_' : 'hero_') + f);
    spr.setFlipX(p.facing < 0);
    spr.setPosition(p.cx() * PPU, (p.y + p.h) * PPU);
    if (p.shootT > 0.14 && !w.shield.active) {
      const m = p.muzzle();
      this.flash.setVisible(true).setPosition(m.x * PPU + p.facing * 6, m.y * PPU).setRotation(Math.random() * 6).setScale((0.7 + Math.random() * 0.4) / Z);
    } else if (p.shootT > 0.14) {
      const m = p.muzzle();
      this.flash.setVisible(true).setPosition(m.x * PPU, m.y * PPU).setScale(0.5 / Z);
    } else this.flash.setVisible(false);
    if (p.onGround && !this.wasGround) w.particles(p.cx(), p.y + p.h, 8, 0x8a8478, 2.5, 0.35, 0.14, -1);
    this.wasGround = p.onGround;
    spr.setAlpha(p.invuln > 0 && Math.floor(w.time * 20) % 2 ? 0.35 : 1);
    if (p.superT > 0) spr.setTint(Math.floor(w.time * 10) % 2 ? 0xffd0c0 : 0xffffff); else spr.clearTint();
    // aura for power-ups
    if (p.plasmaT > 0 || p.superT > 0) {
      this.fxBack.fillStyle(p.plasmaT > 0 ? 0x3be8d2 : 0xff7a5a, 0.18 + 0.08 * Math.sin(w.time * 10));
      this.fxBack.fillCircle(p.cx() * PPU, p.cy() * PPU, 0.95 * PPU);
    }
    const s = w.shield;
    this.shieldSpr.setVisible(s.active);
    if (s.active) {
      this.shieldSpr.setPosition(s.x * PPU, s.y * PPU).setRotation(s.spin);
      this.fxFront.fillStyle(0x7fe0ff, 0.25); this.fxFront.fillCircle((s.x - s.vx * 0.03) * PPU, (s.y - s.vy * 0.03) * PPU, 14);
      this.fxFront.fillStyle(0x7fe0ff, 0.12); this.fxFront.fillCircle((s.x - s.vx * 0.06) * PPU, (s.y - s.vy * 0.06) * PPU, 12);
      if (s.bomb) { this.fxFront.fillStyle(0xff8a2e, 0.4); this.fxFront.fillCircle(s.x * PPU, s.y * PPU, 22); }
    }
  }

  private renderEnemies(fb: Phaser.GameObjects.Graphics, ff: Phaser.GameObjects.Graphics) {
    const w = this.world;
    for (const e of w.enemies) {
      let spr = e.sprite as Phaser.GameObjects.Image | null;
      if (!e.alive) { if (spr) { spr.destroy(); e.sprite = null; } continue; }
      const near = e.x < w.camX + w.viewW + 4 && e.x + e.w > w.camX - 4;
      if (!near) { if (spr) spr.setVisible(false); continue; }
      if (!spr) {
        spr = this.add.image(0, 0, `e_${e.type.key}_0`).setDepth(9);
        const tex = spr.texture.getSourceImage() as { height: number };
        spr.setOrigin(0.5, (tex.height - 2) / tex.height);
        e.sprite = spr;
      }
      const attacking = e.state === S.WINDUP || e.state === S.ATTACK || e.state === S.AIM || e.state === S.LEAP || e.state === S.CHARGE || e.state === S.FUSE || e.state === S.EMERGE;
      const frame = attacking ? 4 : (Math.abs(e.vx) > 0.2 || e.type.flying ? Math.floor(e.anim * 8) % 4 : 0);
      spr.setTexture(`e_${e.type.key}_${frame}`);
      spr.setFlipX(e.facing < 0);
      spr.setPosition(e.cx() * PPU, (e.y + e.h) * PPU);
      if (e.hidden()) {
        spr.setVisible(false);
        fb.fillStyle(e.type.c2, 0.9);
        fb.fillEllipse(e.cx() * PPU, (e.y + e.h) * PPU, e.w * PPU * 1.2, 16);
        continue;
      }
      spr.setVisible(true);
      if (e.state === S.HANG) { ff.lineStyle(2, 0xdddddd, 0.6); ff.lineBetween(e.cx() * PPU, (w.camY - 1) * PPU, e.cx() * PPU, e.y * PPU); }
      if (e.flash > 0) spr.setTintFill(0xffffff);
      else if (e.state === S.FUSE) spr.setTintFill(Math.floor(e.t * 20) % 2 ? 0xffffff : 0xff3a3a);
      else if ((e.state === S.WINDUP || e.state === S.AIM) && Math.floor(e.t * 16) % 2) spr.setTint(0xff9090);
      else if (e.state === S.STUN) spr.setTint(0x9090ff);
      else spr.clearTint();
      if (e.minion) { fb.fillStyle(0xff2e5a, 0.15); fb.fillCircle(e.cx() * PPU, e.cy() * PPU, e.w * PPU); }
      if (e.onGround) { fb.fillStyle(0x000000, 0.25); fb.fillEllipse(e.cx() * PPU, (e.y + e.h) * PPU, e.w * PPU * 1.1, 7); }
      // hp pip for tough enemies
      if (e.hp < e.maxHp && e.maxHp >= 45) {
        const bw = e.w * PPU;
        ff.fillStyle(0x000000, 0.6); ff.fillRect((e.cx()) * PPU - bw / 2, e.y * PPU - 10, bw, 5);
        ff.fillStyle(0xff4a3a); ff.fillRect((e.cx()) * PPU - bw / 2, e.y * PPU - 10, bw * Math.max(0, e.hp / e.maxHp), 5);
      }
    }
  }

  private renderBoss(ff: Phaser.GameObjects.Graphics) {
    const w = this.world, b = w.boss;
    if (b !== this.bossRef) {
      this.bossSpr?.destroy(); this.bossSpr = null; this.bossRef = b;
      if (b) {
        this.bossSpr = this.add.image(0, 0, `b_${b.type.key}`).setDepth(8);
        const tex = this.bossSpr.texture.getSourceImage() as { height: number };
        this.bossSpr.setOrigin(0.5, (tex.height - 4) / tex.height);
      }
    }
    if (!b || !this.bossSpr) return;
    const spr = this.bossSpr;
    const atk = b.state === BS.TELE || b.state === BS.ACT;
    spr.setTexture(`b_${b.type.key}${atk ? '_a' : ''}`);
    spr.setFlipX(b.facing < 0);
    const bob = b.state === BS.IDLE ? Math.sin(b.anim * 4) * 2 : 0;
    spr.setPosition(b.cx() * PPU, (b.y + b.h) * PPU + bob);
    spr.setVisible(!b.hidden);
    if (b.state === BS.DEAD) { spr.setAlpha(Math.max(0, 1 - Math.max(0, b.deathT - 1.4))); spr.setTintFill(Math.floor(b.deathT * 12) % 2 ? 0xffffff : 0xff8a2e); return; }
    spr.setAlpha(b.state === BS.TRANSITION ? 0.6 + 0.4 * Math.sin(b.t * 30) : 1);
    if (b.flash > 0) spr.setTintFill(0xffffff);
    else if (b.state === BS.TELE && Math.floor(b.t * 14) % 2) spr.setTint(0xff7070);
    else if (b.state === BS.RECOVER && b.stun > 1.3) spr.setTint(0xa0a0ff);
    else spr.clearTint();
    if (b.state === BS.INTRO) spr.setScale(Math.min(1, 0.6 + b.t * 0.4) / Z); else spr.setScale(1 / Z);
    if (!b.type.flying && !b.hidden) { this.fxBack.fillStyle(0x000000, 0.3); this.fxBack.fillEllipse(b.cx() * PPU, (b.y + b.h) * PPU, b.w * PPU * 1.1, 12); }
    if (b.weakOpen > 0) { ff.lineStyle(3, 0xffe04a, 0.5 + 0.5 * Math.sin(w.time * 20)); ff.strokeCircle((b.facing > 0 ? b.x + b.w * 0.95 : b.x + b.w * 0.05) * PPU, (b.y + b.h * 0.5) * PPU, 26); }
    if (b.type.key === 'overlord' && b.state !== BS.INTRO) {
      ff.fillStyle(0xff2e5a, 0.4 + 0.3 * Math.sin(w.time * 8)); ff.fillCircle(b.cx() * PPU, b.coreY() * PPU, 18);
      ff.fillStyle(0xffffff, 0.9); ff.fillCircle(b.cx() * PPU, b.coreY() * PPU, 8);
    }
    if (b.laserOn > 0 && b.laserY >= 0) {
      const y = b.laserY * PPU, x0 = b.arenaX * PPU, x1 = (b.arenaX + 20) * PPU;
      ff.fillStyle(b.type.c2, 0.35); ff.fillRect(x0, y - 16, x1 - x0, 32);
      ff.fillStyle(b.type.c2, 0.9); ff.fillRect(x0, y - 7, x1 - x0, 14);
      ff.fillStyle(0xffffff, 1); ff.fillRect(x0, y - 2.5, x1 - x0, 5);
    }
  }

  private renderProjs() {
    const w = this.world;
    for (let i = 0; i < w.projs.length; i++) {
      const p = w.projs[i], s = this.projSpr[i];
      if (!p.active) { if (s.visible) s.setVisible(false); continue; }
      s.setVisible(true);
      const key = PR_TEX[p.kind];
      if (s.texture.key !== key) s.setTexture(key);
      s.setPosition(p.x * PPU, p.y * PPU);
      if (ROTATE.has(p.kind)) { s.setRotation(Math.atan2(p.vy, p.vx)); s.setFlipX(false); }
      else if (p.kind === PK.FIRE || p.kind === PK.ROCK || p.kind === PK.WEB || p.kind === PK.SAND || p.kind === PK.ACID) s.setRotation(p.age * 8);
      else { s.setRotation(0); s.setFlipX(p.vx < 0); }
      if (p.kind === PK.EGG) s.setScale((1 + Math.sin(p.age * 14) * 0.05 * Math.max(0, 2.4 - p.life)) / Z);
      else if (p.kind === PK.PILLAR) s.setScale(1 / Z, Math.min(1, p.age * 8) / Z);
      else s.setScale(1 / Z);
    }
  }

  private renderPickups() {
    const w = this.world;
    for (const k of w.pickups) {
      let s = this.pickupSpr.get(k);
      if (!k.active) { if (s) { s.destroy(); this.pickupSpr.delete(k); } continue; }
      if (!s) { s = this.add.image(0, 0, 'pu_' + k.type).setDepth(7); this.pickupSpr.set(k, s); }
      const bob = k.floating ? Math.sin(k.t * 3) * 0.12 : 0;
      s.setPosition(k.x * PPU, (k.y + bob) * PPU);
      s.setAlpha(!k.floating && k.life < 3 && Math.floor(k.t * 10) % 2 ? 0.3 : 1);
      if (k.type === 7) s.setScale((Math.abs(Math.cos(k.t * 4)) * 0.8 + 0.2) / Z, 1 / Z);
      else { this.fxAdd.fillStyle(0xffffff, 0.12 + 0.06 * Math.sin(k.t * 6)); this.fxAdd.fillCircle(k.x * PPU, (k.y + bob) * PPU, 22); }
    }
    if (this.pickupSpr.size > 80) for (const [k, s] of this.pickupSpr) if (!(k as any).active) { s.destroy(); this.pickupSpr.delete(k); }
  }

  private drawLava(fb: Phaser.GameObjects.Graphics, t: number) {
    const w = this.world;
    for (const l of w.level.lavaPits) {
      const x0 = l.x0 * PPU, x1 = l.x1 * PPU, y = (GROUND_Y + 0.6) * PPU;
      fb.fillStyle(0xff4a1e, 0.3); fb.fillRect(x0, y - 30, x1 - x0, 30);
      fb.fillStyle(0xd8321e); fb.fillRect(x0, y, x1 - x0, 7 * PPU);
      fb.fillStyle(0xffa02e);
      for (let x = x0; x < x1; x += 12) {
        const h = 6 + Math.sin(t * 4 + x * 0.05) * 4;
        fb.fillRect(x, y - h + 6, 12, h);
      }
      fb.fillStyle(0xfff0a0, 0.7);
      for (let i = 0; i < 4; i++) { const bx = x0 + ((t * 30 + i * 53) % (x1 - x0)); fb.fillCircle(bx, y + 14 + i * 6, 3); }
    }
    if (THEMES[w.level.theme].lava) {
      // embers
      if (Math.random() < 0.3) w.particle(w.camX + Math.random() * w.viewW, w.camY + VIEW_H + 0.5, rndr(-0.5, 0.5), -rndr(1, 3), 2.5, 0xff8a2e, 0.08, 0);
    }
  }

  private drawHazards(fb: Phaser.GameObjects.Graphics, ff: Phaser.GameObjects.Graphics, t: number) {
    const w = this.world;
    for (const h of w.hazards) {
      const spr = this.hazardSpr.get(h);
      if (spr) spr.setVisible(h.alive);
      if (!h.alive) continue;
      const ph = h.phase();
      const X = h.x * PPU, Y = h.y * PPU, Wd = h.w * PPU, Ht = h.h * PPU;
      switch (h.type) {
        case HZ.CRUSHER: {
          const hy = w.crusherHeadY(h) * PPU;
          fb.fillStyle(0x3a3e48); fb.fillRect(X + Wd / 2 - 10, (w.camY - 2) * PPU, 20, hy - (w.camY - 2) * PPU);
          fb.fillStyle(0xffd04a); for (let yy = (w.camY - 2) * PPU; yy < hy; yy += 30) fb.fillRect(X + Wd / 2 - 10, yy, 20, 6);
          spr?.setPosition(X, hy);
          if (ph > 0.45 && ph < 0.6) { fb.fillStyle(0xff3a3a, 0.35); fb.fillRect(X, (h.y + h.h - 0.15) * PPU, Wd, 0.15 * PPU); }
          break;
        }
        case HZ.LASER: {
          const horiz = h.w > h.h;
          fb.fillStyle(0x30343c);
          if (horiz) { fb.fillRect(X - 10, Y - 10, 12, 20 + Ht); fb.fillRect(X + Wd - 2, Y - 10, 12, 20 + Ht); }
          else { fb.fillRect(X - 12, Y - 14, Wd + 24, 16); fb.fillRect(X - 12, Y + Ht - 2, Wd + 24, 16); }
          if (ph > 0.7) {
            ff.fillStyle(0xff2e5a, 0.4); ff.fillRect(X - (horiz ? 0 : 8), Y - (horiz ? 8 : 0), Wd + (horiz ? 0 : 16), Ht + (horiz ? 16 : 0));
            ff.fillStyle(0xffd0dc); ff.fillRect(X, Y, Math.max(Wd, 3), Math.max(Ht, 3));
          } else if (ph > 0.5 && Math.floor(t * 12) % 2) {
            ff.fillStyle(0xff2e5a, 0.5); ff.fillRect(X, Y, Math.max(Wd, 1.5), Math.max(Ht, 1.5));
          }
          break;
        }
        case HZ.GEYSER: {
          const col = w.levelNum === 8 ? 0x7cff5a : 0xff8a2e;
          fb.fillStyle(0x30202a); fb.fillRoundedRect(X - 6, (h.y + h.h) * PPU - 10, Wd + 12, 14, 5);
          if (ph > 0.75) { ff.fillStyle(col, 0.55); ff.fillRect(X, Y, Wd, Ht); ff.fillStyle(0xffffff, 0.5); ff.fillRect(X + Wd * 0.3, Y, Wd * 0.4, Ht); }
          else if (ph > 0.55) { fb.fillStyle(col, 0.4 + 0.3 * Math.sin(t * 30)); fb.fillRect(X, (h.y + h.h) * PPU - 16, Wd, 8); }
          break;
        }
        case HZ.SPIKES: {
          fb.fillStyle(0xd8e8f8);
          for (let x = X; x < X + Wd; x += 16) fb.fillTriangle(x, Y + Ht, x + 8, Y - 4, x + 16, Y + Ht);
          break;
        }
        case HZ.ICICLE:
          spr?.setPosition(X + (h.triggered > 0 ? Math.sin(t * 60) * 2 : 0), Y);
          break;
      }
    }
  }

  private renderWarnings(ff: Phaser.GameObjects.Graphics, t: number) {
    const w = this.world;
    const blink = 0.45 + 0.35 * Math.sin(t * 25);
    for (const wn of w.warns) {
      if (!wn.active) continue;
      const X = wn.x * PPU, Y = wn.y * PPU, Wd = wn.w * PPU, Ht = wn.h * PPU;
      if (wn.style === 1) { ff.fillStyle(0xff2e2e, blink); ff.fillRect(X, Y, Wd, Math.max(3, Ht)); }
      else if (wn.style === 2) { ff.fillStyle(0xff2e2e, 0.12 + 0.1 * Math.sin(t * 20)); ff.fillRect(X, Y, Wd, Ht); ff.fillStyle(0xff2e2e, blink); ff.fillRect(X, (GROUND_Y - 0.15) * PPU, Wd, 7); }
      else {
        ff.fillStyle(0xff2e2e, blink * 0.8); ff.fillRect(X, Y, Wd, Ht);
        ff.fillStyle(0xffffff, blink); ff.fillTriangle(X + Wd / 2 - 9, Y - 6, X + Wd / 2 + 9, Y - 6, X + Wd / 2, Y - 22);
      }
    }
    void SolidType;
  }
}

export type { Enemy };
