// Simulação da cidade: andar por toque (BFS), aldeões e gatos vagando, ciclo dia/noite. Sem combate.
import { BUILDING_BY_ID, entryOf, TOWN } from '../data/town';

export interface Pt { x: number; y: number }
export interface Walker { id: number; kind: 'villager' | 'cat' | 'player'; x: number; y: number; px: number; py: number; face: number; path: Pt[]; wait: number; spd: number; skin: number; name: string }

const W = TOWN.w, H = TOWN.h;
const key = (x: number, y: number) => y * W + x;

export function buildBlocked(): Uint8Array {
  const b = new Uint8Array(W * H);
  for (let x = 0; x < W; x++) { b[key(x, 0)] = 1; b[key(x, H - 1)] = 1; }
  for (const bd of TOWN.buildings) for (let y = bd.y; y < bd.y + bd.h; y++) for (let x = bd.x; x < bd.x + bd.w; x++) b[key(x, y)] = 1;
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) b[key(TOWN.fountain.x + x, TOWN.fountain.y + y)] = 1;
  for (const [x, y] of TOWN.trees) b[key(x, y)] = 1;
  for (const [x, y] of TOWN.benches) b[key(x, y)] = 1;
  for (const [x, y] of TOWN.crates) b[key(x, y)] = 1;
  b[key(TOWN.chest.x, TOWN.chest.y)] = 1;
  return b;
}

export class Town {
  blocked = buildBlocked();
  t = 0;
  player: Walker;
  walkers: Walker[] = [];
  /** serviço pendente: abre quando o jogador chega à porta */
  pending: string | null = null;
  arrived: string | null = null;
  dest: Pt | null = null;
  chestState: 'locked' | 'ready' | 'open' = 'locked';
  sage = false;
  private nid = 1;

  constructor() {
    this.player = this.mk('player', TOWN.spawn.x, TOWN.spawn.y, 3.4, 0, 'Você');
    TOWN.villagers.forEach((v, i) => { const p = this.randomFree(); const w = this.mk('villager', p.x, p.y, 1.1 + (i % 3) * 0.2, i, v.name); this.walkers.push(w); });
    for (let i = 0; i < 2; i++) { const p = this.randomFree(); this.walkers.push(this.mk('cat', p.x, p.y, 1.4, i, 'Gato')); }
  }
  private mk(kind: Walker['kind'], x: number, y: number, spd: number, skin: number, name: string): Walker {
    return { id: this.nid++, kind, x, y, px: x, py: y, face: 1, path: [], wait: Math.random() * 3, spd, skin, name };
  }
  free(x: number, y: number) { return x >= 0 && y >= 0 && x < W && y < H && !this.blocked[key(x, y)]; }
  randomFree(): Pt {
    for (let i = 0; i < 200; i++) {
      const x = 1 + Math.floor(Math.random() * (W - 2)), y = 1 + Math.floor(Math.random() * (H - 2));
      if (this.free(x, y)) return { x: x + 0.5, y: y + 0.5 };
    }
    return { x: 10.5, y: 21.5 };
  }

