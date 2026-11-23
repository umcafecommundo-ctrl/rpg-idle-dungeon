import { useEffect, useState } from 'react';
import { EVENTS } from '../data/events';
import { MAP_BY_ID } from '../data/maps';
import { MOB_BY_ID } from '../data/mobs';
import { KIND_LABEL } from '../data/types';
import { fmt } from '../engine/formulas';
import { game } from '../engine/game';
import { useGame } from './hooks';

const mmss = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const Bar = ({ v, col = '#e8c040', label }: { v: number; col?: string; label?: string }) => <div className="pbar"><i style={{ width: `${Math.min(100, v * 100)}%`, background: col }} />{label && <span>{label}</span>}</div>;
const modText = (m: Record<string, unknown>) => Object.entries(m).map(([k, v]) => `+${+((v as number) * 100).toFixed(1)}% ${({ atkPct: 'dano', hpPct: 'HP', defPct: 'DEF', bossDmg: 'dano em chefes', goldPct: 'ouro', xpPct: 'XP', dropPct: 'drops', regen: 'regen/s' } as Record<string, string>)[k] ?? k}`).join(', ');

export function MetasPanel() {
  const g = useGame(); const [tab, setTab] = useState('daily');
  useEffect(() => { if (tab === 'notes') game.markNotesRead(); }, [tab]);
  const unread = g.unreadNotes();
  return (
    <div className="stack">
      <div className="chips">
        {([['daily', 'Diárias'], ['events', 'Eventos'], ['ach', 'Conquistas'], ['bes', 'Bestiário'], ['notes', `Avisos${unread ? ` (${unread})` : ''}`]] as const).map(([id, l]) => (
          <button key={id} className={'chip' + (tab === id ? ' on' : '')} onClick={() => setTab(id)}>{l}</button>
        ))}
      </div>
      {tab === 'daily' && <Daily />}
      {tab === 'events' && <Events />}
      {tab === 'ach' && <Achievements />}
      {tab === 'bes' && <Bestiary />}
      {tab === 'notes' && <Notes />}
    </div>
  );
}

function Daily() {
  const g = useGame(); const d = g.meta.daily; const tc = g.timerChest();
  const login = EVENTS.daily.login;
  return (
    <>
      <div className="card">
        <div className="row"><b>Sequência de login</b><span className="grow" /><span className="muted small">Dia {d.streak} de 7</span></div>
        <div className="days">
          {login.map((l) => (
            <div key={l.day} className={'day' + (l.day === d.streak ? ' now' : '') + (l.day < d.streak || (l.day === d.streak && d.loginClaimed) ? ' done' : '')} title={l.text}>
              <b>{l.day}</b><small>{l.day === 7 ? '🎁' : '•'}</small>
            </div>
          ))}
        </div>
        <div className="muted small">Hoje: {login[(d.streak - 1) % 7]?.text}</div>
        <button className={'btn' + (!d.loginClaimed ? ' rec' : '')} disabled={d.loginClaimed} onClick={() => g.claimLogin()}>{d.loginClaimed ? 'Prêmio de hoje já recebido' : 'Resgatar prêmio do dia'}</button>
      </div>
      <div className="card">
        <b>Baú do cristal</b>
        <div className="muted small">Enche a cada {EVENTS.timerChest.intervalMin} min (acumula até {EVENTS.timerChest.maxStack}), mesmo com o jogo fechado.</div>
        {tc.count > 0 ? <button className="btn rec" onClick={() => g.claimTimerChest()}>Abrir {tc.count > 1 ? `${tc.count} baús` : 'baú'}</button> : <div className="row"><span className="muted small">Próximo em</span><b>{mmss(tc.readyIn)}</b></div>}
        {tc.count === 0 && <Bar v={1 - tc.readyIn / (EVENTS.timerChest.intervalMin * 60e3)} col="#6ac8ff" />}
      </div>
      <b>Missões diárias</b>
      {d.missions.map((m, i) => {
        const ready = m.progress >= m.n && !m.claimed;
        return (
          <div key={i} className={'card' + (m.claimed ? ' lockd' : '')}>
            <div className="row"><b className="grow">{m.title}</b>{m.claimed ? <span className="up">✔</span> : <span className="muted small">{m.progress}/{m.n}</span>}</div>
            <Bar v={m.progress / m.n} col={ready ? '#6ae08a' : '#e8c040'} />
            <div className="row"><span className="muted small grow">Recompensa: {rewardText(m.reward)}</span>
              <button className={'btn small' + (ready ? ' rec' : '')} disabled={!ready} onClick={() => g.claimMission(i)}>Resgatar</button></div>
          </div>
        );
      })}
      <div className="card"><b>Baú diário</b><div className="muted small">Complete as {d.missions.length} missões para abrir: {rewardText(EVENTS.daily.chest)}.</div>
        <button className={'btn' + (g.dailyChestReady() ? ' rec' : '')} disabled={!g.dailyChestReady()} onClick={() => g.claimDailyChest()}>{d.chestClaimed ? 'Já aberto hoje' : 'Abrir baú diário'}</button></div>
    </>
  );
}
function rewardText(r: import('../data/events').Reward) {
  const p: string[] = []; if (r.goldLv) p.push('ouro'); if (r.gold) p.push(`${r.gold} ouro`); if (r.gems) p.push(`${r.gems}💎`); if (r.hp) p.push(`${r.hp} poção HP`); if (r.mp) p.push(`${r.mp} poção MP`); if (r.cons) p.push('elixires'); if (r.item) p.push(r.item === 'tier2' ? 'item raro/épico' : 'item');
  return p.join(' + ');
}

