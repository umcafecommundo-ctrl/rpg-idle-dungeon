import { useEffect, useMemo, useState } from 'react';
import { CLASSES } from '../data/classes';
import { CONSUMABLES, plusMult, STOCK_HOURS, upgradeChance, upgradeCost, UPGRADE_MAX, type Consumable } from '../data/shops';
import { BUILDING_BY_ID } from '../data/town';
import { KIND_LABEL, RARITIES, RARITY_COLOR, RARITY_LABEL, SLOT_LABEL, type Item, type Mods } from '../data/types';
import { fmt } from '../engine/formulas';
import { MOD_LABEL } from '../engine/loot';
import { buyPrice, effMods, equippedList, itemName, repairCost, sellPrice, stockRemainingMs } from '../engine/shop';
import { game } from '../engine/game';
import { iconURL } from '../render/icons';
import { useGame } from './hooks';
import { MapsPanel } from './panels';

// ───────────── utilidades de UI ─────────────
function ConfirmBtn({ label, confirm = 'Confirmar?', onYes, disabled, cls = 'btn small' }: { label: string; confirm?: string; onYes: () => void; disabled?: boolean; cls?: string }) {
  const [arm, setArm] = useState(false);
  useEffect(() => { if (!arm) return; const t = setTimeout(() => setArm(false), 3000); return () => clearTimeout(t); }, [arm]);
  return <button className={cls + (arm ? ' danger' : '')} disabled={disabled} onClick={() => { if (arm) { setArm(false); onYes(); } else setArm(true); }}>{arm ? confirm : label}</button>;
}
const Tabs = ({ tabs, v, set }: { tabs: [string, string][]; v: string; set: (s: string) => void }) => (
  <div className="chips">{tabs.map(([id, l]) => <button key={id} className={'chip' + (v === id ? ' on' : '')} onClick={() => set(id)}>{l}</button>)}</div>
);

/** Diferença de atributos entre o item novo e o equipado: verde = melhor, vermelho = pior. */
function Compare({ it, eq }: { it: Item; eq?: Item }) {
  const a = effMods(it), b = eq ? effMods(eq) : {};
  const rows: { l: string; d: number; p: boolean }[] = [];
  for (const [k, l, p] of MOD_LABEL) { const d = ((a[k] as number) ?? 0) - ((b[k] as number) ?? 0); if (Math.abs(d) > (p ? 0.0005 : 0.5)) rows.push({ l, d, p }); }
  for (const grp of ['vs', 'elem'] as const) {
    const ks = new Set([...Object.keys(a[grp] ?? {}), ...Object.keys(b[grp] ?? {})]);
    ks.forEach((k) => { const d = ((a[grp] as Record<string, number> | undefined)?.[k] ?? 0) - ((b[grp] as Record<string, number> | undefined)?.[k] ?? 0); if (Math.abs(d) > 0.0005) rows.push({ l: grp === 'vs' ? `vs ${KIND_LABEL[k as keyof typeof KIND_LABEL] ?? k}` : `dano ${k}`, d, p: true }); });
  }
  if (!eq) return <div className="muted small">Nada equipado neste slot.</div>;
  if (!rows.length) return <div className="muted small">Sem diferença de atributos.</div>;
  return <div className="cmp">{rows.map((r) => <span key={r.l} className={r.d > 0 ? 'up' : 'down'}>{r.d > 0 ? '▲' : '▼'} {r.d > 0 ? '+' : '−'}{r.p ? `${Math.abs(+(r.d * 100).toFixed(1))}%` : Math.abs(Math.round(r.d))} {r.l}</span>)}</div>;
}

export function ItemLines({ it }: { it: Item }) {
  const m = effMods(it); const out: string[] = [];
  for (const [k, l, p] of MOD_LABEL) { const v = m[k] as number | undefined; if (v) out.push(`+${p ? `${+(v * 100).toFixed(1)}%` : Math.round(v)} ${l}`); }
  if (m.vs) for (const k in m.vs) out.push(`+${+((m.vs[k as keyof typeof m.vs]! * 100).toFixed(1))}% vs ${KIND_LABEL[k as keyof typeof KIND_LABEL]}`);
  return <div className="mods">{out.map((l) => <span key={l}>{l}</span>)}</div>;
}
export const Dur = ({ it }: { it: Item }) => { const d = it.dur ?? 100; return <div className="small muted">Durabilidade <b className={d < 20 ? 'down' : d < 50 ? 'hl' : ''}>{Math.round(d)}%</b>{d < 20 && ' (bônus reduzidos!)'}</div>; };
export const ItemTitle = ({ it }: { it: Item }) => <b style={{ color: RARITY_COLOR[it.rarity] }}>{itemName(it)}</b>;

