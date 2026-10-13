import { beforeEach, describe, expect, it } from 'vitest';

import { ensureGlobalEffect } from '@helpers/content/ensure-globaleffect';
import { applyGlobalEffectAdd } from '@helpers/hero/global-effect-state';
import { jobAbilityRegenProcessTick } from '@helpers/hero/job-ability-regen';
import { worldPartyState } from '@helpers/state-game';
import type { Character, GameState, GlobalEffectId } from '@interfaces';
import { buildCombat } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { abilityJobContent, buildAbilityHero } from '@/testing/job-ability';

const [healing, deathsDoor] = ['Healing', 'Deaths Door'].map((name) =>
  ensureGlobalEffect({ id: `${name}-id` as GlobalEffectId, name }),
);

function healer(constitution: number, hp = 50): Character {
  return buildAbilityHero(
    'Healer',
    1,
    { Constitution: constitution },
    { hp, ep: 50 },
  );
}

function magician(spirit: number): Character {
  return buildAbilityHero(
    'Magician',
    1,
    { Spirit: spirit },
    { hp: 50, ep: 50 },
  );
}

function seedParty(
  party: Character[],
  edit: (state: GameState) => void = () => undefined,
): void {
  seedGamestate((state) => {
    state.world.party = party;
    edit(state);
  });
}

const tick = () => inTick(jobAbilityRegenProcessTick);

beforeEach(() => {
  seedContent([
    healing,
    deathsDoor,
    ...abilityJobContent('Healer', [['RestoreHealthOOC', 1, 0.5]]),
    ...abilityJobContent('Magician', [['RestoreEnergyOOC', 1, 0.5]]),
  ]);
});

describe('jobAbilityRegenProcessTick', () => {
  it.each<[string, (state: GameState) => void]>([
    ['idle', () => undefined],
    ['traveling', (state) => (state.world.travel.status = 'Traveling')],
    ['gathering', (state) => (state.world.gathering.status = 'Gathering')],
  ])('regenerates the whole party while %s', (_, activity) => {
    seedParty([healer(8, 50), magician(6)], activity);

    tick();

    expect(worldPartyState().map(({ hp, ep }) => [hp, ep])).toEqual([
      [54, 53],
      [54, 53],
    ]);
  });

  it.each<[string, (state: GameState) => void]>([
    ['in combat', (state) => (state.world.combat = buildCombat())],
    [
      'during Healing',
      (state) => applyGlobalEffectAdd(state, healing.id, 100, 0),
    ],
    [
      'during Deaths Door',
      (state) => applyGlobalEffectAdd(state, deathsDoor.id, 100, 0),
    ],
  ])('does nothing %s', (_, busy) => {
    seedParty([healer(8, 50)], busy);

    tick();

    expect(worldPartyState()[0].hp).toBe(50);
  });

  it('clamps to max', () => {
    seedParty([healer(8, 98)]);

    tick();

    expect(worldPartyState()[0].hp).toBe(100);
  });

  it('sums two healers before flooring', () => {
    seedParty([healer(3, 50), healer(3, 50)]);

    tick();

    expect(worldPartyState().map(({ hp }) => hp)).toEqual([53, 53]);
  });

  it('leaves the party slice untouched when nothing regenerates', () => {
    seedParty([healer(8, 100)]);
    const party = worldPartyState();

    tick();

    expect(worldPartyState()).toBe(party);
  });
});
