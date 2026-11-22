// Dados das lojas: consumíveis, melhorias do ferreiro e serviços da cidade. Para adicionar conteúdo, basta incluir entradas aqui.
import type { IconKey, Mods } from './types';

export interface Consumable {
  id: string; name: string; desc: string; icon: IconKey; col: string;
  price: (lv: number) => number; gems?: number;
  kind: 'boost' | 'teleport';
  boost?: { dur: number; mods: Mods }; // dur em segundos
}

export const CONSUMABLES: Consumable[] = [
  { id: 'buff_atk', name: 'Elixir de Força', desc: '+20% de dano por 10 min.', icon: 'axe', col: '#ff7a4a', price: (l) => 60 + l * 14, kind: 'boost', boost: { dur: 600, mods: { atkPct: 0.2 } } },
  { id: 'buff_def', name: 'Elixir de Pedra', desc: '+35% DEF e -10% dano recebido por 10 min.', icon: 'shield', col: '#8fb4ff', price: (l) => 60 + l * 14, kind: 'boost', boost: { dur: 600, mods: { defPct: 0.35, dmgRed: 0.1 } } },
  { id: 'buff_haste', name: 'Elixir de Rapidez', desc: '+25% vel. de ataque e -15% recarga por 10 min.', icon: 'bolt', col: '#ffe94d', price: (l) => 70 + l * 16, kind: 'boost', boost: { dur: 600, mods: { aspd: 0.25, cdr: 0.15 } } },
  { id: 'buff_drop', name: 'Essência da Sorte', desc: '+40% de chance de drop e +25% de ouro por 10 min.', icon: 'star', col: '#6ee060', price: (l) => 90 + l * 18, kind: 'boost', boost: { dur: 600, mods: { dropPct: 0.4, goldPct: 0.25 } } },
  { id: 'scroll_tp', name: 'Pergaminho de Teleporte', desc: 'Permite trocar de mapa estando em campo, sem voltar à cidade.', icon: 'scroll', col: '#9ad0ff', price: (l) => 120 + l * 10, kind: 'teleport' },
  { id: 'scroll_xp', name: 'Pergaminho de XP', desc: '+50% de XP por 30 min (também vale offline).', icon: 'scroll', col: '#ffd24a', price: () => 0, gems: 4, kind: 'boost', boost: { dur: 1800, mods: { xpPct: 0.5 } } },
];
export const CONS_BY_ID: Record<string, Consumable> = Object.fromEntries(CONSUMABLES.map((c) => [c.id, c]));

/** Melhoria de equipamento: chance de sucesso e custo por nível. */
export const UPGRADE_MAX = 10;
export const upgradeChance = (nextPlus: number) => (nextPlus <= 5 ? 1 : [0, 0, 0, 0, 0, 0, 0.7, 0.6, 0.5, 0.4, 0.3][nextPlus]);
export const upgradeCost = (ilvl: number, nextPlus: number) => Math.round((60 + ilvl * 9) * Math.pow(1.55, nextPlus - 1));
export const plusMult = (plus: number) => 1 + 0.12 * plus;

export const STOCK_HOURS = 3;          // estoque do ferreiro renova a cada X horas
export const BUY_MULT = 6;             // preço de compra = valor de venda × BUY_MULT
export const REPAIR_RATE = 0.9;        // custo de reparo por ponto de durabilidade = ilvl * REPAIR_RATE * raridade

export interface ServiceInfo { id: string; name: string; short: string; desc: string; ready: boolean }
export const SERVICES: ServiceInfo[] = [
  { id: 'ferreiro', name: 'Ferreiro', short: 'Ferreiro', desc: 'Compre armas e armaduras, melhore (+1 a +10) e repare seu equipamento.', ready: true },
  { id: 'itens', name: 'Loja de Itens', short: 'Itens', desc: 'Poções, elixires de buff e pergaminhos.', ready: true },
  { id: 'mercado', name: 'Mercado', short: 'Mercado', desc: 'Venda itens do inventário, individualmente ou por raridade.', ready: true },
  { id: 'portal', name: 'Portal', short: 'Portal', desc: 'Viaje para os mapas desbloqueados.', ready: true },
  { id: 'taverna', name: 'Taverna', short: 'Taverna', desc: 'Contrate mercenários para a party.', ready: true },
  { id: 'guilda', name: 'Guilda dos Aventureiros', short: 'Guilda', desc: 'Troque de classe e reinicie talentos.', ready: true },
  { id: 'templo', name: 'Templo', short: 'Templo', desc: 'Renascimento e bênçãos.', ready: true },
  { id: 'magia', name: 'Loja de Magia', short: 'Magia', desc: 'Livros de skill, runas e encantamentos. (em breve)', ready: false },
  { id: 'banco', name: 'Banco', short: 'Banco', desc: 'Guarde itens e ouro. (em breve)', ready: false },
  { id: 'joalheiro', name: 'Joalheiro', short: 'Joalheiro', desc: 'Anéis, amuletos e gemas. (em breve)', ready: false },
];
