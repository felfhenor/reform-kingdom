import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/hero/travel', () => ({
  canPartyTravel: vi.fn(() => true),
}));

vi.mock('@helpers/world', () => ({
  isPartyAtNode: vi.fn(),
}));

vi.mock('@helpers/world-node/world-nodes', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isWorldNodeVisible: vi.fn(() => true),
}));

import { seedGamestate } from '@/testing/gamestate';
import { canPartyTravel } from '@helpers/hero/travel';
import { isPartyAtNode } from '@helpers/world';
import { outpostCanTeleport } from '@helpers/world-node/world-node-outpost-teleport';
import { isWorldNodeVisible } from '@helpers/world-node/world-nodes';
import type { WorldNodeEntry } from '@interfaces';

function outpostEntry(nodeName: string): WorldNodeEntry {
  return { nodeName, mapName: nodeName, x: 0, y: 0 } as WorldNodeEntry;
}

const carrina = outpostEntry('Carrina Outpost');
const larsian = outpostEntry('Larsian Outpost');

function mockLevels(levels: Record<string, number>): void {
  seedGamestate((state) => {
    state.outposts = Object.fromEntries(
      Object.entries(levels).map(([nodeName, level]) => [nodeName, { level }]),
    );
  });
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
