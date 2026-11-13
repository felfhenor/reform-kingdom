import { beforeEach, describe, expect, it } from 'vitest';

import { combatLog } from '@helpers/combat/combat-log';
import { ensureGlobalEffect } from '@helpers/content/ensure-globaleffect';
import { ensureMonster } from '@helpers/content/ensure-monster';
import { ensureTown } from '@helpers/content/ensure-town';
import { worldCombatState, worldTownsState } from '@helpers/state-game';
import { raidEngageCombat } from '@helpers/town/raid/town-raid-combat';
import type {
  GameState,
  GlobalEffectId,
  MonsterId,
  TownId,
  TownNodeState,
} from '@interfaces';
import { captureAnalyticsEvents } from '@/testing/analytics';
import {
  buildCharacter,
  buildCombat,
  buildTownNodeState,
} from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { abilityJobContent, buildAbilityHero } from '@/testing/job-ability';
import { locationOf, seedWorldNodes } from '@/testing/world';

const townId = 'larsia' as TownId;
const mothId = 'bloodmoth' as MonsterId;
const guardId = 'larsian-guard' as MonsterId;

const moth = ensureMonster({ id: mothId, name: 'Bloodmoth' });
const guard = ensureMonster({ id: guardId, name: 'Larsian Guard' });
const town = ensureTown({
  id: townId,
  name: 'Larsia',
  level: 25,
  defense: {
    assaulter: {
      numMonsters: 2,
      monsterIds: [mothId],
      level: { min: 20, max: 22 },
    },
    guardian: {
      reputationTiers: [
        { tier: 0, guardians: [{ monsterId: guardId, quantity: 1 }] },
      ],
    },
  },
});

const deathsDoor = ensureGlobalEffect({
  id: 'Deaths Door' as GlobalEffectId,
  name: 'Deaths Door',
});

const telegraphed: Partial<TownNodeState> = {
  raidTelegraphedAtTick: 100,
  raidEngageWindowExpiresAtTick: 500,
  raidTelegraphedAssaulterIds: [mothId, mothId],
};

function seedRaid(
  townState: Partial<TownNodeState> = telegraphed,
  {
    standingAt = town.name,
    edit,
  }: { standingAt?: string; edit?: (state: GameState) => void } = {},
): void {
  const nodes = seedWorldNodes([
    { name: town.name, type: 'NonPlayerKingdom' },
    { name: 'Field', type: 'ExploreNode' },
  ]);
  seedGamestate((state) => {
    state.world.currentLocation = locationOf(nodes[standingAt]);
    state.world.towns[townId] = buildTownNodeState(townState);
    edit?.(state);
  });
}

beforeEach(() => {
  seedContent([town, moth, guard]);
});

describe('raidEngageCombat', () => {
  it('starts combat against the assaulters rolled at telegraph time, with the guardians helping', () => {
    const hero = buildCharacter();
    seedRaid(telegraphed, { edit: (state) => (state.world.party = [hero]) });
    const events = captureAnalyticsEvents();

    expect(inTick(() => raidEngageCombat(townId))).toBe(true);

    const combat = worldCombatState()!;
    expect(combat.raidTownId).toBe(townId);
    expect(combat.locationName).toBe('Larsia');
    expect(combat.heroes.map((c) => c.name)).toEqual([hero.name]);
    expect(combat.guardians.map((c) => [c.monsterId, c.level])).toEqual([
      [mothId, 22],
      [mothId, 22],
    ]);
    expect(
      combat.helpers.map((c) => [c.monsterId, c.level, c.isEnemy]),
    ).toEqual([[guardId, 25, false]]);
    expect(combatLog().map((entry) => entry.message)).toContain(
      'The raid on Larsia begins!',
    );
    expect(events).toContain('Town:Raid:Engage:Larsia');
  });

  it('rolls a Ranger ambush like any other fight', () => {
    seedContent([
      town,
      moth,
      guard,
      ...abilityJobContent('Ranger', [['Ambush', 1, 100]]),
    ]);
    seedRaid(telegraphed, {
      edit: (state) => (state.world.party = [buildAbilityHero('Ranger', 1)]),
    });

    inTick(() => raidEngageCombat(townId));

    expect(worldCombatState()?.ambushedBy).toBeDefined();
  });

  it('keeps the telegraph up once engaged, so a lost fight can be retried', () => {
    seedRaid();

    inTick(() => raidEngageCombat(townId));

    expect(worldTownsState()[townId]).toMatchObject(telegraphed);
  });

  it('refuses during Deaths Door, so a wiped party cannot retry at 0 HP', () => {
    seedContent([town, moth, guard, deathsDoor]);
    seedRaid(telegraphed, {
      edit: (state) =>
        state.globalEffects.push({
          ...deathsDoor,
          startTick: 0,
          expiresAtTick: 999,
        }),
    });

    expect(inTick(() => raidEngageCombat(townId))).toBe(false);
    expect(worldCombatState()).toBeUndefined();
  });

  it('refuses once the engage window has expired', () => {
    seedRaid(telegraphed, { edit: (state) => (state.clock.numTicks = 500) });

    expect(inTick(() => raidEngageCombat(townId))).toBe(false);
    expect(worldCombatState()).toBeUndefined();
  });

  it('skips assaulters gone from content', () => {
    seedRaid({
      ...telegraphed,
      raidTelegraphedAssaulterIds: [mothId, 'gone' as MonsterId],
    });

    inTick(() => raidEngageCombat(townId));

    expect(worldCombatState()!.guardians).toHaveLength(1);
  });

  it.each([
    ['no raid is telegraphed', { raidTelegraphedAssaulterIds: [mothId] }],
    [
      'the telegraph rolled no assaulters',
      { ...telegraphed, raidTelegraphedAssaulterIds: [] },
    ],
    [
      'no telegraphed assaulter has content',
      { ...telegraphed, raidTelegraphedAssaulterIds: ['gone' as MonsterId] },
    ],
  ])('refuses when %s', (_, townState: Partial<TownNodeState>) => {
    seedRaid(townState);

    expect(inTick(() => raidEngageCombat(townId))).toBe(false);
    expect(worldCombatState()).toBeUndefined();
  });

  it('refuses away from the town, mid-combat, or for a town without content', () => {
    seedRaid(telegraphed, { standingAt: 'Field' });
    expect(inTick(() => raidEngageCombat(townId))).toBe(false);

    const existing = buildCombat();
    seedRaid(telegraphed, {
      edit: (state) => (state.world.combat = existing),
    });
    expect(inTick(() => raidEngageCombat(townId))).toBe(false);
    expect(worldCombatState()).toEqual(existing);

    seedContent([moth, guard]);
    seedRaid();
    expect(inTick(() => raidEngageCombat(townId))).toBe(false);
    expect(worldCombatState()).toBeUndefined();
  });
});
