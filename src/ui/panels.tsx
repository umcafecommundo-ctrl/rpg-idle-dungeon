import { useMemo, useState } from 'react';
import { CLASSES, CLASS_BY_ID } from '../data/classes';
import { MAPS } from '../data/maps';
import { BOSSES, KIND_RES, MOB_BY_ID } from '../data/mobs';
import {
  ACTIVITIES, ACTIVITY_DESC, ACTIVITY_LABEL, DMG_COLOR, DMG_LABEL, DMG_TYPES, KIND_LABEL, MOB_KINDS, RARITIES, RARITY_COLOR, RARITY_LABEL, SLOTS, SLOT_LABEL,
  STATS, STAT_DESC, STAT_LABEL, type Item, type Slot, type Stat,
} from '../data/types';
import { mapEfficiency } from '../engine/efficiency';
import { ACTIVITY_MIN_LEVEL } from '../data/onboarding';
import { fmt, MIN_PRESTIGE_LEVEL, nodeUnlocked, skillMpCost, xpToNext } from '../engine/formulas';
import { describeMods, itemScore, sellValue } from '../engine/loot';
import { MAX_INV } from '../engine/save';
import { iconURL } from '../render/icons';
import { CONSUMABLES } from '../data/shops';
import { itemName } from '../engine/shop';
import { Compare, Dur, ItemLines } from './town';
import { skillDetails, statDetails, STATUS_INFO } from './tips';
import { useGame } from './hooks';

