// Motor de combate determinístico (tick fixo). Usado pelo jogo, pela simulação offline e pela tela de balanceamento.
import { MAP_BY_ID } from '../data/maps';
import { BOSSES, MOB_BY_ID, resistOf } from '../data/mobs';
import type { Activity, DmgType, IconKey, Maneuver, MobDef, MobKind, Mods, Skill, StatusKind, Stat, Vfx } from '../data/types';
import { STATS } from '../data/types';
import type { Derived } from './formulas';
import { addMods, defK, killsPerLevel, refAtk, refDef, refHp, skillMpCost, TICK, xpLevelFactor, xpToNext } from './formulas';
import { pickW, type Rng } from './rng';
import { AI_STEP, CLASS_AI, type AiCfg } from '../data/ai';
import { astar, threatMask, buildAiMap, freeAt, inBounds, openAt, routesAt, scorePos, blocked as losBlocked, type AiMap, type Threat, type ScoreCtx } from './ai';
import type { Layout } from '../render/mapgen';

export const ARENA_W = 12;
export const ARENA_H = 16;

export interface Status { k: StatusKind; t: number; p: number; src: number; type?: DmgType }
export interface Buff { id: string; name: string; icon: IconKey; col: string; t: number; dur: number; mods: Mods; debuff?: boolean }
export interface Fx { kind: 'ring' | 'proj' | 'bolt' | 'pillar' | 'slash' | 'spark' | 'rise' | 'warn' | 'meteor'; x: number; y: number; x2: number; y2: number; t: number; dur: number; col: string; r: number }
export interface Float { x: number; y: number; text: string; col: string; t: number; big: boolean }
export interface LootDrop { ilvl: number; tier: 0 | 1 | 2; x: number; y: number }

export interface Actor {
  id: number; team: 0 | 1; name: string; level: number; classId?: string;
  x: number; y: number; px: number; py: number; face: number;
  hp: number; maxHp: number; mp: number; maxMp: number;
  dmgMul: number; stats: Record<Stat, number>; defRaw: number; mdefRaw: number; wAtk: number;
  bm: Mods; m: Mods; baseInterval: number; range: number; spd: number;
  basic: { sc: Stat; dmg: DmgType; vfx: Vfx };
  skills: Skill[]; auto: Record<string, boolean>; cd: Record<string, number>;
  gcd: number; nextAtk: number; force?: string; focus?: number;
  status: Status[]; buffs: Buff[];
  kind?: MobKind; res: Partial<Record<DmgType, number>>; flying: boolean; slowKind: boolean;
  isPlayer: boolean; summon: boolean; ownerId?: number; life?: number;
  dead: boolean; deadAt: number; flash: number; atkAnim: number; castAnim: number;
  sprite: string; color: string; scale: number; variant: 'n' | 'e' | 'b'; modName?: string;
  mob?: MobDef; mobXp: number; mobGold: number; isAdd: boolean;
  regenMob: number; nextAdd: number; stompAt: number; nextStomp: number; enraged: boolean; reflect: number;
  homeX: number; homeY: number; target: number;
  // IA de posicionamento
  golden?: { until: number }; inv?: boolean;
  maneuver?: Maneuver; dash?: { x0: number; y0: number; tx: number; ty: number; t: number; dur: number; kind: 'dash' | 'jump' }; air: number; kbx: number; kby: number;
  aiNext: number; kiteSince: number; standUntil: number; tgtUntil: number; dashCd: number; vx: number; vy: number; lx: number; ly: number; lt: number;
  aiEmergency?: boolean;
  ai?: { nm: number; mode: 'engage' | 'kite' | 'besieged'; path: { x: number; y: number }[]; cornered: boolean; emergency: boolean };
  dbg?: AiDebug;
}
export interface AiDebug { cands: [number, number, number][]; dest: { x: number; y: number } | null; path: { x: number; y: number }[]; mode: string; emergency: boolean; cornered: boolean; threats: { x: number; y: number; melee: boolean }[]; ideal: number; safe: number; range: number; hp: number; dashIn: number; note: string }

export interface PartyMember { name: string; derived: Derived; auto: Record<string, boolean>; isPlayer: boolean; hpFrac?: number; mpFrac?: number }

export interface Bag { hp: number; mp: number; hpTh: number; mpTh: number; on: boolean }

export interface BattleCfg {
  rng: Rng; mapId: string; activity: Activity; floor: number; playerLevel: number;
  party: PartyMember[];
  poolOverride?: string[]; bossOverride?: MobDef;
  fx: boolean; bag?: Bag;
  golden?: { chance: number; lifetime: number; fleeSpeed: number; goldMult: number; xpMult: number };
  xpBonus: number; goldBonus: number; dropBonus: number;
}

const ACT: Record<Activity, { alive: number; respawn: number; hp: number; atk: number; xp: number; gold: number; drop: number; elite: number }> = {
  solo: { alive: 3, respawn: 0.8, hp: 1, atk: 1, xp: 1, gold: 1, drop: 1, elite: 0.1 },
  horda: { alive: 12, respawn: 0.3, hp: 0.45, atk: 0.55, xp: 0.34, gold: 0.34, drop: 0.4, elite: 0.03 },
  chefe: { alive: 1, respawn: 3, hp: 1, atk: 1, xp: 1, gold: 1, drop: 1, elite: 0 },
  dungeon: { alive: 4, respawn: 0.8, hp: 1.1, atk: 1.05, xp: 1.15, gold: 1.2, drop: 1.2, elite: 0.14 },
  party: { alive: 7, respawn: 0.6, hp: 1.9, atk: 0.95, xp: 0.6, gold: 0.6, drop: 0.8, elite: 0.16 },
};
export const FLOOR_MOBS = 8;
const ELITE_MODS = ['regenera', 'reflete', 'veloz', 'blindado'] as const;
const ELITE_LABEL: Record<string, string> = { regenera: 'Regenerante', reflete: 'Espelhado', veloz: 'Veloz', blindado: 'Blindado' };
const DOT_TYPE: Partial<Record<StatusKind, DmgType>> = { poison: 'veneno', burn: 'fogo', bleed: 'fisico' };
const MELEE_REACH = 1.45;

export interface Acc { xp: number; gold: number; kills: number; elites: number; bosses: number; dmgTaken: number; dmgDealt: number; deaths: number; floorsCleared: number; potions: number }

export class Battle {
  t = 0; actors: Actor[] = []; fx: Fx[] = []; floats: Float[] = [];
  nid = 1; cfg: BattleCfg; rng: Rng;
  acc: Acc = { xp: 0, gold: 0, kills: 0, elites: 0, bosses: 0, dmgTaken: 0, dmgDealt: 0, deaths: 0, floorsCleared: 0, potions: 0 };
  loot: LootDrop[] = [];
  killLog: string[] = [];           // ids dos mobs abatidos (missões)
  sfx: string[] = [];               // sons a tocar (consumidos pelo Game)
  shake = 0; flash = 0; lastCrit = -9;
  miniQueue: string[] = [];         // mini-chefes pendentes (missões)
  player!: Actor; floor: number; floorKills = 0; spawnT = 0.5; bossSpawned = false;
  reviveAt = -1; potCd = 0; potMpCd = 0; banner = ''; bannerT = 0;
  playerLevel: number;
  layout: Layout | null = null;
  static AI = true;           // liga/desliga a IA de posicionamento (comparações de balanceamento)
  debug = false;              // guarda dados de depuração da IA
  aiLog: { t: number; text: string }[] = [];
  invasion: { total: number; spawned: number; killed: number; t: number; done: boolean; failed: boolean } | null = null;
  private actOv: Activity | null = null; private invSpawnT = 0;
  private _map: AiMap | null = null;
  get aiMap(): AiMap { return this._map ??= buildAiMap(this.layout?.obstacles ?? []); }

  constructor(cfg: BattleCfg) {
    this.cfg = cfg; this.rng = cfg.rng; this.floor = cfg.floor; this.playerLevel = cfg.playerLevel;
    cfg.party.forEach((p, i) => {
      const a = this.makeAlly(p, i);
      this.actors.push(a);
      if (p.isPlayer) this.player = a;
    });
  }

  private blank(team: 0 | 1, name: string, level: number): Actor {
    return {
      id: this.nid++, team, name, level, x: 6, y: 8, px: 6, py: 8, face: 1, hp: 1, maxHp: 1, mp: 0, maxMp: 0,
      dmgMul: 1, stats: { for: 0, agi: 0, int: 0, vit: 0, sab: 0 }, defRaw: 0, mdefRaw: 0, wAtk: 0, bm: {}, m: {},
      baseInterval: 1.5, range: 1.4, spd: 2, basic: { sc: 'for', dmg: 'fisico', vfx: 'slash' }, skills: [], auto: {}, cd: {},
      gcd: 0, nextAtk: 0, status: [], buffs: [], res: {}, flying: false, slowKind: false, isPlayer: false, summon: false,
      dead: false, deadAt: 0, flash: 0, atkAnim: 0, castAnim: 0, sprite: '', color: '#fff', scale: 1, variant: 'n',
      mobXp: 0, mobGold: 0, isAdd: false, regenMob: 0, nextAdd: 0, stompAt: -1, nextStomp: 0, enraged: false, reflect: 0,
      homeX: 6, homeY: 11, target: 0, air: 0, kbx: 0, kby: 0, aiNext: 0, kiteSince: -1, standUntil: 0, tgtUntil: 0, dashCd: 0, vx: 0, vy: 0, lx: 0, ly: 0, lt: -9,
    };
  }

