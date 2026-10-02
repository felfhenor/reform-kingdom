import type * as PartyHelper from '@helpers/hero/party';
import type * as RngHelper from '@helpers/rng';
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

vi.mock('@helpers/hero/character-progress');
vi.mock('@helpers/hero/luck');
vi.mock('@helpers/task/task-progress');
vi.mock('@helpers/hero/party', async (importOriginal) => ({
  ...(await importOriginal<typeof PartyHelper>()),
  partyGatherYieldBonuses: vi.fn(() => []),
}));
vi.mock('@helpers/rng', async (importOriginal) => ({
  ...(await importOriginal<typeof RngHelper>()),
  rngSucceedsChance: vi.fn(() => false),
}));

import { combatLog, ITEM_ICON_TOKEN } from '@helpers/combat/combat-log';
import {
  ensureGatherResult,
  ensureGathering,
} from '@helpers/content/ensure-gathernode';
import { ensureItem } from '@helpers/content/ensure-item';
import { gatherVfx$ } from '@helpers/engine/gather-vfx';
import { partyGainXp } from '@helpers/hero/character-progress';
import { luckRollSucceeds, partyMaxLuck } from '@helpers/hero/luck';
import { partyGatherYieldBonuses } from '@helpers/hero/party';
import {
  canEnterGatherNode,
  currentGatheringContent,
  gatheringItemDropRateBoost,
  gatheringProcessTick,
  gatheringProgressFraction,
  gatheringRollResult,
  gatheringStart,
  gatheringStop,
  isGathering,
  partyMaxLevel,
  partyMinLevel,
} from '@helpers/item/gathering';
import { rngSucceedsChance } from '@helpers/rng';
import { gamestate, worldGatheringState } from '@helpers/state-game';
import { taskRecordGather } from '@helpers/task/task-progress';
import type {
  GameState,
  GatherResult,
  GatheringContent,
  GatheringId,
  GatherVfxEvent,
  ItemId,
  TradeskillId,
} from '@interfaces';
import { buildCharacter } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const nodeName = 'Wergen Woods';
const gatheringId = 'gather-1' as GatheringId;
const woodId = 'wood' as ItemId;
const stickId = 'stick' as ItemId;
const hideId = 'hide' as ItemId;
const woodworking = 'woodworking' as TradeskillId;
const tailoring = 'tailoring' as TradeskillId;

function seedGathering(
  overrides: Partial<GatheringContent> = {},
): GatheringContent {
  const gathering = ensureGathering({
    id: gatheringId,
    name: nodeName,
    levelRange: { min: 1, max: 5 },
    xpGainedIfInLevelRange: 3,
    gatherTime: 5,
    ...overrides,
  });
  seedContent([
    gathering,
    ensureItem({ id: woodId, name: 'Wergen Wood', sprite: 'wood-sprite' }),
    ensureItem({ id: stickId, name: 'Wergen Stick', sprite: 'stick-sprite' }),
    ensureItem({ id: hideId, name: 'Hide' }),
  ]);
  return gathering;
}

function result(
  items: GatherResult['items'],
  overrides: Partial<GatherResult> = {},
): GatherResult {
  return ensureGatherResult({ chance: 100, items, ...overrides });
}

function seedParty(...levels: number[]): void {
  seedGamestate((state) => {
    state.world.party = levels.map((level) => buildCharacter({ level }));
  });
}

function seedGatheringAt(
  ticksIntoGather: number,
  edit?: (state: GameState) => void,
): void {
  seedGamestate((state) => {
    state.world.party = [buildCharacter({ level: 3 })];
    state.world.gathering = {
      status: 'Gathering',
      nodeName,
      gatheringId,
      ticksIntoGather,
    };
    edit?.(state);
  });
}

function material(itemId: ItemId): number | undefined {
  return gamestate().materials[itemId]?.quantity;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(partyGatherYieldBonuses).mockReturnValue([]);
  vi.mocked(rngSucceedsChance).mockReturnValue(false);
  vi.mocked(luckRollSucceeds).mockReturnValue(false);
  seedWorldNodes([
    { name: nodeName, type: 'GatherNode' },
    { name: 'Field Ruins', type: 'ExploreNode' },
  ]);
});

describe('partyMinLevel / partyMaxLevel', () => {
  it('reads the lowest and highest party level', () => {
    seedParty(5, 2, 9);

    expect(partyMinLevel()).toBe(2);
    expect(partyMaxLevel()).toBe(9);
  });

  it('defaults both to 1 for an empty party', () => {
    seedParty();

    expect(partyMinLevel()).toBe(1);
    expect(partyMaxLevel()).toBe(1);
  });
});

