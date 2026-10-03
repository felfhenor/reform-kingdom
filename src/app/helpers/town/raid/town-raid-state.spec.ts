import { beforeEach, describe, expect, it } from 'vitest';

import { ensureMonster } from '@helpers/content/ensure-monster';
import { ensureTown } from '@helpers/content/ensure-town';
import {
  isTownCraftDebuffActive,
  raidAssaulterMonsterIds,
  raidAssaulterPreview,
  raidDefenderPreview,
  telegraphedRaidTownIds,
  townRaidTelegraph,
} from '@helpers/town/raid/town-raid-state';
import type {
  MonsterId,
  TownContent,
  TownContentInput,
  TownId,
  TownNodeState,
} from '@interfaces';
import { buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const townId = 'larsia' as TownId;
const otherId = 'other' as TownId;
const citizenId = 'larsian-citizen' as MonsterId;
const guardId = 'larsian-guard' as MonsterId;
const staleId = 'stale' as MonsterId;

const citizen = ensureMonster({ id: citizenId, name: 'Larsian Citizen' });
const guard = ensureMonster({ id: guardId, name: 'Larsian Guard' });

const telegraphed: Partial<TownNodeState> = {
  raidTelegraphedAtTick: 100,
  raidEngageWindowExpiresAtTick: 500,
};

function town(
  id = townId,
  defense: TownContentInput['defense'] = {},
): TownContent {
  return ensureTown({
    id,
    name: id,
    defense,
  });
}

function seedTowns(states: Partial<Record<TownId, Partial<TownNodeState>>>) {
  seedGamestate((state) => {
    Object.entries(states).forEach(([id, townState]) => {
      state.world.towns[id as TownId] = buildTownNodeState(townState);
    });
  });
}

beforeEach(() => {
  seedContent([town(), town(otherId), citizen, guard]);
});

describe('townRaidTelegraph', () => {
  it('returns the telegraph window and the assaulters rolled at telegraph time', () => {
    seedTowns({
      [townId]: { ...telegraphed, raidTelegraphedAssaulterIds: [citizenId] },
    });

    expect(townRaidTelegraph(townId)).toEqual({
      telegraphedAtTick: 100,
      engageWindowExpiresAtTick: 500,
      assaulterMonsterIds: [citizenId],
    });
  });

  it('treats a raid telegraphed on tick 0 as pending, defaulting a legacy save to no assaulters', () => {
    seedTowns({
      [townId]: {
        raidTelegraphedAtTick: 0,
        raidEngageWindowExpiresAtTick: 300,
      },
    });

    expect(townRaidTelegraph(townId)).toEqual({
      telegraphedAtTick: 0,
      engageWindowExpiresAtTick: 300,
      assaulterMonsterIds: [],
    });
  });

  it('is undefined with no raid pending, a half-set window, or no town state', () => {
    seedTowns({
      [townId]: {},
      [otherId]: { raidTelegraphedAtTick: 100 },
    });

    expect(townRaidTelegraph(townId)).toBeUndefined();
    expect(townRaidTelegraph(otherId)).toBeUndefined();
    expect(townRaidTelegraph('unvisited' as TownId)).toBeUndefined();
  });
});

describe('telegraphedRaidTownIds', () => {
  it('lists only towns currently telegraphing a raid', () => {
    seedTowns({ [townId]: telegraphed, [otherId]: {} });

    expect(telegraphedRaidTownIds()).toEqual([townId]);
  });
});

describe('isTownCraftDebuffActive', () => {
  it('is active only until the debuff expires', () => {
    const debuffed = buildTownNodeState({ craftSpeedDebuffExpiresAtTick: 200 });

    seedGamestate((state) => (state.clock.numTicks = 199));
    expect(isTownCraftDebuffActive(debuffed)).toBe(true);
    expect(isTownCraftDebuffActive(buildTownNodeState())).toBe(false);

    seedGamestate((state) => (state.clock.numTicks = 200));
    expect(isTownCraftDebuffActive(debuffed)).toBe(false);
  });
});

describe('raidAssaulterMonsterIds', () => {
  it('draws numMonsters random picks from the authored monster ids', () => {
    const result = raidAssaulterMonsterIds({
      numMonsters: 20,
      monsterIds: [citizenId, guardId],
      level: { min: 1, max: 1 },
    });

    expect(result).toHaveLength(20);
    expect(new Set(result)).toEqual(new Set([citizenId, guardId]));
  });

  it('returns nothing when no monster ids are authored', () => {
    expect(
      raidAssaulterMonsterIds({
        numMonsters: 5,
        monsterIds: [],
        level: { min: 1, max: 1 },
      }),
    ).toEqual([]);
  });
});

describe('raidAssaulterPreview', () => {
  it('counts each distinct telegraphed monster, skipping ones without content', () => {
    seedTowns({
      [townId]: {
        ...telegraphed,
        raidTelegraphedAssaulterIds: [
          citizenId,
          guardId,
          citizenId,
          staleId,
          guardId,
          citizenId,
        ],
      },
    });

    expect(raidAssaulterPreview(town())).toEqual([
      { monster: citizen, quantity: 3 },
      { monster: guard, quantity: 2 },
    ]);
  });

  it('is empty when no raid is telegraphed', () => {
    seedTowns({ [townId]: {} });

    expect(raidAssaulterPreview(town())).toEqual([]);
  });
});

describe('raidDefenderPreview', () => {
  it("resolves the current reputation tier's guardians, skipping ones without content", () => {
    const defended = town(townId, {
      guardian: {
        reputationTiers: [
          {
            tier: 0,
            guardians: [
              { monsterId: citizenId, quantity: 2 },
              { monsterId: staleId, quantity: 4 },
              { monsterId: guardId, quantity: 1 },
            ],
          },
          { tier: 1, guardians: [{ monsterId: guardId, quantity: 9 }] },
        ],
      },
    });
    seedTowns({ [townId]: { reputation: 0 } });

    expect(raidDefenderPreview(defended)).toEqual([
      { monster: citizen, quantity: 2 },
      { monster: guard, quantity: 1 },
    ]);
  });
});
