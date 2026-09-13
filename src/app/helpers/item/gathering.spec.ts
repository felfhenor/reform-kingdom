import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/hero/character-progress', () => ({
  partyGainXp: vi.fn(),
}));

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/combat/combat-log', () => ({
  categoryMessageLog: vi.fn(),
  ITEM_ICON_TOKEN: '@@icon@@',
  itemDropHtml: vi.fn(
    (item: { name: string }, quantity: number) =>
      `${quantity} <colored>${item.name}</colored>`,
  ),
}));

vi.mock('@helpers/engine/gather-vfx', () => ({
  gatherVfxEmit: vi.fn(),
}));

vi.mock('@helpers/hero/luck', () => ({
  luckRollSucceeds: vi.fn(),
  partyMaxLuck: vi.fn(),
}));

vi.mock('@helpers/hero/global-effects', () => ({
  activeGlobalEffects: vi.fn(() => []),
}));

vi.mock('@helpers/item/materials', () => ({
  addMaterial: vi.fn(),
}));

vi.mock('@helpers/hero/party', () => ({
  partyGet: vi.fn(),
  partyGatherYieldBonuses: vi.fn(() => []),
}));

vi.mock('@helpers/rng', () => ({
  rngChoiceWeighted: vi.fn(),
  rngSucceedsChance: vi.fn(() => false),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeByName: vi.fn(),
  worldNodeGathering: vi.fn(),
}));

vi.mock('@helpers/world-node/world-node-gathering', () => ({
  gatheringResultsAtLevel: vi.fn((gathering) => gathering.gatherResults),
}));

vi.mock('@helpers/world-node/world-node-level', () => ({
  worldNodeLevel: vi.fn(() => 0),
}));

import { categoryMessageLog } from '@helpers/combat/combat-log';
import { getEntry } from '@helpers/content/content';
import { ensureGatherResult } from '@helpers/content/ensure-gathernode';
import { gatherVfxEmit } from '@helpers/engine/gather-vfx';
import { partyGainXp } from '@helpers/hero/character-progress';
import { activeGlobalEffects } from '@helpers/hero/global-effects';
import { luckRollSucceeds, partyMaxLuck } from '@helpers/hero/luck';
import { partyGatherYieldBonuses, partyGet } from '@helpers/hero/party';
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
import { addMaterial } from '@helpers/item/materials';
import { rngChoiceWeighted, rngSucceedsChance } from '@helpers/rng';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { gatheringResultsAtLevel } from '@helpers/world-node/world-node-gathering';
import { worldNodeLevel } from '@helpers/world-node/world-node-level';
import {
  worldNodeByName,
  worldNodeGathering,
} from '@helpers/world-node/world-nodes';
import type {
  Character,
  GameState,
  GatheringContent,
  GatheringId,
  GlobalEffect,
  ItemId,
  TradeskillId,
  WorldNodeEntry,
} from '@interfaces';

function buildGathering(
  overrides: Partial<GatheringContent> = {},
): GatheringContent {
  return {
    id: 'gather-1' as GatheringId,
    name: 'Wergen Woods',
    __type: 'gathering',
    description: 'A dry forest.',
    levelRange: { min: 1, max: 5 },
    xpGainedIfInLevelRange: 3,
    gatherTime: 5,
    gatherResults: [],
    ...overrides,
  } as GatheringContent;
}

function buildCharacter(level: number, luck = 0): Character {
  return {
    id: `char-${level}`,
    level,
    stats: { Luck: luck },
  } as unknown as Character;
}

function applyLastUpdate(state: GameState): GameState {
  const calls = vi.mocked(updateGamestate).mock.calls;
  const updateFn = calls[calls.length - 1][0];
  return updateFn(state);
}

describe('partyMinLevel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the lowest level among party members', () => {
    vi.mocked(partyGet).mockReturnValue([
      buildCharacter(5),
      buildCharacter(2),
      buildCharacter(9),
    ]);

    expect(partyMinLevel()).toBe(2);
  });

  it('defaults to 1 when the party is empty', () => {
    vi.mocked(partyGet).mockReturnValue([]);

    expect(partyMinLevel()).toBe(1);
  });
});

describe('partyMaxLevel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the highest level among party members', () => {
    vi.mocked(partyGet).mockReturnValue([
      buildCharacter(5),
      buildCharacter(2),
      buildCharacter(9),
    ]);

    expect(partyMaxLevel()).toBe(9);
  });

  it('defaults to 1 when the party is empty', () => {
    vi.mocked(partyGet).mockReturnValue([]);

    expect(partyMaxLevel()).toBe(1);
  });
});

