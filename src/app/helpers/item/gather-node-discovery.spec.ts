import type * as AnalyticsHelper from '@helpers/engine/analytics';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/engine/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof AnalyticsHelper>();
  return {
    ...actual,
    analyticsSendDesignEvent: vi.fn(),
  };
});

import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import {
  gatherNodeDiscover,
  grandfatherGatherNodeDiscoveries,
  isGatherNodeDiscovered,
  pruneInvalidGatherNodeDiscoveries,
} from '@helpers/item/gather-node-discovery';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type { GameState, GameStateDiscoveredGatherNodes } from '@interfaces';

function applyLastUpdate(state: GameState): GameState {
  const calls = vi.mocked(updateGamestate).mock.calls;
  const updateFn = calls[calls.length - 1][0];
  return updateFn(state);
}

describe('isGatherNodeDiscovered', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is true once the node has a foundAt timestamp', () => {
    vi.mocked(gamestate).mockReturnValue({
      discoveredGatherNodes: { 'Wergen Woods': { foundAt: 1000 } },
    } as unknown as GameState);

    expect(isGatherNodeDiscovered('Wergen Woods')).toBe(true);
  });

  it('is false for a node never visited', () => {
    vi.mocked(gamestate).mockReturnValue({
      discoveredGatherNodes: {},
    } as unknown as GameState);

    expect(isGatherNodeDiscovered('Wergen Woods')).toBe(false);
  });
});

describe('gatherNodeDiscover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records a foundAt timestamp for a newly-visited node', () => {
    vi.mocked(gamestate).mockReturnValue({
      discoveredGatherNodes: {},
    } as unknown as GameState);

    gatherNodeDiscover('Wergen Woods');

    const result = applyLastUpdate({
      discoveredGatherNodes: {},
    } as unknown as GameState);

    expect(result.discoveredGatherNodes['Wergen Woods'].foundAt).toEqual(
      expect.any(Number),
    );
  });

  it('preserves the original foundAt on repeat visits', () => {
    vi.mocked(gamestate).mockReturnValue({
      discoveredGatherNodes: { 'Wergen Woods': { foundAt: 1000 } },
    } as unknown as GameState);

    gatherNodeDiscover('Wergen Woods');

    const result = applyLastUpdate({
      discoveredGatherNodes: { 'Wergen Woods': { foundAt: 1000 } },
    } as unknown as GameState);

    expect(result.discoveredGatherNodes['Wergen Woods'].foundAt).toBe(1000);
  });

  it('sends an analytics event with the node name only the first time it is visited', () => {
    vi.mocked(gamestate).mockReturnValue({
      discoveredGatherNodes: {},
    } as unknown as GameState);

    gatherNodeDiscover('Wergen Woods');

    expect(analyticsSendDesignEvent).toHaveBeenCalledWith(
      'World:GatherNode:Discover:Wergen Woods',
    );
  });

  it('does not send an analytics event again on repeat visits', () => {
    vi.mocked(gamestate).mockReturnValue({
      discoveredGatherNodes: { 'Wergen Woods': { foundAt: 1000 } },
    } as unknown as GameState);

    gatherNodeDiscover('Wergen Woods');

    expect(analyticsSendDesignEvent).not.toHaveBeenCalled();
  });
});

describe('pruneInvalidGatherNodeDiscoveries', () => {
  it('keeps only entries the existence check accepts', () => {
    const discovered: GameStateDiscoveredGatherNodes = {
      'Wergen Woods': { foundAt: 1000 },
      'Removed Node': { foundAt: 2000 },
    };

    const result = pruneInvalidGatherNodeDiscoveries(
      discovered,
      (nodeName) => nodeName === 'Wergen Woods',
    );

    expect(result).toEqual({ 'Wergen Woods': { foundAt: 1000 } });
  });
});

describe('grandfatherGatherNodeDiscoveries', () => {
  it('marks every given node name as discovered', () => {
    const result = grandfatherGatherNodeDiscoveries([
      'Wergen Woods',
      'Rocky Outcrop',
    ]);

    expect(Object.keys(result)).toEqual(['Wergen Woods', 'Rocky Outcrop']);
    expect(result['Wergen Woods'].foundAt).toEqual(expect.any(Number));
    expect(result['Rocky Outcrop'].foundAt).toEqual(expect.any(Number));
  });

  it('returns an empty record for no nodes', () => {
    expect(grandfatherGatherNodeDiscoveries([])).toEqual({});
  });
});
