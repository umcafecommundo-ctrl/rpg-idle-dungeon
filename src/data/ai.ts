// Parâmetros da IA de combate por classe. Distâncias em tiles; pesos da nota de posição ajustáveis ao vivo na tela de debug.
export type TargetPrio = 'nearest' | 'lowhp' | 'danger' | 'advantage';

export interface AiWeights {
  ideal: number;   // penaliza afastar-se da distância ideal do alvo
  range: number;   // penaliza ficar fora do alcance de ataque
  los: number;     // penaliza linha de visão bloqueada
  melee: number;   // penaliza proximidade de mobs corpo a corpo (× velocidade)
  near: number;    // penaliza excesso de mobs por perto
  open: number;    // bônus de espaço livre ao redor
  routes: number;  // bônus de rotas de fuga
  corner: number;  // penalidade de cantos/becos
  danger: number;  // penalidade de áreas de perigo (AoE telegrafada)
  center: number;  // penaliza ficar longe do centro da caçada
  move: number;    // custo de se mover (evita tremedeira)
  stay: number;    // bônus por ficar onde está
  arc: number;     // bônus de recuar em arco (tangente) em vez de linha reta
  cover: number;   // bônus de cobertura contra inimigos à distância
  runway: number;  // penaliza destinos com pouco corredor livre à frente (vai bater na parede)
  area: number;    // bônus pela área alcançável a partir do destino (evita becos)
}
export interface AiCfg {
  style: 'kite' | 'melee';
  ideal: number;          // distância ideal do alvo
  safe: number;           // distância mínima de segurança de mobs corpo a corpo
  maxNear: number;        // quantos mobs aceita por perto
  nearR: number;          // raio que conta como "perto"
  retreatHp: number;      // HP% abaixo do qual recua/foge
  minOpen: number;        // abertura mínima de um tile de destino (0-1)
  radius: number;         // raio de busca de posições (tiles)
  prio: TargetPrio;
  controlSkills: string[];    // skills de controle usadas em mobs que se aproximam
  emergencySkills: string[];  // guardadas para emergência (cerco/HP baixo)
  react: number;              // reage quando o tempo até o contato de um mob corpo a corpo for menor que isto (s)
  w: AiWeights;
}

const KITE: AiWeights = { ideal: 1.6, range: 6, los: 2.2, melee: 3.2, near: 2.5, open: 3, routes: 1.6, corner: 7, danger: 40, center: 0.22, move: 0.16, stay: 0.7, arc: 0.9, cover: 1, runway: 2.2, area: 3 };
const MELEE: AiWeights = { ideal: 2.5, range: 3, los: 0.2, melee: 0.3, near: 2.2, open: 1.2, routes: 0.6, corner: 1, danger: 40, center: 0.12, move: 0.1, stay: 0.6, arc: 0.2, cover: 0, runway: 0.2, area: 0.6 };
const w = (o: Partial<AiWeights>, base = KITE): AiWeights => ({ ...base, ...o });

export const CLASS_AI: Record<string, AiCfg> = {
  arqueiro: { react: 1.7, style: 'kite', ideal: 5.4, safe: 2.6, maxNear: 1, nearR: 2.6, retreatHp: 0.45, minOpen: 0.35, radius: 5, prio: 'advantage', controlSkills: ['arq6'], emergencySkills: [], w: w({}) },
  mago: { react: 1.9, style: 'kite', ideal: 5.8, safe: 3.0, maxNear: 1, nearR: 2.8, retreatHp: 0.5, minOpen: 0.35, radius: 5, prio: 'nearest', controlSkills: ['mag2'], emergencySkills: ['mag4'], w: w({ melee: 3.6 }) },
  necromante: { react: 1.5, style: 'kite', ideal: 5, safe: 2.2, maxNear: 2, nearR: 2.6, retreatHp: 0.4, minOpen: 0.32, radius: 5, prio: 'danger', controlSkills: [], emergencySkills: ['nec6'], w: w({ melee: 2.6 }) },
  clerigo: { react: 1.4, style: 'kite', ideal: 4.6, safe: 2.0, maxNear: 2, nearR: 2.4, retreatHp: 0.4, minOpen: 0.3, radius: 5, prio: 'advantage', controlSkills: ['cle4'], emergencySkills: ['cle6'], w: w({ melee: 2.4 }) },
  cavaleiro: { react: 0.4, style: 'melee', ideal: 1.1, safe: 0, maxNear: 7, nearR: 1.8, retreatHp: 0.2, minOpen: 0.2, radius: 4, prio: 'nearest', controlSkills: [], emergencySkills: [], w: w({}, MELEE) },
  barbaro: { react: 0.4, style: 'melee', ideal: 1.1, safe: 0, maxNear: 4, nearR: 1.8, retreatHp: 0.2, minOpen: 0.28, radius: 4, prio: 'lowhp', controlSkills: [], emergencySkills: [], w: w({ melee: 0.8, near: 3.2 }, MELEE) },
};
export const AI_STEP = 0.2; // intervalo entre reavaliações de posição (s)