describe('canEnterGatherNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows entry when there is no matching node', () => {
    vi.mocked(worldNodeByName).mockReturnValue(undefined);

    expect(canEnterGatherNode('Nowhere')).toBe(true);
  });

  it('allows entry when the node is not a gather node', () => {
    vi.mocked(worldNodeByName).mockReturnValue({} as WorldNodeEntry);
    vi.mocked(worldNodeGathering).mockReturnValue(undefined);

    expect(canEnterGatherNode('Field Ruins')).toBe(true);
  });

  it('allows entry when the party meets the minimum level', () => {
    vi.mocked(worldNodeByName).mockReturnValue({} as WorldNodeEntry);
    vi.mocked(worldNodeGathering).mockReturnValue(
      buildGathering({ levelRange: { min: 3, max: 5 } }),
    );
    vi.mocked(partyGet).mockReturnValue([buildCharacter(3)]);

    expect(canEnterGatherNode('Wergen Woods')).toBe(true);
  });

  it('blocks entry when the party is below the minimum level', () => {
    vi.mocked(worldNodeByName).mockReturnValue({} as WorldNodeEntry);
    vi.mocked(worldNodeGathering).mockReturnValue(
      buildGathering({ levelRange: { min: 3, max: 5 } }),
    );
    vi.mocked(partyGet).mockReturnValue([buildCharacter(2)]);

    expect(canEnterGatherNode('Wergen Woods')).toBe(false);
  });

  it('allows entry when the party is above the maximum level', () => {
    vi.mocked(worldNodeByName).mockReturnValue({} as WorldNodeEntry);
    vi.mocked(worldNodeGathering).mockReturnValue(
      buildGathering({ levelRange: { min: 3, max: 5 } }),
    );
    vi.mocked(partyGet).mockReturnValue([buildCharacter(99)]);

    expect(canEnterGatherNode('Wergen Woods')).toBe(true);
  });
});

describe('isGathering / currentGatheringContent / gatheringProgressFraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('isGathering reflects the world gathering status', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { gathering: { status: 'Gathering', ticksIntoGather: 0 } },
    } as unknown as GameState);

    expect(isGathering()).toBe(true);
  });

  it('gatheringProgressFraction is 0 when idle', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { gathering: { status: 'Idle', ticksIntoGather: 0 } },
    } as unknown as GameState);

    expect(gatheringProgressFraction()).toBe(0);
  });

  it('gatheringProgressFraction reports ticks elapsed over gatherTime, clamped to 1', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: {
        gathering: {
          status: 'Gathering',
          gatheringId: 'gather-1',
          ticksIntoGather: 8,
        },
      },
    } as unknown as GameState);
    vi.mocked(getEntry).mockReturnValue(
      buildGathering({ gatherTime: 5 }) as never,
    );

    expect(gatheringProgressFraction()).toBe(1);
  });

  it('currentGatheringContent returns undefined without an active gatheringId', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { gathering: { status: 'Idle', ticksIntoGather: 0 } },
    } as unknown as GameState);

    expect(currentGatheringContent()).toBeUndefined();
  });
});

describe('gatheringRollResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to rngChoiceWeighted over the results available at the given level', () => {
    const results = [
      ensureGatherResult({ chance: 40, items: [] }),
      ensureGatherResult({ chance: 10, items: [] }),
    ];
    vi.mocked(rngChoiceWeighted).mockReturnValue(results[1]);

    const gathering = buildGathering({ gatherResults: results });
    expect(gatheringRollResult(gathering, 2)).toBe(results[1]);

    expect(gatheringResultsAtLevel).toHaveBeenCalledWith(gathering, 2);

    const [items, weightFn] = vi.mocked(rngChoiceWeighted).mock.calls[0];
    expect(items).toBe(results);
    expect(weightFn(results[0])).toBe(40);
  });
});

