import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/pathfinding/pathfinding-travel');

import { decreeRouteTo, firstCrossedNode } from '@helpers/decree/decree-route';
import {
  travelPathThroughNodesTo,
  travelPathTo,
} from '@helpers/pathfinding/pathfinding-travel';
import type { TravelStep, WorldNodeEntry } from '@interfaces';
import { seedWorldNodes } from '@/testing/world';

const MAP = 'TestMap';

function move(x: number, mapName = MAP): TravelStep {
  return { kind: 'Move', mapName, x, y: 0 };
}

let gateway: WorldNodeEntry;
let target: WorldNodeEntry;
let farGate: WorldNodeEntry;

beforeEach(() => {
  vi.resetAllMocks();
  ({
    Gate: gateway,
    Target: target,
    'Far Gate': farGate,
  } = seedWorldNodes([
    { name: 'Gate', type: 'ExploreNode', x: 2 },
    { name: 'Target', type: 'ExploreNode', x: 3 },
    { name: 'Far Gate', type: 'ExploreNode', mapName: 'Other', x: 0 },
  ]));
});

const onto = (entry: WorldNodeEntry): TravelStep => ({
  kind: 'Move',
  mapName: entry.mapName,
  x: entry.x,
  y: entry.y,
});

describe('firstCrossedNode', () => {
  it('finds the first node tile walked through', () => {
    expect(firstCrossedNode([move(1), onto(gateway), onto(target)])).toEqual(
      gateway,
    );
  });

  it('ignores the destination tile', () => {
    expect(firstCrossedNode([move(1), onto(gateway)])).toBeUndefined();
  });

  it('ignores a teleport node stepped onto right before its jump, and the node it lands on', () => {
    expect(
      firstCrossedNode([
        onto(gateway),
        { ...onto(farGate), kind: 'Teleport' },
        move(1, 'Other'),
        move(2, 'Other'),
      ]),
    ).toBeUndefined();
  });
});

describe('decreeRouteTo', () => {
  it('goes straight to a directly reachable target', () => {
    vi.mocked(travelPathTo).mockReturnValue([move(1), onto(target)]);

    expect(decreeRouteTo(target, () => false)).toEqual({
      hop: target,
      steps: 2,
    });
  });

  it('hops to the gateway when the target is walled in, if the caller can stop there', () => {
    vi.mocked(travelPathThroughNodesTo).mockReturnValue([
      move(1),
      onto(gateway),
      onto(target),
    ]);
    const canStopAt = vi.fn(() => true);

    expect(decreeRouteTo(target, canStopAt)).toEqual({
      hop: gateway,
      steps: 3,
    });
    expect(canStopAt).toHaveBeenCalledWith(gateway);

    expect(decreeRouteTo(target, () => false)).toBeUndefined();
  });

  it('gives up with no route, or a route crossing no node', () => {
    expect(decreeRouteTo(target, () => true)).toBeUndefined();

    vi.mocked(travelPathThroughNodesTo).mockReturnValue([
      move(1),
      onto(target),
    ]);
    expect(decreeRouteTo(target, () => true)).toBeUndefined();
  });
});
