import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/encounter-random-generate', () => ({
  generateEncounterRandomFights: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/timer', () => ({
  timerTicksElapsed: vi.fn(),
}));

vi.mock('@helpers/world-nodes', () => ({
  worldNodeEncounterRandom: vi.fn(),
  worldNodesOfType: vi.fn(),
}));

import { generateEncounterRandomFights } from '@helpers/encounter-random-generate';
import { encounterRandomProcessTick } from '@helpers/encounter-random-tick';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { timerTicksElapsed } from '@helpers/timer';
import {
  worldNodeEncounterRandom,
  worldNodesOfType,
} from '@helpers/world-nodes';
import type {
  Combat,
  EncounterRandomContent,
  EncounterRandomId,
  GameState,
  WorldNodeEntry,
} from '@interfaces';

const entry = { nodeName: 'Mystical Gobslime Shrine' } as WorldNodeEntry;
const content = {
  id: 'gobslime-shrine' as EncounterRandomId,
  resetTime: 100,
} as unknown as EncounterRandomContent;

function withState(
  exploreRandom: Record<string, unknown>,
  combat?: Partial<Combat>,
): void {
  vi.mocked(gamestate).mockReturnValue({
    world: { exploreRandom, combat },
  } as unknown as GameState);
}

describe('encounterRandomProcessTick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(worldNodesOfType).mockReturnValue([entry]);
    vi.mocked(worldNodeEncounterRandom).mockReturnValue(content);
    vi.mocked(timerTicksElapsed).mockReturnValue(1000);
  });

  it('generates fights on the first tick when no state exists yet', () => {
    withState({});
    vi.mocked(generateEncounterRandomFights).mockReturnValue([]);

    encounterRandomProcessTick();

    expect(updateGamestate).toHaveBeenCalledTimes(1);
    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = updateFn({
      world: { exploreRandom: {} },
    } as unknown as GameState);
    expect(result.world.exploreRandom['gobslime-shrine']).toEqual({
      fights: [],
      generatedAtTick: 1000,
      completedThisCycle: false,
    });
  });

  it('does not regenerate before resetTime has elapsed', () => {
    withState({
      'gobslime-shrine': {
        fights: [{ level: 1, monsters: [] }],
        generatedAtTick: 950,
        completedThisCycle: false,
      },
    });

    encounterRandomProcessTick();

    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('regenerates once resetTime has elapsed', () => {
    withState({
      'gobslime-shrine': {
        fights: [{ level: 1, monsters: [] }],
        generatedAtTick: 800,
        completedThisCycle: true,
      },
    });
    vi.mocked(generateEncounterRandomFights).mockReturnValue([
      { level: 5, monsters: [] },
    ]);

    encounterRandomProcessTick();

    expect(updateGamestate).toHaveBeenCalledTimes(1);
  });

  it('does not regenerate while this node has an active combat', () => {
    withState(
      {
        'gobslime-shrine': {
          fights: [{ level: 1, monsters: [] }],
          generatedAtTick: 800,
          completedThisCycle: false,
        },
      },
      { encounterRandomId: 'gobslime-shrine' as EncounterRandomId },
    );

    encounterRandomProcessTick();

    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('regenerates again once the active combat belongs to a different node', () => {
    withState(
      {
        'gobslime-shrine': {
          fights: [{ level: 1, monsters: [] }],
          generatedAtTick: 800,
          completedThisCycle: false,
        },
      },
      { encounterRandomId: 'some-other-node' as EncounterRandomId },
    );
    vi.mocked(generateEncounterRandomFights).mockReturnValue([]);

    encounterRandomProcessTick();

    expect(updateGamestate).toHaveBeenCalledTimes(1);
  });
});
