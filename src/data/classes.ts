// Dados das 6 classes: atributos, crescimento, 8 skills ativas, 4 passivas e 3 ramos de talento.
import type { ClassDef, Mods, Skill, TalentBranch } from './types';

const LV = [1, 5, 10, 20, 35, 50, 75, 100];
const PLV = [3, 15, 30, 60];

const br = (name: string, nodes: [string, string, Mods][]): TalentBranch => ({
  name,
  nodes: nodes.map(([n, d, mods], i) => ({ id: `${name}.${i}`, name: n, desc: d, max: 5, mods })),
});
const sk = (i: number, s: Omit<Skill, 'lv'>): Skill => ({ ...s, lv: LV[i] });

// ───────────────────────── Cavaleiro ─────────────────────────
const knight: ClassDef = {
  id: 'cavaleiro', name: 'Cavaleiro', role: 'Tanque',
  desc: 'Muito HP e defesa. Provoca os inimigos e segura a linha de frente.',
  strong: 'Forte contra mobs físicos e grupos.', color: '#8fb4ff',
  base: { for: 8, agi: 5, int: 3, vit: 12, sab: 5 }, growth: { for: 0.8, agi: 0.4, int: 0.2, vit: 1.7, sab: 0.5 },
  preset: { for: 3, agi: 0, int: 0, vit: 5, sab: 1 },
  hpMult: 1.3, mpMult: 0.8, defMult: 2.2, dmgMult: 4.8, ranged: false,
  basic: { sc: 'for', dmg: 'fisico', interval: 1.5, vfx: 'slash' },
  sprite: { hair: '#6a4a2a', skin: '#e8b890', body: '#8896b0', accent: '#4060c0', legs: '#505a70', hat: 'helm', weapon: 'sword', shield: true },
  skills: [
    sk(0, { id: 'cav1', name: 'Golpe de Espada', icon: 'sword', col: '#c8d4ee', kind: 'atk', mp: 4, cd: 3, vfx: 'slash', dmg: 'fisico', sc: 'for', pw: 1.5, desc: 'Golpe poderoso em um alvo.' }),
    sk(1, { id: 'cav2', name: 'Provocar', icon: 'eye', col: '#ff9a5a', kind: 'taunt', mp: 8, cd: 14, vfx: 'shout', taunt: 6, r: 5, buff: { mods: { defPct: 0.25 }, d: 6 }, desc: 'Força inimigos próximos a atacá-lo e +25% DEF por 6s.' }),
    sk(2, { id: 'cav3', name: 'Bater de Escudo', icon: 'shield', col: '#7fb0ff', kind: 'atk', mp: 8, cd: 9, vfx: 'smash', dmg: 'fisico', sc: 'for', pw: 1.4, st: { k: 'stun', d: 2 }, desc: 'Atordoa o alvo por 2s.' }),
    sk(3, { id: 'cav4', name: 'Grito de Guerra', icon: 'wave', col: '#ffcf6a', kind: 'atk', mp: 14, cd: 9, vfx: 'shout', dmg: 'fisico', sc: 'for', pw: 1.7, self: true, r: 2.6, n: 99, st: { k: 'slow', d: 3 }, desc: 'Dano em área ao redor e reduz velocidade.' }),
    sk(4, { id: 'cav5', name: 'Muralha de Aço', icon: 'shield', col: '#9ad0ff', kind: 'buff', mp: 20, cd: 30, vfx: 'buff', buff: { mods: { defPct: 0.6, dmgRed: 0.25 }, d: 10 }, desc: '+60% DEF e -25% dano recebido por 10s.' }),
    sk(5, { id: 'cav6', name: 'Redemoinho', icon: 'ring', col: '#e8e0d0', kind: 'atk', mp: 24, cd: 12, vfx: 'slash', dmg: 'fisico', sc: 'for', pw: 2.7, self: true, r: 2.6, n: 99, desc: 'Giro devastador atingindo todos ao redor.' }),
    sk(6, { id: 'cav7', name: 'Represália', icon: 'heart', col: '#ff6a6a', kind: 'buff', mp: 30, cd: 28, vfx: 'buff', buff: { mods: { thorns: 0.6, regen: 0.02 }, d: 10 }, desc: 'Reflete 60% do dano e regenera 2% HP/s por 10s.' }),
    sk(7, { id: 'cav8', name: 'Juízo Final', icon: 'star', col: '#fff0a0', kind: 'atk', mp: 60, cd: 40, vfx: 'quake', dmg: 'sagrado', sc: 'for', pw: 5.5, all: true, n: 99, st: { k: 'stun', d: 1.5 }, desc: 'Julgamento que atinge todos os inimigos.' }),
  ],
  passives: [
    { id: 'cavp1', name: 'Armadura Pesada', lv: PLV[0], desc: '+15% DEF', mods: { defPct: 0.15 } },
    { id: 'cavp2', name: 'Pele de Ferro', lv: PLV[1], desc: '-20% dano físico recebido', mods: { physRed: 0.2 } },
    { id: 'cavp3', name: 'Vigor', lv: PLV[2], desc: '+15% HP, regenera 0.5%/s', mods: { hpPct: 0.15, regen: 0.005 } },
    { id: 'cavp4', name: 'Mestre do Escudo', lv: PLV[3], desc: 'Reflete 10% do dano', mods: { thorns: 0.1 } },
  ],
  talents: [
    br('Bastião', [['Couraça', '+4% DEF/rank', { defPct: 0.04 }], ['Vitalidade', '+4% HP/rank', { hpPct: 0.04 }], ['Inabalável', '-2% dano recebido/rank', { dmgRed: 0.02 }]]),
    br('Sentinela', [['Espinhos', '+4% reflexo/rank', { thorns: 0.04 }], ['Provocador', '+3% FOR/rank', { atkPct: 0.03 }], ['Caçador de Bestas', '+5% vs Fera/rank', { vs: { fera: 0.05, humanoide: 0.05 } }]]),
    br('Paladino', [['Fé', '+4% dano sagrado/rank', { elem: { sagrado: 0.04 } }], ['Cura Divina', '+0.3% regen/rank', { regen: 0.003 }], ['Julgador', '+5% vs Morto/Demônio/rank', { vs: { morto: 0.05, demonio: 0.05 } }]]),
  ],
};

