/** SaveData (GDD §14) persisted to localStorage (web equivalent of PlayerPrefs), versioned. */
export const LEVEL_COUNT = 10;
const KEY = 'shieldforce.save';
const VERSION = 1;

export interface SaveData {
  version: number;
  highestUnlockedLevel: number;
  completedLevels: number[];
  coins: number;
  hpUpgrade: number;
  shieldUpgrade: number;
  speedUpgrade: number;
  throwUpgrade: number;
  ultimateUpgrade: number;
  vibrationEnabled: boolean;
  soundEnabled: boolean;
  musicEnabled: boolean;
  buttonLayout: number; // 0 default, 1 mirrored, 2 large
  bestTime: number[];
  outfit: { top: string; pants: string; shoes: string };
  owned: string[]; // outfit item ids bought in the wardrobe shop
}

function defaults(): SaveData {
  return {
    version: VERSION, highestUnlockedLevel: 1, completedLevels: [], coins: 0,
    hpUpgrade: 1, shieldUpgrade: 1, speedUpgrade: 1, throwUpgrade: 1, ultimateUpgrade: 1,
    vibrationEnabled: true, soundEnabled: true, musicEnabled: true, buttonLayout: 0,
    bestTime: new Array(LEVEL_COUNT).fill(0),
    outfit: { top: 'top_navy', pants: 'pants_navy', shoes: 'shoes_boot' },
    owned: ['top_navy', 'pants_navy', 'shoes_boot'],
  };
}

function migrate(raw: any): SaveData {
  const d = defaults();
  if (!raw || typeof raw !== 'object') return d;
  const out: SaveData = { ...d, ...raw, version: VERSION };
  const lv = (v: any) => Math.min(5, Math.max(1, Number(v) || 1));
  out.highestUnlockedLevel = Math.min(LEVEL_COUNT, Math.max(1, Number(out.highestUnlockedLevel) || 1));
  out.coins = Math.max(0, Number(out.coins) || 0);
  out.hpUpgrade = lv(out.hpUpgrade); out.shieldUpgrade = lv(out.shieldUpgrade); out.speedUpgrade = lv(out.speedUpgrade);
  out.throwUpgrade = lv(out.throwUpgrade); out.ultimateUpgrade = lv(out.ultimateUpgrade);
  if (!Array.isArray(out.completedLevels)) out.completedLevels = [];
  if (!Array.isArray(out.bestTime) || out.bestTime.length !== LEVEL_COUNT) out.bestTime = d.bestTime;
  if (!Array.isArray(out.owned)) out.owned = d.owned;
  for (const id of d.owned) if (!out.owned.includes(id)) out.owned.push(id);
  if (!out.outfit || typeof out.outfit !== 'object') out.outfit = { ...d.outfit };
  for (const k of ['top', 'pants', 'shoes'] as const) if (typeof out.outfit[k] !== 'string' || !out.owned.includes(out.outfit[k])) out.outfit[k] = d.outfit[k];
  return out;
}

export const save: SaveData = load();

function load(): SaveData {
  try {
    const s = localStorage.getItem(KEY);
    return migrate(s ? JSON.parse(s) : null);
  } catch { return defaults(); }
}

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* private mode: keep in memory */ }
}

export function resetSave() {
  Object.assign(save, defaults());
  persist();
}

// ---- Upgrade tables (GDD §12) ----
export const MAX_HP = [100, 110, 120, 135, 150];
export const SHIELD_DMG = [1.0, 1.1, 1.25, 1.45, 1.7];
export const MOVE_SPEED = [5.0, 5.2, 5.4, 5.6, 5.8];
export const THROW_DMG = [35, 40, 46, 54, 65];
export const ULT_DMG = [150, 170, 195, 225, 260];
export const UPGRADE_COST = [0, 150, 300, 500, 800];

export const stats = {
  maxHp: () => MAX_HP[save.hpUpgrade - 1],
  shieldMul: () => SHIELD_DMG[save.shieldUpgrade - 1],
  moveSpeed: () => MOVE_SPEED[save.speedUpgrade - 1],
  throwDmg: () => THROW_DMG[save.throwUpgrade - 1],
  ultDmg: () => ULT_DMG[save.ultimateUpgrade - 1],
};

export function vibrate(ms: number) {
  if (!save.vibrationEnabled) return;
  try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
}
