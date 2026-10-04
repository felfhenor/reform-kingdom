import { describe, expect, it } from 'vitest';

import { ensureTown } from '@helpers/content/ensure-town';
import {
  townGuardianMonsterIds,
  townGuardiansForCurrentReputation,
} from '@helpers/town/town-guardian';
import { TOWN_REPUTATION_THRESHOLDS } from '@helpers/town/reputation/town-reputation';
import type { MonsterId, TownId } from '@interfaces';
import { buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const citizenId = 'larsian-citizen' as MonsterId;
const guardId = 'larsian-guard' as MonsterId;
const scoutId = 'vesper-scout' as MonsterId;

const larsia = ensureTown({
  id: 'larsia' as TownId,
  name: 'Larsia',
  defense: {
    guardian: {
      reputationTiers: [
        { tier: 0, guardians: [{ monsterId: citizenId, quantity: 3 }] },
        {
          tier: 2,
          guardians: [
            { monsterId: citizenId, quantity: 2 },
            { monsterId: guardId, quantity: 1 },
          ],
        },
      ],
    },
  },
});
const vesper = ensureTown({
  id: 'vesper' as TownId,
  name: 'Vesper',
  defense: {
    guardian: {
      reputationTiers: [
        { tier: 0, guardians: [{ monsterId: scoutId, quantity: 1 }] },
      ],
    },
  },
});

describe('townGuardianMonsterIds', () => {
  it('lists every distinct guardian across all towns and tiers', () => {
    seedContent([larsia, vesper]);
    expect(townGuardianMonsterIds()).toEqual([citizenId, guardId, scoutId]);

    seedContent([]);
    expect(townGuardianMonsterIds()).toEqual([]);
  });
});

describe('townGuardiansForCurrentReputation', () => {
  const atTier = (tier: number) =>
    seedGamestate(
      (state) =>
        (state.world.towns[larsia.id] = buildTownNodeState({
          reputation: TOWN_REPUTATION_THRESHOLDS[tier],
        })),
    );

  it('uses the guardians of exactly the town’s current reputation tier', () => {
    atTier(2);
    expect(townGuardiansForCurrentReputation(larsia)).toEqual([
      { monsterId: citizenId, quantity: 2 },
      { monsterId: guardId, quantity: 1 },
    ]);

    atTier(0);
    expect(townGuardiansForCurrentReputation(larsia)).toEqual([
      { monsterId: citizenId, quantity: 3 },
    ]);
  });

  it('has no guardians at a tier with none listed', () => {
    atTier(1);

    expect(townGuardiansForCurrentReputation(larsia)).toEqual([]);
  });
});
