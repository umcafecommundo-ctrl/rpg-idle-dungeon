// Simulação headless: roda o mesmo motor de combate sem renderização.
import { CLASSES, CLASS_BY_ID } from '../data/classes';
import { BOSSES, bossOfSpecies, MOB_BY_ID, MOBS } from '../data/mobs';
import { MAPS } from '../data/maps';
import type { Activity, ClassDef, Mods, Stat } from '../data/types';
import { ACTIVITIES, STATS } from '../data/types';
import { Battle, type BattleCfg, type PartyMember, type Acc } from './battle';
import { autoAlloc, autoTalents, derive, statPointsFor, talentPointsFor, TICK, zeroStats, type Derived } from './formulas';
import { mulberry32 } from './rng';
import { generateLayout } from '../render/mapgen';

/** Personagem "padrão" de simulação: auto-alocação + talentos automáticos, sem equipamento. */
export function simDerived(classId: string, level: number, gear: Mods[] = [], rebirths = 0): Derived {
  const cls = CLASS_BY_ID[classId];
  const alloc = autoAlloc(cls, statPointsFor(level), zeroStats());
  return derive({ classId, level, alloc, talents: autoTalents(cls, talentPointsFor(level)), gear, rebirths });
}

const allAuto = (c: ClassDef) => Object.fromEntries(c.skills.map((s) => [s.id, true]));
export const member = (classId: string, level: number, isPlayer: boolean, gear: Mods[] = [], rebirths = 0): PartyMember => {
  const c = CLASS_BY_ID[classId];
  return { name: c.name, derived: simDerived(classId, level, gear, rebirths), auto: allAuto(c), isPlayer };
};

export interface SimOpts {
  classId: string; level: number; activity: Activity; mapId?: string;
  mobId?: string;         // restringe o pool a uma espécie (chefe = versão chefe da espécie)
  seconds?: number; seed?: number; party?: PartyMember[]; floor?: number;
  gear?: Mods[]; rebirths?: number; derived?: Derived; withLayout?: boolean;
}
export interface SimResult {
  secs: number; xpMin: number; goldMin: number; killsMin: number; dps: number; ttk: number; dmgPerKill: number;
  deaths: number; deathsH: number; dmgTakenFrac: number; acc: Acc; floor: number; dropsMin: number; eliteMin: number; potionless: boolean;
  minHpFrac: number; lootN: number; lootTier: [number, number, number];
}

export function defaultMapFor(level: number): string {
  let best = MAPS[0];
  for (const m of MAPS) if (level >= m.minLv) best = m;
  return best.id;
}

export function simulate(o: SimOpts): SimResult {
  const secs = o.seconds ?? 90;
  const mapId = o.mapId ?? defaultMapFor(o.level);
  const me = member(o.classId, o.level, true, o.gear, o.rebirths ?? 0);
  if (o.derived) me.derived = o.derived;
  let party: PartyMember[] = [me];
  if (o.activity === 'party') {
    if (o.party) party = [me, ...o.party];
    else {
      const picks = ['cavaleiro', 'clerigo', 'arqueiro', 'mago'].filter((c) => c !== o.classId).slice(0, 3);
      party = [me, ...picks.map((c) => member(c, o.level, false))];
    }
  }
  const cfg: BattleCfg = {
    rng: mulberry32(o.seed ?? 1234), mapId, activity: o.activity, floor: o.floor ?? 1, playerLevel: o.level, party, fx: false,
    xpBonus: (me.derived.mods.xpPct ?? 0), goldBonus: me.derived.mods.goldPct ?? 0, dropBonus: me.derived.mods.dropPct ?? 0,
  };
  if (o.mobId) {
    cfg.poolOverride = [o.mobId];
    cfg.bossOverride = bossOfSpecies(MOB_BY_ID[o.mobId]);
  }
  const b = new Battle(cfg);
  if (o.withLayout) b.layout = generateLayout(mapId, o.seed ?? 1234);
  // com mobId forçado, o nível do mob acompanha o do jogador (limites do mapa são ignorados via mapa amplo)
  const n = Math.round(secs / TICK);
  let minHp = 1, lootN = 0;
  const lootTier: [number, number, number] = [0, 0, 0];
  const kills0: number[] = [];
  for (let i = 0; i < n; i++) {
    b.step(TICK);
    if (!b.player.dead) minHp = Math.min(minHp, b.player.hp / b.player.maxHp);
    lootN += b.loot.length; for (const l of b.loot) lootTier[l.tier]++; b.loot.length = 0;
    if (i % 20 === 0) kills0.push(b.acc.kills);
  }
  const a = b.acc;
  const min = secs / 60;
  const kills = Math.max(1, a.kills);
  return {
    secs, xpMin: a.xp / min, goldMin: a.gold / min, killsMin: a.kills / min, dps: a.dmgDealt / secs, ttk: secs / kills,
    dmgPerKill: a.dmgTaken / kills, deaths: a.deaths, deathsH: (a.deaths / secs) * 3600,
    dmgTakenFrac: a.dmgTaken / secs / me.derived.maxHp, acc: a, floor: b.floor, dropsMin: lootN / min, eliteMin: a.elites / min, potionless: true, minHpFrac: minHp, lootN, lootTier,
  };
}

