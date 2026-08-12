import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/combat-log', () => ({
  gatherMessageLog: vi.fn(),
  itemDropHtml: vi.fn(
    (item: { name: string }, quantity: number) =>
      `${quantity} <colored>${item.name}</colored>`,
  ),
}));

vi.mock('@helpers/luck', () => ({
  luckRollSucceeds: vi.fn(),
  partyMaxLuck: vi.fn(),
}));

vi.mock('@helpers/materials', () => ({
  addMaterial: vi.fn(),
}));

vi.mock('@helpers/party', () => ({
  partyGainXp: vi.fn(),
  partyGet: vi.fn(),
}));

vi.mock('@helpers/rng', () => ({
  rngChoiceWeighted: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/world-nodes', () => ({
  worldNodeByName: vi.fn(),
  worldNodeGathering: vi.fn(),
}));

import { gatherMessageLog } from '@helpers/combat-log';
import { getEntry } from '@helpers/content';
import {
  canEnterGatherNode,
  currentGatheringContent,
  gatheringProcessTick,
  gatheringProgressFraction,
  gatheringRollResult,
  gatheringStart,
  gatheringStop,
  isGathering,
  partyMaxLevel,
  partyMinLevel,
} from '@helpers/gathering';
import { luckRollSucceeds, partyMaxLuck } from '@helpers/luck';
import { addMaterial } from '@helpers/materials';
import { partyGainXp, partyGet } from '@helpers/party';
import { rngChoiceWeighted } from '@helpers/rng';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { worldNodeByName, worldNodeGathering } from '@helpers/world-nodes';
import type {
  Character,
  GameState,
  GatheringContent,
  GatheringId,
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

  it('delegates to rngChoiceWeighted using each result chance as its weight', () => {
    const results = [
      { chance: 40, items: [] },
      { chance: 10, items: [] },
    ];
    vi.mocked(rngChoiceWeighted).mockReturnValue(results[1]);

    const gathering = buildGathering({ gatherResults: results });
    expect(gatheringRollResult(gathering)).toBe(results[1]);

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
    expect(gatherMessageLog).toHaveBeenCalledWith(
      'Wergen Woods',
      'The party begins gathering at Wergen Woods.',
    );
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
        { chance: 100, items: [{ itemId: 'wood', quantity: 2 }] },
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

    gatheringProcessTick();

    expect(partyGainXp).toHaveBeenCalledWith(3);
    expect(addMaterial).toHaveBeenCalledWith('wood', 2);
    expect(gatherMessageLog).toHaveBeenCalledWith(
      'Wergen Woods',
      expect.stringContaining('2'),
    );

    const result = applyLastUpdate({
      world: { gathering: { ticksIntoGather: 4 } },
    } as unknown as GameState);
    expect(result.world.gathering.ticksIntoGather).toBe(0);
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
        { chance: 100, items: [{ itemId: 'wood', quantity: 2 }] },
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
});
