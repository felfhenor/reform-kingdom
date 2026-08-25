import type {
  CaravanContent,
  CaravanId,
  EncounterContent,
  TiledObject,
  WorldNodeEntry,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/caravan/caravan', () => ({
  caravanBrandName: vi.fn((nodeName: string) => nodeName.split(' - ')[0]),
  caravanState: vi.fn(() => undefined),
  caravanTimerLabel: vi.fn(() => undefined),
}));

vi.mock('@helpers/world-node/world-node-discovery', () => ({
  isWorldNodeDiscovered: vi.fn(() => false),
  worldNodeDiscover: vi.fn(),
}));

import { caravanTimerLabel } from '@helpers/caravan/caravan';
import { setAllContentById, setAllIdsByName } from '@helpers/content';
import { isWorldNodeDiscovered } from '@helpers/world-node/world-node-discovery';
import {
  worldNodeInteractionKind,
  worldNodeLabelInfo,
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

describe('encounter-backed node accessors', () => {
  beforeEach(() => {
    setAllIdsByName(new Map());
    setAllContentById(new Map());
    vi.mocked(isWorldNodeDiscovered).mockReturnValue(false);
  });

  describe('worldNodeLevelRange', () => {
    it("reads the level range from the matching encounter's data", () => {
      seedEncounter(buildEncounter({ levelRange: { min: 2, max: 5 } }));

      expect(worldNodeLevelRange(buildEntry())).toEqual({ min: 2, max: 5 });
    });

    it('returns undefined when there is no matching encounter', () => {
      expect(worldNodeLevelRange(buildEntry())).toBeUndefined();
    });
  });

  describe('worldNodeLabelInfo', () => {
    it('labels a gather node with its level range', () => {
      seedEncounter(buildEncounter({ levelRange: { min: 2, max: 5 } }));

      expect(worldNodeLabelInfo(buildEntry({ type: 'ExploreNode' }))).toEqual({
        kind: 'Explore',
        text: 'Forest Ruins\nLv.2-5',
      });
    });

    it('omits the level suffix when there is no matching content', () => {
      expect(worldNodeLabelInfo(buildEntry({ type: 'TeleportNode' }))).toEqual({
        kind: 'Travel',
        text: 'Forest Ruins',
      });
    });

    it('returns undefined for non-interactable object types', () => {
      expect(worldNodeLabelInfo(buildEntry({ type: '' }))).toBeUndefined();
    });

    it('shows only the caravan brand name (dropping the branch suffix and level range) and prefixes the reset timer', () => {
      const caravan: CaravanContent = {
        id: 'caravan-1' as CaravanId,
        name: 'Duchy Trading Caravan - Carrina',
        __type: 'caravan',
        description: 'A caravan.',
        traderResetTime: 3600,
        level: { min: 2, max: 5 },
        markupPercentages: { sell: 25, buy: -15 },
        traderCategories: ['Carrina'],
        commissionOffers: [],
      };
      seedContent([caravan]);
      vi.mocked(caravanTimerLabel).mockReturnValue('01:00:00');

      expect(
        worldNodeLabelInfo({
          mapName: 'Carrina',
          x: 24,
          y: 24,
          nodeName: caravan.name,
          nodeData: buildObject({ name: caravan.name, type: 'CaravanNode' }),
        }),
      ).toEqual({
        kind: 'Trade',
        text: '01:00:00\nDuchy Trading Caravan',
      });
    });

    it('still resolves the real label for a hidden, undiscovered node', () => {
      // Visibility gating happens at the map-render layer, not here.
      seedEncounter(
        buildEncounter({ hidden: true, levelRange: { min: 2, max: 5 } }),
      );
      vi.mocked(isWorldNodeDiscovered).mockReturnValue(false);

      expect(worldNodeLabelInfo(buildEntry({ type: 'ExploreNode' }))).toEqual({
        kind: 'Explore',
        text: 'Forest Ruins\nLv.2-5',
      });
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
