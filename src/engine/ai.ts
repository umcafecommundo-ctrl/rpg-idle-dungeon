// IA de posicionamento: mapa de abertura, nota de posições candidatas e A*.
import type { AiCfg, AiWeights } from '../data/ai';
import type { Obstacle } from '../render/mapgen';

export const AW = 12, AH = 16;
const MINX = 0.7, MAXX = AW - 0.7, MINY = 1.5, MAXY = AH - 0.7;

export interface AiMap { free: Uint8Array; open: Float32Array; routes: Float32Array; distOpen: Float32Array; obstacles: Obstacle[] }
const K = (tx: number, ty: number) => ty * AW + tx;

export function inBounds(x: number, y: number) { return x >= MINX && x <= MAXX && y >= MINY && y <= MAXY; }
export function freeAt(obs: Obstacle[], x: number, y: number, m = 0.3) {
  if (!inBounds(x, y)) return false;
  for (const o of obs) if (Math.hypot(o.x - x, o.y - y) < o.r + m) return false;
  return true;
}

/** Pré-calcula, para cada tile: livre?, abertura (espaço livre ao redor + rotas de fuga) e distância até a área aberta mais próxima. */
export function buildAiMap(obstacles: Obstacle[]): AiMap {
  const n = AW * AH;
  const free = new Uint8Array(n), open = new Float32Array(n), routes = new Float32Array(n), distOpen = new Float32Array(n).fill(99);
  for (let ty = 0; ty < AH; ty++) for (let tx = 0; tx < AW; tx++) free[K(tx, ty)] = freeAt(obstacles, tx + 0.5, ty + 0.5) ? 1 : 0;
  const f = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < AW && ty < AH && free[K(tx, ty)] === 1;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (let ty = 0; ty < AH; ty++) for (let tx = 0; tx < AW; tx++) {
    let c = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (f(tx + dx, ty + dy)) c++;
    let r = 0;
    for (const [dx, dy] of DIRS) if (f(tx + dx, ty + dy) && f(tx + dx * 2, ty + dy * 2)) r++;
    open[K(tx, ty)] = free[K(tx, ty)] ? c / 25 : 0; routes[K(tx, ty)] = free[K(tx, ty)] ? r / 8 : 0;
  }
  // BFS multi-fonte a partir de tiles bem abertos
  const q: number[] = [];
  for (let i = 0; i < n; i++) if (open[i] >= 0.72 && routes[i] >= 0.75) { distOpen[i] = 0; q.push(i); }
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi]; const cx = c % AW, cy = (c / AW) | 0;
    for (const [dx, dy] of DIRS.slice(0, 4)) { const nx = cx + dx, ny = cy + dy; if (f(nx, ny) && distOpen[K(nx, ny)] > distOpen[c] + 1) { distOpen[K(nx, ny)] = distOpen[c] + 1; q.push(K(nx, ny)); } }
  }
  return { free, open, routes, distOpen, obstacles };
}
export const tileOf = (x: number) => Math.max(0, Math.min(AW - 1, Math.floor(x)));
export const tileOfY = (y: number) => Math.max(0, Math.min(AH - 1, Math.floor(y)));
export function openAt(m: AiMap, x: number, y: number) { return m.open[K(tileOf(x), tileOfY(y))]; }
export function routesAt(m: AiMap, x: number, y: number) { return m.routes[K(tileOf(x), tileOfY(y))]; }

/** Segmento a→b passa por algum obstáculo? (linha de visão) */
export function blocked(obs: Obstacle[], ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  for (const o of obs) {
    let t = ((o.x - ax) * dx + (o.y - ay) * dy) / l2; t = Math.max(0, Math.min(1, t));
    if (Math.hypot(ax + dx * t - o.x, ay + dy * t - o.y) < o.r * 0.85) return true;
  }
  return false;
}

export interface Threat { x: number; y: number; vx: number; vy: number; range: number; spd: number; melee: boolean; stomp?: boolean }
export interface ScoreCtx {
  cfg: AiCfg; w: AiWeights; map: AiMap; ax: number; ay: number; tgt: { x: number; y: number } | null; range: number;
  threats: Threat[]; zones: { x: number; y: number; r: number }[]; cx: number; cy: number; emergency: boolean;
}