  /** BFS em grade 4-direções; retorna o caminho (centros dos tiles) ou null. */
  findPath(from: Pt, to: Pt): Pt[] | null {
    const sx = Math.floor(from.x), sy = Math.floor(from.y);
    let tx = Math.floor(to.x), ty = Math.floor(to.y);
    if (!this.free(tx, ty)) {
      // tile bloqueado: usa o vizinho livre mais próximo
      let best: Pt | null = null, bd = 1e9;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = tx + dx, y = ty + dy; if (this.free(x, y)) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = { x, y }; } } }
      if (!best) return null; tx = best.x; ty = best.y;
    }
    if (sx === tx && sy === ty) return [{ x: tx + 0.5, y: ty + 0.5 }];
    const prev = new Int32Array(W * H).fill(-1); const q = [key(sx, sy)]; prev[key(sx, sy)] = key(sx, sy);
    for (let qi = 0; qi < q.length; qi++) {
      const c = q[qi]; const cx = c % W, cy = (c / W) | 0;
      if (cx === tx && cy === ty) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (this.free(nx, ny) && prev[key(nx, ny)] < 0) { prev[key(nx, ny)] = c; q.push(key(nx, ny)); }
      }
    }
    if (prev[key(tx, ty)] < 0) return null;
    const out: Pt[] = []; let c = key(tx, ty);
    while (c !== key(sx, sy)) { out.push({ x: (c % W) + 0.5, y: ((c / W) | 0) + 0.5 }); c = prev[c]; }
    return out.reverse();
  }

  /** Toque no mundo (coordenadas em tiles). Retorna 'service' se um prédio/NPC foi tocado. */
  tap(wx: number, wy: number): string | null {
    let hit: string | null = null;
    const ch = TOWN.chest;
    if (Math.abs(wx - (ch.x + 0.5)) < 1 && Math.abs(wy - (ch.y + 0.5)) < 1) hit = 'bau';
    else if (this.sage && Math.hypot(wx - (TOWN.sage.x + 0.5), wy - (TOWN.sage.y + 0.2)) < 1.1) hit = 'sabio';
    for (const b of (hit ? [] : TOWN.buildings)) {
      const inBld = wx >= b.x && wx <= b.x + b.w && wy >= b.y - 0.3 && wy <= b.y + b.h + 0.2;
      const e = entryOf(b);
      const nearNpc = Math.hypot(wx - (e.x + 1.6), wy - (b.y + b.h + 0.2)) < 1.1;
      if (inBld || nearNpc) { hit = b.id; break; }
    }
    this.arrived = null;
    if (hit) {
      const e = hit === 'bau' ? { x: ch.x, y: ch.y + 1 } : hit === 'sabio' ? { x: TOWN.sage.x + 1, y: TOWN.sage.y } : entryOf(BUILDING_BY_ID[hit]);
      const path = this.findPath(this.player, { x: e.x + 0.5, y: e.y + 0.5 });
      if (path) { this.player.path = path; this.pending = hit; this.dest = path[path.length - 1]; if (path.length <= 1 && Math.hypot(this.player.x - path[0].x, this.player.y - path[0].y) < 0.6) { this.arrived = hit; this.pending = null; } }
      return hit;
    }
    this.pending = null;
    const path = this.findPath(this.player, { x: wx, y: wy });
    if (path) { this.player.path = path; this.dest = path[path.length - 1]; }
    return null;
  }

  /** Teleporta o jogador para a porta de um serviço (usado ao abrir pelo menu). */
  goTo(id: string) {
    const b = BUILDING_BY_ID[id]; if (!b && id !== 'bau') return;
    const e = id === 'bau' ? { x: TOWN.chest.x, y: TOWN.chest.y + 1 } : entryOf(b); const path = this.findPath(this.player, { x: e.x + 0.5, y: e.y + 0.5 });
    if (path) { this.player.path = path; this.pending = id; this.dest = path[path.length - 1]; }
  }

  private move(w: Walker, dt: number): boolean {
    w.px = w.x; w.py = w.y;
    if (!w.path.length) return false;
    let step = w.spd * dt;
    while (step > 0 && w.path.length) {
      const n = w.path[0]; const dx = n.x - w.x, dy = n.y - w.y, d = Math.hypot(dx, dy);
      if (d <= step) { w.x = n.x; w.y = n.y; w.path.shift(); step -= d; }
      else { w.x += (dx / d) * step; w.y += (dy / d) * step; step = 0; }
      if (Math.abs(dx) > 0.02) w.face = dx > 0 ? 1 : -1;
    }
    return true;
  }

  update(dt: number) {
    this.t += dt;
    const had = this.player.path.length > 0;
    this.move(this.player, dt);
    if (had && !this.player.path.length && this.pending) { this.arrived = this.pending; this.pending = null; }
    for (const w of this.walkers) {
      if (this.move(w, dt)) continue;
      w.wait -= dt;
      if (w.wait <= 0) {
        // vaga por perto (aldeões preferem ruas)
        const r = w.kind === 'cat' ? 4 : 8;
        for (let i = 0; i < 6; i++) {
          const tx = w.x + (Math.random() - 0.5) * r * 2, ty = w.y + (Math.random() - 0.5) * r * 2;
          const p = this.findPath(w, { x: tx, y: ty });
          if (p && p.length < 18) { w.path = p; break; }
        }
        w.wait = 1.5 + Math.random() * 4;
      }
    }
  }

  /** 0..1 — fase do dia; ciclo completo em 6 minutos reais. 0.25 = amanhecer, 0.5 = meio-dia, 0.75 = anoitecer. */
  static dayPhase(now = Date.now()) { return ((now / 360000) + 0.4) % 1; }
  static nightness(now = Date.now()) {
    const p = Town.dayPhase(now); // noite entre 0.78 e 0.97
    const d = Math.min(Math.abs(p - 0.875), 1 - Math.abs(p - 0.875));
    return Math.max(0, Math.min(1, 1.2 - d * 7));
  }
}
