import { rngUuid } from '@helpers/rng';
import type {
  CombatantCombatStats,
  ElementBlock,
  EquipmentBlock,
  GameId,
  GameState,
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
        x: 24,
        y: 24,
      },
      travel: defaultTravelState(),
      gathering: defaultGatheringState(),
    },
    materials: {},
    globalEffects: [],
  };
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
    repeatActionChance: defaultAffinities(),
    skillStrikeAgainChance: defaultAffinities(),
    skillAdditionalUseChance: defaultAffinities(),
    skillAdditionalUseCount: defaultAffinities(),
    redirectionChance: defaultAffinities(),
    missChance: defaultAffinities(),
    debuffIgnoreChance: defaultAffinities(),
    damageReflectPercent: defaultAffinities(),
    healingIgnorePercent: defaultAffinities(),
    reviveChance: 0,
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
