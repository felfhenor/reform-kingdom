import { rngUuid } from '@helpers/rng';
import type {
  AutoModeState,
  CombatantCombatStats,
  ElementBlock,
  EquipmentBlock,
  GameId,
  GameState,
  GameStateTradeskills,
  GatheringState,
  StatBlock,
  TravelState,
} from '@interfaces';

export function defaultGameState(): GameState {
  return {
    meta: {
      version: 1,
      isSetup: false,
      isPaused: false,
      createdAt: Date.now(),
    },
    gameId: rngUuid() as GameId,
    clock: {
      numTicks: 0,
      lastSaveTick: 0,
    },
    world: {
      party: [],
      currentLocation: {
        mapName: 'Carrina',
        x: 26,
        y: 24,
      },
      travel: defaultTravelState(),
      gathering: defaultGatheringState(),
      autoMode: defaultAutoModeState(),
      exploreRandom: {},
      caravans: {},
    },
    materials: {},
    discoveredMaterials: {},
    collectibles: {},
    armory: [],
    discoveredEquipment: {},
    discoveredRecipes: {},
    discoveredGatherNodes: {},
    worldDiscoveries: {},
    bestiary: {},
    globalEffects: [],
    tradeskills: defaultTradeskills(),
  };
}

// Deliberately empty and free of any content dependency - `state-game.ts`
// calls `defaultGameState()` eagerly at module-eval time (before content is
// loaded, and before every spec file's `@helpers/content` mock is
// guaranteed to exist), so this must never call into gamedata lookups.
// Real per-tradeskill entries (keyed by TradeskillId, sourced from loaded
// gamedata) are populated by `migrateTradeskillStateKeys` in
// `@helpers/tradeskill`, which only ever runs once content is guaranteed
// loaded - see `migrateGameState`.
function defaultTradeskills(): GameStateTradeskills {
  return {} as GameStateTradeskills;
}

export function defaultTravelState(): TravelState {
  return {
    status: 'Idle',
    path: [],
    ticksIntoStep: 0,
  };
}

export function defaultGatheringState(): GatheringState {
  return {
    status: 'Idle',
    ticksIntoGather: 0,
  };
}

export function defaultAutoModeState(): AutoModeState {
  return {
    enabled: false,
    clauses: [],
    waitForFullHealthBeforeCombat: false,
    nodeFailureCounts: {},
  };
}

export function defaultStats(): StatBlock {
  return {
    Agility: 0,
    Energy: 0,
    Health: 0,
    Intelligence: 0,
    Luck: 0,
    Resistance: 0,
    Strength: 0,
    Vitality: 0,
  };
}

export function defaultAffinities(): ElementBlock {
  return {
    Fire: 0,
    Water: 0,
    Earth: 0,
    Air: 0,
  };
}

export function defaultCombatStats(): CombatantCombatStats {
  return {
    repeatActionChance: 0,
    skillStrikeAgainChance: 0,
    skillAdditionalUseChance: 0,
    skillAdditionalUseCount: 0,
    redirectionChance: 0,
    missChance: 0,
    debuffIgnoreChance: 0,
    damageReflectPercent: 0,
    healingIgnorePercent: 0,
    reviveChance: 0,
    stunChance: 0,
  };
}

export function defaultEquipment(): EquipmentBlock {
  return {
    Armor: undefined,
    Helmet: undefined,
    Weapon: undefined,
    Offhand: undefined,
    Ring: undefined,
    Accessory: undefined,
    Artifact: undefined,
    Ammo: undefined,
  };
}
