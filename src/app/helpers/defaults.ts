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
  StatusEffectTag,
  TravelState,
  WorkerStatBlock,
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
      commissions: {},
    },
    materials: {},
    discoveredMaterials: {},
    collectibles: {},
    armory: [],
    discoveredEquipment: {},
    discoveredCaravans: {},
    discoveredRecipes: {},
    discoveredGatherNodes: {},
    worldDiscoveries: {},
    bestiary: {},
    workers: {},
    discoveredWorkers: {},
    globalEffects: [],
    tradeskills: defaultTradeskills(),
    discoveredAstralProjectorSpells: {},
    activeAstralProjectorSpells: [],
  };
}

// Deliberately empty and content-free - `defaultGameState()` runs at
// module-eval time, before content is loaded. Real entries are populated by
// `migrateTradeskillStateKeys` once content is guaranteed loaded.
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

export function defaultWorkerStats(): WorkerStatBlock {
  return {
    capacity: 0,
    gatherSpeed: 0,
    stamina: 0,
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

export function defaultTagResistances(): Record<StatusEffectTag, number> {
  return {
    Stun: 0,
    StatDown: 0,
    Accuracy: 0,
    DamageOverTime: 0,
    Poison: 0,
    Burn: 0,
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