  private makeAlly(p: PartyMember, idx: number): Actor {
    const d = p.derived;
    const a = this.blank(0, p.name, d.level);
    a.isPlayer = p.isPlayer;
    this.applyDerived(a, d, p.auto, p.hpFrac ?? 1, p.mpFrac ?? 1);
    a.sprite = 'class:' + d.cls.id; a.homeX = [6, 3.5, 8.5, 6][idx] ?? 6; a.homeY = [11, 12.2, 12.2, 13.2][idx] ?? 11;
    a.x = a.px = a.homeX; a.y = a.py = a.homeY;
    return a;
  }

  /** Copia os atributos derivados para o ator (mantém a fração de HP/MP atual se hpFrac/mpFrac omitidos). */
  applyDerived(a: Actor, d: Derived, auto: Record<string, boolean>, hpFrac = a.maxHp ? a.hp / a.maxHp : 1, mpFrac = a.maxMp ? a.mp / a.maxMp : 1) {
    a.classId = d.cls.id; a.level = d.level;
    a.dmgMul = d.cls.dmgMult; a.stats = { ...d.stats }; a.bm = d.mods;
    a.maxHp = d.maxHp; a.maxMp = d.maxMp;
    a.hp = Math.max(1, Math.round(d.maxHp * hpFrac)); a.mp = Math.round(d.maxMp * mpFrac);
    a.defRaw = d.def / (1 + (d.mods.defPct ?? 0)); a.mdefRaw = d.mdef / (1 + (d.mods.defPct ?? 0)); a.wAtk = d.wAtk;
    a.baseInterval = d.cls.basic.interval; a.range = d.rangeTiles; a.spd = d.moveSpd; a.basic = d.cls.basic;
    a.skills = d.cls.skills.filter((s) => s.lv <= d.level); a.auto = auto;
    a.maneuver = d.level >= d.cls.maneuver.lv ? d.cls.maneuver : undefined;
    this.recalc(a);
  }

  get enemies() { return this.actors.filter((a) => a.team === 1 && !a.dead); }
  get allies() { return this.actors.filter((a) => a.team === 0 && !a.dead); }

  // ───────────── helpers ─────────────
  private powOf(a: Actor, sc: Stat) { return (a.stats[sc] + a.wAtk) * a.dmgMul + (a.team === 0 && !a.summon ? 8 + a.level * 0.4 + (a.dmgMul < 1 ? 6 : 0) : 0); }
  private effDef(a: Actor, magic: boolean) { return (magic ? a.mdefRaw : a.defRaw) * (1 + (a.m.defPct ?? 0)); }
  private interval(a: Actor) { return Math.max(0.3, a.baseInterval / (1 + (a.m.aspd ?? 0) + a.stats.agi * (a.isPlayer || a.classId ? 0.0015 : 0))); }
  private critChance(a: Actor) { return a.mob ? 0.03 : Math.min(0.8, 0.05 + a.stats.agi * 0.0006 + (a.m.crit ?? 0)); }
  private recalc(a: Actor) {
    const m: Mods = {};
    addMods(m, a.bm);
    for (const b of a.buffs) addMods(m, b.mods);
    a.m = m;
  }
  private has(a: Actor, k: StatusKind) { return a.status.some((s) => s.k === k); }
  private dist(a: Actor, b: { x: number; y: number }) { return Math.hypot(a.x - b.x, a.y - b.y); }

  addFx(kind: Fx['kind'], x: number, y: number, x2: number, y2: number, dur: number, col: string, r = 1) {
    if (!this.cfg.fx) return;
    if (this.fx.length > 80) this.fx.shift();
    this.fx.push({ kind, x, y, x2, y2, t: 0, dur, col, r });
  }
  float(x: number, y: number, text: string, col: string, big = false) {
    if (!this.cfg.fx) return;
    if (this.floats.length > 50) this.floats.shift();
    this.floats.push({ x: x + (this.rng() - 0.5) * 0.6, y: y - 0.6, text, col, t: 0, big });
  }

  // ───────────── dano ─────────────
  /** Calcula e aplica um golpe. base = poder bruto já multiplicado pela skill. */
  strike(src: Actor, tgt: Actor, base: number, type: DmgType, opts: { crit?: boolean; noDef?: boolean; dot?: boolean; label?: boolean } = {}): number {
    if (tgt.dead) return 0;
    const sm = src.m;
    if (!opts.dot && tgt.m.dodge && this.rng() < tgt.m.dodge) { this.float(tgt.x, tgt.y, 'Esquiva', '#9ab', false); return 0; }
    let mult = 1 + (sm.atkPct ?? 0) + (type === 'fisico' ? sm.physPct ?? 0 : sm.magPct ?? 0) + (sm.elem?.[type] ?? 0);
    if (tgt.kind) mult += (sm.vs?.[tgt.kind] ?? 0);
    if (tgt.slowKind && sm.vsSlow) mult += sm.vsSlow;
    if (tgt.variant !== 'n') mult += sm.bossDmg ?? 0;
    if (opts.dot) mult += sm.dotPct ?? 0;
    if (src.summon) mult += 0; // bônus já aplicado no cálculo da invocação
    let crit = false;
    if (!opts.dot) {
      crit = opts.crit || this.rng() < this.critChance(src);
      if (crit) mult *= 1.5 + (sm.critDmg ?? 0);
    }
    let dmg = base * mult * (0.92 + this.rng() * 0.16);
    const rm = tgt.res[type] ?? 1;
    dmg *= rm;
    if (!opts.noDef) {
      const magic = type !== 'fisico';
      const d = this.effDef(tgt, magic);
      dmg *= 1 - d / (d + defK(src.level));
    }
    if (type === 'fisico') dmg *= 1 - Math.min(0.8, tgt.m.physRed ?? 0);
    dmg *= 1 - Math.min(0.85, tgt.m.dmgRed ?? 0);
    const vuln = tgt.status.find((s) => s.k === 'vuln');
    if (vuln) dmg *= 1 + vuln.p;
    dmg = Math.max(1, Math.round(dmg));
    if (rm === 0) dmg = 0;
    this.applyDamage(src, tgt, dmg, type, crit);
    if (!opts.dot && dmg > 0) {
      if (tgt.m.thorns && src.team !== tgt.team && src.x !== undefined) this.reflectDamage(tgt, src, dmg * tgt.m.thorns);
      if (tgt.reflect > 0) this.reflectDamage(tgt, src, dmg * tgt.reflect);
    }
    return dmg;
  }

  private reflectDamage(from: Actor, to: Actor, amt: number) {
    if (to.dead || amt < 1) return;
    to.hp -= amt; to.flash = 0.12;
    this.acc[to.team === 0 ? 'dmgTaken' : 'dmgDealt'] += to.team === 0 ? amt : 0;
    if (to.hp <= 0) this.kill(to, from);
  }

  applyDamage(src: Actor, tgt: Actor, dmg: number, type: DmgType, crit: boolean) {
    tgt.hp -= dmg; tgt.flash = 0.12;
    if (tgt.team === 0) this.acc.dmgTaken += dmg; else if (src.team === 0) this.acc.dmgDealt += dmg;
    if (crit && src.team === 0 && this.cfg.fx) { this.shake = Math.max(this.shake, dmg > tgt.maxHp * 0.2 ? 0.9 : 0.5); if (this.t - this.lastCrit > 0.25) { this.sfx.push('crit'); this.lastCrit = this.t; } }
    if (dmg === 0) this.float(tgt.x, tgt.y, 'Imune', '#aaa');
    else this.float(tgt.x, tgt.y, (crit ? '' : '') + dmg, tgt.team === 0 ? '#ff6a6a' : crit ? '#ffe040' : DMG_COL[type] ?? '#fff', crit || (src.team === 0 && dmg > tgt.maxHp * 0.3));
    if (dmg > 0 && src.m.lifesteal && src.team === 0) this.healActor(src, dmg * src.m.lifesteal, true);
    if (tgt.hp <= 0) this.kill(tgt, src);
  }

  healActor(a: Actor, amt: number, quiet = false) {
    if (a.dead) return;
    const v = Math.min(a.maxHp - a.hp, Math.round(amt));
    if (v <= 0) return;
    a.hp += v;
    if (!quiet || v > a.maxHp * 0.03) this.float(a.x, a.y, '+' + v, '#6aff8a');
  }

