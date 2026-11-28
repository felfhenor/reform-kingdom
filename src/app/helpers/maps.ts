import type { Signal } from '@angular/core';
import { signal } from '@angular/core';
import type { GameMap, TiledTileset } from '@interfaces';

const _allMaps = signal<Map<string, GameMap>>(new Map());
export const allMaps: Signal<Map<string, GameMap>> = _allMaps.asReadonly();

export function setAllMaps(state: Map<string, GameMap>): void {
  _allMaps.set(new Map(state));
}

let baseMaps = new Map<string, GameMap>();

export function mapsSnapshotBase(): void {
  baseMaps = new Map(allMaps());
}

export function mapsBase(): GameMap[] {
  return [...baseMaps.values()];
}

export function mapsRestoreBase(): void {
  setAllMaps(baseMaps);
}

let baseTilesets: Record<string, TiledTileset> = Object.create(null);

export function setBaseTilesets(tilesets: Record<string, TiledTileset>): void {
  baseTilesets = tilesets;
}

export function baseTilesetGet(name: string): TiledTileset | undefined {
  return baseTilesets[name];
}

export function getMap(name: string): GameMap | undefined {
  return allMaps().get(name);
}
