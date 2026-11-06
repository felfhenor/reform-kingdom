import { describe, expect, it } from 'vitest';

import { ensureEdict } from '@helpers/content/ensure-edict';
import {
  ensureMonster,
  ensureMonsterSkill,
} from '@helpers/content/ensure-monster';
import { ensureRegion } from '@helpers/content/ensure-region';
import { defaultStats } from '@helpers/defaults';
import {
  monsterSkillsForRun,
  monsterStatsForRun,
  statsScaledByPercent,
} from '@helpers/edict/edict-stats';
import { recomputeGlobalEffectSums } from '@helpers/hero/global-effect-state';
import type {
  EdictContent,
  EdictId,
  EquipmentSkillId,
  MonsterId,
  RegionId,
} from '@interfaces';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const edict = (id: string, effects: EdictContent['effects']) =>
  ensureEdict({ id: id as EdictId, name: id, effects });

const might = edict('might', [{ effectType: 'GainStatPercent', value: 25 }]);
const fury = edict('fury', [{ effectType: 'EnemyStatPercent', value: 25 }]);

function pick(...edicts: EdictContent[]): void {
  seedContent([might, fury]);
  seedGamestate((state) => {
    state.edicts = edicts.map((e) => e.id);
    recomputeGlobalEffectSums(state);
  });
}

describe('statsScaledByPercent', () => {
  it('rounds scaled Health and Energy only, leaving zero stats at zero', () => {
    const stats = { ...defaultStats(), Strength: 10, Health: 4 };
    const percents = { ...defaultStats(), Strength: 25, Health: -25 };

    expect(statsScaledByPercent(stats, percents)).toEqual({
      ...defaultStats(),
      Strength: 12.5,
      Health: 3,
    });
  });

  it('changes nothing at 0%, fractional stats included', () => {
    const stats = { ...defaultStats(), Strength: 42.5 };
    expect(statsScaledByPercent(stats, defaultStats())).toEqual(stats);
  });
});

describe('monsterStatsForRun', () => {
  const wolf = ensureMonster({
    id: 'wolf' as MonsterId,
    baseStats: { ...defaultStats(), Strength: 8 },
  });

  it('scales by the enemy percents only', () => {
    pick(fury, might);
    expect(monsterStatsForRun(wolf, 1)).toEqual({
      ...defaultStats(),
      Strength: 10,
    });
  });
});

describe('monsterSkillsForRun', () => {
  const skill = (id: string, minLevel = 0, maxLevel = 50) =>
    ensureMonsterSkill({
      skillId: id as EquipmentSkillId,
      minLevel,
      maxLevel,
    });
  const slime = ensureMonster({
    id: 'slime' as MonsterId,
    skills: [skill('bite')],
  });
  const wilds = ensureRegion({
    id: 'wilds' as RegionId,
    mapName: 'Wilds',
    skillPool: [skill('bite'), skill('spark', 20), skill('frost')],
  });

  function fightIn(mapName: string, extra: number): string[] {
    seedContent([slime, wilds]);
    seedGamestate((state) => {
      state.world.currentLocation.mapName = mapName;
      state.globalEffectSums.enemyExtraSkills = extra;
    });
    return monsterSkillsForRun(slime, 5).map((s) => s.skillId);
  }

  it('adds a pool skill the monster lacks and can use at its level', () => {
    expect(fightIn('Wilds', 1)).toEqual(['bite', 'frost']);
  });

  it('adds nothing without the effect or outside a region with a pool', () => {
    expect(fightIn('Wilds', 0)).toEqual(['bite']);
    expect(fightIn('Elsewhere', 1)).toEqual(['bite']);
  });
});
