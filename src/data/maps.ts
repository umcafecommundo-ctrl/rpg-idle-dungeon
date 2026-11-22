import type { MapDef } from './types';

export const MAPS: MapDef[] = [
  { id: 'esgoto', name: 'Esgoto', desc: 'Túneis úmidos infestados de roedores e gosmas.', minLv: 1, maxLv: 15,
    mobs: [{ id: 'rato', w: 4 }, { id: 'slime', w: 3 }, { id: 'morcego', w: 2 }], boss: 'rei_rato',
    theme: { floor: '#3a4a44', floor2: '#34423e', line: '#26322e', wall: '#1c2622', accent: '#6ac08a' } },
  { id: 'floresta', name: 'Floresta Sombria', desc: 'Lobos, bandidos e morcegos sob a copa fechada.', minLv: 12, maxLv: 30,
    mobs: [{ id: 'lobo', w: 4 }, { id: 'bandido', w: 3 }, { id: 'morcego', w: 2 }, { id: 'slime', w: 1 }], boss: 'alfa',
    theme: { floor: '#42503a', floor2: '#3a4834', line: '#2a3626', wall: '#1c2a1a', accent: '#9ad060' } },
  { id: 'cripta', name: 'Cripta', desc: 'Mortos-vivos e demônios menores guardam os túmulos.', minLv: 28, maxLv: 50,
    mobs: [{ id: 'esqueleto', w: 4 }, { id: 'zumbi', w: 3 }, { id: 'morcego', w: 1 }, { id: 'imp', w: 1.5 }], boss: 'lich',
    theme: { floor: '#4a4458', floor2: '#423c50', line: '#2e2a3a', wall: '#201c2a', accent: '#a080ff' } },
  { id: 'deserto', name: 'Deserto Maldito', desc: 'Ruínas de areia com golems e saqueadores.', minLv: 45, maxLv: 75,
    mobs: [{ id: 'bandido', w: 3 }, { id: 'golem', w: 2 }, { id: 'esqueleto', w: 2 }, { id: 'morcego', w: 2 }], boss: 'colosso',
    theme: { floor: '#7a6a48', floor2: '#6e6040', line: '#504428', wall: '#3a3020', accent: '#ffd070' } },
  { id: 'vulcao', name: 'Vulcão', desc: 'Elementais de fogo e diabretes em rios de lava.', minLv: 70, maxLv: 110,
    mobs: [{ id: 'elemental', w: 4 }, { id: 'imp', w: 3 }, { id: 'golem', w: 2 }, { id: 'lobo', w: 1 }], boss: 'titan',
    theme: { floor: '#4a3030', floor2: '#422828', line: '#6a2410', wall: '#2a1414', accent: '#ff7030' } },
  { id: 'castelo', name: 'Castelo Demoníaco', desc: 'Legiões infernais protegem o trono do Senhor Demônio.', minLv: 100, maxLv: 150,
    mobs: [{ id: 'imp', w: 4 }, { id: 'esqueleto', w: 2 }, { id: 'golem', w: 2 }, { id: 'bandido', w: 2 }, { id: 'elemental', w: 2 }], boss: 'senhor',
    theme: { floor: '#3e2c40', floor2: '#362438', line: '#5a1830', wall: '#1e1020', accent: '#ff4070' } },
  { id: 'abismo', name: 'Abismo Eterno', desc: 'O fim de todas as coisas. Tudo aqui quer você morto.', minLv: 150, maxLv: 200,
    mobs: [{ id: 'imp', w: 3 }, { id: 'elemental', w: 2 }, { id: 'golem', w: 2 }, { id: 'zumbi', w: 2 }, { id: 'esqueleto', w: 2 }], boss: 'senhor',
    theme: { floor: '#262236', floor2: '#201c2e', line: '#3a2a5a', wall: '#100c1a', accent: '#8a60ff' } },
];
export const MAP_BY_ID: Record<string, MapDef> = Object.fromEntries(MAPS.map((m) => [m.id, m]));
