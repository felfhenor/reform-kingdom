import type { Character } from '@interfaces/character';
import type { Combat } from '@interfaces/combat';
import type { CollectibleId } from '@interfaces/content-collectible';
import type { EquipmentId } from '@interfaces/content-equipment';
import type { GlobalEffect } from '@interfaces/content-globaleffect';
import type { ItemId } from '@interfaces/content-item';
import type { RecipeId } from '@interfaces/content-recipe';
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

export type GameStateCollectibles = {
  [key: CollectibleId]: {
    quantity: number;
    foundAt: number;
    foundAtNode?: string;
  };
};

// Permanent record of every equipment id ever owned - unlike `armory`, this
// is never pruned when a piece of gear is equipped, sold, or broken down, so
// it survives as a standing "has this ever been found" flag.
export type GameStateDiscoveredEquipment = {
  [key: EquipmentId]: { foundAt: number };
};

// Permanent record of every world-found recipe - recipes only ever learned
// by leveling a tradeskill building never appear here (see `recipeDiscover`).
export type GameStateDiscoveredRecipes = {
  [key: RecipeId]: { foundAt: number; foundAtNode?: string };
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
  collectibles: GameStateCollectibles;
  armory: EquipmentItem[];
  discoveredEquipment: GameStateDiscoveredEquipment;
  discoveredRecipes: GameStateDiscoveredRecipes;
  globalEffects: GlobalEffect[];
};
