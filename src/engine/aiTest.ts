// Teste automatizado da IA: 100 combates em mapas com cantos/obstáculos. Verifica que o personagem NUNCA salta:
// o deslocamento por tick não pode passar da velocidade permitida (andar ou manobra), e manobras respeitam alcance e colisão.
import { generateLayout } from '../render/mapgen';
import { Battle } from './battle';
import { freeAt } from './ai';
import { TICK } from './formulas';
import { mulberry32 } from './rng';
import { member } from './sim';
import type { Activity } from '../data/types';

const CLASSES = ['arqueiro', 'mago', 'necromante', 'clerigo', 'cavaleiro', 'barbaro'];
const MAPS = ['floresta', 'cripta'];
const ACTS: Activity[] = ['horda', 'solo', 'chefe', 'party'];
const DASH_SPEED = 8;
let fails = 0, maxRatio = 0, maxJump = 0, ticks = 0, besiegedT = 0, maneuvers = 0, interrupted = 0, deaths = 0;
const worst: string[] = [];

for (let i = 0; i < 100; i++) {
  const rnd = mulberry32(i + 1);
  const cls = CLASSES[i % CLASSES.length], mapId = MAPS[i % 2], act = ACTS[Math.floor(i / 6) % ACTS.length];
  const lv = 20 + Math.floor(rnd() * 60);
  const party = [member(cls, lv, true)];
  if (act === 'party') party.push(...['cavaleiro', 'clerigo', 'mago'].filter((c) => c !== cls).slice(0, 3).map((c) => member(c, lv, false)));
  const b = new Battle({ rng: mulberry32(1000 + i), mapId, activity: act, floor: 1, playerLevel: lv, party, fx: false, xpBonus: 0, goldBonus: 0, dropBonus: 0 });
  b.layout = generateLayout(mapId, 500 + i);
  const p = b.player; b.debug = false;
  let prevDead = false, dashStart: { x: number; y: number } | null = null;
  const obs = b.layout!.obstacles;
  for (let t = 0; t < 60 / TICK; t++) {
    const px = p.x, py = p.y, wasDash = !!p.dash;
    b.step(TICK); ticks++;
    if (p.ai?.mode === 'besieged' && !p.dead) besiegedT += TICK;
    if (p.dead || prevDead) { prevDead = p.dead; continue; }   // reaparecer não conta como movimento da IA
    prevDead = p.dead;
    const moved = Math.hypot(p.x - px, p.y - py);
    const allowed = Math.max(p.spd * (1 + (p.m.moveSpd ?? 0)) * TICK, DASH_SPEED * TICK) * 1.1 + 0.12;
    maxRatio = Math.max(maxRatio, moved / allowed); maxJump = Math.max(maxJump, moved);
    if (moved > allowed) { fails++; if (worst.length < 5) worst.push(`combate ${i} (${cls}/${mapId}/${act}) t=${b.t.toFixed(2)} saltou ${moved.toFixed(2)} tiles (máx ${allowed.toFixed(2)}) dash=${!!p.dash}`); }
    if (p.dash && !wasDash) { dashStart = { x: px, y: py }; maneuvers++; }
    if (wasDash && !p.dash && dashStart) {
      const d = Math.hypot(p.x - dashStart.x, p.y - dashStart.y);
      if (d > 2.7) { fails++; worst.push(`manobra ${i}: alcance ${d.toFixed(2)} > 2.7`); }
      dashStart = null;
    }
    if (p.dash) { // durante a manobra: nunca dentro de obstáculo
      if (!freeAt(obs, p.x, p.y, 0.1)) { fails++; worst.push(`manobra ${i}: atravessou obstáculo em (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`); }
    }
  }
  deaths += b.acc.deaths;
  interrupted += 0;
}
console.log(`Combates: 100 | ticks: ${ticks} | maior deslocamento por tick: ${maxJump.toFixed(3)} tiles | razão máx (desloc./permitido): ${maxRatio.toFixed(2)}`);
console.log(`Manobras usadas: ${maneuvers} | tempo em modo cercado: ${besiegedT.toFixed(0)}s | mortes: ${deaths} | falhas: ${fails}`);
if (fails) { console.log('FALHOU:\n' + worst.join('\n')); process.exit(1); }
console.log('OK: nenhum teleporte detectado.');
