// Textos de ajuda (tooltips por toque): o que faz, números exatos e contra qual tipo de mob é bom.
import { KIND_RES } from '../data/mobs';
import { DMG_LABEL, KIND_LABEL, MOB_KINDS, STAT_LABEL, type ClassDef, type DmgType, type Skill, type Stat, type StatusKind } from '../data/types';
import { skillMpCost, type Derived } from '../engine/formulas';

export const STATUS_INFO: Record<StatusKind, { name: string; text: string }> = {
  stun: { name: 'Atordoado', text: 'Não age nem se move enquanto durar. Chefes ficam apenas lentos.' },
  slow: { name: 'Lento', text: 'Move-se a 55% da velocidade.' },
  freeze: { name: 'Congelado', text: 'Imobilizado por completo (chefes ficam lentos).' },
  burn: { name: 'Queimadura', text: 'Dano de fogo por segundo; ignora defesa.' },
  poison: { name: 'Veneno', text: 'Dano por segundo que ignora defesa e BLOQUEIA a regeneração do alvo. Mortos-vivos são imunes.' },
  bleed: { name: 'Sangramento', text: 'Dano físico por segundo que ignora defesa.' },
  vuln: { name: 'Vulnerável', text: 'Recebe mais dano de todas as fontes.' },
  taunt: { name: 'Provocado', text: 'É forçado a atacar quem o provocou.' },
};

const kindsBy = (dmg: DmgType, test: (v: number) => boolean) => MOB_KINDS.filter((k) => test(KIND_RES[k][dmg] ?? 1)).map((k) => KIND_LABEL[k]);

export function skillDetails(s: Skill, d: Derived, level: number): string[] {
  const out: string[] = [];
  const cd = s.cd * (1 - Math.min(0.5, d.mods.cdr ?? 0));
  out.push(`Custo: ${skillMpCost(s.mp, level)} MP · Recarga: ${cd.toFixed(1)}s`);
  const sc = (s.sc ?? 'for') as Stat;
  const base = (d.stats[sc] + d.wAtk) * d.cls.dmgMult + 8 + level * 0.4;
  if (s.pw && s.dmg) {
    const hits = s.hits ?? 1; const mult = 1 + (d.mods.atkPct ?? 0) + (s.dmg === 'fisico' ? d.mods.physPct ?? 0 : d.mods.magPct ?? 0) + (d.mods.elem?.[s.dmg] ?? 0);
    out.push(`Dano: ~${Math.round(base * s.pw * mult)}${hits > 1 ? ` × ${hits} golpes` : ''} de ${DMG_LABEL[s.dmg]} (${Math.round(s.pw * 100)}% de ${STAT_LABEL[sc]})${s.crit ? ' · crítico garantido' : ''}`);
    out.push(s.all ? 'Alvos: todos os inimigos' : s.self ? `Alvos: ${s.n && s.n < 99 ? `até ${s.n}` : 'todos'} num raio de ${s.r} tiles ao redor` : s.r ? `Alvos: área de ${s.r} tiles ao redor do alvo` : (s.n ?? 1) > 1 ? `Alvos: até ${s.n} inimigos encadeados` : 'Alvo: 1 inimigo');
    const strong = kindsBy(s.dmg, (v) => v >= 1.2), weak = kindsBy(s.dmg, (v) => v <= 0.6 && v > 0), imm = kindsBy(s.dmg, (v) => v === 0);
    if (strong.length) out.push(`✔ Bom contra: ${strong.join(', ')}`);
    if (weak.length) out.push(`✘ Resistido por: ${weak.join(', ')}`);
    if (imm.length) out.push(`✘ Imunes: ${imm.join(', ')}`);
  }
  if (s.st) {
    const i = STATUS_INFO[s.st.k]; const dot = ['poison', 'bleed', 'burn'].includes(s.st.k);
    out.push(`${i.name} por ${s.st.d}s${dot && s.st.p ? ` (~${Math.round(base * s.st.p)}/s)` : ''}${s.st.k === 'vuln' && s.st.p ? ` (+${Math.round(s.st.p * 100)}% dano)` : ''} — ${i.text}`);
  }
  if (s.drain) out.push(`Cura ${Math.round(s.drain * 100)}% do dano causado`);
  if (s.heal) out.push(`Cura: ~${Math.round(d.stats.sab * s.heal * (1 + (d.mods.healPct ?? 0)))} HP${s.party ? ' em cada aliado' : ' no aliado mais ferido'}`);
  if (s.buff) { const m = s.buff.mods; const t: string[] = []; const p = (k: keyof typeof m, l: string) => { const v = m[k] as number | undefined; if (v) t.push(`${v > 0 ? '+' : ''}${Math.round(v * 100)}% ${l}`); };
    p('atkPct', 'dano'); p('defPct', 'defesa'); p('aspd', 'vel. de ataque'); p('crit', 'crítico'); p('dmgRed', 'dano recebido ↓'); p('thorns', 'reflexo'); p('lifesteal', 'roubo de vida'); p('regen', 'regen/s'); p('cdr', 'recarga');
    out.push(`Efeito por ${s.buff.d}s${s.buff.party ? ' (grupo)' : ''}: ${t.join(', ')}`); }
  if (s.summon) out.push(`Invoca ${s.summon.n} esqueleto(s) por ${s.summon.d}s (máx. 4 ativos)`);
  if (s.taunt) out.push(`Força inimigos num raio de ${s.r} tiles a atacar você por ${s.taunt}s`);
  return out;
}

export function statDetails(stat: Stat, cls: ClassDef, d: Derived): string[] {
  const hp = Math.round(10 * cls.hpMult * (1 + (d.mods.hpPct ?? 0)));
  const sc = (x: Stat) => cls.basic.sc === x || cls.skills.some((s) => s.sc === x);
  switch (stat) {
    case 'for': return [`+1 FOR = +${cls.dmgMult.toFixed(1)} de dano base${sc('for') ? ' (sua classe usa FOR)' : ' (sua classe NÃO usa FOR)'}`];
    case 'agi': return [`+1 AGI = +0,06% crítico e +0,15% vel. de ataque${sc('agi') ? `, +${cls.dmgMult.toFixed(1)} de dano base` : ''}`];
    case 'int': return [`+1 INT = +3 MP${sc('int') ? `, +${cls.dmgMult.toFixed(1)} de dano base e mais força de invocações` : ''}`];
    case 'vit': return [`+1 VIT = +${hp} HP e +${(0.9 * cls.defMult).toFixed(1)} DEF`];
    case 'sab': return [`+1 SAB = +5 MP, +0,9 RES mágica${sc('sab') ? `, +${cls.dmgMult.toFixed(1)} de dano e cura mais forte` : ''}`];
  }
}
