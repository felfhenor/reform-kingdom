import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
}));

vi.mock('@helpers/engine/timer', () => ({
  formatDuration: vi.fn((ticks: number) => `formatted:${ticks}`),
  timerTicksElapsed: vi.fn(),
}));

import {
  encounterRandomIsAvailable,
  encounterRandomState,
  encounterRandomTicksUntilReset,
  encounterRandomTimerLabel,
} from '@helpers/encounter/encounter-random';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { gamestate } from '@helpers/state-game';
import type {
  EncounterRandomContent,
  EncounterRandomId,
  EncounterRandomNodeState,
  GameState,
} from '@interfaces';

function buildContent(resetTime = 3600): EncounterRandomContent {
  return {
    id: 'gobslime-shrine' as EncounterRandomId,
    resetTime,
  } as unknown as EncounterRandomContent;
}

describe('encounterRandomState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads the node state for the given id from game state', () => {
    const nodeState = {
      fights: [],
      generatedAtTick: 0,
      completedThisCycle: false,
    };
    vi.mocked(gamestate).mockReturnValue({
      world: { exploreRandom: { 'gobslime-shrine': nodeState } },
    } as unknown as GameState);

    expect(encounterRandomState('gobslime-shrine' as EncounterRandomId)).toBe(
      nodeState,
    );
  });
});

describe('encounterRandomTicksUntilReset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the full resetTime when there is no state yet', () => {
    expect(encounterRandomTicksUntilReset(buildContent(1800), undefined)).toBe(
      1800,
    );
  });

  it('returns the remaining ticks since generation, clamped to resetTime', () => {
    vi.mocked(timerTicksElapsed).mockReturnValue(100);
    const state = {
      fights: [],
      generatedAtTick: 40,
      completedThisCycle: false,
    } as EncounterRandomNodeState;

    expect(encounterRandomTicksUntilReset(buildContent(100), state)).toBe(40);
  });

  it('clamps to 0 once past the reset time', () => {
    vi.mocked(timerTicksElapsed).mockReturnValue(500);
    const state = {
      fights: [],
      generatedAtTick: 0,
      completedThisCycle: false,
    } as EncounterRandomNodeState;

    expect(encounterRandomTicksUntilReset(buildContent(100), state)).toBe(0);
  });
});

describe('encounterRandomIsAvailable', () => {
  it('is false with no state', () => {
    expect(encounterRandomIsAvailable(buildContent(), undefined)).toBe(false);
  });

  it('is false when there are no generated fights', () => {
    const state = {
      fights: [],
      generatedAtTick: 0,
      completedThisCycle: false,
    } as EncounterRandomNodeState;
    expect(encounterRandomIsAvailable(buildContent(), state)).toBe(false);
  });

  it('is false once completed this cycle', () => {
    const state = {
      fights: [{ level: 1, monsters: [] }],
      generatedAtTick: 0,
      completedThisCycle: true,
    } as EncounterRandomNodeState;
    expect(encounterRandomIsAvailable(buildContent(), state)).toBe(false);
  });

  it('is true with generated fights and not yet completed', () => {
    const state = {
      fights: [{ level: 1, monsters: [] }],
      generatedAtTick: 0,
      completedThisCycle: false,
    } as EncounterRandomNodeState;
    expect(encounterRandomIsAvailable(buildContent(), state)).toBe(true);
  });
});

describe('encounterRandomTimerLabel', () => {
  it('formats the ticks remaining until reset', () => {
    vi.mocked(timerTicksElapsed).mockReturnValue(0);
    expect(encounterRandomTimerLabel(buildContent(1800), undefined)).toBe(
      'formatted:1800',
    );
  });
});
