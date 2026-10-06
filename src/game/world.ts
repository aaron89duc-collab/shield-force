import { Hazard, HZ, Particle, Pickup, PK, Proj, PU, Solid, SolidType, Warn } from './entities';
import { E, Enemy, EType } from './enemy';
import { Boss, BS } from './boss';
import { Controls, Player, Shield } from './player';
import { Level, ARENA_W, GROUND_Y } from './level';
import { buildLevel } from './levels';
import { approach, clamp, rnd, rndi, rndr, reseed } from './util';
import { play, Sfx } from '../systems/sound';
import { stats, vibrate } from '../systems/save';

export const VIEW_H = 11.25; // world units visible vertically (540 px / 48)

export enum WS { Playing, Dying, BossDead, Complete }

interface Strike { x: number; t: number; kind: PK; }

/**
 * Level runtime (LevelManager + SpawnManager + CameraBounds + combat resolution).
 * Pure game logic; the Phaser view reads its state every frame.
 */
export class World {
  level: Level;
  solids: Solid[];
  player: Player;
  shield = new Shield();
  enemies: Enemy[] = [];
  pickups: Pickup[] = [];
  hazards: Hazard[];
  boss: Boss | null = null;
  bossQueue = 0;
  projs: Proj[] = [];
  particlesArr: Particle[] = [];
  warns: Warn[] = [];
  strikes: Strike[] = [];

  gravity: number;
  killY = 15;
  camX = 0; camY = 0; viewW = 20;
  shakeT = 0; shakeMag = 0;
  hitStop = 0;
  time = 0; levelTime = 0;
  deaths = 0; coinsEarned = 0; kills = 0;
  rewarded = false;
  state = WS.Playing;
  stateT = 0;
  arenaLocked = false;
  cpX: number; cpY: number; cpIndex = -1;
  banner = ''; bannerT = 0; bannerSub = '';
  flashT = 0; flashColor = 0xffffff;
  hintText = ''; hintT = 0;
  stormT = 0; storming = false;
  god = false; // debug/test only
  events: string[] = []; // consumed by the view (e.g. 'perfect', 'checkpoint')
  fx: { k: string; x: number; y: number; s: number }[] = []; // visual one-shots for the renderer
  pushFx(k: string, x: number, y: number, s = 1) { if (this.fx.length < 40) this.fx.push({ k, x, y, s }); }
  private lastHint = -1;

  constructor(public levelNum: number) {
    reseed(levelNum * 7919);
    this.level = buildLevel(levelNum);
    this.solids = this.level.solids;
    this.hazards = this.level.hazards;
    this.gravity = this.level.gravity;
    for (const s of this.level.spawns) this.enemies.push(new Enemy(s.type, s.x, s.y));
    for (const p of this.level.pickups) this.pickups.push(new Pickup(p.type, p.x, p.y, true));
    for (let i = 0; i < 140; i++) this.projs.push(new Proj());
    for (let i = 0; i < 360; i++) this.particlesArr.push(new Particle());
    for (let i = 0; i < 24; i++) this.warns.push(new Warn());
    this.cpX = this.level.startX; this.cpY = GROUND_Y;
    this.player = new Player(this.cpX, this.cpY);
    this.camY = this.camTargetY();
    this.showBanner(`MÀN ${levelNum}`, this.level.name);
  }

