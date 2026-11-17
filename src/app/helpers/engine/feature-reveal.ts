import { partyMaxLevel } from '@helpers/item/gathering';
import { globalEffectSumsState } from '@helpers/state-game';

export function isRevealedAtLevel(level: number): boolean {
  return globalEffectSumsState().featuresRevealed || partyMaxLevel() >= level;
}
