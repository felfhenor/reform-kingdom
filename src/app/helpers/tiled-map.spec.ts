import type { TiledLayer, TiledMap, TiledObject, TiledTileset } from '@interfaces';
import { describe, expect, it } from 'vitest';

import {
  tiledLayerTileAt,
  tiledMapGetLayer,
  tiledMapTileLayers,
  tiledObjectProperty,
  tiledObjectSpriteFrame,
  tiledTilesetForGid,
  tiledTileSourceRect,
} from '@helpers/tiled-map';

function buildTileset(overrides: Partial<TiledTileset> = {}): TiledTileset {
  return {
    firstgid: 1,
    name: 'terrain',
    image: '../mapdata/maptiles.png',
    imagewidth: 1600,
    imageheight: 1088,
    columns: 25,
    tilewidth: 64,
    tileheight: 64,
    margin: 0,
    spacing: 0,
    tilecount: 425,
    ...overrides,
  };
}

function buildMap(overrides: Partial<TiledMap> = {}): TiledMap {
  return {
    width: 2,
    height: 2,
    tilewidth: 64,
    tileheight: 64,
    tilesets: [buildTileset()],
    layers: [],
    ...overrides,
  };
}

describe('Tiled Map Helper Functions', () => {
  describe('tiledMapTileLayers', () => {
    it('should return only tilelayer layers', () => {
      const tileLayer: TiledLayer = {
        id: 1,
        name: 'World Tiles',
        type: 'tilelayer',
        visible: true,
      };
      const objectLayer: TiledLayer = {
        id: 2,
        name: 'Explore Nodes',
        type: 'objectgroup',
        visible: true,
      };

      const map = buildMap({ layers: [tileLayer, objectLayer] });

      expect(tiledMapTileLayers(map)).toEqual([tileLayer]);
    });
  });

  describe('tiledMapGetLayer', () => {
    it('should find a layer by name', () => {
      const layer: TiledLayer = {
        id: 1,
        name: 'Decorative Tiles',
        type: 'tilelayer',
        visible: true,
      };
      const map = buildMap({ layers: [layer] });

      expect(tiledMapGetLayer(map, 'Decorative Tiles')).toBe(layer);
    });

    it('should return undefined when no layer matches', () => {
      const map = buildMap({ layers: [] });

      expect(tiledMapGetLayer(map, 'Missing')).toBeUndefined();
    });
  });

  describe('tiledTilesetForGid', () => {
    it('should return undefined for an empty gid', () => {
      const map = buildMap();

      expect(tiledTilesetForGid(map, 0)).toBeUndefined();
    });

    it('should pick the tileset with the highest firstgid at or below the gid', () => {
      const terrain = buildTileset({ firstgid: 1, name: 'terrain' });
      const objects = buildTileset({ firstgid: 426, name: 'objects' });
      const map = buildMap({ tilesets: [terrain, objects] });

      expect(tiledTilesetForGid(map, 10)).toBe(terrain);
      expect(tiledTilesetForGid(map, 430)).toBe(objects);
    });
  });

  describe('tiledTileSourceRect', () => {
    it('should compute the pixel rect for the first tile', () => {
      const tileset = buildTileset();

      expect(tiledTileSourceRect(tileset, 1)).toEqual({
        x: 0,
        y: 0,
        width: 64,
        height: 64,
      });
    });

    it('should wrap into the next row after the last column', () => {
      const tileset = buildTileset({ columns: 25 });

      expect(tiledTileSourceRect(tileset, 26)).toEqual({
        x: 0,
        y: 64,
        width: 64,
        height: 64,
      });
    });

    it('should account for margin and spacing', () => {
      const tileset = buildTileset({ margin: 2, spacing: 1 });

      expect(tiledTileSourceRect(tileset, 2)).toEqual({
        x: 2 + 65,
        y: 2,
        width: 64,
        height: 64,
      });
    });
  });

  describe('tiledObjectProperty', () => {
    function buildObject(overrides: Partial<TiledObject> = {}): TiledObject {
      return {
        id: 1,
        name: 'Forest Ruins',
        type: 'ExploreNode',
        x: 0,
        y: 0,
        width: 64,
        height: 64,
        visible: true,
        ...overrides,
      };
    }

    it('returns the value of a matching property', () => {
      const object = buildObject({
        properties: [{ name: 'level', type: 'int', value: 5 }],
      });

      expect(tiledObjectProperty<number>(object, 'level')).toBe(5);
    });

    it('returns undefined when there is no matching property', () => {
      const object = buildObject({ properties: [] });

      expect(tiledObjectProperty(object, 'level')).toBeUndefined();
    });

    it('returns undefined when the object has no properties at all', () => {
      const object = buildObject();

      expect(tiledObjectProperty(object, 'level')).toBeUndefined();
    });
  });

  describe('tiledObjectSpriteFrame', () => {
    it('returns the source rect for the object gid', () => {
      const tileset = buildTileset();
      const map = buildMap({ tilesets: [tileset] });
      const object: TiledObject = {
        id: 1,
        name: 'Forest Ruins',
        type: 'ExploreNode',
        gid: 26,
        x: 0,
        y: 0,
        width: 64,
        height: 64,
        visible: true,
      };

      expect(tiledObjectSpriteFrame(map, object)).toEqual({
        imagePath: 'mapdata/maptiles.png',
        imageWidth: 1600,
        imageHeight: 1088,
        x: 0,
        y: 64,
        width: 64,
        height: 64,
      });
    });

    it('masks off flip flags before resolving the tileset', () => {
      const tileset = buildTileset();
      const map = buildMap({ tilesets: [tileset] });
      const object: TiledObject = {
        id: 1,
        name: 'Forest Ruins',
        type: 'ExploreNode',
        gid: 1 | 0x80000000,
        x: 0,
        y: 0,
        width: 64,
        height: 64,
        visible: true,
      };

      expect(tiledObjectSpriteFrame(map, object)).toMatchObject({
        x: 0,
        y: 0,
      });
    });

    it('returns undefined when the object has no gid', () => {
      const map = buildMap({ tilesets: [buildTileset()] });
      const object: TiledObject = {
        id: 1,
        name: 'Forest Ruins',
        type: 'ExploreNode',
        x: 0,
        y: 0,
        width: 64,
        height: 64,
        visible: true,
      };

      expect(tiledObjectSpriteFrame(map, object)).toBeUndefined();
    });
  });

  describe('tiledLayerTileAt', () => {
    it('should return the gid at the given coordinates', () => {
      const layer: TiledLayer = {
        id: 1,
        name: 'World Tiles',
        type: 'tilelayer',
        visible: true,
        width: 2,
        height: 2,
        data: [1, 2, 3, 4],
      };

      expect(tiledLayerTileAt(layer, 1, 1)).toBe(4);
    });

    it('should return 0 for a layer with no data', () => {
      const layer: TiledLayer = {
        id: 1,
        name: 'Empty',
        type: 'objectgroup',
        visible: true,
      };

      expect(tiledLayerTileAt(layer, 0, 0)).toBe(0);
    });
  });
});
