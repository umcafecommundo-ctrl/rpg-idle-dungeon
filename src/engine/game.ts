// Controlador do jogo: estado salvo, loop de combate, ações do jogador e ganhos offline.
import { CLASS_BY_ID } from '../data/classes';
import { MAPS, MAP_BY_ID } from '../data/maps';
import type { Activity, Item, Mods, Rarity, Slot, Stat } from '../data/types';
import { RARITIES, SLOTS, STATS } from '../data/types';
import { Battle, type Bag, type PartyMember } from './battle';
import { audio } from '../audio/audio';
import { generateLayout } from '../render/mapgen';
import { autoAlloc, derive, mergeMods, nodeUnlocked, statPointsFor, talentPointsFor, TICK, xpToNext, MAX_LEVEL, MIN_PRESTIGE_LEVEL, zeroStats, type Derived } from './formulas';
import { itemScore, rollItem, sellValue } from './loot';
import { mulberry32 } from './rng';
import { exportSave, importSave, loadSave, MAX_INV, newChar, newSave, SAVE_KEY, writeSave, type CharSave, type SaveData } from './save';
import { member, simulate } from './sim';
import { CONS_BY_ID, upgradeChance, upgradeCost, UPGRADE_MAX } from '../data/shops';
import { MAP_BY_ID as MAPS_BY_ID } from '../data/maps';
import { addMods } from './formulas';
import { blacksmithStock, buyPrice, effMods, equippedList, repairCost, sellPrice, stockWindow } from './shop';
import { Town } from './town';
import { EVENTS, dayKey, weekendBonus, type Reward } from '../data/events';
import { MOB_BY_ID, MOBS, BOSSES, MINIBOSSES, WANDERERS } from '../data/mobs';
import { KIND_LABEL } from '../data/types';
import { showRewardedAd } from './ads';
import { ACTIVITY_MIN_LEVEL, CHEST_LEVEL, HINTS, LEVEL_REWARDS, MINIBOSS_QUEST, OFFLINE_TEASER_SECONDS, QUESTS, VISION, type Hint, type LevelReward, type Quest, type QuestReward } from '../data/onboarding';
import { RARITY_COLOR } from '../data/types';

const fmtN = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n)));
export const OFFLINE_CAP = 8 * 3600;
export const OFFLINE_EFFICIENCY = 0.85;

export interface OfflineSummary {
  secs: number; capped: boolean; xp: number; gold: number; kills: number; fromLevel: number; toLevel: number;
  items: Record<Rarity, number>; sold: number; deaths: number; best?: Item; sellGold: number; gift?: string; doubled?: boolean;
}

type Listener = () => void;

export class Game {
  save!: SaveData;
  battle!: Battle;
  derived!: Derived;
  version = 0;
  listeners = new Set<Listener>();
  summary: OfflineSummary | null = null;
  toasts: { id: number; text: string; col: string; t: number }[] = [];
  bag: Bag = { hp: 0, mp: 0, hpTh: 0.4, mpTh: 0.25, on: true };
  acc = 0; private saveT = 0; private seen = { xp: 0, gold: 0, kills: 0, elites: 0, bosses: 0, floors: 0, deaths: 0 };
  private mercCache = new Map<string, PartyMember>();
  scene: 'town' | 'field' = 'field';
  debugAi = false;
  private evT = 0; private invHandled = false;
  surprise = false;                       // diálogo da primeira visita à cidade
  vision: { b: Battle; t: number; cast: boolean; classId: string } | null = null;
  banner: { text: string; sub: string; t: number } | null = null;
  private hintGap = 0; private skillHintT = 0;
  setDebugAi(on: boolean) { this.debugAi = on; if (this.battle) this.battle.debug = on; this.emit(); }
  town = new Town();
  transition: { title: string; sub: string; phase: 'out' | 'hold' | 'in' } | null = null;
  private boostT = 0;
  private tid = 1;

  get has() { return !!this.save; }
  get char(): CharSave { return this.save.chars[this.save.active]; }
  get cls() { return CLASS_BY_ID[this.save.active]; }
  get level() { return this.char.level; }
  get maxLevelEver() { return Math.max(...Object.values(this.save.chars).map((c) => c.level), 1); }

