import { describe, expect, it } from 'vitest';
import {
  combatAutomationAllowedAt,
  combatantTakesOrders,
  combatIsManual,
  combatManualEscaped,
  combatManualPick,
  regionIsSealed,
} from '@helpers/combat/combat-manual';
import { ensureRegion } from '@helpers/content/ensure-region';
import type { EquipmentSkillId, RegionId } from '@interfaces';
import {
  buildCombat,
  buildEquipmentSkill,
  buildTestCombatant,
} from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const REGION_ID = 'region-1' as RegionId;

function seed(opts: {
  manual: boolean;
  sealed: boolean;
  auto: boolean;
  requireSeal?: boolean;
}): void {
  seedContent([ensureRegion({ id: REGION_ID, name: 'Mire', mapName: 'Mire' })]);
  seedGamestate((state) => {
    state.globalEffectSums.manualCombat = opts.manual;
    state.globalEffectSums.requireSealForDecreeAutomation =
      opts.requireSeal ?? opts.manual;
    state.world.autoMode.enabled = opts.auto;
    state.world.currentLocation.mapName = 'Mire';
    if (opts.sealed) state.runStats.seals[REGION_ID] = 1;
  });
}

describe('combat-manual', () => {
  it('treats a sealed region and a map without one as sealed', () => {
    seed({ manual: true, sealed: true, auto: false });
    expect(regionIsSealed('Mire')).toBe(true);
    expect(regionIsSealed('Nowhere')).toBe(true);
  });

  it('gates Decree automation on the seal flag alone', () => {
    seed({ manual: false, sealed: false, auto: false, requireSeal: true });
    expect(combatAutomationAllowedAt('Mire')).toBe(false);
    seed({ manual: true, sealed: false, auto: false, requireSeal: false });
    expect(combatAutomationAllowedAt('Mire')).toBe(true);
    seed({ manual: false, sealed: true, auto: false, requireSeal: true });
    expect(combatAutomationAllowedAt('Mire')).toBe(true);
  });

  it('lets Decree fights play themselves wherever the Decree may go', () => {
    seed({ manual: true, sealed: false, auto: true, requireSeal: false });
    expect(combatIsManual()).toBe(false);
  });

  it('is manual unless Auto Mode fights on a sealed map', () => {
    seed({ manual: true, sealed: true, auto: true });
    expect(combatIsManual()).toBe(false);
    seed({ manual: true, sealed: false, auto: true });
    expect(combatIsManual()).toBe(true);
    seed({ manual: true, sealed: true, auto: false });
    expect(combatIsManual()).toBe(true);
    seed({ manual: false, sealed: false, auto: false });
    expect(combatIsManual()).toBe(false);
  });

  describe('combatManualPick', () => {
    const skill = buildEquipmentSkill({ id: 'skill-1' as EquipmentSkillId });
    const hero = buildTestCombatant({ id: 'hero' });
    const summon = buildTestCombatant({ id: 'summon', summonerId: 'hero' });
    const enemyA = buildTestCombatant({ id: 'a', isEnemy: true });
    const enemyB = buildTestCombatant({ id: 'b', isEnemy: true });

    function combatWith(targetId?: string) {
      return buildCombat({
        heroes: [hero, summon],
        guardians: [enemyA, enemyB],
        manualActions: { hero: { skillId: skill.id, targetId } },
      });
    }

    it('only real heroes take orders, and only once orders exist', () => {
      seed({ manual: true, sealed: false, auto: false });
      expect(combatantTakesOrders(combatWith(), hero)).toBe(true);
      expect(combatantTakesOrders(combatWith(), summon)).toBe(false);
      expect(combatantTakesOrders(buildCombat({ heroes: [hero] }), hero)).toBe(
        false,
      );
    });

    it('puts the chosen target first', () => {
      seed({ manual: true, sealed: false, auto: false });
      const combat = combatWith('b');
      const pick = combatManualPick(combat, hero, [skill]);
      expect(pick?.skill).toBe(skill);
      expect(pick?.targetMode).toBe('MatchingEnemies');
      expect(pick?.matchingCombatants?.[0]).toBe(enemyB);
      expect(pick?.matchingCombatants).toHaveLength(4);
    });

    it('skips every order while fleeing', () => {
      seed({ manual: true, sealed: false, auto: false });
      const combat = { ...combatWith('a'), manualFlee: true };
      expect(combatManualPick(combat, hero, [skill])).toBeUndefined();
    });

    it('escapes only with a hero standing and enemies left', () => {
      const fleeing = { ...combatWith(), manualFlee: true };
      expect(combatManualEscaped(fleeing)).toBe(true);
      expect(combatManualEscaped(combatWith())).toBe(false);
      expect(
        combatManualEscaped({
          ...fleeing,
          heroes: [{ ...hero, hp: 0 }, summon],
        }),
      ).toBe(false);
      expect(
        combatManualEscaped({ ...fleeing, guardians: [{ ...enemyA, hp: 0 }] }),
      ).toBe(false);
    });

    it('loses the turn when the order is missing or unusable', () => {
      seed({ manual: true, sealed: false, auto: false });
      expect(combatManualPick(combatWith('a'), hero, [])).toBeUndefined();
      expect(
        combatManualPick(combatWith('a'), summon, [skill]),
      ).toBeUndefined();
    });
  });
});
