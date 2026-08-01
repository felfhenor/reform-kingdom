import type { TiledLayer, TiledMap, TiledTileset } from '@interfaces';
import { describe, expect, it } from 'vitest';

import {
  tiledLayerTileAt,
  tiledMapGetLayer,
  tiledMapTileLayers,
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