// ───────────────────────── Bárbaro ─────────────────────────
const barb: ClassDef = {
  id: 'barbaro', name: 'Bárbaro', role: 'Dano corpo a corpo',
  desc: 'Dano alto, roubo de vida e defesa média. Esmaga alvos únicos.',
  strong: 'Forte contra mobs únicos e chefes físicos.', color: '#ff7a4a',
  base: { for: 12, agi: 6, int: 2, vit: 10, sab: 3 }, growth: { for: 1.8, agi: 0.6, int: 0.1, vit: 1.1, sab: 0.2 },
  preset: { for: 6, agi: 1, int: 0, vit: 3, sab: 0 },
  hpMult: 1.1, mpMult: 0.7, defMult: 1.0, dmgMult: 2.8, ranged: false,
  basic: { sc: 'for', dmg: 'fisico', interval: 1.3, vfx: 'slash' },
  sprite: { hair: '#c0401c', skin: '#e0a070', body: '#a0602c', accent: '#702010', legs: '#503020', hat: 'none', weapon: 'axe' },
  skills: [
    sk(0, { id: 'bar1', name: 'Golpe Brutal', icon: 'axe', col: '#ff9a6a', kind: 'atk', mp: 4, cd: 3, vfx: 'slash', dmg: 'fisico', sc: 'for', pw: 1.8, desc: 'Machadada pesada.' }),
    sk(1, { id: 'bar2', name: 'Sede de Sangue', icon: 'drop', col: '#e03030', kind: 'atk', mp: 8, cd: 8, vfx: 'drain', dmg: 'fisico', sc: 'for', pw: 1.8, drain: 0.4, desc: 'Converte 40% do dano em vida.' }),
    sk(2, { id: 'bar3', name: 'Machado Giratório', icon: 'ring', col: '#ffb070', kind: 'atk', mp: 12, cd: 7, vfx: 'slash', dmg: 'fisico', sc: 'for', pw: 1.7, self: true, r: 2.2, n: 4, desc: 'Atinge até 4 inimigos ao redor.' }),
    sk(3, { id: 'bar4', name: 'Rugido', icon: 'wave', col: '#ffd060', kind: 'buff', mp: 15, cd: 30, vfx: 'shout', buff: { mods: { atkPct: 0.3, aspd: 0.2 }, d: 14 }, desc: '+30% dano e +20% vel. de ataque por 14s.' }),
    sk(4, { id: 'bar5', name: 'Golpe Sísmico', icon: 'fist', col: '#d0a060', kind: 'atk', mp: 22, cd: 14, vfx: 'quake', dmg: 'fisico', sc: 'for', pw: 4.2, st: { k: 'stun', d: 1.5 }, desc: 'Pancada colossal que atordoa.' }),
    sk(5, { id: 'bar6', name: 'Despedaçar', icon: 'axe', col: '#ff5040', kind: 'atk', mp: 24, cd: 12, vfx: 'smash', dmg: 'fisico', sc: 'for', pw: 3.6, st: { k: 'bleed', d: 8, p: 0.45 }, desc: 'Causa sangramento por 8s.' }),
    sk(6, { id: 'bar7', name: 'Frenesi', icon: 'flame', col: '#ff4020', kind: 'buff', mp: 30, cd: 45, vfx: 'buff', buff: { mods: { aspd: 0.5, lifesteal: 0.2 }, d: 15 }, desc: '+50% vel. de ataque, +20% roubo de vida por 15s.' }),
    sk(7, { id: 'bar8', name: 'Ira do Titã', icon: 'fist', col: '#ffe070', kind: 'atk', mp: 60, cd: 40, vfx: 'quake', dmg: 'fisico', sc: 'for', pw: 10, crit: true, desc: 'Golpe crítico garantido de poder imenso.' }),
  ],
  passives: [
    { id: 'barp1', name: 'Fúria', lv: PLV[0], desc: '+10% dano', mods: { atkPct: 0.1 } },
    { id: 'barp2', name: 'Pele Grossa', lv: PLV[1], desc: '+12% HP', mods: { hpPct: 0.12 } },
    { id: 'barp3', name: 'Sanguinário', lv: PLV[2], desc: '+6% roubo de vida', mods: { lifesteal: 0.06 } },
    { id: 'barp4', name: 'Executor', lv: PLV[3], desc: '+30% dano contra elites e chefes', mods: { bossDmg: 0.3 } },
  ],
  talents: [
    br('Selvageria', [['Brutalidade', '+4% dano/rank', { atkPct: 0.04 }], ['Golpes Fatais', '+2% crítico/rank', { crit: 0.02 }], ['Sede', '+1.5% roubo de vida/rank', { lifesteal: 0.015 }]]),
    br('Resistência', [['Couro Duro', '+4% HP/rank', { hpPct: 0.04 }], ['Teimosia', '-2% dano recebido/rank', { dmgRed: 0.02 }], ['Regeneração', '+0.3% regen/rank', { regen: 0.003 }]]),
    br('Caçador de Chefes', [['Matador', '+5% dano em elite/chefe/rank', { bossDmg: 0.05 }], ['Golpe Rápido', '+3% vel. ataque/rank', { aspd: 0.03 }], ['Carniceiro', '+5% vs Fera/Humanoide/rank', { vs: { fera: 0.05, humanoide: 0.05 } }]]),
  ],
};