  // ───────────── ciclo de vida ─────────────
  init() {
    const s = loadSave();
    if (s) {
      this.save = s; Battle.AI = s.settings.ai !== false;
      this.refreshDerived();
      this.startBattle();
      this.scene = s.inTown ? 'town' : 'field';
      audio.setEnabled(s.settings.sound); audio.setScene(s.inTown ? 'cidade' : s.mapId);
      const elapsed = (Date.now() - s.ts) / 1000;
      this.tickBoosts(Math.min(elapsed, OFFLINE_CAP)); this.ensureDaily(); this.checkAchievements();
      if (elapsed > 60 && !s.inTown) this.applyOffline(elapsed);
    }
    this.emit();
  }
  newGame(classId: string) {
    this.save = newSave(classId); this.scene = 'field'; audio.setEnabled(true); audio.setScene('esgoto');
    this.refreshDerived(); this.startBattle(); this.ensureDaily(); this.startVision(classId); this.persist(); this.emit();
  }
  subscribe = (l: Listener) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  getVersion = () => this.version;
  emit() { this.version++; this.listeners.forEach((l) => l()); }
  persist() { if (this.save) { this.save.potions.hp = this.bag.hp; this.save.potions.mp = this.bag.mp; writeSave(this.save); } }
  toast(text: string, col = '#fff') {
    this.toasts.push({ id: this.tid++, text, col, t: 3.5 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  // ───────────── derivados ─────────────
  gearMods(c = this.char): Mods[] { return [...equippedList(c.equipped).map(effMods), this.boostMods()]; }
  boostMods(): Mods {
    const m: Mods = {};
    for (const id in this.save.boosts) { const c = CONS_BY_ID[id]; if (c?.boost && this.save.boosts[id] > 0) addMods(m, c.boost.mods); }
    return m;
  }
  derivedFor(classId: string): Derived {
    const c = this.save.chars[classId] ?? newChar();
    return derive({ classId, level: c.level, alloc: c.alloc, talents: c.talents, gear: [...this.gearMods(c), this.metaMods()], rebirths: this.save.rebirths });
  }
  refreshDerived() {
    this.derived = this.derivedFor(this.save.active);
    this.bag.hp = this.save.potions.hp; this.bag.mp = this.save.potions.mp;
    this.bag.on = this.save.settings.autoPot; this.bag.hpTh = this.save.settings.hpTh; this.bag.mpTh = this.save.settings.mpTh;
    if (this.battle) {
      { const wb = weekendBonus(); this.battle.cfg.xpBonus = (this.derived.mods.xpPct ?? 0) + (wb?.xp ?? 0); this.battle.cfg.goldBonus = this.derived.mods.goldPct ?? 0; this.battle.cfg.dropBonus = (this.derived.mods.dropPct ?? 0) + (wb?.drop ?? 0); }
      this.battle.playerLevel = this.char.level;
      this.battle.applyDerived(this.battle.player, this.derived, this.char.skillAuto);
    }
  }
  freePoints() { return statPointsFor(this.char.level) - STATS.reduce((a, s) => a + this.char.alloc[s], 0); }
  talentPointsLeft() {
    return talentPointsFor(this.char.level) - Object.entries(this.char.talents).filter(([k]) => k.startsWith(this.save.active + ':')).reduce((a, [, v]) => a + v, 0);
  }

  // ───────────── batalha ─────────────
  private playerMember(hpFrac?: number, mpFrac?: number): PartyMember {
    return { name: this.cls.name, derived: this.derived, auto: this.char.skillAuto, isPlayer: true, hpFrac, mpFrac };
  }
  mercMembers(): PartyMember[] {
    const out: PartyMember[] = [];
    this.save.mercs.slice(0, 3).forEach((id) => {
      if (!id) return;
      const key = id + ':' + this.char.level + ':' + this.save.rebirths;
      let m = this.mercCache.get(key);
      if (!m) { m = member(id, this.char.level, false, [], this.save.rebirths); this.mercCache.set(key, m); if (this.mercCache.size > 30) this.mercCache.clear(); }
      out.push({ ...m, hpFrac: 1 });
    });
    return out;
  }
  startBattle(keepHp = false) {
    const old = this.battle?.player;
    const party = [this.playerMember(keepHp && old && !old.dead ? old.hp / old.maxHp : 1, keepHp && old ? old.mp / Math.max(1, old.maxMp) : 1)];
    if (this.save.activity === 'party') party.push(...this.mercMembers());
    this.battle = new Battle({
      rng: mulberry32((Date.now() ^ 0x9e3779b9) >>> 0), mapId: this.save.mapId, activity: this.save.activity, floor: this.save.activity === 'dungeon' ? this.save.floor : 1,
      playerLevel: this.char.level, party, fx: true, bag: this.bag,
      xpBonus: (this.derived.mods.xpPct ?? 0) + (weekendBonus()?.xp ?? 0), goldBonus: this.derived.mods.goldPct ?? 0, dropBonus: (this.derived.mods.dropPct ?? 0) + (weekendBonus()?.drop ?? 0),
      golden: this.scene === 'field' && this.char.level >= EVENTS.goldenMob.minLevel && this.save.activity !== 'chefe' ? EVENTS.goldenMob : undefined,
    });
    this.battle.debug = this.debugAi;
    { const w = this.save.meta.events.wanderer; if (w && w.spawned && w.mapId === this.save.mapId && Date.now() < w.until && this.scene === 'field') this.battle.miniQueue.push(w.id); }
    this.invHandled = false;
    { const q = this.quest; if (q?.id === MINIBOSS_QUEST && this.scene === 'field') this.battle.miniQueue.push('rato_albino'); }
    this.battle.layout = generateLayout(this.save.mapId, (Date.now() ^ 0x51ed) >>> 0);
    this.seen = { xp: 0, gold: 0, kills: 0, elites: 0, bosses: 0, floors: 0, deaths: 0 };
    this.syncBoostBuffs();
  }

  update(dtReal: number) {
    if (!this.save) return;
    if (this.vision) {
      const v = this.vision; v.t += dtReal; this.acc += Math.min(dtReal, 0.25);
      while (this.acc >= TICK) { v.b.step(TICK); this.acc -= TICK; }
      if (!v.cast && v.t > 2.2) { v.cast = true; const u = v.b.player.skills[v.b.player.skills.length - 1]; if (u) { v.b.player.mp = v.b.player.maxMp; v.b.castManual(u.id); } }
      if (v.t > VISION.seconds) this.endVision();
      return;
    }
    if (this.banner) { this.banner.t -= dtReal; if (this.banner.t <= 0) { this.banner = null; this.emit(); } }
    this.boostT += dtReal;
    if (this.boostT >= 1) { this.tickBoosts(this.boostT); this.boostT = 0; this.evT++; this.tickEvents(); if (this.evT % 30 === 0) this.ensureDaily(); }
    for (const t of this.toasts) t.t -= dtReal;
    if (this.toasts.length && this.toasts[0].t <= 0) this.toasts = this.toasts.filter((t) => t.t > 0);
    this.saveT += dtReal;
    if (this.saveT > 10) { this.saveT = 0; this.persist(); }
    if (this.scene === 'town') { this.town.chestState = this.save.onboard.chestOpen ? 'open' : this.char.level >= CHEST_LEVEL ? 'ready' : 'locked'; this.town.sage = this.save.onboard.firstTown; this.town.update(Math.min(dtReal, 0.1)); return; }
    if (dtReal > 15) { this.tickBoosts(dtReal); this.applyOffline(dtReal); return; }
    this.acc += Math.min(dtReal, 0.25);
    let n = 0;
    while (this.acc >= TICK && n < 8) { this.battle.step(TICK); this.afterStep(); this.acc -= TICK; n++; }
    if (this.acc > TICK * 8) this.acc = 0;
  }

  private afterStep() {
    const b = this.battle, a = b.acc, s = this.seen, sv = this.save;
    if (a.xp !== s.xp || a.gold !== s.gold) {
      sv.gold += Math.round(a.gold - s.gold); sv.meta.extra.goldEarned += Math.max(0, a.gold - s.gold); const dx = a.xp - s.xp; s.xp = a.xp; s.gold = a.gold;
      this.gainXp(dx);
    }
    if (a.kills !== s.kills) { sv.stats.kills += a.kills - s.kills; s.kills = a.kills; }
    if (a.bosses !== s.bosses) { sv.stats.bosses += a.bosses - s.bosses; s.bosses = a.bosses; const gm = 1 + Math.floor(Math.random() * 2); sv.gems += gm; this.toast(`Chefe derrotado! +${gm} gema${gm > 1 ? 's' : ''}`, '#ffcf6a'); }
    if (a.deaths !== s.deaths) { sv.stats.deaths += a.deaths - s.deaths; this.wearGear(a.deaths - s.deaths); s.deaths = a.deaths; }
    if (b.loot.length) {
      for (const l of b.loot) {
        const it = rollItem(b.rng, l.ilvl, l.tier, undefined, this.derived.mods.dropPct ?? 0); this.receiveItem(it, true);
        if (it.rarity !== 'comum') { // drop brilhando por raridade, com som
          b.addFx('pillar', l.x, l.y, 0, 0, 1.1, RARITY_COLOR[it.rarity], it.rarity === 'lendario' ? 2 : 1.3); b.addFx('spark', l.x, l.y, 0, 0, 0.8, RARITY_COLOR[it.rarity], 1.4);
          b.float(l.x, l.y - 0.4, it.name, RARITY_COLOR[it.rarity], it.rarity !== 'raro'); b.sfx.push('drop_' + it.rarity);
        }
      }
      b.loot.length = 0;
    }
    if (b.killLog.length) { for (const id of b.killLog) this.onKillId(id); b.killLog.length = 0; }
    if (b.sfx.length) { for (const f of b.sfx) audio.sfx(f); b.sfx.length = 0; }
    if (b.invasion?.done && !this.invHandled) { this.invHandled = true; this.finishInvasion(b.invasion.failed); }
    this.checkHints();
    if (sv.activity === 'dungeon' && sv.floor !== b.floor) {
      sv.floor = b.floor; sv.bestFloor[sv.mapId] = Math.max(sv.bestFloor[sv.mapId] ?? 1, b.floor);
    }
    this.bag.hp = Math.max(0, this.bag.hp);
  }

  // ───────────── cena: cidade / campo ─────────────
  private runTransition(title: string, sub: string, fn: () => void) {
    if (this.transition) return;
    this.transition = { title, sub, phase: 'out' }; this.emit();
    setTimeout(() => { try { fn(); } catch (e) { console.error(e); } this.transition = { title, sub, phase: 'hold' }; this.emit(); }, 330);
    setTimeout(() => { if (this.transition) { this.transition.phase = 'in'; this.emit(); } }, 1000);
    setTimeout(() => { this.transition = null; this.emit(); }, 1400);
  }
  goTown() {
    if (this.scene === 'town') return;
    this.runTransition('Vila Pedrafria', 'Cidade segura — sem combate e sem ganho de XP', () => {
      this.persist(); this.scene = 'town'; this.save.inTown = true; this.town.player.x = this.town.player.px = 10; this.town.player.y = this.town.player.py = 21.5; this.town.player.path = []; this.town.pending = null;
      audio.setScene('cidade'); this.persist(); this.onFirstTown();
    });
  }
  goField() {
    if (this.scene === 'field') return;
    const m = MAPS_BY_ID[this.save.mapId];
    this.runTransition(m.name, `Nível recomendado ${m.minLv}–${m.maxLv}`, () => {
      this.scene = 'field'; this.save.inTown = false; this.startBattle(); audio.setScene(this.save.mapId); this.persist();
    });
  }
  /** Viaja para um mapa (grátis, da cidade ou do campo). */
  travel(id: string): boolean {
    const m = MAPS_BY_ID[id]; if (!m) return false;
    if (!this.mapUnlocked(id)) { this.toast(`${m.name} abre no nível ${m.minLv} (você: ${this.maxLevelEver})`, '#ff9090'); return false; }
    if (this.scene === 'field' && id === this.save.mapId) { this.toast('Você já está neste mapa', '#9ad0ff'); return false; }
    if (this.transition) return false;
    this.save.mapId = id; this.save.floor = 1;
    this.runTransition(m.name, `Nível recomendado ${m.minLv}–${m.maxLv}`, () => {
      this.scene = 'field'; this.save.inTown = false; this.startBattle(); audio.setScene(id); this.persist();
    });
    return true;
  }

  // ───────────── consumíveis / boosts ─────────────
  tickBoosts(dt: number) {
    let ch = false;
    for (const id of Object.keys(this.save.boosts)) {
      this.save.boosts[id] -= dt;
      if (this.save.boosts[id] <= 0) { delete this.save.boosts[id]; ch = true; }
    }
    if (ch) this.refreshDerived();
    this.syncBoostBuffs();
  }
  private syncBoostBuffs() {
    const p = this.battle?.player; if (!p) return;
    p.buffs = p.buffs.filter((b) => !b.id.startsWith('boost:'));
    for (const id in this.save.boosts) { const c = CONS_BY_ID[id]; if (c?.boost) p.buffs.push({ id: 'boost:' + id, name: c.name, icon: c.icon, col: c.col, t: this.save.boosts[id], dur: c.boost.dur, mods: {} }); }
  }
  buyCons(id: string, n = 1): boolean {
    const c = CONS_BY_ID[id]; if (!c) return false;
    const gold = c.price(this.char.level) * n, gems = (c.gems ?? 0) * n;
    if (this.save.gold < gold || this.save.gems < gems) return false;
    this.save.gold -= gold; this.save.gems -= gems; this.save.cons[id] = (this.save.cons[id] ?? 0) + n; this.emit(); return true;
  }
  useCons(id: string): boolean {
    const c = CONS_BY_ID[id]; if (!c || (this.save.cons[id] ?? 0) < 1 || c.kind !== 'boost' || !c.boost) return false;
    this.save.cons[id]--; this.save.boosts[id] = c.boost.dur;
    this.refreshDerived(); this.syncBoostBuffs(); this.toast(`${c.name} ativado`, c.col); this.emit(); return true;
  }

  // ───────────── ferreiro / durabilidade ─────────────
  wearGear(n: number) {
    let any = false;
    for (const it of equippedList(this.char.equipped)) { it.dur = Math.max(0, (it.dur ?? 100) - 8 * n); any = true; }
    if (any) { this.refreshDerived(); this.toast('Equipamento danificado — repare no Ferreiro', '#ffb060'); }
  }
  shopStock() {
    const win = stockWindow();
    if (this.save.shop.win !== win) { this.save.shop = { win, bought: [] }; }
    return blacksmithStock(this.char.level, win).map((it) => ({ it, sold: this.save.shop.bought.includes(it.id) }));
  }
  buyShopItem(id: string): Item | null {
    const e = this.shopStock().find((x) => x.it.id === id); if (!e || e.sold) return null;
    const price = buyPrice(e.it);
    if (this.save.gold < price || this.save.inventory.length >= MAX_INV) return null;
    this.save.gold -= price; this.save.shop.bought.push(id);
    const it = { ...e.it, mods: { ...e.it.mods }, id: e.it.id + '-' + Date.now().toString(36) };
    this.save.inventory.push(it); this.persist(); this.emit(); return it;
  }
  findItem(id: string): { it: Item; eq: boolean } | null {
    const a = this.save.inventory.find((x) => x.id === id); if (a) return { it: a, eq: false };
    const b = equippedList(this.char.equipped).find((x) => x.id === id); return b ? { it: b, eq: true } : null;
  }
  upgradeItem(id: string): 'ok' | 'fail' | 'down' | 'gold' | 'max' | null {
    const f = this.findItem(id); if (!f) return null;
    const it = f.it; const next = (it.plus ?? 0) + 1;
    if (next > UPGRADE_MAX) return 'max';
    const cost = upgradeCost(it.ilvl, next);
    if (this.save.gold < cost) return 'gold';
    this.save.gold -= cost;
    let res: 'ok' | 'fail' | 'down' = 'ok';
    if (Math.random() < upgradeChance(next)) it.plus = next;
    else if (next >= 8) { it.plus = Math.max(0, next - 2); res = 'down'; } else res = 'fail';
    if (f.eq) this.refreshDerived();
    this.persist(); this.emit(); return res;
  }
  repairAll(): number {
    const items = equippedList(this.char.equipped); const cost = items.reduce((a, i) => a + repairCost(i), 0);
    if (cost <= 0 || this.save.gold < cost) return -1;
    this.save.gold -= cost; items.forEach((i) => { i.dur = 100; }); this.refreshDerived(); this.emit(); return cost;
  }
  classSwitchCost() { return 100 + this.char.level * 25; }
  guildSwitch(id: string): boolean {
    if (id === this.save.active) return false;
    const c = this.classSwitchCost(); if (this.save.gold < c) return false;
    this.save.gold -= c; this.switchClass(id); return true;
  }



  // ───────────── metas: diárias, eventos, conquistas, bestiário, avisos ─────────────
  get meta() { return this.save.meta; }
  notify(text: string, toast = true) {
    const m = this.meta; m.notes.unshift({ id: Date.now() + Math.floor(Math.random() * 1000), t: Date.now(), text, read: false }); if (m.notes.length > 30) m.notes.length = 30;
    if (toast) this.toast(text, '#ffd24a');
  }
  unreadNotes() { return this.meta.notes.filter((n) => !n.read).length; }
  markNotesRead() { this.meta.notes.forEach((n) => { n.read = true; }); this.emit(); }

  /** Concede uma recompensa descrita em JSON (goldLv = ouro por nível). */
  grantR(r: Reward, label: string) {
    const sv = this.save, lv = Math.max(1, this.char.level); const parts: string[] = [];
    const gold = r.gold ?? (r.goldLv ? Math.round(r.goldLv * lv + 20) : 0);
    if (gold) { sv.gold += gold; sv.meta.extra.goldEarned += gold; parts.push(`+${fmtN(gold)} ouro`); }
    if (r.gems) { sv.gems += r.gems; parts.push(`+${r.gems} 💎`); }
    if (r.hp) { this.bag.hp += r.hp; sv.potions.hp = this.bag.hp; parts.push(`+${r.hp} poção HP`); }
    if (r.mp) { this.bag.mp += r.mp; sv.potions.mp = this.bag.mp; parts.push(`+${r.mp} poção MP`); }
    if (r.cons) for (const id in r.cons) { sv.cons[id] = (sv.cons[id] ?? 0) + r.cons[id]; parts.push(`+${r.cons[id]} ${CONS_BY_ID[id]?.name ?? id}`); }
    if (r.item) {
      let it = rollItem(Math.random, lv, r.item === 'tier2' ? 2 : 1, undefined, 0.5);
      if (r.item === 'tier2') for (let i = 0; i < 60 && (it.rarity === 'comum' || it.rarity === 'raro'); i++) it = rollItem(Math.random, lv, 2, undefined, 1);
      this.receiveItem(it, false); if (!Object.values(this.char.equipped).includes(it) && !sv.inventory.includes(it) && sv.inventory.length < MAX_INV) sv.inventory.push(it);
      parts.push(it.name);
    }
    this.toast(`${label}: ${parts.join(', ')}`, '#ffe9b0'); audio.sfx('quest'); this.refreshDerived(); this.emit();
  }

  // ── diárias + sequência de login ──
  ensureDaily() {
    const d = this.meta.daily; const today = dayKey();
    if (d.day === today) return;
    const y = new Date(); y.setDate(y.getDate() - 1);
    d.streak = d.loginDay === dayKey(y) ? (d.streak % 7) + 1 : 1; // sequência: 1..7 e recomeça
    d.loginDay = today; d.loginClaimed = false; d.day = today; d.chestClaimed = false;
    // 4 missões sorteadas pela data (iguais para todo mundo no mesmo dia)
    const rnd = mulberry32(today.split('-').reduce((a, x) => a * 31 + +x, 7));
    const pool = EVENTS.daily.pool.slice(); const kinds = Object.keys(KIND_LABEL);
    d.missions = [];
    for (let i = 0; i < EVENTS.daily.missionCount && pool.length; i++) {
      const def = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      const kind = def.type === 'killKind' ? kinds[Math.floor(rnd() * kinds.length)] : undefined;
      d.missions.push({ id: def.id, title: def.title.replace('{n}', String(def.n)).replace('{kind}', kind ? KIND_LABEL[kind as keyof typeof KIND_LABEL] : ''), type: def.type, n: def.n, progress: 0, kind, claimed: false, reward: def.reward });
    }
    this.notify('Novas missões diárias e prêmio de login disponíveis!');
  }
  dailyProgress(type: string, n = 1, kind?: string) {
    const d = this.save?.meta.daily; if (!d) return;
    for (const m of d.missions) if (m.type === type && !m.claimed && m.progress < m.n && (type !== 'killKind' || m.kind === kind)) m.progress = Math.min(m.n, m.progress + n);
  }
  claimMission(i: number) {
    const m = this.meta.daily.missions[i]; if (!m || m.claimed || m.progress < m.n) return;
    m.claimed = true; this.meta.extra.dailyDone++; this.grantR(m.reward, 'Missão diária'); this.checkAchievements();
  }
  dailyChestReady() { const d = this.meta.daily; return !d.chestClaimed && d.missions.length > 0 && d.missions.every((m) => m.claimed); }
  claimDailyChest() { if (!this.dailyChestReady()) return; this.meta.daily.chestClaimed = true; this.grantR(EVENTS.daily.chest, 'Baú diário'); }
  claimLogin() {
    const d = this.meta.daily; if (d.loginClaimed) return;
    d.loginClaimed = true; const r = EVENTS.daily.login[(d.streak - 1) % 7]; this.grantR(r.reward, `Login dia ${d.streak}`);
  }

  // ── baú do cristal (timer) ──
  timerChest() {
    const t = EVENTS.timerChest, r = this.meta.timerChest.readyAt, now = Date.now();
    const count = now < r ? 0 : Math.min(t.maxStack, 1 + Math.floor((now - r) / (t.intervalMin * 60e3)));
    return { count, readyIn: Math.max(0, r - now) };
  }
  claimTimerChest() {
    const tc = this.timerChest(); if (!tc.count) return;
    const t = EVENTS.timerChest;
    for (let i = 0; i < tc.count; i++) this.grantR({ ...t.reward, item: Math.random() < (t.reward.itemChance ?? 0) ? 'tier1' : undefined }, 'Baú do cristal');
    this.meta.timerChest.readyAt = Date.now() + t.intervalMin * 60e3;
  }

  // ── eventos dinâmicos ──
  private rand(a: number, b: number) { return a + Math.random() * (b - a); }
  private tickEvents() {
    if (this.scene !== 'field' || this.vision || !this.battle) return;
    const now = Date.now(), ev = this.meta.events, b = this.battle, lv = this.char.level;
    const bossAlive = b.actors.some((a) => a.mob?.boss && !a.dead);
    const inv = EVENTS.invasion;
    if (now >= ev.nextInvasion) {
      if (lv >= inv.minLevel && !b.invasion && !bossAlive && ['solo', 'horda', 'party'].includes(this.save.activity)) {
        b.startInvasion(inv.total, inv.timeLimit); this.invHandled = false; this.notify('Invasão de monstros! Derrote todos antes que o tempo acabe.', false);
        ev.nextInvasion = now + this.rand(inv.intervalMin, inv.intervalMax) * 1000;
      } else ev.nextInvasion = now + 30e3;
    }
    const wb = EVENTS.wanderingBoss;
    if (now >= ev.nextWanderer && !ev.wanderer) {
      if (lv >= wb.minLevel) {
        const maps = this.mapsUnlockedList(); const m = maps[Math.floor(Math.random() * maps.length)]; const def = wb.byMap[m.id];
        if (def) { ev.wanderer = { mapId: m.id, id: def.id, until: now + wb.durationSec * 1000, spawned: false }; this.notify(`⚠ ${def.text} (${Math.round(wb.durationSec / 60)} min)`); audio.sfx('boss'); this.showBanner('Chefe errante!', def.text); }
      }
      ev.nextWanderer = now + this.rand(wb.intervalMin, wb.intervalMax) * 1000;
    }
    const w = ev.wanderer;
    if (w) {
      if (now > w.until && !w.spawned) { ev.wanderer = null; this.notify('O chefe errante foi embora…', false); }
      else if (!w.spawned && w.mapId === this.save.mapId && !bossAlive && !b.invasion) { w.spawned = true; b.miniQueue.push(w.id); }
      else if (w.spawned && now > w.until + 600e3) ev.wanderer = null;
    }
  }
  private finishWanderer() {
    const ev = this.meta.events; if (!ev.wanderer) return;
    ev.wanderer = null; this.meta.extra.wanderers++;
    this.grantR(EVENTS.wanderingBoss.reward, 'Chefe errante derrotado'); this.showBanner('Chefe errante derrotado!', 'Recompensa especial concedida'); this.checkAchievements();
  }
  private finishInvasion(failed: boolean) {
    const r = EVENTS.invasion.reward, b = this.battle;
    if (failed) { this.grantR({ goldLv: (r.goldLv ?? 0) * 0.25 }, 'Invasão (parcial)'); this.showBanner('A invasão recuou…', 'Tempo esgotado — recompensa parcial'); }
    else {
      this.meta.extra.invasions++; this.dailyProgress('invasion');
      const xp = (xpToNext(this.char.level) / (40 + this.char.level * 1.2)) * (r.xpMult ?? 0) * 3;
      this.grantR({ ...r }, 'Invasão repelida'); this.gainXp(xp); this.showBanner('Invasão repelida!', 'Recompensa recebida'); this.checkAchievements();
    }
    setTimeout(() => { if (b === this.battle) b.invasion = null; }, 1500);
  }
  invasionState() { const i = this.battle?.invasion; return i && !i.done ? i : null; }

  // ── conquistas e bestiário ──
  statValue(stat: string): number {
    const sv = this.save, x = sv.meta.extra;
    switch (stat) {
      case 'kills': return sv.stats.kills; case 'level': return this.maxLevelEver; case 'bosses': return sv.stats.bosses;
      case 'goldEarned': return x.goldEarned; case 'items': return sv.stats.items; case 'golden': return x.golden; case 'invasions': return x.invasions;
      case 'wanderers': return x.wanderers; case 'dailyDone': return x.dailyDone; case 'deaths': return sv.stats.deaths; case 'bestiary': return this.bestiaryCompleted();
      default: return 0;
    }
  }
  checkAchievements() {
    const m = this.meta; let any = false;
    for (const a of EVENTS.achievements) if (!m.ach.includes(a.id) && this.statValue(a.stat) >= a.n) {
      m.ach.push(a.id); any = true; if (!m.title) m.title = a.title;
      this.notify(`🏆 Conquista: ${a.title} — ${a.desc}`); audio.sfx('quest'); this.showBanner('Conquista desbloqueada!', a.title);
    }
    if (any) { this.refreshDerived(); this.emit(); }
  }
  bestiaryList() { return [...MOBS, ...BOSSES, ...MINIBOSSES, ...WANDERERS]; }
  bestiaryDone(id: string) { const d = MOB_BY_ID[id]; if (!d) return false; return (this.meta.bestiary[id] ?? 0) >= (d.boss ? EVENTS.bestiary.completeKillsBoss : EVENTS.bestiary.completeKills); }
  bestiaryCompleted() { return this.bestiaryList().filter((d) => this.bestiaryDone(d.id)).length; }
  metaMods(): Mods {
    const m: Mods = {}; if (!this.save?.meta) return m;
    for (const a of EVENTS.achievements) if (this.save.meta.ach.includes(a.id)) addMods(m, a.mods);
    for (const d of this.bestiaryList()) if (this.bestiaryDone(d.id)) addMods(m, { vs: { [d.kind]: d.boss ? EVENTS.bestiary.bonusPerBoss : EVENTS.bestiary.bonusPerEntry } });
    return m;
  }

  // ── indicadores de novidade, ação recomendada e próximo objetivo ──
  private itemScoreEff = (it: Item) => itemScore({ ...it, mods: effMods(it) });
  hasBetterItem(): boolean {
    for (const it of this.save.inventory) { const cur = this.char.equipped[it.slot]; if (!cur || this.itemScoreEff(it) > this.itemScoreEff(cur) * 1.0001) return true; }
    return false;
  }
  badges() {
    const sv = this.save, lv = this.char.level, m = sv.meta, d = m.daily;
    const newSkill = this.cls.skills.some((s) => s.lv > m.seen.skills && s.lv <= lv) || (this.cls.maneuver.lv > m.seen.skills && this.cls.maneuver.lv <= lv);
    const newMap = MAPS.some((mp) => mp.minLv > m.seen.maps && mp.minLv <= this.maxLevelEver) || Object.values(ACTIVITY_MIN_LEVEL).some((l) => l > m.seen.maps && l <= this.maxLevelEver);
    return {
      char: (!this.char.auto && this.freePoints() > 0) || this.talentPointsLeft() > 0,
      skills: newSkill, inv: this.hasBetterItem(), maps: newMap,
      town: this.townReady(),
      metas: this.metasReady(),
    };
  }
  townReady() { const ob = this.save.onboard; return (this.level >= CHEST_LEVEL && !ob.chestOpen) || this.surprise || this.quest?.goal.type === 'town'; }
  metasReady() {
    const d = this.meta.daily;
    return d.missions.some((x) => !x.claimed && x.progress >= x.n) || !d.loginClaimed || this.dailyChestReady() || this.timerChest().count > 0 || this.unreadNotes() > 0;
  }
  markSeen(what: 'skills' | 'maps') { const s = this.meta.seen; if (what === 'skills') s.skills = this.char.level; else s.maps = this.maxLevelEver; this.emit(); }
  /** No máximo UMA ação recomendada por vez. */
  recommended(): 'inv' | 'char' | 'metas' | 'town' | 'maps' | null {
    const b = this.badges();
    if (b.inv) return 'inv'; if (b.char) return 'char'; if (b.metas) return 'metas'; if (b.town) return 'town'; if (b.maps) return 'maps';
    return null;
  }
  nextGoal(): string {
    const lv = this.char.level, q = this.quest;
    if (q) { const pr = this.questProgress(); return `🎯 ${q.title}${pr.of > 1 ? ` (${pr.n}/${pr.of})` : ''}`; }
    if (this.timerChest().count > 0) return '🎁 O baú do cristal está pronto! Abra em Metas.';
    const opts: { lv: number; text: string }[] = [];
    for (const m of MAPS) if (m.minLv > this.maxLevelEver) opts.push({ lv: m.minLv, text: `liberar ${m.name}` });
    for (const s of this.cls.skills) if (s.lv > lv) opts.push({ lv: s.lv, text: `nova habilidade: ${s.name}` });
    if (this.cls.maneuver.lv > lv) opts.push({ lv: this.cls.maneuver.lv, text: `manobra ${this.cls.maneuver.name}` });
    if (lv < 100) opts.push({ lv: 100, text: 'liberar o Renascimento' });
    opts.sort((a, b) => a.lv - b.lv);
    const n = opts.find((o) => o.lv > lv);
    if (n) return `🎯 Chegue ao nível ${n.lv} para ${n.text}`;
    return '🎯 Continue evoluindo e renasça!';
  }
  weekendLabel() { return weekendBonus()?.label ?? null; }
  /** Dobra os ganhos do resumo offline (ponto de integração de anúncio recompensado). */
  async doubleOffline(): Promise<boolean> {
    const s = this.summary; if (!s || s.doubled) return false;
    const ok = await showRewardedAd('offline_double'); if (!ok) return false;
    s.doubled = true; this.save.gold += Math.round(s.gold); this.gainXp(s.xp); s.xp *= 2; s.gold *= 2; this.toast('Ganhos offline dobrados!', '#ffe9b0'); audio.sfx('quest'); this.persist(); this.emit(); return true;
  }

  // ───────────── onboarding: recompensas, missões, dicas ─────────────
  private grantItemKind(kind: string): Item | null {
    const lv = Math.max(3, this.char.level);
    const slotOf: Record<string, Slot> = { raro_elmo: 'elmo', raro_bota: 'bota', raro_anel: 'anel', raro_armadura: 'armadura' };
    if (kind === 'espada_iniciante') return { id: 'starter-' + Date.now().toString(36), name: 'Espada do Iniciante', slot: 'arma', rarity: 'raro', ilvl: lv, mods: { wAtk: Math.round(8 + lv * 2.2), atkPct: 0.05, crit: 0.02 } };
    const slot = slotOf[kind]; if (!slot) return null;
    for (let i = 0; i < 40; i++) { const it = rollItem(Math.random, lv, 1, slot, 0.5); if (it.rarity !== 'comum') return it; }
    return rollItem(Math.random, lv, 2, slot);
  }
  private grant(r: { gold?: number; gems?: number; hp?: number; mp?: number; item?: string }, label: string) {
    const sv = this.save; const parts: string[] = [];
    if (r.gold) { sv.gold += r.gold; parts.push(`+${r.gold} ouro`); }
    if (r.gems) { sv.gems += r.gems; parts.push(`+${r.gems} 💎`); }
    if (r.hp) { this.bag.hp += r.hp; sv.potions.hp = this.bag.hp; parts.push(`+${r.hp} poção HP`); }
    if (r.mp) { this.bag.mp += r.mp; sv.potions.mp = this.bag.mp; parts.push(`+${r.mp} poção MP`); }
    if (r.item === 'cons_atk') { sv.cons.buff_atk = (sv.cons.buff_atk ?? 0) + 3; parts.push('+3 Elixires de Força'); }
    else if (r.item) { const it = this.grantItemKind(r.item); if (it) { this.receiveItem(it, false); parts.push(it.name); this.battle?.addFx('pillar', this.battle.player.x, this.battle.player.y, 0, 0, 1.2, RARITY_COLOR[it.rarity], 1.6); } }
    if (parts.length) this.toast(`${label}: ${parts.join(', ')}`, '#ffe9b0');
    this.refreshDerived();
  }
  private grantLevelReward(lv: number, r: LevelReward) {
    this.grant(r, `Nível ${lv}`); this.toast(r.text, '#9ad0ff');
  }

  get quest(): Quest | null { const q = QUESTS[this.save.onboard.quest]; return q ?? null; }
  questProgress(): { n: number; of: number } {
    const q = this.quest; if (!q) return { n: 0, of: 0 };
    const p = this.save.onboard.progress, g = q.goal;
    if (g.type === 'kill' || g.type === 'killMob') return { n: Math.min(p, g.n), of: g.n };
    if (g.type === 'level') return { n: Math.min(this.char.level, g.n), of: g.n };
    return { n: 0, of: 1 };
  }
  private startQuest() {
    const q = this.quest; if (!q) return;
    this.save.onboard.progress = 0;
    if (q.id === MINIBOSS_QUEST && this.battle && this.scene === 'field') this.battle.miniQueue.push('rato_albino');
    this.checkQuestLevel();
    if (q.goal.type === 'town' && this.scene === 'town') this.completeQuest();
  }
  private completeQuest() {
    const q = this.quest; if (!q) return;
    this.grant(q.reward, 'Missão'); this.toast(`✔ ${q.title}`, '#6ae08a'); audio.sfx('quest');
    this.showBanner('Missão concluída!', q.reward.text);
    this.save.onboard.quest++; this.startQuest(); this.emit();
  }
  private checkQuestLevel() { const q = this.quest; if (q?.goal.type === 'level' && this.char.level >= q.goal.n) this.completeQuest(); }
  private onKillId(id: string) {
    const meta = this.save.meta;
    if (id === '__golden__') {
      meta.extra.golden++; this.dailyProgress('golden');
      if (Math.random() < EVENTS.goldenMob.gemChance) { this.save.gems++; this.toast('+1 💎 do mob dourado!', '#ffd040'); }
      this.toast('Mob dourado capturado!', '#ffd040'); this.checkAchievements(); return;
    }
    const def = MOB_BY_ID[id];
    // bestiário
    const had = this.bestiaryDone(id);
    meta.bestiary[id] = (meta.bestiary[id] ?? 0) + 1;
    if (meta.bestiary[id] === 1 && def) this.toast(`Bestiário: ${def.name} registrado`, '#9ad0ff');
    if (!had && this.bestiaryDone(id) && def) { this.toast(`Bestiário completo: ${def.name}! +${Math.round((def.boss ? EVENTS.bestiary.bonusPerBoss : EVENTS.bestiary.bonusPerEntry) * 100)}% de dano vs ${KIND_LABEL[def.kind]}`, '#6ae08a'); audio.sfx('quest'); this.refreshDerived(); }
    // diárias
    this.dailyProgress('kill');
    if (def) { this.dailyProgress('killKind', 1, def.kind); if (def.boss) this.dailyProgress('boss'); }
    // chefe errante
    const w = meta.events.wanderer;
    if (w && w.id === id && w.spawned) this.finishWanderer();
    this.checkAchievements();
    // missões do início
    const q = this.quest; if (!q) return; const g = q.goal;
    if (g.type === 'kill' || (g.type === 'killMob' && g.mob === id)) { this.save.onboard.progress++; if (this.save.onboard.progress >= g.n) this.completeQuest(); }
    else if (g.type === 'miniboss' && g.mob === id) this.completeQuest();
  }
  openChest(): boolean {
    const ob = this.save.onboard;
    if (ob.chestOpen || this.char.level < CHEST_LEVEL) return false;
    ob.chestOpen = true;
    const lv = Math.max(10, this.char.level);
    let it = rollItem(Math.random, lv, 2, undefined, 0.5);
    for (let i = 0; i < 60 && (it.rarity === 'comum' || it.rarity === 'raro'); i++) it = rollItem(Math.random, lv, 2, undefined, 1);
    this.save.gems += 3; this.save.gold += 400; this.receiveItem(it, false);
    if (this.save.inventory.length < 80 && !this.save.inventory.includes(it) && !Object.values(this.char.equipped).includes(it)) this.save.inventory.push(it);
    this.toast(`Baú aberto: ${it.name} (${it.rarity})!`, RARITY_COLOR[it.rarity]); audio.sfx('drop_epico');
    const q = this.quest; if (q?.goal.type === 'chest') this.completeQuest();
    this.persist(); this.emit(); return true;
  }
  /** Primeira ida à cidade: missão + surpresa (NPC novo) + teaser do progresso offline. */
  private onFirstTown() {
    const ob = this.save.onboard;
    const q = this.quest; if (q?.goal.type === 'town') this.completeQuest();
    if (!ob.firstTown && this.level >= 2) { ob.firstTown = true; this.surprise = true; if (ob.offlineGift === 'none') ob.offlineGift = 'pending'; this.save.cons.buff_drop = (this.save.cons.buff_drop ?? 0) + 1; this.emit(); }
  }
  showHint(id: string, force = false) {
    const ob = this.save.onboard; const h = HINTS[id]; if (!h) return;
    if (!force && (ob.hints.includes(id) || this.hint_ || Date.now() < this.hintGap)) return;
    ob.hints.push(id); this.hint_ = { h, until: Date.now() + (h.secs ?? 6) * 1000 }; this.emit();
  }
  /** estado da dica atual (getter para a UI) */
  private hint_: { h: Hint; until: number } | null = null;
  get activeHint() { if (this.hint_ && Date.now() > this.hint_.until) { this.hint_ = null; this.hintGap = Date.now() + 5000; } return this.hint_; }
  dismissHint() { this.hint_ = null; this.hintGap = Date.now() + 5000; this.emit(); }
  private checkHints() {
    if (this.scene !== 'field' || this.vision) return;
    const ob = this.save.onboard; const b = this.battle; const p = b.player;
    if (ob.hints.length >= 9) return;
    if (!ob.hints.includes('start')) { this.showHint('start'); return; }
    if (b.t < 6) return;
    if (!ob.hints.includes('skill') && p.skills.length && b.enemies.length && p.mp >= 8) { this.showHint('skill'); return; }
    if (!ob.hints.includes('item') && this.save.stats.items >= 1) this.showHint('item');
    else if (!ob.hints.includes('potion') && p.hp < p.maxHp * 0.5 && this.bag.hp > 0) this.showHint('potion');
    else if (!ob.hints.includes('boss') && b.actors.some((a) => a.mob?.boss && !a.dead)) this.showHint('boss');
    else if (!ob.hints.includes('death') && this.save.stats.deaths >= 1) this.showHint('death');
    else if (!ob.hints.includes('levelup') && this.level >= 2) this.showHint('levelup');
    else if (!ob.hints.includes('town') && this.level >= 3) this.showHint('town');
    else if (!ob.hints.includes('maps') && this.level >= 9) this.showHint('maps');
  }

  // ───────────── visão do poder final ─────────────
  startVision(classId: string) {
    const rng = mulberry32(777);
    const b = new Battle({ rng, mapId: VISION.mapId, activity: 'horda', floor: 1, playerLevel: VISION.level, party: [member(classId, VISION.level, true)], fx: true, xpBonus: 0, goldBonus: 0, dropBonus: 0 });
    b.player.hp = b.player.maxHp;
    this.vision = { b, t: 0, cast: false, classId };
    this.acc = 0; audio.setScene('castelo');
  }
  endVision() {
    this.vision = null; this.acc = 0; audio.setScene(this.save.mapId); this.startBattle(); this.persist(); this.emit();
  }
  activityUnlocked(a: Activity) { return this.maxLevelEver >= ACTIVITY_MIN_LEVEL[a]; }

  // ───────────── XP / nível ─────────────
  gainXp(x: number): number {
    const c = this.char; let lv = 0;
    if (c.level >= MAX_LEVEL) return 0;
    c.xp += x;
    while (c.level < MAX_LEVEL && c.xp >= xpToNext(c.level)) { c.xp -= xpToNext(c.level); c.level++; lv++; this.onLevelUp(c); }
    if (c.level >= MAX_LEVEL) c.xp = 0;
    if (lv > 0) {
      this.refreshDerived(); this.emit(); this.afterLevel();
      if (this.battle) { this.battle.float(this.battle.player.x, this.battle.player.y - 0.8, `NÍVEL ${c.level}!`, '#ffe040', true); this.battle.addFx('pillar', this.battle.player.x, this.battle.player.y, 0, 0, 0.9, '#ffe040', 2); }
      this.toast(`Nível ${c.level}!`, '#ffe040');
    }
    return lv;
  }
  private onLevelUp(c: CharSave) {
    if (c.auto) c.alloc = autoAlloc(this.cls, 3, c.alloc);
    this.dailyProgress('levelup');
    const r = LEVEL_REWARDS[c.level];
    if (r && !this.save.onboard.levelRewards.includes(c.level)) { this.save.onboard.levelRewards.push(c.level); this.grantLevelReward(c.level, r); }
    const sk = this.cls.skills.find((x) => x.lv === c.level);
    if (sk) { this.toast(`Nova habilidade: ${sk.name}!`, sk.col); this.showBanner('Nova habilidade!', sk.name); }
  }
  private afterLevel() {
    if (this.battle) { this.battle.flash = 0.55; this.battle.sfx.push('levelup'); for (let i = 0; i < 3; i++) this.battle.addFx('spark', this.battle.player.x, this.battle.player.y, i, 0, 0.9 + i * 0.2, ['#ffe040', '#fff', '#ffb040'][i], 1.8 + i * 0.5); }
    this.checkQuestLevel();
  }
  showBanner(text: string, sub = '') { this.banner = { text, sub, t: 3.2 }; this.emit(); }
  xpNeed() { return xpToNext(this.char.level); }

  // ───────────── itens ─────────────
  receiveItem(it: Item, live: boolean, sum?: OfflineSummary) {
    const sv = this.save; sv.stats.items++; this.dailyProgress('items');
    const rIdx = RARITIES.indexOf(it.rarity);
    const sellIdx = sv.settings.autoSell === 'none' ? -1 : RARITIES.indexOf(sv.settings.autoSell);
    const eq = this.char.equipped[it.slot];
    if (!eq) { this.char.equipped[it.slot] = it; this.refreshDerivedSoon(); if (live) this.toast(`Equipou ${it.name}`, '#9f9'); sum && (sum.items[it.rarity]++); return; }
    if (rIdx <= sellIdx && itemScore(it) <= itemScore(eq) * 1.2) { const g = sellValue(it); sv.gold += g; if (sum) sum.sellGold += g; sum && (sum.items[it.rarity]++); return; }
    sum && (sum.items[it.rarity]++);
    if (sv.inventory.length >= MAX_INV) {
      let wi = 0;
      sv.inventory.forEach((x, i) => { if (itemScore(x) < itemScore(sv.inventory[wi])) wi = i; });
      const w = sv.inventory[wi];
      if (itemScore(w) >= itemScore(it)) { sv.gold += sellValue(it); return; }
      sv.gold += sellValue(w); sv.inventory.splice(wi, 1);
    }
    sv.inventory.push(it);
    if (live && (it.rarity === 'epico' || it.rarity === 'lendario')) this.toast(`Drop: ${it.name}`, it.rarity === 'epico' ? '#c06bff' : '#ffa530');
    if (sum && (!sum.best || RARITIES.indexOf(it.rarity) > RARITIES.indexOf(sum.best.rarity) || (it.rarity === sum.best.rarity && itemScore(it) > itemScore(sum.best)))) sum.best = it;
  }
  private refreshTimer = 0;
  private refreshDerivedSoon() { this.refreshDerived(); this.emit(); }

  equip(id: string) {
    const i = this.save.inventory.findIndex((x) => x.id === id); if (i < 0) return;
    const it = this.save.inventory[i];
    const old = this.char.equipped[it.slot];
    this.char.equipped[it.slot] = it;
    this.save.inventory.splice(i, 1);
    if (old) this.save.inventory.push(old);
    this.refreshDerived(); this.persist(); this.emit();
  }
  /** Equipa, em cada slot, o item da mochila com a melhor pontuação (considera +N e durabilidade). */
  equipBest(): number {
    const score = (it: Item) => itemScore({ ...it, mods: effMods(it) });
    let n = 0;
    for (const slot of SLOTS) {
      let best: Item | undefined = this.char.equipped[slot];
      for (const it of this.save.inventory) if (it.slot === slot && (!best || score(it) > score(best) * 1.0001)) best = it;
      const cur = this.char.equipped[slot];
      if (best && best !== cur) {
        this.save.inventory = this.save.inventory.filter((x) => x !== best);
        if (cur) this.save.inventory.push(cur);
        this.char.equipped[slot] = best; n++;
      }
    }
    if (n) { this.refreshDerived(); this.persist(); this.toast(`${n} ite${n > 1 ? 'ns equipados' : 'm equipado'}`, '#9f9'); }
    else this.toast('Você já está com os melhores itens', '#9ad0ff');
    this.emit(); return n;
  }
  unequip(slot: Slot) {
    const it = this.char.equipped[slot]; if (!it || this.save.inventory.length >= MAX_INV) return;
    delete this.char.equipped[slot]; this.save.inventory.push(it);
    this.refreshDerived(); this.persist(); this.emit();
  }
  sell(id: string) {
    const i = this.save.inventory.findIndex((x) => x.id === id); if (i < 0) return;
    this.save.gold += sellPrice(this.save.inventory[i]); this.save.inventory.splice(i, 1); this.emit();
  }
  sellBelow(r: Rarity) {
    const max = RARITIES.indexOf(r); let g = 0;
    this.save.inventory = this.save.inventory.filter((it) => { if (RARITIES.indexOf(it.rarity) <= max) { g += sellPrice(it); return false; } return true; });
    this.save.gold += g; this.emit(); return g;
  }

  // ───────────── personagem ─────────────
  allocStat(s: Stat, n: number) {
    const k = Math.min(n, this.freePoints()); if (k <= 0) return;
    this.char.alloc[s] += k; this.refreshDerived(); this.emit();
  }
  setAutoAlloc(on: boolean) {
    this.char.auto = on;
    if (on) { const f = this.freePoints(); if (f > 0) this.char.alloc = autoAlloc(this.cls, f, this.char.alloc); this.refreshDerived(); }
    this.emit();
  }
  resetAlloc(): boolean {
    const cost = this.resetCost(); if (this.save.gold < cost) return false;
    this.save.gold -= cost; this.char.alloc = zeroStats();
    if (this.char.auto) this.char.alloc = autoAlloc(this.cls, statPointsFor(this.char.level), this.char.alloc);
    this.refreshDerived(); this.emit(); return true;
  }
  resetCost() { return 200 + this.char.level * 30; }
  rankTalent(branch: number, idx: number, d: 1 | -1) {
    const n = this.cls.talents[branch].nodes[idx]; const key = `${this.cls.id}:${n.id}`;
    const cur = this.char.talents[key] ?? 0;
    if (d > 0) {
      if (cur >= n.max || this.talentPointsLeft() <= 0 || !nodeUnlocked(this.cls, this.char.talents, branch, idx)) return;
      this.char.talents[key] = cur + 1;
    } else {
      if (cur <= 0) return;
      this.char.talents[key] = cur - 1;
      // não deixa ramos posteriores sem pré-requisito
      for (let j = idx + 1; j < 3; j++) { const nk = `${this.cls.id}:${this.cls.talents[branch].nodes[j].id}`; if ((this.char.talents[nk] ?? 0) > 0 && !nodeUnlocked(this.cls, this.char.talents, branch, j)) { this.char.talents[key] = cur; return; } }
    }
    this.refreshDerived(); this.emit();
  }
  resetTalents(): boolean {
    const cost = this.resetCost(); if (this.save.gold < cost) return false;
    this.save.gold -= cost;
    for (const k of Object.keys(this.char.talents)) if (k.startsWith(this.cls.id + ':')) delete this.char.talents[k];
    this.refreshDerived(); this.emit(); return true;
  }
  switchClass(id: string) {
    if (id === this.save.active) return;
    if (!this.save.chars[id]) this.save.chars[id] = newChar();
    this.save.active = id;
    this.refreshDerived(); this.startBattle(); this.persist(); this.emit();
  }
  canPrestige() { return this.char.level >= MIN_PRESTIGE_LEVEL; }
  prestige() {
    if (!this.canPrestige()) return;
    this.save.rebirths++;
    const c = this.char; c.level = 1; c.xp = 0; c.alloc = zeroStats(); c.talents = Object.fromEntries(Object.entries(c.talents).filter(([k]) => !k.startsWith(this.cls.id + ':')));
    if (c.auto) c.alloc = autoAlloc(this.cls, 0, c.alloc);
    this.refreshDerived(); this.startBattle(); this.persist(); this.toast(`Renascimento ${this.save.rebirths}!`, '#ffa530'); this.emit();
  }

  // ───────────── mapas / atividades ─────────────
  mapUnlocked(id: string) { return this.maxLevelEver >= MAP_BY_ID[id].minLv; }
  setMap(id: string) { this.travel(id); }
  setActivity(a: Activity) { if (!this.activityUnlocked(a)) { this.toast(`${a} abre no nível ${ACTIVITY_MIN_LEVEL[a]}`, '#ff9090'); return; } this.save.activity = a; this.save.floor = 1; this.startBattle(true); this.persist(); this.emit(); }
  setMerc(slot: number, id: string | null) { this.save.mercs[slot] = id; this.mercCache.clear(); if (this.save.activity === 'party') this.startBattle(true); this.emit(); }
  mapsUnlockedList() { return MAPS.filter((m) => this.mapUnlocked(m.id)); }

  // ───────────── combate manual ─────────────
  castSlot(i: number) {
    if (i < 8) { const s = this.battle.player.skills[i]; if (s) this.battle.castManual(s.id); }
    else this.battle.usePotion(i === 8 ? 'hp' : 'mp');
    this.save.potions.hp = this.bag.hp; this.save.potions.mp = this.bag.mp;
  }
  toggleAuto(skillId: string) {
    const a = this.char.skillAuto; a[skillId] = !(a[skillId] ?? true); this.emit();
  }

  // ───────────── loja ─────────────
  potionPrice(k: 'hp' | 'mp') { return Math.round((k === 'hp' ? 20 : 26) + this.char.level * 4); }
  chestPrice() { return Math.round(200 + this.char.level * 60); }
  buyPotion(k: 'hp' | 'mp', n: number) {
    const cost = this.potionPrice(k) * n; if (this.save.gold < cost) return false;
    this.save.gold -= cost; this.bag[k] += n; this.save.potions[k] = this.bag[k]; this.emit(); return true;
  }
  buyChest(): Item | null {
    const p = this.chestPrice(); if (this.save.gold < p) return null;
    this.save.gold -= p;
    const it = rollItem(Math.random, this.char.level, 1, undefined, this.derived.mods.dropPct ?? 0);
    if (this.save.inventory.length >= MAX_INV) { this.save.gold += sellValue(it); this.emit(); return it; }
    this.save.inventory.push(it); this.emit(); return it;
  }
  setSettings(p: Partial<SaveData['settings']>) { Object.assign(this.save.settings, p); Battle.AI = this.save.settings.ai !== false; audio.setEnabled(this.save.settings.sound); this.refreshDerived(); this.emit(); }

  // ───────────── offline ─────────────
  applyOffline(elapsed: number) {
    if (!this.save) return;
    const T = Math.min(elapsed, OFFLINE_CAP);
    const sum: OfflineSummary = { secs: T, capped: elapsed > OFFLINE_CAP, xp: 0, gold: 0, kills: 0, fromLevel: this.char.level, toLevel: this.char.level, items: { comum: 0, raro: 0, epico: 0, lendario: 0 }, sold: 0, deaths: 0, sellGold: 0 };
    const chunks = Math.max(1, Math.min(16, Math.ceil(T / 1800)));
    const cs = T / chunks;
    const rng = mulberry32((Date.now() ^ 0x1234567) >>> 0);
    const sv = this.save;
    for (let i = 0; i < chunks; i++) {
      const party = sv.activity === 'party' ? this.mercMembers() : undefined;
      const r = simulate({ classId: sv.active, level: this.char.level, activity: sv.activity, mapId: sv.mapId, seconds: 90, seed: 1000 + i, floor: sv.activity === 'dungeon' ? sv.floor : 1, derived: this.derived, party, rebirths: sv.rebirths });
      const k = (cs / r.secs) * OFFLINE_EFFICIENCY;
      const xp = r.acc.xp * k, gold = r.acc.gold * k, kills = r.acc.kills * k;
      sum.xp += xp; sum.gold += gold; sum.kills += kills; sum.deaths += r.acc.deaths * k; if (r.acc.deaths * k >= 1) this.wearGear(Math.min(3, Math.round(r.acc.deaths * k)));
      sv.gold += Math.round(gold);
      this.gainXp(xp);
      for (let t = 0; t < 3; t++) {
        let n = r.lootTier[t] * k; const full = Math.floor(n); n = full + (rng() < n - full ? 1 : 0);
        for (let j = 0; j < Math.min(n, 60); j++) this.receiveItem(rollItem(rng, Math.max(1, this.char.level), t as 0 | 1 | 2, undefined, this.derived.mods.dropPct ?? 0), false, sum);
      }
      sv.stats.kills += Math.round(kills);
    }
    sum.toLevel = this.char.level;
    if (T >= OFFLINE_TEASER_SECONDS && this.save.onboard.offlineGift === 'pending') {
      this.save.onboard.offlineGift = 'claimed'; this.save.gems += 2;
      const it = this.grantItemKind('raro_armadura'); if (it) { this.receiveItem(it, false, sum); sum.best = it; }
      sum.gift = 'Recompensa do cristal por 1h de descanso: +2 💎 e um item raro!';
    }
    this.refreshDerived(); this.startBattle();
    if (T >= 60) this.summary = sum;
    this.persist(); this.emit();
  }

  // ───────────── save ─────────────
  exportText() { this.persist(); return exportSave(this.save); }
  importText(t: string) {
    const s = importSave(t);
    this.save = s; this.refreshDerived(); this.startBattle(); this.persist(); this.emit();
  }
  hardReset() { try { localStorage.removeItem(SAVE_KEY); } catch { /* */ } this.save = undefined as unknown as SaveData; this.emit(); }
  /** serviço aberto (tela de loja) — definido ao chegar à porta na cidade */
  service: string | null = null;
  openService(id: string | null) { this.service = id; this.emit(); }
  rarityList = RARITIES;
}

export const game = new Game();
export { mergeMods };
