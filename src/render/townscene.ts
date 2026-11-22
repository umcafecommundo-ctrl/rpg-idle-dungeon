// Renderização da cidade: chão pré-renderizado, prédios, NPCs, aldeões, gatos, pássaros, fonte e ciclo dia/noite.
import { TOWN, entryOf, type BuildingDef } from '../data/town';
import type { IconKey } from '../data/types';
import { Town, type Walker } from '../engine/town';
import { iconCanvas } from './icons';
import { renderLighting, type Light } from './lighting';
import { bushSpr, canopySpr, makeSprite, rockSpr, trunkSpr } from './mapscene';
import type { Tx } from './particles';
import { outline, shade } from './sprites';
import { humanFromCfg } from './sprites';

type G = CanvasRenderingContext2D;
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const R = (g: G, x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
const disc = (g: G, cx: number, cy: number, r: number, c: string) => { g.fillStyle = c; for (let yy = -r; yy <= r; yy++) { const w = Math.floor(Math.sqrt(r * r - yy * yy + 0.5)); g.fillRect(Math.round(cx - w), Math.round(cy + yy), 2 * w + 1, 1); } };
let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

const SIGN_ICON: Record<string, IconKey> = { ferreiro: 'anvil', itens: 'potion', mercado: 'coin', portal: 'star', taverna: 'potionmp', guilda: 'sword', templo: 'cross', banco: 'coin', magia: 'scroll', joalheiro: 'gem' };
export const SIGN_NAME: Record<string, string> = { ferreiro: 'Ferreiro', itens: 'Loja de Itens', mercado: 'Mercado', portal: 'Portal', taverna: 'Taverna', guilda: 'Guilda', templo: 'Templo', banco: 'Banco', magia: 'Loja de Magia', joalheiro: 'Joalheiro' };

const EXTRA = 14; // pixels extras acima do prédio (chaminé, torre)

function paintBuilding(b: BuildingDef): HTMLCanvasElement {
  const w = b.w * 16, h = b.h * 16 + EXTRA; const c = mk(w, h); const g = c.getContext('2d')!;
  const top = EXTRA; const roofH = 32, wallY = top + roofH, wallH = h - wallY;
  const door = (cx: number) => { R(g, cx - 5, h - 20, 10, 20, b.trim); R(g, cx - 4, h - 19, 8, 19, shade(b.trim, 0.25)); R(g, cx - 4, h - 20, 8, 1, b.trim); R(g, cx + 2, h - 9, 1, 2, '#e8c040'); R(g, cx - 4, h - 19, 8, 2, 'rgba(0,0,0,0.3)'); };
  const win = (x: number, y: number) => { R(g, x - 1, y - 1, 8, 8, b.trim); R(g, x, y, 6, 6, '#2a3a5a'); R(g, x, y, 6, 1, '#4a6a9a'); R(g, x + 3, y, 1, 6, b.trim); };
  if (b.kind === 'stall') {
    // pilares, balcão com mercadorias e toldo listrado
    R(g, 2, top + 18, 3, h - top - 18, '#5a3a20'); R(g, w - 5, top + 18, 3, h - top - 18, '#5a3a20');
    for (let x = 0; x < w; x += 8) { R(g, x, top + 4, 8, 22, (x / 8) % 2 ? b.roof2 : b.roof); R(g, x, top + 24, 8, 3, (x / 8) % 2 ? b.roof2 : b.roof); R(g, x + 2, top + 27, 4, 2, (x / 8) % 2 ? b.roof2 : b.roof); }
    R(g, 0, top + 4, w, 1, 'rgba(255,255,255,0.3)'); R(g, 0, top + 29, w, 1, 'rgba(0,0,0,0.25)');
    R(g, 3, wallY + 8, w - 6, wallH - 8, '#8a6a40'); R(g, 3, wallY + 8, w - 6, 2, '#b08a54');
    for (let i = 0; i < 6; i++) { R(g, 8 + i * 11, wallY + 2, 7, 6, ['#d84a3a', '#e8c040', '#6ab84a', '#4a9ae8', '#c8a0ff', '#f08a3a'][i]); R(g, 9 + i * 11, wallY + 3, 2, 1, 'rgba(255,255,255,0.5)'); }
  } else {
    const gable = b.kind === 'house' || b.kind === 'temple';
    // telhado
    R(g, 0, top + 4, w, roofH - 4, b.roof);
    for (let y = top + 6; y < top + roofH; y += 5) { R(g, 0, y, w, 1, b.roof2); for (let x = (y / 5) % 2 ? 0 : 5; x < w; x += 10) R(g, x, y - 5, 1, 5, b.roof2); }
    R(g, 0, top + 4, w, 2, shade(b.roof, 0.3)); R(g, 0, top + roofH - 2, w, 3, b.roof2); R(g, 0, top + roofH + 1, w, 1, 'rgba(0,0,0,0.3)');
    if (gable) { R(g, 0, top + 4, 1, roofH - 4, shade(b.roof, 0.3)); R(g, w - 1, top + 4, 1, roofH - 4, b.roof2); }
    if (b.kind === 'house') { R(g, w - 14, top - 4, 6, 12, '#7a5a4a'); R(g, w - 15, top - 5, 8, 2, '#5a3a2a'); R(g, w - 13, top - 8, 4, 2, 'rgba(200,200,210,0.5)'); }
    if (b.kind === 'temple') { R(g, w / 2 - 1, top - 12, 3, 14, '#e8c040'); R(g, w / 2 - 5, top - 8, 11, 3, '#e8c040'); }
    if (b.kind === 'bank') { R(g, 0, top + 2, w, 4, b.trim); for (let i = 0; i < 4; i++) R(g, 4 + i * ((w - 12) / 3), wallY - 2, 5, wallH + 2, '#d8d8e0'); }
    // parede
    R(g, 0, wallY, w, wallH, b.wall); R(g, 0, wallY, w, 2, 'rgba(0,0,0,0.3)');
    for (let y = wallY + 6; y < h; y += 6) { R(g, 0, y, w, 1, 'rgba(0,0,0,0.12)'); for (let x = (y / 6) % 2 ? 0 : 6; x < w; x += 12) R(g, x, y - 6, 1, 6, 'rgba(0,0,0,0.1)'); }
    R(g, 0, wallY, 2, wallH, b.trim); R(g, w - 2, wallY, 2, wallH, b.trim);
    if (b.kind === 'bank') { for (let i = 0; i < 4; i++) { const x = 4 + i * ((w - 12) / 3); R(g, x, wallY - 2, 5, wallH + 2, '#d8d8e0'); R(g, x + 1, wallY - 2, 1, wallH + 2, '#fff'); R(g, x + 4, wallY - 2, 1, wallH + 2, '#a8a8b8'); } }
    else { win(10, wallY + 10); win(w - 17, wallY + 10); }
    door(w / 2 | 0);
    if (b.kind === 'temple') { R(g, w / 2 - 8, h - 4, 16, 4, '#d8d8e0'); }
  }
  outline(c);
  return c;
}

function paintCobble(variant: number): HTMLCanvasElement {
  const c = mk(16, 16); const g = c.getContext('2d')!;
  const bases = ['#8a8478', '#847e72', '#908a7e'];
  R(g, 0, 0, 16, 16, bases[variant % 3]);
  for (let sy = 0; sy < 16; sy += 5) for (let sx = (sy / 5) % 2 ? -3 : 0; sx < 16; sx += 8) {
    R(g, sx + 1, sy + 1, 6, 3, shade(bases[variant % 3], 0.12 + rnd() * 0.1)); R(g, sx + 1, sy + 4, 6, 1, 'rgba(0,0,0,0.25)'); R(g, sx + 7, sy + 1, 1, 4, 'rgba(0,0,0,0.2)');
  }
  return c;
}

const catSpr = (skin: number) => makeSprite('cat' + skin, 14, 10, (g) => {
  const col = ['#d89050', '#6a6a72', '#e8e0d0'][skin % 3], dk = shade(col, -0.3);
  R(g, 3, 4, 7, 4, col); R(g, 9, 2, 4, 4, col); R(g, 9, 1, 1, 2, col); R(g, 12, 1, 1, 2, col); R(g, 3, 8, 2, 1, dk); R(g, 8, 8, 2, 1, dk); R(g, 0, 3, 3, 1, col); R(g, 0, 2, 1, 1, col); R(g, 4, 4, 5, 1, dk); R(g, 11, 3, 1, 1, '#2a2'); R(g, 10, 3, 1, 1, '#222');
});
const birdSpr = (w: number) => makeSprite('bird' + w, 8, 6, (g) => { R(g, 2, 2, 4, 3, '#9a9aa8'); R(g, 5, 1, 2, 2, '#7a7a88'); R(g, 7, 2, 1, 1, '#e8a030'); if (w) { R(g, 1, 0, 3, 2, '#8a8a98'); } else { R(g, 2, 4, 3, 2, '#8a8a98'); } R(g, 0, 3, 2, 1, '#7a7a88'); }, false);

const benchSpr = makeSprite('bench', 16, 10, (g) => { R(g, 1, 6, 2, 4, '#4a2e1a'); R(g, 13, 6, 2, 4, '#4a2e1a'); R(g, 0, 3, 16, 3, '#8a5a38'); R(g, 0, 3, 16, 1, '#a87a50'); R(g, 1, 0, 14, 3, '#7a4a2a'); R(g, 1, 0, 14, 1, '#9a6a3a'); });
const crateSpr = makeSprite('crate', 14, 14, (g) => { R(g, 0, 1, 14, 13, '#9a6a38'); R(g, 0, 1, 14, 2, '#c08a50'); R(g, 1, 3, 12, 1, '#6a4420'); R(g, 6, 3, 2, 11, '#6a4420'); R(g, 0, 8, 14, 1, '#6a4420'); R(g, 0, 13, 14, 1, 'rgba(0,0,0,0.3)'); });
const lampSpr = makeSprite('lamp', 10, 26, (g) => { R(g, 4, 6, 2, 20, '#3a3a44'); R(g, 3, 24, 4, 2, '#2a2a34'); R(g, 1, 0, 8, 7, '#3a3a44'); R(g, 2, 1, 6, 5, '#ffe9a0'); R(g, 3, 1, 2, 2, '#fffbe0'); });
const lampOff = makeSprite('lampoff', 10, 26, (g) => { R(g, 4, 6, 2, 20, '#3a3a44'); R(g, 3, 24, 4, 2, '#2a2a34'); R(g, 1, 0, 8, 7, '#3a3a44'); R(g, 2, 1, 6, 5, '#8a8a70'); });
const fountainSpr = makeSprite('fountain', 40, 36, (g) => {
  disc(g, 20, 22, 17, '#8a8a98'); disc(g, 20, 22, 15, '#6a6a7a'); disc(g, 20, 22, 13, '#4a90c0'); R(g, 18, 8, 4, 14, '#9a9aa8'); R(g, 16, 6, 8, 3, '#b0b0be'); disc(g, 20, 6, 3, '#b8b8c8');
});

export class TownScene {
  ground: HTMLCanvasElement; bldg = new Map<string, HTMLCanvasElement>();
  pigeons = Array.from({ length: 6 }, (_, i) => ({ x: 8 + i * 0.7, y: 16.6 + (i % 2) * 0.4, hx: 8 + i * 0.7, hy: 16.6 + (i % 2) * 0.4, fly: 0, ph: i }));
  flock: { x: number; y: number; vx: number; vy: number; n: number } | null = null; flockT = 5;
  private lastNow = 0;
  constructor() {
    seed = 7;
    this.ground = this.paintGround();
    for (const b of TOWN.buildings) this.bldg.set(b.id, paintBuilding(b));
  }

  private paintGround(): HTMLCanvasElement {
    const c = mk(TOWN.w * 16, TOWN.h * 16); const g = c.getContext('2d')!;
    const cobbles = [0, 1, 2].map(paintCobble);
    const paved = new Set<number>(); const K = (x: number, y: number) => y * TOWN.w + x;
    for (let y = 0; y < TOWN.h; y++) for (let x = 7; x <= 12; x++) paved.add(K(x, y));
    for (let y = 11; y <= 17; y++) for (let x = 5; x <= 14; x++) if (Math.hypot(x - 9.5, y - 14) < 4.6) paved.add(K(x, y));
    for (const b of TOWN.buildings) { const e = entryOf(b); if (b.kind === 'portal') { for (let x = 7; x <= 12; x++) paved.add(K(x, e.y)); continue; } const x0 = Math.min(e.x, 7), x1 = Math.max(e.x, 12); for (let x = x0; x <= x1; x++) { paved.add(K(x, e.y)); paved.add(K(x, e.y + 1 > TOWN.h - 2 ? e.y : e.y + 0)); } }
    const GR = ['#4a7c3c', '#437236', '#52853f'];
    for (let y = 0; y < TOWN.h; y++) for (let x = 0; x < TOWN.w; x++) {
      if (paved.has(K(x, y))) {
        g.drawImage(cobbles[(x * 3 + y * 5) % 3], x * 16, y * 16);
        if (!paved.has(K(x - 1, y))) R(g, x * 16, y * 16, 1, 16, 'rgba(0,0,0,0.3)');
        if (!paved.has(K(x + 1, y))) R(g, x * 16 + 15, y * 16, 1, 16, 'rgba(0,0,0,0.3)');
        if (!paved.has(K(x, y - 1))) R(g, x * 16, y * 16, 16, 1, 'rgba(0,0,0,0.3)');
        if (!paved.has(K(x, y + 1))) R(g, x * 16, y * 16 + 15, 16, 1, 'rgba(0,0,0,0.3)');
      } else {
        const base = GR[Math.floor(rnd() * 3)]; R(g, x * 16, y * 16, 16, 16, base);
        for (let i = 0; i < 8; i++) R(g, x * 16 + rnd() * 15, y * 16 + rnd() * 15, 1, 1, shade(base, 0.2));
        for (let i = 0; i < 3; i++) { const px = x * 16 + rnd() * 14 + 1, py = y * 16 + rnd() * 12 + 2; R(g, px, py, 1, 2, shade(base, -0.22)); }
        if (rnd() < 0.1) { const px = x * 16 + 3 + rnd() * 10, py = y * 16 + 3 + rnd() * 10; R(g, px, py, 2, 2, ['#f4f0a0', '#fff', '#f080b0', '#b090ff'][Math.floor(rnd() * 4)]); }
      }
    }
    // anel decorativo da praça
    g.strokeStyle = 'rgba(60,50,40,0.55)'; g.lineWidth = 2; g.beginPath(); g.arc(10 * 16, 14 * 16, 3.6 * 16, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(240,220,160,0.3)'; g.beginPath(); g.arc(10 * 16, 14 * 16, 3.4 * 16, 0, 7); g.stroke();
    // canteiros de flores em frente às casas
    for (const b of TOWN.buildings) if (b.kind === 'house') for (const fx of [b.x + 0.5, b.x + b.w - 1.5]) for (let i = 0; i < 5; i++) { const px = fx * 16 + rnd() * 14, py = (b.y + b.h) * 16 + 18 + rnd() * 4; R(g, px, py + 2, 1, 3, '#2a5a28'); R(g, px - 1, py, 3, 2, ['#e04050', '#f0e060', '#f080b0', '#fff'][i % 4]); }
    return c;
  }

  update(dt: number, town: Town) {
    for (const p of this.pigeons) {
      const d = Math.hypot(p.x - town.player.x, p.y - town.player.y);
      if (d < 2.4 && p.fly <= 0) p.fly = 2.2 + Math.random();
      if (p.fly > 0) { p.fly -= dt; p.y -= dt * 2; p.x += (p.x - town.player.x) * dt; } else { p.x += (p.hx - p.x) * dt * 1.5; p.y += (p.hy - p.y) * dt * 1.5; p.ph += dt * (Math.random() < 0.02 ? 6 : 1); }
    }
    this.flockT -= dt;
    if (this.flockT <= 0) { this.flockT = 12 + Math.random() * 10; const left = Math.random() < 0.5; this.flock = { x: left ? -2 : TOWN.w + 2, y: 3 + Math.random() * 22, vx: left ? 3.5 : -3.5, vy: (Math.random() - 0.5) * 0.6, n: 4 }; }
    if (this.flock) { this.flock.x += this.flock.vx * dt; this.flock.y += this.flock.vy * dt; if (this.flock.x < -4 || this.flock.x > TOWN.w + 4) this.flock = null; }
  }

  /** Desenha a cidade inteira. T.ox/oy já incluem o deslocamento da câmera. */
  draw(g: G, T: Tx, town: Town, now: number, drawPlayer: (x: number, y: number) => void) {
    const { ox, oy, S } = T; const X = (x: number) => ox + x * 16 * S, Y = (y: number) => oy + y * 16 * S;
    const dt = Math.min(0.1, (now - this.lastNow) / 1000); this.lastNow = now; if (dt > 0) this.update(dt, town);
    const night = Town.nightness();
    g.drawImage(this.ground, ox, oy, TOWN.w * 16 * S, TOWN.h * 16 * S);
    // água da fonte (animada) atrás do sprite
    // y-sort
    type It = { y: number; draw: () => void };
    const items: It[] = [];
    const put = (c: HTMLCanvasElement, x: number, y: number, ax: number, ay: number, flip = false) => () => {
      const w = c.width * S, h = c.height * S;
      if (flip) { g.save(); g.translate(X(x), Y(y) - ay * S); g.scale(-1, 1); g.drawImage(c, -ax * S, 0, w, h); g.restore(); } else g.drawImage(c, X(x) - ax * S, Y(y) - ay * S, w, h);
    };
    const shadow = (x: number, y: number, rx: number) => { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(X(x), Y(y), rx * S, rx * 0.35 * S, 0, 0, 7); g.fill(); };
    for (const b of TOWN.buildings) {
      const c = this.bldg.get(b.id)!; const by = b.y + b.h;
      items.push({ y: by - 0.05, draw: () => {
        g.drawImage(c, X(b.x), Y(b.y) - EXTRA * S, c.width * S, c.height * S);
        // placa
        const sx = X(b.x + b.w / 2), sy = Y(b.y + b.h) - (b.kind === 'stall' ? 46 : 38) * S;
        const bw = 36 * S, bh = 12 * S;
        g.fillStyle = '#3a2410'; g.fillRect(sx - bw / 2 - S, sy - S, bw + 2 * S, bh + 2 * S); g.fillStyle = '#7a5230'; g.fillRect(sx - bw / 2, sy, bw, bh);
        const ic = iconCanvas(SIGN_ICON[b.id] ?? 'star', '#e8c040'); g.drawImage(ic, sx - bw / 2 + S, sy + S, 10 * S, 10 * S);
        g.font = `700 ${Math.max(7, 5 * S)}px ui-monospace, monospace`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#ffe9b0'; g.fillText(SIGN_NAME[b.id], sx - bw / 2 + 12 * S, sy + bh / 2 + 0.5 * S, bw - 13 * S);
        if (night > 0.3 && b.kind !== 'stall' && b.kind !== 'portal') { g.fillStyle = `rgba(255,220,120,${0.85 * night})`; for (const wx of [10, b.w * 16 - 17]) g.fillRect(X(b.x) + (wx + 0) * S, Y(b.y + b.h) - (b.h * 16 - 32 - 10 + 0) * S + 0 * S, 6 * S, 6 * S); }
        if (b.kind === 'portal') this.drawPortal(g, X(b.x + b.w / 2), Y(b.y + b.h) - 14 * S, S, now);
      } });
    }
    items.push({ y: TOWN.fountain.y + 1.6, draw: () => {
      const cx = X(TOWN.fountain.x + 1), cy = Y(TOWN.fountain.y + 1.3); const c = fountainSpr;
      shadow(TOWN.fountain.x + 1, TOWN.fountain.y + 1.9, 18); g.drawImage(c, cx - 20 * S, cy - 26 * S, c.width * S, c.height * S);
      // brilho animado da água + jato
      g.fillStyle = 'rgba(200,240,255,0.7)';
      for (let i = 0; i < 9; i++) { const a = now * 0.003 + i * 0.7; g.fillRect(cx + Math.cos(a) * 9 * S, cy - 4 * S + Math.sin(a) * 4 * S, 2 * S, 1 * S); }
      for (let i = 0; i < 6; i++) { const t = ((now * 0.0015 + i / 6) % 1); g.fillStyle = `rgba(210,240,255,${1 - t})`; g.fillRect(cx + (i - 2.5) * 2.4 * S * t, cy - 22 * S + t * t * 18 * S, 1.6 * S, 1.6 * S); }
    } });
    for (const [x, y] of TOWN.trees) items.push({ y: y + 0.9, draw: () => { shadow(x + 0.5, y + 0.9, 11); put(trunkSpr((x + y) % 3), x + 0.5, y + 0.95, 6, 13)(); } });
    for (const [x, y] of TOWN.benches) items.push({ y: y + 0.95, draw: put(benchSpr, x + 0.5, y + 0.95, 8, 9) });
    for (const [x, y] of TOWN.crates) items.push({ y: y + 0.95, draw: put(crateSpr, x + 0.5, y + 0.95, 7, 13) });
    for (const [x, y] of TOWN.lamps) items.push({ y: y + 0.9, draw: put(night > 0.25 ? lampSpr : lampOff, x + 0.5, y + 0.9, 5, 25) });
    for (let i = 0; i < 14; i++) { const x = 6 + (i % 2) * 7 + (i * 3 % 2), y = 3 + i * 1.9; items.push({ y: y + 0.4, draw: put(bushSpr(i % 3), x + 0.3, y + 0.4, 8, 10) }); }
    for (const b of TOWN.buildings) {
      const e = entryOf(b); const nx = e.x + 1.6, ny = b.y + b.h + 0.35;
      items.push({ y: ny, draw: () => {
        shadow(nx, ny, 6); drawPerson(g, X(nx), Y(ny), S, TOWN.buildings.find((q) => q.id === b.id)!.id, b.npc.sprite, -1, now);
        const near = Math.hypot(town.player.x - nx, town.player.y - ny) < 6;
        if (near) { g.font = `700 ${Math.max(8, 4.6 * S)}px ui-monospace, monospace`; g.textAlign = 'center'; g.fillStyle = '#ffe9b0'; g.strokeStyle = '#0a0610'; g.lineWidth = 3; g.strokeText(b.npc.name, X(nx), Y(ny) - 25 * S); g.fillText(b.npc.name, X(nx), Y(ny) - 25 * S); }
        g.fillStyle = '#ffe040'; g.font = `700 ${5 * S}px monospace`; g.textAlign = 'center'; g.fillText('!', X(nx), Y(ny) - (20 + Math.sin(now * 0.006 + b.x) * 1.5) * S);
      } });
    }
    for (const w of town.walkers) {
      const a = Math.min(1, 0.5); void a; const x = w.px + (w.x - w.px) * 0.5, y = w.py + (w.y - w.py) * 0.5;
      if (w.kind === 'cat') items.push({ y, draw: () => { shadow(x, y, 4); const flip = w.face < 0; put(catSpr(w.skin), x, y, 7, 9, flip)(); } });
      else items.push({ y, draw: () => { shadow(x, y, 5); drawPerson(g, X(x), Y(y), S, 'v' + w.skin, TOWN.villagers[w.skin % TOWN.villagers.length].sprite, w.face, now, w.path.length > 0); } });
    }
    for (const p of this.pigeons) items.push({ y: p.y, draw: () => { if (p.fly <= 0) shadow(p.x, p.y, 3); put(birdSpr(p.fly > 0 ? Math.floor(now / 90) % 2 : 0), p.x, p.y - (p.fly > 0 ? 0.6 : 0), 4, 5)(); } });
    items.push({ y: town.player.y, draw: () => { shadow(town.player.x, town.player.y, 5); drawPlayer(X(town.player.x), Y(town.player.y)); } });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();
    // copas das árvores (acima)
    for (const [x, y] of TOWN.trees) { const c = canopySpr((x + y) % 3); const under = Math.abs(town.player.x - (x + 0.5)) < 1.3 && town.player.y < y + 1 && town.player.y > y - 2.4; g.globalAlpha = under ? 0.5 : 0.97; g.drawImage(c, X(x + 0.5) - 19 * S, Y(y + 0.95) - 38 * S, c.width * S, c.height * S); }
    g.globalAlpha = 1;
    // destino do toque
    if (town.dest && town.player.path.length) { const t = (now % 800) / 800; g.strokeStyle = `rgba(255,240,160,${1 - t})`; g.lineWidth = 2; g.beginPath(); g.ellipse(X(town.dest.x), Y(town.dest.y), (3 + t * 6) * S, (1.5 + t * 3) * S, 0, 0, 7); g.stroke(); }
    // bando de pássaros cruzando a cidade (sombra + silhueta)
    if (this.flock) { const f = this.flock; for (let i = 0; i < f.n; i++) { const bx = f.x - i * 0.9 * Math.sign(f.vx), by = f.y + (i % 2) * 0.7 - 2; const fl = Math.floor(now / 110 + i) % 2; g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(X(bx), Y(by + 3), 5 * S, 1.5 * S); g.fillStyle = '#2a2a38'; g.fillRect(X(bx), Y(by), 4 * S, 1.4 * S); g.fillRect(X(bx) - (fl ? 1 : 0) * S, Y(by) - (fl ? 2 : -1) * S, 2 * S, 1.2 * S); g.fillRect(X(bx) + 3 * S, Y(by) - (fl ? 2 : -1) * S, 2 * S, 1.2 * S); } }
    // dia/noite
    if (night > 0.02) {
      const lights: Light[] = [];
      for (const [lx, ly] of TOWN.lamps) lights.push({ x: X(lx + 0.5), y: Y(ly - 0.1), r: 4.6 * 16 * S, color: '#ffd080', i: 0.95 * night });
      for (const b of TOWN.buildings) { const e = entryOf(b); lights.push({ x: X(e.x + 0.5), y: Y(b.y + b.h - 0.5), r: 3.6 * 16 * S, color: '#ffc060', i: 0.8 * night }); }
      lights.push({ x: X(10), y: Y(14), r: 4 * 16 * S, color: '#80c0ff', i: 0.35 * night });
      lights.push({ x: X(town.player.x), y: Y(town.player.y - 0.5), r: 3 * 16 * S, color: '#ffe0a0', i: 0.55 * night });
      renderLighting(g, T.W, T.H, { color: '#080c28', alpha: 0.7 * night }, lights, 0.2);
    } else if (Town.dayPhase() > 0.7 && Town.dayPhase() < 0.8) { g.fillStyle = 'rgba(255,140,60,0.08)'; g.fillRect(0, 0, T.W, T.H); }
  }

  private drawPortal(g: G, cx: number, cy: number, S: number, now: number) {
    // anel de pedra e vórtice animado
    g.fillStyle = '#6a6a78'; g.beginPath(); g.ellipse(cx, cy, 20 * S, 15 * S, 0, 0, 7); g.fill();
    g.fillStyle = '#4a4a58'; g.beginPath(); g.ellipse(cx, cy, 17 * S, 12.5 * S, 0, 0, 7); g.fill();
    for (let i = 0; i < 10; i++) { const a = i * 0.628; g.fillStyle = i % 2 ? '#8a8a98' : '#5a5a68'; g.fillRect(cx + Math.cos(a) * 19 * S - 2 * S, cy + Math.sin(a) * 14 * S - 2 * S, 4 * S, 4 * S); }
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 16 * S); gr.addColorStop(0, '#e8faff'); gr.addColorStop(0.5, '#5ab8ff'); gr.addColorStop(1, '#2a40a0');
    g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, 15 * S, 10.5 * S, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = Math.max(1, S);
    for (let k = 0; k < 3; k++) { g.beginPath(); for (let t = 0; t < 14; t++) { const a = now * 0.004 * (k + 1) * 0.6 + t * 0.35 + k * 2, r = (t / 14) * 13; const x = cx + Math.cos(a) * r * S, y = cy + Math.sin(a) * r * 0.7 * S; t ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  }
}

function drawPerson(g: G, x: number, y: number, S: number, key: string, cfg: Parameters<typeof humanFromCfg>[1], face: number, now: number, walking = false) {
  const img = humanFromCfg(key, cfg);
  const bob = walking ? Math.abs(Math.sin(now * 0.014)) * 1.5 * S : Math.sin(now * 0.003 + x) * 0.3 * S;
  g.save(); g.translate(x, y - bob); g.scale(face < 0 ? -1 : 1, 1); g.drawImage(img, -8 * S, -14 * S, 16 * S, 16 * S); g.restore();
}
export { drawPerson };
export type { Walker };