  private kill(t: Actor, src: Actor) {
    if (t.dead) return;
    t.dead = true; t.deadAt = this.t; t.hp = 0;
    if (t.team === 1) {
      this.acc.kills++;
      if (t.mob && !t.isAdd) this.killLog.push(t.mob.id);
      if (t.golden) { this.killLog.push('__golden__'); this.sfx.push('drop_epico'); this.addFx('spark', t.x, t.y, 0, 0, 1, '#ffd040', 2); }
      if (t.inv && this.invasion) this.invasion.killed++;
      const lv = t.level;
      const xp = t.mobXp * xpLevelFactor(this.playerLevel, lv) * (1 + this.cfg.xpBonus);
      this.acc.xp += xp; this.acc.gold += t.mobGold * (1 + this.cfg.goldBonus);
      const act = ACT[this.cfg.activity];
      if (t.variant === 'e') this.acc.elites++;
      if (t.variant === 'b') this.acc.bosses++;
      if (!t.isAdd) {
        const tier = t.variant === 'b' ? 2 : t.variant === 'e' ? 1 : 0;
        const chance = (tier === 2 ? 2 : tier === 1 ? 0.4 : 0.07) * act.drop * (1 + this.cfg.dropBonus);
        let n = Math.floor(chance);
        if (this.rng() < chance - n) n++;
        for (let i = 0; i < n; i++) this.loot.push({ ilvl: lv, tier: tier as 0 | 1 | 2, x: t.x, y: t.y });
        if (this.cfg.activity === 'dungeon') this.floorKills++;
      }
      this.addFx('spark', t.x, t.y, 0, 0, 0.4, t.color, 1);
    } else {
      if (t.isPlayer) {
        this.acc.deaths++;
        this.reviveAt = this.t + 6;
        this.banner = 'Você morreu...'; this.bannerT = 6;
      }
    }
  }

  // ───────────── spawn ─────────────
  private mobLevel(): number {
    const map = MAP_BY_ID[this.cfg.mapId];
    if (this.cfg.activity === 'dungeon') return Math.round(map.minLv + (this.floor - 1) * 0.8);
    const j = Math.floor(this.rng() * 4) - 1;
    return Math.max(map.minLv, Math.min(map.maxLv, this.playerLevel + j));
  }

  makeMob(def: MobDef, level: number, variant: 'n' | 'e' | 'b', x: number, y: number, isAdd = false): Actor {
    const act = ACT[this.actOv ?? this.cfg.activity];
    const fs = this.cfg.activity === 'dungeon' ? 1 + 0.05 * (this.floor - 1) : 1;
    const a = this.blank(1, def.name, level);
    const hpm = def.boss ? def.hp * (this.cfg.activity === 'party' ? 1.9 : 1) : def.hp * act.hp * (variant === 'e' ? 2 : 1) * (isAdd ? 0.5 : 1);
    a.maxHp = a.hp = Math.round(refHp(level) * hpm * fs);
    const atk = refAtk(level) * def.atk * (def.boss ? 1 : act.atk) * fs * (isAdd ? 0.7 : 1);
    for (const s of STATS) a.stats[s] = atk;
    a.stats.agi = 0;
    a.defRaw = refDef(level) * def.def * fs; a.mdefRaw = a.defRaw * 0.7;
    a.baseInterval = def.interval; a.range = def.range; a.spd = def.spd; a.basic = { sc: 'for', dmg: def.dmg, vfx: def.range > 2.5 ? (def.dmg === 'fogo' ? 'fire' : 'dark') : 'slash' };
    a.kind = def.kind; a.res = resistOf(def); a.flying = !!def.flying; a.slowKind = !!def.slow;
    a.sprite = def.sprite; a.color = def.color; a.scale = def.scale ?? 1; a.variant = variant; a.mob = def; a.isAdd = isAdd;
    a.regenMob = def.regen ?? 0;
    const xpBase = (xpToNext(level) / killsPerLevel(level)) * def.xp * act.xp;
    a.mobXp = xpBase * (variant === 'e' ? 2.5 : 1) * (isAdd ? 0.3 : 1) * (this.cfg.activity === 'chefe' && def.boss ? 1 : 1);
    a.mobGold = Math.round((2 + level * 0.6) * def.gold * act.gold * (variant === 'e' ? 2.5 : 1) * (isAdd ? 0.3 : 1) * (0.8 + this.rng() * 0.4));
    a.x = a.px = x; a.y = a.py = y; a.nextAtk = this.t + 0.6 + this.rng() * 0.6;
    if (variant === 'e') {
      const mod = ELITE_MODS[Math.floor(this.rng() * ELITE_MODS.length)];
      a.modName = mod; a.name = `${ELITE_LABEL[mod]} ${def.name}`;
      if (mod === 'veloz') { a.spd *= 1.5; a.bm = { aspd: 0.4 }; }
      if (mod === 'blindado') a.defRaw *= 2;
      if (mod === 'reflete') a.reflect = 0.15;
      if (mod === 'regenera') a.regenMob = Math.max(a.regenMob, 0.02);
    }
    if (def.boss) { a.nextAdd = this.t + 8; a.nextStomp = this.t + 7; }
    this.recalc(a);
    this.actors.push(a);
    this.addFx('ring', x, y, 0, 0, 0.4, '#ffffff', 0.8);
    return a;
  }

  private spawnRandomInv() {
    const map = MAP_BY_ID[this.cfg.mapId];
    const def = MOB_BY_ID[pickW(this.rng, map.mobs).id];
    return this.makeMob(def, this.mobLevel(), 'n', 0.8 + this.rng() * (ARENA_W - 1.6), 2.4 + this.rng() * 1.2);
  }
  startInvasion(total: number, timeLimit: number) {
    this.invasion = { total, spawned: 0, killed: 0, t: timeLimit, done: false, failed: false }; this.invSpawnT = 0.5;
    this.banner = 'INVASÃO! Derrote todos os invasores!'; this.bannerT = 3; this.sfx.push('boss');
  }
  private spawnRandom() {
    const map = MAP_BY_ID[this.cfg.mapId];
    const pool = this.cfg.poolOverride ? this.cfg.poolOverride.map((id) => ({ id, w: 1 })) : map.mobs;
    const def = MOB_BY_ID[pickW(this.rng, pool).id];
    const act = ACT[this.cfg.activity];
    const variant = this.rng() < act.elite ? 'e' : 'n';
    const gm = this.cfg.golden;
    if (gm && !this.actors.some((a) => a.golden && !a.dead) && this.rng() < gm.chance) return this.spawnGolden(def);
    return this.makeMob(def, this.mobLevel(), variant, 1.2 + this.rng() * (ARENA_W - 2.4), 2.6 + this.rng() * 1.8);
  }

  private spawnGolden(def: MobDef): Actor {
    const gm = this.cfg.golden!;
    const a = this.makeMob(def, this.mobLevel(), 'n', 1.5 + this.rng() * (ARENA_W - 3), 2.6 + this.rng() * 1.5);
    a.golden = { until: this.t + gm.lifetime }; a.name = `${def.name} Dourado`; a.color = '#ffd040';
    a.maxHp = a.hp = Math.round(a.maxHp * 0.7); a.mobGold = Math.round(a.mobGold * gm.goldMult); a.mobXp *= gm.xpMult; a.spd = gm.fleeSpeed; a.res = {};
    this.banner = 'Um mob dourado apareceu! Pegue-o antes que fuja!'; this.bannerT = 2.5; this.sfx.push('boss');
    return a;
  }
  private goldenAct(a: Actor, dt: number) {
    if (this.t > a.golden!.until) { a.dead = true; a.deadAt = this.t; this.float(a.x, a.y - 0.5, 'Escapou!', '#ffd040'); return; }
    let near: Actor | null = null, nd = 1e9;
    for (const e of this.actors) if (e.team === 0 && !e.dead && !e.summon) { const d = this.dist(a, e); if (d < nd) { nd = d; near = e; } }
    if (!near) return;
    let dx = a.x - near.x, dy = a.y - near.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    // contorna paredes e obstáculos: se o caminho de fuga está bloqueado, desliza pela tangente
    const step = a.spd * dt * (a.status.some((s) => s.k === 'slow') ? 0.5 : 1);
    let nx = a.x + dx * step, ny = a.y + dy * step;
    if (nx < 1 || nx > ARENA_W - 1) { nx = a.x; ny = a.y + (a.y < 8 ? 1 : -1) * step; }
    if (ny < 2.4 || ny > ARENA_H - 1) { ny = a.y; nx = a.x + (a.x < ARENA_W / 2 ? 1 : -1) * step; }
    a.x = nx; a.y = ny; a.face = dx >= 0 ? 1 : -1;
  }

  private bossDef(): MobDef {
    return this.cfg.bossOverride ?? MOB_BY_ID[MAP_BY_ID[this.cfg.mapId].boss] ?? BOSSES[0];
  }