// ───────────── casca da tela do estabelecimento ─────────────
export function ServiceSheet({ id }: { id: string }) {
  const b = BUILDING_BY_ID[id];
  const g = useGame();
  return (
    <div className="sheet">
      <div className="sheet-h"><b>{b.id === 'portal' ? 'Portal' : b.npc.name + ' — ' + ({ ferreiro: 'Ferreiro', itens: 'Loja de Itens', mercado: 'Mercado', taverna: 'Taverna', guilda: 'Guilda', templo: 'Templo', banco: 'Banco', magia: 'Loja de Magia', joalheiro: 'Joalheiro' } as Record<string, string>)[id]}</b>
        <button onClick={() => g.openService(null)} aria-label="Fechar">✕</button></div>
      <div className="wallet"><span>🪙 {fmt(g.save.gold)}</span><span>💎 {g.save.gems}</span></div>
      <div className="sheet-b">
        {id === 'ferreiro' && <Blacksmith />}
        {id === 'itens' && <ItemShop />}
        {id === 'mercado' && <Market />}
        {id === 'portal' && <MapsPanel portal />}
        {id === 'taverna' && <Tavern />}
        {id === 'guilda' && <Guild />}
        {id === 'templo' && <Temple />}
        {['banco', 'magia', 'joalheiro'].includes(id) && <Soon id={id} />}
      </div>
    </div>
  );
}

const Soon = ({ id }: { id: string }) => (
  <div className="card"><b>Em construção</b>
    <div className="muted">{{ banco: 'O Banco guardará itens e ouro, expandindo seu inventário.', magia: 'A Loja de Magia venderá livros de skill, runas e encantamentos contra tipos de mob.', joalheiro: 'O Joalheiro venderá anéis e amuletos e permitirá criar e encaixar gemas.' }[id]}</div>
    <div className="muted small">Este estabelecimento será ativado numa próxima atualização.</div></div>
);

// ───────────── Ferreiro ─────────────
function Blacksmith() {
  const g = useGame(); const [tab, setTab] = useState('buy'); const [pick, setPick] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const stock = g.shopStock();
  const rem = stockRemainingMs(); const h = Math.floor(rem / 3600e3), m = Math.floor((rem % 3600e3) / 60e3);
  return (
    <div className="stack">
      <Tabs tabs={[['buy', 'Comprar'], ['up', 'Melhorar'], ['rep', 'Reparar'], ['chest', 'Baú']]} v={tab} set={(t) => { setTab(t); setPick(null); setMsg(''); }} />
      {msg && <div className="card">{msg}</div>}
      {tab === 'buy' && (<>
        <div className="muted small">Estoque renova a cada {STOCK_HOURS}h — próxima troca em {h}h {m}min. Itens vendidos voltam por uma fração do preço.</div>
        {stock.map(({ it, sold }) => {
          const price = buyPrice(it); const eq = g.char.equipped[it.slot]; const open = pick === it.id;
          return (
            <div key={it.id} className={'card item' + (sold ? ' lockd' : '')} style={{ borderColor: RARITY_COLOR[it.rarity] }}>
              <div className="row" onClick={() => !sold && setPick(open ? null : it.id)}>
                <div className="grow"><ItemTitle it={it} /><div className="muted small">{RARITY_LABEL[it.rarity]} · {SLOT_LABEL[it.slot]} · iLv {it.ilvl}</div></div>
                <b className={g.save.gold >= price ? 'hl' : 'down'}>{sold ? 'Vendido' : `${fmt(price)}`}</b>
              </div>
              {open && !sold && (<>
                <ItemLines it={it} />
                <div className="small muted">Comparado com o equipado{eq ? ` (${itemName(eq)})` : ''}:</div>
                <Compare it={it} eq={eq} />
                <div className="row"><ConfirmBtn label={`Comprar (${fmt(price)})`} disabled={g.save.gold < price || g.save.inventory.length >= 80} onYes={() => { const r = g.buyShopItem(it.id); setMsg(r ? `Comprou ${itemName(r)}!` : 'Não foi possível comprar.'); setPick(null); }} />
                  {g.save.inventory.length >= 80 && <span className="down small">Mochila cheia</span>}</div>
              </>)}
            </div>
          );
        })}
      </>)}
      {tab === 'up' && <Upgrade setMsg={setMsg} />}
      {tab === 'rep' && <Repair setMsg={setMsg} />}
      {tab === 'chest' && (
        <div className="card"><b>Baú misterioso</b><div className="muted small">Um item aleatório do seu nível, com chance maior de raros.</div>
          <ConfirmBtn label={`Abrir (${fmt(g.chestPrice())} ouro)`} disabled={g.save.gold < g.chestPrice()} onYes={() => { const it = g.buyChest(); setMsg(it ? `Recebeu ${itemName(it)} (${RARITY_LABEL[it.rarity]})!` : 'Ouro insuficiente.'); }} /></div>
      )}
    </div>
  );
}

