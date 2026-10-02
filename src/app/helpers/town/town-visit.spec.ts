import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/town/crafting/town-craft-queue');
vi.mock('@helpers/task/task-events');
vi.mock('@helpers/world');

import {
  TOWN_FIRST_VISIT_COMPLETED_CRAFT_COUNT,
  TOWN_FIRST_VISIT_CRAFT_COUNT,
} from '@helpers/config';
import { ensureTown } from '@helpers/content/ensure-town';
import { ensureTradeskill } from '@helpers/content/ensure-tradeskill';
import { worldTownsState } from '@helpers/state-game';
import { taskEventTownVisited } from '@helpers/task/task-events';
import {
  townCompleteInitialCrafts,
  townQueueInitialCrafts,
} from '@helpers/town/crafting/town-craft-queue';
import { isPartyAtTown, townMarkVisited } from '@helpers/town/town-visit';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import type {
  CraftQueueEntryId,
  EquipmentId,
  IsContentItem,
  ItemId,
  RecipeId,
  TownContent,
  TownId,
  TownNodeState,
  TradeskillId,
  WorkerId,
  WorldNodeEntry,
} from '@interfaces';
import { captureAnalyticsEvents } from '@/testing/analytics';
import { buildEquipmentItem, buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';

const townId = 'larsia' as TownId;
const oreId = 'copper-ore' as ItemId;

function seedTown(
  overrides: Partial<TownContent> = {},
  otherContent: IsContentItem[] = [],
): TownContent {
  const town = ensureTown({ id: townId, name: 'Larsia', ...overrides });
  seedContent([town, ...otherContent]);
  return town;
}

function seedTownState(existing?: Partial<TownNodeState>): void {
  seedGamestate((state) => {
    state.clock.numTicks = 500;
    if (existing) state.world.towns[townId] = buildTownNodeState(existing);
  });
}

function visitedTown(): TownNodeState {
  inTick(() => townMarkVisited(townId));
  return worldTownsState()[townId];
}

beforeEach(() => {
  vi.clearAllMocks();
  seedTown();
});

describe('townMarkVisited', () => {
  it('activates a fresh town with empty progress, starting the raid cooldown at the current tick', () => {
    seedTownState();

    expect(visitedTown()).toMatchObject(
      buildTownNodeState({
        firstVisitedAtTick: 500,
        lastRaidResolvedAtTick: 500,
      }),
    );
  });

  it('fires the visit analytics and task event on first visit', () => {
    seedTownState();
    const events = captureAnalyticsEvents();

    visitedTown();

    expect(events).toContain('Town:Visit:Larsia');
    expect(taskEventTownVisited).toHaveBeenCalledWith(townId);
  });

  it('keeps progress the town accrued before it was activated', () => {
    const existing = buildTownNodeState({
      lastProcessedTick: { worker: 42 },
      stock: [
        {
          equipmentItem: buildEquipmentItem('sword' as EquipmentId),
          addedAtTick: 10,
        },
      ],
      craftQueue: [
        {
          id: 'q1' as CraftQueueEntryId,
          tradeskillId: 'jewelcrafting' as TradeskillId,
          recipeId: 'ring' as RecipeId,
          ticksIntoCraft: 3,
        },
      ],
      reputation: 250,
      hiddenGold: 1200,
      lastRaidResolvedAtTick: 42,
    });
    seedTownState(existing);

    expect(visitedTown()).toMatchObject(existing);
  });

  it('sets tradeskill levels from the town content seed', () => {
    const blacksmithingId = 'blacksmithing' as TradeskillId;
    seedTown(
      {
        crafting: {
          tradeskillLevels: [{ tradeskillId: blacksmithingId, level: 4 }],
        } as TownContent['crafting'],
      },
      [ensureTradeskill({ id: blacksmithingId, name: 'Blacksmithing' })],
    );
    seedTownState();

    expect(visitedTown().tradeskills).toEqual({
      [blacksmithingId]: { level: 4 },
    });
  });

  it('seeds materials from threshold defaults, letting existing quantities win', () => {
    seedTown({
      materialThresholds: [
        { itemId: 'gold-coin', default: 5000 },
        { itemId: oreId, default: 30 },
        { itemId: 'amber' },
      ] as TownContent['materialThresholds'],
    });
    seedTownState({ materials: { [oreId]: 8 } });

    expect(visitedTown().materials).toEqual({
      'gold-coin': 5000,
      [oreId]: 8,
    });
  });

  it('adds missing roster workers without resetting existing ones', () => {
    const existingId = 'existing' as WorkerId;
    const newId = 'new-hire' as WorkerId;
    seedTown({
      gathering: {
        workers: [{ workerId: existingId }, { workerId: newId }],
      } as TownContent['gathering'],
    });
    seedTownState();
    const existingWorker = { ...visitedTown().workers[existingId], level: 9 };
    seedTownState({ workers: { [existingId]: existingWorker } });

    const workers = visitedTown().workers;

    expect(workers[existingId]).toEqual(existingWorker);
    expect(workers[newId]).toBeDefined();
  });

  it('completes initial crafts before queueing more on first visit', () => {
    seedTownState();

    visitedTown();

    // Only the town and count args: the state arg is an Immer draft, revoked once the update ends.
    const [, completedTown, completedCount] = vi.mocked(
      townCompleteInitialCrafts,
    ).mock.calls[0];
    const [, queuedTown, queuedCount] = vi.mocked(townQueueInitialCrafts).mock
      .calls[0];
    expect(completedTown.id).toBe(townId);
    expect(completedCount).toBe(TOWN_FIRST_VISIT_COMPLETED_CRAFT_COUNT);
    expect(queuedTown.id).toBe(townId);
    expect(queuedCount).toBe(TOWN_FIRST_VISIT_CRAFT_COUNT);
    expect(
      vi.mocked(townCompleteInitialCrafts).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(townQueueInitialCrafts).mock.invocationCallOrder[0],
    );
  });

  it('is a no-op and fires no analytics if the town was already visited', () => {
    seedTownState({ firstVisitedAtTick: 100 });
    const events = captureAnalyticsEvents();

    expect(visitedTown().firstVisitedAtTick).toBe(100);
    expect(townQueueInitialCrafts).not.toHaveBeenCalled();
    expect(townCompleteInitialCrafts).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });
});

describe('isPartyAtTown', () => {
  it('is false when the party is nowhere (no current location)', () => {
    vi.mocked(worldNodeAtCurrentLocation).mockReturnValue(undefined);

    expect(isPartyAtTown(townId)).toBe(false);
  });

  it('is false when the current location is a different town', () => {
    seedTown({}, [
      ensureTown({ id: 'other-town' as TownId, name: 'Otherton' }),
    ]);
    vi.mocked(worldNodeAtCurrentLocation).mockReturnValue({
      nodeName: 'Otherton',
    } as WorldNodeEntry);

    expect(isPartyAtTown(townId)).toBe(false);
  });

  it('is true when the current location resolves to this town', () => {
    vi.mocked(worldNodeAtCurrentLocation).mockReturnValue({
      nodeName: 'Larsia',
    } as WorldNodeEntry);

    expect(isPartyAtTown(townId)).toBe(true);
  });
});
