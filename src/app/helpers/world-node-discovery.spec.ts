import type * as AnalyticsHelper from '@helpers/analytics';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/notify', () => ({
  notifySuccess: vi.fn(),
}));

vi.mock('@helpers/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof AnalyticsHelper>();
  return {
    ...actual,
    analyticsSendDesignEvent: vi.fn(),
  };
});

import { analyticsSendDesignEvent } from '@helpers/analytics';
import { notifySuccess } from '@helpers/notify';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  isWorldNodeDiscovered,
  pruneInvalidWorldDiscoveries,
  worldNodeDiscover,
  worldNodeUndiscover,
} from '@helpers/world-node-discovery';
import type { GameState, GameStateWorldDiscoveries } from '@interfaces';

function applyLastUpdate(state: GameState): GameState {
  const calls = vi.mocked(updateGamestate).mock.calls;
  const updateFn = calls[calls.length - 1][0];
  return updateFn(state);
}

describe('isWorldNodeDiscovered', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is true once the node has a foundAt timestamp', () => {
    vi.mocked(gamestate).mockReturnValue({
      worldDiscoveries: { 'Hidden Grove': { foundAt: 1000 } },
    } as unknown as GameState);

    expect(isWorldNodeDiscovered('Hidden Grove')).toBe(true);
  });

  it('is false for a node never discovered', () => {
    vi.mocked(gamestate).mockReturnValue({
      worldDiscoveries: {},
    } as unknown as GameState);

    expect(isWorldNodeDiscovered('Hidden Grove')).toBe(false);
  });
});

describe('worldNodeDiscover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records a foundAt timestamp for a newly-discovered node', () => {
    vi.mocked(gamestate).mockReturnValue({
      worldDiscoveries: {},
    } as unknown as GameState);

    worldNodeDiscover('Hidden Grove');

    const result = applyLastUpdate({
      worldDiscoveries: {},
    } as unknown as GameState);

    expect(result.worldDiscoveries['Hidden Grove'].foundAt).toEqual(
      expect.any(Number),
    );
  });

  it('preserves the original foundAt on repeat discovery', () => {
    vi.mocked(gamestate).mockReturnValue({
      worldDiscoveries: { 'Hidden Grove': { foundAt: 1000 } },
    } as unknown as GameState);

    worldNodeDiscover('Hidden Grove');

    const result = applyLastUpdate({
      worldDiscoveries: { 'Hidden Grove': { foundAt: 1000 } },
    } as unknown as GameState);

    expect(result.worldDiscoveries['Hidden Grove'].foundAt).toBe(1000);
  });

  it('notifies success only the first time a node is discovered', () => {
    vi.mocked(gamestate).mockReturnValue({
      worldDiscoveries: {},
    } as unknown as GameState);

    worldNodeDiscover('Hidden Grove');

    expect(notifySuccess).toHaveBeenCalledTimes(1);
  });

  it('does not notify again on repeat discovery', () => {
    vi.mocked(gamestate).mockReturnValue({
      worldDiscoveries: { 'Hidden Grove': { foundAt: 1000 } },
    } as unknown as GameState);

    worldNodeDiscover('Hidden Grove');

    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it('sends an analytics event with the node name only the first time it is discovered', () => {
    vi.mocked(gamestate).mockReturnValue({
      worldDiscoveries: {},
    } as unknown as GameState);

    worldNodeDiscover('Hidden Grove');

    expect(analyticsSendDesignEvent).toHaveBeenCalledWith(
      'World:Node:Discover:Hidden Grove',
    );
  });

  it('does not send an analytics event again on repeat discovery', () => {
    vi.mocked(gamestate).mockReturnValue({
      worldDiscoveries: { 'Hidden Grove': { foundAt: 1000 } },
    } as unknown as GameState);

    worldNodeDiscover('Hidden Grove');

    expect(analyticsSendDesignEvent).not.toHaveBeenCalled();
  });
});

describe('worldNodeUndiscover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes the discovery entry', () => {
    worldNodeUndiscover('Hidden Grove');

    const result = applyLastUpdate({
      worldDiscoveries: { 'Hidden Grove': { foundAt: 1000 } },
    } as unknown as GameState);

    expect(result.worldDiscoveries['Hidden Grove']).toBeUndefined();
  });
});

describe('pruneInvalidWorldDiscoveries', () => {
  it('keeps only entries the existence check accepts', () => {
    const discovered: GameStateWorldDiscoveries = {
      'Hidden Grove': { foundAt: 1000 },
      'Removed Node': { foundAt: 2000 },
    };

    const result = pruneInvalidWorldDiscoveries(
      discovered,
      (nodeName) => nodeName === 'Hidden Grove',
    );

    expect(result).toEqual({ 'Hidden Grove': { foundAt: 1000 } });
  });
});
