import type { Character } from '@interfaces/character';
import type { Combat } from '@interfaces/combat';
import type { GlobalEffect } from '@interfaces/content-globaleffect';
import type { ItemId } from '@interfaces/content-item';
import type { EquipmentItem } from '@interfaces/equipment';
import type { GatheringState } from '@interfaces/gathering';
import type { Branded } from '@interfaces/identifiable';
import type { TravelState } from '@interfaces/travel';

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
  travel: TravelState;
  gathering: GatheringState;
};

export type MaterialId = ItemId;

export type GameStateMaterials = {
  [key: MaterialId]: { quantity: number; foundAt: number };
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
  armory: EquipmentItem[];
  globalEffects: GlobalEffect[];
};