// ───────────────────────── Arqueiro ─────────────────────────
const archer: ClassDef = {
  id: 'arqueiro', name: 'Arqueiro', role: 'Dano à distância',
  desc: 'Crítico e velocidade de ataque altos, mas frágil.',
  strong: 'Forte contra mobs voadores e lentos.', color: '#7fe070',
  base: { for: 6, agi: 12, int: 3, vit: 6, sab: 4 }, growth: { for: 0.5, agi: 1.8, int: 0.2, vit: 0.7, sab: 0.4 },
  preset: { for: 0, agi: 6, int: 0, vit: 3, sab: 1 },
  hpMult: 0.9, mpMult: 0.8, defMult: 0.7, dmgMult: 1.65, ranged: true,
  basic: { sc: 'agi', dmg: 'fisico', interval: 1.1, vfx: 'arrow' },
  sprite: { hair: '#8a5a2a', skin: '#e8b890', body: '#3a8a40', accent: '#205a28', legs: '#5a4a30', hat: 'hood', weapon: 'bow' },
  skills: [
    sk(0, { id: 'arq1', name: 'Tiro Preciso', icon: 'bow', col: '#b8e890', kind: 'atk', mp: 4, cd: 2.5, vfx: 'arrow', dmg: 'fisico', sc: 'agi', pw: 1.7, desc: 'Flecha certeira.' }),
    sk(1, { id: 'arq2', name: 'Chuva de Flechas', icon: 'arrows', col: '#90e060', kind: 'atk', mp: 12, cd: 8, vfx: 'rain', dmg: 'fisico', sc: 'agi', pw: 1.5, r: 2.0, n: 99, desc: 'Flechas caem numa área.' }),
    sk(2, { id: 'arq3', name: 'Tiro Duplo', icon: 'bow', col: '#d0f0a0', kind: 'atk', mp: 10, cd: 5, vfx: 'arrow', dmg: 'fisico', sc: 'agi', pw: 1.4, hits: 2, desc: 'Dispara duas flechas.' }),
    sk(3, { id: 'arq4', name: 'Flecha Venenosa', icon: 'drop', col: '#60d050', kind: 'atk', mp: 14, cd: 10, vfx: 'poison', dmg: 'veneno', sc: 'agi', pw: 1.2, st: { k: 'poison', d: 8, p: 0.5 }, desc: 'Envenena o alvo por 8s.' }),
    sk(4, { id: 'arq5', name: 'Olhar de Águia', icon: 'eye', col: '#ffe060', kind: 'buff', mp: 20, cd: 30, vfx: 'buff', buff: { mods: { crit: 0.25, aspd: 0.25 }, d: 14 }, desc: '+25% crítico e +25% vel. ataque por 14s.' }),
    sk(5, { id: 'arq6', name: 'Flecha Gélida', icon: 'snow', col: '#8ee8ff', kind: 'atk', mp: 22, cd: 12, vfx: 'ice', dmg: 'gelo', sc: 'agi', pw: 3.4, st: { k: 'slow', d: 5 }, desc: 'Dano de gelo e lentidão.' }),
    sk(6, { id: 'arq7', name: 'Saraivada', icon: 'arrows', col: '#c0ff80', kind: 'atk', mp: 34, cd: 18, vfx: 'rain', dmg: 'fisico', sc: 'agi', pw: 1.3, hits: 6, n: 4, all: true, desc: '6 rajadas em inimigos aleatórios.' }),
    sk(7, { id: 'arq8', name: 'Flecha do Destino', icon: 'star', col: '#ffe880', kind: 'atk', mp: 55, cd: 35, vfx: 'arrow', dmg: 'fisico', sc: 'agi', pw: 9, crit: true, desc: 'Tiro crítico garantido.' }),
  ],
  passives: [
    { id: 'arqp1', name: 'Olhos de Falcão', lv: PLV[0], desc: '+8% crítico', mods: { crit: 0.08 } },
    { id: 'arqp2', name: 'Mãos Ágeis', lv: PLV[1], desc: '+15% vel. de ataque', mods: { aspd: 0.15 } },
    { id: 'arqp3', name: 'Caçador de Aves', lv: PLV[2], desc: '+40% dano contra Voadores e mobs lentos', mods: { vs: { voador: 0.4 }, vsSlow: 0.4 } },
    { id: 'arqp4', name: 'Evasão', lv: PLV[3], desc: '+12% esquiva, +30% dano crítico', mods: { dodge: 0.12, critDmg: 0.3 } },
  ],
  talents: [
    br('Precisão', [['Mira', '+2% crítico/rank', { crit: 0.02 }], ['Dano Crítico', '+8% dano crít./rank', { critDmg: 0.08 }], ['Flecha Afiada', '+4% dano/rank', { atkPct: 0.04 }]]),
    br('Velocidade', [['Disparo Rápido', '+3% vel. ataque/rank', { aspd: 0.03 }], ['Recarga', '+3% redução de recarga/rank', { cdr: 0.03 }], ['Pés Leves', '+2% esquiva/rank', { dodge: 0.02 }]]),
    br('Caçador', [['Rastreador', '+6% vs Voador/rank', { vs: { voador: 0.06 }, vsSlow: 0.06 }], ['Veneno Letal', '+8% dano em DoT/rank', { dotPct: 0.08 }], ['Sobrevivência', '+4% HP/rank', { hpPct: 0.04 }]]),
  ],
};

