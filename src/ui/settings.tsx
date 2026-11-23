import { useState } from 'react';
import { CLASSES } from '../data/classes';
import { MOBS } from '../data/mobs';
import { ACTIVITIES, ACTIVITY_LABEL, RARITIES, RARITY_COLOR, RARITY_LABEL } from '../data/types';
import { game, type OfflineSummary } from '../engine/game';
import { fmt } from '../engine/formulas';
import { describeMods } from '../engine/loot';
import { duelTable, runBalance } from '../engine/sim';
import { useGame } from './hooks';
import { CLASS_AI, type AiWeights } from '../data/ai';

export function OfflineModal({ s, onClose }: { s: OfflineSummary; onClose: () => void }) {
  const h = Math.floor(s.secs / 3600), m = Math.floor((s.secs % 3600) / 60);
  return (
    <div className="modal">
      <div className="mbox">
        <h2>Enquanto você esteve fora…</h2>
        <div className="muted">{h > 0 ? `${h}h ` : ''}{m}min {s.capped && '(limite de 8h atingido)'}</div>
        <ul className="sum">
          <li>+<b>{fmt(s.xp)}</b> XP</li>
          <li>+<b>{fmt(s.gold + s.sellGold)}</b> ouro</li>
          <li><b>{fmt(s.kills)}</b> monstros derrotados</li>
          {s.toLevel > s.fromLevel && <li>Nível <b>{s.fromLevel}</b> → <b className="hl">{s.toLevel}</b></li>}
          {s.deaths >= 1 && <li>{Math.round(s.deaths)} mortes (tempo perdido já descontado)</li>}
          <li>Itens: {RARITIES.map((r) => s.items[r] > 0 && <span key={r} style={{ color: RARITY_COLOR[r], marginRight: 8 }}>{s.items[r]} {RARITY_LABEL[r]}</span>)}
            {RARITIES.every((r) => !s.items[r]) && <span className="muted">nenhum</span>}</li>
          {s.best && <li>Melhor item: <b style={{ color: RARITY_COLOR[s.best.rarity] }}>{s.best.name}</b> <span className="muted small">({describeMods(s.best.mods, (k) => k).slice(0, 2).join(', ')})</span></li>}
        </ul>
        {s.gift && <div className="card"><b className="hl">🎁 {s.gift}</b></div>}
        <div className="muted small">Ganhos offline têm 85% da eficiência normal. Itens comuns são vendidos automaticamente (configurável).</div>
        <button className="btn" onClick={onClose}>Continuar</button>
      </div>
    </div>
  );
}

