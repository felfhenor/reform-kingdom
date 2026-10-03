import type * as RngHelper from '@helpers/rng';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/town/worker/town-worker-travel');
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
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureTown } from '@helpers/content/ensure-town';
import { rngChoiceWeighted } from '@helpers/rng';
import {
  townPickGatherAssignment,
  townWorkerAutoAssign,
} from '@helpers/town/worker/town-worker-auto-assign';
import {
  townWorkerAssignmentIsValid,
  townWorkerBeginOutboundTrip,
} from '@helpers/town/worker/town-worker-travel';
import type {
  GameState,
  GatheringId,
  ItemId,
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
  vi.mocked(townWorkerBeginOutboundTrip).mockClear();
  vi.mocked(townWorkerAssignmentIsValid).mockImplementation(
    (_town, _worker, _level, assignment) =>
      assignment.nodeName !== farMine.name,
  );
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

  it('is undefined when nothing is worth gathering', () => {
    seedWorld({ materials: { [wood]: 10 } });
    vi.mocked(townWorkerAssignmentIsValid).mockReturnValue(false);

    expect(townPickGatherAssignment(town, workerId, 1)).toBeUndefined();
  });
});

describe('townWorkerAutoAssign', () => {
  it('sends the worker out on the picked assignment', () => {
    seedWorld({ materials: { [wood]: 10 } });

    townWorkerAutoAssign(town, workerId, 1);

    expect(townWorkerBeginOutboundTrip).toHaveBeenCalledWith(
      townId,
      town,
      workerId,
      { nodeName: mine.name, itemId: ore },
    );
  });

  it('leaves the worker idle when nothing is picked', () => {
    seedWorld();
    vi.mocked(townWorkerAssignmentIsValid).mockReturnValue(false);

    townWorkerAutoAssign(town, workerId, 1);

    expect(townWorkerBeginOutboundTrip).not.toHaveBeenCalled();
  });
});
