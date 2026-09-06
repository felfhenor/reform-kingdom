import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/rng', () => ({
  rngChoiceWeighted: vi.fn(),
}));

vi.mock('@helpers/town/worker/town-worker-travel', () => ({
  townWorkerAssignmentIsValid: vi.fn(),
  townWorkerBeginOutboundTrip: vi.fn(),
}));

vi.mock('@helpers/town/crafting/town-craft-priority-state', () => ({
  townSpecialtyPriority: vi.fn(() => []),
}));

vi.mock('@helpers/town/crafting/town-craft-priority-weight', () => ({
  townItemPriorityMap: vi.fn(() => ({ weightByItem: {}, reservedByItem: {} })),
  townItemPriorityWeightFromMap: vi.fn(() => 1),
}));

vi.mock('@helpers/town/town-resource-thresholds', () => ({
  townMaterialAtOrAboveThreshold: vi.fn(() => false),
}));

vi.mock('@helpers/world-node/world-node-gathering', () => ({
  gatheringResultsAtLevel: vi.fn(),
}));

vi.mock('@helpers/world-node/world-node-level', () => ({
  worldNodeLevel: vi.fn(() => 1),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeGathering: vi.fn(),
  worldNodesOfType: vi.fn(),
}));

import { rngChoiceWeighted } from '@helpers/rng';
import { townMaterialAtOrAboveThreshold } from '@helpers/town/town-resource-thresholds';
import {
  townPickGatherAssignment,
  townWorkerAutoAssign,
} from '@helpers/town/worker/town-worker-auto-assign';
import {
  townWorkerAssignmentIsValid,
  townWorkerBeginOutboundTrip,
} from '@helpers/town/worker/town-worker-travel';
import { gatheringResultsAtLevel } from '@helpers/world-node/world-node-gathering';
import {
  worldNodeGathering,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  GatheringContent,
  ItemId,
  TownContent,
  TownId,
  WorkerId,
  WorldNodeEntry,
} from '@interfaces';

const townId = 'larsia' as TownId;
const workerId = 'darwin' as WorkerId;
const oreId = 'copper-ore' as ItemId;

function buildTown(): TownContent {
  return { id: townId, name: 'Larsia' } as TownContent;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(townMaterialAtOrAboveThreshold).mockReturnValue(false);
});

describe('townPickGatherAssignment', () => {
  it('builds one candidate per reachable (node, item) pair and delegates to rngChoiceWeighted', () => {
    vi.mocked(worldNodesOfType).mockReturnValue([
      { nodeName: 'Wergen Woods' } as WorldNodeEntry,
    ]);
    vi.mocked(worldNodeGathering).mockReturnValue({} as GatheringContent);
    vi.mocked(gatheringResultsAtLevel).mockReturnValue([
      { chance: 5, items: [{ itemId: oreId, quantity: 1 }] },
    ] as never);
    vi.mocked(townWorkerAssignmentIsValid).mockReturnValue(true);
    vi.mocked(rngChoiceWeighted).mockImplementation((items) => items[0]);

    const result = townPickGatherAssignment(buildTown(), workerId, 1);

    expect(result).toEqual({ nodeName: 'Wergen Woods', itemId: oreId });
  });

  it('excludes candidates the worker cannot reach', () => {
    vi.mocked(worldNodesOfType).mockReturnValue([
      { nodeName: 'Wergen Woods' } as WorldNodeEntry,
    ]);
    vi.mocked(worldNodeGathering).mockReturnValue({} as GatheringContent);
    vi.mocked(gatheringResultsAtLevel).mockReturnValue([
      { chance: 5, items: [{ itemId: oreId, quantity: 1 }] },
    ] as never);
    vi.mocked(townWorkerAssignmentIsValid).mockReturnValue(false);
    vi.mocked(rngChoiceWeighted).mockImplementation((items) =>
      items.length > 0 ? items[0] : undefined,
    );

    townPickGatherAssignment(buildTown(), workerId, 1);

    expect(rngChoiceWeighted).toHaveBeenCalledWith([], expect.any(Function));
  });

  it('skips nodes with no gathering content', () => {
    vi.mocked(worldNodesOfType).mockReturnValue([
      { nodeName: 'Not A Gather Node' } as WorldNodeEntry,
    ]);
    vi.mocked(worldNodeGathering).mockReturnValue(undefined);
    vi.mocked(rngChoiceWeighted).mockImplementation((items) =>
      items.length > 0 ? items[0] : undefined,
    );

    townPickGatherAssignment(buildTown(), workerId, 1);

    expect(rngChoiceWeighted).toHaveBeenCalledWith([], expect.any(Function));
  });

  it('excludes an item at or above its town material threshold', () => {
    vi.mocked(worldNodesOfType).mockReturnValue([
      { nodeName: 'Wergen Woods' } as WorldNodeEntry,
    ]);
    vi.mocked(worldNodeGathering).mockReturnValue({} as GatheringContent);
    vi.mocked(gatheringResultsAtLevel).mockReturnValue([
      { chance: 5, items: [{ itemId: oreId, quantity: 1 }] },
    ] as never);
    vi.mocked(townWorkerAssignmentIsValid).mockReturnValue(true);
    vi.mocked(townMaterialAtOrAboveThreshold).mockReturnValue(true);
    vi.mocked(rngChoiceWeighted).mockImplementation((items) =>
      items.length > 0 ? items[0] : undefined,
    );

    townPickGatherAssignment(buildTown(), workerId, 1);

    expect(rngChoiceWeighted).toHaveBeenCalledWith([], expect.any(Function));
  });
});

describe('townWorkerAutoAssign', () => {
  it('does nothing when no assignment resolves', () => {
    vi.mocked(worldNodesOfType).mockReturnValue([]);
    vi.mocked(rngChoiceWeighted).mockReturnValue(undefined);

    townWorkerAutoAssign(buildTown(), workerId, 1);

    expect(townWorkerBeginOutboundTrip).not.toHaveBeenCalled();
  });

  it('begins the outbound trip when an assignment resolves', () => {
    vi.mocked(worldNodesOfType).mockReturnValue([
      { nodeName: 'Wergen Woods' } as WorldNodeEntry,
    ]);
    vi.mocked(worldNodeGathering).mockReturnValue({} as GatheringContent);
    vi.mocked(gatheringResultsAtLevel).mockReturnValue([
      { chance: 5, items: [{ itemId: oreId, quantity: 1 }] },
    ] as never);
    vi.mocked(townWorkerAssignmentIsValid).mockReturnValue(true);
    vi.mocked(rngChoiceWeighted).mockImplementation((items) => items[0]);

    const town = buildTown();
    townWorkerAutoAssign(town, workerId, 1);

    expect(townWorkerBeginOutboundTrip).toHaveBeenCalledWith(
      townId,
      town,
      workerId,
      { nodeName: 'Wergen Woods', itemId: oreId },
    );
  });
});
