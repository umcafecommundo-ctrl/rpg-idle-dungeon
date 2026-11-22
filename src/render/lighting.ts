// Iluminação: camada de escuridão ambiente com "buracos" de luz (destination-out) + brilho aditivo colorido.
export interface Light { x: number; y: number; r: number; color: string; i: number }
export interface Ambient { color: string; alpha: number }

const hexRgb = (c: string): [number, number, number] => { const n = parseInt(c.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
let lc: HTMLCanvasElement | null = null;

export function renderLighting(g: CanvasRenderingContext2D, W: number, H: number, amb: Ambient, lights: Light[], glow = 0.22) {
  if (!lc) lc = document.createElement('canvas');
  const k = 0.5, w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
  if (lc.width !== w || lc.height !== h) { lc.width = w; lc.height = h; }
  const c = lc.getContext('2d')!;
  c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, w, h);
  const [ar, ag, ab] = hexRgb(amb.color);
  c.fillStyle = `rgba(${ar},${ag},${ab},${amb.alpha})`; c.fillRect(0, 0, w, h);
  c.globalCompositeOperation = 'destination-out';
  for (const l of lights) {
    const x = l.x * k, y = l.y * k, r = l.r * k;
    const gr = c.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(0,0,0,${Math.min(1, l.i)})`); gr.addColorStop(0.55, `rgba(0,0,0,${Math.min(1, l.i) * 0.55})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.save(); g.imageSmoothingEnabled = true; g.drawImage(lc, 0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    const [r, gg, b] = hexRgb(l.color);
    const gr = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 0.8);
    gr.addColorStop(0, `rgba(${r},${gg},${b},${glow * l.i})`); gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = gr; g.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
  }
  g.restore();
}