function Upgrade({ setMsg }: { setMsg: (s: string) => void }) {
  const g = useGame(); const [sel, setSel] = useState<string | null>(null);
  const all = [...equippedList(g.char.equipped).map((it) => ({ it, eq: true })), ...g.save.inventory.map((it) => ({ it, eq: false }))];
  const cur = sel ? g.findItem(sel) : null;
  return (
    <>
      <div className="muted small">+1 a +{UPGRADE_MAX}: cada nível aumenta todos os bônus em {Math.round((plusMult(1) - 1) * 100)}%. A partir do +6 há chance de falha; do +8 em diante, a falha reduz 2 níveis.</div>
      {cur && (() => {
        const it = cur.it; const next = (it.plus ?? 0) + 1; const cost = upgradeCost(it.ilvl, next);
        return (
          <div className="card item" style={{ borderColor: RARITY_COLOR[it.rarity] }}>
            <div className="row"><ItemTitle it={it} /><span className="muted small">{cur.eq ? 'equipado' : 'mochila'}</span></div>
            <ItemLines it={it} /><Dur it={it} />
            {next > UPGRADE_MAX ? <div className="hl">Nível máximo (+{UPGRADE_MAX}).</div> : (<>
              <div className="small">Próximo: <b>+{next}</b> · Sucesso: <b className={upgradeChance(next) < 1 ? 'hl' : 'up'}>{Math.round(upgradeChance(next) * 100)}%</b> · Custo: <b>{fmt(cost)}</b> ouro</div>
              <ConfirmBtn label={`Melhorar para +${next}`} disabled={g.save.gold < cost} onYes={() => {
                const r = g.upgradeItem(it.id);
                setMsg(r === 'ok' ? `Sucesso! ${itemName(it)}` : r === 'fail' ? 'A melhoria falhou. O item não foi perdido.' : r === 'down' ? 'Falhou! O item perdeu 2 níveis.' : 'Ouro insuficiente.');
              }} /></>)}
          </div>
        );
      })()}
      <div className="list">{all.map(({ it, eq }) => (
        <button key={it.id} className={'irow' + (sel === it.id ? ' on' : '')} style={{ borderLeftColor: RARITY_COLOR[it.rarity] }} onClick={() => setSel(it.id)}>
          <b style={{ color: RARITY_COLOR[it.rarity] }}>{itemName(it)}</b><small>{SLOT_LABEL[it.slot]} · {eq ? 'equipado' : `iLv ${it.ilvl}`}</small></button>
      ))}</div>
    </>
  );
}

function Repair({ setMsg }: { setMsg: (s: string) => void }) {
  const g = useGame(); const items = equippedList(g.char.equipped);
  const total = items.reduce((a, i) => a + repairCost(i), 0);
  return (
    <>
      <div className="muted small">O equipamento perde durabilidade ao morrer. Abaixo de 20%, seus bônus caem pela metade.</div>
      {items.length === 0 && <div className="muted">Nada equipado.</div>}
      {items.map((it) => (<div className="card" key={it.id}><div className="row"><ItemTitle it={it} /><span className="grow" /><span className="muted small">{repairCost(it) ? fmt(repairCost(it)) + ' ouro' : 'ok'}</span></div>
        <div className="pbar"><i style={{ width: `${it.dur ?? 100}%`, background: (it.dur ?? 100) < 20 ? '#e84a4a' : (it.dur ?? 100) < 50 ? '#e8c040' : '#4ac060' }} /><span>{Math.round(it.dur ?? 100)}%</span></div></div>))}
      <ConfirmBtn label={`Reparar tudo (${fmt(total)} ouro)`} disabled={total <= 0 || g.save.gold < total} onYes={() => { const r = g.repairAll(); setMsg(r >= 0 ? `Equipamento reparado por ${fmt(r)} ouro.` : 'Ouro insuficiente.'); }} />
    </>
  );
}

