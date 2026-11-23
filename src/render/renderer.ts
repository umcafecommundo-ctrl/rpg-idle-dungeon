// Renderização do combate em Canvas (mundo em pixel art + HUD desenhado no próprio canvas).
import { MAP_BY_ID } from '../data/maps';
import { ACTIVITY_LABEL } from '../data/types';
import { ARENA_H, ARENA_W, type Actor } from '../engine/battle';
import { fmt, TICK, xpToNext } from '../engine/formulas';
import type { Game } from '../engine/game';
import { iconCanvas } from './icons';
import { mapBackground, spriteFor, tintOf, whiteOf } from './sprites';
import { MapScene } from './mapscene';
import { TownScene } from './townscene';
import { TOWN } from '../data/town';
import { CHEST_LEVEL, VISION } from '../data/onboarding';
import { Town } from '../engine/town';

const FONT = 'ui-monospace, Menlo, Consolas, "Courier New", monospace';

export class Renderer {
  ctx: CanvasRenderingContext2D;
  W = 0; H = 0; dpr = 1; S = 1; ox = 0; oy = 0;
  scene: MapScene | null = null; private sceneKey: unknown = null; townScene: TownScene | null = null;
  private labels: (() => void)[] = []; private lastNow = 0;
  camX = 0; camY = 0; townS = 1;
  constructor(public canvas: HTMLCanvasElement) { this.ctx = canvas.getContext('2d')!; }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(1, Math.round(r.width * this.dpr)); this.H = Math.max(1, Math.round(r.height * this.dpr));
    this.canvas.width = this.W; this.canvas.height = this.H;
    // arena preenche a largura; se sobrar altura, centraliza
    this.S = Math.min(this.W / (ARENA_W * 16), this.H / (ARENA_H * 16));
    this.ox = (this.W - ARENA_W * 16 * this.S) / 2; this.oy = 0;
  }

  toArena(clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect();
    const px = (clientX - r.left) * this.dpr, py = (clientY - r.top) * this.dpr;
    return { x: (px - this.ox) / this.S / 16, y: (py - this.oy) / this.S / 16 };
  }

  toTown(clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect();
    const px = (clientX - r.left) * this.dpr, py = (clientY - r.top) * this.dpr;
    return { x: (px / this.townS) / 16 + this.camX, y: (py / this.townS) / 16 + this.camY };
  }

  private font(px: number, bold = true) { return `${bold ? '700 ' : ''}${Math.round(px)}px ${FONT}`; }
  private text(t: string, x: number, y: number, col: string, px: number, align: CanvasTextAlign = 'center', bold = true) {
    const g = this.ctx; g.font = this.font(px, bold); g.textAlign = align; g.textBaseline = 'middle';
    g.lineWidth = Math.max(2, px / 4); g.strokeStyle = 'rgba(10,6,16,0.9)'; g.lineJoin = 'round'; g.strokeText(t, x, y);
    g.fillStyle = col; g.fillText(t, x, y);
  }
  private bar(x: number, y: number, w: number, h: number, frac: number, col: string, bg = '#1a1020') {
    const g = this.ctx;
    g.fillStyle = '#0a0610'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = bg; g.fillRect(x, y, w, h);
    g.fillStyle = col; g.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, Math.max(1, h * 0.35));
  }

  draw(game: Game, now: number) {
    if (game.scene === 'town') { this.drawTown(game, now); return; }
    const g = this.ctx, S = this.S, b = game.vision?.b ?? game.battle, dpr = this.dpr;
    const alpha = Math.min(1, game.acc / TICK);
    const dt = Math.min(0.1, (now - this.lastNow) / 1000); this.lastNow = now;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#0c0812'; g.fillRect(0, 0, this.W, this.H);
    const map = MAP_BY_ID[game.vision ? VISION.mapId : game.save.mapId];
    // tremor de tela leve em críticos
    if (b.shake > 0) { g.save(); const k = b.shake * 2.2 * S * 0.5; g.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k); }
    // cena em camadas (se o mapa tiver arte própria) — senão, fundo genérico
    if (b.layout && this.sceneKey !== b.layout) { this.scene = new MapScene(map.id, b.layout); this.sceneKey = b.layout; }
    if (!b.layout) { this.scene = null; this.sceneKey = null; }
    if (b.layout && game.vision) { /* visão não usa arte própria */ }
    const sc = this.scene;
    const T = { ox: this.ox, oy: this.oy, S, W: this.W, H: this.H, dpr };
    const bg = mapBackground(map);
    const drawFloorExtension = (img: HTMLCanvasElement) => {
      const rest = this.H - (this.oy + ARENA_H * 16 * S);
      if (rest > 0) { g.drawImage(img, 0, (ARENA_H - 1) * 16, ARENA_W * 16, 16, this.ox, this.oy + ARENA_H * 16 * S, ARENA_W * 16 * S, rest + 1); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, this.oy + ARENA_H * 16 * S, this.W, rest + 1); }
    };
    if (sc) { sc.update(dt); sc.drawGround(g, T); drawFloorExtension(sc.ground); sc.drawWater(g, T, now); }
    else {
      g.drawImage(bg, this.ox, this.oy, ARENA_W * 16 * S, ARENA_H * 16 * S); drawFloorExtension(bg);
      const fl = 0.5 + 0.5 * Math.sin(now * 0.008);
      for (const tx of [21, ARENA_W * 16 - 20]) {
        const gr = g.createRadialGradient(this.ox + tx * S, this.oy + 6 * S, 0, this.ox + tx * S, this.oy + 6 * S, 46 * S);
        gr.addColorStop(0, map.theme.accent + (fl > 0.5 ? '55' : '40')); gr.addColorStop(1, map.theme.accent + '00');
        g.fillStyle = gr; g.fillRect(this.ox, this.oy, ARENA_W * 16 * S, 80 * S);
      }
    }
    // avisos de AoE no chão
    for (const f of b.fx) if (f.kind === 'warn') {
      const p = f.t / f.dur; g.fillStyle = `rgba(255,50,50,${0.12 + 0.22 * p})`; g.strokeStyle = 'rgba(255,80,80,0.8)'; g.lineWidth = 2;
      g.beginPath(); g.arc(this.X(f.x), this.Y(f.y), f.r * 16 * S, 0, 7); g.fill(); g.stroke();
    }
    // atores + objetos ordenados por y
    this.labels = [];
    type It = { y: number; draw: () => void };
    const items: It[] = b.actors.map((a) => ({ y: a.y, draw: () => this.drawActor(a, b, alpha, now) }));
    if (sc) for (const p of sc.items) items.push({ y: p.y, draw: () => sc.drawItem(g, p, T, now) });
    items.sort((p, q) => p.y - q.y);
    for (const it of items) it.draw();
    if (sc) {
      sc.drawCanopies(g, T, b.actors.filter((a) => !a.dead));
      sc.particles.draw(g, T, 'top'); sc.particles.draw(g, T, 'fog');
      sc.fullLighting(g, T, now, b.player.dead ? undefined : { x: b.player.px + (b.player.x - b.player.px) * alpha, y: b.player.py + (b.player.y - b.player.py) * alpha });
    }
    if (!game.vision && game.save.mapId === 'esgoto' && game.level < CHEST_LEVEL) this.drawLockedGate(game.level, now);
    if (game.debugAi && !game.vision) this.drawAiDebug(game);
    for (const l of this.labels) l();
    // efeitos
    for (const f of b.fx) if (f.kind !== 'warn') this.drawFx(f);
    // números
    for (const f of b.floats) {
      const p = f.t / 1.1; const px = (f.big ? 15 : 11) * dpr * (f.big ? 1 + (1 - p) * 0.3 : 1);
      g.globalAlpha = Math.min(1, (1 - p) * 2);
      this.text(f.text, this.X(f.x), this.Y(f.y) - p * 22 * S * 0.6, f.col, px);
      g.globalAlpha = 1;
    }
    if (b.shake > 0) g.restore();
    if (b.flash > 0) { g.fillStyle = `rgba(255,248,200,${Math.min(0.5, b.flash * 0.6)})`; g.fillRect(0, 0, this.W, this.H); }
    if (!game.vision) { this.hud(game, now); this.minimap(game); }
  }

  /** Área bloqueada do mapa inicial: grade de ferro e silhuetas de mobs desconhecidos (“???”). */
  private drawLockedGate(level: number, now: number) {
    const g = this.ctx, S = this.S, dpr = this.dpr;
    const x0 = this.X(8.2), y0 = this.Y(12.6), w = 3.6 * 16 * S, h = 2.9 * 16 * S;
    g.fillStyle = 'rgba(6,4,12,0.78)'; g.fillRect(x0, y0, w, h);
    for (let i = 0; i < 3; i++) { const sx = x0 + w * (0.25 + i * 0.25), sy = y0 + h * 0.62 + Math.sin(now * 0.002 + i) * S; g.fillStyle = '#000'; g.beginPath(); g.ellipse(sx, sy, 5 * S, 6 * S * (i === 1 ? 1.5 : 1), 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,60,60,0.8)'; g.fillRect(sx - 2.5 * S, sy - 2 * S, S, S); g.fillRect(sx + 1.5 * S, sy - 2 * S, S, S); }
    g.strokeStyle = '#6a6a78'; g.lineWidth = Math.max(1, S * 0.8); g.beginPath();
    for (let i = 0; i <= 8; i++) { g.moveTo(x0 + (w * i) / 8, y0); g.lineTo(x0 + (w * i) / 8, y0 + h); } g.moveTo(x0, y0 + h * 0.3); g.lineTo(x0 + w, y0 + h * 0.3); g.moveTo(x0, y0 + h * 0.7); g.lineTo(x0 + w, y0 + h * 0.7); g.stroke();
    this.text('???', x0 + w / 2, y0 + 8 * dpr, '#ff9a9a', 10 * dpr); this.text(`Abre no Nv ${CHEST_LEVEL}`, x0 + w / 2, y0 + h + 8 * dpr, '#cfc0e8', 7.5 * dpr);
    void level;
  }


  /** Depuração da IA: abertura do mapa, heatmap das notas de posição, caminho, alcance, distância ideal e de segurança. */
  private drawAiDebug(game: Game) {
    const g = this.ctx, S = this.S, b = game.battle, a = b.player, d = a.dbg, dpr = this.dpr;
    const map = b.aiMap;
    // mapa de abertura (tiles apertados em vermelho)
    for (let ty = 0; ty < ARENA_H; ty++) for (let tx = 0; tx < ARENA_W; tx++) {
      const i = ty * ARENA_W + tx; const o = map.open[i];
      if (!map.free[i]) { g.fillStyle = 'rgba(255,0,60,0.35)'; g.fillRect(this.X(tx), this.Y(ty), 16 * S, 16 * S); }
      else if (o < 0.6) { g.fillStyle = `rgba(255,120,0,${(0.6 - o) * 0.5})`; g.fillRect(this.X(tx), this.Y(ty), 16 * S, 16 * S); }
    }
    if (!d) return;
    let lo = 1e9, hi = -1e9; for (const c of d.cands) { lo = Math.min(lo, c[2]); hi = Math.max(hi, c[2]); }
    for (const c of d.cands) {
      const t = hi > lo ? (c[2] - lo) / (hi - lo) : 0.5;
      g.fillStyle = `rgba(${Math.round(255 * (1 - t))},${Math.round(80 + 175 * t)},60,0.38)`;
      g.fillRect(this.X(c[0]) - 7 * S, this.Y(c[1]) - 7 * S, 14 * S, 14 * S);
    }
    const ring = (r: number, col: string, dash: number[]) => { g.strokeStyle = col; g.lineWidth = Math.max(1, dpr); g.setLineDash(dash.map((v) => v * dpr)); g.beginPath(); g.ellipse(this.X(a.x), this.Y(a.y), r * 16 * S, r * 16 * S, 0, 0, 7); g.stroke(); g.setLineDash([]); };
    ring(d.range, 'rgba(120,255,120,0.9)', [6, 4]); ring(d.ideal, 'rgba(90,220,255,0.9)', [2, 3]); if (d.safe > 0) ring(d.safe, 'rgba(255,80,80,0.9)', [4, 3]);
    for (const t of d.threats) { g.strokeStyle = t.melee ? '#ff5050' : '#ffb030'; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(this.X(t.x), this.Y(t.y), 5 * S, 0, 7); g.stroke(); }
    if (d.path.length) { g.strokeStyle = '#ffffff'; g.lineWidth = 2 * dpr; g.beginPath(); g.moveTo(this.X(a.x), this.Y(a.y)); for (const p of d.path) g.lineTo(this.X(p.x), this.Y(p.y)); g.stroke(); }
    if (d.dest) { g.fillStyle = '#ffffff'; g.fillRect(this.X(d.dest.x) - 3 * S, this.Y(d.dest.y) - 3 * S, 6 * S, 6 * S); }
    const log = b.aiLog.slice(-4).map((e) => `${e.t.toFixed(1)}s ${e.text}`);
    const lines = [`IA: ${d.mode}${d.emergency ? ' EMERGÊNCIA' : ''}  HP ${Math.round(d.hp * 100)}%  manobra em ${d.dashIn.toFixed(1)}s`, ...log];
    const bh = (lines.length * 10 + 6) * dpr;
    g.fillStyle = 'rgba(10,6,18,0.82)'; g.fillRect(4 * dpr, this.H - 112 * dpr - bh, this.W - 8 * dpr, bh);
    lines.forEach((l, i) => this.text(l.length > 78 ? l.slice(0, 78) + '…' : l, 8 * dpr, this.H - 112 * dpr - bh + 8 * dpr + i * 10 * dpr, i === 0 ? '#9fffb0' : '#cfc0e8', 6.6 * dpr, 'left', i === 0));
  }

  private drawTown(game: Game, now: number) {
    const g = this.ctx, dpr = this.dpr, town = game.town;
    const S = this.S * 12 / 14; this.townS = S; // a cidade mostra 14 tiles de largura
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#0c0812'; g.fillRect(0, 0, this.W, this.H);
    if (!this.townScene) this.townScene = new TownScene();
    const vw = this.W / (16 * S), vh = this.H / (16 * S);
    const p = town.player;
    this.camX = TOWN.w <= vw ? (TOWN.w - vw) / 2 : Math.max(0, Math.min(TOWN.w - vw, p.x - vw / 2));
    this.camY = TOWN.h <= vh ? (TOWN.h - vh) / 2 : Math.max(0, Math.min(TOWN.h - vh, p.y - vh / 2));
    const T = { ox: -this.camX * 16 * S, oy: -this.camY * 16 * S, S, W: this.W, H: this.H, dpr };
    const cls = game.cls.id;
    this.townScene.draw(g, T, town, now, (x, y) => {
      const img = spriteFor('class:' + cls, '');
      const bob = p.path.length ? Math.abs(Math.sin(now * 0.016)) * 1.6 * S : 0;
      g.save(); g.translate(x, y - bob); g.scale(p.face < 0 ? -1 : 1, 1); g.drawImage(img, -8 * S, -14 * S, 16 * S, 16 * S); g.restore();
      this.text(game.cls.name, x, y - 18 * S - bob, '#ffffff', 8.5 * dpr);
    });
    // HUD da cidade
    const pad = 6 * dpr; const w = Math.min(this.W * 0.5, 176 * dpr);
    g.fillStyle = 'rgba(14,8,22,0.62)'; g.fillRect(pad, pad, w, 34 * dpr);
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.strokeRect(pad + 0.5, pad + 0.5, w - 1, 34 * dpr - 1);
    const night = Town.nightness();
    this.text(`${TOWN.name} ${night > 0.4 ? '☾' : '☀'}`, pad + 6 * dpr, pad + 9 * dpr, '#ffe9b0', 10 * dpr, 'left');
    this.text(`Ouro ${fmt(game.save.gold)}   Gemas ${game.save.gems}`, pad + 6 * dpr, pad + 24 * dpr, '#ffd24a', 8.5 * dpr, 'left');
    this.minimap(game);
  }

  private minimap(game: Game) {
    const g = this.ctx, dpr = this.dpr, pad = 6 * dpr;
    const town = game.scene === 'town';
    const w = 44 * dpr, h = town ? w * TOWN.h / TOWN.w : w * ARENA_H / ARENA_W;
    const x = this.W - pad - w, y = (town ? 44 : 56) * dpr + (town ? 0 : 0);
    const mx = (v: number) => x + (v / (town ? TOWN.w : ARENA_W)) * w, my = (v: number) => y + (v / (town ? TOWN.h : ARENA_H)) * h;
    g.globalAlpha = 0.85; g.fillStyle = 'rgba(14,8,22,0.8)'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = town ? '#3a5a30' : (MAP_BY_ID[game.save.mapId].theme.floor); g.fillRect(x, y, w, h);
    const dot = (px: number, py: number, r: number, c: string) => { g.fillStyle = c; g.fillRect(px - r, py - r, r * 2, r * 2); };
    if (town) {
      g.fillStyle = '#8a8478'; g.fillRect(mx(7), y, mx(13) - mx(7), h);
      for (const b of TOWN.buildings) { g.fillStyle = b.roof; g.fillRect(mx(b.x), my(b.y), (b.w / TOWN.w) * w, (b.h / TOWN.h) * h); }
      for (const wk of game.town.walkers) dot(mx(wk.x), my(wk.y), 0.6 * dpr, wk.kind === 'cat' ? '#e0a060' : '#bbb');
      const p = game.town.player; dot(mx(p.x), my(p.y), (1.2 + (Date.now() % 800 < 400 ? 0.5 : 0)) * dpr, '#ffffff');
      if (game.town.dest && p.path.length) dot(mx(game.town.dest.x), my(game.town.dest.y), 1 * dpr, '#ffe040');
    } else {
      const b = game.battle;
      for (const a of b.actors) {
        if (a.dead) continue;
        const boss = a.mob?.boss;
        dot(mx(a.x), my(a.y), (boss ? 2.2 : a.isPlayer ? 1.6 : 1.1) * dpr, a.team === 1 ? (boss ? '#ff2060' : a.variant === 'e' ? '#ffb030' : '#ff6a5a') : a.isPlayer ? '#ffffff' : a.summon ? '#60ffc0' : '#6ab0ff');
      }
    }
    g.globalAlpha = 1; g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; g.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
  }

  private X(x: number) { return this.ox + x * 16 * this.S; }
  private Y(y: number) { return this.oy + y * 16 * this.S; }

  private drawActor(a: Actor, b: import('../engine/battle').Battle, alpha: number, now: number) {
    const g = this.ctx, S = this.S, dpr = this.dpr;
    const x = a.px + (a.x - a.px) * alpha, y = a.py + (a.y - a.py) * alpha;
    const sx = this.X(x), sy = this.Y(y);
    const base = spriteFor(a.sprite, a.color);
    const sc = a.scale;
    const size = 16 * S * sc;
    const moving = Math.abs(a.x - a.px) + Math.abs(a.y - a.py) > 0.004;
    const bob = (moving ? Math.abs(Math.sin(now * 0.016 + a.id)) * 1.6 : Math.sin(now * 0.004 + a.id) * 0.4) * S;
    let lunge = 0;
    if (a.atkAnim > 0 && a.mob) lunge = Math.sin((a.atkAnim / 0.2) * Math.PI) * 2.5 * S * a.face;
    if (a.atkAnim > 0 && !a.mob && a.range < 3) lunge = Math.sin((a.atkAnim / 0.25) * Math.PI) * 2.5 * S * a.face;
    const fly = (a.flying ? -4 * S + Math.sin(now * 0.01 + a.id) * 1.5 * S : 0) - a.air * 16 * S;
    // sombra
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(sx, sy, 6 * S * sc, 2.2 * S * sc, 0, 0, 7); g.fill();
    // aura de elite/chefe
    if (!a.dead && a.golden) { g.fillStyle = '#fff0a0'; for (let i = 0; i < 3; i++) { const an = now * 0.006 + i * 2.1; g.fillRect(sx + Math.cos(an) * 8 * S, sy - 8 * S + Math.sin(an * 1.3) * 6 * S, 2 * S, 2 * S); } }
    if (!a.dead && a.variant !== 'n') {
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.006 + a.id);
      g.strokeStyle = a.variant === 'b' ? `rgba(255,60,60,${0.5 + pulse * 0.4})` : `rgba(255,200,60,${0.4 + pulse * 0.4})`; g.lineWidth = 2;
      g.beginPath(); g.ellipse(sx, sy, 8 * S * sc, 3 * S * sc, 0, 0, 7); g.stroke();
    }
    if (a.summon && !a.dead) { g.strokeStyle = 'rgba(120,255,200,0.7)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(sx, sy, 6 * S, 2.2 * S, 0, 0, 7); g.stroke(); }
    let img = base;
    if (a.golden) img = tintOf(base, a.sprite + 'g', '#ffd040');
    else if (a.summon) img = tintOf(base, a.sprite, '#40ffb0');
    else if (a.variant === 'e') img = tintOf(base, a.sprite + a.color, '#ffc040');
    else if (a.enraged) img = tintOf(base, a.sprite + a.color, '#ff2020');
    else if (a.status.some((s) => s.k === 'freeze')) img = tintOf(base, a.sprite + a.color, '#60d0ff');
    else if (a.status.some((s) => s.k === 'poison')) img = tintOf(base, a.sprite + a.color, '#40ff40');
    if (a.flash > 0 && !a.dead) img = whiteOf(base, a.sprite + a.color);
    g.save();
    if (a.dead) {
      const p = Math.min(1, (b.t - a.deadAt) / 0.8);
      g.globalAlpha = a.isPlayer ? 0.45 : 1 - p;
      g.translate(sx, sy - 4 * S);
      g.rotate(a.face * 1.4);
      g.drawImage(img, -size / 2, -size * 0.6, size, size);
    } else {
      g.translate(sx + lunge, sy - 1 * S + fly - bob);
      if (a.face < 0 === (a.team === 0 && !a.mob ? false : false)) { /* noop */ }
      const flip = a.face < 0 ? -1 : 1;
      // sprites de mobs olham para a direita por padrão; ao andar para a esquerda espelha
      g.scale(flip, 1);
      const squash = a.castAnim > 0 ? 1 + Math.sin((a.castAnim / 0.3) * Math.PI) * 0.1 : 1;
      g.drawImage(img, -size / 2, -size * 0.88 * squash, size, size * squash);
    }
    g.restore();
    if (a.dead) return;
    // status acima da cabeça
    const top = sy - size * 0.95 + fly;
    if (a.status.some((s) => s.k === 'stun' || s.k === 'freeze')) {
      for (let i = 0; i < 3; i++) { const an = now * 0.008 + i * 2.1; g.fillStyle = '#ffe94d'; g.fillRect(sx + Math.cos(an) * 5 * S - S, top - 2 * S + Math.sin(an) * 1.5 * S, 2 * S, 2 * S); }
    }
    if (a.status.some((s) => s.k === 'taunt')) this.text('!', sx, top - 2 * S, '#ff5050', 12 * dpr);
    // nome + barras (desenhados depois da iluminação)
    this.labels.push(() => this.drawLabel(a, b, sx, top, size, sc, dpr));
  }

  private drawLabel(a: Actor, b: import('../engine/battle').Battle, sx: number, top: number, size: number, sc: number, dpr: number) {
    const S = this.S;
    const showName = a.team === 0 || a.variant !== 'n' || b.enemies.length <= 4;
    const bw = Math.max(18 * dpr, 12 * S * Math.min(sc, 1.6));
    let by = top - 5 * dpr; void size;
    if (a.team === 0 && a.maxMp > 0 && !a.summon) { this.bar(sx - bw / 2, by, bw, 2.5 * dpr, a.mp / a.maxMp, '#3a8cff'); by -= 4 * dpr; }
    this.bar(sx - bw / 2, by, bw, 3 * dpr, a.hp / a.maxHp, a.team === 0 ? '#e83a3a' : a.variant === 'b' ? '#c01060' : a.variant === 'e' ? '#e8a020' : '#d04848');
    if (showName) this.text(a.name + (a.team === 1 ? ` ${a.level}` : ''), sx, by - 5 * dpr, a.team === 0 ? (a.summon ? '#8affc8' : a.isPlayer ? '#ffffff' : '#b8d8ff') : a.variant === 'b' ? '#ff6080' : a.variant === 'e' ? '#ffd060' : '#ffb0a0', 8.5 * dpr);
  }

  private drawFx(f: import('../engine/battle').Fx) {
    const g = this.ctx, S = this.S, p = Math.min(1, f.t / f.dur);
    const x = this.X(f.x), y = this.Y(f.y);
    g.save();
    g.globalAlpha = Math.max(0, 1 - p * p);
    g.strokeStyle = f.col; g.fillStyle = f.col; g.lineCap = 'round';
    switch (f.kind) {
      case 'ring': g.lineWidth = 3 * S * (1 - p) + 1; g.beginPath(); g.ellipse(x, y, f.r * 16 * S * (0.2 + p * 0.8), f.r * 16 * S * (0.2 + p * 0.8) * 0.6, 0, 0, 7); g.stroke(); g.globalAlpha *= 0.25; g.fill(); break;
      case 'proj': {
        const x2 = this.X(f.x2), y2 = this.Y(f.y2), px = x + (x2 - x) * p, py = y + (y2 - y) * p;
        g.lineWidth = 2.2 * S * f.r; g.globalAlpha = 1; g.beginPath(); g.moveTo(px - (x2 - x) * 0.18, py - (y2 - y) * 0.18); g.lineTo(px, py); g.stroke();
        g.fillStyle = '#fff'; g.fillRect(px - S, py - S, 2 * S, 2 * S); break;
      }
      case 'bolt': {
        const x2 = this.X(f.x2), y2 = this.Y(f.y2); const seg = 6; const seed = Math.floor(f.t * 30);
        g.lineWidth = 2.4 * S; g.globalAlpha = 1 - p; g.beginPath(); g.moveTo(x, y);
        for (let i = 1; i < seg; i++) { const t = i / seg; g.lineTo(x + (x2 - x) * t + Math.sin(seed * 7 + i * 13) * 5 * S, y + (y2 - y) * t + Math.cos(seed * 5 + i * 11) * 5 * S); }
        g.lineTo(x2, y2); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = S; g.stroke(); break;
      }
      case 'pillar': { const w = f.r * 16 * S * 0.35 * (1 - p * 0.5); g.fillRect(x - w / 2, y - 90 * S * Math.min(1, p * 4), w, 90 * S * Math.min(1, p * 4)); g.globalAlpha *= 0.6; g.beginPath(); g.ellipse(x, y, w * 1.4, w * 0.6, 0, 0, 7); g.fill(); break; }
      case 'slash': { g.lineWidth = 3 * S * (1 - p) + S; g.beginPath(); const d = f.x2 >= 0 ? 1 : -1; g.arc(x, y - 6 * S, 9 * S * f.r, d > 0 ? -1.2 + p * 2 : Math.PI - 0.8 - p * 2, d > 0 ? 0.2 + p * 2 : Math.PI + 1.2 - p * 2); g.stroke(); break; }
      case 'spark': for (let i = 0; i < 8; i++) { const an = i * 0.785 + f.x; const r = (4 + p * 14 * f.r) * S; g.fillRect(x + Math.cos(an) * r, y - 6 * S + Math.sin(an) * r * 0.7, 2 * S, 2 * S); } break;
      case 'rise': for (let i = 0; i < 4; i++) { const ox = (i - 1.5) * 4 * S; g.fillRect(x + ox - S, y - 6 * S - p * 18 * S - i * 2 * S, 2 * S, 6 * S); g.fillRect(x + ox - 3 * S, y - 4 * S - p * 18 * S - i * 2 * S, 6 * S, 2 * S); } break;
      case 'meteor': {
        if (p < 0.6) { const q = p / 0.6; g.globalAlpha = 1; g.beginPath(); g.arc(x - (1 - q) * 30 * S, y - (1 - q) * 120 * S, 5 * S, 0, 7); g.fill(); g.fillStyle = '#fff'; g.fillRect(x - (1 - q) * 30 * S - S, y - (1 - q) * 120 * S - S, 2 * S, 2 * S); }
        else { const q = (p - 0.6) / 0.4; g.globalAlpha = 1 - q; g.lineWidth = 3 * S; g.beginPath(); g.ellipse(x, y, f.r * 16 * S * q, f.r * 16 * S * q * 0.6, 0, 0, 7); g.stroke(); g.globalAlpha *= 0.4; g.fill(); }
        break;
      }
      default: break;
    }
    g.restore();
  }

  private hud(game: Game, now: number) {
    const g = this.ctx, dpr = this.dpr, b = game.battle, p = b.player, d = game.derived;
    const pad = 6 * dpr; const w = Math.min(this.W * 0.46, 170 * dpr);
    // painel
    g.fillStyle = 'rgba(14,8,22,0.62)'; g.fillRect(pad, pad, w, 50 * dpr);
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1; g.strokeRect(pad + 0.5, pad + 0.5, w - 1, 50 * dpr - 1);
    const prest = game.save.rebirths > 0 ? ` ★${game.save.rebirths}` : '';
    this.text(`${game.cls.name}  Nv ${game.level}${prest}`, pad + 6 * dpr, pad + 8 * dpr, game.cls.color, 10 * dpr, 'left');
    const bx = pad + 6 * dpr, bw = w - 12 * dpr;
    this.bar(bx, pad + 16 * dpr, bw, 9 * dpr, p.hp / p.maxHp, '#e83a3a');
    this.text(`${fmt(p.hp)}/${fmt(p.maxHp)}`, bx + bw / 2, pad + 20.5 * dpr, '#fff', 7.5 * dpr);
    this.bar(bx, pad + 28 * dpr, bw, 9 * dpr, p.maxMp ? p.mp / p.maxMp : 0, '#3a8cff');
    this.text(`${fmt(p.mp)}/${fmt(p.maxMp)}`, bx + bw / 2, pad + 32.5 * dpr, '#fff', 7.5 * dpr);
    const need = xpToNext(game.level);
    this.bar(bx, pad + 40 * dpr, bw, 3 * dpr, game.level >= 200 ? 1 : game.char.xp / need, '#e8c040');
    // buffs / debuffs
    const isz = 15 * dpr; let ix = pad, iy = pad + 54 * dpr; let n = 0;
    for (const bf of p.buffs) {
      if (bf.id === 'enrage') continue;
      g.drawImage(iconCanvas(bf.icon, bf.col), ix, iy, isz, isz);
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(ix, iy + isz - 2 * dpr, isz, 2 * dpr);
      g.fillStyle = '#ffe040'; g.fillRect(ix, iy + isz - 2 * dpr, isz * Math.min(1, bf.t / bf.dur), 2 * dpr);
      ix += isz + 2 * dpr; if (++n % 6 === 0) { ix = pad; iy += isz + 2 * dpr; }
    }
    const dcol: Record<string, string> = { stun: '#ffe94d', slow: '#8ad', freeze: '#7fe0ff', burn: '#ff8a3d', poison: '#6ee060', bleed: '#e03030', vuln: '#b46bff', taunt: '#f55' };
    for (const s of p.status) {
      g.fillStyle = dcol[s.k] ?? '#fff'; g.fillRect(ix, iy, isz, isz); g.strokeStyle = '#000'; g.strokeRect(ix + 0.5, iy + 0.5, isz - 1, isz - 1);
      this.text(s.k.slice(0, 2).toUpperCase(), ix + isz / 2, iy + isz / 2, '#000', 6 * dpr);
      ix += isz + 2 * dpr; if (++n % 6 === 0) { ix = pad; iy += isz + 2 * dpr; }
    }
    // party (mercenários)
    let py = (n ? iy + isz + 6 * dpr : pad + 58 * dpr) + 2 * dpr;
    const allies = b.actors.filter((a) => a.team === 0 && !a.isPlayer && !a.summon);
    for (const a of allies) {
      const pw = Math.min(this.W * 0.34, 112 * dpr);
      g.fillStyle = 'rgba(14,8,22,0.55)'; g.fillRect(pad, py, pw, 22 * dpr);
      this.text(a.name, pad + 4 * dpr, py + 6 * dpr, a.dead ? '#888' : '#cfe4ff', 8 * dpr, 'left');
      this.bar(pad + 4 * dpr, py + 11 * dpr, pw - 8 * dpr, 4 * dpr, a.hp / a.maxHp, a.dead ? '#444' : '#4ac060');
      this.bar(pad + 4 * dpr, py + 16.5 * dpr, pw - 8 * dpr, 3 * dpr, a.maxMp ? a.mp / a.maxMp : 0, '#3a8cff');
      py += 25 * dpr;
    }
    // topo direito: mapa/atividade
    const sv = game.save; const map = MAP_BY_ID[sv.mapId];
    const rx = this.W - pad - 38 * dpr; // reserva espaço para a engrenagem
    this.text(map.name, rx, pad + 8 * dpr, '#ffe9b0', 9.5 * dpr, 'right');
    this.text(ACTIVITY_LABEL[sv.activity] + (sv.activity === 'dungeon' ? ` • Andar ${b.floor}` : ''), rx, pad + 19 * dpr, '#cfc0e8', 8.5 * dpr, 'right');
    this.text(`Ouro ${fmt(sv.gold)}`, rx, pad + 30 * dpr, '#ffd24a', 8.5 * dpr, 'right');
    this.text(`Poções ${game.bag.hp}/${game.bag.mp} · Gemas ${sv.gems}`, rx, pad + 41 * dpr, '#ff9aa0', 8 * dpr, 'right');
    // barra do chefe
    const boss = b.actors.find((a) => a.mob?.boss && !a.dead);
    if (boss) {
      const bw2 = Math.min(this.W * 0.6, 240 * dpr), bx2 = (this.W - bw2) / 2, by2 = this.H - 72 * dpr;
      this.text(boss.name + (boss.enraged ? ' (ENFURECIDO)' : ''), this.W / 2, by2 - 8 * dpr, boss.enraged ? '#ff4040' : '#ff90b0', 10 * dpr);
      this.bar(bx2, by2, bw2, 8 * dpr, boss.hp / boss.maxHp, boss.enraged ? '#ff2020' : '#c01060');
    }
    // banner
    if (b.bannerT > 0) {
      g.globalAlpha = Math.min(1, b.bannerT * 1.5);
      this.text(b.banner, this.W / 2, this.H * 0.3, '#fff2b0', 16 * dpr);
      g.globalAlpha = 1;
    }
    if (p.dead) {
      g.fillStyle = 'rgba(40,0,0,0.35)'; g.fillRect(0, 0, this.W, this.H);
      this.text(`Reaparecendo em ${Math.max(0, Math.ceil(b.reviveAt - b.t))}s`, this.W / 2, this.H * 0.42, '#ff9090', 14 * dpr);
    }
    void d; void now;
  }
}