// ───────────────────────── Mago ─────────────────────────
const mage: ClassDef = {
  id: 'mago', name: 'Mago', role: 'Dano mágico em área',
  desc: 'AoE elemental de fogo, gelo e raio. Pouco HP e depende de MP.',
  strong: 'Forte contra hordas.', color: '#c08aff',
  base: { for: 2, agi: 4, int: 13, vit: 4, sab: 8 }, growth: { for: 0.1, agi: 0.4, int: 1.9, vit: 0.5, sab: 0.9 },
  preset: { for: 0, agi: 0, int: 6, vit: 2, sab: 2 },
  hpMult: 0.8, mpMult: 1.4, defMult: 0.5, dmgMult: 0.85, ranged: true,
  basic: { sc: 'int', dmg: 'fogo', interval: 1.4, vfx: 'fire' },
  sprite: { hair: '#e8e0f0', skin: '#e8b890', body: '#6a3ab0', accent: '#a070e0', legs: '#4a2a80', hat: 'wizard', weapon: 'staff' },
  skills: [
    sk(0, { id: 'mag1', name: 'Bola de Fogo', icon: 'flame', col: '#ff8a3d', kind: 'atk', mp: 7, cd: 3, vfx: 'fire', dmg: 'fogo', sc: 'int', pw: 2.0, r: 1.3, n: 99, desc: 'Explosão de fogo em área.' }),
    sk(1, { id: 'mag2', name: 'Raio Gélido', icon: 'snow', col: '#7fe0ff', kind: 'atk', mp: 9, cd: 5, vfx: 'ice', dmg: 'gelo', sc: 'int', pw: 2.0, st: { k: 'slow', d: 4 }, desc: 'Gelo em um alvo, causa lentidão.' }),
    sk(2, { id: 'mag3', name: 'Corrente de Raios', icon: 'bolt', col: '#ffe94d', kind: 'atk', mp: 14, cd: 7, vfx: 'bolt', dmg: 'raio', sc: 'int', pw: 1.9, n: 5, desc: 'Raio que salta entre até 5 inimigos.' }),
    sk(3, { id: 'mag4', name: 'Nova de Gelo', icon: 'snow', col: '#a8f0ff', kind: 'atk', mp: 22, cd: 12, vfx: 'ice', dmg: 'gelo', sc: 'int', pw: 2.5, self: true, r: 3.2, n: 99, st: { k: 'freeze', d: 1.6 }, desc: 'Congela todos ao redor.' }),
    sk(4, { id: 'mag5', name: 'Chuva de Meteoros', icon: 'flame', col: '#ff5a20', kind: 'atk', mp: 36, cd: 15, vfx: 'fire', dmg: 'fogo', sc: 'int', pw: 3.8, r: 2.6, n: 99, desc: 'Meteoros devastam uma grande área.' }),
    sk(5, { id: 'mag6', name: 'Tempestade', icon: 'bolt', col: '#fff070', kind: 'atk', mp: 46, cd: 18, vfx: 'bolt', dmg: 'raio', sc: 'int', pw: 2.8, all: true, n: 99, desc: 'Raios em todos os inimigos.' }),
    sk(6, { id: 'mag7', name: 'Armadura Arcana', icon: 'shield', col: '#c8a0ff', kind: 'buff', mp: 40, cd: 40, vfx: 'buff', buff: { mods: { defPct: 0.5, dmgRed: 0.2, mpRegen: 8 }, d: 16 }, desc: '+50% DEF, -20% dano recebido, regenera MP.' }),
    sk(7, { id: 'mag8', name: 'Apocalipse', icon: 'star', col: '#ff7040', kind: 'atk', mp: 120, cd: 45, vfx: 'fire', dmg: 'fogo', sc: 'int', pw: 9, all: true, n: 99, desc: 'Destruição total em todos os inimigos.' }),
  ],
  passives: [
    { id: 'magp1', name: 'Mente Aguçada', lv: PLV[0], desc: '+12% dano mágico', mods: { magPct: 0.12 } },
    { id: 'magp2', name: 'Reserva Arcana', lv: PLV[1], desc: '+25% MP', mods: { mpPct: 0.25 } },
    { id: 'magp3', name: 'Fluxo de Mana', lv: PLV[2], desc: '+3 MP/s', mods: { mpRegen: 3 } },
    { id: 'magp4', name: 'Estudioso', lv: PLV[3], desc: '-12% recarga, +10% dano elemental', mods: { cdr: 0.12, atkPct: 0.1 } },
  ],
  talents: [
    br('Piromancia', [['Chama Viva', '+5% dano de fogo/rank', { elem: { fogo: 0.05 } }], ['Combustão', '+3% dano/rank', { atkPct: 0.03 }], ['Fogo Fátuo', '+4% vs Fera/Morto/rank', { vs: { fera: 0.04, morto: 0.04 } }]]),
    br('Criomancia', [['Geada', '+5% dano de gelo/rank', { elem: { gelo: 0.05 } }], ['Pele de Gelo', '+4% DEF/rank', { defPct: 0.04 }], ['Mente Fria', '+3% redução de recarga/rank', { cdr: 0.03 }]]),
    br('Eletromancia', [['Faísca', '+5% dano de raio/rank', { elem: { raio: 0.05 } }], ['Conduíte', '+5% MP/rank', { mpPct: 0.05 }], ['Sobrecarga', '+3% crítico/rank', { crit: 0.03 }]]),
  ],
};

