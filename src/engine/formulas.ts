// Curvas de referência e cálculo de atributos derivados.
import { CLASS_BY_ID } from '../data/classes';
import type { ClassDef, DmgType, Mods, Stat } from '../data/types';
import { STATS } from '../data/types';

export const MAX_LEVEL = 200;
export const MIN_PRESTIGE_LEVEL = 100;
export const TICK = 0.05; // 20 Hz

/** XP para o próximo nível (exponencial suave). */
export const xpToNext = (lv: number) => Math.floor(35 * lv * Math.pow(1.045, lv));
export const killsPerLevel = (lv: number) => 40 + lv * 1.2;

// Curvas de referência para mobs (nível L). Ajuste aqui para balancear tudo de uma vez.
export const refHp = (L: number) => 30 + 24 * L;
export const refAtk = (L: number) => 4 + 0.7 * L;
export const refDef = (L: number) => 4 + 2.2 * L;
export const defK = (L: number) => 60 + 14 * L;

export const skillMpCost = (base: number, L: number) => Math.round(base * (1 + L * 0.09));

export const zeroStats = (): Record<Stat, number> => ({ for: 0, agi: 0, int: 0, vit: 0, sab: 0 });

export function mergeMods(list: Mods[]): Mods {
  const out: Mods = {};
  for (const m of list) addMods(out, m);
  return out;
}
export function addMods(out: Mods, m: Mods, k = 1) {
  for (const key in m) {
    const kk = key as keyof Mods;
    if (kk === 'vs' || kk === 'elem') {
      const src = m[kk] as Record<string, number>;
      const dst = ((out[kk] as Record<string, number>) ??= {});
      for (const t in src) dst[t] = (dst[t] ?? 0) + src[t] * k;
    } else {
      (out as Record<string, number>)[kk] = ((out as Record<string, number>)[kk] ?? 0) + (m[kk] as number) * k;
    }
  }
  return out;
}

export interface CharState {
  classId: string; level: number; alloc: Record<Stat, number>;
  talents: Record<string, number>; gear: Mods[]; rebirths: number;
}

export function prestigeMods(r: number): Mods {
  return { atkPct: 0.06 * r, hpPct: 0.06 * r, xpPct: 0.1 * r, goldPct: 0.08 * r };
}

export function talentPointsFor(level: number) { return Math.floor(level / 4); }
export function statPointsFor(level: number) { return 3 * (level - 1); }

export function passiveMods(c: ClassDef, level: number): Mods[] {
  return c.passives.filter((p) => level >= p.lv).map((p) => p.mods);
}
export function talentMods(c: ClassDef, ranks: Record<string, number>): Mods[] {
  const out: Mods[] = [];
  for (const b of c.talents) for (const n of b.nodes) {
    const r = ranks[`${c.id}:${n.id}`] ?? 0;
    if (r > 0) { const m: Mods = {}; addMods(m, n.mods, r); out.push(m); }
  }
  return out;
}

export interface Derived {
  cls: ClassDef; level: number; stats: Record<Stat, number>; mods: Mods;
  maxHp: number; maxMp: number; def: number; mdef: number; wAtk: number;
  interval: number; crit: number; critDmg: number; rangeTiles: number; moveSpd: number;
}

export function derive(cs: CharState): Derived {
  const cls = CLASS_BY_ID[cs.classId];
  const mods = mergeMods([...passiveMods(cls, cs.level), ...talentMods(cls, cs.talents), ...cs.gear, prestigeMods(cs.rebirths)]);
  const stats = zeroStats();
  for (const s of STATS) stats[s] = cls.base[s] + cls.growth[s] * (cs.level - 1) + cs.alloc[s] + (mods[s] ?? 0);
  return finalize(cls, cs.level, stats, mods);
}

export function finalize(cls: ClassDef, level: number, stats: Record<Stat, number>, mods: Mods): Derived {
  const maxHp = Math.round((80 + stats.vit * 10 + (mods.hp ?? 0)) * cls.hpMult * (1 + (mods.hpPct ?? 0)));
  const maxMp = Math.round((30 + stats.sab * 5 + stats.int * 3 + (mods.mp ?? 0)) * cls.mpMult * (1 + (mods.mpPct ?? 0)));
  const def = (stats.vit * 0.9 * cls.defMult + (mods.def ?? 0)) * (1 + (mods.defPct ?? 0));
  const mdef = (stats.sab * 0.9 + stats.vit * 0.2 + (mods.mdef ?? 0)) * (1 + (mods.defPct ?? 0)) * (0.5 + cls.defMult / 2);
  const aspd = 1 + (mods.aspd ?? 0) + stats.agi * 0.0015;
  return {
    cls, level, stats, mods, maxHp, maxMp, def, mdef, wAtk: mods.wAtk ?? 0,
    interval: Math.max(0.35, cls.basic.interval / aspd),
    crit: Math.min(0.8, 0.05 + stats.agi * 0.0006 + (mods.crit ?? 0)),
    critDmg: 1.5 + (mods.critDmg ?? 0),
    rangeTiles: cls.ranged ? 6.5 : 1.6,
    moveSpd: 2.6 * (1 + (mods.moveSpd ?? 0)),
  };
}

/** Distribui pontos pelo preset da classe (para auto-alocação). */
export function autoAlloc(cls: ClassDef, points: number, cur: Record<Stat, number>): Record<Stat, number> {
  const out = { ...cur };
  const tot = STATS.reduce((a, s) => a + cls.preset[s], 0);
  for (let i = 0; i < points; i++) {
    let best: Stat = 'for', bs = -1;
    for (const s of STATS) {
      const w = cls.preset[s] / tot;
      if (w <= 0) continue;
      const sc = w / (out[s] + 1);
      if (sc > bs) { bs = sc; best = s; }
    }
    out[best] += 1;
  }
  return out;
}

/** Preenche talentos automaticamente (usado em simulações): ramos em ordem, camada por camada. */
export function autoTalents(cls: ClassDef, points: number): Record<string, number> {
  const out: Record<string, number> = {};
  let left = points;
  for (let round = 0; round < 5 && left > 0; round++)
    for (const b of cls.talents) for (const n of b.nodes) {
      if (left > 0 && (out[`${cls.id}:${n.id}`] ?? 0) < n.max && round < n.max) { out[`${cls.id}:${n.id}`] = (out[`${cls.id}:${n.id}`] ?? 0) + 1; left--; }
    }
  return out;
}

export function nodeUnlocked(c: ClassDef, ranks: Record<string, number>, branch: number, idx: number): boolean {
  const need = idx * 4;
  let spent = 0;
  for (const n of c.talents[branch].nodes) spent += ranks[`${c.id}:${n.id}`] ?? 0;
  return spent >= need;
}

export const xpLevelFactor = (playerLv: number, mobLv: number) => {
  const d = playerLv - mobLv;
  if (d > 5) return Math.max(0.05, 1 - (d - 5) * 0.08);
  if (d < 0) return Math.min(1.5, 1 + -d * 0.05);
  return 1;
};

export const fmt = (n: number) => {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  return Math.floor(n).toString();
};

export type { DmgType };