export function SettingsPanel() {
  const g = useGame(); const st = g.save.settings;
  const [exp, setExp] = useState(''); const [imp, setImp] = useState(''); const [msg, setMsg] = useState(''); const [dbg, setDbg] = useState(false);
  const [cfm, setCfm] = useState(false);
  return (
    <div className="stack">
      <div className="card">
        <b>Poções automáticas</b>
        <label className="row check"><input type="checkbox" checked={st.autoPot} onChange={(e) => g.setSettings({ autoPot: e.target.checked })} /> Usar automaticamente</label>
        <div className="row"><span>HP abaixo de <b>{Math.round(st.hpTh * 100)}%</b></span><input type="range" min={10} max={90} step={5} value={st.hpTh * 100} onChange={(e) => g.setSettings({ hpTh: +e.target.value / 100 })} /></div>
        <div className="row"><span>MP abaixo de <b>{Math.round(st.mpTh * 100)}%</b></span><input type="range" min={5} max={90} step={5} value={st.mpTh * 100} onChange={(e) => g.setSettings({ mpTh: +e.target.value / 100 })} /></div>
      </div>
      <div className="card">
        <label className="row check"><input type="checkbox" checked={st.sound} onChange={(e) => g.setSettings({ sound: e.target.checked })} /> <b>Música e sons ambientes</b></label>
      </div>
      <div className="card">
        <b>Venda automática de drops</b>
        <div className="row">
          <select value={st.autoSell} onChange={(e) => g.setSettings({ autoSell: e.target.value as typeof st.autoSell })}>
            <option value="none">Nunca</option><option value="comum">Comuns (piores que o equipado)</option><option value="raro">Até raros (piores que o equipado)</option>
          </select>
        </div>
      </div>
      <div className="card">
        <b>Save</b>
        <div className="muted small">Salvo automaticamente a cada 10s e ao sair da página.</div>
        <div className="row"><button className="btn small" onClick={() => { g.persist(); setMsg('Salvo.'); }}>Salvar agora</button>
          <button className="btn small" onClick={() => setExp(g.exportText())}>Exportar</button></div>
        {exp && <><textarea readOnly value={exp} rows={3} onFocus={(e) => e.currentTarget.select()} />
          <button className="btn small" onClick={() => { navigator.clipboard?.writeText(exp).then(() => setMsg('Copiado!'), () => setMsg('Selecione e copie manualmente.')); }}>Copiar</button></>}
        <textarea value={imp} onChange={(e) => setImp(e.target.value)} placeholder="Cole aqui um save para importar" rows={3} />
        <button className="btn small" disabled={!imp.trim()} onClick={() => { try { g.importText(imp); setMsg('Save importado!'); setImp(''); } catch { setMsg('Save inválido.'); } }}>Importar</button>
        {msg && <div className="muted small">{msg}</div>}
      </div>
      <div className="card">
        <label className="row check"><input type="checkbox" checked={st.ai} onChange={(e) => g.setSettings({ ai: e.target.checked })} /> <b>IA de posicionamento</b> (kiting, anti-encurralamento)</label>
        <label className="row check"><input type="checkbox" checked={g.debugAi} onChange={(e) => g.setDebugAi(e.target.checked)} /> Mostrar debug da IA (heatmap, caminho, alcance)</label>
        {g.debugAi && <AiTuner />}
      </div>
      <div className="card">
        <button className="btn small" onClick={() => setDbg(!dbg)}>{dbg ? 'Fechar' : 'Abrir'} tela de debug / balanceamento</button>
        {dbg && <BalanceDebug />}
      </div>
      <div className="card">
        {!cfm ? <button className="btn small danger" onClick={() => setCfm(true)}>Apagar save</button>
          : <div className="row"><span>Apagar tudo?</span><button className="btn small danger" onClick={() => game.hardReset()}>Sim, apagar</button><button className="btn small" onClick={() => setCfm(false)}>Não</button></div>}
      </div>
    </div>
  );
}

