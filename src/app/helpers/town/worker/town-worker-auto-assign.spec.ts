import type * as RngHelper from '@helpers/rng';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/town/worker/town-worker-travel');
vi.mock('@helpers/worker/worker-trip');
vi.mock('@helpers/rng', async (importOriginal) => {
  const actual = await importOriginal<typeof RngHelper>();
  return {
    ...actual,
    rngChoiceWeighted: vi.fn(actual.rngChoiceWeighted),
  };
});

import { TOWN_PRIORITY_WEIGHT_PER_FAILURE } from '@helpers/config';
import {
  ensureGatherResult,
  ensureGathering,
} from '@helpers/content/ensure-gathernode';
import { ensureEncounter } from '@helpers/content/ensure-encounternode';
import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import { ensureItem } from '@helpers/content/ensure-item';
import { ensureMonster } from '@helpers/content/ensure-monster';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureTown } from '@helpers/content/ensure-town';
import { ensureWorker } from '@helpers/content/ensure-worker';
import { rngChoiceWeighted } from '@helpers/rng';
import {
  townPickGatherAssignment,
  townWorkerAutoAssign,
} from '@helpers/town/worker/town-worker-auto-assign';
import { worldTownsState } from '@helpers/state-game';
import { defaultTownWorkerState } from '@helpers/town/worker/town-worker-progression';
import {
  townWorkerAssignmentIsValid,
  townWorkerCanReach,
} from '@helpers/town/worker/town-worker-travel';
import { workerTripBeginOutbound } from '@helpers/worker/worker-trip';
import type {
  EncounterId,
  GameState,
  GatheringId,
  ItemId,
  MonsterId,
  RecipeId,
  TownId,
  TownNodeState,
  WorkerId,
} from '@interfaces';
import { buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const townId = 'larsia' as TownId;
const workerId = 'darwin' as WorkerId;
const ore = 'copper-ore' as ItemId;
const wood = 'oak-log' as ItemId;
const gem = 'rough-gem' as ItemId;

const town = ensureTown({
  id: townId,
  name: 'Larsia',
  materialThresholds: [{ itemId: wood, maxQuantity: 10 }],
});

const mine = ensureGathering({
  id: 'mine' as GatheringId,
  name: 'Copper Mine',
  gatherResults: [
    { chance: 5, items: [{ itemId: ore, quantity: 1 }] },
    { chance: 1, items: [{ itemId: gem, quantity: 1 }], levelRequirement: 2 },
  ].map(ensureGatherResult),
});
const woods = ensureGathering({
  id: 'woods' as GatheringId,
  name: 'Wergen Woods',
  gatherResults: [
    ensureGatherResult({ chance: 3, items: [{ itemId: wood, quantity: 1 }] }),
  ],
});
const farMine = ensureGathering({
  ...mine,
  id: 'far' as GatheringId,
  name: 'Far Mine',
});

const oreRecipe = ensureRecipe({
  id: 'ingot' as RecipeId,
  requirements: [{ itemId: ore, quantity: 1 }],
});

function seedWorld(
  townState: Partial<TownNodeState> = {},
  edit?: (state: GameState) => void,
): void {
  seedWorldNodes([
    { name: town.name, type: 'NonPlayerKingdom' },
    { name: mine.name, type: 'GatherNode' },
    { name: woods.name, type: 'GatherNode' },
    { name: farMine.name, type: 'GatherNode' },
    { name: 'Field', type: 'GatherNode' },
    { name: 'Goblin Den', type: 'ExploreNode' },
  ]);
  seedGamestate((state) => {
    state.world.towns[townId] = buildTownNodeState(townState);
    edit?.(state);
  });
}

// What the weighted pick was offered, with each candidate's weight resolved.
function offered() {
  const [items, weightFn] = vi.mocked(rngChoiceWeighted).mock.lastCall!;
  return (items as { nodeName: string; itemId: ItemId }[]).map((item) => ({
    nodeName: item.nodeName,
    itemId: item.itemId,
    weight: weightFn(item),
  }));
}

beforeEach(() => {
  vi.mocked(rngChoiceWeighted).mockClear();
  vi.mocked(workerTripBeginOutbound).mockClear();
  vi.mocked(townWorkerAssignmentIsValid).mockImplementation(
    (_town, _worker, _level, assignment) =>
      assignment.nodeName !== farMine.name,
  );
  vi.mocked(townWorkerCanReach).mockReturnValue(true);
  seedContent([town, mine, woods, farMine, oreRecipe]);
});

describe('townPickGatherAssignment', () => {
  it('offers every reachable gatherable item at the node’s level, weighted by its chance', () => {
    seedWorld();

    const picked = townPickGatherAssignment(town, workerId, 1);

    expect(offered()).toEqual([
      { nodeName: mine.name, itemId: ore, weight: 5 },
      { nodeName: woods.name, itemId: wood, weight: 3 },
    ]);
    expect([ore, wood]).toContain(picked?.itemId);
  });

  it('includes results unlocked by the node’s level', () => {
    seedWorld(
      {},
      (state) => (state.gatherNodeLevels[mine.name] = { level: 2 }),
    );

    townPickGatherAssignment(town, workerId, 1);

    expect(offered()).toContainEqual({
      nodeName: mine.name,
      itemId: gem,
      weight: 1,
    });
  });

  it('skips items the town already has up to its threshold', () => {
    seedWorld({ materials: { [wood]: 10 } });

    townPickGatherAssignment(town, workerId, 1);

    expect(offered().map((c) => c.itemId)).toEqual([ore]);
  });

  it('boosts materials a struggling specialty recipe needs', () => {
    seedWorld({
      specialtyPriority: [{ recipeId: oreRecipe.id, failureCount: 2 }],
    });

    townPickGatherAssignment(town, workerId, 1);

    expect(offered()).toEqual([
      {
        nodeName: mine.name,
        itemId: ore,
        weight: 5 * (1 + TOWN_PRIORITY_WEIGHT_PER_FAILURE * 2),
      },
      { nodeName: woods.name, itemId: wood, weight: 3 },
    ]);
  });

  it('fights only for monster drops the town caps and still needs', () => {
    const teeth = 'goblin-teeth' as ItemId;
    seedContent([
      town,
      mine,
      woods,
      farMine,
      oreRecipe,
      ensureWorker({
        id: workerId,
        baseStats: {
          capacity: 5,
          gatherSpeed: 1,
          craftSpeed: 0,
          stamina: 100,
          combatPower: 1,
          combatSpeed: 1,
        },
      }),
      ...[
        'Gold Coin',
        'Crimson Lucre',
        'Trader Scrip',
        'Duskhall Flux',
        'Memory Flux',
      ].map((name) => ensureItem({ id: name as ItemId, name })),
      ensureMonster({
        id: 'goblin' as MonsterId,
        name: 'Goblin',
        drops: [
          ensureDroppedReward({ itemId: wood, chance: 40 }),
          ensureDroppedReward({ itemId: teeth, chance: 90 }),
        ],
      }),
      ensureEncounter({
        id: 'den' as EncounterId,
        name: 'Goblin Den',
        fights: [{ monsters: [{ monsterId: 'goblin' as MonsterId }] }],
      }),
    ]);
    seedWorld();

    townPickGatherAssignment(town, workerId, 1);
    expect(offered()).toContainEqual({
      nodeName: 'Goblin Den',
      itemId: wood,
      weight: 0.4,
    });
    expect(offered().map((c) => c.itemId)).not.toContain(teeth);

    seedWorld({ materials: { [wood]: 10 } });
    townPickGatherAssignment(town, workerId, 1);
    expect(offered().map((c) => c.nodeName)).not.toContain('Goblin Den');
  });

  it('is undefined when nothing is worth gathering', () => {
    seedWorld({ materials: { [wood]: 10 } });
    vi.mocked(townWorkerAssignmentIsValid).mockReturnValue(false);

    expect(townPickGatherAssignment(town, workerId, 1)).toBeUndefined();
  });
});

describe('townWorkerAutoAssign', () => {
  it('sends the worker out on the picked assignment', () => {
    seedWorld({
      materials: { [wood]: 10 },
      workers: { [workerId]: defaultTownWorkerState(town, 1) },
    });

    townWorkerAutoAssign(town, workerId, 1);

    expect(workerTripBeginOutbound).toHaveBeenCalledWith(expect.anything(), {
      nodeName: mine.name,
      itemId: ore,
    });
    const [host] = vi.mocked(workerTripBeginOutbound).mock.calls[0];
    expect(host.read()).toBe(worldTownsState()[townId].workers[workerId]);
  });

  it('leaves the worker idle when nothing is picked', () => {
    seedWorld();
    vi.mocked(townWorkerAssignmentIsValid).mockReturnValue(false);

    townWorkerAutoAssign(town, workerId, 1);

    expect(workerTripBeginOutbound).not.toHaveBeenCalled();
  });
});
