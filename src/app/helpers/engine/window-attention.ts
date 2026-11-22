import { armoryHasRoom } from '@helpers/kingdom/armory';
import { isFelDefeated, isRunLost } from '@helpers/lore/outro';

export function windowAttentionFlags(): boolean[] {
  return [isFelDefeated(), isRunLost(), !armoryHasRoom()];
}

// Only a flag turning on counts, so a run loaded already won, lost or full stays quiet.
export function windowAttentionRaised(
  previous: boolean[],
  current: boolean[],
): boolean {
  return current.some((flag, index) => flag && !previous[index]);
}
