import { modalHasAnyOpen } from '@helpers/engine/modal-stack';
import { worldCombatState, worldTravelState } from '@helpers/state-game';
import { getOption } from '@helpers/state-options';
import type { BGM } from '@interfaces';

export function bgmForWorld(): BGM {
  if (worldCombatState()) return 'game-threatened';
  if (worldTravelState().status === 'Traveling') return 'game-explore';
  return 'game-casual';
}

export function bgmIsMuffled(isInGame: boolean): boolean {
  if (modalHasAnyOpen()) return true;
  return isInGame && !!getOption('gameloopPaused');
}