const Bar = ({ v, col, label }: { v: number; col: string; label?: string }) => (
  <div className="pbar"><i style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%`, background: col }} />{label && <span>{label}</span>}</div>
);
const kindLabel = (k: string) => KIND_LABEL[k as keyof typeof KIND_LABEL] ?? k;
const pct = (v: number) => `${Math.round(v * 100)}%`;

// ───────────────────────── Personagem ─────────────────────────
export function CharacterPanel() {
  const g = useGame();
  const c = g.char, d = g.derived, cls = g.cls;
  const free = g.freePoints();
  const tp = g.talentPointsLeft();
  const [cfm, setCfm] = useState(false); const [tipStat, setTipStat] = useState<Stat | null>(null);
  return (
    <div className="stack">
      <div className="chips">
        {CLASSES.map((k) => (
          <button key={k.id} className={'chip' + (k.id === cls.id ? ' on' : '')} style={{ borderColor: k.color, color: k.color }} onClick={() => g.toast('Troque de classe na Guilda, na cidade', '#9ad0ff')}>
            {k.name}<small>Nv {g.save.chars[k.id]?.level ?? '–'}</small>
          </button>
        ))}
      </div>
      <div className="muted small">Para trocar de classe, vá à Guilda dos Aventureiros na cidade.</div>
      <div className="card">
        <b style={{ color: cls.color }}>{cls.name}</b> <span className="role">{cls.role}</span>
        <div className="muted">{cls.desc} <i>{cls.strong}</i></div>
        <Bar v={c.level >= 200 ? 1 : c.xp / xpToNext(c.level)} col="#e8c040" label={c.level >= 200 ? 'Nível máximo' : `Nv ${c.level} — XP ${fmt(c.xp)}/${fmt(xpToNext(c.level))}`} />
      </div>

      <div className="card">
        <div className="row"><b>Atributos</b><span className="muted">Pontos livres: <b className={free > 0 ? 'hl' : ''}>{free}</b></span></div>
        {STATS.map((s: Stat) => (
          <div className="statwrap" key={s}>
          <div className="row stat" onClick={() => setTipStat(tipStat === s ? null : s)}>
            <span className="sl">{STAT_LABEL[s]} ⓘ</span>
            <b>{Math.floor(d.stats[s])}</b>
            <span className="muted small">(+{c.alloc[s]})</span>
            <span className="grow" />
            <button className="mini" disabled={free < 1 || c.auto} onClick={(e) => { e.stopPropagation(); g.allocStat(s, 1); }}>+1</button>
            <button className="mini" disabled={free < 5 || c.auto} onClick={(e) => { e.stopPropagation(); g.allocStat(s, 5); }}>+5</button>
          </div>
          {tipStat === s && <div className="tip"><span>{STAT_DESC[s]}</span>{statDetails(s, cls, d).map((l) => <span key={l}>{l}</span>)}</div>}
          </div>
        ))}
        <label className="row check"><input type="checkbox" checked={c.auto} onChange={(e) => g.setAutoAlloc(e.target.checked)} /> Distribuição automática (preset da classe)</label>
        <button className="btn small" onClick={() => g.resetAlloc()} disabled={g.save.gold < g.resetCost()}>Redistribuir ({fmt(g.resetCost())} ouro)</button>
      </div>

      <div className="card grid2">
        <div>HP <b>{fmt(d.maxHp)}</b></div><div>MP <b>{fmt(d.maxMp)}</b></div>
        <div>DEF <b>{fmt(d.def)}</b></div><div>RES Mág. <b>{fmt(d.mdef)}</b></div>
        <div>Dano base <b>{fmt((d.stats[cls.basic.sc] + d.wAtk) * cls.dmgMult)}</b></div><div>Vel. ataque <b>{(1 / d.interval).toFixed(2)}/s</b></div>
        <div>Crítico <b>{pct(d.crit)}</b></div><div>Dano crít. <b>x{d.critDmg.toFixed(2)}</b></div>
        <div>Roubo vida <b>{pct(d.mods.lifesteal ?? 0)}</b></div><div>Recarga <b>-{pct(Math.min(0.5, d.mods.cdr ?? 0))}</b></div>
        <div>XP bônus <b>+{pct(d.mods.xpPct ?? 0)}</b></div><div>Ouro bônus <b>+{pct(d.mods.goldPct ?? 0)}</b></div>
      </div>

      <div className="card">
        <div className="row"><b>Talentos</b><span className="muted">Pontos: <b className={tp > 0 ? 'hl' : ''}>{tp}</b> (1 a cada 4 níveis)</span></div>
        {cls.talents.map((br, bi) => (
          <div key={br.name} className="branch">
            <div className="bname">{br.name}</div>
            {br.nodes.map((n, ni) => {
              const key = `${cls.id}:${n.id}`; const r = c.talents[key] ?? 0; const open = nodeUnlocked(cls, c.talents, bi, ni);
              return (
                <div key={n.id} className={'row node' + (open ? '' : ' lockd')}>
                  <div className="grow"><b>{n.name}</b> <span className="muted small">{open ? n.desc : `Requer ${ni * 4} pts no ramo`}</span></div>
                  <button className="mini" disabled={r <= 0} onClick={() => g.rankTalent(bi, ni, -1)}>−</button>
                  <span className="rank">{r}/{n.max}</span>
                  <button className="mini" disabled={!open || r >= n.max || tp <= 0} onClick={() => g.rankTalent(bi, ni, 1)}>+</button>
                </div>
              );
            })}
          </div>
        ))}
        <button className="btn small" onClick={() => g.resetTalents()} disabled={g.save.gold < g.resetCost()}>Resetar talentos ({fmt(g.resetCost())} ouro)</button>
      </div>

      <div className="card">
        <b>Renascimento</b> <span className="muted">(Nv {MIN_PRESTIGE_LEVEL}+)</span>
        <div className="muted small">Reinicia o nível da classe ativa e concede bônus permanentes a todas as classes: +6% dano, +6% HP, +10% XP, +8% ouro por renascimento.</div>
        <div className="row"><span>Renascimentos: <b>{g.save.rebirths}</b></span><span className="grow" />
          {!cfm ? <button className="btn small" disabled={!g.canPrestige()} onClick={() => setCfm(true)}>Renascer</button>
            : <><button className="btn small danger" onClick={() => { g.prestige(); setCfm(false); }}>Confirmar</button><button className="btn small" onClick={() => setCfm(false)}>Cancelar</button></>}
        </div>
      </div>
      <div className="card muted small">Abates: {fmt(g.save.stats.kills)} · Chefes: {g.save.stats.bosses} · Mortes: {g.save.stats.deaths} · Itens: {g.save.stats.items}</div>
    </div>
  );
}

// ───────────────────────── Habilidades ─────────────────────────
export function SkillsPanel() {
  const g = useGame(); const cls = g.cls; const [open, setOpen] = useState<string | null>(null);
  const man = cls.maneuver; const manLocked = man.lv > g.level; const manAuto = g.char.skillAuto.maneuver ?? true;
  return (
    <div className="stack">
      <div className="muted small">Toque numa habilidade para ver os números e contra quem ela é boa. Na barra, o “A” liga/desliga o auto-cast e tocar no ícone lança na hora.</div>
      {cls.skills.map((s, i) => {
        const locked = s.lv > g.level; const auto = g.char.skillAuto[s.id] ?? true;
        return (
          <div key={s.id} className={'card' + (locked ? ' lockd' : '')} onClick={() => setOpen(open === s.id ? null : s.id)}>
            <div className="skill">
              <img src={iconURL(s.icon, s.col)} alt="" />
              <div className="grow">
                <div className="row"><b>{i + 1}. {s.name}</b><span className="muted small">{locked ? `Nível ${s.lv}` : `${skillMpCost(s.mp, g.level)} MP · ${s.cd}s`}</span></div>
                <div className="muted small">{s.desc}{s.dmg && <> <span style={{ color: DMG_COLOR[s.dmg] }}>[{DMG_LABEL[s.dmg]}]</span></>}</div>
              </div>
              {!locked && <button className={'mini' + (auto ? ' on' : '')} onClick={(e) => { e.stopPropagation(); g.toggleAuto(s.id); }}>{auto ? 'AUTO' : 'MAN'}</button>}
            </div>
            {open === s.id && <div className="tip">{skillDetails(s, g.derived, g.level).map((l) => <span key={l} className={l.startsWith('✔') ? 'good' : l.startsWith('✘') ? 'bad' : ''}>{l}</span>)}</div>}
          </div>
        );
      })}
      <b>Manobra (automática)</b>
      <div className={'card' + (manLocked ? ' lockd' : '')} onClick={() => setOpen(open === 'man' ? null : 'man')}>
        <div className="skill"><img src={iconURL(man.icon, man.col)} alt="" />
          <div className="grow"><div className="row"><b>{man.name}</b><span className="muted small">{manLocked ? `Nível ${man.lv}` : `${man.cd}s`}</span></div><div className="muted small">{man.desc}</div></div>
          {!manLocked && <button className={'mini' + (manAuto ? ' on' : '')} onClick={(e) => { e.stopPropagation(); g.char.skillAuto.maneuver = !manAuto; g.emit(); }}>{manAuto ? 'AUTO' : 'OFF'}</button>}</div>
        {open === 'man' && <div className="tip"><span>Usada pela IA só em emergência (cercado, HP baixo ou beco). Alcance máx. {man.dist} tiles, com animação, recarga de {man.cd}s. Nunca atravessa parede nem inimigo: se algo bloquear, o movimento para.</span></div>}
      </div>
      <b>Passivas</b>
      {cls.passives.map((p) => (
        <div key={p.id} className={'card' + (p.lv > g.level ? ' lockd' : '')}>
          <div className="row"><b>{p.name}</b><span className="muted small">{p.lv > g.level ? `Nível ${p.lv}` : 'Ativa'}</span></div>
          <div className="muted small">{p.desc}</div>
        </div>
      ))}
      <b>Status (efeitos)</b>
      <div className="card legend">{(Object.keys(STATUS_INFO) as (keyof typeof STATUS_INFO)[]).map((k) => <div key={k}><b>{STATUS_INFO[k].name}:</b> <span className="muted">{STATUS_INFO[k].text}</span></div>)}</div>
    </div>
  );
}

// ───────────────────────── Inventário ─────────────────────────
function ItemCard({ it, eq, children }: { it: Item; eq?: Item; children?: React.ReactNode }) {
  const diff = eq ? itemScore(it) - itemScore(eq) : 0;
  return (
    <div className="card item" style={{ borderColor: RARITY_COLOR[it.rarity] }}>
      <div className="row"><b style={{ color: RARITY_COLOR[it.rarity] }}>{itemName(it)}</b><span className="muted small">{RARITY_LABEL[it.rarity]} · {SLOT_LABEL[it.slot]} · iLv {it.ilvl}</span></div>
      <ItemLines it={it} /><Dur it={it} />
      {eq && <><div className={'small ' + (diff >= 0 ? 'up' : 'down')}>{diff >= 0 ? '▲ melhor' : '▼ pior'} que o equipado</div><Compare it={it} eq={eq} /></>}
      {children}
    </div>
  );
}

export function InventoryPanel() {
  const g = useGame(); const [sel, setSel] = useState<string | null>(null); const [selSlot, setSelSlot] = useState<Slot | null>(null);
  const inv = useMemo(() => g.save.inventory.slice().sort((a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) || itemScore(b) - itemScore(a)), [g.save.inventory, g.version]);
  const it = sel ? g.save.inventory.find((x) => x.id === sel) : undefined;
  const eqSel = selSlot ? g.char.equipped[selSlot] : undefined;
  return (
    <div className="stack">
      <div className="card"><b>Consumíveis</b>
        {CONSUMABLES.filter((c) => (g.save.cons[c.id] ?? 0) > 0 || g.save.boosts[c.id]).length === 0 && <div className="muted small">Nenhum. Compre elixires e pergaminhos na Loja de Itens (cidade).</div>}
        {CONSUMABLES.filter((c) => (g.save.cons[c.id] ?? 0) > 0 || g.save.boosts[c.id]).map((c) => (
          <div className="row" key={c.id}><img className="pico" style={{ width: 28, height: 28 }} src={iconURL(c.icon, c.col)} alt="" />
            <div className="grow"><b>{c.name}</b> <span className="muted small">x{g.save.cons[c.id] ?? 0}{g.save.boosts[c.id] ? ` · ativo ${Math.ceil(g.save.boosts[c.id] / 60)}min` : ''}</span></div>
            {c.kind === 'boost' ? <button className="btn small" disabled={(g.save.cons[c.id] ?? 0) < 1} onClick={() => g.useCons(c.id)}>Usar</button> : <span className="muted small">Use ao trocar de mapa</span>}
          </div>))}
      </div>
      <div className="eqgrid">
        {SLOTS.map((s) => {
          const e = g.char.equipped[s];
          return (
            <button key={s} className={'eqslot' + (selSlot === s ? ' on' : '')} style={{ borderColor: e ? RARITY_COLOR[e.rarity] : undefined }} onClick={() => { setSelSlot(selSlot === s ? null : s); setSel(null); }}>
              <small>{SLOT_LABEL[s]}</small><b style={{ color: e ? RARITY_COLOR[e.rarity] : '#666' }}>{e ? e.name.split(' ')[0] : '—'}</b>{e && <small>iLv {e.ilvl}</small>}
            </button>
          );
        })}
      </div>
      {selSlot && eqSel && <ItemCard it={eqSel}><button className="btn small" onClick={() => { g.unequip(selSlot); setSelSlot(null); }}>Desequipar</button></ItemCard>}
      {it && (
        <ItemCard it={it} eq={g.char.equipped[it.slot]}>
          <div className="row"><button className="btn small" onClick={() => { g.equip(it.id); setSel(null); }}>Equipar</button>
            <button className="btn small danger" onClick={() => { g.sell(it.id); setSel(null); }}>Vender ({fmt(sellValue(it))})</button></div>
        </ItemCard>
      )}
      <button className="btn" onClick={() => g.equipBest()}>⚔ Equipar melhores itens</button>
      <div className="row"><b>Mochila {inv.length}/{MAX_INV}</b><span className="grow" />
        <button className="btn small" onClick={() => g.sellBelow('comum')}>Vender comuns</button>
        <button className="btn small" onClick={() => g.sellBelow('raro')}>Vender até raros</button></div>
      <div className="list">
        {inv.length === 0 && <div className="muted">Nenhum item. Derrote mobs, elites e chefes para obter equipamentos.</div>}
        {inv.map((x) => {
          const eq = g.char.equipped[x.slot]; const better = !eq || itemScore(x) > itemScore(eq);
          return (
            <button key={x.id} className={'irow' + (sel === x.id ? ' on' : '')} style={{ borderLeftColor: RARITY_COLOR[x.rarity] }} onClick={() => { setSel(sel === x.id ? null : x.id); setSelSlot(null); }}>
              <b style={{ color: RARITY_COLOR[x.rarity] }}>{itemName(x)}</b><small>{SLOT_LABEL[x.slot]} · iLv {x.ilvl}</small>{better && <span className="up">▲</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────── Mapas ─────────────────────────
export function MapsPanel({ portal = false }: { portal?: boolean }) {
  const g = useGame(); const sv = g.save;
  const [open, setOpen] = useState<string>(sv.mapId);
  const [showTable, setShowTable] = useState(false);
  const eff = useMemo(() => mapEfficiency(open, sv.activity, g.level, sv.rebirths), [open, sv.activity, g.level, sv.rebirths]);
  const maxXp = Math.max(...eff.map((e) => e.xpH), 1);
  return (
    <div className="stack">
      <div className="chips">
        {ACTIVITIES.map((a) => { const un = g.activityUnlocked(a); return <button key={a} className={'chip' + (sv.activity === a ? ' on' : '') + (un ? '' : ' lockd')} onClick={() => g.setActivity(a)}>{un ? ACTIVITY_LABEL[a] : `🔒 ${ACTIVITY_LABEL[a]} (Nv ${ACTIVITY_MIN_LEVEL[a]})`}</button>; })}
      </div>
      <div className="muted small">{ACTIVITY_DESC[sv.activity]}</div>
      {sv.activity === 'party' && (
        <div className="card"><b>Mercenários</b>
          {[0, 1, 2].map((i) => (
            <div className="row" key={i}><span>Vaga {i + 1}</span><span className="grow" />
              <select value={sv.mercs[i] ?? ''} onChange={(e) => g.setMerc(i, e.target.value || null)}>
                <option value="">— vazio —</option>{CLASSES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
          ))}
        </div>
      )}
      {MAPS.map((m) => {
        const un = g.mapUnlocked(m.id); const cur = sv.mapId === m.id; const boss = MOB_BY_ID[m.boss];
        return (
          <div key={m.id} className={'card map' + (un ? '' : ' lockd') + (cur ? ' cur' : '')} style={{ borderColor: cur ? m.theme.accent : undefined }}>
            <div className="row" onClick={() => un && setOpen(open === m.id ? '' : m.id)}>
              <b style={{ color: m.theme.accent }}>{m.name}</b><span className="muted small">Nv {m.minLv}–{m.maxLv}</span><span className="grow" />
              {un ? <button className={'btn small' + (cur ? ' on' : '')} onClick={(e) => { e.stopPropagation(); g.setMap(m.id); }}>{cur ? 'Atual' : 'Ir'}</button> : <button className="btn small lockd" onClick={(e) => { e.stopPropagation(); g.travel(m.id); }}>🔒 Nv {m.minLv}</button>}
            </div>
            <div className="muted small">{m.desc}{!un && <b className="hl"> Faltam {m.minLv - g.maxLevelEver} nível(is) para desbloquear.</b>}</div>
            <div className="mobchips">
              {un ? m.mobs.map((x) => { const d = MOB_BY_ID[x.id]; return <span key={x.id} className="mchip">{d.name} <i>{KIND_LABEL[d.kind]}</i></span>; }) : m.mobs.map((x) => <span key={x.id} className="mchip unk">??? <i>desconhecido</i></span>)}
              <span className="mchip boss">{un ? `Chefe: ${boss.name}` : 'Chefe: ???'}</span>
            </div>
            {sv.activity === 'dungeon' && un && <div className="muted small">Melhor andar: {sv.bestFloor[m.id] ?? 1}</div>}
            {open === m.id && un && (
              <div className="eff">
                <div className="muted small">Eficiência por classe — {ACTIVITY_LABEL[sv.activity]}, nível {g.level}, sem equipamentos</div>
                {eff.slice().sort((a, b) => b.xpH - a.xpH).map((e, i) => (
                  <div key={e.classId} className={'effrow' + (e.classId === g.cls.id ? ' me' : '')}>
                    <span className="en" style={{ color: CLASS_BY_ID[e.classId].color }}>{i === 0 ? '★ ' : ''}{CLASS_BY_ID[e.classId].name}</span>
                    <div className="ebar"><i style={{ width: `${(e.xpH / maxXp) * 100}%`, background: CLASS_BY_ID[e.classId].color }} /></div>
                    <span className="ev">{fmt(e.xpH)} XP/h</span>
                    <span className={'risk r-' + e.risk}>{e.risk}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <button className="link" onClick={() => setShowTable(!showTable)}>{showTable ? 'Ocultar' : 'Mostrar'} tabela de vantagens de tipo</button>
      {showTable && <TypeTable />}
      <div className="muted small">Chefes: {BOSSES.map((b) => b.name).join(', ')}.</div>
    </div>
  );
}

export function TypeTable() {
  return (
    <div className="ttable">
      <table>
        <thead><tr><th></th>{DMG_TYPES.map((t) => <th key={t} style={{ color: DMG_COLOR[t] }}>{DMG_LABEL[t].slice(0, 3)}</th>)}</tr></thead>
        <tbody>
          {MOB_KINDS.map((k) => (
            <tr key={k}><td>{KIND_LABEL[k]}</td>
              {DMG_TYPES.map((t) => { const v = KIND_RES[k][t] ?? 1; return <td key={t} className={v === 0 ? 'imm' : v > 1.05 ? 'weak' : v < 0.95 ? 'res' : ''}>{v === 0 ? '0' : v.toFixed(2).replace(/0$/, '')}</td>; })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="muted small">Verde: fraqueza (&gt;1). Vermelho: resistência (&lt;1). 0 = imune. Algumas espécies sobrescrevem (ex.: Elemental de Fogo é imune a fogo e fraco a gelo).</div>
    </div>
  );
}