// ───────────── Tabela de balanceamento ─────────────
export interface Scenario { activity: Activity; mobId: string }
export interface BalanceCell { classId: string; xpMin: number; dps: number; ttk: number; dmgPerKill: number; deaths: number }

/** Para cada cenário (atividade × espécie de mob) mede as 6 classes e ranqueia por XP/min. */
export function runBalance(level: number, seconds = 60, onProgress?: (p: number) => void) {
  const scenarios: Scenario[] = [];
  for (const act of ACTIVITIES) for (const m of MOBS) scenarios.push({ activity: act, mobId: m.id });
  const cells: Record<string, Record<string, BalanceCell>> = {};
  const rank: Record<string, string[]> = {};
  scenarios.forEach((sc, i) => {
    const key = `${sc.activity}:${sc.mobId}`;
    cells[key] = {};
    for (const c of CLASSES) {
      const r = simulate({ classId: c.id, level, activity: sc.activity, mobId: sc.mobId, mapId: mapForLevelSpecies(level), seconds, seed: 77 + i, floor: sc.activity === 'dungeon' ? 12 : 1 });
      cells[key][c.id] = { classId: c.id, xpMin: r.xpMin, dps: r.dps, ttk: r.ttk, dmgPerKill: r.dmgPerKill, deaths: r.deaths };
    }
    rank[key] = CLASSES.map((c) => c.id).sort((a, b) => cells[key][b].xpMin - cells[key][a].xpMin);
    onProgress?.((i + 1) / scenarios.length);
  });
  // verificação da regra de design
  const stats: Record<string, { top2: number; last: number; wins: number }> = {};
  for (const c of CLASSES) stats[c.id] = { top2: 0, last: 0, wins: 0 };
  for (const key in rank) {
    const r = rank[key];
    stats[r[0]].top2++; stats[r[1]].top2++; stats[r[0]].wins++; stats[r[r.length - 1]].last++;
  }
  const perActivity: Record<string, Record<string, number>> = {};
  for (const act of ACTIVITIES) {
    perActivity[act] = {};
    for (const c of CLASSES) {
      let sum = 0;
      for (const m of MOBS) sum += cells[`${act}:${m.id}`][c.id].xpMin;
      perActivity[act][c.id] = sum / MOBS.length;
    }
  }
  const ok = CLASSES.every((c) => stats[c.id].top2 >= 2 && stats[c.id].last >= 1);
  return { scenarios, cells, rank, stats, perActivity, ok };
}

// o mapa é só o "pano de fundo"; com mobId o nível do mob = nível do jogador (mapa cobrindo qualquer nível)
function mapForLevelSpecies(level: number) { return defaultMapFor(level); }
export { BOSSES, STATS };
export type { Stat };

/** Duelo solo: DPS, tempo para matar e dano recebido por abate, para cada classe × espécie de mob. */
export function duelTable(level: number, seconds = 45) {
  return MOBS.map((m) => ({
    mobId: m.id,
    row: CLASSES.map((c) => {
      const r = simulate({ classId: c.id, level, activity: 'solo', mobId: m.id, mapId: defaultMapFor(level), seconds, seed: 9 });
      return { classId: c.id, dps: r.dps, ttk: r.ttk, dmgPerKill: r.dmgPerKill, deaths: r.deaths };
    }),
  }));
}
