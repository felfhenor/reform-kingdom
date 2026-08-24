import type { GameStateCaravans } from '@interfaces/caravan-state';
import type { Character } from '@interfaces/character';
import type { Combat } from '@interfaces/combat';
import type { AstralProjectorId } from '@interfaces/content-astralprojector';
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
  caravans: GameStateCaravans;
};

export type MaterialId = ItemId;

export type GameStateMaterials = {
  [key: MaterialId]: { quantity: number; foundAt: number };
};

// Unlike `materials` (deletes the entry once stock hits 0), this is never pruned on spend - a standing "has this ever been found" flag.
export type GameStateDiscoveredMaterials = {
  [key: MaterialId]: { foundAt: number };
};

// Where a collectible was found is derived fresh from content each render (see `helpers/collectible-source.ts`), so this only tracks ownership.
export type GameStateCollectibles = {
  [key: CollectibleId]: {
    quantity: number;
    foundAt: number;
  };
};

// Unlike `armory`, this is never pruned on equip/sell/breakdown - it's a standing "has this ever been found" flag.
export type GameStateDiscoveredEquipment = {
  [key: EquipmentId]: { foundAt: number };
};

// Level-learned recipes never appear here. No stored location - see `recipeSourceNodeNames`.
export type GameStateDiscoveredRecipes = {
  [key: RecipeId]: { foundAt: number };
};

// One-time ledger of already-announced unlocks - unlock itself is a live check (`isAstralProjectorCollectiblesMet`).
export type GameStateDiscoveredAstralProjectorSpells = {
  [key: AstralProjectorId]: { foundAt: number };
};

export type GameStateActiveAstralProjectorSpell = {
  astralProjectorId: AstralProjectorId;
  startedAtTick: number;
  expiresAtTick: number;
};

// Keyed by Tiled node name (no branded id for world nodes). Scopes auto-mode's material picker to sources the player has actually found.
export type GameStateDiscoveredGatherNodes = {
  [key: string]: { foundAt: number };
};

// Unlike `discoveredGatherNodes` (GatherNodes only, recorded on arrival), this covers every node type, recorded on click (see `world-node-discovery.ts`).
export type GameStateWorldDiscoveries = {
  [key: string]: { foundAt: number };
};

// `kills` keeps counting past the first kill (unlike other discovery slices) for the bestiary's running count. `minLevelFound`/`maxLevelFound` are actual fought levels, not encounter data's theoretical range.
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
  discoveredMaterials: GameStateDiscoveredMaterials;
  collectibles: GameStateCollectibles;
  armory: EquipmentItem[];
  discoveredEquipment: GameStateDiscoveredEquipment;
  discoveredRecipes: GameStateDiscoveredRecipes;
  discoveredGatherNodes: GameStateDiscoveredGatherNodes;
  worldDiscoveries: GameStateWorldDiscoveries;
  bestiary: GameStateBestiary;
  globalEffects: GlobalEffect[];
  tradeskills: GameStateTradeskills;
  discoveredAstralProjectorSpells: GameStateDiscoveredAstralProjectorSpells;
  activeAstralProjectorSpells: GameStateActiveAstralProjectorSpell[];
};
