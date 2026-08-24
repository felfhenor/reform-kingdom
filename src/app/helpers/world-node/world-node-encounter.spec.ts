import type {
  EncounterContent,
  MonsterContent,
  TiledObject,
  WorldNodeEntry,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/world-node/world-node-discovery', () => ({
  isWorldNodeDiscovered: vi.fn(() => false),
  worldNodeDiscover: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
}));

import { setAllContentById, setAllIdsByName } from '@helpers/content';
import { gamestate } from '@helpers/state-game';
import { isWorldNodeDiscovered } from '@helpers/world-node/world-node-discovery';
import {
  worldNodeEncounterProgress,
  worldNodeMonsterCount,
  worldNodeMonsters,
} from '@helpers/world-node/world-node-encounter';
import type { Combat, GameState } from '@interfaces';

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
    vi.mocked(gamestate).mockReturnValue({
      world: { combat: undefined },
    } as unknown as GameState);
  });

  describe('worldNodeMonsterCount', () => {
    it('sums the monsters across every fight in the matching encounter', () => {
      seedEncounter(
        buildEncounter({
          fights: [
            { monsters: [{ monsterId: 'goblin' }] },
            {
              monsters: [{ monsterId: 'goblin' }, { monsterId: 'goblin' }],
            },
          ],
        }),
      );

      expect(worldNodeMonsterCount(buildEntry())).toBe(3);
    });

    it('returns undefined when there is no matching encounter', () => {
      expect(worldNodeMonsterCount(buildEntry())).toBeUndefined();
    });
  });

  describe('worldNodeMonsters', () => {
    function buildMonster(
      overrides: Partial<MonsterContent> = {},
    ): MonsterContent {
      return {
        id: 'goblin',
        name: 'Goblin',
        __type: 'monster',
        description: '',
        sprite: '0000',
        frames: 4,
        rarity: 'Common',
        baseStats: {} as never,
        statsPerLevel: {} as never,
        targettingType: 'Random',
        xp: { min: 1, max: 1 },
        drops: [],
        skills: [],
        ...overrides,
      } as MonsterContent;
    }

    it('resolves the distinct monsters across every fight, sorted alphabetically', () => {
      const wolf = buildMonster({
        id: 'wolf' as MonsterContent['id'],
        name: 'Wolf',
      });
      const goblin = buildMonster({
        id: 'goblin' as MonsterContent['id'],
        name: 'Goblin',
      });

      const encounter = buildEncounter({
        fights: [
          { monsters: [{ monsterId: wolf.id }] },
          { monsters: [{ monsterId: goblin.id }, { monsterId: goblin.id }] },
        ],
      });

      seedContent([encounter, wolf, goblin]);

      expect(
        worldNodeMonsters(buildEntry()).map((monster) => monster.name),
      ).toEqual(['Goblin', 'Wolf']);
    });

    it('returns an empty array when there is no matching encounter', () => {
      expect(worldNodeMonsters(buildEntry())).toEqual([]);
    });
  });

  describe('worldNodeEncounterProgress', () => {
    function mockCombat(combat: Partial<Combat> | undefined): void {
      vi.mocked(gamestate).mockReturnValue({
        world: { combat },
      } as unknown as GameState);
    }

    it('returns the 1-based current fight and total when combat is at this node', () => {
      seedEncounter(
        buildEncounter({
          fights: [{ monsters: [] }, { monsters: [] }, { monsters: [] }],
        }),
      );
      mockCombat({ locationName: 'Forest Ruins', fightIndex: 1 });

      expect(worldNodeEncounterProgress(buildEntry())).toEqual({
        current: 2,
        total: 3,
        fraction: 1 / 3,
      });
    });

    it('defaults fightIndex to 0 when undefined', () => {
      seedEncounter(
        buildEncounter({ fights: [{ monsters: [] }, { monsters: [] }] }),
      );
      mockCombat({ locationName: 'Forest Ruins', fightIndex: undefined });

      expect(worldNodeEncounterProgress(buildEntry())).toEqual({
        current: 1,
        total: 2,
        fraction: 0,
      });
    });

    it('returns undefined when there is no active combat', () => {
      mockCombat(undefined);

      expect(worldNodeEncounterProgress(buildEntry())).toBeUndefined();
    });

    it('returns undefined when combat is at a different node', () => {
      seedEncounter(buildEncounter({ fights: [{ monsters: [] }] }));
      mockCombat({ locationName: 'Somewhere Else', fightIndex: 0 });

      expect(worldNodeEncounterProgress(buildEntry())).toBeUndefined();
    });

    it('returns undefined when the node has no encounter fights', () => {
      mockCombat({ locationName: 'Forest Ruins', fightIndex: 0 });

      expect(worldNodeEncounterProgress(buildEntry())).toBeUndefined();
    });
  });
});
