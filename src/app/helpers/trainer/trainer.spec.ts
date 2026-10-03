import { beforeEach, describe, expect, it } from 'vitest';

import { applyCollectibleGrant } from '@helpers/item/collectibles';
import { ensureJob } from '@helpers/content/ensure-job';
import {
  ensureTrainer,
  ensureTrainerTeaching,
} from '@helpers/content/ensure-trainer';
import { defaultStats } from '@helpers/defaults';
import {
  characterApplyTeaching,
  isPartyAtTrainer,
  pruneInvalidCharacterTeachings,
  pruneInvalidDiscoveredTrainers,
  trainerForTeaching,
  trainerTeachingAvailability,
  trainerTeachingsForJob,
} from '@helpers/trainer/trainer';
import type {
  Character,
  CharacterId,
  CollectibleId,
  JobId,
  TrainerId,
  TrainerTeachingContent,
  TrainerTeachingId,
} from '@interfaces';
import { buildCharacter } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { locationOf, seedWorldNodes } from '@/testing/world';

const WARRIOR = 'job-warrior' as JobId;
const RANGER = 'job-ranger' as JobId;
const RUBY = 'Goblin Ruby' as CollectibleId;

const warriorJob = ensureJob({
  id: WARRIOR,
  name: 'Warrior',
  baseStats: { ...defaultStats(), Health: 100, Energy: 20 },
});
const rangerJob = ensureJob({ id: RANGER, name: 'Ranger' });

function teaching(
  overrides: Partial<TrainerTeachingContent>,
): TrainerTeachingContent {
  return ensureTrainerTeaching({ jobIds: [WARRIOR], ...overrides });
}

const basicHealth = teaching({
  id: 'basic-health' as TrainerTeachingId,
  name: 'Stat: Basic Health',
  effects: [{ kind: 'Stat', stat: 'Health', value: 10 }],
});
const advanced = teaching({
  id: 'advanced' as TrainerTeachingId,
  name: 'Advanced',
  requiredLevel: 10,
  requiredTrainerTeachingIds: [basicHealth.id],
  requiredCollectibleIds: [RUBY],
});
const rangerOnly = teaching({
  id: 'ranger-only' as TrainerTeachingId,
  name: 'Ranger Only',
  jobIds: [RANGER],
});

const trainer = ensureTrainer({
  id: 'trainer-reyn' as TrainerId,
  name: 'Reyn Astra',
  trainerTeachingIds: [basicHealth.id, advanced.id, rangerOnly.id],
});

function hero(overrides: Partial<Character> = {}): Character {
  return buildCharacter({
    id: 'hero' as CharacterId,
    name: 'Jala',
    jobId: WARRIOR,
    ...overrides,
  });
}

function setState(collectibles: CollectibleId[] = []): void {
  seedGamestate((state) => {
    collectibles.forEach((id) => applyCollectibleGrant(state, id, 1));
  });
}

beforeEach(() => {
  seedContent([
    warriorJob,
    rangerJob,
    basicHealth,
    advanced,
    rangerOnly,
    trainer,
  ]);
  setState();
});

describe('trainerTeachingAvailability', () => {
  it('is Available when every requirement is met', () => {
    expect(trainerTeachingAvailability(hero(), basicHealth, WARRIOR)).toBe(
      'Available',
    );
  });

  it('reports Learned before anything else', () => {
    const learned = hero({ teachings: { [WARRIOR]: [basicHealth.id] } });
    expect(trainerTeachingAvailability(learned, basicHealth, WARRIOR)).toBe(
      'Learned',
    );
  });

  it('only counts a teaching as learned under the job being checked', () => {
    const learnedAsRanger = hero({ teachings: { [RANGER]: [basicHealth.id] } });
    expect(
      trainerTeachingAvailability(learnedAsRanger, basicHealth, WARRIOR),
    ).toBe('Available');
  });

  it("uses the hero's level in the job being checked, not the current one", () => {
    const warriorAtTen = hero({
      level: 10,
      jobId: RANGER,
      jobProgress: {
        [WARRIOR]: { level: 1, xp: { current: 0, maximum: 100 } },
      },
    });
    expect(trainerTeachingAvailability(warriorAtTen, advanced, WARRIOR)).toBe(
      'LevelTooLow',
    );
  });

  it('rejects a job the teaching is not offered to', () => {
    expect(trainerTeachingAvailability(hero(), rangerOnly, WARRIOR)).toBe(
      'WrongJob',
    );
  });

  it('checks level, then prerequisites, then collectibles', () => {
    expect(trainerTeachingAvailability(hero(), advanced, WARRIOR)).toBe(
      'LevelTooLow',
    );
    expect(
      trainerTeachingAvailability(hero({ level: 10 }), advanced, WARRIOR),
    ).toBe('MissingPrerequisites');

    const ready = hero({
      level: 10,
      teachings: { [WARRIOR]: [basicHealth.id] },
    });
    expect(trainerTeachingAvailability(ready, advanced, WARRIOR)).toBe(
      'MissingCollectibles',
    );

    setState([RUBY]);
    expect(trainerTeachingAvailability(ready, advanced, WARRIOR)).toBe(
      'Available',
    );
  });
});

