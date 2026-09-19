import { LOOT_FILTER_DEFAULT_MIN_ITEM_LEVEL } from '@helpers/config';
import { allEquipmentItemTypes } from '@helpers/item/equipment-types';
import { rngUuid } from '@helpers/rng';
import type {
  AutoModeState,
  CombatStatBlock,
  ElementBlock,
  EquipmentBlock,
  EquipmentItemType,
  GameId,
  GameState,
  GameStateTradeskills,
  GatheringState,
  GlobalEffectSums,
  LootFilterSettings,
  MonsterType,
  StatBlock,
  StatusEffectBlock,
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
      towns: {},
    },
    materials: {},
    discoveredMaterials: {},
    collectibles: {},
    armory: [],
    lootFilters: defaultLootFilterSettings(),
    discoveredEquipment: {},
    discoveredCaravans: {},
    discoveredRecipes: {},
    discoveredGatherNodes: {},
    gatherNodeLevels: {},
    shrines: {},
    worldDiscoveries: {},
    bestiary: {},
    workers: {},
    discoveredWorkers: {},
    globalEffects: [],
    globalEffectSums: defaultGlobalEffectSums(),
    tradeskills: defaultTradeskills(),
    discoveredAstralProjectorSpells: {},
    activeAstralProjectorSpells: [],
    tutorials: {},
  };
}

// Deliberately empty and content-free - `defaultGameState()` runs at
// module-eval time, before content is loaded. Real entries are populated
// once content is guaranteed loaded.
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

export function defaultLootFilterSettings(): LootFilterSettings {
  return {
    keepRarities: {
      Common: true,
      Uncommon: true,
      Rare: true,
      Mystical: true,
      Legendary: true,
    },
    minimumItemLevel: LOOT_FILTER_DEFAULT_MIN_ITEM_LEVEL,
    keepEquipmentTypes: Object.fromEntries(
      allEquipmentItemTypes().map((type) => [type, true]),
    ) as Record<EquipmentItemType, boolean>,
  };
}

export function defaultAutoModeState(): AutoModeState {
  return {
    enabled: false,
    clauses: [],
    waitForFullHealthBeforeCombat: false,
    waitForFullEnergyBeforeCombat: false,
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
    Spirit: 0,
    Constitution: 0,
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

export function defaultCombatStats(): CombatStatBlock {
  return {
    repeatActionChance: 0,
    skillStrikeAgainChance: 0,
    redirectionChance: 0,
    missChance: 0,
    debuffIgnoreChance: 0,
    damageReflectPercent: 0,
    healingIgnorePercent: 0,
    reviveChance: 0,
    stunChance: 0,
    agroValue: 0,
  };
}

export function defaultTagResistances(): StatusEffectBlock {
  return {
    Stun: 0,
    StatDown: 0,
    Accuracy: 0,
    DamageOverTime: 0,
    Poison: 0,
    Burn: 0,
    Bleed: 0,
  };
}

export function defaultGlobalEffectSums(): GlobalEffectSums {
  return {
    stats: defaultStats(),
    combatStats: defaultCombatStats(),
    debuffResistanceTags: defaultTagResistances(),
    debuffResistanceFlat: 0,
    xpGainMultiplierBonus: 0,
    goldGainMultiplierBonus: 0,
    combatItemDropRateBoost: 0,
    gatheringItemDropRateBoost: 0,
    armorySizeBoost: 0,
    tradeskillQueueSizeBoosts: {},
    offPathTravelSpeedBonus: 0,
    onPathTravelSpeedBonus: 0,
    decreeClauseCapBoost: 0,
  };
}

export function defaultMonsterTypeDamageBonus(): Record<MonsterType, number> {
  return {
    Humanoid: 0,
    Demon: 0,
    Amalgamation: 0,
    Insect: 0,
    Beast: 0,
    Spirit: 0,
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
