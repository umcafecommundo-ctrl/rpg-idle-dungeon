// Identidade visual dos mapas: tileset (variações de piso), decorações, luzes, partículas e áudio.
// Para reformular outro mapa, adicione uma entrada aqui (mapas sem entrada usam o fundo genérico).

export type PropKind =
  | 'tree' | 'bush' | 'log' | 'rock' | 'tomb' | 'coffin' | 'pillar' | 'candle' | 'brazier'   // objetos (y-sort; alguns com colisão)
  | 'flower' | 'mushroom' | 'fern' | 'bones' | 'web' | 'crack' | 'puddle' | 'leaves';          // decoração de chão (sem colisão)
export type ParticleKind = 'leaf' | 'butterfly' | 'mote' | 'dust' | 'fog';
export type TileDeco = 'tuft' | 'flower' | 'dirt' | 'litter' | 'crack' | 'moss' | 'rubble' | 'plain';

export interface TileVariant { base: string; speck: string; weight: number; deco: TileDeco }
export interface PropRule {
  kind: PropKind; n: number;
  zone: 'side' | 'top' | 'bottom' | 'scatter' | 'corner';
  cluster?: number; // tamanho médio do agrupamento
}
export interface MapArt {
  style: 'grass' | 'flagstone';
  tiles: TileVariant[];                       // 3–5 variações de piso, distribuídas por ruído (manchas naturais)
  wall: { style: 'treeline' | 'brick'; c1: string; c2: string };
  palette: { accent: string; shadow: string };
  ambient: { color: string; alpha: number };  // escuridão ambiente
  playerLight?: { r: number; color: string; i: number };
  centerLight?: { r: number; color: string; i: number };
  stream?: { c1: string; c2: string };         // riacho ao longo da borda esquerda
  props: PropRule[];
  particles: { kind: ParticleKind; n: number }[];
  weather?: 'none';
}

export const MAP_ART: Record<string, MapArt> = {
  floresta: {
    style: 'grass',
    tiles: [
      { base: '#46783a', speck: '#5a8f48', weight: 4, deco: 'tuft' },
      { base: '#3e6c34', speck: '#4f8040', weight: 3, deco: 'plain' },
      { base: '#4d7f3e', speck: '#e8e070', weight: 2, deco: 'flower' },
      { base: '#6a5232', speck: '#7e6440', weight: 1.2, deco: 'dirt' },
      { base: '#4a6a30', speck: '#c8782a', weight: 1.5, deco: 'litter' },
    ],
    wall: { style: 'treeline', c1: '#1c3a1c', c2: '#2a5a2a' },
    palette: { accent: '#9ad060', shadow: '#0e2410' },
    ambient: { color: '#0a2a18', alpha: 0.14 },
    stream: { c1: '#3a8ab8', c2: '#9ad8f0' },
    props: [
      { kind: 'tree', n: 9, zone: 'side', cluster: 2 },
      { kind: 'tree', n: 3, zone: 'top' },
      { kind: 'bush', n: 6, zone: 'side', cluster: 2 },
      { kind: 'log', n: 2, zone: 'side' },
      { kind: 'rock', n: 3, zone: 'side' },
      { kind: 'flower', n: 10, zone: 'scatter', cluster: 4 },
      { kind: 'mushroom', n: 6, zone: 'scatter', cluster: 3 },
      { kind: 'fern', n: 8, zone: 'scatter', cluster: 2 },
      { kind: 'leaves', n: 6, zone: 'scatter', cluster: 3 },
    ],
    particles: [{ kind: 'leaf', n: 14 }, { kind: 'butterfly', n: 5 }, { kind: 'mote', n: 12 }],
  },
  cripta: {
    style: 'flagstone',
    tiles: [
      { base: '#4a4458', speck: '#5a5470', weight: 4, deco: 'plain' },
      { base: '#443e52', speck: '#585068', weight: 3, deco: 'crack' },
      { base: '#4c4a58', speck: '#4a7a48', weight: 1.4, deco: 'moss' },
      { base: '#3e384c', speck: '#6a6478', weight: 2, deco: 'rubble' },
    ],
    wall: { style: 'brick', c1: '#26202e', c2: '#3a3248' },
    palette: { accent: '#b08cff', shadow: '#0a0612' },
    ambient: { color: '#05030c', alpha: 0.74 },
    playerLight: { r: 4.8, color: '#c8b0ff', i: 0.85 },
    centerLight: { r: 6, color: '#8a70c0', i: 0.28 },
    props: [
      { kind: 'tomb', n: 7, zone: 'side', cluster: 2 },
      { kind: 'coffin', n: 2, zone: 'side' },
      { kind: 'pillar', n: 4, zone: 'corner' },
      { kind: 'brazier', n: 2, zone: 'top' },
      { kind: 'candle', n: 8, zone: 'side', cluster: 3 },
      { kind: 'bones', n: 9, zone: 'scatter', cluster: 3 },
      { kind: 'web', n: 4, zone: 'corner' },
      { kind: 'crack', n: 7, zone: 'scatter', cluster: 2 },
      { kind: 'puddle', n: 3, zone: 'scatter' },
    ],
    particles: [{ kind: 'fog', n: 7 }, { kind: 'dust', n: 18 }],
  },
};
