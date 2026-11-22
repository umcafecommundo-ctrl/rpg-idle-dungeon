// Sprites 16x16 pixel art gerados por código (nenhum asset externo).
import type { SpriteCfg } from '../data/types';
import { CLASS_BY_ID } from '../data/classes';
import { ARENA_H, ARENA_W } from '../engine/battle';
import type { MapDef } from '../data/types';

type G = CanvasRenderingContext2D;
const mk = (w = 16, h = 16) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const R = (g: G, x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

const hex = (c: string): [number, number, number] => { const n = parseInt(c.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const shade = (c: string, k: number) => { const a = hex(c); const t = k < 0 ? 0 : 255, f = Math.abs(k); return `rgb(${Math.round(a[0] + (t - a[0]) * f)},${Math.round(a[1] + (t - a[1]) * f)},${Math.round(a[2] + (t - a[2]) * f)})`; };

/** Contorno automático: pixels transparentes vizinhos de opacos viram contorno escuro. */
function outline(c: HTMLCanvasElement) {
  const g = c.getContext('2d')!; const w = c.width, h = c.height;
  const d = g.getImageData(0, 0, w, h); const src = new Uint8ClampedArray(d.data);
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!op(x, y) && (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1))) {
      const i = (y * w + x) * 4; d.data[i] = 16; d.data[i + 1] = 10; d.data[i + 2] = 20; d.data[i + 3] = 255;
    }
  }
  g.putImageData(d, 0, 0);
}

function human(g: G, c: SpriteCfg) {
  R(g, 5, 12, 2, 3, c.legs); R(g, 9, 12, 2, 3, c.legs); R(g, 5, 14, 2, 1, '#2a1a10'); R(g, 9, 14, 2, 1, '#2a1a10');
  R(g, 4, 7, 8, 5, c.body); R(g, 4, 10, 8, 1, c.accent); R(g, 7, 7, 2, 3, shade(c.body, 0.25));
  R(g, 3, 8, 1, 3, c.skin); R(g, 12, 8, 1, 3, c.skin);
  R(g, 5, 2, 6, 5, c.skin); R(g, 6, 4, 1, 1, '#1a1020'); R(g, 9, 4, 1, 1, '#1a1020');
  R(g, 5, 2, 6, 1, c.hair); R(g, 4, 3, 1, 2, c.hair); R(g, 11, 3, 1, 2, c.hair);
  if (c.hat === 'helm') { R(g, 4, 1, 8, 4, '#a8b4cc'); R(g, 5, 0, 6, 1, '#a8b4cc'); R(g, 6, 4, 4, 1, '#1a1020'); R(g, 7, 0, 2, 1, '#c03030'); R(g, 4, 4, 1, 2, '#a8b4cc'); R(g, 11, 4, 1, 2, '#a8b4cc'); }
  if (c.hat === 'hood') { R(g, 4, 1, 8, 2, c.body); R(g, 4, 3, 1, 4, c.body); R(g, 11, 3, 1, 4, c.body); R(g, 5, 1, 6, 1, shade(c.body, 0.2)); }
  if (c.hat === 'wizard') { R(g, 3, 2, 10, 1, c.body); R(g, 5, 0, 6, 2, c.body); R(g, 7, -1, 3, 1, c.body); R(g, 5, 1, 6, 1, c.accent); }
  if (c.hat === 'crown') R(g, 5, 1, 6, 1, '#ffd040');
  switch (c.weapon) {
    case 'sword': R(g, 13, 2, 1, 8, '#dfe6f5'); R(g, 12, 10, 3, 1, '#a07030'); R(g, 13, 11, 1, 2, '#604020'); break;
    case 'axe': R(g, 13, 4, 1, 9, '#704820'); R(g, 13, 2, 3, 4, '#c8c8d0'); R(g, 15, 3, 1, 2, '#f0f0f8'); break;
    case 'bow': R(g, 13, 2, 1, 2, '#8a5a2a'); R(g, 14, 4, 1, 5, '#8a5a2a'); R(g, 13, 9, 1, 2, '#8a5a2a'); R(g, 13, 3, 1, 7, '#e8e8d8'); break;
    case 'staff': R(g, 13, 3, 1, 11, '#7a5a30'); R(g, 12, 0, 3, 3, c.accent); R(g, 13, 1, 1, 1, '#ffffff'); break;
    case 'mace': R(g, 13, 5, 1, 8, '#7a5a30'); R(g, 12, 2, 3, 4, '#e8c040'); R(g, 13, 3, 1, 2, '#fff2a0'); break;
    case 'skullstaff': R(g, 13, 3, 1, 10, '#403040'); R(g, 12, 0, 3, 3, '#e8e8d8'); R(g, 12, 1, 1, 1, '#222'); R(g, 14, 1, 1, 1, '#222'); R(g, 13, 3, 1, 1, c.accent); break;
  }
  if (c.shield) { R(g, 1, 7, 3, 5, c.accent); R(g, 2, 8, 1, 3, '#f0f0f8'); }
}

