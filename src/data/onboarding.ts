// Sequência de início de jogo (abertura, missões encadeadas, dicas contextuais, recompensas por nível).
// Edite este arquivo para ajustar o ritmo dos primeiros 10 minutos sem mexer no código.
import type { Activity } from './types';

// ───────── Abertura (cena pulável, ~40 s). t = segundos de início de cada cena ─────────
export interface IntroScene { t: number; kind: 'town' | 'attack' | 'fall' | 'crystal' | 'awake'; text: string }
export const INTRO: IntroScene[] = [
  { t: 0, kind: 'town', text: 'Vila Pedrafria. A última cidade livre diante do Abismo.' },
  { t: 7, kind: 'attack', text: 'Mas naquela noite, o Senhor das Sombras rompeu os portões…' },
  { t: 16, kind: 'fall', text: 'O Herói Lendário resistiu até o último suspiro.' },
  { t: 25, kind: 'crystal', text: 'E deixou cair um fragmento de cristal — ainda quente de poder.' },
  { t: 33, kind: 'awake', text: 'Você desperta com ele nas mãos. O cristal absorve a energia de cada monstro que você derrota.' },
];
export const INTRO_LENGTH = 41;

// ───────── Visão do poder final (logo após escolher a classe) ─────────
export const VISION = { seconds: 6.5, level: 100, mapId: 'castelo', caption: 'Isso é o que você vai se tornar.' };

// ───────── Prévia das classes na escolha ─────────
export const CLASS_PREVIEW: Record<string, { tags: string[]; best: string; bars: [string, number][] }> = {
  cavaleiro: { tags: ['Tanque', 'Puxa vários'], best: 'Forte contra hordas e mobs físicos', bars: [['Defesa', 5], ['Dano', 2], ['Mobilidade', 2]] },
  barbaro: { tags: ['Corpo a corpo', 'Roubo de vida'], best: 'Forte contra chefes e alvos únicos', bars: [['Defesa', 3], ['Dano', 5], ['Mobilidade', 3]] },
  arqueiro: { tags: ['Recua e atira', 'Crítico'], best: 'Forte contra voadores e mobs lentos', bars: [['Defesa', 1], ['Dano', 4], ['Mobilidade', 5]] },
  mago: { tags: ['Dano em área', 'Recua e atira'], best: 'Forte contra hordas', bars: [['Defesa', 1], ['Dano', 5], ['Mobilidade', 4]] },
  clerigo: { tags: ['Cura', 'Sagrado'], best: 'Forte contra mortos-vivos e demônios', bars: [['Defesa', 3], ['Dano', 2], ['Suporte', 5]] },
  necromante: { tags: ['Invocação', 'Veneno'], best: 'Forte contra chefes e mobs que regeneram', bars: [['Defesa', 2], ['Dano', 4], ['Invocação', 5]] },
};

// ───────── Desbloqueio de atividades por nível ─────────
export const ACTIVITY_MIN_LEVEL: Record<Activity, number> = { solo: 1, horda: 4, party: 6, chefe: 7, dungeon: 9 };

// ───────── Recompensa a cada nível (1→10): sempre algo novo ─────────
export interface LevelReward { text: string; gold?: number; gems?: number; hp?: number; mp?: number; item?: 'raro_elmo' | 'raro_bota' | 'raro_anel' | 'raro_armadura' }
export const LEVEL_REWARDS: Record<number, LevelReward> = {
  2: { text: 'Poções de presente! A poção automática protege você.', hp: 3, gold: 40 },
  3: { text: 'Um baú trancado foi avistado na cidade…', gold: 60 },
  4: { text: 'Modo Hordas desbloqueado! Muitos mobs, muito XP.', mp: 3, gold: 80 },
  5: { text: 'Nova habilidade desbloqueada!', gems: 1, hp: 2 },
  6: { text: 'Grupo desbloqueado: leve mercenários à batalha.', gold: 150, item: 'raro_elmo' },
  7: { text: 'Modo Chefes desbloqueado. Cada chefe tem mecânicas próprias.', hp: 3, mp: 3 },
  8: { text: 'Botas de viajante: velocidade extra.', item: 'raro_bota', gold: 200 },
  9: { text: 'Masmorras desbloqueadas! Andares progressivos.', gems: 2 },
  10: { text: 'Nível 10! Nova habilidade e o baú da cidade se abre.', gems: 1, item: 'raro_anel' },
  // marcos além do início: sempre há algo a conquistar a cada ~5–10 min de jogo
  12: { text: 'Manobra desbloqueada e a Floresta Sombria está aberta!', gems: 1, gold: 300 },
  15: { text: 'Nova passiva! Um item raro para comemorar.', item: 'raro_armadura', hp: 5, mp: 5 },
  18: { text: 'Bônus de ouro do Ferreiro: hora de melhorar equipamentos (+N).', gold: 800 },
  20: { text: 'Nova habilidade! Ela muda o seu estilo de combate.', gems: 2, item: 'raro_elmo' },
  25: { text: 'Quarto de século! Gemas e poções.', gems: 2, hp: 8, mp: 8 },
  28: { text: 'A Cripta se abre — cuidado com o escuro.', gold: 2000 },
  30: { text: 'Nova passiva e um anel raro.', gems: 2, item: 'raro_anel' },
  35: { text: 'Habilidade avançada desbloqueada!', gems: 3, item: 'raro_bota' },
  40: { text: 'Veterano! Presente do Sábio.', gems: 3, gold: 5000 },
  45: { text: 'O Deserto Maldito aguarda.', gems: 3, item: 'raro_armadura' },
  50: { text: 'Nível 50! Habilidade poderosa e muitas gemas.', gems: 5, item: 'raro_elmo', gold: 10000 },
};

