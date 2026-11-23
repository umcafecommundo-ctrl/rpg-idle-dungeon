import { useEffect, useRef, useState } from 'react';
import { CLASSES } from '../data/classes';
import { STATS, STAT_LABEL } from '../data/types';
import { game } from '../engine/game';
import { skillMpCost } from '../engine/formulas';
import { iconURL } from '../render/icons';
import { Renderer } from '../render/renderer';
import { useGame } from './hooks';
import { CharacterPanel, InventoryPanel, MapsPanel, SkillsPanel } from './panels';
import { ServiceSheet } from './town';
import { Intro } from './Intro';
import { ClassPreview } from './ClassPreview';
import { CLASS_PREVIEW, VISION, ACTIVITY_MIN_LEVEL } from '../data/onboarding';
import { SERVICES } from '../data/shops';
import { audio } from '../audio/audio';
import { OfflineModal, SettingsPanel } from './settings';
import { spriteFor } from '../render/sprites';

type Tab = 'char' | 'skills' | 'inv' | 'maps' | 'cfg';
const TABS: { id: Tab; label: string; ico: string }[] = [
  { id: 'char', label: 'Personagem', ico: '⚔' }, { id: 'skills', label: 'Skills', ico: '✦' }, { id: 'inv', label: 'Inventário', ico: '🎒' },
  { id: 'maps', label: 'Mapas', ico: '🗺' },
];

export function App() {
  const g = useGame();
  useEffect(() => {
    game.init();
    const iv = setInterval(() => game.emit(), 400);
    const vis = () => { if (document.hidden) game.persist(); };
    const unlock = () => audio.unlock();
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', vis);
    return () => { clearInterval(iv); document.removeEventListener('pointerdown', unlock); document.removeEventListener('visibilitychange', vis); window.removeEventListener('pagehide', vis); };
  }, []);
  const [introDone, setIntroDone] = useState(() => { try { return localStorage.getItem('masmorra-intro') === '1'; } catch { return false; } });
  if (!g.has) {
    if (!introDone) return <Intro onDone={() => { try { localStorage.setItem('masmorra-intro', '1'); } catch { /* */ } setIntroDone(true); }} />;
    return <ClassSelect />;
  }
  return <Main />;
}

function ClassSelect() {
  const [imp, setImp] = useState(false);
  const [txt, setTxt] = useState('');
  const [err, setErr] = useState('');
  return (
    <div className="select">
      <h1>Masmorra Idle</h1>
      <p className="sub">Escolha sua classe — veja cada uma em ação. Você pode trocar depois na Guilda.</p>
      <div className="cards">
        {CLASSES.map((c) => {
          const pv = CLASS_PREVIEW[c.id];
          return (
            <button key={c.id} className="ccard" style={{ borderColor: c.color }} onClick={() => { audio.unlock(); game.newGame(c.id); }}>
              <ClassPreview id={c.id} />
              <div className="cinfo">
                <b style={{ color: c.color }}>{c.name}</b> <span className="role">{c.role}</span>
                <div className="tags">{pv.tags.map((t) => <span key={t} style={{ borderColor: c.color }}>{t}</span>)}</div>
                <div className="cstrong">{pv.best}</div>
                <div className="cbars">{pv.bars.map(([l, v]) => <div key={l}><small>{l}</small><i><b style={{ width: `${v * 20}%`, background: c.color }} /></i></div>)}</div>
              </div>
            </button>
          );
        })}
      </div>
      <button className="link" onClick={() => setImp(!imp)}>Importar save</button>
      {imp && (
        <div className="card">
          <textarea value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Cole o texto do save aqui" rows={4} />
          <button className="btn" onClick={() => { try { game.importText(txt); } catch { setErr('Save inválido.'); } }}>Importar</button>
          {err && <div className="err">{err}</div>}
        </div>
      )}
    </div>
  );
}