function Events() {
  const g = useGame(); const ev = g.meta.events; const now = Date.now(); const wb = g.weekendLabel(); const w = ev.wanderer;
  return (
    <>
      {wb && <div className="card glowc"><b>🎉 {wb}</b><div className="muted small">Bônus ativo agora em todas as caçadas.</div></div>}
      <div className="card"><b>⚔ Invasão</b>
        {g.invasionState() ? <div className="hl">Em andamento! {g.invasionState()!.killed}/{g.invasionState()!.total}</div> : <div className="muted small">{g.level < EVENTS.invasion.minLevel ? `Disponível a partir do nível ${EVENTS.invasion.minLevel}.` : `Próxima invasão em cerca de ${mmss(Math.max(0, ev.nextInvasion - now))} (se estiver caçando).`}</div>}
      </div>
      <div className="card"><b>👹 Chefe errante</b>
        {w ? (<>
          <div className="hl">{EVENTS.wanderingBoss.byMap[w.mapId]?.text}</div>
          <div className="muted small">Restam {mmss(w.until - now)} · Mapa: {MAP_BY_ID[w.mapId].name} · {MOB_BY_ID[w.id]?.name}</div>
          {g.save.mapId !== w.mapId && <button className="btn small rec" onClick={() => g.travel(w.mapId)}>Ir até lá</button>}
          {g.save.mapId === w.mapId && !w.spawned && <div className="muted small">Ele aparece em instantes…</div>}
        </>) : <div className="muted small">{g.level < EVENTS.wanderingBoss.minLevel ? `Disponível a partir do nível ${EVENTS.wanderingBoss.minLevel}.` : `Nenhum no momento. Próximo em cerca de ${mmss(Math.max(0, ev.nextWanderer - now))}.`}</div>}
      </div>
      <div className="card"><b>🟡 Mob dourado</b><div className="muted small">{Math.round(EVENTS.goldenMob.chance * 100)}% de chance por monstro a partir do nível {EVENTS.goldenMob.minLevel}. Ele foge — pegue-o para ganhar muito ouro! Capturados: {g.meta.extra.golden}.</div></div>
      <b>Calendário</b>
      <div className="list">{EVENTS.calendar.map((c) => <div key={c.what} className="card"><div className="row"><b className="small hl">{c.when}</b></div><div className="small">{c.what}</div></div>)}</div>
    </>
  );
}

function Achievements() {
  const g = useGame(); const m = g.meta;
  return (
    <>
      <div className="card"><div className="row"><span>Título atual:</span><b className="hl">{m.title || '—'}</b></div><div className="muted small">Conquistas dão títulos e pequenos bônus permanentes. {m.ach.length}/{EVENTS.achievements.length}</div></div>
      {EVENTS.achievements.map((a) => {
        const done = m.ach.includes(a.id); const v = Math.min(a.n, g.statValue(a.stat));
        return (
          <div key={a.id} className={'card' + (done ? '' : ' dim')}>
            <div className="row"><b className="grow">{done ? '🏆' : '🔒'} {a.title}</b>{done && m.title !== a.title && <button className="btn small" onClick={() => { m.title = a.title; g.emit(); }}>Usar título</button>}</div>
            <div className="muted small">{a.desc} · Bônus: {modText(a.mods as Record<string, unknown>)}</div>
            {!done && <Bar v={v / a.n} label={`${fmt(v)}/${fmt(a.n)}`} />}
          </div>
        );
      })}
    </>
  );
}

function Bestiary() {
  const g = useGame(); const B = EVENTS.bestiary;
  const list = g.bestiaryList().filter((d, i, a) => a.findIndex((x) => x.id === d.id) === i);
  return (
    <>
      <div className="muted small">Cada espécie completa (normais: {B.completeKills} abates; chefes: {B.completeKillsBoss}) dá +{Math.round(B.bonusPerEntry * 100)}% de dano contra o tipo dela (chefes +{Math.round(B.bonusPerBoss * 100)}%). Completos: {g.bestiaryCompleted()}/{list.length}.</div>
      {list.map((d) => {
        const k = g.meta.bestiary[d.id] ?? 0; const need = d.boss ? B.completeKillsBoss : B.completeKills; const done = k >= need;
        return (
          <div key={d.id} className={'card' + (k ? '' : ' dim')}>
            <div className="row"><b className="grow">{k ? d.name : '???'}</b><span className="muted small">{k ? KIND_LABEL[d.kind] : 'desconhecido'}{d.boss ? ' · chefe' : ''}</span>{done && <span className="up">✔</span>}</div>
            <Bar v={Math.min(1, k / need)} col={done ? '#6ae08a' : '#9ad0ff'} label={`${Math.min(k, need)}/${need}`} />
            {done && <div className="small up">+{Math.round((d.boss ? B.bonusPerBoss : B.bonusPerEntry) * 100)}% dano vs {KIND_LABEL[d.kind]}</div>}
          </div>
        );
      })}
    </>
  );
}

function Notes() {
  const g = useGame();
  return (
    <>
      {g.meta.notes.length === 0 && <div className="muted">Nenhum aviso ainda. Eventos, chefes errantes e conquistas aparecem aqui.</div>}
      {g.meta.notes.map((n) => <div key={n.id} className="card"><div className="small">{n.text}</div><div className="muted small">{new Date(n.t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div></div>)}
    </>
  );
}
