// Cena de mapa em camadas: chão (variações) → decoração de chão → objetos (y-sort) → copas (acima do personagem) → partículas → luz.
import type { PropKind, TileVariant } from '../data/mapart';
import { mulberry32 } from '../engine/rng';
import { renderLighting, type Light } from './lighting';
import { AH, AW, generateLayout, type Layout, type Prop } from './mapgen';
import { Particles, type Tx } from './particles';
import { outline, shade } from './sprites';

type G = CanvasRenderingContext2D;
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const R = (g: G, x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
const disc = (g: G, cx: number, cy: number, r: number, c: string) => { g.fillStyle = c; for (let yy = -r; yy <= r; yy++) { const w = Math.floor(Math.sqrt(r * r - yy * yy + 0.5)); g.fillRect(Math.round(cx - w), Math.round(cy + yy), 2 * w + 1, 1); } };

const hash = (x: number, y: number, s: number) => { let h = (x * 374761393 + y * 668265263 + s * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vnoise = (x: number, y: number, s: number) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

// ───────────── pisos ─────────────
function paintTile(g: G, v: TileVariant, style: 'grass' | 'flagstone', rnd: () => number, tx: number, ty: number) {
  R(g, 0, 0, 16, 16, v.base);
  if (style === 'grass') {
    for (let i = 0; i < 9; i++) R(g, rnd() * 15, rnd() * 15, 1, 1, v.speck);
    for (let i = 0; i < 3; i++) { const x = rnd() * 14 + 1, y = rnd() * 12 + 2; R(g, x, y, 1, 2, shade(v.base, -0.25)); R(g, x + 1, y + 1, 1, 1, shade(v.base, -0.15)); }
    if (v.deco === 'flower') for (let i = 0; i < 2; i++) { const x = 2 + rnd() * 11, y = 2 + rnd() * 11; R(g, x, y, 2, 2, ['#f4f0a0', '#ffffff', '#f080b0', '#b090ff'][Math.floor(rnd() * 4)]); R(g, x, y + 2, 1, 2, '#2a5a28'); }
    if (v.deco === 'dirt') { R(g, 3, 5, 10, 6, v.speck); R(g, 5, 3, 6, 10, v.speck); R(g, 5, 6, 6, 4, shade(v.base, -0.12)); for (let i = 0; i < 4; i++) R(g, 3 + rnd() * 10, 3 + rnd() * 10, 1, 1, '#4a3820'); }
    if (v.deco === 'litter') for (let i = 0; i < 5; i++) { const x = 1 + rnd() * 13, y = 1 + rnd() * 13; R(g, x, y, 2, 1, v.speck); R(g, x + 1, y + 1, 1, 1, '#8a4a1a'); }
  } else {
    R(g, 0, 0, 16, 1, 'rgba(255,255,255,0.08)'); R(g, 0, 0, 1, 16, 'rgba(255,255,255,0.06)');
    R(g, 0, 15, 16, 1, 'rgba(0,0,0,0.35)'); R(g, 15, 0, 1, 16, 'rgba(0,0,0,0.3)');
    if ((tx + ty) % 2) R(g, 8, 0, 1, 16, 'rgba(0,0,0,0.18)'); else R(g, 0, 8, 16, 1, 'rgba(0,0,0,0.18)');
    for (let i = 0; i < 6; i++) R(g, 1 + rnd() * 13, 1 + rnd() * 13, 1, 1, v.speck);
    if (v.deco === 'crack') { let x = 2 + rnd() * 6, y = 1; while (y < 15) { R(g, x, y, 1, 1, 'rgba(0,0,0,0.55)'); x += rnd() < 0.5 ? 1 : 0; y += 1; if (rnd() < 0.15) x += rnd() < 0.5 ? -1 : 1; } }
    if (v.deco === 'moss') for (let i = 0; i < 3; i++) { const x = rnd() * 12, y = rnd() * 12; R(g, x, y, 3, 2, v.speck); R(g, x + 1, y - 1, 2, 1, shade(v.speck, 0.2)); }
    if (v.deco === 'rubble') for (let i = 0; i < 3; i++) { const x = 1 + rnd() * 12, y = 1 + rnd() * 12; R(g, x, y, 2, 2, v.speck); R(g, x, y + 2, 2, 1, 'rgba(0,0,0,0.4)'); }
  }
}

// ───────────── decalques (decoração de chão) ─────────────
function decal(g: G, kind: PropKind, x: number, y: number, v: number, rnd: () => number) {
  switch (kind) {
    case 'flower': R(g, x, y + 2, 1, 2, '#2a5a28'); R(g, x - 1, y, 3, 2, ['#f4f0a0', '#ffffff', '#f080b0', '#b090ff'][v % 4]); R(g, x, y, 1, 1, '#e8a020'); break;
    case 'mushroom': R(g, x, y + 2, 2, 3, '#e8e0d0'); R(g, x - 1, y, 4, 3, '#c83a3a'); R(g, x, y, 1, 1, '#fff'); R(g, x + 2, y + 1, 1, 1, '#fff'); R(g, x - 1, y + 4, 4, 1, 'rgba(0,0,0,0.25)'); break;
    case 'fern': for (let i = -3; i <= 3; i++) R(g, x + i, y - Math.abs(i) / 2, 1, 3, i % 2 ? '#2e6a30' : '#3c8040'); break;
    case 'leaves': for (let i = 0; i < 4; i++) R(g, x + rnd() * 8 - 4, y + rnd() * 6 - 3, 2, 1, ['#c8782a', '#e0a040', '#8a4a1a'][i % 3]); break;
    case 'bones': if (v === 0) { R(g, x, y, 7, 1, '#d8d0c0'); R(g, x + 1, y - 1, 1, 3, '#d8d0c0'); R(g, x + 5, y - 1, 1, 3, '#d8d0c0'); R(g, x + 2, y + 2, 5, 1, '#c8c0b0'); } else if (v === 1) { R(g, x, y, 5, 4, '#e0d8c8'); R(g, x + 1, y + 1, 1, 1, '#222'); R(g, x + 3, y + 1, 1, 1, '#222'); R(g, x + 1, y + 4, 3, 1, '#c8c0b0'); } else { for (let i = 0; i < 4; i++) R(g, x + i * 2, y + (i % 2), 1, 3, '#d8d0c0'); R(g, x - 1, y + 1, 10, 1, '#bdb5a5'); } break;
    case 'crack': { let cx = x, cy = y; for (let i = 0; i < 9; i++) { R(g, cx, cy, 1, 1, 'rgba(0,0,0,0.5)'); cx += rnd() < 0.6 ? 1 : 0; cy += rnd() < 0.7 ? 1 : 0; } break; }
    case 'puddle': R(g, x, y, 10, 4, '#1a2438'); R(g, x + 1, y - 1, 8, 6, '#1a2438'); R(g, x + 2, y, 3, 1, '#5a78a8'); R(g, x - 1, y + 1, 1, 2, '#2a2a3a'); break;
    case 'web': { // x,y = canto (0/192, 0/256 relativo); v: direção
      const dx = x < 96 ? 1 : -1, dy = y < 128 ? 1 : -1; g.strokeStyle = 'rgba(235,235,250,0.55)'; g.lineWidth = 1; g.beginPath();
      for (let i = 0; i <= 4; i++) { g.moveTo(x, y); g.lineTo(x + dx * 14, y + dy * i * 3.5); g.moveTo(x, y); g.lineTo(x + dx * i * 3.5, y + dy * 14); }
      for (let r = 4; r <= 12; r += 4) { g.moveTo(x + dx * r, y); g.quadraticCurveTo(x + dx * r * 0.7, y + dy * r * 0.7, x, y + dy * r); }
      g.stroke(); break; }
    default: break;
  }
}

// ───────────── sprites de objetos ─────────────
const sprCache = new Map<string, HTMLCanvasElement>();
function spr(key: string, w: number, h: number, fn: (g: G) => void, outl = true) {
  let c = sprCache.get(key); if (c) return c;
  c = mk(w, h); fn(c.getContext('2d')!); if (outl) outline(c); sprCache.set(key, c); return c;
}
const TREE_COL = [['#2f6a30', '#3f8a3e', '#235a28'], ['#2a5a38', '#38784a', '#1e4a2e'], ['#5a7a2a', '#7a9a38', '#46661e']];
const trunkSpr = (v: number) => spr('trunk' + v, 12, 14, (g) => { R(g, 4, 0, 4, 12, '#6a4428'); R(g, 5, 0, 1, 12, '#8a5a38'); R(g, 7, 0, 1, 12, '#4a2e1a'); R(g, 2, 10, 3, 2, '#6a4428'); R(g, 7, 10, 3, 2, '#6a4428'); R(g, 3, 12, 6, 1, 'rgba(0,0,0,0.3)'); });
const canopySpr = (v: number) => spr('canopy' + v, 38, 32, (g) => {
  const [a, b, d] = TREE_COL[v % 3];
  disc(g, 19, 18, 13, d); disc(g, 10, 20, 9, d); disc(g, 28, 20, 9, d); disc(g, 19, 12, 10, a); disc(g, 11, 15, 8, a); disc(g, 27, 15, 8, a);
  disc(g, 14, 10, 5, b); disc(g, 25, 12, 4, b); disc(g, 19, 7, 4, b); disc(g, 8, 14, 3, b);
  for (let i = 0; i < 10; i++) R(g, 6 + ((i * 7) % 26), 6 + ((i * 11) % 18), 2, 1, shade(b, 0.25));
});
const bushSpr = (v: number) => spr('bush' + v, 16, 11, (g) => { const [a, b, d] = TREE_COL[v % 3]; disc(g, 8, 7, 5, d); disc(g, 4, 7, 4, a); disc(g, 12, 7, 4, a); disc(g, 8, 5, 4, a); R(g, 5, 4, 2, 1, b); R(g, 10, 5, 2, 1, b); if (v === 1) { R(g, 6, 3, 1, 1, '#e04050'); R(g, 10, 6, 1, 1, '#e04050'); } });
const logSpr = () => spr('log', 24, 10, (g) => { R(g, 2, 2, 20, 6, '#6a4428'); R(g, 2, 2, 20, 1, '#8a5a38'); R(g, 2, 7, 20, 1, '#4a2e1a'); R(g, 0, 3, 3, 4, '#c8a070'); R(g, 1, 4, 1, 2, '#8a6038'); for (let i = 0; i < 4; i++) R(g, 6 + i * 4, 3 + (i % 2) * 2, 2, 1, '#4a2e1a'); R(g, 8, 1, 6, 1, '#4a8a3a'); R(g, 16, 1, 3, 1, '#5a9a40'); });
const rockSpr = (v: number) => spr('rock' + v, 14, 11, (g) => { R(g, 2, 4, 10, 6, '#7a7a84'); R(g, 4, 2, 6, 3, '#8c8c96'); R(g, 3, 4, 3, 2, '#a4a4ae'); R(g, 2, 9, 11, 1, 'rgba(0,0,0,0.3)'); R(g, 9, 6, 3, 4, '#62626c'); if (v === 1) R(g, 4, 3, 4, 1, '#4a8a3a'); });
const tombSpr = (v: number) => spr('tomb' + v, 14, 16, (g) => {
  R(g, 0, 13, 14, 3, '#2e2438'); R(g, 3, 13, 8, 1, '#3e3248');
  if (v === 0) { R(g, 2, 3, 10, 11, '#7a7890'); R(g, 3, 2, 8, 1, '#7a7890'); R(g, 4, 1, 6, 1, '#7a7890'); R(g, 3, 3, 2, 10, '#9a98b0'); R(g, 6, 5, 2, 5, '#4a485c'); R(g, 5, 6, 4, 1, '#4a485c'); }
  else if (v === 1) { R(g, 5, 0, 4, 14, '#7a7890'); R(g, 1, 4, 12, 3, '#7a7890'); R(g, 6, 0, 1, 14, '#9a98b0'); R(g, 2, 4, 10, 1, '#9a98b0'); R(g, 6, 8, 2, 4, '#5a586c'); }
  else { R(g, 2, 6, 10, 8, '#706e88'); R(g, 3, 4, 4, 2, '#706e88'); R(g, 9, 5, 3, 1, '#706e88'); R(g, 3, 7, 2, 7, '#8e8ca8'); R(g, 7, 9, 3, 1, '#3a384c'); R(g, 4, 12, 4, 2, '#4a7a48'); }
  R(g, 2, 12, 3, 1, '#4a7a48');
});
const coffinSpr = (v: number) => spr('coffin' + v, 16, 26, (g) => {
  R(g, 4, 0, 8, 2, '#4a2e22'); R(g, 2, 2, 12, 5, '#5a3a2a'); R(g, 1, 7, 14, 12, '#6a4632'); R(g, 3, 19, 10, 5, '#5a3a2a'); R(g, 5, 24, 6, 1, '#4a2e22');
  R(g, 2, 3, 1, 19, '#8a6048'); R(g, 7, 6, 2, 10, '#c8b078'); R(g, 5, 9, 6, 2, '#c8b078'); R(g, 1, 7, 1, 12, '#3a2216'); R(g, 14, 7, 1, 12, '#3a2216');
  if (v === 1) { R(g, 8, 0, 8, 6, '#1a1018'); R(g, 10, 1, 3, 1, '#d8d0c0'); }
});
const pillarSpr = (v: number) => spr('pillar' + v, 12, 22, (g) => {
  R(g, 1, 17, 10, 4, '#6a6880'); R(g, 2, 4 + v * 3, 8, 14, '#8a88a0'); R(g, 3, 4 + v * 3, 2, 14, '#a8a6c0'); R(g, 8, 4 + v * 3, 2, 14, '#6a6880');
  R(g, 1, 2 + v * 3, 10, 3, '#9a98b0'); if (v) { R(g, 2, 0, 3, 3, '#8a88a0'); } R(g, 4, 10, 1, 4, '#4a485c'); R(g, 6, 7, 3, 1, '#4a485c');
});
const candleSpr = (v: number) => spr('candle' + v, 12, 10, (g) => {
  R(g, 1, 8, 10, 1, 'rgba(0,0,0,0.3)'); R(g, 2, 4, 3, 5, '#e8dcc0'); R(g, 2, 4, 3, 1, '#fff6e0'); R(g, 3, 2, 1, 2, '#2a2020');
  R(g, 7, 6, 3, 3, '#d8ccb0'); R(g, 8, 5, 1, 1, '#2a2020'); if (v > 0) { R(g, 5, 7, 2, 2, '#e0d4b8'); R(g, 5, 6, 1, 1, '#2a2020'); }
  R(g, 0, 8, 4, 1, '#e8dcc0'); R(g, 8, 9, 3, 1, '#d8ccb0');
});
const brazierSpr = () => spr('brazier', 14, 18, (g) => { R(g, 5, 8, 4, 8, '#4a4458'); R(g, 3, 15, 8, 3, '#3a3448'); R(g, 1, 4, 12, 5, '#5a5468'); R(g, 2, 8, 10, 1, '#3a3448'); R(g, 2, 4, 10, 1, '#2a2438'); R(g, 3, 5, 8, 2, '#5a2a1a'); });

const GROUND_OBJ: PropKind[] = ['flower', 'mushroom', 'fern', 'leaves', 'bones', 'crack', 'puddle'];
const BLOCKS: PropKind[] = ['tree', 'bush', 'log', 'rock', 'tomb', 'coffin', 'pillar', 'brazier', 'candle'];

export class MapScene {
  layout: Layout; ground: HTMLCanvasElement; particles: Particles; mapId: string;
  items: { kind: PropKind; x: number; y: number; v: number; phase: number }[] = [];
  constructor(mapId: string, layout: Layout) {
    this.mapId = mapId; this.layout = layout;
    this.particles = new Particles(layout.art.particles);
    this.ground = this.paintGround();
    this.items = layout.props.filter((p) => BLOCKS.includes(p.kind));
  }

  private paintGround(): HTMLCanvasElement {
    const { art, seed } = this.layout; const c = mk(AW * 16, AH * 16); const g = c.getContext('2d')!;
    const rnd = mulberry32(seed ^ 0xabc);
    const tot = art.tiles.reduce((a, t) => a + t.weight, 0);
    const tile = mk(16, 16); const tg = tile.getContext('2d')!;
    for (let ty = 0; ty < AH; ty++) for (let tx = 0; tx < AW; tx++) {
      // ruído em manchas; os pesos definem a proporção de cada variação
      const n = Math.min(0.999, Math.max(0, (vnoise(tx * 0.5, ty * 0.5, seed) * 0.65 + hash(tx, ty, seed) * 0.35 - 0.12) * 1.25));
      let acc = 0, v = art.tiles[0];
      for (const t of art.tiles) { acc += t.weight / tot; if (n < acc) { v = t; break; } }
      tg.clearRect(0, 0, 16, 16); paintTile(tg, v, art.style, rnd, tx, ty);
      g.drawImage(tile, tx * 16, ty * 16);
    }
    // faixa de transição de chão em torno do riacho
    if (art.stream) for (let y = 0; y < AH * 16; y += 2) { const sx = this.layout.streamX(y / 16) * 16; R(g, 0, y, sx + 14, 2, '#5a4a30'); R(g, sx + 11, y, 4, 2, '#7a6642'); }
    this.paintWall(g, art);
    for (const p of this.layout.props) if (GROUND_OBJ.includes(p.kind)) decal(g, p.kind, p.x * 16, p.y * 16, p.v, rnd);
    for (const p of this.layout.props) if (p.kind === 'web') decal(g, 'web', p.x < 6 ? 0 : AW * 16, p.y < 8 ? 20 : AH * 16, 0, rnd);
    return c;
  }
  private paintWall(g: G, art: Layout['art']) {
    const W = AW * 16;
    if (art.wall.style === 'treeline') {
      R(g, 0, 0, W, 22, art.wall.c1);
      for (let x = 0; x < W; x += 9) { disc(g, x + 4, 14 + ((x * 7) % 5), 9, art.wall.c1); disc(g, x + 2, 9 + ((x * 3) % 4), 7, art.wall.c2); disc(g, x + 6, 6, 4, shade(art.wall.c2, 0.2)); }
      for (let x = 6; x < W; x += 23) { R(g, x, 12, 4, 10, '#3a2412'); R(g, x + 1, 12, 1, 10, '#5a3a1e'); }
      for (let x = 3; x < W; x += 11) R(g, x, 18 + (x % 4), 1, 4 + (x % 3), '#3a8a3a');
      R(g, 0, 22, W, 3, 'rgba(0,0,0,0.35)');
    } else {
      R(g, 0, 0, W, 22, art.wall.c1);
      for (let r = 0; r < 3; r++) for (let x = 0; x < W + 8; x += 12) { const ox = r % 2 ? 6 : 0; R(g, x - ox, r * 7, 11, 6, art.wall.c2); R(g, x - ox, r * 7, 11, 1, shade(art.wall.c2, 0.2)); R(g, x - ox, r * 7 + 5, 11, 1, 'rgba(0,0,0,0.4)'); }
      for (const nx of [30, 90, 150]) { R(g, nx, 6, 12, 14, '#0c0814'); R(g, nx + 1, 5, 10, 1, '#0c0814'); R(g, nx + 3, 9, 6, 5, '#d8d0c0'); R(g, nx + 4, 10, 1, 2, '#111'); R(g, nx + 7, 10, 1, 2, '#111'); R(g, nx + 4, 14, 4, 1, '#c8c0b0'); }
      R(g, 0, 22, W, 3, 'rgba(0,0,0,0.5)');
    }
  }

  /** Luzes do cenário em coordenadas de tela. */
  lights(T: Tx, now: number, player?: { x: number; y: number }): Light[] {
    const out: Light[] = []; const { ox, oy, S } = T;
    for (const l of this.layout.lights) {
      const f = 1 - 0.18 + Math.sin(now * 0.011 + l.phase) * 0.1 + Math.sin(now * 0.023 + l.phase * 2) * 0.08;
      out.push({ x: ox + l.x * 16 * S, y: oy + l.y * 16 * S, r: l.r * 16 * S * (0.92 + 0.08 * f), color: l.color, i: l.i * f });
    }
    const art = this.layout.art;
    if (art.centerLight) out.push({ x: ox + AW * 8 * S, y: oy + 8.5 * 16 * S, r: art.centerLight.r * 16 * S, color: art.centerLight.color, i: art.centerLight.i });
    if (art.playerLight && player) out.push({ x: ox + player.x * 16 * S, y: oy + (player.y - 0.4) * 16 * S, r: art.playerLight.r * 16 * S, color: art.playerLight.color, i: art.playerLight.i });
    if (art.wall.style === 'brick') for (const tx of [38, 98, 158]) out.push({ x: ox + tx * S, y: oy + 14 * S, r: 3.2 * 16 * S, color: '#ffb458', i: 0.6 + 0.2 * Math.sin(now * 0.01 + tx) });
    return out;
  }

  drawGround(g: G, T: Tx) { g.drawImage(this.ground, T.ox, T.oy, AW * 16 * T.S, AH * 16 * T.S); }

  drawWater(g: G, T: Tx, now: number) {
    const st = this.layout.art.stream; if (!st) return;
    const { ox, oy, S } = T; const X = (x: number) => ox + x * 16 * S, Y = (y: number) => oy + y * 16 * S;
    g.fillStyle = st.c1; g.beginPath(); g.moveTo(X(-1), Y(0));
    for (let y = 0; y <= AH; y += 0.5) g.lineTo(X(this.layout.streamX(y) + 0.7), Y(y));
    g.lineTo(X(-1), Y(AH)); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(20,40,60,0.5)'; g.lineWidth = Math.max(1, S); g.beginPath();
    for (let y = 0; y <= AH; y += 0.5) { const x = X(this.layout.streamX(y) + 0.7); y === 0 ? g.moveTo(x, Y(y)) : g.lineTo(x, Y(y)); } g.stroke();
    g.fillStyle = st.c2;
    for (let i = 0; i < 34; i++) {
      const y = (i * 1.37 + now * 0.0006 * (1 + (i % 3) * 0.4)) % AH;
      const x = this.layout.streamX(y) - 0.45 + ((i * 0.37) % 1) * 0.9;
      g.globalAlpha = 0.35 + 0.35 * Math.abs(Math.sin(now * 0.004 + i)); g.fillRect(X(x), Y(y), 5 * S, 1 * S);
    }
    g.globalAlpha = 1;
  }

  /** Desenha um objeto (para o y-sort junto com os atores). */
  drawItem(g: G, p: Prop, T: Tx, now: number) {
    const { ox, oy, S } = T; const x = ox + p.x * 16 * S, y = oy + p.y * 16 * S;
    const put = (c: HTMLCanvasElement, ax: number, ay: number) => g.drawImage(c, x - ax * S, y - ay * S, c.width * S, c.height * S);
    g.fillStyle = 'rgba(0,0,0,0.28)';
    switch (p.kind) {
      case 'tree': g.beginPath(); g.ellipse(x, y, 11 * S, 3.5 * S, 0, 0, 7); g.fill(); put(trunkSpr(p.v), 6, 13); break;
      case 'bush': g.beginPath(); g.ellipse(x, y, 7 * S, 2.5 * S, 0, 0, 7); g.fill(); put(bushSpr(p.v), 8, 10); break;
      case 'log': put(logSpr(), 12, 9); break;
      case 'rock': put(rockSpr(p.v % 2), 7, 10); break;
      case 'tomb': put(tombSpr(p.v), 7, 15); break;
      case 'coffin': put(coffinSpr(p.v % 2), 8, 24); break;
      case 'pillar': put(pillarSpr(p.v % 2), 6, 20); break;
      case 'candle': { put(candleSpr(p.v), 6, 9); this.flame(g, x - 1.5 * S + (p.v % 2) * S, y - 12 * S, S, now, p.phase); if (p.v > 0) this.flame(g, x + 1.5 * S, y - 7 * S, S * 0.8, now, p.phase + 2); break; }
      case 'brazier': { put(brazierSpr(), 7, 17); this.flame(g, x, y - 20 * S, S * 2, now, p.phase); break; }
      default: break;
    }
  }
  private flame(g: G, x: number, y: number, S: number, now: number, ph: number) {
    const f = Math.sin(now * 0.02 + ph) * 0.5 + 0.5, h = (3 + f * 2) * S;
    g.fillStyle = '#ff7a1a'; g.fillRect(x - S, y - h, 2 * S, h); g.fillStyle = '#ffd24a'; g.fillRect(x - 0.5 * S, y - h * 0.7, S, h * 0.7); g.fillStyle = '#fff6c0'; g.fillRect(x - 0.3 * S, y - h * 0.35, 0.6 * S, h * 0.3);
  }

  /** Copas das árvores (camada acima dos personagens); ficam translúcidas quando alguém está embaixo. */
  drawCanopies(g: G, T: Tx, under: { x: number; y: number }[]) {
    const { ox, oy, S } = T;
    for (const p of this.layout.props) if (p.kind === 'tree') {
      const hide = under.some((a) => Math.abs(a.x - p.x) < 1.2 && a.y < p.y + 0.2 && a.y > p.y - 2.6);
      g.globalAlpha = hide ? 0.5 : 0.97;
      const c = canopySpr(p.v);
      g.drawImage(c, ox + p.x * 16 * S - 19 * S, oy + p.y * 16 * S - 38 * S, c.width * S, c.height * S);
    }
    g.globalAlpha = 1;
  }
  update(dt: number) { this.particles.update(dt); }
  fullLighting(g: G, T: Tx, now: number, player?: { x: number; y: number }) {
    const a = this.layout.art.ambient;
    renderLighting(g, T.W, T.H, a, this.lights(T, now, player), this.layout.art.style === 'flagstone' ? 0.1 : 0.18);
  }
}

export function createScene(mapId: string, seed: number): MapScene | null {
  const l = generateLayout(mapId, seed); return l ? new MapScene(mapId, l) : null;
}

export { canopySpr, trunkSpr, bushSpr, rockSpr, spr as makeSprite };