type Bal = ReturnType<typeof runBalance>;
function BalanceDebug() {
  const g = useGame();
  const [lv, setLv] = useState(g.level); const [secs, setSecs] = useState(45);
  const [res, setRes] = useState<Bal | null>(null); const [duel, setDuel] = useState<ReturnType<typeof duelTable> | null>(null);
  const [busy, setBusy] = useState(false); const [full, setFull] = useState(false);
  const run = () => {
    setBusy(true);
    setTimeout(() => { setRes(runBalance(lv, secs)); setDuel(duelTable(lv, secs)); setBusy(false); }, 30);
  };
  return (
    <div className="debug">
      <div className="muted small">Simula as 6 classes (auto-alocação, talentos automáticos, sem equipamentos) em cada cenário = atividade × espécie de mob. Ranking por XP/min (já inclui mortes).</div>
      <div className="row"><span>Nível</span><input type="number" min={1} max={200} value={lv} onChange={(e) => setLv(Math.max(1, Math.min(200, +e.target.value || 1)))} />
        <span>Segundos</span><input type="number" min={20} max={180} value={secs} onChange={(e) => setSecs(Math.max(20, Math.min(180, +e.target.value || 45)))} />
        <button className="btn small" onClick={run} disabled={busy}>{busy ? 'Simulando…' : 'Rodar'}</button></div>
      {res && (
        <>
          <div className={'verdict ' + (res.ok ? 'ok' : 'bad')}>Regra “cada classe no top 2 de ≥2 cenários e última em ≥1”: {res.ok ? 'ATENDIDA' : 'NÃO atendida'} ({res.scenarios.length} cenários)</div>
          <div className="scroll"><table className="dt">
            <thead><tr><th>Classe</th><th>Top2</th><th>Últ.</th><th>Vit.</th>{ACTIVITIES.map((a) => <th key={a}>{ACTIVITY_LABEL[a].slice(0, 6)}</th>)}</tr></thead>
            <tbody>{CLASSES.map((c) => (
              <tr key={c.id}><td style={{ color: c.color }}>{c.name}</td><td>{res.stats[c.id].top2}</td><td>{res.stats[c.id].last}</td><td>{res.stats[c.id].wins}</td>
                {ACTIVITIES.map((a) => { const best = Math.max(...CLASSES.map((k) => res.perActivity[a][k.id])); const v = res.perActivity[a][c.id]; return <td key={a} className={v === best ? 'best' : ''}>{fmt(v)}</td>; })}</tr>
            ))}</tbody></table></div>
          <div className="muted small">XP/min médio por atividade (média sobre as 10 espécies).</div>
          {duel && (<>
            <b>Duelo solo — DPS / TTK(s) / dano recebido por abate</b>
            <div className="scroll"><table className="dt">
              <thead><tr><th>Mob</th>{CLASSES.map((c) => <th key={c.id} style={{ color: c.color }}>{c.name.slice(0, 4)}</th>)}</tr></thead>
              <tbody>{duel.map((d) => (
                <tr key={d.mobId}><td>{MOBS.find((m) => m.id === d.mobId)!.name.split(' ')[0]}</td>
                  {d.row.map((c) => <td key={c.classId}>{fmt(c.dps)}<br /><small>{c.ttk.toFixed(1)}s · {fmt(c.dmgPerKill)}</small></td>)}</tr>
              ))}</tbody></table></div></>)}
          <button className="link" onClick={() => setFull(!full)}>{full ? 'Ocultar' : 'Mostrar'} ranking de todos os cenários</button>
          {full && <div className="scroll"><table className="dt">
            <thead><tr><th>Cenário</th><th>1º</th><th>2º</th><th>Último</th></tr></thead>
            <tbody>{Object.entries(res.rank).map(([k, r]) => { const nm = (id: string) => CLASSES.find((c) => c.id === id)!.name.slice(0, 5); return <tr key={k}><td>{k}</td><td>{nm(r[0])}</td><td>{nm(r[1])}</td><td>{nm(r[5])}</td></tr>; })}</tbody></table></div>}
        </>
      )}
    </div>
  );
}

const W_LABEL: Record<keyof AiWeights, string> = { ideal: 'Distância ideal', range: 'Fora do alcance', los: 'Linha de visão', melee: 'Medo de corpo a corpo', near: 'Excesso de mobs', open: 'Espaço livre', routes: 'Rotas de fuga', corner: 'Cantos/becos', danger: 'Área de perigo', center: 'Longe do centro', move: 'Custo de mover', stay: 'Ficar parado', arc: 'Recuo em arco', cover: 'Cobertura' };
function AiTuner() {
  const g = useGame(); const cfg = CLASS_AI[g.save.active]; const [, force] = useState(0);
  const set = (fn: () => void) => { fn(); force((n) => n + 1); };
  return (
    <div className="debug">
      <div className="muted small">Ajuste ao vivo para {g.cls.name} (não é salvo; copie os valores para <code>src/data/ai.ts</code>).</div>
      {([['ideal', 'Distância ideal', 1, 8, 0.1], ['safe', 'Distância de segurança', 0, 6, 0.1], ['maxNear', 'Mobs aceitos perto', 0, 10, 1], ['retreatHp', 'HP mínimo p/ recuar', 0, 1, 0.05], ['minOpen', 'Abertura mínima', 0, 1, 0.05]] as const).map(([k, l, lo, hi, st]) => (
        <div className="row" key={k}><span className="grow small">{l}: <b>{cfg[k]}</b></span><input type="range" min={lo} max={hi} step={st} value={cfg[k]} onChange={(e) => set(() => { cfg[k] = +e.target.value; })} /></div>
      ))}
      {(Object.keys(cfg.w) as (keyof AiWeights)[]).map((k) => (
        <div className="row" key={k}><span className="grow small">{W_LABEL[k]}: <b>{cfg.w[k]}</b></span><input type="range" min={0} max={k === 'danger' ? 80 : 12} step={0.1} value={cfg.w[k]} onChange={(e) => set(() => { cfg.w[k] = +e.target.value; })} /></div>
      ))}
    </div>
  );
}