// ───────────── Loja de Itens ─────────────
function ConsRow({ c }: { c: Consumable }) {
  const g = useGame(); const lv = g.level; const price = c.price(lv);
  const ok = (n: number) => g.save.gold >= price * n && g.save.gems >= (c.gems ?? 0) * n;
  const act = g.save.boosts[c.id];
  return (
    <div className="card row">
      <img className="pico" src={iconURL(c.icon, c.col)} alt="" />
      <div className="grow"><b>{c.name}</b><div className="muted small">{c.desc} · Você tem: {g.save.cons[c.id] ?? 0}{act ? ` · ativo ${Math.ceil(act / 60)}min` : ''}</div></div>
      <ConfirmBtn label={c.gems ? `💎 ${c.gems}` : fmt(price)} disabled={!ok(1)} onYes={() => g.buyCons(c.id, 1)} />
    </div>
  );
}
function ItemShop() {
  const g = useGame();
  return (
    <div className="stack">
      <b>Poções</b>
      {(['hp', 'mp'] as const).map((k) => (
        <div className="card row" key={k}>
          <img className="pico" src={iconURL(k === 'hp' ? 'potion' : 'potionmp', k === 'hp' ? '#ff5a6a' : '#4a9aff')} alt="" />
          <div className="grow"><b>Poção de {k === 'hp' ? 'HP' : 'MP'}</b><div className="muted small">{k === 'hp' ? 'Cura 45% do HP máx.' : 'Restaura 50% do MP máx.'} · Estoque: {g.bag[k]}</div></div>
          <ConfirmBtn label={`x1 · ${fmt(g.potionPrice(k))}`} disabled={g.save.gold < g.potionPrice(k)} onYes={() => g.buyPotion(k, 1)} />
          <ConfirmBtn label="x10" disabled={g.save.gold < g.potionPrice(k) * 10} onYes={() => g.buyPotion(k, 10)} />
        </div>
      ))}
      <b>Elixires de buff</b>{CONSUMABLES.filter((c) => c.id.startsWith('buff')).map((c) => <ConsRow key={c.id} c={c} />)}
      <b>Pergaminhos</b>{CONSUMABLES.filter((c) => c.id.startsWith('scroll')).map((c) => <ConsRow key={c.id} c={c} />)}
      <div className="muted small">Elixires e pergaminhos de XP são usados em Inventário → Consumíveis. 💎 Gemas vêm de chefes.</div>
    </div>
  );
}

