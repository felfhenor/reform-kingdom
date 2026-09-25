import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => {
  const gamestate = vi.fn();
  return {
    gamestate,
    updateGamestate: vi.fn(),
    worldPartyState: () => gamestate().world.party,
    collectiblesState: () => gamestate().collectibles,
    discoveredTrainersState: () => gamestate().discoveredTrainers,
    worldCombatState: vi.fn(),
  };
});

vi.mock('@helpers/world', () => ({
  worldNodeAtCurrentLocation: vi.fn(),
}));

import { setAllContentById } from '@helpers/content/content';
import { defaultEquipment, defaultStats } from '@helpers/defaults';
import { characterStatsForLevel } from '@helpers/hero/party';
import { gamestate } from '@helpers/state-game';
import {
  characterApplyTeaching,
  isPartyAtTrainer,
  pruneInvalidCharacterTeachings,
  pruneInvalidDiscoveredTrainers,
  trainerForTeaching,
  trainerTeachingAvailability,
  trainerTeachingsForJob,
} from '@helpers/trainer/trainer';
import { characterAllTeachingIds } from '@helpers/trainer/trainer-teaching';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import type {
  Character,
  CharacterId,
  CollectibleId,
  GameState,
  IsContentItem,
  JobContent,
  JobId,
  TrainerContent,
  TrainerId,
  TrainerTeachingContent,
  TrainerTeachingId,
  WorldNodeEntry,
} from '@interfaces';

const WARRIOR = 'job-warrior' as JobId;
const RANGER = 'job-ranger' as JobId;
const RUBY = 'Goblin Ruby' as CollectibleId;

const warriorJob = {
  id: WARRIOR,
  name: 'Warrior',
  __type: 'job',
  baseStats: { ...defaultStats(), Health: 100, Energy: 20 },
  statsPerLevel: defaultStats(),
} as JobContent;

function teaching(
  overrides: Partial<TrainerTeachingContent>,
): TrainerTeachingContent {
  return {
    id: 'teach' as TrainerTeachingId,
    name: 'Teach',
    __type: 'trainerteaching',
    effects: [],
    requiredLevel: 1,
    costs: [],
    jobIds: [WARRIOR],
    requiredCollectibleIds: [],
    requiredTrainerTeachingIds: [],
    ...overrides,
  };
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

const trainer = {
  id: 'trainer-reyn' as TrainerId,
  name: 'Reyn Astra',
  __type: 'trainer',
  trainerTeachingIds: [basicHealth.id, advanced.id, rangerOnly.id],
} as TrainerContent;

function hero(overrides: Partial<Character> = {}): Character {
  const base = {
    id: 'hero' as CharacterId,
    name: 'Jala',
    level: 1,
    xp: { current: 0, maximum: 100 },
    jobId: WARRIOR,
    jobProgress: {},
    combatOrders: {},
    teachings: {},
    equipment: defaultEquipment(),
    ...overrides,
  } as Character;
  const stats = characterStatsForLevel(
    base.jobId,
    base.level,
    base.equipment,
    characterAllTeachingIds(base),
  );
  return { ...base, stats, hp: stats.Health, ep: stats.Energy };
}

function setState(
  party: Character[],
  collectibles: Partial<GameState['collectibles']> = {},
): void {
  vi.mocked(gamestate).mockReturnValue({
    world: { party },
    collectibles,
    discoveredTrainers: {},
  } as unknown as GameState);
}

beforeEach(() => {
  vi.clearAllMocks();
  setAllContentById(
    new Map<string, IsContentItem>(
      [warriorJob, basicHealth, advanced, rangerOnly, trainer].map(
        (content) => [content.id, content],
      ),
    ),
  );
  setState([]);
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

    setState([], { [RUBY]: { quantity: 1, foundAt: 1 } });
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
    vi.mocked(worldNodeAtCurrentLocation).mockReturnValue({
      nodeName: trainer.id,
    } as unknown as WorldNodeEntry);
    expect(isPartyAtTrainer(trainer.id)).toBe(true);
    expect(isPartyAtTrainer('other' as TrainerId)).toBe(false);

    vi.mocked(worldNodeAtCurrentLocation).mockReturnValue(undefined);
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