// ───────────────────────── Clérigo ─────────────────────────
const cleric: ClassDef = {
  id: 'clerigo', name: 'Clérigo', role: 'Suporte / cura',
  desc: 'Cura, buffs e dano sagrado. Sobrevive a quase tudo.',
  strong: 'Forte contra mortos-vivos e demônios.', color: '#ffe680',
  base: { for: 5, agi: 4, int: 6, vit: 8, sab: 12 }, growth: { for: 0.5, agi: 0.3, int: 0.7, vit: 1.1, sab: 1.7 },
  preset: { for: 0, agi: 0, int: 1, vit: 2, sab: 5 },
  hpMult: 1.0, mpMult: 1.3, defMult: 1.2, dmgMult: 0.8, ranged: true,
  basic: { sc: 'sab', dmg: 'sagrado', interval: 1.5, vfx: 'holy' },
  sprite: { hair: '#f0e0a0', skin: '#e8b890', body: '#f0f0f0', accent: '#e8c040', legs: '#c8c8d0', hat: 'none', weapon: 'mace' },
  skills: [
    sk(0, { id: 'cle1', name: 'Golpe Sagrado', icon: 'cross', col: '#fff3a0', kind: 'atk', mp: 5, cd: 3, vfx: 'holy', dmg: 'sagrado', sc: 'sab', pw: 1.7, desc: 'Raio de luz em um alvo.' }),
    sk(1, { id: 'cle2', name: 'Cura', icon: 'heart', col: '#ff8aa0', kind: 'heal', mp: 12, cd: 4, vfx: 'heal', heal: 3.2, desc: 'Cura o aliado mais ferido.' }),
    sk(2, { id: 'cle3', name: 'Bênção', icon: 'star', col: '#ffe880', kind: 'buff', mp: 16, cd: 30, vfx: 'buff', buff: { mods: { atkPct: 0.2, defPct: 0.2 }, d: 25, party: true }, desc: '+20% dano e DEF para o grupo por 25s.' }),
    sk(3, { id: 'cle4', name: 'Martelo Divino', icon: 'cross', col: '#ffd060', kind: 'atk', mp: 18, cd: 10, vfx: 'smash', dmg: 'sagrado', sc: 'sab', pw: 2.8, r: 1.6, n: 99, st: { k: 'stun', d: 1.2 }, desc: 'Martelo de luz em área, atordoa.' }),
    sk(4, { id: 'cle5', name: 'Cura em Grupo', icon: 'heart', col: '#ff6a8a', kind: 'heal', mp: 32, cd: 12, vfx: 'heal', heal: 2.6, party: true, desc: 'Cura todos os aliados.' }),
    sk(5, { id: 'cle6', name: 'Escudo Divino', icon: 'shield', col: '#fff0a0', kind: 'buff', mp: 36, cd: 40, vfx: 'buff', buff: { mods: { dmgRed: 0.5, regen: 0.02 }, d: 8, party: true }, desc: '-50% dano recebido por 8s (grupo).' }),
    sk(6, { id: 'cle7', name: 'Coluna de Luz', icon: 'cross', col: '#fff8c0', kind: 'atk', mp: 44, cd: 16, vfx: 'holy', dmg: 'sagrado', sc: 'sab', pw: 3.6, all: true, n: 99, desc: 'Luz sagrada em todos os inimigos.' }),
    sk(7, { id: 'cle8', name: 'Intervenção Divina', icon: 'wings', col: '#ffffff', kind: 'heal', mp: 90, cd: 50, vfx: 'heal', heal: 9, party: true, dmg: 'sagrado', sc: 'sab', pw: 6, all: true, n: 99, desc: 'Cura massiva e julgamento sagrado.' }),
  ],
  passives: [
    { id: 'clep1', name: 'Fé', lv: PLV[0], desc: '+15% dano', mods: { atkPct: 0.15 } },
    { id: 'clep2', name: 'Luz Interior', lv: PLV[1], desc: '+25% cura', mods: { healPct: 0.25 } },
    { id: 'clep3', name: 'Purificador', lv: PLV[2], desc: '+40% dano vs Morto-vivo e Demônio', mods: { vs: { morto: 0.4, demonio: 0.4 } } },
    { id: 'clep4', name: 'Graça', lv: PLV[3], desc: 'Regenera 1% HP/s e +2 MP/s', mods: { regen: 0.01, mpRegen: 2 } },
  ],
  talents: [
    br('Devoção', [['Cura Potente', '+5% cura/rank', { healPct: 0.05 }], ['Fonte de Luz', '+4% MP/rank', { mpPct: 0.04 }], ['Aura Calmante', '+0.3% regen/rank', { regen: 0.003 }]]),
    br('Julgamento', [['Ira Divina', '+4% dano sagrado/rank', { elem: { sagrado: 0.04 } }], ['Exorcismo', '+6% vs Morto/Demônio/rank', { vs: { morto: 0.06, demonio: 0.06 } }], ['Castigo', '+3% dano/rank', { atkPct: 0.03 }]]),
    br('Proteção', [['Aura Sagrada', '+4% DEF/rank', { defPct: 0.04 }], ['Resistência', '+4% HP/rank', { hpPct: 0.04 }], ['Fé Inabalável', '-2% dano recebido/rank', { dmgRed: 0.02 }]]),
  ],
};

