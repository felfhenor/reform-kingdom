import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/task/task-events');

import { combatStep } from '@helpers/combat/combat';
import { combatAnalyzeTarget } from '@helpers/combat/combat-analyze';
import {
  combatLog,
  combatLogReset,
  combatMessageLog,
  combatSimulationLog,
} from '@helpers/combat/combat-log';
import {
  combatIsManualFor,
  combatManualAwaitingOrders,
} from '@helpers/combat/combat-manual';
import { ensureMonster } from '@helpers/content/ensure-monster';
import { ensureEquipmentSkillTechnique } from '@helpers/content/ensure-skill';
import { isMonsterAnalyzed } from '@helpers/kingdom/bestiary';
import type { Combat, MonsterId } from '@interfaces';
import {
  buildCombat,
  buildMonsterCombatant,
  buildTestCombatant,
} from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';

const goblinId = 'goblin' as MonsterId;
const goblin = ensureMonster({ id: goblinId, name: 'Goblin' });

function simCombat(manual: boolean, quiet = false): Combat {
  return buildCombat({ simulation: { manual, quiet } });
}

beforeEach(() => {
  seedContent([goblin]);
  seedGamestate((state) => (state.globalEffectSums.manualCombat = false));
  combatLogReset();
  combatSimulationLog.set([]);
});

describe('combat simulation flag', () => {
  it('decides manual play per fight, ignoring the world setting', () => {
    expect(combatIsManualFor(simCombat(true))).toBe(true);
    expect(combatIsManualFor(simCombat(false))).toBe(false);
    expect(combatIsManualFor(buildCombat())).toBe(false);
  });

  it("holds a manual sim fight on a hero's turn without burning it", () => {
    const hero = buildTestCombatant({ id: 'hero-1' });
    const combat = {
      ...simCombat(true),
      heroes: [hero],
      guardians: [buildMonsterCombatant(goblin, { isEnemy: true })],
      turnQueue: [{ combatantId: hero.id, awaitingOrders: true }],
    };

    expect(combatManualAwaitingOrders(combat)).toBe(true);
    expect(combatStep(combat)).toBe(false);
    expect(combat.turnQueue).toEqual([
      { combatantId: hero.id, awaitingOrders: true },
    ]);
    expect(combatSimulationLog()).toEqual([]);
  });

  it('logs sim fights apart from the adventure log, and quiet ones nowhere', () => {
    combatMessageLog(simCombat(false), 'seen');
    combatMessageLog(simCombat(false, true), 'dropped');

    expect(combatLog()).toEqual([]);
    expect(combatSimulationLog().map((entry) => entry.message)).toEqual([
      'seen',
    ]);
  });

  it('never records an analyze into the bestiary', () => {
    const caster = buildTestCombatant({ isEnemy: false });
    const target = buildMonsterCombatant(goblin, { isEnemy: true });
    const technique = ensureEquipmentSkillTechnique({
      attributes: ['Debuff', 'Analyzes'],
    });

    inTick(() =>
      combatAnalyzeTarget(simCombat(false), caster, target, technique),
    );
    expect(isMonsterAnalyzed(goblinId)).toBe(false);
  });
});
