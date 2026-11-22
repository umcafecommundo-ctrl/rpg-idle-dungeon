// Partículas ambientais (coordenadas em tiles da arena). Cada mapa escolhe os tipos em data/mapart.ts.
import type { ParticleKind } from '../data/mapart';
import { AH, AW } from './mapgen';

export interface Tx { ox: number; oy: number; S: number; W: number; H: number; dpr: number }
interface P { k: ParticleKind; x: number; y: number; vx: number; vy: number; ph: number; c: string; sz: number; a: number }

const LEAF = ['#7ab84a', '#5a9a3a', '#c8782a', '#e0a040', '#8a6a2a'];
let fogSprite: HTMLCanvasElement | null = null;
function fogTex() {
  if (fogSprite) return fogSprite;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(200,190,230,0.5)'); gr.addColorStop(1, 'rgba(200,190,230,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); fogSprite = c; return c;
}

export class Particles {
  list: P[] = [];
  constructor(spec: { kind: ParticleKind; n: number }[]) {
    for (const s of spec) for (let i = 0; i < s.n; i++) this.list.push(this.make(s.kind, true));
  }
  private make(k: ParticleKind, init: boolean): P {
    const r = Math.random;
    const base: P = { k, x: r() * AW, y: init ? r() * AH : -0.5, vx: 0, vy: 0, ph: r() * 6.28, c: '#fff', sz: 1, a: 1 };
    switch (k) {
      case 'leaf': base.y = init ? r() * AH : 0.5; base.x = r() * (AW + 4) - 2; base.vy = 0.5 + r() * 0.6; base.vx = 0.25 + r() * 0.3; base.c = LEAF[Math.floor(r() * LEAF.length)]; base.sz = 1 + Math.floor(r() * 2); break;
      case 'butterfly': base.y = 3 + r() * 10; base.vx = 0.8 + r() * 0.5; base.c = ['#f0e060', '#f08ac8', '#80c8ff', '#fff'][Math.floor(r() * 4)]; break;
      case 'mote': base.y = r() * AH; base.vy = -0.12 - r() * 0.12; base.vx = 0.05; base.c = '#fff6b0'; break;
      case 'dust': base.y = r() * AH; base.vy = -0.05 - r() * 0.08; base.vx = (r() - 0.5) * 0.15; base.c = '#d8d0f0'; break;
      case 'fog': base.y = 8 + r() * 9; base.x = r() * (AW + 6) - 3; base.vx = 0.1 + r() * 0.15; base.sz = 3 + r() * 3; base.a = 0.12 + r() * 0.1; break;
    }
    return base;
  }
  update(dt: number) {
    for (const p of this.list) {
      p.ph += dt;
      switch (p.k) {
        case 'leaf': p.x += (p.vx + Math.sin(p.ph * 2) * 0.35) * dt; p.y += p.vy * dt; if (p.y > AH + 0.5 || p.x > AW + 2) Object.assign(p, this.make('leaf', false)); break;
        case 'butterfly': { const h = Math.sin(p.ph * 0.7) * 1.5 + Math.sin(p.ph * 1.9) * 0.8; p.x += Math.cos(h) * p.vx * dt; p.y += Math.sin(h * 1.3) * p.vx * dt * 0.8; if (p.x < -1) p.x = AW + 1; if (p.x > AW + 1) p.x = -1; if (p.y < 2) p.y = 2; if (p.y > AH - 1) p.y = AH - 1; break; }
        case 'mote': p.x += p.vx * dt + Math.sin(p.ph) * 0.05 * dt; p.y += p.vy * dt; if (p.y < 0) { p.y = AH; p.x = Math.random() * AW; } break;
        case 'dust': p.x += p.vx * dt; p.y += p.vy * dt; if (p.y < 1) { p.y = AH; p.x = Math.random() * AW; } if (p.x < 0) p.x = AW; if (p.x > AW) p.x = 0; break;
        case 'fog': p.x += p.vx * dt; if (p.x > AW + 4) { p.x = -4; p.y = 8 + Math.random() * 9; } break;
      }
    }
  }
  /** layer 'fog' desenha só névoa; 'top' desenha o resto. */
  draw(g: CanvasRenderingContext2D, T: Tx, layer: 'fog' | 'top') {
    const { ox, oy, S } = T; const px = (v: number) => Math.max(1, Math.round(v * S));
    for (const p of this.list) {
      if ((p.k === 'fog') !== (layer === 'fog')) continue;
      const x = ox + p.x * 16 * S, y = oy + p.y * 16 * S;
      switch (p.k) {
        case 'leaf': g.fillStyle = p.c; g.fillRect(x, y, px(p.sz + 1), px(p.sz)); break;
        case 'butterfly': { const w = Math.abs(Math.sin(p.ph * 14)) * 2.5 + 0.5; g.fillStyle = p.c; g.fillRect(x - w * S, y - S, w * S, 2 * S); g.fillRect(x + 0.2 * S, y - S, w * S, 2 * S); g.fillStyle = '#222'; g.fillRect(x - 0.3 * S, y - S, 0.6 * S, 2 * S); break; }
        case 'mote': g.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(p.ph * 2)); g.fillStyle = p.c; g.fillRect(x, y, px(1), px(1)); g.globalAlpha = 1; break;
        case 'dust': g.globalAlpha = 0.2 + 0.3 * Math.abs(Math.sin(p.ph)); g.fillStyle = p.c; g.fillRect(x, y, px(0.8), px(0.8)); g.globalAlpha = 1; break;
        case 'fog': { const r = p.sz * 16 * S; g.globalAlpha = p.a; g.drawImage(fogTex(), x - r, y - r * 0.5, r * 2, r); g.globalAlpha = 1; break; }
      }
    }
  }
}
