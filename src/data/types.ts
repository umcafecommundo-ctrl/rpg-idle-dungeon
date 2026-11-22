// Tipos compartilhados dos arquivos de dados (classes, skills, mobs, mapas, itens).
export const STATS = ['for', 'agi', 'int', 'vit', 'sab'] as const;
export type Stat = (typeof STATS)[number];
export const STAT_LABEL: Record<Stat, string> = { for: 'FOR', agi: 'AGI', int: 'INT', vit: 'VIT', sab: 'SAB' };
export const STAT_DESC: Record<Stat, string> = {
  for: 'Força: dano corpo a corpo',
  agi: 'Agilidade: dano à distância, crítico, vel. de ataque',
  int: 'Inteligência: dano mágico e invocações',
  vit: 'Vitalidade: HP e defesa',
  sab: 'Sabedoria: MP, cura, dano sagrado e resistência mágica',
};

export const DMG_TYPES = ['fisico', 'fogo', 'gelo', 'raio', 'sagrado', 'sombrio', 'veneno'] as const;
export type DmgType = (typeof DMG_TYPES)[number];
export const DMG_LABEL: Record<DmgType, string> = {
  fisico: 'Físico', fogo: 'Fogo', gelo: 'Gelo', raio: 'Raio', sagrado: 'Sagrado', sombrio: 'Sombrio', veneno: 'Veneno',
};
export const DMG_COLOR: Record<DmgType, string> = {
  fisico: '#e8e0d0', fogo: '#ff8a3d', gelo: '#7fe0ff', raio: '#ffe94d', sagrado: '#fff3a0', sombrio: '#b46bff', veneno: '#6ee060',
};

export const MOB_KINDS = ['fera', 'morto', 'demonio', 'elemental', 'construto', 'voador', 'humanoide'] as const;
export type MobKind = (typeof MOB_KINDS)[number];
export const KIND_LABEL: Record<MobKind, string> = {
  fera: 'Fera', morto: 'Morto-vivo', demonio: 'Demônio', elemental: 'Elemental', construto: 'Construto', voador: 'Voador', humanoide: 'Humanoide',
};

/** Bônus aditivos. Usado por passivas, talentos, equipamentos, buffs e renascimento. */
export interface Mods {
  for?: number; agi?: number; int?: number; vit?: number; sab?: number; // atributos planos
  hp?: number; mp?: number; hpPct?: number; mpPct?: number;
  atkPct?: number;   // dano total
  physPct?: number;  // dano físico
  magPct?: number;   // dano não-físico
  wAtk?: number;     // dano de arma (plano)
  def?: number; mdef?: number; defPct?: number;
  crit?: number; critDmg?: number; aspd?: number; cdr?: number;
  lifesteal?: number; regen?: number; mpRegen?: number; healPct?: number;
  xpPct?: number; goldPct?: number; dropPct?: number;
  dodge?: number; physRed?: number; dmgRed?: number; thorns?: number;
  bossDmg?: number; vsSlow?: number; dotPct?: number; summonPct?: number; moveSpd?: number;
  vs?: Partial<Record<MobKind, number>>;
  elem?: Partial<Record<DmgType, number>>;
}

export type IconKey =
  | 'sword' | 'shield' | 'axe' | 'fist' | 'bow' | 'arrows' | 'flame' | 'snow' | 'bolt' | 'cross'
  | 'heart' | 'skull' | 'drop' | 'star' | 'ring' | 'eye' | 'potion' | 'potionmp' | 'wings' | 'bone' | 'wave';

export type StatusKind = 'stun' | 'slow' | 'freeze' | 'burn' | 'poison' | 'bleed' | 'vuln' | 'taunt';
export type Vfx =
  | 'slash' | 'arrow' | 'rain' | 'fire' | 'ice' | 'bolt' | 'holy' | 'dark' | 'poison' | 'heal'
  | 'buff' | 'shout' | 'quake' | 'summon' | 'drain' | 'smash';