export function scorePos(c: ScoreCtx, x: number, y: number): number {
  const { cfg, w, map } = c; let s = 0;
  if (c.tgt) {
    const d = Math.hypot(x - c.tgt.x, y - c.tgt.y);
    s -= w.ideal * Math.abs(d - cfg.ideal);
    if (d > c.range - 0.2) s -= w.range * (d - (c.range - 0.2));
    if (w.los && blocked(map.obstacles, x, y, c.tgt.x, c.tgt.y)) s -= w.los;
  }
  let near = 0, tcx = 0, tcy = 0, tn = 0;
  for (const e of c.threats) {
    const px = e.x + e.vx * 0.5, py = e.y + e.vy * 0.5;           // posição prevista em 0,5 s
    const d = Math.min(Math.hypot(x - px, y - py), Math.hypot(x - e.x, y - e.y));
    if (e.melee) {
      if (d < cfg.safe) s -= w.melee * (cfg.safe - d) * (1 + e.spd / 2.6);
      if (d < e.range + 0.5) s -= w.melee * 2.2;
      tcx += e.x; tcy += e.y; tn++;
    } else {
      if (d < e.range) s -= w.melee * 0.25 * (e.range - d);
      if (w.cover && blocked(map.obstacles, e.x, e.y, x, y)) s += w.cover;
    }
    if (Math.hypot(x - e.x, y - e.y) < cfg.nearR) near++;
  }
  if (near > cfg.maxNear) s -= w.near * (near - cfg.maxNear);
  const o = openAt(map, x, y), r = routesAt(map, x, y);
  s += w.open * o + w.routes * r - w.corner * Math.max(0, 0.65 - o) * 2 - w.corner * Math.max(0, 0.5 - r);
  const dtile = map.distOpen[K(tileOf(x), tileOfY(y))]; if (dtile < 90) s -= 0.4 * dtile * (w.corner / 7);
  for (const z of c.zones) { const d = Math.hypot(x - z.x, y - z.y); if (d < z.r + 0.6) s -= w.danger; }
  s -= w.center * Math.hypot(x - c.cx, y - c.cy);
  const mv = Math.hypot(x - c.ax, y - c.ay);
  s -= w.move * mv; if (mv < 0.6) s += w.stay;
  if (tn && mv > 0.5) { // arco: prefere movimento tangente à direção da ameaça
    const tx = tcx / tn - c.ax, ty = tcy / tn - c.ay, tl = Math.hypot(tx, ty) || 1, vx = (x - c.ax) / mv, vy = (y - c.ay) / mv;
    s += w.arc * Math.abs((vx * ty - vy * tx) / tl);
  }
  return s;
}

/** A* em grade de tiles (8 vizinhos). `avoid` = posições de mobs (custo extra / bloqueio). */
export function astar(map: AiMap, sx: number, sy: number, gx: number, gy: number, avoid: { x: number; y: number }[]): { x: number; y: number }[] | null {
  const s0 = K(tileOf(sx), tileOfY(sy)), g0 = K(tileOf(gx), tileOfY(gy));
  const cost = new Float32Array(AW * AH);
  for (const e of avoid) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const tx = tileOf(e.x) + dx, ty = tileOfY(e.y) + dy; if (tx < 0 || ty < 0 || tx >= AW || ty >= AH) continue;
    cost[K(tx, ty)] += dx === 0 && dy === 0 ? 6 : 2;
  }
  const g = new Float32Array(AW * AH).fill(1e9), prev = new Int16Array(AW * AH).fill(-1), done = new Uint8Array(AW * AH);
  const open: number[] = [s0]; g[s0] = 0;
  const h = (i: number) => Math.hypot((i % AW) - (g0 % AW), ((i / AW) | 0) - ((g0 / AW) | 0));
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (g[open[i]] + h(open[i]) < g[open[bi]] + h(open[bi])) bi = i;
    const c = open.splice(bi, 1)[0]; if (done[c]) continue; done[c] = 1;
    if (c === g0) break;
    const cx = c % AW, cy = (c / AW) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= AW || ny >= AH) continue;
      const ni = K(nx, ny); if (!map.free[ni] && ni !== g0) continue;
      if (dx && dy && (!map.free[K(cx + dx, cy)] || !map.free[K(cx, cy + dy)])) continue; // sem cortar quinas
      const ng = g[c] + (dx && dy ? 1.414 : 1) + cost[ni];
      if (ng < g[ni]) { g[ni] = ng; prev[ni] = c; open.push(ni); }
    }
  }
  if (g[g0] >= 1e9) return null;
  const out: { x: number; y: number }[] = []; let c = g0;
  while (c !== s0 && c >= 0) { out.push({ x: (c % AW) + 0.5, y: ((c / AW) | 0) + 0.5 }); c = prev[c]; }
  out.reverse(); if (out.length) out[out.length - 1] = { x: gx, y: gy };
  return out;
}