function Main() {
  const g = useGame();
  const [tab, setTab] = useState<Tab | null>(null);
  return (
    <div className="app" data-hint={g.activeHint?.h.target ?? ''}>
      <div className="arena">
        <CombatCanvas />
        {!g.vision && !tab && !g.service && <button className="gear" aria-label="Configurações" onClick={() => setTab('cfg')}>⚙</button>}
        {!g.vision && !tab && !g.service && g.scene === 'field' && <button className="homebtn" onClick={() => game.goTown()}>🏠 Voltar à cidade</button>}
        {!g.vision && !tab && !g.service && g.scene === 'field' && <button className={'aibtn' + (g.debugAi ? ' on' : '')} onClick={() => game.setDebugAi(!game.debugAi)}>IA</button>}
        {g.vision && (
          <div className="vision" onClick={() => game.endVision()}>
            <div className="bars top" /><div className="bars bot" />
            <div className="vcap">{VISION.caption}</div><div className="vskip">toque para continuar</div>
          </div>
        )}
        {!g.vision && g.scene === 'field' && g.activeHint && <div className="hintbubble" onClick={() => game.dismissHint()}><b>💡</b> {g.activeHint.h.text}</div>}
        {!g.vision && g.banner && <div className="bannerov"><div className="bt">{g.banner.text}</div><div className="bs">{g.banner.sub}</div></div>}
        {!g.vision && !tab && !g.service && <QuestChip />}
        <div className="toasts">{g.toasts.map((t) => <div key={t.id} className="toast" style={{ color: t.col }}>{t.text}</div>)}</div>
        {g.service && !tab && <ServiceSheet id={g.service} />}
        {tab && (
          <div className="sheet">
            <div className="sheet-h"><b>{tab === 'cfg' ? 'Configurações' : TABS.find((t) => t.id === tab)!.label}</b><button onClick={() => setTab(null)} aria-label="Fechar">✕</button></div>
            <div className="sheet-b">
              {tab === 'char' && <CharacterPanel />}
              {tab === 'skills' && <SkillsPanel />}
              {tab === 'inv' && <InventoryPanel />}
              {tab === 'maps' && <MapsPanel />}
              {tab === 'cfg' && <SettingsPanel />}
            </div>
          </div>
        )}
      </div>
      {g.vision ? null : g.scene === 'town' ? <TownBar /> : <SkillBar />}
      <nav className="nav">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => { game.openService(null); setTab(tab === t.id ? null : t.id); }}>
            <span className="ico">{t.ico}</span><span className="lbl">{t.label}</span>
          </button>
        ))}
        <button className={g.scene === 'town' ? 'on' : ''} onClick={() => { setTab(null); game.openService(null); if (g.scene === 'town') game.goField(); else game.goTown(); }}>
          <span className="ico">{g.scene === 'town' ? '⚔' : '🏠'}</span><span className="lbl">{g.scene === 'town' ? 'Caçar' : 'Cidade'}</span>
        </button>
      </nav>
      {g.surprise && !g.vision && <SurpriseModal />}
      <div className={'fade' + (g.transition && g.transition.phase !== 'in' ? ' show' : '')}>
        {g.transition && <div className="fadebox"><div className="ft">{g.transition.title}</div><div className="fs">{g.transition.sub}</div></div>}
      </div>
      {g.summary && <OfflineModal s={g.summary} onClose={() => { game.summary = null; game.emit(); }} />}
    </div>
  );
}

function CombatCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!; const r = new Renderer(cv);
    r.resize();
    const ro = new ResizeObserver(() => r.resize()); ro.observe(cv);
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      game.update(dt);
      if (game.has) {
        if (game.scene === 'town' && game.town.arrived && !game.service) { const id = game.town.arrived; game.town.arrived = null; game.openService(id); }
        r.draw(game, now);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const down = (e: PointerEvent) => {
      if (game.transition) return;
      if (game.scene === 'town') { if (game.service) return; const p = r.toTown(e.clientX, e.clientY); game.town.tap(p.x, p.y); return; }
      const p = r.toArena(e.clientX, e.clientY); game.battle.focusAt(p.x, p.y);
    };
    cv.addEventListener('pointerdown', down);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); cv.removeEventListener('pointerdown', down); };
  }, []);
  return <canvas ref={ref} className="cv" />;
}