  private spawner(dt: number) {
    const act = ACT[this.cfg.activity];
    if (this.miniQueue.length && !this.actors.some((a) => a.mob?.boss && !a.dead)) {
      const id = this.miniQueue.shift()!; const def = MOB_BY_ID[id];
      if (def) { this.makeMob(def, Math.max(1, this.playerLevel), 'b', ARENA_W / 2, 3.6); this.banner = `${def.name} apareceu!`; this.bannerT = 2.5; this.sfx.push('boss'); }
    }
    const alive = this.actors.filter((a) => a.team === 1 && !a.dead && !a.isAdd).length;
    const inv = this.invasion;
    if (inv && !inv.done) {
      inv.t -= dt;
      const invAlive = this.actors.filter((a) => a.inv && !a.dead).length;
      if (inv.spawned < inv.total && invAlive < 10) {
        this.invSpawnT -= dt;
        if (this.invSpawnT <= 0) { this.actOv = 'horda'; const m = this.spawnRandomInv(); this.actOv = null; m.inv = true; inv.spawned++; this.invSpawnT = 0.35; }
      }
      if (inv.killed >= inv.total) { inv.done = true; inv.failed = false; this.sfx.push('quest'); }
      else if (inv.t <= 0) { inv.done = true; inv.failed = true; for (const a of this.actors) if (a.inv && !a.dead) { a.dead = true; a.deadAt = this.t; } }
      return;
    }
    if (this.cfg.activity === 'chefe') {
      if (alive === 0) {
        this.spawnT -= dt;
        if (this.spawnT <= 0) { this.makeMob(this.bossDef(), this.mobLevel(), 'b', ARENA_W / 2, 3.6); this.spawnT = act.respawn; this.banner = 'Chefe apareceu!'; this.bannerT = 2; }
      }
      return;
    }
    if (this.cfg.activity === 'dungeon') {
      const bossFloor = this.floor % 5 === 0;
      const need = bossFloor ? FLOOR_MOBS - 2 : FLOOR_MOBS;
      if (this.bossSpawned) {
        if (alive === 0) { this.nextFloor(); }
        return;
      }
      if (this.floorKills >= need) {
        if (bossFloor) {
          if (alive === 0) { this.makeMob(this.bossDef(), this.mobLevel(), 'b', ARENA_W / 2, 3.6); this.bossSpawned = true; this.banner = `Chefe do andar ${this.floor}!`; this.bannerT = 2.5; }
        } else if (alive === 0) this.nextFloor();
        return;
      }
      if (this.floorKills + alive >= need) return;
    }
    if (alive < act.alive) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) { this.spawnRandom(); this.spawnT = act.respawn * (0.7 + this.rng() * 0.6); }
    }
  }

  private nextFloor() {
    this.acc.floorsCleared++;
    this.floor++; this.floorKills = 0; this.bossSpawned = false;
    this.banner = `Andar ${this.floor}`; this.bannerT = 2;
    this.spawnT = 1;
  }

  // ───────────── loop principal ─────────────
  step(dt = TICK) {
    this.t += dt;
    for (const a of this.actors) { a.px = a.x; a.py = a.y; }
    this.spawner(dt);
    if (this.player.dead && this.reviveAt >= 0 && this.t >= this.reviveAt) this.revive();
    for (const a of this.actors) if (a.dead && a.team === 0 && !a.isPlayer && !a.summon && this.t - a.deadAt > 20) { a.dead = false; a.hp = Math.round(a.maxHp * 0.5); a.x = a.homeX; a.y = a.homeY; }
    const list = this.actors.slice();
    for (const a of list) if (!a.dead) this.act(a, dt);
    this.separate();
    // limpeza
    if (this.actors.length > 40 || this.t % 2 < dt)
      this.actors = this.actors.filter((a) => !a.dead || a.isPlayer || (a.team === 0 && !a.summon) || this.t - a.deadAt < 0.8);
    if (this.cfg.fx) {
      for (const f of this.fx) f.t += dt;
      this.fx = this.fx.filter((f) => f.t < f.dur);
      for (const f of this.floats) f.t += dt;
      this.floats = this.floats.filter((f) => f.t < 1.1);
    }
    if (this.bannerT > 0) this.bannerT -= dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2);
    if (this.potCd > 0) this.potCd -= dt;
    if (this.potMpCd > 0) this.potMpCd -= dt;
  }

  private revive() {
    const p = this.player;
    p.dead = false; p.hp = Math.round(p.maxHp * 0.6); p.mp = Math.round(p.maxMp * 0.5);
    p.status = []; p.buffs = []; this.recalc(p);
    p.x = p.px = p.homeX; p.y = p.py = p.homeY; this.reviveAt = -1;
    for (const a of this.actors) if (a.team === 1) a.dead = true, a.deadAt = this.t - 1;
    for (const a of this.actors) if (a.team === 0 && !a.isPlayer && !a.summon && a.dead) { a.dead = false; a.hp = a.maxHp; }
    this.floorKills = 0; this.bossSpawned = false;
    if (this.cfg.activity === 'dungeon' && this.floor > 1) this.floor--;
    this.spawnT = 1.5;
  }

  private separate() {
    const L = this.actors;
    for (let i = 0; i < L.length; i++) {
      const a = L[i]; if (a.dead) continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j]; if (b.dead) continue;
        const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
        const min = 0.55 * Math.max(a.scale, b.scale) ** 0.7;
        if (d < min && d > 0.001) {
          const push = (min - d) * 0.35;
          a.x += (dx / d) * push; a.y += (dy / d) * push; b.x -= (dx / d) * push; b.y -= (dy / d) * push;
        }
      }
      a.x = Math.max(0.6, Math.min(ARENA_W - 0.6, a.x)); a.y = Math.max(0.8, Math.min(ARENA_H - 0.8, a.y));
      if (this.layout && !a.flying) for (const o of this.layout.obstacles) {
        const dx = a.x - o.x, dy = a.y - o.y, d = Math.hypot(dx, dy), m = o.r + 0.28 * Math.min(a.scale, 1.6);
        if (d < m && d > 0.0001) { a.x = o.x + (dx / d) * m; a.y = o.y + (dy / d) * m; }
      }
    }
  }

  private act(a: Actor, dt: number) {
    if (a.golden) { if (a.flash > 0) a.flash -= dt; if (!a.status.some((x) => x.k === 'stun' || x.k === 'freeze')) this.goldenAct(a, dt); for (const st of a.status) st.t -= dt; a.status = a.status.filter((x) => x.t > 0); return; }
    if (a.flash > 0) a.flash -= dt;
    if (a.atkAnim > 0) a.atkAnim -= dt;
    if (a.castAnim > 0) a.castAnim -= dt;
    // vida útil de invocações
    if (a.summon && a.life !== undefined) { a.life -= dt; if (a.life <= 0) { a.dead = true; a.deadAt = this.t; return; } }
    // regen
    if (a.team === 0 || a.regenMob) {
      const poisoned = this.has(a, 'poison');
      const hr = (a.team === 0 ? 0.003 : 0) + (a.m.regen ?? 0) + (poisoned ? 0 : a.regenMob);
      if (hr > 0 && a.hp < a.maxHp) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * hr * dt);
      if (a.team === 0 && a.maxMp) a.mp = Math.min(a.maxMp, a.mp + a.maxMp * 0.012 * dt + (a.m.mpRegen ?? 0) * dt + a.stats.sab * 0.03 * dt);
    }
    // status
    let stunned = false, slow = 1;
    for (const s of a.status) {
      s.t -= dt;
      if (s.k === 'stun' || s.k === 'freeze') stunned = true;
      else if (s.k === 'slow') slow = 0.55;
      else if (DOT_TYPE[s.k]) {
        const src = this.actors.find((x) => x.id === s.src) ?? a;
        const dmg = Math.max(1, Math.round(s.p * dt * (1 + (src.m.dotPct ?? 0)) * (a.res[DOT_TYPE[s.k]!] ?? 1)));
        if (a.res[DOT_TYPE[s.k]!] !== 0) {
          a.hp -= dmg;
          if (a.team === 1) this.acc.dmgDealt += dmg; else this.acc.dmgTaken += dmg;
          if (Math.random() < dt * 1.2) this.float(a.x, a.y, String(dmg), DMG_COL[DOT_TYPE[s.k]!], false);
          if (src.m.lifesteal && src.team === 0) this.healActor(src, dmg * src.m.lifesteal, true);
          if (a.hp <= 0) { this.kill(a, src); return; }
        }
      }
    }
    if (a.status.length) a.status = a.status.filter((s) => s.t > 0);
    if (a.buffs.length) {
      let ch = false;
      for (const b of a.buffs) { b.t -= dt; if (b.t <= 0) ch = true; }
      if (ch) { a.buffs = a.buffs.filter((b) => b.t > 0); this.recalc(a); }
    }
    if (a.dead) return;
    if (a.kbx || a.kby) { a.x += a.kbx * dt; a.y += a.kby * dt; const f = Math.pow(0.02, dt); a.kbx *= f; a.kby *= f; if (Math.abs(a.kbx) + Math.abs(a.kby) < 0.15) a.kbx = a.kby = 0; }
    // mecânicas de chefe
    if (a.mob?.boss) this.bossMech(a);
    if (a.stompAt > 0 && this.t >= a.stompAt) this.doStomp(a);
    if (stunned) return;
    if (a.isPlayer) this.autoPotion();
    const mv = a.spd * slow * (1 + (a.m.moveSpd ?? 0)) * dt;

    const tgt = this.pickTarget(a);
    if (!tgt) {
      if (a.team === 0) this.moveTo(a, a.homeX, a.homeY, mv * 0.8, 0.3);
      return;
    }
    a.target = tgt.id;
    const d = this.dist(a, tgt);
    a.face = tgt.x >= a.x ? 1 : -1;
    if (Battle.AI && a.team === 0 && !a.summon && a.classId && CLASS_AI[a.classId]) { if (this.allyAi(a, tgt, mv)) return; }
    if (a.team === 0 && a.skills.length && this.trySkills(a, tgt, mv)) return;
    const reach = a.range * (a.mob?.boss ? a.scale * 0.6 : 1);
    if (d > reach) { this.moveTo(a, tgt.x, tgt.y, mv, reach * 0.9); return; }
    // kiting de longa distância
    if (a.team === 0 && a.range > 3 && d < 2.2 && a.isPlayer) this.moveTo(a, a.x + (a.x - tgt.x), a.y + (a.y - tgt.y) + 1, mv * 0.7, 0);
    if (this.t >= a.nextAtk) { this.basicAttack(a, tgt); a.nextAtk = this.t + this.interval(a); }
  }


  // ───────────── IA de posicionamento e alvo ─────────────
  private aiTarget(a: Actor, cfg: AiCfg): Actor | null {
    if (a.focus !== undefined) {
      const f = this.actors.find((x) => x.id === a.focus);
      if (f && !f.dead && f.team === 1) return f;
      a.focus = undefined;
    }
    const cur = this.actors.find((x) => x.id === a.target);
    if (cur && !cur.dead && cur.team === 1 && this.t < a.tgtUntil) return cur;
    let best: Actor | null = null, bs = -1e9;
    for (const e of this.actors) {
      if (e.team !== 1 || e.dead) continue;
      const d = this.dist(a, e);
      let s = -d * 0.3;
      if (cfg.prio === 'lowhp') s += (1 - e.hp / e.maxHp) * 4 - Math.min(e.hp / Math.max(1, a.stats[a.basic.sc] * 20), 3) * 0.3;
      else if (cfg.prio === 'danger') s += (e.range > 2.8 ? 3 : 0) + (e.variant !== 'n' ? 1.5 : 0) + (e.regenMob ? 0.5 : 0);
      else if (cfg.prio === 'advantage') { const m = (e.res[a.basic.dmg] ?? 1) * (1 + (a.m.vs?.[e.kind!] ?? 0) + (e.slowKind ? a.m.vsSlow ?? 0 : 0)); s += (m - 1) * 3; }
      else s -= d * 0.2;
      if (cfg.style === 'kite' && e.range > 2.8 && cfg.prio !== 'nearest') s += 2.5; // à distância: inimigos ranged primeiro
      if (e.golden) s += 3;
      if (cur === e) s += 0.8; // histerese
      if (s > bs) { bs = s; best = e; }
    }
    if (best) a.tgtUntil = this.t + 0.6;
    return best;
  }

  private threatsFor(a: Actor): Threat[] {
    const out: Threat[] = [];
    for (const e of this.actors) {
      if (e.team !== 1 || e.dead) continue;
      // velocidade medida entre reavaliações
      if (this.t - e.lt >= 0.1) { if (this.t - e.lt < 0.6) { e.vx = (e.x - e.lx) / (this.t - e.lt); e.vy = (e.y - e.ly) / (this.t - e.lt); } else { e.vx = e.vy = 0; } e.lx = e.x; e.ly = e.y; e.lt = this.t; }
      if (this.dist(a, e) > 9.5) continue;
      out.push({ x: e.x, y: e.y, vx: e.vx, vy: e.vy, range: e.range * (e.mob?.boss ? e.scale * 0.6 : 1), spd: e.spd * (e.status.some((x) => x.k === 'stun' || x.k === 'freeze') ? 0.05 : e.status.some((x) => x.k === 'slow') ? 0.55 : 1), melee: e.range < 2.8, stomp: e.stompAt > 0 });
    }
    return out;
  }

  private aiLogPush(a: Actor, text: string, force = false) {
    if (!this.debug || !a.isPlayer) return;
    const last = this.aiLog[this.aiLog.length - 1];
    if (!force && last && last.text === text) return;
    this.aiLog.push({ t: this.t, text }); if (this.aiLog.length > 40) this.aiLog.shift();
  }

  private aiPlan(a: Actor, tgt: Actor, cfg: AiCfg) {
    const map = this.aiMap;
    const threats = this.threatsFor(a);
    const hpF = a.hp / a.maxHp;
    const dd = (e: Threat) => Math.hypot(e.x - a.x, e.y - a.y);
    const nearCount = threats.filter((e) => dd(e) < cfg.nearR).length;
    // tempo até o contato (reação antecipada): recua ANTES de o mob chegar
    const ttc = (e: Threat) => Math.max(0, dd(e) - (e.range + 0.4)) / Math.max(0.6, e.spd);
    const soon = threats.filter((e) => e.melee && (ttc(e) < cfg.react || dd(e) < cfg.safe));
    const curOpen = openAt(map, a.x, a.y);
    const trapped = curOpen < cfg.minOpen && soon.length > 0;
    const surrounded = nearCount > cfg.maxNear + 1;
    const emergency = (hpF < cfg.retreatHp && nearCount > 0) || surrounded || trapped;
    let threatened = cfg.style === 'kite' ? soon.length > 0 : ((nearCount > cfg.maxNear && hpF < 0.65) || (hpF < cfg.retreatHp && nearCount > 0));
    // recuar não está funcionando (mobs colados por muito tempo)? desiste e luta por um instante
    if (threatened && !emergency) { if (a.kiteSince < 0) a.kiteSince = this.t; if (this.t - a.kiteSince > 3 && this.t > a.standUntil) { a.standUntil = this.t + 1.6; a.kiteSince = -1; } if (this.t < a.standUntil) threatened = false; }
    else if (!threatened) a.kiteSince = -1;
    const wasBesieged = a.ai?.mode === 'besieged';
    const zones = this.actors.filter((e) => e.team === 1 && !e.dead && e.stompAt > 0).map((e) => ({ x: e.x, y: e.y, r: 3.4 }));
    const w = emergency ? { ...cfg.w, melee: cfg.w.melee * 2, ideal: cfg.w.ideal * 0.3, center: 0, range: 0 } : cfg.w;
    const ctx: ScoreCtx = { cfg, w, map, ax: a.x, ay: a.y, tgt: { x: tgt.x, y: tgt.y }, range: a.range, threats, mask: threatMask(threats), zones, cx: 6, cy: 8.5, emergency };
    const cur = scorePos(ctx, a.x, a.y);
    const cands: [number, number, number][] = [];
    const R = cfg.radius; const tx0 = Math.floor(a.x), ty0 = Math.floor(a.y);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy > R * R || ((dx + dy) & 1 && dx * dx + dy * dy > 4)) continue; // xadrez fora do entorno imediato (economiza CPU)
      const x = tx0 + dx + 0.5, y = ty0 + dy + 0.5;
      if (!inBounds(x, y) || !freeAt(map.obstacles, x, y)) continue;
      if (openAt(map, x, y) < Math.min(cfg.minOpen, curOpen) && routesAt(map, x, y) < 0.5) continue; // nunca recua para beco/canto
      cands.push([x, y, scorePos(ctx, x, y, false)]);
    }
    cands.sort((p, q) => q[2] - p[2]);
    // 2ª passada (cara: corredor livre + área alcançável) só nos melhores candidatos
    if (cands.length > 8) cands.length = 8;
    for (const c of cands) c[2] = scorePos(ctx, c[0], c[1], true);
    cands.sort((p, q) => q[2] - p[2]);
    const avoid = this.actors.filter((e) => e.team === 1 && !e.dead);
    const engageMargin = 0.8;
    const margin = !threatened ? engageMargin : wasBesieged ? 1.2 : 0.05;
    let dest: { x: number; y: number } | null = null, path: { x: number; y: number }[] = [];
    for (let i = 0; i < Math.min(3, cands.length); i++) {
      const c = cands[i];
      if (c[2] < cur + margin) break;
      const p = astar(map, a.x, a.y, c[0], c[1], avoid);
      if (p && p.length <= R * 2.4) { dest = { x: c[0], y: c[1] }; path = p; break; }
    }
    const noRoute = threatened && !dest;
    // modo cercado: aceita ficar encurralado, luta para abrir caminho e volta ao kiting quando abrir uma brecha real
    const besieged = noRoute && nearCount >= 1;
    const mode: 'engage' | 'kite' | 'besieged' = besieged ? 'besieged' : threatened ? 'kite' : 'engage';
    a.ai = { mode, path, cornered: besieged, emergency, nm: Math.min(99, ...threats.filter((e) => e.melee).map((e) => dd(e))) };
    a.aiEmergency = emergency;
    // motivo da decisão (log de depuração)
    let reason = '';
    const fm = (n: number) => n.toFixed(1);
    if (besieged) reason = `cercado: sem rota válida (${nearCount} mobs perto) → lutando para abrir caminho`;
    else if (wasBesieged && dest) reason = 'brecha encontrada: saindo do cerco';
    else if (threatened && dest) { const m = soon[0]; reason = m ? `recuando: ${soon.length} mob(s), contato em ${fm(ttc(m))}s, a ${fm(dd(m))} tiles → destino (${fm(dest.x)}, ${fm(dest.y)})` : `recuando: HP ${Math.round(hpF * 100)}%`; }
    else if (threatened) reason = 'ameaçado mas já na melhor posição';
    else if (dest) reason = `posicionando: ajustando distância ideal (${fm(cfg.ideal)}) do alvo`;
    else reason = 'parado: posição boa, atacando';
    if (emergency) reason = `EMERGÊNCIA (${hpF < cfg.retreatHp ? 'HP baixo' : surrounded ? 'cercado por ' + nearCount : 'beco'}): ` + reason;
    // manobra real (sem teleporte): salto/investida/empurrão
    const man = a.maneuver; let maneuverNote = '';
    if (man && a.auto.maneuver !== false && emergency && (noRoute || surrounded || hpF < cfg.retreatHp) && this.t >= a.dashCd) {
      if (man.kind === 'push') {
        const near = this.enemies.filter((e) => this.dist(a, e) < (man.push ?? 2.4));
        if (near.length) { this.doPush(a, near, man); a.dashCd = this.t + man.cd; maneuverNote = `manobra: ${man.name}`; }
      } else {
        let best: [number, number, number] | null = null;
        for (const c of cands) {
          const d = Math.hypot(c[0] - a.x, c[1] - a.y); if (d < 1.0 || d > man.dist) continue;
          if (c[2] < cur + 1.5 || (best && c[2] <= best[2])) continue;
          if (losBlocked(map.obstacles, a.x, a.y, c[0], c[1])) continue;                    // não atravessa paredes/obstáculos
          if (this.segHitsEnemy(a.x, a.y, c[0], c[1], 0.6)) continue;                       // nem mobs
          best = c;
        }
        if (best) { this.startManeuver(a, best[0], best[1], man); a.dashCd = this.t + man.cd; maneuverNote = `manobra: ${man.name} → (${fm(best[0])}, ${fm(best[1])})`; a.ai.path = []; dest = null; path = []; }
        else if (noRoute) maneuverNote = 'manobra indisponível: sem trajeto livre';
      }
    }
    if (maneuverNote) reason += ' | ' + maneuverNote;
    this.aiLogPush(a, reason);
    if (this.debug) a.dbg = { cands: cands.slice(0, 120), dest, path, mode, emergency, cornered: besieged, threats: threats.map((e) => ({ x: e.x, y: e.y, melee: e.melee })), ideal: cfg.ideal, safe: cfg.safe, range: a.range, hp: hpF, dashIn: Math.max(0, a.dashCd - this.t), note: reason };
  }

  private segHitsEnemy(x0: number, y0: number, x1: number, y1: number, r: number) {
    const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1;
    for (const e of this.enemies) { let t = ((e.x - x0) * dx + (e.y - y0) * dy) / l2; t = Math.max(0, Math.min(1, t)); if (Math.hypot(x0 + dx * t - e.x, y0 + dy * t - e.y) < r + 0.15 * e.scale) return true; }
    return false;
  }

  /** Manobra: o ator ANDA em alta velocidade (nunca muda de posição instantaneamente). */
  private startManeuver(a: Actor, x: number, y: number, m: Maneuver) {
    const dist = Math.hypot(x - a.x, y - a.y);
    a.dash = { x0: a.x, y0: a.y, tx: x, ty: y, t: 0, dur: Math.max(0.2, dist / 8), kind: m.kind === 'jump' ? 'jump' : 'dash' };
    this.addFx('ring', a.x, a.y, 0, 0, 0.3, m.col, 1.1);
    this.float(a.x, a.y - 0.8, m.name + '!', m.col);
  }
  private stepDash(a: Actor, dt: number) {
    const d = a.dash!; d.t += dt;
    const prog = Math.min(1, d.t / d.dur);
    const nx = d.x0 + (d.tx - d.x0) * prog, ny = d.y0 + (d.ty - d.y0) * prog;
    const blockedNow = !inBounds(nx, ny) || !freeAt(this.aiMap.obstacles, nx, ny, 0.2) || this.enemies.some((e) => Math.hypot(e.x - nx, e.y - ny) < 0.45 + 0.12 * e.scale);
    if (blockedNow) { a.dash = undefined; a.air = 0; this.aiLogPush(a, 'manobra interrompida: obstáculo/mob no caminho', true); return; }
    a.x = nx; a.y = ny; a.air = d.kind === 'jump' ? Math.sin(prog * Math.PI) * 1.5 : 0;
    if (this.cfg.fx) this.addFx('spark', nx, ny, 0, 0, 0.25, '#cfe8ff', 0.5);
    if (prog >= 1) { a.dash = undefined; a.air = 0; if (a.maneuver?.kind === 'dash') this.addFx('ring', a.x, a.y, 0, 0, 0.3, a.maneuver.col, 1); }
    if (a.maneuver?.name === 'Impulso Arcano' && prog >= 1) for (const e of this.enemies) if (this.dist(a, e) < 2.6) e.status.push({ k: 'slow', t: 2.5, p: 0, src: a.id });
  }
  private doPush(a: Actor, near: Actor[], m: Maneuver) {
    this.addFx('ring', a.x, a.y, 0, 0, 0.4, m.col, m.push ?? 2.4); this.addFx('pillar', a.x, a.y, 0, 0, 0.5, m.col, 1.6);
    this.float(a.x, a.y - 0.8, m.name + '!', m.col);
    for (const e of near) { const dx = e.x - a.x, dy = e.y - a.y, l = Math.hypot(dx, dy) || 1; const f = e.variant === 'b' ? 3 : 7; e.kbx = (dx / l) * f; e.kby = (dy / l) * f; if (e.variant !== 'b') e.status.push({ k: 'stun', t: 0.6, p: 0, src: a.id }); }
  }

  private allyAi(a: Actor, tgt0: Actor, mv: number): boolean {
    const cfg = CLASS_AI[a.classId!];
    let tgt = tgt0;
    if (a.dash) { this.stepDash(a, TICK); return true; }
    if (this.t >= a.aiNext || !a.ai) { this.aiPlan(a, tgt, cfg); a.aiNext = this.t + AI_STEP; }
    const ai = a.ai!;
    if (a.dash) return true;
    // cercado: ataca o mob mais fraco colado para abrir caminho
    if (ai.mode === 'besieged') {
      let weak: Actor | null = null;
      for (const e of this.enemies) if (this.dist(a, e) < Math.max(2.4, a.range * 0.4) && (!weak || e.hp < weak.hp)) weak = e;
      if (weak) { tgt = weak; a.tgtUntil = this.t + 0.5; a.target = weak.id; }
    }
    if (a.skills.length && this.trySkills(a, tgt, mv)) return true;
    // segue o caminho escolhido (A*), andando tile a tile
    let step = mv;
    while (ai.path.length && step > 0) {
      const n = ai.path[0]; const dx = n.x - a.x, dy = n.y - a.y, l = Math.hypot(dx, dy);
      if (l < 0.12) { ai.path.shift(); continue; }
      const s = Math.min(step, l); a.x += (dx / l) * s; a.y += (dy / l) * s; step -= s;
      if (Math.abs(dx) > 0.05) a.face = dx > 0 ? 1 : -1;
      if (s >= l - 0.001) ai.path.shift();
    }
    const moving = ai.path.length > 0;
    const d2 = this.dist(a, tgt);
    if (d2 <= a.range && this.t >= a.nextAtk && (ai.mode !== 'kite' || !moving || ai.nm > (cfg.style === 'melee' ? 0 : 1.5))) {
      a.face = tgt.x >= a.x ? 1 : -1; this.basicAttack(a, tgt); a.nextAtk = this.t + this.interval(a);
    } else if (!moving && d2 > a.range * 0.95 && ai.mode === 'engage') {
      this.moveTo(a, tgt.x, tgt.y, mv, a.range * 0.85);
    }
    return true;
  }

  private moveTo(a: Actor, x: number, y: number, step: number, stop: number) {
    const dx = x - a.x, dy = y - a.y, d = Math.hypot(dx, dy);
    if (d <= stop || d < 0.001) return;
    const s = Math.min(step, d - stop);
    a.x += (dx / d) * s; a.y += (dy / d) * s;
    if (Math.abs(dx) > 0.05) a.face = dx > 0 ? 1 : -1;
  }

  private pickTarget(a: Actor): Actor | null {
    if (a.team === 0 && Battle.AI && !a.summon && a.classId && CLASS_AI[a.classId]) return this.aiTarget(a, CLASS_AI[a.classId]);
    if (a.team === 0) {
      if (a.focus !== undefined) {
        const f = this.actors.find((x) => x.id === a.focus);
        if (f && !f.dead && f.team === 1) return f;
        a.focus = undefined;
      }
      let best: Actor | null = null, bd = 1e9;
      for (const e of this.actors) if (e.team === 1 && !e.dead) { const d = this.dist(a, e); if (d < bd) { bd = d; best = e; } }
      return best;
    }
    const taunt = a.status.find((s) => s.k === 'taunt');
    if (taunt) { const t = this.actors.find((x) => x.id === taunt.src); if (t && !t.dead) return t; }
    let best: Actor | null = null, bd = 1e9;
    for (const e of this.actors) if (e.team === 0 && !e.dead) { const d = this.dist(a, e) - (e.summon ? 0.4 : 0); if (d < bd) { bd = d; best = e; } }
    return best;
  }

  private basicAttack(a: Actor, tgt: Actor) {
    a.atkAnim = 0.2;
    const base = this.powOf(a, a.basic.sc);
    const ranged = a.range > 2.5;
    if (ranged) this.addFx('proj', a.x, a.y - 0.3, tgt.x, tgt.y, 0.18, VFX_COL[a.basic.vfx] ?? '#fff', 1);
    else this.addFx('slash', tgt.x, tgt.y, a.face, 0, 0.18, '#ffffff', 1);
    this.strike(a, tgt, base, a.basic.dmg);
  }

  // ───────────── skills ─────────────
  private area(a: Actor, s: Skill, tgt: Actor): Actor[] {
    const en = this.actors.filter((e) => e.team === 1 && !e.dead);
    const n = s.n ?? 1;
    const byDist = (c: { x: number; y: number }) => en.map((e) => [e, Math.hypot(e.x - c.x, e.y - c.y)] as const).sort((p, q) => p[1] - q[1]);
    if (s.all) return byDist(a).slice(0, n).map((p) => p[0]);
    if (s.self) return byDist(a).filter((p) => p[1] <= (s.r ?? 2) + 0.4).slice(0, n).map((p) => p[0]);
    if (s.r) return byDist(tgt).filter((p) => p[1] <= s.r!).slice(0, n).map((p) => p[0]);
    if (n > 1) return byDist(tgt).slice(0, n).map((p) => p[0]);
    return [tgt];
  }

  private should(a: Actor, s: Skill, tgt: Actor): boolean {
    const en = this.enemies;
    const cfg = Battle.AI && a.classId ? CLASS_AI[a.classId] : undefined;
    if (cfg?.emergencySkills.includes(s.id) && !a.aiEmergency && a.ai?.mode !== 'besieged' && en.filter((e) => this.dist(a, e) < 3).length < 3) return false; // guardada para emergência
    switch (s.kind) {
      case 'atk': {
        if (!s.all && !s.self && this.dist(a, tgt) > a.range) return false;
        const hit = this.area(a, s, tgt).length;
        if (s.dmg && !s.st?.k && this.area(a, s, tgt).every((e) => e.res[s.dmg!] === 0)) return false;
        if (s.dmg && s.st && DOT_TYPE[s.st.k] && this.area(a, s, tgt).every((e) => e.res[s.dmg!] === 0)) return false;
        if (s.st?.k === 'poison' && s.n === 1 && tgt.status.some((x) => x.k === 'poison' && x.t > 2)) return false;
        if (s.st?.k === 'vuln' && en.every((e) => e.status.some((x) => x.k === 'vuln'))) return false;
        if ((s.n ?? 1) > 1 || s.all) {
          const strong = en.some((e) => e.variant === 'b') || tgt.maxHp > a.maxHp * 4;
          if (en.length >= 2 || strong || s.pw! >= 5) return hit >= Math.min(2, en.length) || strong;
          return hit >= 1 && s.pw! >= 5;
        }
        return true;
      }
      case 'heal': {
        const al = this.allies.filter((x) => !x.summon);
        const low = al.filter((x) => x.hp < x.maxHp * 0.65);
        if (s.dmg) return en.length > 0 && al.some((x) => x.hp < x.maxHp * 0.8);
        if (s.party) return low.length >= 2 || al.some((x) => x.hp < x.maxHp * 0.45);
        return low.length > 0;
      }
      case 'buff': {
        const bid = s.id;
        if (a.buffs.some((b) => b.id === bid && b.t > 3)) return false;
        const dangerous = s.buff!.mods.defPct || s.buff!.mods.dmgRed || s.buff!.mods.thorns;
        const near = en.filter((e) => this.dist(a, e) < 6).length;
        if (dangerous) return near >= 1 && (a.hp < a.maxHp * 0.85 || near >= 3 || en.some((e) => e.variant !== 'n'));
        return near >= 1 && (en.length >= 2 || en.some((e) => e.maxHp > a.maxHp));
      }
      case 'summon': return this.actors.filter((x) => x.summon && x.ownerId === a.id && !x.dead).length + s.summon!.n <= 4 && en.length > 0;
      case 'taunt': return en.some((e) => this.dist(a, e) < (s.r ?? 5) && !e.status.some((x) => x.k === 'taunt' && x.src === a.id));
    }
  }

  private trySkills(a: Actor, tgt0: Actor, mv: number): boolean {
    let tgt = tgt0;
    if (this.t < a.gcd) return false;
    for (let i = a.skills.length - 1; i >= 0; i--) {
      const s = a.skills[i]; tgt = tgt0;
      if ((a.cd[s.id] ?? 0) > this.t) continue;
      const cost = skillMpCost(s.mp, a.level);
      if (a.mp < cost) continue;
      const manual = a.force === s.id;
      if (!manual && !(a.auto[s.id] ?? true)) continue;
      let useT = tgt;
      const cc = Battle.AI && a.classId ? CLASS_AI[a.classId]?.controlSkills.includes(s.id) : false;
      if (cc && !manual) { // controle (lentidão/congelar/atordoar) no mob que está chegando
        let best: Actor | null = null, bd = 4.6;
        for (const e of this.enemies) { const dd = this.dist(a, e); if (e.range < 2.8 && e.variant !== 'b' && dd < bd && !e.status.some((x) => x.k === 'slow' || x.k === 'stun' || x.k === 'freeze')) { bd = dd; best = e; } }
        if (best) useT = best;
      }
      if (!manual && !this.should(a, s, useT)) continue;
      tgt = useT;
      if (s.kind === 'atk' && !s.all) {
        const need = s.self ? (s.r ?? 2) + 0.3 : a.range;
        const dd = s.self ? Math.min(...this.enemies.map((e) => this.dist(a, e))) : this.dist(a, tgt);
        if (dd > need) { if (manual) { this.moveTo(a, tgt.x, tgt.y, mv, need * 0.8); return true; } continue; }
      }
      this.cast(a, s, tgt, cost);
      if (manual) a.force = undefined;
      return true;
    }
    if (a.force) { const fs = a.skills.find((x) => x.id === a.force); if (!fs || (a.cd[fs.id] ?? 0) - this.t > 3 || this.t > a.gcd + 4) a.force = undefined; }
    return false;
  }

  castManual(id: string) {
    const p = this.player;
    if (p.dead) return;
    const s = p.skills.find((x) => x.id === id);
    if (!s) return;
    if ((p.cd[id] ?? 0) > this.t) { this.float(p.x, p.y, 'Recarga', '#aaa'); return; }
    if (p.mp < skillMpCost(s.mp, p.level)) { this.float(p.x, p.y, 'Sem MP', '#6a9aff'); return; }
    if (!this.enemies.length && s.kind === 'atk') { this.float(p.x, p.y, 'Sem alvo', '#aaa'); return; }
    p.force = id;
  }

  cast(a: Actor, s: Skill, tgt: Actor, cost: number) {
    a.mp -= cost;
    a.cd[s.id] = this.t + s.cd * (1 - Math.min(0.5, a.m.cdr ?? 0));
    a.gcd = this.t + 0.5; a.castAnim = 0.3; a.atkAnim = 0.25;
    const vcol = s.col;
    const sc = s.sc ?? 'for';
    const pow = this.powOf(a, sc);
    if (s.kind === 'atk' || (s.kind === 'heal' && s.dmg)) {
      const targets = this.area(a, s, tgt);
      const hits = s.hits ?? 1;
      const type = s.dmg ?? 'fisico';
      let dealt = 0;
      this.skillFx(a, s, tgt, targets);
      if (targets.length) {
        for (let h = 0; h < hits; h++) {
          const list = hits > 1 && targets.length > 1 && s.all ? [targets[Math.floor(this.rng() * targets.length)]] : targets;
          for (const t of list) { if (!t.dead) dealt += this.strike(a, t, pow * (s.pw ?? 1), type, { crit: s.crit }); }
        }
        if (s.st) for (const t of targets) if (!t.dead) this.applyStatus(a, t, s, pow);
        if (s.drain) this.healActor(a, dealt * s.drain);
      }
    }
    if (s.kind === 'heal') {
      const amt = (a.stats.sab * (s.heal ?? 1) + a.wAtk * 0.5) * (1 + (a.m.healPct ?? 0));
      const al = this.allies.filter((x) => !x.summon);
      const tg = s.party ? al : [al.slice().sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp)[0] ?? a];
      for (const t of tg) { this.healActor(t, amt); this.addFx('rise', t.x, t.y, 0, 0, 0.8, '#6aff8a', 1); }
      if (s.vfx === 'heal' && s.dmg) this.addFx('pillar', a.x, a.y, 0, 0, 0.7, '#fff3a0', 3);
    }
    if (s.kind === 'buff' && s.buff) {
      const tg = s.buff.party ? this.allies : [a];
      for (const t of tg) this.addBuff(t, s, s.buff.mods, s.buff.d);
      this.addFx('ring', a.x, a.y, 0, 0, 0.6, vcol, 1.6);
    }
    if (s.kind === 'taunt') {
      for (const e of this.enemies) if (this.dist(a, e) < (s.r ?? 5)) e.status.push({ k: 'taunt', t: s.taunt ?? 5, p: 0, src: a.id });
      if (s.buff) this.addBuff(a, s, s.buff.mods, s.buff.d);
      this.addFx('ring', a.x, a.y, 0, 0, 0.6, vcol, s.r ?? 5);
    }
    if (s.kind === 'summon' && s.summon) {
      for (let i = 0; i < s.summon.n; i++) this.makeSummon(a, s);
      this.addFx('ring', a.x, a.y, 0, 0, 0.6, vcol, 1.8);
    }
    this.float(a.x, a.y - 0.6, s.name, vcol);
  }

  private addBuff(t: Actor, s: Skill, mods: Mods, dur: number) {
    t.buffs = t.buffs.filter((b) => b.id !== s.id);
    t.buffs.push({ id: s.id, name: s.name, icon: s.icon, col: s.col, t: dur, dur, mods });
    this.recalc(t);
  }

  private applyStatus(src: Actor, t: Actor, s: Skill, pow: number) {
    const st = s.st!;
    const dotType = DOT_TYPE[st.k];
    let p = st.p ?? 0;
    if (dotType) p = pow * p * (src.m.summonPct ? 1 : 1);
    if (st.k === 'vuln') { t.status = t.status.filter((x) => x.k !== 'vuln'); }
    if ((st.k === 'stun' || st.k === 'freeze') && t.variant === 'b') { t.status.push({ k: 'slow', t: st.d, p: 0, src: src.id }); return; }
    const ex = t.status.find((x) => x.k === st.k && dotType);
    if (ex) { ex.t = st.d; ex.p = Math.max(ex.p, p); return; }
    t.status.push({ k: st.k, t: st.d, p, src: src.id });
  }

  private makeSummon(o: Actor, s: Skill) {
    const sm = s.summon!;
    const own = this.actors.filter((x) => x.summon && x.ownerId === o.id && !x.dead);
    if (own.length >= 4) { own[0].dead = true; own[0].deadAt = this.t; }
    const a = this.blank(0, 'Esqueleto', o.level);
    const k = 1 + (o.m.summonPct ?? 0);
    a.summon = true; a.ownerId = o.id; a.life = sm.d;
    a.maxHp = a.hp = Math.round((o.stats.int * sm.hp + o.level * 8 + 50) * k);
    for (const st of STATS) a.stats[st] = (o.stats.int * sm.atk + o.level * 1.5 + 3) * k;
    a.stats.agi = 0;
    a.defRaw = o.stats.int * 0.5; a.mdefRaw = a.defRaw;
    a.baseInterval = 1.3; a.range = 1.4; a.spd = 2.6; a.basic = { sc: 'for', dmg: 'fisico', vfx: 'slash' };
    a.sprite = 'esqueleto'; a.color = '#8affc8'; a.res = {};
    a.x = a.px = o.x + (this.rng() - 0.5) * 1.5; a.y = a.py = o.y - 0.6 - this.rng();
    a.homeX = o.homeX; a.homeY = o.homeY - 1;
    a.auto = {}; this.actors.push(a);
  }

  private skillFx(a: Actor, s: Skill, tgt: Actor, targets: Actor[]) {
    if (!this.cfg.fx) return;
    const col = s.col;
    const c = s.self ? a : tgt;
    switch (s.vfx) {
      case 'slash': case 'smash': case 'quake':
        if (s.self) this.addFx('ring', a.x, a.y, 0, 0, 0.35, col, s.r ?? 2);
        for (const t of targets.slice(0, 8)) this.addFx('slash', t.x, t.y, a.face, 0, 0.25, col, 1.4);
        if (s.vfx === 'quake') this.addFx('ring', c.x, c.y, 0, 0, 0.5, col, s.all ? 8 : 2.5);
        break;
      case 'arrow': this.addFx('proj', a.x, a.y - 0.3, tgt.x, tgt.y, 0.2, col, 1.4); break;
      case 'rain': for (let i = 0; i < 8; i++) this.addFx('proj', c.x + (this.rng() - 0.5) * (s.r ?? 3) * 2, c.y - 5, c.x + (this.rng() - 0.5) * (s.r ?? 3) * 1.5, c.y + (this.rng() - 0.5) * (s.r ?? 3), 0.3 + i * 0.03, col, 1); break;
      case 'fire':
        if (s.all) for (const t of targets.slice(0, 8)) this.addFx('meteor', t.x, t.y, 0, 0, 0.5, col, 1.6);
        else if ((s.r ?? 0) > 2) for (let i = 0; i < 4; i++) this.addFx('meteor', tgt.x + (this.rng() - 0.5) * s.r! * 1.5, tgt.y + (this.rng() - 0.5) * s.r! * 1.5, 0, 0, 0.5 + i * 0.12, col, 1.6);
        else { this.addFx('proj', a.x, a.y - 0.3, tgt.x, tgt.y, 0.22, col, 1.4); this.addFx('ring', tgt.x, tgt.y, 0, 0, 0.45, col, s.r ?? 1); }
        break;
      case 'ice':
        if (s.self) this.addFx('ring', a.x, a.y, 0, 0, 0.6, col, s.r ?? 3);
        else { this.addFx('proj', a.x, a.y - 0.3, tgt.x, tgt.y, 0.2, col, 1.4); this.addFx('ring', tgt.x, tgt.y, 0, 0, 0.4, col, 1); }
        break;
      case 'bolt': { let px = a.x, py = a.y - 0.3; for (const t of targets.slice(0, 9)) { this.addFx('bolt', px, py, t.x, t.y, 0.3, col, 1); px = t.x; py = t.y; } break; }
      case 'holy':
        if (s.all) for (const t of targets.slice(0, 8)) this.addFx('pillar', t.x, t.y, 0, 0, 0.6, col, 1.4);
        else { this.addFx('pillar', tgt.x, tgt.y, 0, 0, 0.45, col, s.r ?? 1); }
        break;
      case 'dark': case 'drain':
        if (s.all) for (const t of targets.slice(0, 8)) this.addFx('spark', t.x, t.y, 0, 0, 0.6, col, 1.5);
        else this.addFx('proj', a.x, a.y - 0.3, tgt.x, tgt.y, 0.22, col, 1.3);
        if (s.r) this.addFx('ring', tgt.x, tgt.y, 0, 0, 0.5, col, s.r);
        break;
      case 'poison':
        for (const t of targets.slice(0, 8)) { this.addFx('proj', a.x, a.y - 0.3, t.x, t.y, 0.25, col, 1); this.addFx('ring', t.x, t.y, 0, 0, 0.5, col, 1); }
        break;
      case 'shout': this.addFx('ring', a.x, a.y, 0, 0, 0.5, col, s.r ?? 2.5); break;
      default: break;
    }
  }

  // ───────────── chefes ─────────────
  private bossMech(a: Actor) {
    const m = a.mob!.mechs ?? [];
    if (m.includes('enrage') && !a.enraged && a.hp < a.maxHp * 0.3) {
      a.enraged = true; a.bm = { ...a.bm, aspd: (a.bm.aspd ?? 0) + 0.5 };
      a.stats.for *= 1.5; a.stats.int *= 1.5; this.recalc(a);
      this.banner = `${a.name} enfureceu!`; this.bannerT = 2; this.float(a.x, a.y - 1, 'ENFURECIDO!', '#ff3030', true);
      a.buffs.push({ id: 'enrage', name: 'Enfurecido', icon: 'flame', col: '#ff3030', t: 999, dur: 999, mods: {}, debuff: false });
    }
    if (m.includes('adds') && this.t >= a.nextAdd) {
      a.nextAdd = this.t + 12;
      if (this.actors.filter((x) => x.isAdd && !x.dead).length < 4) {
        const map = MAP_BY_ID[this.cfg.mapId];
        const pool = this.cfg.poolOverride ? this.cfg.poolOverride.map((id) => ({ id, w: 1 })) : map.mobs;
        for (let i = 0; i < 2; i++) this.makeMob(MOB_BY_ID[pickW(this.rng, pool).id], a.level, 'n', a.x + (i ? 1.2 : -1.2), a.y + 0.8, true);
        this.float(a.x, a.y - 1, 'Reforços!', '#ffb060', true);
      }
    }
    if (m.includes('stomp') && this.t >= a.nextStomp && a.stompAt < 0) {
      a.nextStomp = this.t + 9; a.stompAt = this.t + 1.0;
      this.addFx('warn', a.x, a.y, 0, 0, 1.0, '#ff4040', 3.2);
    }
  }

  private doStomp(a: Actor) {
    a.stompAt = -1;
    this.addFx('ring', a.x, a.y, 0, 0, 0.4, '#ff8040', 3.2);
    const type = a.mob!.dmg;
    for (const t of this.allies) if (this.dist(a, t) <= 3.2 + (a.scale - 1) * 0.5) this.strike(a, t, a.stats.for * 1.6, type);
  }

  // ───────────── poções ─────────────
  private autoPotion() {
    const bag = this.cfg.bag; const p = this.player;
    if (!bag || !bag.on) return;
    if (bag.hp > 0 && this.potCd <= 0 && p.hp < p.maxHp * bag.hpTh) this.usePotion('hp');
    if (bag.mp > 0 && this.potMpCd <= 0 && p.maxMp > 0 && p.mp < p.maxMp * bag.mpTh) this.usePotion('mp');
  }
  usePotion(k: 'hp' | 'mp'): boolean {
    const bag = this.cfg.bag; const p = this.player;
    if (!bag || p.dead || bag[k] <= 0) return false;
    if (k === 'hp') { if (p.hp >= p.maxHp) return false; bag.hp--; this.potCd = 6; this.healActor(p, p.maxHp * 0.45); }
    else { if (p.mp >= p.maxMp) return false; bag.mp--; this.potMpCd = 6; p.mp = Math.min(p.maxMp, p.mp + p.maxMp * 0.5); this.float(p.x, p.y, '+MP', '#6aa0ff'); }
    this.acc.potions++;
    this.addFx('rise', p.x, p.y, 0, 0, 0.7, k === 'hp' ? '#ff6a6a' : '#6aa0ff', 1);
    return true;
  }

  focusAt(x: number, y: number) {
    let best: Actor | null = null, bd = 1.6;
    for (const e of this.enemies) { const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; best = e; } }
    this.player.focus = best ? best.id : undefined;
    return !!best;
  }
}

export const DMG_COL: Record<DmgType, string> = {
  fisico: '#f0e8d8', fogo: '#ffa04d', gelo: '#8fe8ff', raio: '#fff060', sagrado: '#fff8b0', sombrio: '#c890ff', veneno: '#80f070',
};
export const VFX_COL: Partial<Record<Vfx, string>> = { fire: '#ff8a3d', dark: '#b46bff', holy: '#fff3a0', arrow: '#d8f0a0', ice: '#7fe0ff', bolt: '#ffe94d' };