describe('canEnterGatherNode', () => {
  beforeEach(() => seedGathering({ levelRange: { min: 3, max: 5 } }));

  it('allows entry to a missing node or one that is not a gather node', () => {
    seedParty(1);

    expect(canEnterGatherNode('Nowhere')).toBe(true);
    expect(canEnterGatherNode('Field Ruins')).toBe(true);
  });

  it('gates only on the minimum level, not the maximum', () => {
    seedParty(2);
    expect(canEnterGatherNode(nodeName)).toBe(false);

    seedParty(3);
    expect(canEnterGatherNode(nodeName)).toBe(true);

    seedParty(99);
    expect(canEnterGatherNode(nodeName)).toBe(true);
  });

  it('gates on the lowest-level hero', () => {
    seedParty(9, 2);

    expect(canEnterGatherNode(nodeName)).toBe(false);
  });
});

describe('isGathering / currentGatheringContent / gatheringProgressFraction', () => {
  it('reports nothing while idle', () => {
    seedGathering();
    seedGamestate();

    expect(isGathering()).toBe(false);
    expect(currentGatheringContent()).toBeUndefined();
    expect(gatheringProgressFraction()).toBe(0);
  });

  it('reports ticks elapsed over gatherTime, clamped to 1', () => {
    const gathering = seedGathering({ gatherTime: 5 });
    seedGatheringAt(8);

    expect(isGathering()).toBe(true);
    expect(currentGatheringContent()).toEqual(gathering);
    expect(gatheringProgressFraction()).toBe(1);
  });

  it('measures against the upgraded gather time', () => {
    seedGathering({ gatherTime: 6, gatherReductionPerUpgradeLevel: 1 });
    seedGatheringAt(2, (state) => {
      state.gatherNodeLevels[nodeName] = { level: 2 };
    });

    expect(gatheringProgressFraction()).toBe(0.5);
  });
});

describe('gatheringRollResult', () => {
  it('only ever picks a result with weight', () => {
    const picked = result([{ itemId: woodId, quantity: 1 }], { chance: 10 });
    const gathering = seedGathering({
      gatherResults: [
        ...Array.from({ length: 9 }, () => result([], { chance: 0 })),
        picked,
      ],
    });

    const rolls = Array.from({ length: 10 }, () =>
      gatheringRollResult(gathering, 0),
    );

    expect(rolls).toEqual(Array.from({ length: 10 }, () => picked));
  });
});

describe('gatheringStart / gatheringStop', () => {
  beforeEach(() => seedGathering({ levelRange: { min: 5, max: 10 } }));

  it('refuses a missing node, a non-gather node, or an underleveled party', () => {
    seedParty(1);
    const before = gamestate();

    inTick(() => {
      expect(gatheringStart('Nowhere')).toBe(false);
      expect(gatheringStart('Field Ruins')).toBe(false);
      expect(gatheringStart(nodeName)).toBe(false);
    });

    expect(gamestate()).toBe(before);
  });

  it('starts gathering, logs it, and stops back to idle', () => {
    seedParty(5);

    expect(inTick(() => gatheringStart(nodeName))).toBe(true);
    expect(worldGatheringState()).toEqual({
      status: 'Gathering',
      nodeName,
      gatheringId,
      ticksIntoGather: 0,
    });
    expect(combatLog()[0]).toMatchObject({
      kind: 'Gather',
      locationName: nodeName,
    });

    inTick(gatheringStop);
    expect(isGathering()).toBe(false);
  });
});

