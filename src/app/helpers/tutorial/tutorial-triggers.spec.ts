import { describe, expect, it } from 'vitest';

import { ensureJob } from '@helpers/content/ensure-job';
import { ensureSkill } from '@helpers/content/ensure-skill';
import { tutorialTriggerSatisfied } from '@helpers/tutorial/tutorial-triggers';
import { buildCharacter } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import type { EquipmentSkillId, JobId } from '@interfaces';

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

describe('tutorialTriggerSatisfied first-burst-skill', () => {
  const burst = ensureSkill({
    id: 'Inferno' as EquipmentSkillId,
    name: 'Inferno',
    special: true,
  });
  const job = ensureJob({
    id: 'job-burst' as JobId,
    name: 'Burster',
    skillPath: [
      { pathName: 'Inferno', levels: [{ level: 5, skillId: burst.id }] },
    ],
  });

  function seedHero(level: number) {
    seedContent([job, burst]);
    seedGamestate((state) => {
      state.world.party = [buildCharacter({ jobId: job.id, level })];
    });
  }

  it('fires once a hero knows a burst skill', () => {
    seedHero(5);
    expect(tutorialTriggerSatisfied({ kind: 'first-burst-skill' })).toBe(true);
  });

  it('waits until a hero learns one', () => {
    seedHero(4);
    expect(tutorialTriggerSatisfied({ kind: 'first-burst-skill' })).toBe(false);
  });
});
