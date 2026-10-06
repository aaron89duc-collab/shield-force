import { save } from './save';

/**
 * Procedural placeholder audio (GDD §18: no copyrighted SFX/music).
 * Buffers are synthesized once with WebAudio; the context is unlocked on the first user gesture.
 */
export enum Sfx {
  SHOT, THROW, CATCH, PERFECT, HIT, BOSS_PHASE, CHECKPOINT, VICTORY, EXPLODE, HURT,
  PICKUP, JUMP, ULT, SMASH, BLOCK, ENEMY_SHOT, CLICK, COIN,
}

const RATE = 22050;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers: AudioBuffer[] = [];
let musicBuf: AudioBuffer | null = null;
let musicSrc: AudioBufferSourceNode | null = null;
let musicGain: GainNode | null = null;
const lastPlay: number[] = [];

let nseed = 1234567;
function noise() { nseed = (Math.imul(nseed, 1103515245) + 12345) >>> 0; return ((nseed >>> 8) & 0xffff) / 32768 - 1; }

function put(b: Float32Array, i: number, v: number) { b[i] = Math.max(-1, Math.min(1, b[i] + v)); }

function tone(b: Float32Array, start: number, dur: number, f0: number, f1: number, vol: number, wave: number) {
  const s = Math.floor(start * RATE), n = Math.floor(dur * RATE);
  let ph = 0;
  for (let i = 0; i < n && s + i < b.length; i++) {
    const t = i / n, f = f0 + (f1 - f0) * t;
    ph += f / RATE;
    const p = ph - Math.floor(ph);
    let v: number;
    switch (wave) {
      case 1: v = p < 0.5 ? 1 : -1; break;
      case 2: v = p * 2 - 1; break;
      case 3: v = p < 0.5 ? p * 4 - 1 : 3 - p * 4; break;
      default: v = Math.sin(ph * Math.PI * 2);
    }
    const env = Math.min(1, i / (RATE * 0.004)) * (1 - t) * (1 - t);
    put(b, s + i, v * vol * env);
  }
}

function burst(b: Float32Array, start: number, dur: number, vol: number, lp: number) {
  const s = Math.floor(start * RATE), n = Math.floor(dur * RATE);
  let y = 0;
  for (let i = 0; i < n && s + i < b.length; i++) {
    const t = i / n;
    y += (noise() - y) * lp;
    put(b, s + i, y * vol * (1 - t) * (1 - t));
  }
}

function make(id: Sfx): Float32Array {
  const B = (sec: number) => new Float32Array(Math.floor(RATE * sec));
  let b: Float32Array;
  switch (id) {
    case Sfx.SHOT: b = B(0.09); tone(b, 0, 0.09, 1400, 500, 0.18, 1); break;
    case Sfx.ENEMY_SHOT: b = B(0.12); tone(b, 0, 0.12, 700, 250, 0.15, 2); break;
    case Sfx.THROW: b = B(0.35); burst(b, 0, 0.35, 0.5, 0.15); tone(b, 0, 0.3, 300, 900, 0.15, 3); break;
    case Sfx.CATCH: b = B(0.25); tone(b, 0, 0.25, 1800, 1700, 0.22, 0); tone(b, 0, 0.2, 2700, 2600, 0.12, 0); burst(b, 0, 0.04, 0.4, 0.6); break;
    case Sfx.PERFECT: b = B(0.45); burst(b, 0, 0.05, 0.7, 0.8); tone(b, 0.02, 0.4, 1568, 1568, 0.28, 0); tone(b, 0.1, 0.35, 2093, 2093, 0.22, 0); break;
    case Sfx.HIT: b = B(0.08); burst(b, 0, 0.08, 0.45, 0.5); tone(b, 0, 0.06, 300, 120, 0.2, 1); break;
    case Sfx.BOSS_PHASE: b = B(1.0); tone(b, 0, 1, 110, 55, 0.4, 2); tone(b, 0, 1, 165, 80, 0.3, 1); burst(b, 0, 0.5, 0.4, 0.1); break;
    case Sfx.CHECKPOINT: b = B(0.45); tone(b, 0, 0.12, 659, 659, 0.22, 3); tone(b, 0.1, 0.12, 880, 880, 0.22, 3); tone(b, 0.2, 0.25, 1319, 1319, 0.22, 3); break;
    case Sfx.VICTORY: {
      b = B(1.6);
      const n = [523, 659, 784, 1047, 784, 1047], st = [0, 0.15, 0.3, 0.45, 0.75, 0.9];
      for (let i = 0; i < n.length; i++) { tone(b, st[i], i === 5 ? 0.7 : 0.2, n[i], n[i], 0.22, 1); tone(b, st[i], 0.3, n[i] / 2, n[i] / 2, 0.14, 3); }
      break;
    }
    case Sfx.EXPLODE: b = B(0.6); burst(b, 0, 0.6, 0.9, 0.08); tone(b, 0, 0.4, 120, 40, 0.4, 0); break;
    case Sfx.HURT: b = B(0.2); tone(b, 0, 0.2, 400, 150, 0.28, 2); break;
    case Sfx.PICKUP: b = B(0.25); tone(b, 0, 0.08, 880, 880, 0.2, 1); tone(b, 0.07, 0.15, 1320, 1760, 0.2, 1); break;
    case Sfx.COIN: b = B(0.15); tone(b, 0, 0.05, 1976, 1976, 0.12, 1); tone(b, 0.04, 0.1, 2637, 2637, 0.12, 1); break;
    case Sfx.JUMP: b = B(0.12); tone(b, 0, 0.12, 300, 600, 0.13, 3); break;
    case Sfx.ULT: b = B(1.0); tone(b, 0, 1, 200, 1200, 0.3, 2); burst(b, 0.2, 0.8, 0.8, 0.1); break;
    case Sfx.SMASH: b = B(0.3); burst(b, 0, 0.3, 0.6, 0.3); tone(b, 0, 0.25, 200, 80, 0.32, 1); break;
    case Sfx.BLOCK: b = B(0.12); tone(b, 0, 0.12, 1200, 1100, 0.2, 0); burst(b, 0, 0.03, 0.4, 0.7); break;
    case Sfx.CLICK: b = B(0.05); tone(b, 0, 0.05, 1000, 1000, 0.15, 3); break;
    default: b = B(0.05);
  }
  return b;
}

