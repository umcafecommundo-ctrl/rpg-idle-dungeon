// Medidor de eficiência por mapa/atividade: simula as 6 classes no nível atual (sem equipamentos).
import { CLASSES } from '../data/classes';
import type { Activity } from '../data/types';
import { simulate } from './sim';

export interface Eff { classId: string; xpH: number; goldH: number; deathsH: number; minHp: number; risk: 'Baixo' | 'Médio' | 'Alto' | 'Extremo' }
const cache = new Map<string, Eff[]>();

export function mapEfficiency(mapId: string, activity: Activity, level: number, rebirths: number, floor = 1): Eff[] {
  const key = `${mapId}|${activity}|${level}|${rebirths}|${floor}`;
  const hit = cache.get(key); if (hit) return hit;
  const out = CLASSES.map((c) => {
    const r = simulate({ classId: c.id, level, activity, mapId, seconds: 60, seed: 5, rebirths, floor });
    const risk: Eff['risk'] = r.deathsH >= 40 ? 'Extremo' : r.deathsH >= 10 || r.minHpFrac < 0.15 ? 'Alto' : r.minHpFrac < 0.4 ? 'Médio' : 'Baixo';
    return { classId: c.id, xpH: r.xpMin * 60, goldH: r.goldMin * 60, deathsH: r.deathsH, minHp: r.minHpFrac, risk };
  });
  if (cache.size > 60) cache.clear();
  cache.set(key, out);
  return out;
}

