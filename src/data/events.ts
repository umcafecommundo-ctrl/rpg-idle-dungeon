// Tipos e acesso aos dados de eventos (events.json). Edite o JSON para ajustar frequências, recompensas e textos.
import type { Mods } from './types';
import raw from './events.json';

export interface Reward { goldLv?: number; gold?: number; gems?: number; hp?: number; mp?: number; cons?: Record<string, number>; item?: 'tier1' | 'tier2'; xpMult?: number; itemChance?: number }
export interface DailyDef { id: string; title: string; type: 'kill' | 'killKind' | 'boss' | 'invasion' | 'levelup' | 'items' | 'golden'; n: number; reward: Reward }
export interface AchievementDef { id: string; title: string; desc: string; stat: string; n: number; mods: Mods }
export interface EventsData {
  goldenMob: { chance: number; minLevel: number; lifetime: number; fleeSpeed: number; goldMult: number; xpMult: number; gemChance: number };
  invasion: { minLevel: number; intervalMin: number; intervalMax: number; firstDelay: number; total: number; timeLimit: number; aliveCap: number; reward: Reward };
  wanderingBoss: { minLevel: number; intervalMin: number; intervalMax: number; firstDelay: number; durationSec: number; byMap: Record<string, { id: string; text: string }>; reward: Reward };
  timerChest: { intervalMin: number; firstMin: number; maxStack: number; reward: Reward };
  weekend: { saturday: { label: string; xp: number; drop: number }; sunday: { label: string; xp: number; drop: number } };
  daily: { missionCount: number; pool: DailyDef[]; chest: Reward; login: { day: number; text: string; reward: Reward }[] };
  calendar: { when: string; what: string }[];
  achievements: AchievementDef[];
  bestiary: { completeKills: number; completeKillsBoss: number; bonusPerEntry: number; bonusPerBoss: number };
}
export const EVENTS = raw as unknown as EventsData;

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function weekendBonus(d = new Date()): { label: string; xp: number; drop: number } | null {
  const w = d.getDay(); return w === 6 ? EVENTS.weekend.saturday : w === 0 ? EVENTS.weekend.sunday : null;
}