function makeMusic(): Float32Array {
  const beat = 60 / 150, bars = 8;
  const b = new Float32Array(Math.floor(RATE * beat * 4 * bars));
  const bass = [110, 110, 131, 98, 110, 147, 131, 98];
  const lead = [440, 523, 587, 523, 659, 587, 523, 494];
  for (let bar = 0; bar < bars; bar++) {
    const root = bass[bar];
    for (let s = 0; s < 8; s++) {
      const t = (bar * 4 + s * 0.5) * beat;
      tone(b, t, beat * 0.45, root, root, 0.11, 1);
      if (s % 2 === 0) burst(b, t, 0.05, s % 4 === 0 ? 0.22 : 0.1, s % 4 === 0 ? 0.08 : 0.7);
    }
    if (bar % 2 === 1) {
      for (let s = 0; s < 4; s++) {
        const f = lead[(bar * 3 + s) % lead.length];
        tone(b, (bar * 4 + s) * beat, beat * 0.8, f, f, 0.05, 3);
      }
    }
  }
  return b;
}

function toBuffer(data: Float32Array): AudioBuffer {
  const buf = ctx!.createBuffer(1, data.length, RATE);
  buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
  return buf;
}

/** Call from a user gesture. Safe to call many times. */
export function unlockAudio() {
  try {
    if (!ctx) {
      const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(ctx.destination);
      for (let i = 0; i <= Sfx.COIN; i++) buffers[i] = toBuffer(make(i));
      musicBuf = toBuffer(makeMusic());
    }
    if (ctx.state === 'suspended') void ctx.resume();
    updateMusic();
  } catch { /* audio unavailable */ }
}

export function play(id: Sfx) {
  if (!ctx || !master || !save.soundEnabled) return;
  const now = ctx.currentTime;
  if (lastPlay[id] !== undefined && now - lastPlay[id] < 0.035) return; // de-dup spam
  lastPlay[id] = now;
  const src = ctx.createBufferSource();
  src.buffer = buffers[id];
  src.connect(master);
  src.start();
}

export function updateMusic() {
  if (!ctx || !master || !musicBuf) return;
  const want = save.musicEnabled;
  if (want && !musicSrc) {
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.45;
    musicGain.connect(master);
    musicSrc = ctx.createBufferSource();
    musicSrc.buffer = musicBuf;
    musicSrc.loop = true;
    musicSrc.connect(musicGain);
    musicSrc.start();
  } else if (!want && musicSrc) {
    musicSrc.stop();
    musicSrc.disconnect();
    musicSrc = null;
  }
}

export function suspendAudio(s: boolean) {
  if (!ctx) return;
  if (s) void ctx.suspend(); else void ctx.resume();
}
