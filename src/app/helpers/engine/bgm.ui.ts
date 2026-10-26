import { worldCombatState, worldTravelState } from '@helpers/state-game';
import type { BGM } from '@interfaces';

export function bgmForWorld(): BGM {
  if (worldCombatState()) return 'game-threatened';
  if (worldTravelState().status === 'Traveling') return 'game-explore';
  return 'game-casual';
}
