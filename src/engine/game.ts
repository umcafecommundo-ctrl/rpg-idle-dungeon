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

export const OFFLINE_CAP = 8 * 3600;
export const OFFLINE_EFFICIENCY = 0.85;

export interface OfflineSummary {
  secs: number; capped: boolean; xp: number; gold: number; kills: number; fromLevel: number; toLevel: number;
  items: Record<Rarity, number>; sold: number; deaths: number; best?: Item; sellGold: number;
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
      this.save = s;
      this.refreshDerived();
      this.startBattle();
      this.scene = s.inTown ? 'town' : 'field';
      audio.setEnabled(s.settings.sound); audio.setScene(s.inTown ? 'cidade' : s.mapId);
      const elapsed = (Date.now() - s.ts) / 1000;
      this.tickBoosts(Math.min(elapsed, OFFLINE_CAP));
      if (elapsed > 60 && !s.inTown) this.applyOffline(elapsed);
    }
    this.emit();
  }
  newGame(classId: string) {
    this.save = newSave(classId); this.scene = 'field'; audio.setEnabled(true); audio.setScene('esgoto');
    this.refreshDerived(); this.startBattle(); this.persist(); this.emit();
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
    return derive({ classId, level: c.level, alloc: c.alloc, talents: c.talents, gear: this.gearMods(c), rebirths: this.save.rebirths });
  }
  refreshDerived() {
    this.derived = this.derivedFor(this.save.active);
    this.bag.hp = this.save.potions.hp; this.bag.mp = this.save.potions.mp;
    this.bag.on = this.save.settings.autoPot; this.bag.hpTh = this.save.settings.hpTh; this.bag.mpTh = this.save.settings.mpTh;
    if (this.battle) {
      this.battle.cfg.xpBonus = this.derived.mods.xpPct ?? 0; this.battle.cfg.goldBonus = this.derived.mods.goldPct ?? 0; this.battle.cfg.dropBonus = this.derived.mods.dropPct ?? 0;
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
      xpBonus: this.derived.mods.xpPct ?? 0, goldBonus: this.derived.mods.goldPct ?? 0, dropBonus: this.derived.mods.dropPct ?? 0,
    });
    this.battle.layout = generateLayout(this.save.mapId, (Date.now() ^ 0x51ed) >>> 0);
    this.seen = { xp: 0, gold: 0, kills: 0, elites: 0, bosses: 0, floors: 0, deaths: 0 };
    this.syncBoostBuffs();
  }

  update(dtReal: number) {
    if (!this.save) return;
    this.boostT += dtReal;
    if (this.boostT >= 1) { this.tickBoosts(this.boostT); this.boostT = 0; }
    for (const t of this.toasts) t.t -= dtReal;
    if (this.toasts.length && this.toasts[0].t <= 0) this.toasts = this.toasts.filter((t) => t.t > 0);
    this.saveT += dtReal;
    if (this.saveT > 10) { this.saveT = 0; this.persist(); }
    if (this.scene === 'town') { this.town.update(Math.min(dtReal, 0.1)); return; }
    if (dtReal > 15) { this.tickBoosts(dtReal); this.applyOffline(dtReal); return; }
    this.acc += Math.min(dtReal, 0.25);
    let n = 0;
    while (this.acc >= TICK && n < 8) { this.battle.step(TICK); this.afterStep(); this.acc -= TICK; n++; }
    if (this.acc > TICK * 8) this.acc = 0;
  }

  private afterStep() {
    const b = this.battle, a = b.acc, s = this.seen, sv = this.save;
    if (a.xp !== s.xp || a.gold !== s.gold) {
      sv.gold += Math.round(a.gold - s.gold); const dx = a.xp - s.xp; s.xp = a.xp; s.gold = a.gold;
      this.gainXp(dx);
    }
    if (a.kills !== s.kills) { sv.stats.kills += a.kills - s.kills; s.kills = a.kills; }
    if (a.bosses !== s.bosses) { sv.stats.bosses += a.bosses - s.bosses; s.bosses = a.bosses; const gm = 1 + Math.floor(Math.random() * 2); sv.gems += gm; this.toast(`Chefe derrotado! +${gm} gema${gm > 1 ? 's' : ''}`, '#ffcf6a'); }
    if (a.deaths !== s.deaths) { sv.stats.deaths += a.deaths - s.deaths; this.wearGear(a.deaths - s.deaths); s.deaths = a.deaths; }
    if (b.loot.length) {
      for (const l of b.loot) { const it = rollItem(b.rng, l.ilvl, l.tier, undefined, this.derived.mods.dropPct ?? 0); this.receiveItem(it, true); }
      b.loot.length = 0;
    }
    if (sv.activity === 'dungeon' && sv.floor !== b.floor) {
      sv.floor = b.floor; sv.bestFloor[sv.mapId] = Math.max(sv.bestFloor[sv.mapId] ?? 1, b.floor);
    }
    this.bag.hp = Math.max(0, this.bag.hp);
  }

  // ───────────── cena: cidade / campo ─────────────
  private runTransition(title: string, sub: string, fn: () => void) {
    if (this.transition) return;
    this.transition = { title, sub, phase: 'out' }; this.emit();
    setTimeout(() => { fn(); this.transition = { title, sub, phase: 'hold' }; this.emit(); }, 330);
    setTimeout(() => { if (this.transition) { this.transition.phase = 'in'; this.emit(); } }, 1250);
    setTimeout(() => { this.transition = null; this.emit(); }, 1700);
  }
  goTown() {
    if (this.scene === 'town') return;
    this.runTransition('Vila Pedrafria', 'Cidade segura — sem combate e sem ganho de XP', () => {
      this.persist(); this.scene = 'town'; this.save.inTown = true; this.town.player.x = this.town.player.px = 10; this.town.player.y = this.town.player.py = 21.5; this.town.player.path = []; this.town.pending = null;
      audio.setScene('cidade'); this.persist();
    });
  }
  goField() {
    if (this.scene === 'field') return;
    const m = MAPS_BY_ID[this.save.mapId];
    this.runTransition(m.name, `Nível recomendado ${m.minLv}–${m.maxLv}`, () => {
      this.scene = 'field'; this.save.inTown = false; this.startBattle(); audio.setScene(this.save.mapId); this.persist();
    });
  }
  /** Viaja para um mapa: grátis na cidade (portal); em campo consome um Pergaminho de Teleporte. */
  travel(id: string): boolean {
    if (!this.mapUnlocked(id)) return false;
    const m = MAPS_BY_ID[id];
    if (this.scene === 'field' && id !== this.save.mapId) {
      if ((this.save.cons.scroll_tp ?? 0) < 1) { this.toast('Precisa de um Pergaminho de Teleporte', '#ff9090'); return false; }
      this.save.cons.scroll_tp--;
    }
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

  // ───────────── XP / nível ─────────────
  gainXp(x: number): number {
    const c = this.char; let lv = 0;
    if (c.level >= MAX_LEVEL) return 0;
    c.xp += x;
    while (c.level < MAX_LEVEL && c.xp >= xpToNext(c.level)) { c.xp -= xpToNext(c.level); c.level++; lv++; this.onLevelUp(c); }
    if (c.level >= MAX_LEVEL) c.xp = 0;
    if (lv > 0) {
      this.refreshDerived(); this.emit();
      if (this.battle) { this.battle.float(this.battle.player.x, this.battle.player.y - 0.8, `NÍVEL ${c.level}!`, '#ffe040', true); this.battle.addFx('pillar', this.battle.player.x, this.battle.player.y, 0, 0, 0.9, '#ffe040', 2); }
      this.toast(`Nível ${c.level}!`, '#ffe040');
    }
    return lv;
  }
  private onLevelUp(c: CharSave) {
    if (c.auto) c.alloc = autoAlloc(this.cls, 3, c.alloc);
  }
  xpNeed() { return xpToNext(this.char.level); }

  // ───────────── itens ─────────────
  receiveItem(it: Item, live: boolean, sum?: OfflineSummary) {
    const sv = this.save; sv.stats.items++;
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
  setActivity(a: Activity) { this.save.activity = a; this.save.floor = 1; this.startBattle(true); this.persist(); this.emit(); }
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
  setSettings(p: Partial<SaveData['settings']>) { Object.assign(this.save.settings, p); audio.setEnabled(this.save.settings.sound); this.refreshDerived(); this.emit(); }

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
