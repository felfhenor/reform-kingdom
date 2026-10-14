import { describe, expect, it } from 'vitest';

import {
  isCombatOrderTargetModeAllowedForCondition,
  isCombatOrderTargetModeUsable,
} from '@helpers/combat/combat-order-target-mode';
import {
  ensureEquipmentSkillTechnique,
  ensureSkill,
} from '@helpers/content/ensure-skill';
import type { EquipmentSkillId } from '@interfaces';

const smite = ensureSkill({
  id: 'smite' as EquipmentSkillId,
  name: 'Smite I',
  family: 'Smite',
  techniques: [ensureEquipmentSkillTechnique({ targetType: 'Enemies' })],
});

describe('isCombatOrderTargetModeAllowedForCondition', () => {
  it('only pairs Matching* modes with their own count condition', () => {
    expect(
      isCombatOrderTargetModeAllowedForCondition(
        'MatchingEnemies',
        'EnemyCountHealthPercent',
      ),
    ).toBe(true);
    expect(
      isCombatOrderTargetModeAllowedForCondition(
        'MatchingEnemies',
        'EnemyCount',
      ),
    ).toBe(false);
    expect(
      isCombatOrderTargetModeAllowedForCondition(
        'MatchingAllies',
        'EnemyCountHealthPercent',
      ),
    ).toBe(false);
    expect(
      isCombatOrderTargetModeAllowedForCondition('Strongest', 'EnemyCount'),
    ).toBe(true);
  });
});

describe('isCombatOrderTargetModeUsable', () => {
  it('rejects a mode on the wrong side of the skill', () => {
    expect(isCombatOrderTargetModeUsable('Smite', [smite], 'Self')).toBe(false);
    expect(
      isCombatOrderTargetModeUsable('Smite', [smite], 'MatchingAllies'),
    ).toBe(false);
    expect(
      isCombatOrderTargetModeUsable('Smite', [smite], 'MatchingEnemies'),
    ).toBe(true);
  });

  it('allows the HP-based modes and unknown families', () => {
    expect(isCombatOrderTargetModeUsable('Smite', [smite], 'Weakest')).toBe(
      true,
    );
    expect(isCombatOrderTargetModeUsable('Cure', [smite], 'Self')).toBe(true);
  });
});
