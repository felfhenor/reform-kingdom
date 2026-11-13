import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/task/task-events');

import { combatAnalyzeTarget } from '@helpers/combat/combat-analyze';
import { ensureMonster } from '@helpers/content/ensure-monster';
import { ensureEquipmentSkillTechnique } from '@helpers/content/ensure-skill';
import { isMonsterAnalyzed } from '@helpers/kingdom/bestiary';
import type { EquipmentSkillAttribute, MonsterId } from '@interfaces';
import {
  buildCombat,
  buildMonsterCombatant,
  buildTestCombatant,
} from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';

const goblinId = 'goblin' as MonsterId;
const goblin = ensureMonster({ id: goblinId, name: 'Goblin' });

// Built through the content loader, so an attribute it doesn't know is dropped.
function cast(
  casterIsEnemy: boolean,
  targetIsEnemy: boolean,
  attributes: EquipmentSkillAttribute[] = ['Debuff', 'Analyzes'],
) {
  const caster = buildTestCombatant({ isEnemy: casterIsEnemy });
  const target = buildMonsterCombatant(goblin, { isEnemy: targetIsEnemy });
  const technique = ensureEquipmentSkillTechnique({ attributes });
  inTick(() => combatAnalyzeTarget(buildCombat(), caster, target, technique));
}

beforeEach(() => {
  seedContent([goblin]);
  seedGamestate();
});

describe('combatAnalyzeTarget', () => {
  it('records an enemy monster a hero analyzes', () => {
    cast(false, true);
    expect(isMonsterAnalyzed(goblinId)).toBe(true);
  });

  it('ignores monsters casting Analyze and allied targets', () => {
    cast(true, false);
    cast(false, false);
    expect(isMonsterAnalyzed(goblinId)).toBe(false);
  });

  it('ignores techniques without the Analyzes attribute', () => {
    cast(false, true, ['Debuff']);
    expect(isMonsterAnalyzed(goblinId)).toBe(false);
  });
});
