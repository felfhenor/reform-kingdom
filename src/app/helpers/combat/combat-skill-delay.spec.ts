import { describe, expect, it } from 'vitest';

import {
  combatantAdvanceDelayedSkills,
  combatantClearDelayedSkills,
  combatantQueueDelayedSkill,
} from '@helpers/combat/combat-skill-delay';
import { ensureSkill } from '@helpers/content/ensure-skill';
import type { CombatantDelayedSkill, EquipmentSkillId } from '@interfaces';
import { buildTestCombatant } from '@/testing/builders';

function delayed(id: string, delay: number) {
  return ensureSkill({ id: id as EquipmentSkillId, delay });
}

function skillsOf(entries: CombatantDelayedSkill[]) {
  return entries.map((entry) => entry.skill);
}

describe('combatantAdvanceDelayedSkills', () => {
  it('returns nothing for a combatant without a queue', () => {
    expect(combatantAdvanceDelayedSkills(buildTestCombatant())).toEqual([]);
  });

  it('releases each skill once its own delay runs out', () => {
    const combatant = buildTestCombatant();
    const short = delayed('short', 1);
    const long = delayed('long', 2);
    combatantQueueDelayedSkill(combatant, long);
    combatantQueueDelayedSkill(combatant, short);

    expect(skillsOf(combatantAdvanceDelayedSkills(combatant))).toEqual([short]);
    expect(skillsOf(combatantAdvanceDelayedSkills(combatant))).toEqual([long]);
    expect(combatant.delayedSkills).toEqual([]);
  });

  it('releases same-turn skills in queue order', () => {
    const combatant = buildTestCombatant();
    const first = delayed('first', 1);
    const second = delayed('second', 1);
    combatantQueueDelayedSkill(combatant, first);
    combatantQueueDelayedSkill(combatant, second);

    expect(skillsOf(combatantAdvanceDelayedSkills(combatant))).toEqual([
      first,
      second,
    ]);
  });
});

describe('combatantQueueDelayedSkill', () => {
  it('keeps a plain target override but drops a Matching* one', () => {
    const combatant = buildTestCombatant();
    const skill = delayed('a', 1);
    combatantQueueDelayedSkill(combatant, skill, {
      skill,
      targetMode: 'Weakest',
    });
    combatantQueueDelayedSkill(combatant, skill, {
      skill,
      targetMode: 'MatchingEnemies',
    });

    expect(
      combatantAdvanceDelayedSkills(combatant).map((e) => e.targetMode),
    ).toEqual(['Weakest', undefined]);
  });
});

describe('combatantClearDelayedSkills', () => {
  it('drops every pending skill', () => {
    const combatant = buildTestCombatant();
    combatantQueueDelayedSkill(combatant, delayed('a', 2));

    combatantClearDelayedSkills(combatant);

    expect(combatantAdvanceDelayedSkills(combatant)).toEqual([]);
  });
});