describe('gatheringProcessTick', () => {
  function captureVfx(): GatherVfxEvent[] {
    const events: GatherVfxEvent[] = [];
    const subscription = gatherVfx$.subscribe((event) => events.push(event));
    onTestFinished(() => subscription.unsubscribe());
    return events;
  }

  it('does nothing when not gathering', () => {
    seedGathering();
    const before = seedGamestate();

    inTick(gatheringProcessTick);

    expect(gamestate()).toBe(before);
  });

  it('accumulates ticks without resolving until gatherTime is reached', () => {
    seedGathering({ gatherTime: 5 });
    seedGatheringAt(2);

    inTick(gatheringProcessTick);

    expect(worldGatheringState().ticksIntoGather).toBe(3);
    expect(partyGainXp).not.toHaveBeenCalled();
  });

  it('resolves a cycle sooner on an upgraded node', () => {
    seedGathering({ gatherTime: 5, gatherReductionPerUpgradeLevel: 1 });
    seedGatheringAt(2, (state) => {
      state.gatherNodeLevels[nodeName] = { level: 2 };
    });

    inTick(gatheringProcessTick);

    expect(partyGainXp).toHaveBeenCalled();
    expect(worldGatheringState().ticksIntoGather).toBe(0);
  });

  it('resolves a cycle: grants in-range xp and items, logs them, and resets the counter', () => {
    seedGathering({
      gatherResults: [result([{ itemId: woodId, quantity: 2 }])],
    });
    seedGatheringAt(4);
    const vfx = captureVfx();

    inTick(gatheringProcessTick);

    const xpAtLevel = vi.mocked(partyGainXp).mock.calls[0][0];
    expect([0, 1, 5, 6].map(xpAtLevel)).toEqual([0, 3, 3, 0]);
    expect(material(woodId)).toBe(2);
    expect(taskRecordGather).toHaveBeenCalledWith(nodeName, woodId, 2);
    expect(vfx).toEqual([
      expect.objectContaining({ nodeName, name: 'Wergen Wood', quantity: 2 }),
    ]);
    expect(worldGatheringState().ticksIntoGather).toBe(0);
  });

  it('logs every granted item line with its own icon', () => {
    seedGathering({
      gatherResults: [
        result([
          { itemId: woodId, quantity: 2 },
          { itemId: stickId, quantity: 1 },
        ]),
      ],
    });
    seedGatheringAt(4);

    inTick(gatheringProcessTick);

    const entry = combatLog()[0];
    expect(entry.message.split(ITEM_ICON_TOKEN)).toHaveLength(3);
    expect(entry.itemIcons).toEqual([
      { sprite: 'wood-sprite', spritesheet: 'item' },
      { sprite: 'stick-sprite', spritesheet: 'item' },
    ]);
  });

  it('doubles item quantities on a successful luck roll at the party max luck', () => {
    seedGathering({
      gatherResults: [result([{ itemId: woodId, quantity: 2 }])],
    });
    seedGatheringAt(4);
    vi.mocked(partyMaxLuck).mockReturnValue(50);
    vi.mocked(luckRollSucceeds).mockReturnValue(true);

    inTick(gatheringProcessTick);

    expect(luckRollSucceeds).toHaveBeenCalledWith(50);
    expect(material(woodId)).toBe(4);
  });

  it("adds a GatherYield bonus matching any of the rolled result's tradeskills, once per cycle", () => {
    seedGathering({
      gatherResults: [
        result(
          [
            { itemId: woodId, quantity: 2 },
            { itemId: stickId, quantity: 1 },
          ],
          { tradeskillIds: [woodworking, tailoring] },
        ),
      ],
    });
    seedGatheringAt(4);
    vi.mocked(partyGatherYieldBonuses).mockReturnValue([
      { tradeskillId: tailoring, value: 3 },
      { tradeskillId: 'blacksmithing' as TradeskillId, value: 100 },
    ]);

    inTick(gatheringProcessTick);

    expect(material(woodId)).toBe(5);
    expect(material(stickId)).toBe(1);
  });

  it("ignores a GatherYield bonus for another result at the node that wasn't rolled", () => {
    seedGathering({
      gatherResults: [
        result([{ itemId: woodId, quantity: 2 }], {
          tradeskillIds: [woodworking],
        }),
        result([{ itemId: hideId, quantity: 1 }], {
          chance: 0,
          tradeskillIds: [tailoring],
        }),
      ],
    });
    seedGatheringAt(4);
    vi.mocked(partyGatherYieldBonuses).mockReturnValue([
      { tradeskillId: tailoring, value: 100 },
    ]);

    inTick(gatheringProcessTick);

    expect(material(woodId)).toBe(2);
  });

  it('skips zero-quantity item lines entirely', () => {
    seedGathering({
      gatherResults: [
        result([
          { itemId: woodId, quantity: 0 },
          { itemId: stickId, quantity: 1 },
        ]),
      ],
    });
    seedGatheringAt(4);

    inTick(gatheringProcessTick);

    expect(material(woodId)).toBeUndefined();
    expect(combatLog()[0].itemIcons).toEqual([
      { sprite: 'stick-sprite', spritesheet: 'item' },
    ]);
  });

  it('grants no items when nothing rolls', () => {
    seedGathering({ gatherResults: [] });
    seedGatheringAt(4);

    inTick(gatheringProcessTick);

    expect(gamestate().materials).toEqual({});
    expect(worldGatheringState().ticksIntoGather).toBe(0);
  });

  it('grants +1 of the first item line on a successful drop-rate boost roll', () => {
    seedGathering({
      gatherResults: [
        result([
          { itemId: woodId, quantity: 2 },
          { itemId: stickId, quantity: 1 },
        ]),
      ],
    });
    seedGatheringAt(4, (state) => {
      state.globalEffectSums.gatheringItemDropRateBoost = 20;
    });
    vi.mocked(rngSucceedsChance).mockReturnValue(true);

    inTick(gatheringProcessTick);

    expect(gatheringItemDropRateBoost()).toBe(20);
    expect(rngSucceedsChance).toHaveBeenCalledWith(20);
    expect(material(woodId)).toBe(3);
    expect(material(stickId)).toBe(1);
  });
});
