import type { Character } from '@interfaces/character';
import type { Combat } from '@interfaces/combat';
import type { GlobalEffect } from '@interfaces/content-globaleffect';
import type { ItemId } from '@interfaces/content-item';
import type { Branded } from '@interfaces/identifiable';

export type GameId = Branded<string, 'GameId'>;

export type CurrentLocation = {
  mapName: string;
  x: number;
  y: number;
};

export type GameStateWorld = {
  party: Character[];
  combat?: Combat;
  currentLocation: CurrentLocation;
};

export type MaterialId = ItemId;

export type GameStateMaterials = {
  [key: MaterialId]: { quantity: number };
};

export type GameStateClock = {
  numTicks: number;
  lastSaveTick: number;
};

export type GameStateMeta = {
  version: number;
  isSetup: boolean;
  isPaused: boolean;
  createdAt: number;
};

export type GameState = {
  meta: GameStateMeta;
  gameId: GameId;
  clock: GameStateClock;
  world: GameStateWorld;
  materials: GameStateMaterials;
  globalEffects: GlobalEffect[];
};
