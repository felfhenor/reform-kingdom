import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/hero/travel', () => ({
  canPartyTravel: vi.fn(() => true),
}));

vi.mock('@helpers/world', () => ({
  isPartyAtNode: vi.fn(),
}));

vi.mock('@helpers/world-node/world-node-outpost', () => ({
  isOutpostBuilt: vi.fn(),
  isOutpostTeleportUnlocked: vi.fn(),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  isWorldNodeVisible: vi.fn(() => true),
}));

import { canPartyTravel } from '@helpers/hero/travel';
import { isPartyAtNode } from '@helpers/world';
import {
  isOutpostBuilt,
  isOutpostTeleportUnlocked,
} from '@helpers/world-node/world-node-outpost';
import {
  isOutpostTeleportListed,
  outpostCanTeleport,
} from '@helpers/world-node/world-node-outpost-teleport';
import { isWorldNodeVisible } from '@helpers/world-node/world-nodes';
import type { WorldNodeEntry } from '@interfaces';

function outpostEntry(nodeName: string): WorldNodeEntry {
  return { nodeName, mapName: nodeName, x: 0, y: 0 } as WorldNodeEntry;
}

const carrina = outpostEntry('Carrina Outpost');
const larsian = outpostEntry('Larsian Outpost');

function mockLevels(levels: Record<string, number>): void {
  vi.mocked(isOutpostBuilt).mockImplementation(
    (nodeName) => (levels[nodeName] ?? 0) >= 1,
  );
  vi.mocked(isOutpostTeleportUnlocked).mockImplementation(
    (nodeName) => (levels[nodeName] ?? 0) >= 5,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(canPartyTravel).mockReturnValue(true);
  vi.mocked(isWorldNodeVisible).mockReturnValue(true);
  vi.mocked(isPartyAtNode).mockImplementation(
    (nodeName) => nodeName === carrina.nodeName,
  );
  mockLevels({ 'Carrina Outpost': 5, 'Larsian Outpost': 5 });
});

describe('isOutpostTeleportListed', () => {
  it('lists a visible, built outpost', () => {
    mockLevels({ 'Larsian Outpost': 1 });

    expect(isOutpostTeleportListed(larsian)).toBe(true);
  });

  it('hides an unbuilt outpost', () => {
    mockLevels({});

    expect(isOutpostTeleportListed(larsian)).toBe(false);
  });

  it('hides an outpost that is not visible', () => {
    vi.mocked(isWorldNodeVisible).mockReturnValue(false);

    expect(isOutpostTeleportListed(larsian)).toBe(false);
  });
});

describe('outpostCanTeleport', () => {
  it('allows teleporting between two +5 outposts while standing at the source', () => {
    expect(outpostCanTeleport(carrina, larsian)).toBe(true);
  });

  it('blocks teleporting to the current outpost', () => {
    expect(outpostCanTeleport(carrina, carrina)).toBe(false);
  });

  it('blocks a destination below +5', () => {
    mockLevels({ 'Carrina Outpost': 5, 'Larsian Outpost': 4 });

    expect(outpostCanTeleport(carrina, larsian)).toBe(false);
  });

  it('blocks a source below +5', () => {
    mockLevels({ 'Carrina Outpost': 4, 'Larsian Outpost': 5 });

    expect(outpostCanTeleport(carrina, larsian)).toBe(false);
  });

  it('blocks when the party is not at the source', () => {
    vi.mocked(isPartyAtNode).mockReturnValue(false);

    expect(outpostCanTeleport(carrina, larsian)).toBe(false);
  });

  it('blocks while the party cannot travel', () => {
    vi.mocked(canPartyTravel).mockReturnValue(false);

    expect(outpostCanTeleport(carrina, larsian)).toBe(false);
  });

  it('blocks a destination that is not visible', () => {
    vi.mocked(isWorldNodeVisible).mockReturnValue(false);

    expect(outpostCanTeleport(carrina, larsian)).toBe(false);
  });
});
