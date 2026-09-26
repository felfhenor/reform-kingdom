import { beforeEach, describe, expect, it } from 'vitest';

import { setAllContentById } from '@helpers/content/content';
import { ensureTrainer } from '@helpers/content/ensure-trainer';
import { defaultEquipment, defaultGameState } from '@helpers/defaults';
import { taskStateRequirementSatisfied } from '@helpers/task/task-requirement-state';
import type {
  Character,
  CollectibleId,
  EquipmentId,
  EquipmentItem,
  EquipmentItemId,
  GameState,
  IsContentItem,
  ItemId,
  JobId,
  MonsterId,
  TownId,
  TownNodeState,
  TradeskillId,
  TrainerId,
  TrainerTeachingId,
  WorkerId,
} from '@interfaces';

const TRAINER = 'trainer-reyn' as TrainerId;
const TEACHING = 'teaching-health' as TrainerTeachingId;
const OTHER_TEACHING = 'teaching-other' as TrainerTeachingId;
const BLACKSMITHING = 'tradeskill-blacksmithing' as TradeskillId;
const STICK = 'item-stick' as ItemId;
const RUBY = 'collectible-ruby' as CollectibleId;
const WORKER = 'worker-welch' as WorkerId;

const WARRIOR = 'job-warrior' as JobId;
const TOWN = 'town-larsia' as TownId;

function hero(
  level: number,
  teachings: TrainerTeachingId[] = [],
  overrides: Partial<Character> = {},
): Character {
  return {
    jobId: WARRIOR,
    level,
    jobProgress: {},
    teachings: { [WARRIOR]: teachings },
    equipment: defaultEquipment(),
    ...overrides,
  } as unknown as Character;
}

function equipmentItem(infusedItemIds: (ItemId | null)[]): EquipmentItem {
  return {
    id: 'armory-1' as EquipmentItemId,
    equipmentId: 'equipment-sword' as EquipmentId,
    infusedItemIds,
    affixIds: [],
  };
}

function withTradeskillLevel(state: GameState, level: number): GameState {
  state.tradeskills[BLACKSMITHING] = {
    level,
    xp: { current: 0, maximum: 10 },
    queue: [],
  };
  return state;
}

beforeEach(() => {
  const content: IsContentItem[] = [
    ensureTrainer({
      id: TRAINER,
      name: 'Reyn Astra',
      trainerTeachingIds: [TEACHING],
    }),
  ];
  setAllContentById(new Map(content.map((entry) => [entry.id, entry])));
});