// ───────────── Mercado ─────────────
function Market() {
  const g = useGame(); const [pick, setPick] = useState<string | null>(null); const [msg, setMsg] = useState('');
  const inv = useMemo(() => g.save.inventory.slice().sort((a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) || b.ilvl - a.ilvl), [g.save.inventory, g.version]);
  const sums = RARITIES.map((r) => inv.filter((i) => i.rarity === r).reduce((a, i) => a + sellPrice(i), 0));
  const cnt = RARITIES.map((r) => inv.filter((i) => i.rarity === r).length);
  return (
    <div className="stack">
      <div className="muted small">O Mercado paga uma fração do preço de compra. Melhorias (+N) valorizam o item.</div>
      {msg && <div className="card">{msg}</div>}
      <div className="card"><b>Venda rápida por raridade</b>
        <div className="grid2">{RARITIES.slice(0, 3).map((r, i) => (
          <ConfirmBtn key={r} label={`Até ${RARITY_LABEL[r]} (${cnt.slice(0, i + 1).reduce((a, b) => a + b, 0)} · ${fmt(sums.slice(0, i + 1).reduce((a, b) => a + b, 0))})`} disabled={cnt.slice(0, i + 1).every((n) => n === 0)} onYes={() => setMsg(`Vendeu por ${fmt(g.sellBelow(r))} ouro.`)} />
        ))}</div></div>
      <div className="list">
        {inv.length === 0 && <div className="muted">Mochila vazia.</div>}
        {inv.map((it) => {
          const open = pick === it.id; const eq = g.char.equipped[it.slot];
          return (
            <div key={it.id} className="card item" style={{ borderColor: RARITY_COLOR[it.rarity] }}>
              <div className="row" onClick={() => setPick(open ? null : it.id)}>
                <div className="grow"><ItemTitle it={it} /><div className="muted small">{SLOT_LABEL[it.slot]} · iLv {it.ilvl}</div></div><b className="hl">{fmt(sellPrice(it))}</b>
              </div>
              {open && (<><ItemLines it={it} /><Compare it={it} eq={eq} /><ConfirmBtn label={`Vender (${fmt(sellPrice(it))})`} cls="btn small danger" onYes={() => { g.sell(it.id); setPick(null); }} /></>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ───────────── Taverna / Guilda / Templo ─────────────
function Tavern() {
  const g = useGame(); const sv = g.save;
  return (
    <div className="stack">
      <div className="card"><b>Mercenários</b><div className="muted small">Eles lutam ao seu lado na atividade <b>Party</b>. Escolha até 3 classes.</div>
        {[0, 1, 2].map((i) => (
          <div className="row" key={i}><span>Vaga {i + 1}</span><span className="grow" />
            <select value={sv.mercs[i] ?? ''} onChange={(e) => g.setMerc(i, e.target.value || null)}>
              <option value="">— vazio —</option>{CLASSES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
        ))}</div>
      <div className="card"><b>Quadro de missões</b><div className="muted small">Missões diárias e semanais chegam numa próxima atualização.</div></div>
    </div>
  );
}
function Guild() {
  const g = useGame(); const cost = g.classSwitchCost(); const [msg, setMsg] = useState('');
  return (
    <div className="stack">
      {msg && <div className="card">{msg}</div>}
      <div className="card"><b>Trocar de classe</b><div className="muted small">Custa {fmt(cost)} ouro por troca. Cada classe mantém nível, atributos e talentos próprios; equipamentos são por classe.</div></div>
      {CLASSES.map((c) => (
        <div className="card row" key={c.id}>
          <div className="grow"><b style={{ color: c.color }}>{c.name}</b> <span className="muted small">{c.role} · Nv {g.save.chars[c.id]?.level ?? '—'}</span></div>
          {c.id === g.save.active ? <span className="hl small">Ativa</span> : <ConfirmBtn label={`Trocar (${fmt(cost)})`} disabled={g.save.gold < cost} onYes={() => setMsg(g.guildSwitch(c.id) ? `Agora você é ${c.name}.` : 'Ouro insuficiente.')} />}
        </div>
      ))}
      <div className="card"><b>Reiniciar talentos</b><div className="muted small">Devolve todos os pontos de talento de {g.cls.name}.</div>
        <ConfirmBtn label={`Resetar (${fmt(g.resetCost())})`} disabled={g.save.gold < g.resetCost()} onYes={() => setMsg(g.resetTalents() ? 'Talentos reiniciados.' : 'Ouro insuficiente.')} /></div>
      <div className="card"><b>Ranking</b><div className="muted small">Ranking de aventureiros em breve.</div></div>
    </div>
  );
}
function Temple() {
  const g = useGame();
  return (
    <div className="stack">
      <div className="card"><b>Bênção do Templo</b><div className="muted small">Aqui você está seguro. Ao morrer em combate você reaparece sozinho após alguns segundos.</div></div>
      <div className="card"><b>Renascimento</b> <span className="muted">(Nv 100+)</span>
        <div className="muted small">Reinicia o nível da classe ativa e concede bônus permanentes a todas as classes: +6% dano, +6% HP, +10% XP, +8% ouro por renascimento. Renascimentos: <b>{g.save.rebirths}</b></div>
        <ConfirmBtn label="Renascer" confirm="Tem certeza? Nível volta a 1" cls="btn small" disabled={!g.canPrestige()} onYes={() => g.prestige()} />
        {!g.canPrestige() && <div className="muted small">Disponível a partir do nível 100 (atual: {g.level}).</div>}</div>
    </div>
  );
}
