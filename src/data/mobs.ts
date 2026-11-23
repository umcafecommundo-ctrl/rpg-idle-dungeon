// 10 tipos de mob + chefes. Valores são multiplicadores sobre a curva de referência (ver engine/formulas.ts).
import type { DmgType, MobDef, MobKind } from './types';

/** Resistência/fraqueza padrão por categoria (1 = neutro, 0 = imune, >1 = fraco). */
export const KIND_RES: Record<MobKind, Partial<Record<DmgType, number>>> = {
  fera: { fogo: 1.2, veneno: 1.2 },
  morto: { sagrado: 1.6, fogo: 1.5, veneno: 0, sombrio: 0.5, gelo: 0.8, fisico: 0.9 },
  demonio: { sagrado: 1.5, gelo: 1.3, fogo: 0.4, sombrio: 0.5 },
  elemental: { fisico: 0.6, veneno: 0.5 },
  construto: { fisico: 0.55, raio: 1.5, veneno: 0, sombrio: 0.8, gelo: 0.8 },
  voador: { raio: 1.3, gelo: 1.2 },
  humanoide: { sombrio: 1.15 },
};

export const MOBS: MobDef[] = [
  { id: 'rato', name: 'Rato Gigante', kind: 'fera', hp: 0.7, atk: 0.8, def: 0.5, spd: 2.2, interval: 1.2, range: 1.2, dmg: 'fisico', xp: 0.8, gold: 0.8, sprite: 'rato', color: '#8a7a6a' },
  { id: 'lobo', name: 'Lobo Sombrio', kind: 'fera', hp: 1.0, atk: 1.1, def: 0.8, spd: 2.8, interval: 1.1, range: 1.2, dmg: 'fisico', xp: 1.0, gold: 1.0, sprite: 'lobo', color: '#6a6a80' },
  { id: 'morcego', name: 'Morcego Vampiro', kind: 'voador', hp: 0.6, atk: 0.8, def: 0.3, spd: 3.2, interval: 1.0, range: 1.2, dmg: 'fisico', xp: 0.9, gold: 0.8, flying: true, sprite: 'morcego', color: '#7a3a5a' },
  { id: 'esqueleto', name: 'Esqueleto', kind: 'morto', hp: 0.9, atk: 1.0, def: 1.0, spd: 1.8, interval: 1.3, range: 1.3, dmg: 'fisico', xp: 1.0, gold: 1.0, sprite: 'esqueleto', color: '#d8d8c0' },
  { id: 'zumbi', name: 'Zumbi', kind: 'morto', hp: 1.7, atk: 1.0, def: 0.8, spd: 0.9, interval: 1.8, range: 1.2, dmg: 'fisico', xp: 1.1, gold: 1.0, slow: true, regen: 0.015, sprite: 'zumbi', color: '#6a9a60' },
  { id: 'bandido', name: 'Bandido', kind: 'humanoide', hp: 1.0, atk: 1.2, def: 1.0, spd: 2.0, interval: 1.2, range: 1.3, dmg: 'fisico', xp: 1.1, gold: 1.6, sprite: 'bandido', color: '#a05a40' },
  { id: 'imp', name: 'Diabrete', kind: 'demonio', hp: 0.8, atk: 1.3, def: 0.7, spd: 2.0, interval: 1.6, range: 4.0, dmg: 'fogo', xp: 1.2, gold: 1.2, sprite: 'imp', color: '#c03040' },
  { id: 'golem', name: 'Golem de Pedra', kind: 'construto', hp: 2.6, atk: 1.4, def: 2.5, spd: 0.9, interval: 2.2, range: 1.4, dmg: 'fisico', xp: 1.4, gold: 1.1, slow: true, sprite: 'golem', color: '#8a8a90' },
  { id: 'elemental', name: 'Elemental de Fogo', kind: 'elemental', hp: 1.2, atk: 1.3, def: 0.8, spd: 1.5, interval: 1.6, range: 3.5, dmg: 'fogo', xp: 1.3, gold: 1.0, res: { fogo: 0, gelo: 1.8, fisico: 0.6, veneno: 0.5 }, sprite: 'elemental', color: '#ff6a2a' },
  { id: 'slime', name: 'Gosma Tóxica', kind: 'elemental', hp: 1.4, atk: 0.7, def: 0.6, spd: 1.0, interval: 1.4, range: 1.2, dmg: 'veneno', xp: 0.9, gold: 0.7, res: { veneno: 0, fisico: 0.5, fogo: 1.4, raio: 1.2 }, slow: true, regen: 0.01, sprite: 'slime', color: '#5ac85a' },
];

