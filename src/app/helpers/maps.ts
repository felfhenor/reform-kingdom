import type { Signal } from '@angular/core';
import { signal } from '@angular/core';
import type { GameMap } from '@interfaces';

const _allMaps = signal<Map<string, GameMap>>(new Map());
export const allMaps: Signal<Map<string, GameMap>> = _allMaps.asReadonly();

export function setAllMaps(state: Map<string, GameMap>): void {
  _allMaps.set(new Map(state));
}

export function getMap(name: string): GameMap | undefined {
  return allMaps().get(name);
}
