import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/pathfinding/pathfinding-travel', () => ({
  travelPathThroughNodesTo: vi.fn(),
  travelPathTo: vi.fn(),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeAt: vi.fn(),
}));

import { decreeRouteTo, firstCrossedNode } from '@helpers/decree/decree-route';
import {
  travelPathThroughNodesTo,
  travelPathTo,
} from '@helpers/pathfinding/pathfinding-travel';
import { worldNodeAt } from '@helpers/world-node/world-nodes';
import type { TravelStep, WorldNodeEntry } from '@interfaces';

function buildNode(nodeName: string): WorldNodeEntry {
  return { mapName: 'A', x: 0, y: 0, nodeName, nodeData: {} as never };
}

function move(x: number, mapName = 'A'): TravelStep {
  return { kind: 'Move', mapName, x, y: 0 };
}

const gateway = buildNode('Gate');
const target = buildNode('Target');

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(travelPathTo).mockReturnValue(undefined);
  vi.mocked(travelPathThroughNodesTo).mockReturnValue(undefined);
  vi.mocked(worldNodeAt).mockImplementation((mapName, x) =>
    mapName === 'A' && x === 2 ? gateway : undefined,
  );
});

describe('firstCrossedNode', () => {
  it('finds the first node tile walked through', () => {
    expect(firstCrossedNode([move(1), move(2), move(3)])).toBe(gateway);
  });

  it('ignores the destination tile', () => {
    expect(firstCrossedNode([move(1), move(2)])).toBeUndefined();
  });

  it('ignores a teleport node stepped onto right before its jump', () => {
    const path: TravelStep[] = [
      move(2),
      { kind: 'Teleport', mapName: 'B', x: 0, y: 0 },
      move(1, 'B'),
    ];

    expect(firstCrossedNode(path)).toBeUndefined();
  });
});

describe('decreeRouteTo', () => {
  it('goes straight to a directly reachable target', () => {
    vi.mocked(travelPathTo).mockReturnValue([move(1)]);

    expect(decreeRouteTo(target, () => false)).toEqual({
      hop: target,
      steps: 1,
    });
  });

  it('hops to the gateway when the target is walled in', () => {
    vi.mocked(travelPathThroughNodesTo).mockReturnValue([
      move(1),
      move(2),
      move(3),
    ]);

    expect(decreeRouteTo(target, () => true)).toEqual({
      hop: gateway,
      steps: 3,
    });
  });

  it('gives up when the gateway is not an acceptable stop', () => {
    vi.mocked(travelPathThroughNodesTo).mockReturnValue([
      move(1),
      move(2),
      move(3),
    ]);

    expect(decreeRouteTo(target, () => false)).toBeUndefined();
  });

  it('gives up when there is no route at all', () => {
    expect(decreeRouteTo(target, () => true)).toBeUndefined();
  });
});