// ───────────────────────── Necromante ─────────────────────────
const necro: ClassDef = {
  id: 'necromante', name: 'Necromante', role: 'Invocador / DoT',
  desc: 'Invoca esqueletos, envenena e drena a vida dos inimigos.',
  strong: 'Forte contra chefes com muito HP e mobs que regeneram.', color: '#6ee0b0',
  base: { for: 2, agi: 4, int: 11, vit: 5, sab: 9 }, growth: { for: 0.1, agi: 0.4, int: 1.7, vit: 0.7, sab: 1.2 },
  preset: { for: 0, agi: 0, int: 5, vit: 2, sab: 3 },
  hpMult: 0.9, mpMult: 1.3, defMult: 0.7, dmgMult: 0.38, ranged: true,
  basic: { sc: 'int', dmg: 'sombrio', interval: 1.5, vfx: 'dark' },
  sprite: { hair: '#c8c8d8', skin: '#b8c8b8', body: '#2a2a3a', accent: '#40d0a0', legs: '#1a1a28', hat: 'hood', weapon: 'skullstaff' },
  skills: [
    sk(0, { id: 'nec1', name: 'Raio Sombrio', icon: 'skull', col: '#b46bff', kind: 'atk', mp: 5, cd: 3, vfx: 'dark', dmg: 'sombrio', sc: 'int', pw: 1.7, desc: 'Energia sombria em um alvo.' }),
    sk(1, { id: 'nec2', name: 'Invocar Esqueleto', icon: 'bone', col: '#e8e8d0', kind: 'summon', mp: 14, cd: 9, vfx: 'summon', summon: { n: 1, d: 60, hp: 5, atk: 0.42 }, desc: 'Invoca um esqueleto guerreiro (máx. 4).' }),
    sk(2, { id: 'nec3', name: 'Veneno', icon: 'drop', col: '#6ee060', kind: 'atk', mp: 12, cd: 6, vfx: 'poison', dmg: 'veneno', sc: 'int', pw: 0.8, n: 3, st: { k: 'poison', d: 9, p: 0.55 }, desc: 'Envenena até 3 alvos e bloqueia regeneração.' }),
    sk(3, { id: 'nec4', name: 'Dreno de Vida', icon: 'heart', col: '#c040a0', kind: 'atk', mp: 18, cd: 7, vfx: 'drain', dmg: 'sombrio', sc: 'int', pw: 2.6, drain: 0.7, desc: 'Drena vida do alvo.' }),
    sk(4, { id: 'nec5', name: 'Maldição', icon: 'eye', col: '#a050ff', kind: 'atk', mp: 24, cd: 18, vfx: 'dark', dmg: 'sombrio', sc: 'int', pw: 1.0, r: 4, n: 99, st: { k: 'vuln', d: 14, p: 0.3 }, desc: 'Inimigos recebem +30% de dano por 14s.' }),
    sk(5, { id: 'nec6', name: 'Legião', icon: 'skull', col: '#f0f0d8', kind: 'summon', mp: 44, cd: 30, vfx: 'summon', summon: { n: 3, d: 60, hp: 5, atk: 0.42 }, desc: 'Invoca 3 esqueletos.' }),
    sk(6, { id: 'nec7', name: 'Praga', icon: 'drop', col: '#40e060', kind: 'atk', mp: 48, cd: 20, vfx: 'poison', dmg: 'veneno', sc: 'int', pw: 1.2, all: true, n: 99, st: { k: 'poison', d: 12, p: 1.1 }, desc: 'Veneno potente em todos os inimigos.' }),
    sk(7, { id: 'nec8', name: 'Colheita de Almas', icon: 'wave', col: '#8a40ff', kind: 'atk', mp: 100, cd: 40, vfx: 'drain', dmg: 'sombrio', sc: 'int', pw: 7, all: true, n: 99, drain: 0.5, desc: 'Ceifa todos os inimigos e recupera vida.' }),
  ],
  passives: [
    { id: 'necp1', name: 'Mestre das Trevas', lv: PLV[0], desc: '+15% dano sombrio e veneno', mods: { elem: { sombrio: 0.15, veneno: 0.15 } } },
    { id: 'necp2', name: 'Vínculo de Sangue', lv: PLV[1], desc: '+30% dano e HP de invocações', mods: { summonPct: 0.3 } },
    { id: 'necp3', name: 'Corrupção', lv: PLV[2], desc: '+30% dano de DoT', mods: { dotPct: 0.3 } },
    { id: 'necp4', name: 'Pacto', lv: PLV[3], desc: '+6% roubo de vida, +10% dano em chefes', mods: { lifesteal: 0.06, bossDmg: 0.1 } },
  ],
  talents: [
    br('Morte', [['Sombras', '+5% dano sombrio/rank', { elem: { sombrio: 0.05 } }], ['Drenar', '+1.5% roubo de vida/rank', { lifesteal: 0.015 }], ['Ceifador', '+4% dano em chefes/rank', { bossDmg: 0.04 }]]),
    br('Pestilência', [['Toxinas', '+5% dano de veneno/rank', { elem: { veneno: 0.05 } }], ['Contágio', '+8% dano de DoT/rank', { dotPct: 0.08 }], ['Podridão', '+4% dano/rank', { atkPct: 0.04 }]]),
    br('Legião', [['Exército', '+8% dano de invocações/rank', { summonPct: 0.08 }], ['Ossos Duros', '+4% HP/rank', { hpPct: 0.04 }], ['Mente Fria', '+3% recarga/rank', { cdr: 0.03 }]]),
  ],
};

export const CLASSES: ClassDef[] = [knight, barb, archer, mage, cleric, necro];
export const CLASS_BY_ID: Record<string, ClassDef> = Object.fromEntries(CLASSES.map((c) => [c.id, c]));