export const BOSSES: MobDef[] = [
  { id: 'rei_rato', name: 'Rei Rato', kind: 'fera', hp: 9, atk: 1.6, def: 1.2, spd: 2.0, interval: 1.2, range: 1.5, dmg: 'fisico', xp: 14, gold: 12, sprite: 'rato', color: '#b09060', boss: true, mechs: ['adds', 'enrage'], scale: 2.2 },
  { id: 'alfa', name: 'Alfa Uivante', kind: 'fera', hp: 10, atk: 1.7, def: 1.3, spd: 2.6, interval: 1.1, range: 1.6, dmg: 'fisico', xp: 14, gold: 12, sprite: 'lobo', color: '#9a9ab8', boss: true, mechs: ['enrage', 'stomp'], scale: 2.2 },
  { id: 'lich', name: 'Lich Antigo', kind: 'morto', hp: 11, atk: 1.7, def: 1.5, spd: 1.2, interval: 1.8, range: 5, dmg: 'sombrio', xp: 15, gold: 14, sprite: 'esqueleto', color: '#9a60ff', boss: true, mechs: ['adds', 'stomp'], scale: 2.2 },
  { id: 'colosso', name: 'Colosso de Areia', kind: 'construto', hp: 14, atk: 1.8, def: 3.2, spd: 1.0, interval: 2.2, range: 1.8, dmg: 'fisico', xp: 16, gold: 14, sprite: 'golem', color: '#d8b060', boss: true, mechs: ['stomp', 'enrage'], scale: 2.4 },
  { id: 'titan', name: 'Titã de Magma', kind: 'elemental', hp: 12, atk: 1.9, def: 1.4, spd: 1.4, interval: 1.7, range: 4, dmg: 'fogo', xp: 16, gold: 14, res: { fogo: 0, gelo: 1.6, fisico: 0.6, veneno: 0.5 }, sprite: 'elemental', color: '#ff4020', boss: true, mechs: ['stomp', 'enrage'], scale: 2.4 },
  { id: 'senhor', name: 'Senhor Demônio', kind: 'demonio', hp: 14, atk: 2.0, def: 1.6, spd: 1.8, interval: 1.5, range: 4.5, dmg: 'fogo', xp: 18, gold: 16, sprite: 'imp', color: '#8a1030', boss: true, mechs: ['adds', 'stomp', 'enrage'], scale: 2.4 },
];

/** Mini-chefes de início de jogo (missões). */
export const MINIBOSSES: MobDef[] = [
  { id: 'rato_albino', name: 'Rato Albino', kind: 'fera', hp: 3.6, atk: 1.2, def: 1, spd: 2.3, interval: 1.1, range: 1.4, dmg: 'fisico', xp: 7, gold: 6, sprite: 'rato', color: '#f0d8e0', boss: true, mechs: ['enrage'], scale: 1.7 },
];

/** Chefes errantes (um por mapa) — ver events.json. */
export const WANDERERS: MobDef[] = [
  { id: 'gosma_rainha', name: 'Gosma Rainha', kind: 'elemental', hp: 8, atk: 1.4, def: 1, spd: 1.2, interval: 1.5, range: 1.6, dmg: 'veneno', xp: 12, gold: 10, res: { veneno: 0, fisico: 0.5, fogo: 1.4 }, regen: 0.01, sprite: 'slime', color: '#a0ff70', boss: true, mechs: ['adds', 'enrage'], scale: 2.4 },
  { id: 'ogro_ancião', name: 'Ogro Ancião', kind: 'humanoide', hp: 10, atk: 1.7, def: 1.4, spd: 1.4, interval: 1.9, range: 1.8, dmg: 'fisico', xp: 14, gold: 12, sprite: 'golem', color: '#7a9a50', boss: true, mechs: ['stomp', 'enrage'], scale: 2.4 },
  { id: 'cavaleiro_morto', name: 'Cavaleiro Morto', kind: 'morto', hp: 11, atk: 1.8, def: 2, spd: 1.6, interval: 1.4, range: 1.6, dmg: 'sombrio', xp: 15, gold: 13, sprite: 'esqueleto', color: '#8aa0d0', boss: true, mechs: ['enrage', 'stomp'], scale: 2.3 },
  { id: 'sentinela_rubra', name: 'Sentinela Rubra', kind: 'construto', hp: 13, atk: 1.8, def: 3, spd: 1.1, interval: 2, range: 1.8, dmg: 'fisico', xp: 16, gold: 14, sprite: 'golem', color: '#d86a4a', boss: true, mechs: ['stomp', 'enrage'], scale: 2.5 },
  { id: 'salamandra', name: 'Salamandra Anciã', kind: 'elemental', hp: 12, atk: 1.9, def: 1.4, spd: 1.6, interval: 1.6, range: 4, dmg: 'fogo', xp: 17, gold: 14, res: { fogo: 0, gelo: 1.6 }, sprite: 'elemental', color: '#ffa020', boss: true, mechs: ['stomp', 'enrage'], scale: 2.4 },
  { id: 'arauto', name: 'Arauto Infernal', kind: 'demonio', hp: 13, atk: 2, def: 1.6, spd: 1.9, interval: 1.5, range: 4.5, dmg: 'fogo', xp: 18, gold: 16, sprite: 'imp', color: '#c01848', boss: true, mechs: ['adds', 'enrage'], scale: 2.4 },
  { id: 'devorador', name: 'Devorador', kind: 'construto', hp: 15, atk: 2.1, def: 3, spd: 1.3, interval: 2, range: 2, dmg: 'sombrio', xp: 20, gold: 18, sprite: 'golem', color: '#7a50c0', boss: true, mechs: ['stomp', 'enrage', 'adds'], scale: 2.6 },
];

export const MOB_BY_ID: Record<string, MobDef> = Object.fromEntries([...MOBS, ...BOSSES, ...MINIBOSSES, ...WANDERERS].map((m) => [m.id, m]));

export function resistOf(m: MobDef): Partial<Record<DmgType, number>> {
  return { ...KIND_RES[m.kind], ...(m.res ?? {}) };
}

/** Chefe sintético usado nas simulações de balanceamento (um chefe "da espécie"). */
export function bossOfSpecies(m: MobDef): MobDef {
  return { ...m, id: m.id + '_boss', name: m.name + ' Chefe', hp: m.hp * 8, atk: m.atk * 1.5, def: m.def * 1.3, xp: m.xp * 12, gold: m.gold * 10, boss: true, mechs: ['adds', 'enrage'], scale: 2.2 };
}