describe('trainerTeachingsForJob', () => {
  it("filters the trainer's list to the job", () => {
    expect(trainerTeachingsForJob(trainer, RANGER)).toEqual([rangerOnly]);
  });
});

describe('trainerForTeaching', () => {
  it('finds the trainer that lists the teaching', () => {
    expect(trainerForTeaching(advanced.id)).toBe(trainer);
    expect(trainerForTeaching('nope' as TrainerTeachingId)).toBeUndefined();
  });
});

describe('isPartyAtTrainer', () => {
  it('matches the trainer at the current node only', () => {
    const nodes = seedWorldNodes([
      { name: trainer.name, type: 'Trainer', x: 1 },
      { name: 'Field', type: 'ExploreNode', x: 2 },
    ]);
    const standAt = (name: string) =>
      seedGamestate(
        (state) => (state.world.currentLocation = locationOf(nodes[name])),
      );

    standAt(trainer.name);
    expect(isPartyAtTrainer(trainer.id)).toBe(true);
    expect(isPartyAtTrainer('other' as TrainerId)).toBe(false);

    standAt('Field');
    expect(isPartyAtTrainer(trainer.id)).toBe(false);
  });
});

describe('characterApplyTeaching', () => {
  it('records the teaching under the current job and raises stats', () => {
    const character = hero();
    characterApplyTeaching(character, basicHealth);

    expect(character.teachings[WARRIOR]).toEqual([basicHealth.id]);
    expect(character.stats.Health).toBe(110);
  });

  it('tops up current hp by the gain without overfilling', () => {
    const character = hero();
    character.hp = 50;
    characterApplyTeaching(character, basicHealth);

    expect(character.hp).toBe(60);
  });

  it('applies teachings learned under every job, not just the current one', () => {
    const character = hero({ teachings: { [RANGER]: [basicHealth.id] } });
    expect(character.stats.Health).toBe(110);

    characterApplyTeaching(character, basicHealth);
    expect(character.stats.Health).toBe(120);
  });

  it('stacks the same teaching learned under several jobs', () => {
    const character = hero({
      teachings: { [WARRIOR]: [basicHealth.id], [RANGER]: [basicHealth.id] },
    });

    expect(character.stats.Health).toBe(120);
  });

  it('adds to what the hero already learned under the job', () => {
    const character = hero({ teachings: { [WARRIOR]: [basicHealth.id] } });
    characterApplyTeaching(character, advanced);

    expect(character.teachings[WARRIOR]).toEqual([basicHealth.id, advanced.id]);
  });

  it("keeps other jobs' teachings untouched", () => {
    const character = hero({ teachings: { [RANGER]: [rangerOnly.id] } });
    characterApplyTeaching(character, basicHealth);

    expect(character.teachings[RANGER]).toEqual([rangerOnly.id]);
  });
});

describe('pruneInvalidCharacterTeachings', () => {
  it('drops unknown jobs, unknown teachings, and duplicates', () => {
    const pruned = pruneInvalidCharacterTeachings({
      [WARRIOR]: [basicHealth.id, basicHealth.id, 'gone' as TrainerTeachingId],
      ['job-removed' as JobId]: [basicHealth.id],
      [RANGER]: ['gone' as TrainerTeachingId],
    });

    expect(pruned).toEqual({ [WARRIOR]: [basicHealth.id] });
  });

  it('tolerates saves without the field', () => {
    expect(pruneInvalidCharacterTeachings(undefined)).toEqual({});
  });
});

describe('pruneInvalidDiscoveredTrainers', () => {
  it('drops trainers that no longer exist', () => {
    expect(
      pruneInvalidDiscoveredTrainers({
        [trainer.id]: { foundAt: 1 },
        ['gone' as TrainerId]: { foundAt: 2 },
      }),
    ).toEqual({ [trainer.id]: { foundAt: 1 } });
  });
});
