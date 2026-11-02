import { describe, expect, it } from 'vitest';

import { ensureEdict } from '@helpers/content/ensure-edict';
import { ensureMonster } from '@helpers/content/ensure-monster';
import { defaultStats } from '@helpers/defaults';
import {
  edictStatPercents,
  monsterStatsForRun,
  statsScaledByPercent,
} from '@helpers/edict/edict-stats';
import type { EdictContent, EdictId, MonsterId } from '@interfaces';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const edict = (id: string, effects: EdictContent['effects']) =>
  ensureEdict({ id: id as EdictId, name: id, effects });

const might = edict('might', [
  { effectType: 'StatPercent', target: 'Hero', percent: 25 },
]);
const frailty = edict('frailty', [
  { effectType: 'StatPercent', target: 'Hero', percent: -25 },
]);
const hardy = edict('hardy', [
  { effectType: 'StatPercent', target: 'Hero', percent: 50, stat: 'Health' },
]);
const fury = edict('fury', [
  { effectType: 'StatPercent', target: 'Enemy', percent: 25 },
]);

function pick(...edicts: EdictContent[]): void {
  seedContent([might, frailty, hardy, fury]);
  seedGamestate((state) => {
    state.edicts = edicts.map((e) => e.id);
  });
}

describe('edictStatPercents', () => {
  it('is zero for every stat with no edicts', () => {
    pick();
    expect(edictStatPercents('Hero')).toEqual(defaultStats());
  });

  it('adds stat-specific percents on top of all-stat ones', () => {
    pick(might, hardy);
    const percents = edictStatPercents('Hero');

    expect(percents.Health).toBe(75);
    expect(percents.Strength).toBe(25);
  });

  it('lets opposite edicts cancel', () => {
    pick(might, frailty);
    expect(edictStatPercents('Hero')).toEqual(defaultStats());
  });

  it('keeps hero and enemy percents apart', () => {
    pick(fury);
    expect(edictStatPercents('Hero')).toEqual(defaultStats());
    expect(edictStatPercents('Enemy').Strength).toBe(25);
  });
});

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
