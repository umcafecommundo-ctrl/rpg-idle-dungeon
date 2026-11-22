import { AFFIXES, baseMods, PREFIX, RARITY_AFFIXES, RARITY_MULT, RARITY_WEIGHT, SELL_MULT, SLOT_NAMES } from '../data/items';
import type { Item, Mods, Rarity, Slot } from '../data/types';
import { RARITIES, SLOTS } from '../data/types';
import { addMods } from './formulas';
import { pick, type Rng } from './rng';

let uid = 0;
const newId = () => Date.now().toString(36) + (uid++).toString(36) + Math.floor(Math.random() * 1e4).toString(36);

export function rollRarity(r: Rng, tier: 0 | 1 | 2, luck = 0): Rarity {
  const w = { ...RARITY_WEIGHT };
  if (tier >= 1) { w.raro *= 1.6; w.epico *= 2.5; w.lendario *= 3; }
  if (tier >= 2) { w.comum = 0; w.raro *= 1; w.epico *= 2.5; w.lendario *= 5; }
  w.epico *= 1 + luck; w.lendario *= 1 + luck;
  let tot = 0;
  for (const k of RARITIES) tot += w[k];
  let v = r() * tot;
  for (const k of RARITIES) { v -= w[k]; if (v <= 0) return k; }
  return 'comum';
}

export function rollItem(r: Rng, ilvl: number, tier: 0 | 1 | 2 = 0, slot?: Slot, luck = 0): Item {
  const sl = slot ?? pick(r, [...SLOTS]);
  const rar = rollRarity(r, tier, luck);
  const mult = RARITY_MULT[rar];
  const mods: Mods = baseMods(sl, ilvl, mult);
  const [lo, hi] = RARITY_AFFIXES[rar];
  const n = lo + Math.floor(r() * (hi - lo + 1));
  const pool = AFFIXES.slice();
  const names: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = pool.splice(Math.floor(r() * pool.length), 1)[0];
    addMods(mods, a.roll(ilvl, mult, r)); names.push(a.name);
  }
  const name = `${pick(r, SLOT_NAMES[sl])} ${pick(r, PREFIX[rar])}`;
  return { id: newId(), name, slot: sl, rarity: rar, ilvl, mods };
}

export const sellValue = (it: Item) => Math.round((5 + it.ilvl * 2.2) * SELL_MULT[it.rarity]);

const pct = (v: number) => `${+(v * 100).toFixed(1)}%`;
export const MOD_LABEL: [keyof Mods, string, boolean][] = [
  ['wAtk', 'Dano de arma', false], ['def', 'DEF', false], ['mdef', 'RES Mág.', false], ['hp', 'HP', false], ['mp', 'MP', false],
  ['for', 'FOR', false], ['agi', 'AGI', false], ['int', 'INT', false], ['vit', 'VIT', false], ['sab', 'SAB', false],
  ['crit', 'Crítico', true], ['critDmg', 'Dano crítico', true], ['aspd', 'Vel. ataque', true], ['cdr', 'Recarga', true],
  ['lifesteal', 'Roubo de vida', true], ['hpPct', 'HP', true], ['atkPct', 'Dano', true], ['regen', 'Regen/s', true],
  ['xpPct', 'XP', true], ['goldPct', 'Ouro', true], ['moveSpd', 'Velocidade', true],
];
export function describeMods(m: Mods, kindLabel: (k: string) => string): string[] {
  const out: string[] = [];
  for (const [k, l, p] of MOD_LABEL) { const v = m[k] as number | undefined; if (v) out.push(`+${p ? pct(v) : Math.round(v)} ${l}`); }
  if (m.vs) for (const k in m.vs) out.push(`+${pct(m.vs[k as keyof typeof m.vs]!)} dano vs ${kindLabel(k)}`);
  if (m.elem) for (const k in m.elem) out.push(`+${pct(m.elem[k as keyof typeof m.elem]!)} dano ${k}`);
  return out;
}
export function itemScore(it: Item): number {
  let s = 0;
  for (const k in it.mods) { const v = it.mods[k as keyof Mods]; if (typeof v === 'number') s += k === 'wAtk' ? v * 2 : v < 1 ? v * 400 : v; else if (v) for (const kk in v) s += (v as Record<string, number>)[kk] * 300; }
  return s;
}
