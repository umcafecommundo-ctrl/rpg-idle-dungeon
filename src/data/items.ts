// Tabelas de itens: multiplicadores de raridade, bases por slot e afixos aleatórios.
import type { Mods, MobKind, Rarity, Slot } from './types';
import { MOB_KINDS } from './types';

export const RARITY_MULT: Record<Rarity, number> = { comum: 1, raro: 1.3, epico: 1.7, lendario: 2.3 };
export const RARITY_AFFIXES: Record<Rarity, [number, number]> = { comum: [0, 0], raro: [1, 2], epico: [2, 3], lendario: [3, 4] };
export const RARITY_WEIGHT: Record<Rarity, number> = { comum: 70, raro: 22, epico: 7, lendario: 0.6 };
export const SELL_MULT: Record<Rarity, number> = { comum: 1, raro: 3, epico: 9, lendario: 30 };

export const SLOT_NAMES: Record<Slot, string[]> = {
  arma: ['Lâmina', 'Cajado', 'Machado', 'Arco', 'Maça', 'Cetro'],
  elmo: ['Elmo', 'Capuz', 'Coroa'],
  armadura: ['Armadura', 'Manto', 'Couraça'],
  calca: ['Calça', 'Grevas', 'Saiote'],
  bota: ['Botas', 'Sandálias', 'Coturnos'],
  anel: ['Anel', 'Aliança', 'Sinete'],
  amuleto: ['Amuleto', 'Colar', 'Talismã'],
};
export const PREFIX: Record<Rarity, string[]> = {
  comum: ['Gasto', 'Simples', 'Rústico'],
  raro: ['Reforçado', 'Afiado', 'Nobre'],
  epico: ['Ancestral', 'Rúnico', 'Sombrio'],
  lendario: ['Divino', 'Infernal', 'do Titã', 'do Apocalipse'],
};

/** Base fixa por slot, escalada por ilvl * raridade. */
export function baseMods(slot: Slot, ilvl: number, mult: number): Mods {
  const v = (k: number) => Math.round(ilvl * k * mult + k * 2);
  switch (slot) {
    case 'arma': return { wAtk: v(0.9) };
    case 'elmo': return { def: v(0.9), hp: v(3) };
    case 'armadura': return { def: v(1.4), hp: v(5) };
    case 'calca': return { def: v(1.0), hp: v(3.5) };
    case 'bota': return { def: v(0.6), mdef: v(0.6), moveSpd: 0.04 * mult };
    case 'anel': return { mdef: v(0.5), crit: 0.01 * mult };
    case 'amuleto': return { hp: v(2.5), mp: v(2) };
  }
}

type Affix = { name: string; roll: (ilvl: number, mult: number, r: () => number) => Mods };
const flat = (k: keyof Mods, f: number): Affix['roll'] => (il, m, r) => ({ [k]: Math.max(1, Math.round((il * f * m + 2) * (0.8 + r() * 0.4))) });
const pct = (k: keyof Mods, lo: number, hi: number): Affix['roll'] => (_il, m, r) => ({ [k]: +((lo + (hi - lo) * r()) * m).toFixed(3) });

export const AFFIXES: Affix[] = [
  { name: 'FOR', roll: flat('for', 0.35) }, { name: 'AGI', roll: flat('agi', 0.35) }, { name: 'INT', roll: flat('int', 0.35) },
  { name: 'VIT', roll: flat('vit', 0.35) }, { name: 'SAB', roll: flat('sab', 0.35) },
  { name: 'Crítico', roll: pct('crit', 0.015, 0.03) }, { name: 'Vel. Ataque', roll: pct('aspd', 0.03, 0.06) },
  { name: 'Roubo de Vida', roll: pct('lifesteal', 0.01, 0.025) }, { name: 'HP%', roll: pct('hpPct', 0.04, 0.08) },
  { name: 'Dano%', roll: pct('atkPct', 0.03, 0.06) }, { name: 'Recarga', roll: pct('cdr', 0.03, 0.06) },
  { name: 'XP%', roll: pct('xpPct', 0.04, 0.08) }, { name: 'Ouro%', roll: pct('goldPct', 0.05, 0.1) },
  { name: 'Regen', roll: pct('regen', 0.002, 0.005) },
  // bônus contra tipos de mob
  ...MOB_KINDS.map((k: MobKind): Affix => ({ name: 'vs ' + k, roll: (_il, m, r) => ({ vs: { [k]: +((0.05 + 0.07 * r()) * m).toFixed(3) } }) })),
];
