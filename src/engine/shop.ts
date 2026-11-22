// Regras do ferreiro/mercado: estoque rotativo, preços, melhorias e durabilidade.
import { RARITY_MULT } from '../data/items';
import { BUY_MULT, plusMult, REPAIR_RATE, STOCK_HOURS } from '../data/shops';
import type { Item, Mods, Slot } from '../data/types';
import { SLOTS } from '../data/types';
import { sellValue, rollItem } from './loot';
import { mulberry32 } from './rng';

/** Mods efetivos: escala pela melhoria (+N) e reduz pela durabilidade baixa. */
export function effMods(it: Item): Mods {
  const k = plusMult(it.plus ?? 0) * ((it.dur ?? 100) < 20 ? 0.5 : 1);
  if (k === 1) return it.mods;
  const out: Mods = {};
  for (const key in it.mods) {
    const v = it.mods[key as keyof Mods];
    if (typeof v === 'number') (out as Record<string, number>)[key] = v * k;
    else if (v) (out as Record<string, unknown>)[key] = Object.fromEntries(Object.entries(v).map(([a, b]) => [a, (b as number) * k]));
  }
  return out;
}

export const itemName = (it: Item) => it.name + (it.plus ? ` +${it.plus}` : '');
export const buyPrice = (it: Item) => sellValue(it) * BUY_MULT;
export const sellPrice = (it: Item) => Math.round(sellValue(it) * (1 + (it.plus ?? 0) * 0.35) * ((it.dur ?? 100) < 20 ? 0.7 : 1));

export const stockWindow = (now = Date.now()) => Math.floor(now / (STOCK_HOURS * 3600e3));
export const stockRemainingMs = (now = Date.now()) => (stockWindow(now) + 1) * STOCK_HOURS * 3600e3 - now;

const STOCK_SLOTS: Slot[] = ['arma', 'arma', 'elmo', 'armadura', 'calca', 'bota'];
/** Estoque determinístico por janela de tempo e faixa de nível (igual para todas as visitas na janela). */
export function blacksmithStock(level: number, win = stockWindow()): Item[] {
  const bucket = Math.floor(level / 4);
  const r = mulberry32(win * 7919 + bucket * 104729 + 17);
  return STOCK_SLOTS.map((slot, i) => {
    let it = rollItem(r, Math.max(1, level + Math.floor(r() * 4) - 1), 0, slot, 0.3);
    for (let t = 0; t < 6 && it.rarity === 'lendario'; t++) it = rollItem(r, Math.max(1, level), 0, slot, 0.3);
    it.id = `shop-${win}-${bucket}-${i}`;
    return it;
  });
}

export const repairCost = (it: Item) => Math.round(((100 - (it.dur ?? 100)) / 100) * it.ilvl * 12 * REPAIR_RATE * RARITY_MULT[it.rarity]) + ((it.dur ?? 100) < 100 ? 5 : 0);
export const equippedList = (eq: Partial<Record<Slot, Item>>) => SLOTS.map((s) => eq[s]).filter(Boolean) as Item[];
