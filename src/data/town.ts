// Layout da cidade principal (coordenadas em tiles de 16px). Edite aqui para mover/adicionar estabelecimentos.
import type { SpriteCfg } from './types';

export type BuildingKind = 'house' | 'stall' | 'temple' | 'bank' | 'portal';
export interface BuildingDef {
  id: string; kind: BuildingKind; x: number; y: number; w: number; h: number;
  roof: string; roof2: string; wall: string; trim: string;
  icon: string; // emoji/placa
  npc: { name: string; sprite: SpriteCfg };
}
const npc = (hair: string, body: string, accent: string, hat: SpriteCfg['hat'] = 'none', weapon: SpriteCfg['weapon'] = 'mace'): SpriteCfg => ({ hair, skin: '#e0b088', body, accent, legs: '#4a3a30', hat, weapon });

export const TOWN = {
  id: 'cidade', name: 'Vila Pedrafria', w: 20, h: 30, spawn: { x: 10, y: 21.5 },
  buildings: [
    { id: 'ferreiro', kind: 'house', x: 1, y: 2, w: 5, h: 4, roof: '#8a3a2a', roof2: '#6a2a1e', wall: '#a89070', trim: '#4a3020', icon: '⚒', npc: { name: 'Borin', sprite: npc('#5a3a20', '#6a6a72', '#3a3a40', 'none', 'axe') } },
    { id: 'itens', kind: 'house', x: 14, y: 2, w: 5, h: 4, roof: '#3a6aa0', roof2: '#2a4e7a', wall: '#c8b898', trim: '#4a3020', icon: '⚗', npc: { name: 'Lia', sprite: npc('#c04060', '#4a9a5a', '#2a6a3a', 'none', 'staff') } },
    { id: 'banco', kind: 'bank', x: 7, y: 1, w: 6, h: 4, roof: '#7a7a88', roof2: '#5a5a68', wall: '#b8b8c0', trim: '#e8c040', icon: '$', npc: { name: 'Sr. Moeda', sprite: npc('#888', '#2a2a4a', '#e8c040', 'none', 'staff') } },
    { id: 'mercado', kind: 'stall', x: 1, y: 8, w: 5, h: 4, roof: '#c04a3a', roof2: '#f0e0c0', wall: '#8a6a40', trim: '#4a3020', icon: '⚖', npc: { name: 'Dona Berta', sprite: npc('#a06a30', '#c06a3a', '#f0e0c0', 'none', 'mace') } },
    { id: 'templo', kind: 'temple', x: 14, y: 8, w: 5, h: 4, roof: '#e0e0ea', roof2: '#b8b8c8', wall: '#f0f0f4', trim: '#e8c040', icon: '✚', npc: { name: 'Irmã Aurora', sprite: npc('#f0e0a0', '#ffffff', '#e8c040', 'none', 'mace') } },
    { id: 'taverna', kind: 'house', x: 1, y: 17, w: 5, h: 4, roof: '#6a4a2a', roof2: '#4a3018', wall: '#b89868', trim: '#3a2410', icon: '🍺', npc: { name: 'Zeca', sprite: npc('#303030', '#9a3a3a', '#f0e0c0', 'none', 'mace') } },
    { id: 'guilda', kind: 'house', x: 14, y: 17, w: 5, h: 4, roof: '#4a3a8a', roof2: '#352a66', wall: '#a0a0b8', trim: '#e8c040', icon: '⚔', npc: { name: 'Capitã Vera', sprite: npc('#c03030', '#4a4a8a', '#e8c040', 'helm', 'sword') } },
    { id: 'joalheiro', kind: 'house', x: 1, y: 23, w: 5, h: 4, roof: '#2a7a6a', roof2: '#1e5a50', wall: '#d0c8b0', trim: '#e8e8f0', icon: '◆', npc: { name: 'Mestre Opala', sprite: npc('#e0e0e8', '#7a3a8a', '#e8e8f0', 'none', 'staff') } },
    { id: 'magia', kind: 'house', x: 14, y: 23, w: 5, h: 4, roof: '#7a2a8a', roof2: '#561e66', wall: '#a8a0c0', trim: '#c8a0ff', icon: '✦', npc: { name: 'Zahra', sprite: npc('#e8e0f0', '#5a3ab0', '#c8a0ff', 'wizard', 'staff') } },
    { id: 'portal', kind: 'portal', x: 8, y: 26, w: 4, h: 3, roof: '#6a6a78', roof2: '#4a4a58', wall: '#8a8a98', trim: '#7ad0ff', icon: '◎', npc: { name: 'Guardião', sprite: npc('#666', '#8896b0', '#4060c0', 'helm', 'sword') } },
  ] as BuildingDef[],
  fountain: { x: 9, y: 13 },
  lamps: [[7, 7], [12, 7], [7, 11], [12, 11], [7, 16], [12, 16], [7, 20], [12, 20], [7, 25], [12, 25], [6, 4], [13, 4]] as [number, number][],
  trees: [[0, 1], [0, 4], [0, 8], [0, 13], [0, 16], [0, 21], [0, 25], [0, 28], [19, 1], [19, 5], [19, 9], [19, 13], [19, 16], [19, 22], [19, 26], [19, 28],
    [6, 8], [13, 12], [6, 14], [13, 15], [6, 22], [13, 20], [6, 12], [13, 8], [3, 14], [16, 14], [3, 29], [16, 29], [6, 27], [13, 28]] as [number, number][],
  benches: [[7, 13], [12, 14], [8, 17], [11, 17]] as [number, number][],
  crates: [[6, 6], [13, 6], [6, 19], [13, 19]] as [number, number][],
  villagers: [
    { name: 'Aldeão', sprite: npc('#6a4a2a', '#9a8a5a', '#6a5a3a', 'none', 'staff') },
    { name: 'Aldeã', sprite: npc('#e0b040', '#c85a8a', '#8a3a5a', 'none', 'staff') },
    { name: 'Mercador', sprite: npc('#303030', '#3a6a8a', '#e8c040', 'none', 'staff') },
    { name: 'Criança', sprite: npc('#8a5a2a', '#e8d048', '#a89030', 'none', 'staff') },
    { name: 'Soldado', sprite: npc('#444', '#8896b0', '#4060c0', 'helm', 'sword') },
  ],
};
export const BUILDING_BY_ID: Record<string, BuildingDef> = Object.fromEntries(TOWN.buildings.map((b) => [b.id, b]));
export const entryOf = (b: BuildingDef) => ({ x: b.x + Math.floor(b.w / 2), y: b.y + b.h });