export interface Skill {
  id: string; name: string; lv: number; icon: IconKey; col: string; desc: string;
  kind: 'atk' | 'heal' | 'buff' | 'summon' | 'taunt';
  mp: number; cd: number; vfx: Vfx;
  dmg?: DmgType; sc?: Stat; pw?: number; hits?: number;
  n?: number;        // máximo de alvos
  r?: number;        // raio da AoE (tiles)
  self?: boolean;    // AoE centrada no conjurador
  all?: boolean;     // atinge todos os inimigos
  st?: { k: StatusKind; d: number; p?: number };
  drain?: number;    // % do dano convertido em cura
  heal?: number; party?: boolean;
  buff?: { mods: Mods; d: number; party?: boolean };
  summon?: { n: number; d: number; hp: number; atk: number };
  taunt?: number;
  crit?: boolean;
}

export interface Passive { id: string; name: string; lv: number; desc: string; mods: Mods }
export interface TalentNode { id: string; name: string; desc: string; max: number; mods: Mods }
export interface TalentBranch { name: string; nodes: TalentNode[] }

export interface SpriteCfg {
  hair: string; skin: string; body: string; accent: string; legs: string;
  hat: 'helm' | 'hood' | 'wizard' | 'none' | 'crown'; weapon: 'sword' | 'axe' | 'bow' | 'staff' | 'mace' | 'skullstaff'; shield?: boolean;
}

export interface ClassDef {
  id: string; name: string; role: string; desc: string; strong: string; color: string;
  base: Record<Stat, number>; growth: Record<Stat, number>; preset: Record<Stat, number>;
  hpMult: number; mpMult: number; defMult: number; dmgMult: number;
  ranged: boolean;
  basic: { sc: Stat; dmg: DmgType; interval: number; vfx: Vfx };
  skills: Skill[]; passives: Passive[]; talents: TalentBranch[];
  sprite: SpriteCfg;
}

export interface MobDef {
  id: string; name: string; kind: MobKind;
  hp: number; atk: number; def: number;   // multiplicadores sobre a curva de referência
  spd: number; interval: number; range: number; dmg: DmgType;
  xp: number; gold: number;
  res?: Partial<Record<DmgType, number>>; // sobrescreve a tabela do tipo
  flying?: boolean; slow?: boolean; regen?: number;
  sprite: string; color: string;
  boss?: boolean; mechs?: ('adds' | 'enrage' | 'stomp')[]; scale?: number;
}

export interface MapDef {
  id: string; name: string; desc: string; minLv: number; maxLv: number;
  mobs: { id: string; w: number }[]; boss: string;
  theme: { floor: string; floor2: string; line: string; wall: string; accent: string };
}

export type Activity = 'solo' | 'horda' | 'chefe' | 'dungeon' | 'party';
export const ACTIVITIES: Activity[] = ['solo', 'horda', 'chefe', 'dungeon', 'party'];
export const ACTIVITY_LABEL: Record<Activity, string> = {
  solo: 'Caçada solo', horda: 'Hordas', chefe: 'Chefes', dungeon: 'Dungeon', party: 'Party',
};
export const ACTIVITY_DESC: Record<Activity, string> = {
  solo: 'Poucos mobs por vez. Farm de XP equilibrado.',
  horda: 'Muitos mobs fracos. Dano em área brilha.',
  chefe: 'Um alvo único e forte, com mecânicas.',
  dungeon: 'Andares progressivos, chefe a cada 5.',
  party: 'Você + 3 mercenários contra grupos maiores.',
};

export type Rarity = 'comum' | 'raro' | 'epico' | 'lendario';
export const RARITIES: Rarity[] = ['comum', 'raro', 'epico', 'lendario'];
export const RARITY_LABEL: Record<Rarity, string> = { comum: 'Comum', raro: 'Raro', epico: 'Épico', lendario: 'Lendário' };
export const RARITY_COLOR: Record<Rarity, string> = { comum: '#b8b8c0', raro: '#4aa3ff', epico: '#c06bff', lendario: '#ffa530' };

export const SLOTS = ['arma', 'elmo', 'armadura', 'calca', 'bota', 'anel', 'amuleto'] as const;
export type Slot = (typeof SLOTS)[number];
export const SLOT_LABEL: Record<Slot, string> = {
  arma: 'Arma', elmo: 'Elmo', armadura: 'Armadura', calca: 'Calça', bota: 'Bota', anel: 'Anel', amuleto: 'Amuleto',
};
export interface Item {
  id: string; name: string; slot: Slot; rarity: Rarity; ilvl: number; mods: Mods;
}
