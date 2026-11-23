// Gera docs/progressao.md: desbloqueios por nível (1–50) e tempo estimado de jogo ativo para chegar a cada um.
import { writeFileSync } from 'node:fs';
import { CLASSES } from '../data/classes';
import { MAPS } from '../data/maps';
import { ACTIVITY_MIN_LEVEL, LEVEL_REWARDS, CHEST_LEVEL } from '../data/onboarding';
import { ACTIVITY_LABEL } from '../data/types';
import { xpToNext, talentPointsFor } from './formulas';
import { defaultMapFor, simulate } from './sim';

const MAXL = 50;
const times: Record<string, number[]> = {}; const goldH: Record<string, number[]> = {};
for (const c of CLASSES) {
  let L = 1, xp = 0, t = 0, seed = 1; const arr = [0, 0]; const gh: number[] = [0, 0];
  while (L < MAXL) {
    const r = simulate({ classId: c.id, level: L, activity: 'solo', mapId: defaultMapFor(L), seconds: 30, seed: seed++ });
    const dxp = r.xpMin / 2; xp += dxp; t += 30; gh[L] = r.goldMin * 60;
    while (xp >= xpToNext(L) && L < MAXL) { xp -= xpToNext(L); L++; arr[L] = t / 60; }
  }
  times[c.id] = arr; goldH[c.id] = gh;
}
const fmtT = (m: number) => (m < 60 ? `${m.toFixed(0)} min` : `${(m / 60).toFixed(1)} h`);
const avg = (l: number) => CLASSES.reduce((a, c) => a + times[c.id][l], 0) / CLASSES.length;
const lines: string[] = ['# Progressão — desbloqueios por nível (1–50)', '', 'Tempo = jogo **ativo** caçando solo no mapa mais avançado liberado, sem equipamentos e sem bônus de evento (mede o piso; equipamentos, eventos, diárias e offline aceleram). Gerado por `npm run prog`.', '',
  '| Nível | Tempo (média) | Mais rápida / mais lenta | Desbloqueios |', '|---|---|---|---|'];
for (let L = 2; L <= MAXL; L++) {
  const un: string[] = [];
  for (const c of CLASSES) { /* skills/passivas listadas em conjunto */ void c; }
  const sk = CLASSES.flatMap((c) => c.skills.filter((s) => s.lv === L).map((s) => `${c.name}: ${s.name}`));
  const ps = CLASSES.flatMap((c) => c.passives.filter((s) => s.lv === L).map((s) => `${c.name}: ${s.name}`));
  if (sk.length) un.push('Habilidade — ' + sk.join('; '));
  if (ps.length) un.push('Passiva — ' + ps.join('; '));
  if (L === CLASSES[0].maneuver.lv) un.push('Manobra (salto/investida/empurrão)');
  for (const m of MAPS) if (m.minLv === L) un.push(`Mapa: ${m.name}`);
  for (const [a, lv] of Object.entries(ACTIVITY_MIN_LEVEL)) if (lv === L && lv > 1) un.push(`Atividade: ${ACTIVITY_LABEL[a as keyof typeof ACTIVITY_LABEL]}`);
  if (LEVEL_REWARDS[L]) un.push('Recompensa: ' + LEVEL_REWARDS[L].text);
  if (L === CHEST_LEVEL) un.push('Baú trancado da cidade abre');
  if (L % 4 === 0) un.push(`+1 ponto de talento (total ${talentPointsFor(L)})`);
  const ts = CLASSES.map((c) => times[c.id][L]);
  lines.push(`| ${L} | ${fmtT(avg(L))} | ${fmtT(Math.min(...ts))} / ${fmtT(Math.max(...ts))} | ${un.join(' · ') || '—'} |`);
}
lines.push('', '## Ritmo por horizonte', '', '- **Curto prazo (2–5 min):** missões iniciais, nível a cada ~30–60 s nos primeiros níveis, baú do cristal (15 min), mob dourado e invasões (a partir do nível 5).', '- **Médio prazo (30 min):** novo mapa/atividade a cada ~5–10 níveis, chefe errante, diárias, equipamentos do Ferreiro (+N).', '- **Longo prazo (dia):** diárias + sequência de login (7 dias), conquistas, bestiário, renascimento (nível 100).', '', '## Ouro por hora (aprox.)', '', '| Nível | Ouro/h (média das classes) |', '|---|---|');
for (const L of [5, 10, 20, 30, 40, 49]) lines.push(`| ${L} | ${Math.round(CLASSES.reduce((a, c) => a + goldH[c.id][L], 0) / CLASSES.length).toLocaleString('pt-BR')} |`);
writeFileSync('docs/progressao.md', lines.join('\n') + '\n');
console.log(lines.slice(0, 30).join('\n'));
