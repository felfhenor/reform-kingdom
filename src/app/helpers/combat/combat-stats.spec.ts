import type * as RngHelper from '@helpers/rng';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/rng', async (importOriginal) => {
  const actual = await importOriginal<typeof RngHelper>();
  return { ...actual, rngSucceedsChance: vi.fn(actual.rngSucceedsChance) };
});

import {
  combatCombatantCombatStatSucceedsChance,
  combatCombatantCombatStatValue,
  combatStatsForCharacter,
} from '@helpers/combat/combat-stats';
import { ensureEquipment } from '@helpers/content/ensure-item';
import { ensureTrainerTeaching } from '@helpers/content/ensure-trainer';
import { defaultCombatStats } from '@helpers/defaults';
import { rngSucceedsChance } from '@helpers/rng';
import type {
  Combatant,
  EquipmentId,
  JobId,
  TrainerTeachingId,
} from '@interfaces';
import {
  buildCharacter,
  buildEquipmentItem,
  buildHeroCombatant,
} from '@/testing/builders';
import { seedContent } from '@/testing/content';

const warrior = 'warrior' as JobId;
const ranger = 'ranger' as JobId;

const reflectTeaching = ensureTrainerTeaching({
  id: 'reflect' as TrainerTeachingId,
  effects: [{ kind: 'CombatStat', stat: 'damageReflectPercent', value: 1 }],
});
const reflectiveSword = ensureEquipment({
  id: 'sword' as EquipmentId,
  type: 'Sword',
  combatStats: { ...defaultCombatStats(), damageReflectPercent: 10 },
});

describe('combatStatsForCharacter', () => {
  it('is the default combat stats for a hero with no gear or teachings', () => {
    expect(combatStatsForCharacter(buildCharacter())).toEqual(
      defaultCombatStats(),
    );
  });

  it('adds teaching bonuses learned under any job, and equipped gear bonuses', () => {
    seedContent([reflectTeaching, reflectiveSword]);
    const base = defaultCombatStats().damageReflectPercent;

    for (const jobId of [warrior, ranger]) {
      expect(
        combatStatsForCharacter(
          buildCharacter({
            jobId: warrior,
            teachings: { [jobId]: [reflectTeaching.id] },
          }),
        ).damageReflectPercent,
      ).toBe(base + 1);
    }

    const armed = buildCharacter();
    armed.equipment.Weapon = buildEquipmentItem(reflectiveSword.id);
    expect(combatStatsForCharacter(armed).damageReflectPercent).toBe(base + 10);
  });
});

describe('combatant combat stat rolls', () => {
  const withStat = (stunChance: number): Combatant =>
    buildHeroCombatant(buildCharacter(), {
      combatStats: { ...defaultCombatStats(), stunChance },
    });

  it('reads the combatant’s value for a stat', () => {
    expect(combatCombatantCombatStatValue(withStat(40), 'stunChance')).toBe(40);
  });

  it('rolls the stat as a 0-100 percent chance', () => {
    combatCombatantCombatStatSucceedsChance(withStat(40), 'stunChance');
    expect(rngSucceedsChance).toHaveBeenLastCalledWith(40);

    expect(
      combatCombatantCombatStatSucceedsChance(withStat(100), 'stunChance'),
    ).toBe(true);
    expect(
      combatCombatantCombatStatSucceedsChance(withStat(-1), 'stunChance'),
    ).toBe(false);
  });
});
