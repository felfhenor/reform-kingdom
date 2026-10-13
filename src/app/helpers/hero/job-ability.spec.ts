import { describe, expect, it } from 'vitest';

import {
  characterJobAbilities,
  jobAbilityEntries,
  jobAbilityHighest,
  jobAbilityValue,
} from '@helpers/hero/job-ability';
import type { Character } from '@interfaces';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import {
  abilityJobContent,
  buildAbilityHero,
  buildJobAbility,
} from '@/testing/job-ability';

const healer = abilityJobContent('Healer', [
  ['RestoreHealthOOC', 1, 0.5],
  ['RestoreHealthOOC', 25, 1],
]);
const warrior = abilityJobContent('Warrior', [
  ['Intimidation', 1, -15],
  ['Intimidation', 25, -12],
  ['OnPathTravelSpeed', 5, 0.1],
  ['OnPathTravelSpeed', 25, 0.2],
]);
const plain = abilityJobContent('Plain', []);

function seedParty(party: Character[]): void {
  seedGamestate((state) => {
    state.world.party = party;
  });
}

describe('characterJobAbilities', () => {
  it.each([
    [4, undefined],
    [5, 0.1],
    [24, 0.1],
    [25, 0.2],
    [50, 0.2],
  ])('at level %i resolves Trailbreaker to %s', (level, expected) => {
    seedContent(warrior);

    const onPath = characterJobAbilities(
      buildAbilityHero('Warrior', level),
    ).find(({ ability }) => ability.type === 'OnPathTravelSpeed');

    expect(onPath?.value).toBe(expected);
  });
});

describe('jobAbilityValue', () => {
  it('sums Sum-stacked amounts before flooring once', () => {
    seedContent(healer);
    seedParty([
      buildAbilityHero('Healer', 1, { Constitution: 3 }),
      buildAbilityHero('Healer', 1, { Constitution: 3 }),
    ]);

    expect(jobAbilityValue('RestoreHealthOOC')).toBe(3);
  });

  it('picks the highest Highest-stacked value', () => {
    seedContent(warrior);
    seedParty([
      buildAbilityHero('Warrior', 10),
      buildAbilityHero('Warrior', 30),
    ]);

    expect(jobAbilityValue('OnPathTravelSpeed')).toBe(0.2);
  });

  it("offsets each warrior's own level for Intimidation", () => {
    seedContent(warrior);
    seedParty([
      buildAbilityHero('Warrior', 20),
      buildAbilityHero('Warrior', 30),
    ]);

    expect(jobAbilityValue('Intimidation')).toBe(18);
  });

  it('is 0 when nobody has the ability', () => {
    seedContent([...healer, ...plain, buildJobAbility('Ambush')]);
    seedParty([buildAbilityHero('Healer', 10), buildAbilityHero('Plain', 10)]);

    expect(jobAbilityValue('Ambush')).toBe(0);
    expect(jobAbilityValue('RestoreHealthOOC')).toBe(0);
  });

  it('ignores heroes whose job does not list the ability', () => {
    seedContent([...healer, ...plain]);
    seedParty([
      buildAbilityHero('Healer', 1, { Constitution: 4 }),
      buildAbilityHero('Plain', 1, { Constitution: 100 }),
    ]);

    expect(jobAbilityValue('RestoreHealthOOC')).toBe(2);
  });

  it('sees a party change made after an earlier read', () => {
    seedContent(warrior);
    seedParty([buildAbilityHero('Warrior', 10)]);
    expect(jobAbilityValue('OnPathTravelSpeed')).toBe(0.1);

    seedParty([buildAbilityHero('Warrior', 25)]);
    expect(jobAbilityValue('OnPathTravelSpeed')).toBe(0.2);
  });
});

describe('jobAbilityEntries', () => {
  it('lists every hero with the ability at their own rank', () => {
    seedContent([...warrior, ...plain]);
    const low = buildAbilityHero('Warrior', 10);
    const high = buildAbilityHero('Warrior', 30);
    seedParty([low, buildAbilityHero('Plain', 30), high]);

    expect(
      jobAbilityEntries('Intimidation').map(({ character, value }) => [
        character.name,
        value,
      ]),
    ).toEqual([
      [low.name, -15],
      [high.name, -12],
    ]);
  });
});

describe('jobAbilityHighest', () => {
  it('names the hero with the highest computed amount', () => {
    seedContent(warrior);
    const low = buildAbilityHero('Warrior', 20, {}, { name: 'Low' });
    const high = buildAbilityHero('Warrior', 30, {}, { name: 'High' });
    seedParty([low, high]);

    expect(jobAbilityHighest('Intimidation')).toEqual({
      character: expect.objectContaining({ name: 'High' }),
      amount: 18,
    });
  });

  it('is undefined when nobody has the ability', () => {
    seedContent(plain);
    seedParty([buildAbilityHero('Plain', 30)]);

    expect(jobAbilityHighest('Intimidation')).toBeUndefined();
  });
});
