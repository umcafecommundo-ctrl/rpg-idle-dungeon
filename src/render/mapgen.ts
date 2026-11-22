// Geração procedural (pura, sem DOM) do layout de decoração de um mapa, com regras para não bloquear o combate.
import { MAP_ART, type MapArt, type PropKind } from '../data/mapart';
import { mulberry32 } from '../engine/rng';

export const AW = 12, AH = 16; // tamanho da arena em tiles
export interface Prop { kind: PropKind; x: number; y: number; v: number; phase: number }
export interface Obstacle { x: number; y: number; r: number }
export interface LightDef { x: number; y: number; r: number; color: string; i: number; flick: number; phase: number }
export interface Layout { art: MapArt; props: Prop[]; obstacles: Obstacle[]; lights: LightDef[]; streamX: (y: number) => number; seed: number }

/** Raio de colisão por tipo (0 = decoração sem colisão). */
const RADIUS: Partial<Record<PropKind, number>> = { tree: 0.42, bush: 0.34, log: 0.5, rock: 0.34, tomb: 0.4, coffin: 0.5, pillar: 0.4, brazier: 0.3 };
const LIGHT: Partial<Record<PropKind, { r: number; color: string; i: number; flick: number }>> = {
  candle: { r: 2.4, color: '#ffb458', i: 0.55, flick: 0.25 }, brazier: { r: 4.2, color: '#ff9a48', i: 0.8, flick: 0.2 },
};
// área central livre de objetos bloqueadores
const inClear = (x: number, y: number) => x > 2.5 && x < 9.5 && y > 3.0 && y < 14.4;

export function generateLayout(mapId: string, seed: number): Layout | null {
  const art = MAP_ART[mapId]; if (!art) return null;
  const rnd = mulberry32(seed);
  const props: Prop[] = []; const obstacles: Obstacle[] = []; const lights: LightDef[] = [];
  const sp = rnd() * 6.28;
  const streamX = (y: number) => 0.85 + 0.38 * Math.sin(y * 0.55 + sp);
  if (art.stream) for (let y = 1.5; y <= 15.6; y += 0.9) obstacles.push({ x: streamX(y), y, r: 0.78 });

  const sample = (zone: PropRule['zone']): [number, number] => {
    switch (zone) {
      case 'side': { const left = rnd() < 0.5; return [left ? 1.0 + rnd() * 1.4 : 9.6 + rnd() * 1.5, 2.4 + rnd() * 13]; }
      case 'top': return [0.9 + rnd() * 10.2, 1.6 + rnd() * 0.8];
      case 'bottom': return [0.9 + rnd() * 10.2, 14.8 + rnd() * 0.8];
      case 'corner': { const cx = rnd() < 0.5 ? 0.9 : 11.1, cy = rnd() < 0.5 ? 1.8 : 15.2; return [cx, cy]; }
      default: return [0.8 + rnd() * 10.4, 2.2 + rnd() * 13];
    }
  };
  type PropRule = MapArt['props'][number];
  const okPos = (kind: PropKind, x: number, y: number) => {
    const r = RADIUS[kind] ?? 0;
    if (x < 0.4 || x > 11.6 || y < 1.4 || y > 15.6) return false;
    if (art.stream && x < streamX(y) + 0.9 && (r > 0 || kind === 'candle')) return false;
    if (r === 0) return true;
    if (inClear(x, y)) return false;
    for (const o of obstacles) if (Math.hypot(o.x - x, o.y - y) < o.r + r + 0.15) return false;
    return true;
  };
  for (const rule of art.props) {
    let placed = 0, tries = 0;
    while (placed < rule.n && tries < rule.n * 40) {
      tries++;
      const [x, y] = sample(rule.zone);
      if (!okPos(rule.kind, x, y)) continue;
      const group = rule.cluster ? Math.max(1, Math.round(rule.cluster * (0.6 + rnd() * 0.8))) : 1;
      for (let g = 0; g < group && placed < rule.n; g++) {
        const gx = g === 0 ? x : x + (rnd() - 0.5) * 1.8, gy = g === 0 ? y : y + (rnd() - 0.5) * 1.6;
        if (!okPos(rule.kind, gx, gy)) continue;
        const p: Prop = { kind: rule.kind, x: gx, y: gy, v: Math.floor(rnd() * 3), phase: rnd() * 6.28 };
        props.push(p); placed++;
        const r = RADIUS[rule.kind]; if (r) obstacles.push({ x: gx, y: gy, r });
        const L = LIGHT[rule.kind]; if (L) lights.push({ x: gx, y: gy - 0.3, r: L.r, color: L.color, i: L.i, flick: L.flick, phase: p.phase });
      }
    }
  }
  return { art, props, obstacles, lights, streamX, seed };
}
