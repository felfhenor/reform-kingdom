import { describe, expect, it } from 'vitest';

import { tutorialTriggerSatisfied } from '@helpers/tutorial/tutorial-triggers';
import { buildCharacter } from '@/testing/builders';
import { seedGamestate } from '@/testing/gamestate';

const losingStreak = {
  kind: 'losing-streak',
  losses: 3,
  belowLevel: 10,
} as const;

function seedLosses(level: number, nodeFailureCounts: Record<string, number>) {
  seedGamestate((state) => {
    state.world.party = [buildCharacter({ level })];
    state.world.autoMode.nodeFailureCounts = nodeFailureCounts;
  });
}

describe('tutorialTriggerSatisfied losing-streak', () => {
  it('counts losses across every node', () => {
    seedLosses(5, { A: 1, B: 2 });
    expect(tutorialTriggerSatisfied(losingStreak)).toBe(true);
  });

  it('needs the full loss count', () => {
    seedLosses(5, { A: 2, B: 0 });
    expect(tutorialTriggerSatisfied(losingStreak)).toBe(false);
  });

  it('stops once the party reaches the level cap', () => {
    seedLosses(10, { A: 5 });
    expect(tutorialTriggerSatisfied(losingStreak)).toBe(false);
  });
});
