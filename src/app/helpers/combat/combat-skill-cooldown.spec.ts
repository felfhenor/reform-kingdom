import {
  combatantSkillCooldownRemaining,
  combatantSkillOnCooldown,
  combatantStartSkillCooldown,
  combatantTickSkillCooldowns,
} from '@helpers/combat/combat-skill-cooldown';
import { buildEquipmentSkill, buildTestCombatant } from '@/testing/builders';
import { describe, expect, it } from 'vitest';

describe('combat skill cooldowns', () => {
  it('blocks exactly the next N turns after the cast turn', () => {
    const skill = buildEquipmentSkill({ cooldown: 3 });
    const combatant = buildTestCombatant();

    combatantStartSkillCooldown(combatant, skill);

    const blocked = [1, 2, 3, 4].map(() => {
      combatantTickSkillCooldowns(combatant);
      return combatantSkillOnCooldown(combatant, skill);
    });

    expect(blocked).toEqual([true, true, true, false]);
  });

  it('does nothing for a skill without a cooldown', () => {
    const skill = buildEquipmentSkill();
    const combatant = buildTestCombatant();

    combatantStartSkillCooldown(combatant, skill);

    expect(combatantSkillOnCooldown(combatant, skill)).toBe(false);
  });

  it('reports turns remaining before the skill is usable again', () => {
    const skill = buildEquipmentSkill({ cooldown: 2 });
    const combatant = buildTestCombatant();

    combatantStartSkillCooldown(combatant, skill);
    expect(combatantSkillCooldownRemaining(combatant, skill)).toBe(2);

    combatantTickSkillCooldowns(combatant);
    expect(combatantSkillCooldownRemaining(combatant, skill)).toBe(1);
  });
});