  // ------------------------------------------------------------------ main update
  update(dt: number, c: Controls) {
    this.time += dt;
    if (this.bannerT > 0) this.bannerT -= dt;
    if (this.hintT > 0) this.hintT -= dt;
    if (this.flashT > 0) this.flashT -= dt;
    if (this.shakeT > 0) this.shakeT -= dt;
    if (this.hitStop > 0) { this.hitStop -= dt; return; }
    this.stateT += dt;
    if (this.state !== WS.Complete) this.levelTime += dt;

    const p = this.player;
    if (this.state === WS.Dying) {
      p.deadT -= dt;
      if (p.deadT <= 0) this.respawn();
    } else if (!p.dead) {
      p.update(this, c, dt);
      if (this.god) { p.hp = p.maxHp; }
    }

    this.shield.update(this, dt);
    const activeL = this.camX - 12, activeR = this.camX + this.viewW + 3;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.minion || (e.x < activeR && e.x > activeL) || e.awake) {
        if (e.x < this.camX - 26) { e.alive = false; continue; }
        e.update(this, dt);
      }
    }
    if (this.enemies.length > 80) this.enemies = this.enemies.filter(e => e.alive);
    if (this.boss) this.boss.update(this, dt);
    this.updateProjs(dt);
    this.updateStrikes(dt);
    this.updateHazards(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    for (const w of this.warns) if (w.active && (w.t += dt) >= w.dur) w.active = false;
    this.updateEnvironment(dt);

    // checkpoints
    const cps = this.level.checkpoints;
    for (let i = this.cpIndex + 1; i < cps.length; i++) {
      if (p.x > cps[i] && !p.dead) {
        this.cpIndex = i; this.cpX = cps[i]; this.cpY = this.groundTopAt(cps[i] + 0.35);
        this.sfx(Sfx.CHECKPOINT); this.events.push('checkpoint');
        this.particles(cps[i], this.cpY - 2.5, 16, 0x5aff8c, 4, 0.7, 0.1, 4);
      }
    }
    // hints
    const hints = this.level.hints;
    for (let i = this.lastHint + 1; i < hints.length; i++) {
      if (p.x > hints[i].x) { this.lastHint = i; this.hintText = hints[i].text; this.hintT = 5; }
    }
    // boss gate
    if (!this.arenaLocked && p.x > this.level.arenaX + 1.5 && !p.dead) this.lockArena();

    // pits
    if (!p.dead && p.y > this.killY) this.pitFall(25);

    // boss flow
    if (this.state === WS.BossDead && this.boss && this.boss.deathT > 2.4) {
      if (this.bossQueue + 1 < this.level.bosses.length) {
        this.bossQueue++;
        this.spawnBoss();
        this.state = WS.Playing;
      } else {
        this.state = WS.Complete; this.stateT = 0;
        p.victory = true;
        this.sfx(Sfx.VICTORY);
      }
    }
    this.updateCamera(dt);
  }

  // ------------------------------------------------------------------ camera
  private camTargetY() {
    const p = this.player;
    return clamp(p.y + p.h * 0.5 - VIEW_H * 0.58, -7, 12.2 - VIEW_H);
  }

  updateCamera(dt: number) {
    const p = this.player;
    let tx: number, ty: number;
    if (this.arenaLocked) {
      tx = this.level.arenaX + ARENA_W / 2 - this.viewW / 2;
      ty = 12 - VIEW_H;
    } else {
      tx = p.cx() - this.viewW * 0.42 + p.facing * 1.2;
      tx = clamp(tx, -2, this.level.arenaX + ARENA_W - this.viewW);
      ty = this.camTargetY();
    }
    const k = Math.min(1, dt * (this.arenaLocked ? 3 : 7));
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * Math.min(1, dt * 4);
  }

  snapCamera() { this.updateCamera(1); }

  // ------------------------------------------------------------------ arena / boss
  private lockArena() {
    this.arenaLocked = true;
    for (const s of this.solids) if (s.type === SolidType.WALL) s.enabled = true;
    this.cpX = this.level.arenaX + 1.5; this.cpY = GROUND_Y;
    this.spawnBoss();
  }

  private spawnBoss() {
    const spec = this.level.bosses[this.bossQueue];
    this.boss = new Boss(spec.type, this.level.arenaX, spec.hp ?? 0, spec.name);
    this.showBanner(this.boss.name, this.level.bosses.length > 1 ? `Mini-boss ${this.bossQueue + 1}/${this.level.bosses.length}` : 'BOSS');
    this.sfx(Sfx.BOSS_PHASE);
    this.shake(0.5, 0.2);
  }

  onBossPhase(b: Boss) {
    this.showBanner(`PHASE ${b.phase + 1}`, b.name);
    this.sfx(Sfx.BOSS_PHASE);
    this.shake(0.6, 0.3);
    this.clearEnemyProjs();
    this.flash(0xffffff, 0.15);
  }

  onBossKilled(b: Boss) {
    this.state = WS.BossDead; this.stateT = 0;
    this.clearEnemyProjs();
    for (const e of this.enemies) if (e.minion && e.alive) { e.alive = false; this.explosionFx(e.cx(), e.cy(), 0.7); }
    this.sfx(Sfx.EXPLODE);
    this.shake(1.2, 0.35);
    this.flash(0xffffff, 0.3);
    this.coinsEarned += 50;
    for (let i = 0; i < 6; i++) this.dropPickup(PU.COIN, b.cx() + rndr(-1.5, 1.5), b.cy());
    vibrate(200);
  }

  minionCount() { let n = 0; for (const e of this.enemies) if (e.alive && e.minion) n++; return n; }

  spawnMinion(t: EType, x: number, y: number) {
    if (this.minionCount() >= 5) return;
    const e = new Enemy(t, x, y);
    e.minion = true; e.awake = true;
    if (t.flying) { e.y = y; }
    this.enemies.push(e);
    this.particles(x, y - 0.5, 10, 0xffffff, 3, 0.4, 0.1, 0);
  }

  // ------------------------------------------------------------------ player damage / death
  /** returns: -1 ignored, 0 hit, 1 blocked, 2 perfect block */
  hurtPlayer(dmg: number, fromX: number, blockable: boolean, _melee: boolean): number {
    const p = this.player;
    if (p.dead || p.victory || this.state === WS.Complete) return -1;
    if (blockable && p.blocking && p.frontOf(fromX)) {
      p.blockedSomething = true;
      if (p.blockT <= 0.12) { // PERFECT BLOCK window (GDD §4.2)
        this.addMeter(10);
        this.hitStop = 0.05;
        this.sfx(Sfx.PERFECT);
        this.events.push('perfect');
        this.pushFx('perfect', p.cx() + p.facing * 0.8, p.y + p.h - 1.1);
        vibrate(30);
        return 2;
      }
      this.sfx(Sfx.BLOCK);
      p.vx -= p.facing * 1.5;
      return 1;
    }
    if (p.invuln > 0 || p.smashT > 0) return -1;
    if (this.god) return 0;
    p.hp -= dmg;
    p.invuln = 0.7; p.hurtT = 0.22;
    const dir = fromX < p.cx() ? 1 : -1;
    p.vx = dir * 5; p.vy = Math.min(p.vy, -4);
    p.blocking = false;
    this.sfx(Sfx.HURT);
    this.shake(0.15, 0.15);
    this.particles(p.cx(), p.cy(), 8, 0xff5a4a, 4, 0.4, 0.1, 6);
    vibrate(40);
    if (p.hp <= 0) this.killPlayer();
    return 0;
  }

  private killPlayer() {
    const p = this.player;
    p.hp = 0; p.dead = true; p.deadT = 1.4;
    this.state = WS.Dying; this.stateT = 0;
    this.deaths++;
    this.explosionFx(p.cx(), p.cy(), 0.9);
    vibrate(120);
  }

  restartFromCheckpoint() {
    if (this.state === WS.Complete || this.state === WS.BossDead) return;
    this.player.dead = false;
    this.respawn();
  }

  private respawn() {
    const p = this.player;
    this.state = WS.Playing;
    this.clearEnemyProjs();
    for (const w of this.warns) w.active = false;
    this.strikes.length = 0;
    this.shield.active = false;
    if (this.arenaLocked && this.boss && !this.boss.dead()) {
      this.boss.resetPhase();
      for (const e of this.enemies) if (e.minion) e.alive = false;
      p.respawn(this.level.arenaX + 1.5, GROUND_Y);
    } else {
      p.respawn(this.cpX, this.groundTopAt(this.cpX + 0.35));
    }
    this.particles(p.cx(), p.cy(), 20, 0x7fe0ff, 5, 0.6, 0.1, 0);
  }

  private pitFall(dmg: number) {
    const p = this.player;
    if (this.god) dmg = 0;
    p.hp -= dmg;
    this.sfx(Sfx.HURT);
    vibrate(60);
    if (p.hp <= 0) { this.killPlayer(); return; }
    p.x = p.safeX; p.y = p.safeY - p.h; p.vx = 0; p.vy = 0; p.invuln = 1.2;
    this.particles(p.cx(), p.cy(), 12, 0x7fe0ff, 4, 0.5, 0.1, 0);
  }

  inLava(b: { x: number; w: number; y: number; h: number }) {
    for (const l of this.level.lavaPits) if (b.x + b.w > l.x0 && b.x < l.x1 && b.y + b.h > GROUND_Y + 0.6) return true;
    return false;
  }

  // ------------------------------------------------------------------ helpers used by entities
  solidAt(x: number, y: number) {
    for (const s of this.solids) {
      if (!s.enabled || s.type === SolidType.WALL) continue;
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true;
    }
    return false;
  }

  groundTopAt(x: number) {
    let best = GROUND_Y + 20;
    for (const s of this.solids) {
      if (s.type === SolidType.WALL || !s.enabled) continue;
      if (x >= s.x && x <= s.x + s.w && s.y < best && s.y > -5) best = s.y;
    }
    return best > GROUND_Y + 10 ? GROUND_Y : best;
  }

  private allocProj(): Proj | null {
    for (const p of this.projs) if (!p.active) { p.reset(); return p; }
    return null; // pool exhausted → drop (GDD perf: cap active projectiles)
  }

  firePlayer(kind: PK, x: number, y: number, vx: number, vy: number, dmg: number) {
    const p = this.allocProj();
    if (!p) return null;
    p.team = 0; p.kind = kind; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.dmg = dmg;
    p.w = 0.35; p.h = 0.35; p.life = 0.75;
    return p;
  }

  fireEnemy(kind: PK, x: number, y: number, vx: number, vy: number, dmg: number) {
    const p = this.allocProj();
    if (!p) return null;
    p.team = 1; p.kind = kind; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.dmg = dmg;
    p.w = 0.3; p.h = 0.3; p.life = 4;
    if (kind === PK.LASER) { p.w = 0.5; p.h = 0.15; }
    if (kind === PK.FIRE || kind === PK.PLASMA) { p.w = 0.4; p.h = 0.4; }
    if (kind === PK.MISSILE) { p.w = 0.4; p.h = 0.8; p.bomb = true; p.reflectable = false; }
    if (kind === PK.WEB) { p.reflectable = false; p.w = 0.5; p.h = 0.5; }
    this.sfx(Sfx.ENEMY_SHOT);
    return p;
  }

  clearEnemyProjs() { for (const p of this.projs) if (p.active && p.team === 1) p.active = false; }

  addWarn(x: number, y: number, w: number, h: number, dur: number, style: number) {
    for (const wn of this.warns) if (!wn.active) {
      wn.active = true; wn.x = x; wn.y = y; wn.w = w; wn.h = h; wn.t = 0; wn.dur = dur; wn.style = style;
      return;
    }
  }

  queueStrike(x: number, t: number, kind: PK) { this.strikes.push({ x, t, kind }); }

  private updateStrikes(dt: number) {
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      s.t -= dt;
      if (s.t > 0) continue;
      this.strikes.splice(i, 1);
      if (s.kind === PK.PILLAR) {
        const pr = this.fireEnemy(PK.PILLAR, s.x, GROUND_Y - 1.5, 0, 0, 18);
        if (pr) { pr.w = 0.8; pr.h = 3; pr.life = 0.6; pr.reflectable = false; pr.hitsGround = false; }
        this.shake(0.1, 0.1);
      } else {
        const fromTop = this.camY - 1;
        const pr = this.fireEnemy(s.kind, s.x, fromTop, 0, s.kind === PK.MISSILE ? 15 : 12, s.kind === PK.MISSILE ? 15 : 12);
        if (pr) { pr.reflectable = false; if (s.kind !== PK.MISSILE) { pr.w = 0.4; pr.h = 0.6; } }
      }
    }
  }

  particle(x: number, y: number, vx: number, vy: number, life: number, color: number, size: number, grav: number) {
    for (const p of this.particlesArr) if (!p.active) {
      p.active = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = p.max = life; p.color = color; p.size = size; p.grav = grav;
      return;
    }
  }

  particles(x: number, y: number, n: number, color: number, speed: number, life: number, size: number, grav: number) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, s = speed * (0.3 + rnd() * 0.7);
      this.particle(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + rnd() * 0.6), color, size * (0.6 + rnd() * 0.8), grav);
    }
  }

  explosionFx(x: number, y: number, scale: number) {
    this.pushFx('boom', x, y, scale);
    this.particles(x, y, Math.round(14 * scale), 0xffb03a, 6 * scale, 0.5, 0.18 * scale, 2);
    this.particles(x, y, Math.round(8 * scale), 0xff4a2a, 4 * scale, 0.6, 0.22 * scale, -1);
    this.particles(x, y, Math.round(6 * scale), 0x555555, 2 * scale, 0.9, 0.25 * scale, -2);
    this.sfx(Sfx.EXPLODE);
  }

  explode(x: number, y: number, r: number, dmgEnemies: number, dmgPlayer: number, fromPlayer: boolean) {
    this.explosionFx(x, y, r / 1.6);
    this.shake(0.2, 0.25);
    for (const e of this.enemies) {
      if (!e.alive || e.hidden()) continue;
      if (Math.hypot(e.cx() - x, e.cy() - y) < r + e.w * 0.5 && dmgEnemies > 0) e.hurt(this, dmgEnemies, x, true);
    }
    if (fromPlayer && this.boss && !this.boss.dead()) {
      const b = this.boss;
      const nx = clamp(x, b.x, b.x + b.w), ny = clamp(y, b.y, b.y + b.h);
      if (Math.hypot(nx - x, ny - y) < r) b.hurt(this, dmgEnemies, nx, ny);
    }
    for (const h of this.hazards) {
      if (h.alive && (h.type === HZ.BARREL || h.type === HZ.CRATE) && Math.hypot(h.x + h.w / 2 - x, h.y + h.h / 2 - y) < r + 0.5) this.damageHazard(h, 99);
    }
    const p = this.player;
    if (dmgPlayer > 0 && Math.hypot(p.cx() - x, p.cy() - y) < r + 0.3) this.hurtPlayer(dmgPlayer, x, false, false);
  }

  shake(t: number, mag: number) {
    if (this.shakeT <= 0 || mag >= this.shakeMag) this.shakeMag = mag;
    this.shakeT = Math.max(this.shakeT, Math.min(t, 0.35));
  }
  flash(color: number, t: number) { this.flashColor = color; this.flashT = t; }
  sfx(id: Sfx) { play(id); }
  showBanner(t: string, sub = '') { this.banner = t; this.bannerSub = sub; this.bannerT = 2.2; }
  addMeter(v: number) { const p = this.player; const was = p.ult; p.ult = Math.min(100, p.ult + v); if (was < 100 && p.ult >= 100) this.events.push('ultready'); }

  onEnemyKilled(e: Enemy, normal: boolean) {
    this.kills++;
    if (normal) {
      this.particles(e.cx(), e.cy(), 12, e.type.c1, 5, 0.5, 0.14, 8);
      this.particles(e.cx(), e.cy(), 6, 0xffffff, 3, 0.3, 0.08, 0);
      this.sfx(e.type.beh === 1 || e.type.key === 'robot' || e.type.key === 'cyborg' ? Sfx.EXPLODE : Sfx.HIT);
    }
    this.addMeter(2);
    if (e.minion) return;
    const r = rnd();
    if (r < 0.35) this.dropPickup(PU.COIN, e.cx(), e.cy());
    else if (r < 0.42) this.dropPickup(PU.HEALTH, e.cx(), e.cy());
    else if (r < 0.45) this.dropPickup([PU.DOUBLE, PU.TRIPLE, PU.SUPER, PU.PLASMA, PU.BOMB][rndi(5)], e.cx(), e.cy());
  }

  dropPickup(type: PU, x: number, y: number) {
    const pk = new Pickup(type, x, y, false);
    pk.vy = -5;
    this.pickups.push(pk);
  }

  // ------------------------------------------------------------------ player actions
  ultimate() {
    const p = this.player;
    p.ult = 0;
    const dmg = stats.ultDmg();
    this.sfx(Sfx.ULT);
    this.flash(0xc9a0ff, 0.35);
    this.shake(0.5, 0.35);
    this.hitStop = 0.06;
    this.pushFx('ult', p.cx(), p.cy());
    this.particles(p.cx(), p.cy(), 60, 0xc98cff, 10, 0.7, 0.18, 0);
    this.particles(p.cx(), p.cy(), 30, 0xffffff, 7, 0.5, 0.12, 0);
    const R = 6.5;
    for (const e of this.enemies) if (e.alive && !e.hidden() && Math.hypot(e.cx() - p.cx(), e.cy() - p.cy()) < R) e.hurt(this, dmg, p.cx(), true);
    if (this.boss && !this.boss.dead()) {
      const b = this.boss;
      const nx = clamp(p.cx(), b.x, b.x + b.w), ny = clamp(p.cy(), b.y, b.y + b.h);
      if (Math.hypot(nx - p.cx(), ny - p.cy()) < R + 1) b.hurt(this, dmg, b.cx(), b.cy());
    }
    for (const pr of this.projs) if (pr.active && pr.team === 1 && Math.hypot(pr.x - p.cx(), pr.y - p.cy()) < R + 2) pr.active = false;
    for (const h of this.hazards) if (h.alive && (h.type === HZ.BARREL || h.type === HZ.CRATE) && Math.abs(h.x - p.cx()) < R) this.damageHazard(h, 99);
    vibrate(80);
  }

  onSmashStart() { this.sfx(Sfx.SMASH); this.smashStamp++; }
  private smashStamp = 0;
  private smashHit = new Map<number, number>();

  smashHits(p: Player) {
    const dmg = Math.round(60 * stats.shieldMul());
    if (Math.random() < 0.6) this.particle(p.cx() - p.facing * 0.4, p.cy(), -p.facing * 3, rndr(-1, 1), 0.25, 0x7fe0ff, 0.15, 0);
    for (const e of this.enemies) {
      if (!e.alive || e.hidden() || this.smashHit.get(e.id) === this.smashStamp) continue;
      if (p.overlaps(e.x - 0.2, e.y, e.w + 0.4, e.h)) {
        this.smashHit.set(e.id, this.smashStamp);
        e.hurt(this, dmg, p.cx(), true);
        if (e.alive && !e.type.flying) { e.vx = p.facing * 9; e.vy = -5; }
        this.hitStop = 0.04;
        this.shake(0.12, 0.2);
        this.particles(e.cx(), e.cy(), 10, 0xffffff, 5, 0.3, 0.1, 0);
      }
    }
    const b = this.boss;
    if (b && this.smashHit.get(-1) !== this.smashStamp && b.hitTest(p.x - 0.2, p.y, p.w + 0.4, p.h)) {
      this.smashHit.set(-1, this.smashStamp);
      b.hurt(this, dmg, p.cx() + p.facing * 0.5, p.cy());
      p.smashT = 0; p.vx = -p.facing * 6; p.vy = -5; p.invuln = Math.max(p.invuln, 0.4);
      this.shake(0.15, 0.25);
    }
    for (const h of this.hazards) if (h.alive && (h.type === HZ.BARREL || h.type === HZ.CRATE) && p.overlaps(h.x, h.y, h.w, h.h)) this.damageHazard(h, 99);
  }

  shieldHits(s: Shield) {
    const r = 0.45;
    for (const e of this.enemies) {
      if (!e.alive || e.hidden() || e.shieldStamp === s.stamp) continue;
      if (e.overlaps(s.x - r, s.y - r, r * 2, r * 2)) {
        e.shieldStamp = s.stamp;
        e.hurt(this, s.dmg, s.x - s.vx, true);
        this.particles(s.x, s.y, 8, 0xffffff, 4, 0.25, 0.08, 0);
        this.pushFx('hit', s.x, s.y);
        this.sfx(Sfx.HIT);
        if (s.bomb && !s.exploded) { s.exploded = true; this.explode(s.x, s.y, 2.2, 30, 0, true); }
        if (s.ricochet && s.state === 'out') {
          // bounce to the nearest other enemy
          let best: Enemy | null = null, bd = 7;
          for (const o of this.enemies) {
            if (!o.alive || o === e || o.hidden()) continue;
            const d = Math.hypot(o.cx() - s.x, o.cy() - s.y);
            if (d < bd) { bd = d; best = o; }
          }
          if (best) s.redirect(best.cx(), best.cy()); else s.goBack();
        }
      }
    }
    const b = this.boss;
    if (b && b.hitTest(s.x - r, s.y - r, r * 2, r * 2) && b.shieldHit(s.stamp)) {
      b.hurt(this, s.dmg, s.x, s.y);
      this.particles(s.x, s.y, 10, 0xffffff, 5, 0.3, 0.1, 0);
      this.sfx(Sfx.HIT);
      if (s.bomb && !s.exploded) { s.exploded = true; this.explode(s.x, s.y, 2.2, 30, 0, true); }
      s.goBack();
    }
    for (const h of this.hazards) {
      if (h.alive && (h.type === HZ.BARREL || h.type === HZ.CRATE) && s.x > h.x - r && s.x < h.x + h.w + r && s.y > h.y - r && s.y < h.y + h.h + r) this.damageHazard(h, 99);
    }
  }

  // ------------------------------------------------------------------ projectiles
  private updateProjs(dt: number) {
    const pl = this.player;
    for (const p of this.projs) {
      if (!p.active) continue;
      p.age += dt; p.life -= dt;
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life <= 0) {
        p.active = false;
        if (p.kind === PK.EGG) this.spawnMinion(E.ALIENSPIDER, p.x, GROUND_Y);
        continue;
      }
      if (p.kind === PK.EGG) { // eggs land and wait to hatch
        if (p.y + p.h / 2 > GROUND_Y) { p.y = GROUND_Y - p.h / 2; p.vy = 0; p.vx *= 0.8; }
        continue;
      }
      if (p.hitsGround && this.solidAt(p.x, p.y)) {
        p.active = false;
        if (p.bomb) this.explode(p.x, p.y - 0.3, 1.3, 0, p.dmg, false);
        else this.particles(p.x, p.y, 4, p.team === 0 ? 0xbfe9ff : 0xffb03a, 2.5, 0.2, 0.06, 0);
        continue;
      }
      if (p.y > this.killY + 3 || p.y < this.camY - 8 || Math.abs(p.x - (this.camX + this.viewW / 2)) > this.viewW + 6) { p.active = false; continue; }

      if (p.team === 0) {
        const hw = p.w / 2, hh = p.h / 2;
        let consumed = false;
        for (const e of this.enemies) {
          if (!e.alive || e.hidden() || e.id === p.lastHitId) continue;
          if (e.overlaps(p.x - hw, p.y - hh, p.w, p.h)) {
            const applied = e.hurt(this, p.dmg, p.x - p.vx, p.kind === PK.REFLECT);
            this.particles(p.x, p.y, 3, 0xffffff, 3, 0.15, 0.06, 0);
            if (applied) this.sfx(Sfx.HIT);
            if (applied && p.pierce > 0) { p.pierce--; p.lastHitId = e.id; }
            else { consumed = true; break; }
          }
        }
        if (!consumed && this.boss && this.boss.hitTest(p.x - hw, p.y - hh, p.w, p.h)) {
          const dealt = this.boss.hurt(this, Math.max(1, Math.round(p.dmg * p.bossMul)), p.x, p.y);
          this.particles(p.x, p.y, 3, dealt > p.dmg ? 0xffe04a : 0xffffff, 3, 0.15, 0.06, 0);
          if (dealt > 0) this.pushFx('hit', p.x, p.y);
          if (this.boss.invulnerable() && dealt === 0) this.particles(p.x, p.y, 2, 0x8888aa, 2, 0.15, 0.05, 0);
          this.sfx(Sfx.HIT);
          consumed = true;
        }
        if (!consumed) {
          for (const h of this.hazards) {
            if (h.alive && (h.type === HZ.BARREL || h.type === HZ.CRATE) && p.x > h.x && p.x < h.x + h.w && p.y > h.y && p.y < h.y + h.h) {
              this.damageHazard(h, p.dmg); consumed = true; break;
            }
          }
        }
        if (consumed) p.active = false;
      } else {
        if (pl.dead) continue;
        if (pl.overlaps(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h)) {
          const res = this.hurtPlayer(p.dmg, p.x - Math.sign(p.vx || 1) * 0.6, p.reflectable || p.kind === PK.WEB, false);
          if (res === 2 && p.reflectable) {
            // PERFECT BLOCK: reflect, +10% ultimate, hit-stop
            p.team = 0; p.kind = PK.REFLECT; p.vx = -p.vx * 1.4; p.vy = -p.vy * 0.5 - 1; p.grav = 0;
            if (Math.abs(p.vx) < 6) p.vx = pl.facing * 10;
            p.dmg = Math.max(25, p.dmg * 3); p.life = 1.2; p.w = p.h = 0.45;
            this.particles(p.x, p.y, 12, 0x7fffe0, 5, 0.35, 0.1, 0);
          } else if (res === 2 || res === 1) {
            p.active = false;
            this.particles(p.x, p.y, 6, 0xffffff, 3, 0.2, 0.07, 0);
          } else if (res === 0) {
            if (p.kind === PK.WEB) pl.slowT = 1.6;
            if (p.kind !== PK.PILLAR && p.kind !== PK.LAVAWAVE && p.kind !== PK.WAVE) p.active = false;
          }
        }
      }
    }
  }

  private updateParticles(dt: number) {
    for (const p of this.particlesArr) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.vy += p.grav * dt;
      p.vx *= 1 - 1.5 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }

  // ------------------------------------------------------------------ hazards
  damageHazard(h: Hazard, dmg: number) {
    if (!h.alive) return;
    h.hp -= dmg;
    this.particles(h.x + h.w / 2, h.y + h.h / 2, 3, 0xd9a066, 2, 0.2, 0.06, 6);
    if (h.hp > 0) return;
    h.alive = false;
    if (h.type === HZ.BARREL) {
      this.explode(h.x + h.w / 2, h.y + h.h / 2, 2.6, 60, 15, true);
    } else {
      this.particles(h.x + h.w / 2, h.y + h.h / 2, 12, 0x9a6a3a, 4, 0.5, 0.12, 12);
      this.sfx(Sfx.HIT);
      const r = rnd();
      const t = r < 0.4 ? PU.COIN : r < 0.65 ? PU.HEALTH : [PU.DOUBLE, PU.TRIPLE, PU.SUPER, PU.PLASMA, PU.BOMB, PU.ULT][rndi(6)];
      this.dropPickup(t, h.x + h.w / 2, h.y);
      if (t === PU.COIN) { this.dropPickup(PU.COIN, h.x, h.y); this.dropPickup(PU.COIN, h.x + h.w, h.y); }
    }
  }

  private updateHazards(dt: number) {
    const p = this.player;
    for (const h of this.hazards) {
      if (!h.alive) continue;
      h.t += dt;
      if (h.hurtCd > 0) h.hurtCd -= dt;
      const ph = h.phase();
      switch (h.type) {
        case HZ.CRUSHER: {
          const headY = this.crusherHeadY(h);
          if (ph > 0.55 && ph < 0.8 && p.overlaps(h.x + 0.1, headY, h.w - 0.2, 1.3)) {
            if (this.hurtPlayer(25, h.x + h.w / 2, false, false) === 0) p.vx = (p.cx() < h.x + h.w / 2 ? -1 : 1) * 8;
          }
          if (ph > 0.6 && ph - dt / h.period <= 0.6 && Math.abs(h.x - p.x) < 14) { this.shake(0.1, 0.12); this.sfx(Sfx.SMASH); }
          break;
        }
        case HZ.LASER:
          if (ph > 0.7 && p.overlaps(h.x, h.y, h.w, h.h)) this.hurtPlayer(15, h.x + h.w / 2, false, false);
          break;
        case HZ.GEYSER:
          if (ph > 0.75 && p.overlaps(h.x, h.y, h.w, h.h)) {
            if (this.hurtPlayer(15, h.x + h.w / 2, false, false) === 0) p.vy = -12;
          }
          if (ph > 0.75 && rnd() < 0.7) this.particle(h.x + rnd() * h.w, h.y + h.h, rndr(-0.5, 0.5), -rndr(8, 12), 0.4, this.levelNum === 8 ? 0x7cff5a : 0xff8a2e, 0.18, 2);
          else if (ph > 0.55 && rnd() < 0.3) this.particle(h.x + rnd() * h.w, h.y + h.h, 0, -rndr(1, 3), 0.3, 0xffd04a, 0.1, 0);
          break;
        case HZ.SPIKES:
          if (p.overlaps(h.x, h.y, h.w, h.h) && this.hurtPlayer(15, h.x + h.w / 2, false, false) === 0) p.vy = -9;
          break;
        case HZ.ICICLE:
          if (!h.falling && h.triggered === 0 && Math.abs(p.cx() - (h.x + h.w / 2)) < 1.6 && p.y > h.y) h.triggered = 0.45;
          if (h.triggered > 0 && !h.falling) { h.triggered -= dt; if (h.triggered <= 0) { h.falling = true; h.triggered = -1; } }
          if (h.falling) {
            h.fallV += 30 * dt; h.y += h.fallV * dt;
            if (p.overlaps(h.x, h.y, h.w, h.h)) { this.hurtPlayer(12, h.x, false, false); h.alive = false; }
            if (this.solidAt(h.x + h.w / 2, h.y + h.h)) { h.alive = false; this.particles(h.x + h.w / 2, h.y + h.h, 10, 0xbfe9ff, 4, 0.4, 0.08, 10); this.sfx(Sfx.BLOCK); }
          }
          break;
      }
    }
    // lava pits
    if (!p.dead && this.inLava(p)) {
      this.particles(p.cx(), p.y + p.h, 10, 0xff6a1e, 4, 0.4, 0.12, -2);
      this.pitFall(20);
    }
  }

  crusherHeadY(h: Hazard) {
    const ph = h.phase();
    const top = h.y, bottom = h.y + h.h - 1.3;
    if (ph < 0.45) return top;
    if (ph < 0.6) return top + Math.sin(ph * 120) * 0.05; // shaking telegraph
    if (ph < 0.66) return top + (bottom - top) * ((ph - 0.6) / 0.06);
    if (ph < 0.8) return bottom;
    return bottom + (top - bottom) * ((ph - 0.8) / 0.2);
  }

  // ------------------------------------------------------------------ pickups
  private updatePickups(dt: number) {
    const p = this.player;
    for (const k of this.pickups) {
      if (!k.active) continue;
      k.t += dt;
      if (!k.floating) {
        k.life -= dt;
        if (k.life <= 0) { k.active = false; continue; }
        k.vy = Math.min(k.vy + 20 * dt, 12);
        k.y += k.vy * dt;
        if (this.solidAt(k.x, k.y + 0.3)) { k.y = this.groundTopAt(k.x) - 0.3; k.vy = 0; if (k.y < -5) k.y = GROUND_Y - 0.3; }
        if (k.y > this.killY) k.active = false;
      }
      const dx = p.cx() - k.x, dy = p.cy() - k.y;
      const d = Math.hypot(dx, dy);
      if (!p.dead && d < 2.2 && k.type === PU.COIN) { k.x += dx / d * 10 * dt; k.y += dy / d * 10 * dt; }
      if (!p.dead && d < 0.85) { k.active = false; this.collect(k.type); }
    }
    if (this.pickups.length > 60) this.pickups = this.pickups.filter(k => k.active);
  }

  private collect(t: PU) {
    const p = this.player;
    switch (t) {
      case PU.SUPER: p.superT = 30; break;
      case PU.DOUBLE: p.weapon = 1; p.weaponT = 30; break;
      case PU.TRIPLE: p.weapon = 2; p.weaponT = 30; break;
      case PU.PLASMA: p.plasmaT = 25; break;
      case PU.BOMB: p.bombT = 20; break;
      case PU.HEALTH: p.hp = Math.min(p.maxHp, p.hp + 30); break;
      case PU.ULT: this.addMeter(50); break;
      case PU.COIN: this.coinsEarned += 10; this.sfx(Sfx.COIN); return;
    }
    this.events.push('pickup:' + t);
    this.sfx(Sfx.PICKUP);
    this.particles(p.cx(), p.cy(), 10, 0xffffff, 3, 0.4, 0.08, 0);
  }

  // ------------------------------------------------------------------ environment
  private updateEnvironment(dt: number) {
    if (this.level.sandstorm && !this.arenaLocked) {
      this.stormT += dt;
      const cyc = this.stormT % 14;
      const was = this.storming;
      this.storming = cyc > 9;
      if (this.storming && !was) this.showBanner('BÃO CÁT!', 'Gió thổi ngược chiều');
      if (this.storming && !this.player.dead) this.player.x -= 1.6 * dt;
    } else this.storming = false;
  }
}

