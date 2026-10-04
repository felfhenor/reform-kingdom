import { ensureEncounter } from '@helpers/content/ensure-encounternode';
import { ensureGathering } from '@helpers/content/ensure-gathernode';
import { ensureTown } from '@helpers/content/ensure-town';
import {
  worldNodeInteractionKind,
  worldNodeLevelRange,
} from '@helpers/world-node/world-node-status';
import type { WorldNodeEntry, WorldNodeType } from '@interfaces';
import { describe, expect, it } from 'vitest';
import { seedContent } from '@/testing/content';
import { seedWorldNodes } from '@/testing/world';

const nodeName = 'Forest Ruins';

function nodeOfType(type: WorldNodeType): WorldNodeEntry {
  return seedWorldNodes([{ name: nodeName, type }])[nodeName];
}

describe('worldNodeLevelRange', () => {
  it("reads the level range from the matching encounter's data", () => {
    seedContent([
      ensureEncounter({ name: nodeName, levelRange: { min: 2, max: 5 } }),
    ]);

    expect(worldNodeLevelRange(nodeOfType('ExploreNode'))).toEqual({
      min: 2,
      max: 5,
    });
  });

  it("reads the level range from the matching gathering's data", () => {
    seedContent([
      ensureGathering({ name: nodeName, levelRange: { min: 4, max: 9 } }),
    ]);

    expect(worldNodeLevelRange(nodeOfType('GatherNode'))).toEqual({
      min: 4,
      max: 9,
    });
  });

  it('returns undefined when there is no matching content', () => {
    expect(worldNodeLevelRange(nodeOfType('ExploreNode'))).toBeUndefined();
  });

  it("collapses a town's single level into a min-max range", () => {
    seedContent([ensureTown({ name: nodeName, level: 25 })]);

    expect(worldNodeLevelRange(nodeOfType('NonPlayerKingdom'))).toEqual({
      min: 25,
      max: 25,
    });
  });
});

describe('worldNodeInteractionKind', () => {
  it.each([
    ['GatherNode', 'Gather'],
    ['ExploreNode', 'Explore'],
    ['CaravanNode', 'Trade'],
    ['TeleportNode', 'Travel'],
    ['Kingdom', 'Travel'],
    ['NonPlayerKingdom', 'Travel'],
  ] as const)('maps %s to %s', (type, kind) => {
    expect(worldNodeInteractionKind(nodeOfType(type))).toBe(kind);
  });

  it('returns undefined for unrecognized types', () => {
    const entry = nodeOfType('ExploreNode');

    expect(
      worldNodeInteractionKind({
        ...entry,
        nodeData: { ...entry.nodeData, type: '' },
      }),
    ).toBeUndefined();
  });
});
