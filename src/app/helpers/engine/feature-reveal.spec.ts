import { seedGamestate } from '@/testing/gamestate';
import { buildCharacter } from '@/testing/builders';
import { isRevealedAtLevel } from '@helpers/engine/feature-reveal';
import { describe, expect, it } from 'vitest';

describe('isRevealedAtLevel', () => {
  it('uses the highest hero level', () => {
    seedGamestate((state) => {
      state.world.party = [
        buildCharacter({ level: 4 }),
        buildCharacter({ level: 10 }),
      ];
    });
    expect(isRevealedAtLevel(10)).toBe(true);
    expect(isRevealedAtLevel(11)).toBe(false);
  });

  it('is always true once features are revealed', () => {
    seedGamestate((state) => {
      state.world.party = [buildCharacter({ level: 1 })];
      state.globalEffectSums.featuresRevealed = true;
    });
    expect(isRevealedAtLevel(50)).toBe(true);
  });
});
