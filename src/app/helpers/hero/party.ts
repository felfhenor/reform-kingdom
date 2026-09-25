import {
  CHARACTER_MAX_LEVEL,
  CHARACTER_XP_END,
  CHARACTER_XP_START,
  XP_CURVE_EASE,
} from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { defaultEquipment, defaultStats } from '@helpers/defaults';
import { roundToNearest10 } from '@helpers/engine/number';
import {
  equipmentAffixEffects,
  equipmentGatherYieldBonuses,
  equipmentStatTotals,
  newEquipmentItem,
  pruneInvalidEquippedItems,
} from '@helpers/item/equipment';
import {
  affixEffectsAddToBlock,
  STAT_BONUS,
} from '@helpers/item/equipment-bonus';
import { rngUuid } from '@helpers/rng';
import { updateGamestate, worldPartyState } from '@helpers/state-game';
import {
  characterAllTeachingIds,
  trainerTeachingEffects,
} from '@helpers/trainer/trainer-teaching';
import type {
  AffixEffect,
  Character,
  CharacterId,
  EquipmentBlock,
  EquipmentContent,
  GatherYieldBonus,
  JobContent,
  JobId,
  StatBlock,
  TrainerTeachingId,
} from '@interfaces';
import { clamp } from 'es-toolkit/compat';

const STARTER_ARMOR_NAME = 'Cloak of Adventuring';
const STARTER_HAT_NAME = 'Hat of Adventuring';

// `progress ** 1.5` eases in gently at low levels instead of a straight line's constant step dominating a tiny starting value.
export function characterXpForLevel(level: number): number {
  const progress = (level - 1) / (CHARACTER_MAX_LEVEL - 1);
  const xp =
    CHARACTER_XP_START +
    (CHARACTER_XP_END - CHARACTER_XP_START) * progress ** XP_CURVE_EASE;
  return roundToNearest10(xp);
}

function jobStatsAtLevel(jobId: JobId, level: number): StatBlock {
  const job = getEntry<JobContent>(jobId);
  const stats = { ...(job?.baseStats ?? defaultStats()) };
  const perLevel = job?.statsPerLevel ?? defaultStats();

  (Object.keys(stats) as Array<keyof StatBlock>).forEach((stat) => {
    stats[stat] += perLevel[stat] * (level - 1);
  });

  return stats;
}

// Equipment and teaching stat bonuses are flat (no per-level scaling). `teachingIds` spans every job, not just `jobId`.
export function characterStatsForLevel(
  jobId: JobId,
  level: number,
  equipment: EquipmentBlock,
  teachingIds: TrainerTeachingId[],
): StatBlock {
  const stats = jobStatsAtLevel(jobId, level);
  const equipmentStats = affixEffectsAddToBlock(
    equipmentStatTotals(equipment),
    trainerTeachingEffects(teachingIds),
    STAT_BONUS,
  );

  // Floored at 1 - a stat at or below 0 (Health/Energy especially) breaks max-pool clamping downstream.
  (Object.keys(stats) as Array<keyof StatBlock>).forEach((stat) => {
    stats[stat] = clamp(stats[stat] + equipmentStats[stat], 1, Infinity);
  });

  return stats;
}

function starterEquipment(): EquipmentBlock {
  const equipment = defaultEquipment();

  const starterArmor = getEntry<EquipmentContent>(STARTER_ARMOR_NAME);
  if (starterArmor) {
    equipment.Armor = newEquipmentItem(starterArmor.id);
  }

  const starterHat = getEntry<EquipmentContent>(STARTER_HAT_NAME);
  if (starterHat) {
    equipment.Helmet = newEquipmentItem(starterHat.id);
  }

  return equipment;
}

export function createCharacter(name: string, jobId: JobId): Character {
  const equipment = starterEquipment();
  const stats = characterStatsForLevel(jobId, 1, equipment, []);

  return {
    id: rngUuid() as CharacterId,
    name,
    level: 1,
    xp: {
      current: 0,
      maximum: characterXpForLevel(1),
    },
    jobId,
    jobProgress: {},
    combatOrders: {},
    teachings: {},
    hp: stats.Health,
    ep: stats.Energy,
    stats,
    equipment,
  };
}

// Party-wide passive affix effects (GatherYield, CaravanBuyDiscount, etc.) from every hero's equipped gear, regardless of who's "doing" the action.
export function partyAffixEffects(): AffixEffect[] {
  return worldPartyState().flatMap((character) =>
    equipmentAffixEffects(character.equipment),
  );
}

// Base + infusion + affix gather yield bonuses across the whole party's equipped gear.
export function partyGatherYieldBonuses(): GatherYieldBonus[] {
  return worldPartyState().flatMap((character) =>
    equipmentGatherYieldBonuses(character.equipment),
  );
}

export function isPartyAtFullHealth(): boolean {
  return worldPartyState().every(
    (character) => character.hp >= character.stats.Health,
  );
}

export function isPartyAtFullEnergy(): boolean {
  return worldPartyState().every(
    (character) => character.ep >= character.stats.Energy,
  );
}

export function setParty(party: Character[]): void {
  updateGamestate((state) => {
    state.world.party = party;
    return state;
  });
}

// Recalculates stats/hp/ep after pruning, since it can shrink max Health/Energy.
export function pruneInvalidPartyEquipment(party: Character[]): Character[] {
  return party.map((character) => {
    const equipment = pruneInvalidEquippedItems(character.equipment);
    const stats = characterStatsForLevel(
      character.jobId,
      character.level,
      equipment,
      characterAllTeachingIds(character),
    );

    return {
      ...character,
      equipment,
      stats,
      hp: clamp(character.hp, 0, stats.Health),
      ep: clamp(character.ep, 0, stats.Energy),
    };
  });
}