const MOB: Record<string, (g: G, col: string) => void> = {
  rato: (g, c) => { R(g, 3, 8, 9, 5, c); R(g, 10, 7, 4, 4, c); R(g, 11, 5, 2, 2, '#e8a0a0'); R(g, 12, 8, 1, 1, '#ff3030'); R(g, 14, 9, 1, 1, '#f0a0a0'); R(g, 0, 11, 3, 1, '#e8a0a0'); R(g, 4, 13, 2, 1, shade(c, -0.4)); R(g, 9, 13, 2, 1, shade(c, -0.4)); R(g, 5, 9, 4, 2, shade(c, 0.2)); },
  lobo: (g, c) => { R(g, 2, 6, 10, 6, c); R(g, 10, 4, 5, 5, c); R(g, 10, 2, 2, 2, c); R(g, 13, 2, 2, 2, c); R(g, 3, 12, 2, 3, c); R(g, 9, 12, 2, 3, c); R(g, 0, 5, 3, 2, shade(c, -0.2)); R(g, 13, 6, 1, 1, '#ffe040'); R(g, 14, 8, 1, 1, '#fff'); R(g, 4, 7, 6, 2, shade(c, 0.2)); },
  morcego: (g, c) => { R(g, 6, 6, 4, 5, c); R(g, 1, 5, 5, 3, shade(c, -0.25)); R(g, 10, 5, 5, 3, shade(c, -0.25)); R(g, 0, 4, 2, 2, shade(c, -0.25)); R(g, 14, 4, 2, 2, shade(c, -0.25)); R(g, 2, 8, 3, 1, shade(c, -0.25)); R(g, 11, 8, 3, 1, shade(c, -0.25)); R(g, 6, 4, 1, 2, c); R(g, 9, 4, 1, 2, c); R(g, 7, 7, 1, 1, '#ff4040'); R(g, 9, 7, 1, 1, '#ff4040'); R(g, 7, 10, 1, 1, '#fff'); R(g, 9, 10, 1, 1, '#fff'); },
  esqueleto: (g, c) => { R(g, 5, 1, 6, 5, c); R(g, 6, 3, 1, 2, '#1a1020'); R(g, 9, 3, 1, 2, '#1a1020'); R(g, 6, 6, 4, 1, shade(c, -0.2)); R(g, 5, 7, 6, 1, c); R(g, 6, 9, 4, 1, c); R(g, 7, 7, 2, 5, shade(c, -0.15)); R(g, 4, 7, 1, 4, c); R(g, 11, 7, 1, 4, c); R(g, 6, 12, 1, 3, c); R(g, 9, 12, 1, 3, c); R(g, 12, 4, 1, 7, '#9aa0b0'); },
  zumbi: (g, c) => { R(g, 5, 2, 6, 5, c); R(g, 6, 4, 1, 1, '#ff4040'); R(g, 9, 4, 1, 1, '#f0f0f0'); R(g, 6, 6, 4, 1, shade(c, -0.4)); R(g, 4, 7, 8, 5, '#4a5a8a'); R(g, 5, 9, 2, 3, shade('#4a5a8a', -0.3)); R(g, 11, 8, 4, 2, c); R(g, 3, 8, 2, 2, c); R(g, 5, 12, 2, 3, '#3a3a4a'); R(g, 9, 12, 2, 3, '#3a3a4a'); R(g, 5, 1, 3, 1, '#2a3a20'); },
  bandido: (g, c) => { R(g, 5, 12, 2, 3, '#3a2a20'); R(g, 9, 12, 2, 3, '#3a2a20'); R(g, 4, 7, 8, 5, c); R(g, 4, 10, 8, 1, '#2a1a10'); R(g, 5, 2, 6, 5, '#e8b890'); R(g, 5, 4, 6, 2, '#222'); R(g, 6, 4, 1, 1, '#fff'); R(g, 9, 4, 1, 1, '#fff'); R(g, 5, 1, 6, 2, '#c03030'); R(g, 11, 2, 2, 1, '#c03030'); R(g, 3, 8, 1, 3, '#e8b890'); R(g, 12, 8, 1, 3, '#e8b890'); R(g, 13, 7, 1, 5, '#d0d0d8'); },
  imp: (g, c) => { R(g, 5, 6, 6, 6, c); R(g, 4, 2, 8, 5, c); R(g, 4, 0, 2, 3, '#f0e0a0'); R(g, 10, 0, 2, 3, '#f0e0a0'); R(g, 6, 4, 1, 1, '#ffe040'); R(g, 9, 4, 1, 1, '#ffe040'); R(g, 7, 6, 2, 1, '#400010'); R(g, 1, 6, 3, 4, shade(c, -0.3)); R(g, 12, 6, 3, 4, shade(c, -0.3)); R(g, 11, 11, 4, 1, c); R(g, 14, 10, 1, 1, c); R(g, 5, 12, 2, 2, shade(c, -0.3)); R(g, 9, 12, 2, 2, shade(c, -0.3)); },
  golem: (g, c) => { R(g, 3, 4, 10, 8, c); R(g, 5, 1, 6, 4, shade(c, 0.15)); R(g, 6, 2, 1, 1, '#ff8040'); R(g, 9, 2, 1, 1, '#ff8040'); R(g, 1, 5, 2, 6, shade(c, -0.15)); R(g, 13, 5, 2, 6, shade(c, -0.15)); R(g, 4, 12, 3, 3, shade(c, -0.2)); R(g, 9, 12, 3, 3, shade(c, -0.2)); R(g, 6, 7, 1, 3, shade(c, -0.45)); R(g, 9, 6, 1, 2, shade(c, -0.45)); R(g, 4, 5, 2, 1, shade(c, 0.2)); },
  elemental: (g, c) => { R(g, 4, 6, 8, 7, c); R(g, 5, 3, 6, 3, shade(c, 0.25)); R(g, 6, 1, 4, 2, shade(c, 0.5)); R(g, 7, 0, 2, 1, shade(c, 0.7)); R(g, 3, 8, 1, 3, c); R(g, 12, 8, 1, 3, c); R(g, 6, 8, 4, 3, shade(c, 0.6)); R(g, 6, 7, 1, 2, '#200800'); R(g, 9, 7, 1, 2, '#200800'); R(g, 5, 13, 6, 1, shade(c, -0.2)); },
  slime: (g, c) => { R(g, 3, 9, 10, 5, c); R(g, 4, 7, 8, 2, c); R(g, 6, 6, 4, 1, c); R(g, 5, 8, 2, 1, shade(c, 0.6)); R(g, 6, 10, 1, 2, '#102010'); R(g, 9, 10, 1, 2, '#102010'); R(g, 7, 13, 2, 1, '#102010'); R(g, 2, 12, 1, 2, shade(c, -0.2)); },
};

