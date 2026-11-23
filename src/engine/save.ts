import { CLASS_BY_ID } from '../data/classes';
import type { Activity, Item, Slot, Stat } from '../data/types';
import { zeroStats } from './formulas';

export interface CharSave {
  level: number; xp: number; alloc: Record<Stat, number>; auto: boolean;
  talents: Record<string, number>; equipped: Partial<Record<Slot, Item>>; skillAuto: Record<string, boolean>;
}
export interface Onboard {
  hints: string[]; quest: number; progress: number; levelRewards: number[];
  firstTown: boolean; chestOpen: boolean; offlineGift: 'none' | 'pending' | 'claimed'; started: number;
}
export const newOnboard = (): Onboard => ({ hints: [], quest: 0, progress: 0, levelRewards: [], firstTown: false, chestOpen: false, offlineGift: 'none', started: Date.now() });
/** Saves antigos (sem onboarding) são tratados como tutorial concluído. */
export const doneOnboard = (): Onboard => ({ hints: ['start', 'skill', 'potion', 'item', 'levelup', 'town', 'death', 'boss', 'maps'], quest: 99, progress: 0, levelRewards: [2, 3, 4, 5, 6, 7, 8, 9, 10], firstTown: true, chestOpen: true, offlineGift: 'claimed', started: 0 });

export interface SaveData {
  v: 1; ts: number; active: string; chars: Record<string, CharSave>;
  gold: number; inventory: Item[]; potions: { hp: number; mp: number };
  settings: { autoPot: boolean; hpTh: number; mpTh: number; autoSell: 'none' | 'comum' | 'raro'; sound: boolean };
  gems: number; cons: Record<string, number>; boosts: Record<string, number>;
  shop: { win: number; bought: string[] }; inTown: boolean;
  onboard: Onboard;
  mapId: string; activity: Activity; floor: number; bestFloor: Record<string, number>;
  rebirths: number; mercs: (string | null)[];
  stats: { kills: number; deaths: number; bosses: number; items: number };
}
export const SAVE_KEY = 'masmorra-idle.save.v1';
export const MAX_INV = 80;

export const newChar = (): CharSave => ({ level: 1, xp: 0, alloc: zeroStats(), auto: true, talents: {}, equipped: {}, skillAuto: {} });

export function newSave(classId: string): SaveData {
  return {
    v: 1, ts: Date.now(), active: classId, chars: { [classId]: newChar() }, gold: 100, inventory: [], potions: { hp: 5, mp: 3 },
    settings: { autoPot: true, hpTh: 0.4, mpTh: 0.25, autoSell: 'comum', sound: true },
    gems: 0, cons: {}, boosts: {}, shop: { win: 0, bought: [] }, inTown: false, onboard: newOnboard(),
    mapId: 'esgoto', activity: 'solo', floor: 1, bestFloor: {}, rebirths: 0, mercs: ['cavaleiro', 'clerigo', 'mago'],
    stats: { kills: 0, deaths: 0, bosses: 0, items: 0 },
  };
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? validate(JSON.parse(raw)) : null;
  } catch { return null; }
}
export function writeSave(s: SaveData) {
  try { s.ts = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* quota/privado */ }
}

/** Valida e completa campos faltantes (migração simples). */
export function validate(o: unknown): SaveData {
  const s = o as SaveData;
  if (!s || typeof s !== 'object' || s.v !== 1 || !CLASS_BY_ID[s.active] || !s.chars || typeof s.chars !== 'object') throw new Error('Save inválido');
  const base = newSave(s.active);
  const out: SaveData = { ...base, ...s, settings: { ...base.settings, ...s.settings }, stats: { ...base.stats, ...s.stats }, potions: { ...base.potions, ...s.potions }, cons: { ...s.cons }, boosts: { ...s.boosts }, shop: { ...base.shop, ...s.shop }, onboard: s.onboard ? { ...newOnboard(), ...s.onboard } : doneOnboard() };
  for (const id of Object.keys(out.chars)) {
    if (!CLASS_BY_ID[id]) { delete out.chars[id]; continue; }
    out.chars[id] = { ...newChar(), ...out.chars[id], alloc: { ...zeroStats(), ...out.chars[id].alloc } };
    out.chars[id].level = Math.max(1, Math.min(200, Math.floor(out.chars[id].level)));
  }
  if (!out.chars[out.active]) out.chars[out.active] = newChar();
  if (!Array.isArray(out.inventory)) out.inventory = [];
  if (!Array.isArray(out.mercs)) out.mercs = base.mercs;
  return out;
}

export function exportSave(s: SaveData): string {
  return 'MIDLE1:' + btoa(unescape(encodeURIComponent(JSON.stringify(s))));
}
export function importSave(text: string): SaveData {
  const t = text.trim().replace(/^MIDLE1:/, '');
  return validate(JSON.parse(decodeURIComponent(escape(atob(t)))));
}