describe('taskStateRequirementSatisfied', () => {
  it('uses the highest hero level for ReachLevel', () => {
    const state = defaultGameState();
    state.world.party = [hero(1), hero(3)];

    expect(
      taskStateRequirementSatisfied(state, { kind: 'ReachLevel', level: 3 }),
    ).toBe(true);
    expect(
      taskStateRequirementSatisfied(state, { kind: 'ReachLevel', level: 4 }),
    ).toBe(false);
  });

  it('checks the tradeskill building level', () => {
    const state = withTradeskillLevel(defaultGameState(), 5);
    const requirement = {
      kind: 'TradeskillLevel' as const,
      tradeskillId: BLACKSMITHING,
      level: 5,
    };

    expect(taskStateRequirementSatisfied(state, requirement)).toBe(true);
    expect(
      taskStateRequirementSatisfied(state, { ...requirement, level: 6 }),
    ).toBe(false);
  });

  it('needs the collectible currently owned', () => {
    const state = defaultGameState();
    const requirement = {
      kind: 'OwnCollectible' as const,
      collectibleId: RUBY,
    };

    expect(taskStateRequirementSatisfied(state, requirement)).toBe(false);
    state.collectibles[RUBY] = { quantity: 1, foundAt: 1 };
    expect(taskStateRequirementSatisfied(state, requirement)).toBe(true);
  });

  it('accepts any hero knowing any of the trainer teachings', () => {
    const state = defaultGameState();
    const requirement = { kind: 'LearnTeaching' as const, trainerId: TRAINER };

    state.world.party = [hero(3, [OTHER_TEACHING])];
    expect(taskStateRequirementSatisfied(state, requirement)).toBe(false);

    state.world.party = [hero(3), hero(3, [TEACHING])];
    expect(taskStateRequirementSatisfied(state, requirement)).toBe(true);
  });

  it('is unmet for an unknown trainer', () => {
    const state = defaultGameState();
    state.world.party = [hero(3, [TEACHING])];

    expect(
      taskStateRequirementSatisfied(state, {
        kind: 'LearnTeaching',
        trainerId: 'missing' as TrainerId,
      }),
    ).toBe(false);
  });

  it('checks the worker discovery ledger for RescueWorker', () => {
    const state = defaultGameState();
    const requirement = { kind: 'RescueWorker' as const, workerId: WORKER };

    expect(taskStateRequirementSatisfied(state, requirement)).toBe(false);
    state.discoveredWorkers[WORKER] = { foundAt: 1 };
    expect(taskStateRequirementSatisfied(state, requirement)).toBe(true);
  });

  it('reads lifetime bestiary kills for DefeatMonster', () => {
    const state = defaultGameState();
    const requirement = {
      kind: 'DefeatMonster' as const,
      monsterId: 'goblin' as MonsterId,
      quantity: 25,
    };

    expect(taskStateRequirementSatisfied(state, requirement)).toBe(false);
    state.bestiary['goblin' as MonsterId] = {
      foundAt: 1,
      kills: 25,
      minLevelFound: 1,
      maxLevelFound: 2,
      foundAtNodes: [],
    };
    expect(taskStateRequirementSatisfied(state, requirement)).toBe(true);
  });

  it('treats an unbuilt shrine as level 0', () => {
    const state = defaultGameState();
    const requirement = {
      kind: 'ShrineLevel' as const,
      nodeName: 'Shrine of the Founder',
      level: 1,
    };

    expect(taskStateRequirementSatisfied(state, requirement)).toBe(false);
    state.shrines['Shrine of the Founder'] = { level: 1 };
    expect(taskStateRequirementSatisfied(state, requirement)).toBe(true);
  });

  it('converts town reputation into a tier', () => {
    const state = defaultGameState();
    const requirement = {
      kind: 'TownReputationTier' as const,
      townId: TOWN,
      tier: 2,
    };

    state.world.towns[TOWN] = { reputation: 599 } as unknown as TownNodeState;
    expect(taskStateRequirementSatisfied(state, requirement)).toBe(false);

    state.world.towns[TOWN] = { reputation: 600 } as unknown as TownNodeState;
    expect(taskStateRequirementSatisfied(state, requirement)).toBe(true);
  });

  it('needs a first visit for VisitTown', () => {
    const state = defaultGameState();
    const requirement = { kind: 'VisitTown' as const, townId: TOWN };

    state.world.towns[TOWN] = { reputation: 0 } as unknown as TownNodeState;
    expect(taskStateRequirementSatisfied(state, requirement)).toBe(false);

    state.world.towns[TOWN] = {
      reputation: 0,
      firstVisitedAtTick: 0,
    } as unknown as TownNodeState;
    expect(taskStateRequirementSatisfied(state, requirement)).toBe(true);
  });

  it('finds an infusion on armory or equipped gear', () => {
    const requirement = { kind: 'InfuseEquipment' as const };

    const empty = defaultGameState();
    empty.armory = [equipmentItem([null])];
    expect(taskStateRequirementSatisfied(empty, requirement)).toBe(false);

    const inArmory = defaultGameState();
    inArmory.armory = [equipmentItem([null, STICK])];
    expect(taskStateRequirementSatisfied(inArmory, requirement)).toBe(true);

    const equipped = defaultGameState();
    equipped.world.party = [
      hero(1, [], {
        equipment: { ...defaultEquipment(), Weapon: equipmentItem([STICK]) },
      }),
    ];
    expect(taskStateRequirementSatisfied(equipped, requirement)).toBe(true);
  });
});