const cache = new Map<string, HTMLCanvasElement>();
export function spriteFor(key: string, color: string): HTMLCanvasElement {
  const id = key + color;
  let c = cache.get(id); if (c) return c;
  c = mk(); const g = c.getContext('2d')!;
  if (key.startsWith('class:')) human(g, CLASS_BY_ID[key.slice(6)].sprite);
  else (MOB[key] ?? MOB.slime)(g, color);
  outline(c);
  cache.set(id, c);
  return c;
}
/** Versão totalmente branca (flash de dano). */
export function whiteOf(src: HTMLCanvasElement, id: string): HTMLCanvasElement {
  const k = 'w:' + id; let c = cache.get(k); if (c) return c;
  c = mk(); const g = c.getContext('2d')!; g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = '#fff'; g.fillRect(0, 0, 16, 16);
  cache.set(k, c); return c;
}
export function tintOf(src: HTMLCanvasElement, id: string, col: string): HTMLCanvasElement {
  const k = 't:' + id + col; let c = cache.get(k); if (c) return c;
  c = mk(); const g = c.getContext('2d')!; g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.45; g.fillStyle = col; g.fillRect(0, 0, 16, 16);
  cache.set(k, c); return c;
}

// ───────────── fundo do mapa (grid de pedra) ─────────────
const bgCache = new Map<string, HTMLCanvasElement>();
export function mapBackground(m: MapDef): HTMLCanvasElement {
  let c = bgCache.get(m.id); if (c) return c;
  c = mk(ARENA_W * 16, ARENA_H * 16); const g = c.getContext('2d')!;
  let seed = m.id.length * 9973 + m.minLv;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let ty = 0; ty < ARENA_H; ty++) for (let tx = 0; tx < ARENA_W; tx++) {
    const x = tx * 16, y = ty * 16;
    R(g, x, y, 16, 16, (tx + ty) % 2 ? m.theme.floor : m.theme.floor2);
    R(g, x, y, 16, 1, m.theme.line); R(g, x, y, 1, 16, m.theme.line);
    R(g, x + 1, y + 1, 14, 1, 'rgba(255,255,255,0.05)');
    for (let i = 0; i < 3; i++) R(g, x + 2 + Math.floor(rnd() * 12), y + 2 + Math.floor(rnd() * 12), 1, 1, rnd() > 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.07)');
    if (rnd() < 0.07) { R(g, x + 4, y + 5, 5, 1, m.theme.line); R(g, x + 8, y + 6, 1, 4, m.theme.line); }
    if (rnd() < 0.05) R(g, x + 3 + Math.floor(rnd() * 8), y + 3 + Math.floor(rnd() * 8), 3, 2, m.theme.accent + '55');
  }
  // parede superior com tijolos
  R(g, 0, 0, ARENA_W * 16, 20, m.theme.wall);
  for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < ARENA_W * 2 + 1; tx++) { R(g, tx * 8 - (ty ? 4 : 0), ty * 10, 1, 10, 'rgba(0,0,0,0.35)'); R(g, 0, ty * 10 + 9, ARENA_W * 16, 1, 'rgba(0,0,0,0.35)'); }
  R(g, 0, 20, ARENA_W * 16, 2, 'rgba(0,0,0,0.4)');
  // tocha nos cantos
  for (const tx of [20, ARENA_W * 16 - 21]) { R(g, tx, 6, 2, 7, '#5a3a1a'); R(g, tx - 1, 3, 4, 3, m.theme.accent); }
  // vinheta lateral
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, 22, 3, ARENA_H * 16); g.fillRect(ARENA_W * 16 - 3, 22, 3, ARENA_H * 16);
  bgCache.set(m.id, c);
  return c;
}
