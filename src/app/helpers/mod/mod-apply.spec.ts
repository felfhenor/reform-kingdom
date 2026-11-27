import { seedContent } from '@/testing/content';
import { seedWorldNodes } from '@/testing/world';
import {
  contentSnapshotBase,
  getEntriesByType,
  getEntry,
} from '@helpers/content/content';
import { ensureItem } from '@helpers/content/ensure-item';
import { allMaps, mapsSnapshotBase } from '@helpers/maps';
import { modsApply, modsReset } from '@helpers/mod/mod-apply';
import { modsAffectGameplay } from '@helpers/mod/mod-registry';
import { modSprites } from '@helpers/mod/mod-sprites';
import type {
  IsContentItem,
  ItemContent,
  ItemId,
  ModBundle,
  RecipeContent,
  TiledMap,
} from '@interfaces';
import { beforeEach, describe, expect, it } from 'vitest';

const ore = ensureItem({
  id: 'ore' as ItemId,
  name: 'Ore',
  description: 'base',
});

function bundle(
  content: Record<string, Partial<IsContentItem>[]>,
  extra: Partial<ModBundle> = {},
): ModBundle {
  return {
    manifest: { id: 'test', name: 'Test', version: '1', kind: 'content' },
    content: content as Record<string, IsContentItem[]>,
    maps: {},
    mapPatches: [],
    sprites: [],
    ...extra,
  };
}

beforeEach(() => {
  seedContent([ore]);
  contentSnapshotBase();
});

describe('modsApply content', () => {
  it('adds entries and resolves names to ids', () => {
    const result = modsApply([
      bundle({
        item: [{ id: 'gem', name: 'Gem' }],
        recipe: [
          {
            id: 'r1',
            name: 'Cut Gem',
            result: { itemId: 'Gem', quantity: 1 },
          } as Partial<RecipeContent>,
        ],
      }),
    ]);

    expect(result['test']).toEqual([]);
    expect(getEntry<RecipeContent>('r1')?.result).toMatchObject({
      itemId: 'gem',
    });
  });

  it('patches an existing entry by id, arrays replacing', () => {
    modsApply([
      bundle({
        item: [{ id: 'ore', description: 'patched' } as Partial<ItemContent>],
      }),
    ]);

    expect(getEntry<ItemContent>('ore')?.description).toBe('patched');
    expect(getEntry<ItemContent>('ore')?.name).toBe('Ore');
  });

  it('is idempotent when applied twice and restores on reset', () => {
    const mod = bundle({ item: [{ id: 'gem', name: 'Gem' }] });
    modsApply([mod]);
    const second = modsApply([mod]);

    expect(second['test']).toEqual([]);
    expect(getEntriesByType('item')).toHaveLength(2);

    modsReset();
    expect(getEntry('gem')).toBeUndefined();
    expect(getEntriesByType('item')).toHaveLength(1);
  });

  it('reports unknown references and name collisions', () => {
    const result = modsApply([
      bundle({
        recipe: [
          {
            id: 'r',
            name: 'R',
            result: { itemId: 'Nope', quantity: 1 },
          } as Partial<RecipeContent>,
        ],
        item: [{ id: 'dupe', name: 'Ore' }],
      }),
    ]);

    expect(result['test'].some((e) => e.includes('"Nope"'))).toBe(true);
    expect(result['test'].some((e) => e.includes('duplicate name'))).toBe(true);
  });

  it('skips i18n mods', () => {
    const mod = bundle({ item: [{ id: 'gem', name: 'Gem' }] });
    mod.manifest.kind = 'i18n';
    modsApply([mod]);
    expect(getEntry('gem')).toBeUndefined();
  });
});

describe('modsApply maps and sprites', () => {
  beforeEach(() => {
    seedWorldNodes(
      [{ name: 'Home', type: 'Kingdom', mapName: 'Base', x: 1, y: 1 }],
      [],
      { Base: { width: 10, height: 10, denseTiles: [{ x: 5, y: 5 }] } },
    );
    mapsSnapshotBase();
  });

  const teleport = (name: string, x: number, y: number) => ({
    id: 0,
    name,
    type: 'TeleportNode',
    x: x * 16,
    y: (y + 1) * 16,
    width: 16,
    height: 16,
    visible: true,
  });

  it('adds patch objects to a base map', () => {
    const result = modsApply([
      bundle(
        {},
        { mapPatches: [{ map: 'Base', objects: [teleport('Portal', 2, 2)] }] },
      ),
    ]);
    const map = allMaps().get('Base')?.data as TiledMap;

    expect(result['test']).toEqual([]);
    expect(map.layers[0].objects?.map((o) => o.name)).toEqual([
      'Home',
      'Portal',
    ]);
  });

  it('rejects patch objects on blocked tiles or with taken names', () => {
    const result = modsApply([
      bundle(
        {},
        {
          mapPatches: [
            { map: 'Base', objects: [teleport('Wall', 5, 5)] },
            { map: 'Base', objects: [teleport('Home', 3, 3)] },
          ],
        },
      ),
    ]);

    expect(result['test']).toHaveLength(2);
    expect(
      (allMaps().get('Base')?.data as TiledMap).layers[0].objects,
    ).toHaveLength(1);
  });

  it('rejects a mod map that would replace an existing one', () => {
    const result = modsApply([
      bundle(
        {},
        {
          maps: {
            Base: {
              width: 1,
              height: 1,
              tilewidth: 16,
              tileheight: 16,
              layers: [],
              tilesets: [],
            },
          },
        },
      ),
    ]);

    expect(result['test']).toHaveLength(1);
    expect((allMaps().get('Base')?.data as TiledMap).width).toBe(10);
  });

  it('registers sprites and clears them on reset', () => {
    modsApply([
      bundle(
        {},
        {
          sprites: [{ sheet: 'item', sprite: 'gem', url: 'blob:x' }],
        },
      ),
    ]);
    expect(modSprites().get('item/gem')?.url).toBe('blob:x');

    modsReset();
    expect(modSprites().size).toBe(0);
  });
});

describe('modsAffectGameplay', () => {
  it('ignores i18n mods', () => {
    expect(modsAffectGameplay([])).toBe(false);
    expect(
      modsAffectGameplay([{ id: 'a', name: 'A', version: '1', kind: 'i18n' }]),
    ).toBe(false);
    expect(
      modsAffectGameplay([
        { id: 'a', name: 'A', version: '1', kind: 'content' },
      ]),
    ).toBe(true);
  });
});