// ───────── Missões encadeadas ─────────
export type QuestGoal = { type: 'kill'; n: number } | { type: 'killMob'; mob: string; n: number } | { type: 'level'; n: number } | { type: 'miniboss'; mob: string } | { type: 'town' } | { type: 'chest' };
export interface QuestReward { text: string; gold?: number; gems?: number; hp?: number; mp?: number; item?: 'espada_iniciante' | 'raro_armadura' | 'cons_atk' }
export interface Quest { id: string; title: string; goal: QuestGoal; reward: QuestReward; hint?: string }
export const QUESTS: Quest[] = [
  { id: 'q1', title: 'Derrote 8 monstros', goal: { type: 'kill', n: 8 }, reward: { text: '+60 ouro e 3 poções de HP', gold: 60, hp: 3 } },
  { id: 'q2', title: 'Derrote 12 ratos', goal: { type: 'killMob', mob: 'rato', n: 12 }, reward: { text: 'Espada do Iniciante (arma rara)', item: 'espada_iniciante' } },
  { id: 'q3', title: 'Alcance o nível 5', goal: { type: 'level', n: 5 }, reward: { text: '+1 gema e 5 poções de HP', gems: 1, hp: 5 } },
  { id: 'q4', title: 'Derrote o Rato Albino', goal: { type: 'miniboss', mob: 'rato_albino' }, reward: { text: 'Armadura rara garantida + 2 gemas', item: 'raro_armadura', gems: 2 } },
  { id: 'q5', title: 'Volte à cidade', goal: { type: 'town' }, reward: { text: 'Uma surpresa o espera…', gold: 100, item: 'cons_atk' } },
  { id: 'q6', title: 'Alcance o nível 10', goal: { type: 'level', n: 10 }, reward: { text: 'Abra o baú trancado da cidade!', gems: 2 } },
  { id: 'q7', title: 'Abra o baú trancado na cidade', goal: { type: 'chest' }, reward: { text: 'Item épico garantido', gold: 300 } },
];
/** O mini-chefe aparece quando esta missão começa. */
export const MINIBOSS_QUEST = 'q4';
export const CHEST_LEVEL = 10;
export const OFFLINE_TEASER_SECONDS = 3600;

// ───────── Dicas contextuais (só aparecem quando a situação acontece) ─────────
export interface Hint { id: string; text: string; target?: 'skillbar' | 'inv' | 'town' | 'char' | 'maps' | 'home'; secs?: number }
export const HINTS: Record<string, Hint> = {
  start: { id: 'start', text: 'Seu herói luta sozinho. O cristal transforma cada vitória em XP. Toque num inimigo para focá-lo.', secs: 7 },
  skill: { id: 'skill', text: 'Habilidade pronta! Toque no ícone para lançar na hora. O “A” liga e desliga o auto-cast.', target: 'skillbar', secs: 7 },
  potion: { id: 'potion', text: 'HP baixo! A poção automática cura sozinha. Compre mais na Loja de Itens da cidade.', target: 'skillbar', secs: 7 },
  item: { id: 'item', text: 'Você achou um item! Veja em Inventário — o que for melhor é equipado automaticamente se o slot estiver vazio.', target: 'inv', secs: 7 },
  levelup: { id: 'levelup', text: 'Subiu de nível! Distribua pontos em Personagem (ou deixe no automático).', target: 'char', secs: 6 },
  town: { id: 'town', text: 'Você já pode visitar a cidade: lojas, ferreiro e mercado. Mas lá você não ganha XP!', target: 'town', secs: 7 },
  death: { id: 'death', text: 'Você caiu, mas volta sozinho. Melhore equipamentos no Ferreiro para sobreviver mais.', secs: 7 },
  boss: { id: 'boss', text: 'Um chefe! Ele tem mecânicas: fique de olho nos círculos vermelhos no chão.', secs: 7 },
  maps: { id: 'maps', text: 'Novos mapas aparecem conforme você sobe de nível. O medidor mostra qual classe rende mais em cada um.', target: 'maps', secs: 7 },
};
