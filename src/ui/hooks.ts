import { useSyncExternalStore } from 'react';
import { game } from '../engine/game';
export function useGame() {
  useSyncExternalStore(game.subscribe, game.getVersion);
  return game;
}