const SLOT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
function SkillBar() {
  const g = useGame();
  const cds = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    let raf = 0, lastT = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - lastT < 60 || !game.has) return; lastT = t;
      const b = game.battle, p = b.player;
      game.cls.skills.forEach((s, i) => {
        const el = cds.current[i]; if (!el) return;
        const tot = s.cd * (1 - Math.min(0.5, p.m.cdr ?? 0));
        const rem = Math.max(0, (p.cd[s.id] ?? 0) - b.t);
        el.style.setProperty('--p', String(tot ? Math.min(1, rem / tot) : 0));
        el.parentElement!.classList.toggle('nomp', p.mp < skillMpCost(s.mp, p.level));
      });
      const hp = cds.current[8], mp = cds.current[9];
      if (hp) hp.style.setProperty('--p', String(b.potCd > 0 ? b.potCd / 6 : 0));
      if (mp) mp.style.setProperty('--p', String(b.potMpCd > 0 ? b.potMpCd / 6 : 0));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const cls = g.cls;
  const slots = Array.from({ length: 10 }, (_, i) => i);
  return (
    <div className="skillbar">
      {slots.map((i) => {
        const s = i < 8 ? cls.skills[i] : null;
        const locked = s && s.lv > g.level;
        const auto = s ? (g.char.skillAuto[s.id] ?? true) : false;
        const icon = s ? iconURL(s.icon, s.col) : iconURL(i === 8 ? 'potion' : 'potionmp', i === 8 ? '#ff5a6a' : '#4a9aff');
        return (
          <button key={i} className={'slot' + (locked ? ' locked' : '')} disabled={!!locked} onClick={() => g.castSlot(i)} title={s ? `${s.name} (MP ${skillMpCost(s.mp, g.level)})` : i === 8 ? 'Poção de HP' : 'Poção de MP'}>
            <img src={icon} alt="" draggable={false} />
            <i className="cd" ref={(el) => { cds.current[i] = el; }} />
            <span className="num">{SLOT_KEYS[i]}</span>
            {locked && <span className="lock">Nv{s!.lv}</span>}
            {s && !locked && <span className={'auto' + (auto ? ' on' : '')} onClick={(e) => { e.stopPropagation(); g.toggleAuto(s.id); }}>A</span>}
            {!s && <span className="cnt">{i === 8 ? g.bag.hp : g.bag.mp}</span>}
          </button>
        );
      })}
    </div>
  );
}

function TownBar() {
  const g = useGame();
  return (
    <div className="townbar">
      <div className="tinfo"><span>Na cidade não há combate nem ganho de XP.</span>
        <button className="btn small" onClick={() => game.goField()}>⚔ Voltar à caçada</button></div>
      <div className="tgrid">
        {SERVICES.map((s) => (
          <button key={s.id} className={'tbtn' + (s.ready ? '' : ' soon')} onClick={() => { game.openService(null); g.town.goTo(s.id); }}>{s.short}</button>
        ))}
      </div>
    </div>
  );
}

function QuestChip() {
  const g = useGame(); const q = g.quest; const ob = g.save.onboard;
  if (!q) {
    if (ob.offlineGift === 'pending') return <div className="quest"><b>⏳</b> Volte em 1h para recolher a recompensa do cristal</div>;
    return null;
  }
  const pr = g.questProgress();
  return (
    <div className="quest">
      <div><b>📜 {q.title}</b>{pr.of > 1 && <span className="qn"> {pr.n}/{pr.of}</span>}</div>
      {pr.of > 1 && <div className="qbar"><i style={{ width: `${(pr.n / pr.of) * 100}%` }} /></div>}
      <div className="qr">→ {q.reward.text}</div>
    </div>
  );
}

function SurpriseModal() {
  return (
    <div className="modal">
      <div className="mbox">
        <h2>Sábio Orion</h2>
        <div>“Então é você quem carrega o fragmento… Ele ainda pulsa. Cada monstro que você vence alimenta o cristal — e o cristal alimenta você.”</div>
        <div className="muted small">O Sábio agora fica perto da fonte. Ele deu a você 1 Essência da Sorte.</div>
        <div className="card"><div><b>⏳ Dica:</b> o cristal continua absorvendo energia enquanto você está fora, caçando. <b>Volte em 1 hora</b> e ele terá uma recompensa para você!</div></div>
        <div className="card"><div><b>🔒 O baú trancado</b> no centro da cidade só se abre no nível 10. Algo poderoso está lá dentro…</div></div>
        <button className="btn" onClick={() => { game.surprise = false; game.persist(); game.emit(); }}>Entendi</button>
      </div>
    </div>
  );
}
void ACTIVITY_MIN_LEVEL;
