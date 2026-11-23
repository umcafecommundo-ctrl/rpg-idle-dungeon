import { useEffect, useRef, useState } from 'react';
import { INTRO, INTRO_LENGTH } from '../data/onboarding';
import { audio } from '../audio/audio';
import { Town } from '../engine/town';
import { TownScene } from '../render/townscene';
import { spriteFor } from '../render/sprites';

/** Abertura animada (~40 s, pulável): a cidade é atacada, o herói cai e deixa um cristal. Reaproveita o renderizador da cidade. */
export function Intro({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [cap, setCap] = useState({ i: 0, n: 0 });
  const doneRef = useRef(onDone); doneRef.current = onDone;
  useEffect(() => {
    const cv = ref.current!; const g = cv.getContext('2d')!;
    const scene = new TownScene(); const town = new Town(); town.walkers.forEach((w) => { w.wait = 99; });
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => { const r = cv.getBoundingClientRect(); cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); };
    resize(); window.addEventListener('resize', resize);
    const t0 = performance.now(); let raf = 0, lastCap = -1, sfxDone = false;
    const hero = spriteFor('class:cavaleiro', '');
    const parts = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), s: 0.3 + Math.random() }));
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const t = (now - t0) / 1000; const W = cv.width, H = cv.height;
      let si = 0; INTRO.forEach((s, i) => { if (t >= s.t) si = i; });
      const sc = INTRO[si], lt = t - sc.t;
      const n = Math.floor(lt * 28); if (si * 1000 + Math.min(n, 200) !== lastCap) { lastCap = si * 1000 + Math.min(n, 200); setCap({ i: si, n }); }
      if (sc.kind === 'attack' && !sfxDone) { sfxDone = true; audio.sfx('boss'); }
      const S = W / (14 * 16);
      const night = sc.kind === 'town' ? Math.min(0.5, 0.1 + lt * 0.06) : sc.kind === 'awake' ? Math.max(0, 0.7 - lt * 0.15) : 0.95;
      const px = 10, py = 15.5;
      const T = { ox: -(px - 7) * 16 * S, oy: -(py - H / S / 16 / 2) * 16 * S, S, W, H, dpr };
      g.save();
      if (sc.kind === 'attack') { const k = 5 * dpr; g.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k); }
      g.imageSmoothingEnabled = false;
      scene.draw(g, T, town, now, () => { /* sem jogador */ }, night);
      g.restore();
      // ───── camadas por cena ─────
      if (sc.kind === 'attack') {
        g.fillStyle = `rgba(14,0,24,${Math.min(0.62, lt * 0.2)})`; g.fillRect(0, 0, W, H); g.fillStyle = `rgba(190,10,20,${0.16 + 0.1 * Math.sin(t * 6)})`; g.fillRect(0, 0, W, H);
        const rise = Math.min(1, lt / 3); const bx = W / 2, by = H * (0.05 + (1 - rise) * 0.5), u = S * 1.3 * (0.6 + rise * 0.6);
        drawBoss(g, bx, by + 60 * u, u, t);
        if (Math.sin(t * 9) > 0.93) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(0, 0, W, H); }
        g.fillStyle = '#ff8030'; for (const p of parts) { const yy = ((p.y + t * 0.3 * p.s) % 1) * H; g.fillRect(p.x * W + Math.sin(t + p.x * 9) * 8, yy, 3 * dpr, 3 * dpr); }
      }
      if (sc.kind === 'fall') {
        g.fillStyle = 'rgba(8,4,16,0.55)'; g.fillRect(0, 0, W, H);
        const f = Math.min(1, lt / 4); const u = S * 6;
        g.save(); g.translate(W / 2, H * 0.58 + f * 14 * S); g.rotate(-0.15 - f * 1.1 * (f > 0.5 ? 1 : f * 2)); g.drawImage(hero, -8 * u / 4 * 2, -14 * u / 4 * 2, 16 * u / 4 * 2, 16 * u / 4 * 2); g.restore();
        g.fillStyle = 'rgba(255,60,40,0.5)'; for (const p of parts.slice(0, 15)) g.fillRect(p.x * W, ((p.y + t * 0.1) % 1) * H, 2 * dpr, 2 * dpr);
      }
      if (sc.kind === 'crystal' || sc.kind === 'awake') {
        const cx = W / 2, base = H * 0.62; let cy = base;
        if (sc.kind === 'crystal') { const k = Math.min(1, lt / 3); cy = base - Math.abs(Math.sin(k * Math.PI * 2.5)) * (1 - k) * H * 0.25 - (1 - k) * H * 0.1; g.fillStyle = 'rgba(8,4,16,0.6)'; g.fillRect(0, 0, W, H); }
        else { g.fillStyle = `rgba(8,12,30,${0.3})`; g.fillRect(0, 0, W, H); cy = H * 0.7; }
        const pulse = 0.6 + 0.4 * Math.sin(t * 4);
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, H * 0.35); gr.addColorStop(0, `rgba(120,230,255,${0.55 * pulse})`); gr.addColorStop(1, 'rgba(120,230,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
        const u = S * (sc.kind === 'awake' ? 5 : 3.5);
        g.fillStyle = '#7ae8ff'; g.beginPath(); g.moveTo(cx, cy - 9 * u); g.lineTo(cx + 5 * u, cy - 2 * u); g.lineTo(cx + 3 * u, cy + 7 * u); g.lineTo(cx - 3 * u, cy + 7 * u); g.lineTo(cx - 5 * u, cy - 2 * u); g.closePath(); g.fill();
        g.fillStyle = '#d8fbff'; g.beginPath(); g.moveTo(cx, cy - 9 * u); g.lineTo(cx - 2 * u, cy - 2 * u); g.lineTo(cx - 3 * u, cy + 7 * u); g.lineTo(cx - 1 * u, cy + 2 * u); g.closePath(); g.fill();
        g.fillStyle = '#2a8ab0'; g.beginPath(); g.moveTo(cx + 5 * u, cy - 2 * u); g.lineTo(cx + 3 * u, cy + 7 * u); g.lineTo(cx + 1 * u, cy + 1 * u); g.closePath(); g.fill();
        g.fillStyle = '#bff6ff'; for (const p of parts) { const yy = H - ((p.y + t * 0.12 * p.s) % 1) * H; g.fillRect(cx + (p.x - 0.5) * W * 0.8, yy, 2 * dpr, 2 * dpr); }
        if (sc.kind === 'awake') { g.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - lt / 2.2)})`; g.fillRect(0, 0, W, H); }
      }
      // transição entre cenas
      if (lt < 0.5 && si > 0) { g.fillStyle = `rgba(0,0,0,${1 - lt / 0.5})`; g.fillRect(0, 0, W, H); }
      if (t > INTRO_LENGTH - 1) { g.fillStyle = `rgba(0,0,0,${Math.min(1, t - (INTRO_LENGTH - 1))})`; g.fillRect(0, 0, W, H); }
      if (t >= INTRO_LENGTH) { cancelAnimationFrame(raf); doneRef.current(); }
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  const sc = INTRO[cap.i];
  return (
    <div className="intro">
      <canvas ref={ref} className="introcv" />
      <div className="cap"><span>{sc.text.slice(0, cap.n)}</span></div>
      <button className="skip" onClick={onDone}>Pular ▸▸</button>
    </div>
  );
}

function drawBoss(g: CanvasRenderingContext2D, cx: number, cy: number, u: number, t: number) {
  g.save(); g.translate(cx, cy);
  g.fillStyle = '#0c0614';
  g.beginPath(); g.moveTo(-26 * u, 40 * u); g.lineTo(-30 * u, -10 * u); g.lineTo(-14 * u, -26 * u); g.lineTo(14 * u, -26 * u); g.lineTo(30 * u, -10 * u); g.lineTo(26 * u, 40 * u); g.closePath(); g.fill();
  g.beginPath(); g.arc(0, -34 * u, 14 * u, 0, 7); g.fill();
  g.beginPath(); g.moveTo(-12 * u, -42 * u); g.lineTo(-26 * u, -66 * u); g.lineTo(-6 * u, -46 * u); g.fill();
  g.beginPath(); g.moveTo(12 * u, -42 * u); g.lineTo(26 * u, -66 * u); g.lineTo(6 * u, -46 * u); g.fill();
  g.strokeStyle = 'rgba(255,40,60,0.7)'; g.lineWidth = 2 * u; g.beginPath(); g.moveTo(-30 * u, -10 * u); g.lineTo(-14 * u, -26 * u); g.lineTo(14 * u, -26 * u); g.lineTo(30 * u, -10 * u); g.stroke();
  const e = 0.7 + 0.3 * Math.sin(t * 5); g.fillStyle = `rgba(255,50,40,${e})`; g.fillRect(-9 * u, -36 * u, 6 * u, 3 * u); g.fillRect(3 * u, -36 * u, 6 * u, 3 * u);
  g.restore();
}
