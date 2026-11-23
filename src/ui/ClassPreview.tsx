import { useEffect, useRef } from 'react';
import { spriteFor, tintOf } from '../render/sprites';

type G = CanvasRenderingContext2D;
/** Prévia animada (96×64) de cada classe lutando, mostrando seu estilo. */
function draw(g: G, id: string, t: number) {
  g.imageSmoothingEnabled = false; g.clearRect(0, 0, 96, 64);
  g.fillStyle = '#272033'; g.fillRect(0, 0, 96, 64);
  for (let x = 0; x < 96; x += 16) for (let y = 16; y < 64; y += 16) { g.fillStyle = (x + y) % 32 ? '#2e2640' : '#2a223a'; g.fillRect(x, y, 16, 16); }
  g.fillStyle = '#1a1424'; g.fillRect(0, 0, 96, 14);
  const hero = spriteFor('class:' + id, ''), rat = spriteFor('rato', '#8a7a6a'), sk = spriteFor('esqueleto', '#d8d8c0');
  const put = (img: HTMLCanvasElement, x: number, y: number, flip = false, a = 1) => { g.save(); g.globalAlpha = a; g.translate(x, y); g.scale(flip ? -1 : 1, 1); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-5, -1, 10, 2); g.drawImage(img, -8, -15); g.restore(); };
  const ring = (x: number, y: number, r: number, c: string, a = 1) => { g.globalAlpha = a; g.strokeStyle = c; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, y - 5, r, r * 0.6, 0, 0, 7); g.stroke(); g.globalAlpha = 1; };
  const dot = (x: number, y: number, c: string, s = 2) => { g.fillStyle = c; g.fillRect(x - s / 2, y - s / 2, s, s); };
  const p = t % 4, Y = 46;
  if (id === 'cavaleiro') {
    put(hero, 48, Y);
    for (const sd of [-1, 1]) { const k = Math.min(1, (p / 2.4)); const x = 48 + sd * (42 - 28 * k); put(rat, x, Y, sd > 0); }
    if (p > 2.4 && p < 3.2) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(48, Y - 8, 14, p * 8, p * 8 + 2.5); g.stroke(); }
    if (p > 0.2 && p < 1) ring(48, Y, 10 + (p - 0.2) * 40, '#ff9a5a', 1 - (p - 0.2));
    g.fillStyle = '#8fb4ff'; g.fillRect(6, 6, 16, 3);
  } else if (id === 'barbaro') {
    const hx = 48 + Math.sin(t * 1.5) * 14; put(hero, hx, Y, Math.cos(t * 1.5) < 0);
    for (let i = 0; i < 3; i++) { const a = (t * 0.8 + i * 2.1) % 3; put(rat, 14 + i * 34, Y - 4 + Math.sin(a) * 2, i % 2 === 0, a > 2.4 ? 0.3 : 1); }
    g.strokeStyle = '#ffb070'; g.lineWidth = 2; g.beginPath(); g.arc(hx, Y - 8, 13, t * 9, t * 9 + 2.2); g.stroke();
    if (Math.sin(t * 5) > 0.6) dot(hx + 12, Y - 20, '#e03030', 3);
  } else if (id === 'arqueiro') {
    const hx = 70 - (p * 12); put(hero, hx, Y, true);
    put(rat, hx + 26 - Math.sin(p * 1.5) * 3, Y, false);
    for (let i = 0; i < 2; i++) { const q = ((t * 1.6 + i * 0.5) % 1); dot(hx + 6 + q * 20, Y - 8 + (i ? 2 : -1), '#d8f0a0', 3); }
    g.fillStyle = '#7fe070'; g.fillRect(6, 6, 16, 3); dot(hx + 4, Y + 1, 'rgba(255,255,255,0.5)', 2);
  } else if (id === 'mago') {
    put(hero, 24, Y);
    const k = Math.min(1, p / 2.5);
    for (const [ox, oy] of [[0, 0], [8, -5], [8, 5], [16, 0]]) put(rat, 82 - 14 * k + ox - 12, Y + oy, true, p > 3.1 ? 0.35 : 1);
    if (p > 1 && p < 1.8) { const q = (p - 1) / 0.8; dot(26 + q * 46, Y - 14 - Math.sin(q * Math.PI) * 10, '#ff8a3d', 4); }
    if (p > 1.8 && p < 2.6) { ring(74, Y, (p - 1.8) * 30, '#ff8a3d', 1 - (p - 1.8) / 0.8); dot(74 + Math.cos(p * 20) * 8, Y - 8 + Math.sin(p * 20) * 5, '#ffe080', 3); }
  } else if (id === 'clerigo') {
    put(spriteFor('class:cavaleiro', ''), 58, Y); put(hero, 30, Y); put(sk, 88 - 6 * Math.min(1, p / 3), Y, true);
    const hp = 0.55 + 0.35 * Math.abs(Math.sin(p * 0.8)); g.fillStyle = '#000'; g.fillRect(50, Y - 24, 18, 3); g.fillStyle = '#e83a3a'; g.fillRect(50, Y - 24, 18 * hp, 3);
    if (p > 1 && p < 2.2) for (let i = 0; i < 3; i++) { const q = (p - 1) / 1.2; g.fillStyle = '#6aff8a'; g.fillRect(52 + i * 6, Y - 26 - q * 10, 1, 4); g.fillRect(50.5 + i * 6, Y - 24.5 - q * 10, 4, 1); }
    if (p > 2.4 && p < 3.2) { g.fillStyle = 'rgba(255,243,160,0.7)'; g.fillRect(84, 14, 5, Y - 14); }
  } else {
    put(hero, 22, Y);
    const a = Math.min(1, Math.max(0, (p - 0.4) / 0.6)); const jig = Math.sin(t * 8) * 1;
    if (p > 0.4) { put(tintOf(sk, 'pv1', '#40ffb0'), 46 + (p > 2 ? 14 : 0) + jig, Y + 3, false, a); put(tintOf(sk, 'pv2', '#40ffb0'), 40 + (p > 2 ? 14 : 0), Y - 6, false, a); }
    ring(46, Y, 12 * (1 - a) + 4, '#8affc8', 1 - a);
    put(rat, 84, Y, true);
    if (p > 2.2) for (let i = 0; i < 2; i++) dot(58 + ((t * 40 + i * 10) % 22), Y - 6 + i * 3, '#b46bff', 3);
  }
}

export function ClassPreview({ id }: { id: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current!.getContext('2d')!; let raf = 0, last = 0; const t0 = performance.now();
    const loop = (now: number) => { raf = requestAnimationFrame(loop); if (now - last < 40) return; last = now; draw(g, id, (now - t0) / 1000); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [id]);
  return <canvas ref={ref} width={96} height={64} className="cprev" />;
}
