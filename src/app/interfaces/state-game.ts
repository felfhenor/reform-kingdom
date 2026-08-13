import type { Character } from '@interfaces/character';
import type { Combat } from '@interfaces/combat';
import type { CollectibleId } from '@interfaces/content-collectible';
import type { EquipmentId } from '@interfaces/content-equipment';
import type { GlobalEffect } from '@interfaces/content-globaleffect';
import type { ItemId } from '@interfaces/content-item';
import type { MonsterId } from '@interfaces/content-monster';
import type { RecipeId } from '@interfaces/content-recipe';
import type { GameStateTradeskills } from '@interfaces/crafting';
import type { AutoModeState } from '@interfaces/decree';
import type { EquipmentItem } from '@interfaces/equipment';
import type { GameStateExploreRandom } from '@interfaces/explore-random';
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
  autoMode: AutoModeState;
  exploreRandom: GameStateExploreRandom;
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

// Permanent record of every GatherNode the party has physically visited -
// keyed by the Tiled node's name (there's no branded id for world nodes).
// Used to scope auto-mode's material picker to materials the player has
// actually found a source for, rather than every material gatherable
// anywhere in the world.
export type GameStateDiscoveredGatherNodes = {
  [key: string]: { foundAt: number };
};

// Permanent record of every `hidden` world node the player has revealed by
// clicking it - unlike `discoveredGatherNodes` (GatherNodes only, recorded on
// travel arrival), this covers every node type and is recorded on click, so
// a hidden node's label/cursor can be gated on it (see `world-node-discovery.ts`).
export type GameStateWorldDiscoveries = {
  [key: string]: { foundAt: number };
};

// Permanent record of every monster the party has ever defeated - `kills`
// keeps counting past the first kill, unlike the other discovery slices,
// since the bestiary shows a running kill count per monster. `minLevelFound`
// / `maxLevelFound` track the actual levels it's been fought at (not the
// theoretical range from its encounter data), and `foundAtNodes` accumulates
// every distinct location it's been killed at, not just the first.
export type GameStateBestiary = {
  [key: MonsterId]: {
    foundAt: number;
    kills: number;
    minLevelFound: number;
    maxLevelFound: number;
    foundAtNodes: string[];
  };
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
  discoveredGatherNodes: GameStateDiscoveredGatherNodes;
  worldDiscoveries: GameStateWorldDiscoveries;
  bestiary: GameStateBestiary;
  globalEffects: GlobalEffect[];
  tradeskills: GameStateTradeskills;
};