describe('gatheringStart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails when there is no matching node', () => {
    vi.mocked(worldNodeByName).mockReturnValue(undefined);

    expect(gatheringStart('Nowhere')).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('fails when the node is not a gather node', () => {
    vi.mocked(worldNodeByName).mockReturnValue({} as WorldNodeEntry);
    vi.mocked(worldNodeGathering).mockReturnValue(undefined);

    expect(gatheringStart('Field Ruins')).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('fails when the party is below the level requirement', () => {
    vi.mocked(worldNodeByName).mockReturnValue({} as WorldNodeEntry);
    vi.mocked(worldNodeGathering).mockReturnValue(
      buildGathering({ levelRange: { min: 5, max: 10 } }),
    );
    vi.mocked(partyGet).mockReturnValue([buildCharacter(1)]);

    expect(gatheringStart('Wergen Woods')).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('starts gathering and logs the start', () => {
    vi.mocked(worldNodeByName).mockReturnValue({} as WorldNodeEntry);
    vi.mocked(worldNodeGathering).mockReturnValue(
      buildGathering({
        id: 'gather-1' as GatheringId,
        levelRange: { min: 1, max: 5 },
      }),
    );
    vi.mocked(partyGet).mockReturnValue([buildCharacter(1)]);

    expect(gatheringStart('Wergen Woods')).toBe(true);

    const result = applyLastUpdate({ world: {} } as unknown as GameState);
    expect(result.world.gathering).toEqual({
      status: 'Gathering',
      nodeName: 'Wergen Woods',
      gatheringId: 'gather-1',
      ticksIntoGather: 0,
    });
  });
});

describe('gatheringStop', () => {
  it('resets gathering state to idle', () => {
    gatheringStop();

    const result = applyLastUpdate({ world: {} } as unknown as GameState);
    expect(result.world.gathering).toEqual({
      status: 'Idle',
      ticksIntoGather: 0,
    });
  });
});

describe('gatheringProcessTick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // `vi.clearAllMocks()` doesn't undo a `mockReturnValue` set by an earlier test, so reset these explicitly.
    vi.mocked(partyGatherYieldBonuses).mockReturnValue([]);
    vi.mocked(rngSucceedsChance).mockReturnValue(false);
  });

  it('does nothing when not gathering', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { gathering: { status: 'Idle', ticksIntoGather: 0 } },
    } as unknown as GameState);

    gatheringProcessTick();

    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('accumulates ticks without resolving until gatherTime is reached', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: {
        gathering: {
          status: 'Gathering',
          nodeName: 'Wergen Woods',
          gatheringId: 'gather-1',
          ticksIntoGather: 2,
        },
      },
    } as unknown as GameState);
    vi.mocked(getEntry).mockReturnValue(
      buildGathering({ gatherTime: 5 }) as never,
    );

    gatheringProcessTick();

    const result = applyLastUpdate({
      world: { gathering: { ticksIntoGather: 2 } },
    } as unknown as GameState);
    expect(result.world.gathering.ticksIntoGather).toBe(3);
    expect(partyGainXp).not.toHaveBeenCalled();
  });

  it('resolves a cycle once gatherTime is reached: grants in-range xp, rolls a result, and resets the counter', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: {
        gathering: {
          status: 'Gathering',
          nodeName: 'Wergen Woods',
          gatheringId: 'gather-1',
          ticksIntoGather: 4,
        },
      },
    } as unknown as GameState);

    const gathering = buildGathering({
      gatherTime: 5,
      levelRange: { min: 1, max: 5 },
      xpGainedIfInLevelRange: 3,
      gatherResults: [
        ensureGatherResult({
          chance: 100,
          items: [{ itemId: 'wood' as ItemId, quantity: 2 }],
        }),
      ],
    });
    vi.mocked(getEntry).mockImplementation((id: string) => {
      if (id === 'gather-1') return gathering as never;
      if (id === 'wood')
        return {
          name: 'Wergen Wood',
          sprite: 'wergen-wood',
          rarity: 'Common',
        } as never;
      return undefined;
    });
    vi.mocked(partyGet).mockReturnValue([buildCharacter(3)]);
    vi.mocked(rngChoiceWeighted).mockReturnValue(gathering.gatherResults[0]);
    vi.mocked(luckRollSucceeds).mockReturnValue(false);

    gatheringProcessTick();

    expect(worldNodeLevel).toHaveBeenCalledWith('Wergen Woods');
    expect(partyGainXp).toHaveBeenCalledWith(3);
    expect(addMaterial).toHaveBeenCalledWith('wood', 2);
    expect(gatherVfxEmit).toHaveBeenCalledWith({
      nodeName: 'Wergen Woods',
      name: 'Wergen Wood',
      sprite: 'wergen-wood',
      spritesheet: 'item',
      quantity: 2,
    });
    expect(categoryMessageLog).toHaveBeenCalledWith(
      'Gather',
      'Wergen Woods',
      expect.any(String),
      { sprite: 'wergen-wood', spritesheet: 'item' },
    );

    const result = applyLastUpdate({
      world: { gathering: { ticksIntoGather: 4 } },
    } as unknown as GameState);
    expect(result.world.gathering.ticksIntoGather).toBe(0);
  });

  it('uses the first granted item line as the log icon when a result grants multiple item types', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: {
        gathering: {
          status: 'Gathering',
          nodeName: 'Wergen Woods',
          gatheringId: 'gather-1',
          ticksIntoGather: 4,
        },
      },
    } as unknown as GameState);

    const gathering = buildGathering({
      gatherTime: 5,
      levelRange: { min: 1, max: 5 },
      xpGainedIfInLevelRange: 3,
      gatherResults: [
        ensureGatherResult({
          chance: 100,
          items: [
            { itemId: 'wood' as ItemId, quantity: 2 },
            { itemId: 'stick' as ItemId, quantity: 1 },
          ],
        }),
      ],
    });
    vi.mocked(getEntry).mockImplementation((id: string) => {
      if (id === 'gather-1') return gathering as never;
      if (id === 'wood')
        return { name: 'Wergen Wood', sprite: 'wergen-wood' } as never;
      if (id === 'stick')
        return { name: 'Wergen Stick', sprite: 'wergen-stick' } as never;
      return undefined;
    });
    vi.mocked(partyGet).mockReturnValue([buildCharacter(3)]);
    vi.mocked(rngChoiceWeighted).mockReturnValue(gathering.gatherResults[0]);
    vi.mocked(luckRollSucceeds).mockReturnValue(false);

    gatheringProcessTick();

    expect(categoryMessageLog).toHaveBeenCalledWith(
      'Gather',
      'Wergen Woods',
      expect.any(String),
      { sprite: 'wergen-wood', spritesheet: 'item' },
    );
  });

  it('doubles item quantities on a successful luck roll', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: {
        gathering: {
          status: 'Gathering',
          nodeName: 'Wergen Woods',
          gatheringId: 'gather-1',
          ticksIntoGather: 4,
        },
      },
    } as unknown as GameState);

    const gathering = buildGathering({
      gatherTime: 5,
      levelRange: { min: 1, max: 5 },
      xpGainedIfInLevelRange: 3,
      gatherResults: [
        ensureGatherResult({
          chance: 100,
          items: [{ itemId: 'wood' as ItemId, quantity: 2 }],
        }),
      ],
    });
    vi.mocked(getEntry).mockImplementation((id: string) => {
      if (id === 'gather-1') return gathering as never;
      if (id === 'wood')
        return { name: 'Wergen Wood', rarity: 'Common' } as never;
      return undefined;
    });
    vi.mocked(partyGet).mockReturnValue([buildCharacter(3)]);
    vi.mocked(rngChoiceWeighted).mockReturnValue(gathering.gatherResults[0]);
    vi.mocked(partyMaxLuck).mockReturnValue(50);
    vi.mocked(luckRollSucceeds).mockReturnValue(true);

    gatheringProcessTick();

    expect(luckRollSucceeds).toHaveBeenCalledWith(50);
    expect(addMaterial).toHaveBeenCalledWith('wood', 4);
    expect(gatherVfxEmit).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 4 }),
    );
  });

  it("adds a party-wide GatherYield bonus matching the node's tradeskill", () => {
    vi.mocked(gamestate).mockReturnValue({
      world: {
        gathering: {
          status: 'Gathering',
          nodeName: 'Wergen Woods',
          gatheringId: 'gather-1',
          ticksIntoGather: 4,
        },
      },
    } as unknown as GameState);

    const gathering = buildGathering({
      gatherTime: 5,
      levelRange: { min: 1, max: 5 },
      xpGainedIfInLevelRange: 3,
      gatherResults: [
        {
          chance: 100,
          tradeskillIds: ['Woodworking' as TradeskillId],
          items: [{ itemId: 'wood' as ItemId, quantity: 2 }],
        },
      ],
    });
    vi.mocked(getEntry).mockImplementation((id: string) => {
      if (id === 'gather-1') return gathering as never;
      if (id === 'wood')
        return { name: 'Wergen Wood', rarity: 'Common' } as never;
      return undefined;
    });
    vi.mocked(partyGet).mockReturnValue([buildCharacter(3)]);
    vi.mocked(rngChoiceWeighted).mockReturnValue(gathering.gatherResults[0]);
    vi.mocked(luckRollSucceeds).mockReturnValue(false);
    // partyGatherYieldBonuses already combines base equipment + infusion + affix - gathering itself no longer distinguishes the source.
    vi.mocked(partyGatherYieldBonuses).mockReturnValue([
      { tradeskillId: 'Woodworking' as TradeskillId, value: 3 },
      // A different tradeskill's bonus must not apply to this result.
      { tradeskillId: 'Blacksmithing' as TradeskillId, value: 100 },
    ]);

    gatheringProcessTick();

    expect(addMaterial).toHaveBeenCalledWith('wood', 5);
  });

  it("matches a GatherYield bonus against any of a single result's multiple tradeskills", () => {
    vi.mocked(gamestate).mockReturnValue({
      world: {
        gathering: {
          status: 'Gathering',
          nodeName: 'Wergen Woods',
          gatheringId: 'gather-1',
          ticksIntoGather: 4,
        },
      },
    } as unknown as GameState);

    const gathering = buildGathering({
      gatherTime: 5,
      levelRange: { min: 1, max: 5 },
      xpGainedIfInLevelRange: 3,
      gatherResults: [
        {
          chance: 100,
          tradeskillIds: [
            'Woodworking' as TradeskillId,
            'Tailoring' as TradeskillId,
          ],
          items: [{ itemId: 'hide' as ItemId, quantity: 1 }],
        },
      ],
    });
    vi.mocked(getEntry).mockImplementation((id: string) => {
      if (id === 'gather-1') return gathering as never;
      return { name: id, rarity: 'Common' } as never;
    });
    vi.mocked(partyGet).mockReturnValue([buildCharacter(3)]);
    vi.mocked(rngChoiceWeighted).mockReturnValue(gathering.gatherResults[0]);
    vi.mocked(luckRollSucceeds).mockReturnValue(false);
    // The result lists Woodworking first, but the bonus targets Tailoring - its second tag - and must still match.
    vi.mocked(partyGatherYieldBonuses).mockReturnValue([
      { tradeskillId: 'Tailoring' as TradeskillId, value: 4 },
    ]);

    gatheringProcessTick();

    expect(addMaterial).toHaveBeenCalledWith('hide', 5);
  });

  it("does not apply a GatherYield bonus to a rolled result whose own tags don't match, even when a different possible result at the same node would", () => {
    vi.mocked(gamestate).mockReturnValue({
      world: {
        gathering: {
          status: 'Gathering',
          nodeName: 'Wergen Woods',
          gatheringId: 'gather-1',
          ticksIntoGather: 4,
        },
      },
    } as unknown as GameState);

    const woodResult = {
      chance: 50,
      tradeskillIds: ['Woodworking' as TradeskillId],
      items: [{ itemId: 'wood' as ItemId, quantity: 2 }],
    };
    const hideResult = {
      chance: 50,
      tradeskillIds: ['Tailoring' as TradeskillId],
      items: [{ itemId: 'hide' as ItemId, quantity: 1 }],
    };
    const gathering = buildGathering({
      gatherTime: 5,
      levelRange: { min: 1, max: 5 },
      xpGainedIfInLevelRange: 3,
      gatherResults: [woodResult, hideResult],
    });
    vi.mocked(getEntry).mockImplementation((id: string) => {
      if (id === 'gather-1') return gathering as never;
      return { name: id, rarity: 'Common' } as never;
    });
    vi.mocked(partyGet).mockReturnValue([buildCharacter(3)]);
    // The Woodworking result is the one that actually rolls this cycle.
    vi.mocked(rngChoiceWeighted).mockReturnValue(woodResult);
    vi.mocked(luckRollSucceeds).mockReturnValue(false);
    vi.mocked(partyGatherYieldBonuses).mockReturnValue([
      { tradeskillId: 'Tailoring' as TradeskillId, value: 100 },
    ]);

    gatheringProcessTick();

    expect(addMaterial).toHaveBeenCalledWith('wood', 2);
  });

  it('applies the GatherYield bonus once per cycle, not once per item line in the result', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: {
        gathering: {
          status: 'Gathering',
          nodeName: 'Wergen Woods',
          gatheringId: 'gather-1',
          ticksIntoGather: 4,
        },
      },
    } as unknown as GameState);

    const gathering = buildGathering({
      gatherTime: 5,
      levelRange: { min: 1, max: 5 },
      xpGainedIfInLevelRange: 3,
      gatherResults: [
        {
          chance: 100,
          tradeskillIds: ['Woodworking' as TradeskillId],
          items: [
            { itemId: 'wood' as ItemId, quantity: 2 },
            { itemId: 'stick' as ItemId, quantity: 1 },
          ],
        },
      ],
    });
    vi.mocked(getEntry).mockImplementation((id: string) => {
      if (id === 'gather-1') return gathering as never;
      return { name: id, rarity: 'Common' } as never;
    });
    vi.mocked(partyGet).mockReturnValue([buildCharacter(3)]);
    vi.mocked(rngChoiceWeighted).mockReturnValue(gathering.gatherResults[0]);
    vi.mocked(luckRollSucceeds).mockReturnValue(false);
    vi.mocked(partyGatherYieldBonuses).mockReturnValue([
      { tradeskillId: 'Woodworking' as TradeskillId, value: 3 },
    ]);

    gatheringProcessTick();

    expect(addMaterial).toHaveBeenCalledWith('wood', 5);
    expect(addMaterial).toHaveBeenCalledWith('stick', 1);
  });

  it('does not grant xp when the party has outleveled the node', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: {
        gathering: {
          status: 'Gathering',
          nodeName: 'Wergen Woods',
          gatheringId: 'gather-1',
          ticksIntoGather: 4,
        },
      },
    } as unknown as GameState);

    const gathering = buildGathering({
      gatherTime: 5,
      levelRange: { min: 1, max: 5 },
      xpGainedIfInLevelRange: 3,
      gatherResults: [],
    });
    vi.mocked(getEntry).mockReturnValue(gathering as never);
    vi.mocked(partyGet).mockReturnValue([buildCharacter(99)]);
    vi.mocked(rngChoiceWeighted).mockReturnValue(undefined);

    gatheringProcessTick();

    expect(partyGainXp).not.toHaveBeenCalled();
    expect(addMaterial).not.toHaveBeenCalled();
  });

  it('grants +1 of the first item line on a successful GlobalGatheringItemDropRateBoost roll', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: {
        gathering: {
          status: 'Gathering',
          nodeName: 'Wergen Woods',
          gatheringId: 'gather-1',
          ticksIntoGather: 4,
        },
      },
    } as unknown as GameState);

    const gathering = buildGathering({
      gatherTime: 5,
      levelRange: { min: 1, max: 5 },
      xpGainedIfInLevelRange: 3,
      gatherResults: [
        ensureGatherResult({
          chance: 100,
          items: [
            { itemId: 'wood' as ItemId, quantity: 2 },
            { itemId: 'stick' as ItemId, quantity: 1 },
          ],
        }),
      ],
    });
    vi.mocked(getEntry).mockImplementation((id: string) => {
      if (id === 'gather-1') return gathering as never;
      return { name: id, rarity: 'Common' } as never;
    });
    vi.mocked(partyGet).mockReturnValue([buildCharacter(3)]);
    vi.mocked(rngChoiceWeighted).mockReturnValue(gathering.gatherResults[0]);
    vi.mocked(luckRollSucceeds).mockReturnValue(false);
    vi.mocked(activeGlobalEffects).mockReturnValue([
      {
        effects: [
          { effectType: 'GlobalGatheringItemDropRateBoost', value: 20 },
        ],
      } as GlobalEffect,
    ]);
    vi.mocked(rngSucceedsChance).mockReturnValue(true);

    gatheringProcessTick();

    expect(rngSucceedsChance).toHaveBeenCalledWith(20);
    expect(addMaterial).toHaveBeenCalledWith('wood', 3);
    expect(addMaterial).toHaveBeenCalledWith('stick', 1);
  });
});

describe('gatheringItemDropRateBoost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 with no active effects', () => {
    vi.mocked(activeGlobalEffects).mockReturnValue([]);
    expect(gatheringItemDropRateBoost()).toBe(0);
  });

  it('sums active GlobalGatheringItemDropRateBoost effect values', () => {
    vi.mocked(activeGlobalEffects).mockReturnValue([
      {
        effects: [
          { effectType: 'GlobalGatheringItemDropRateBoost', value: 10 },
        ],
      } as GlobalEffect,
      {
        effects: [
          { effectType: 'GlobalGatheringItemDropRateBoost', value: 20 },
        ],
      } as GlobalEffect,
    ]);

    expect(gatheringItemDropRateBoost()).toBe(30);
  });

  it('ignores active effects of other types', () => {
    vi.mocked(activeGlobalEffects).mockReturnValue([
      {
        effects: [{ effectType: 'GainStats', stat: 'Strength', value: 5 }],
      } as GlobalEffect,
    ]);

    expect(gatheringItemDropRateBoost()).toBe(0);
  });
});
