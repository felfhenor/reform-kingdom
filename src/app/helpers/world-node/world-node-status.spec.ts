import type {
  EncounterContent,
  TiledObject,
  TownContent,
  WorldNodeEntry,
} from '@interfaces';
import { describe, expect, it } from 'vitest';

import { setAllContentById, setAllIdsByName } from '@helpers/content/content';
import {
  worldNodeInteractionKind,
  worldNodeLevelLabel,
  worldNodeLevelRange,
} from '@helpers/world-node/world-node-status';

function buildObject(overrides: Partial<TiledObject>): TiledObject {
  return {
    id: 1,
    name: 'Unnamed',
    type: '',
    x: 0,
    y: 0,
    width: 64,
    height: 64,
    visible: true,
    ...overrides,
  };
}

function buildEntry(nodeData: Partial<TiledObject> = {}): WorldNodeEntry {
  return {
    mapName: 'Carrina',
    x: 24,
    y: 24,
    nodeName: 'Forest Ruins',
    nodeData: buildObject(nodeData),
  };
}

function buildEncounter(
  overrides: Partial<EncounterContent> = {},
): EncounterContent {
  return {
    id: 'encounter-forest-ruins',
    name: 'Forest Ruins',
    __type: 'encounter',
    description: 'A crumbling ruin at the edge of the forest.',
    levelRange: { min: 1, max: 3 },
    fights: [],
    ...overrides,
  } as EncounterContent;
}

function seedEncounter(encounter: EncounterContent): void {
  setAllIdsByName(new Map([[encounter.name, encounter.id]]));
  setAllContentById(new Map([[encounter.id, encounter]]));
}

function seedContent(
  entries: Array<{ id: string; name: string } & Record<string, unknown>>,
): void {
  setAllIdsByName(new Map(entries.map((entry) => [entry.name, entry.id])));
  setAllContentById(
    new Map(entries.map((entry) => [entry.id, entry as never])),
  );
}

describe('worldNodeLevelRange', () => {
  it("reads the level range from the matching encounter's data", () => {
    setAllIdsByName(new Map());
    setAllContentById(new Map());
    seedEncounter(buildEncounter({ levelRange: { min: 2, max: 5 } }));

    expect(worldNodeLevelRange(buildEntry())).toEqual({ min: 2, max: 5 });
  });

  it('returns undefined when there is no matching encounter', () => {
    setAllIdsByName(new Map());
    setAllContentById(new Map());

    expect(worldNodeLevelRange(buildEntry())).toBeUndefined();
  });

  it("collapses a town's single level into a min-max range", () => {
    setAllIdsByName(new Map());
    setAllContentById(new Map());
    seedContent([
      {
        id: 'town-forest-ruins',
        name: 'Forest Ruins',
        __type: 'town',
        level: 25,
      } as unknown as TownContent,
    ]);

    expect(worldNodeLevelRange(buildEntry())).toEqual({ min: 25, max: 25 });
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
    expect(worldNodeInteractionKind(buildEntry({ type }))).toBe(kind);
  });

  it('returns undefined for unrecognized types', () => {
    expect(worldNodeInteractionKind(buildEntry({ type: '' }))).toBeUndefined();
  });
});

describe('worldNodeLevelLabel', () => {
  it('collapses to a single number when min equals max', () => {
    expect(worldNodeLevelLabel({ min: 3, max: 3 })).toBe('3');
  });

  it('renders the full min-max range', () => {
    expect(worldNodeLevelLabel({ min: 2, max: 5 })).toBe('2-5');
  });
});
