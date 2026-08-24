import { getEntry } from '@helpers/content';
import { defaultEquipment, defaultStats } from '@helpers/defaults';
import { roundToNearest10 } from '@helpers/engine/number';
import {
  equipmentStatTotals,
  pruneInvalidEquippedItems,
} from '@helpers/item/equipment';
import { rngUuid } from '@helpers/rng';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  Character,
  CharacterId,
  EquipmentBlock,
  EquipmentContent,
  EquipmentId,
  EquipmentItem,
  EquipmentItemId,
  JobContent,
  JobId,
  StatBlock,
} from '@interfaces';
import { clamp } from 'es-toolkit/compat';

export const CHARACTER_MAX_LEVEL = 99;
const XP_START = 100;
const XP_END = XP_START * 1000;
const XP_CURVE_EASE = 1.5;
const STARTER_ARMOR_NAME = 'Cloak of Adventuring';
const STARTER_HAT_NAME = 'Hat of Adventuring';

// `progress ** 1.5` eases in gently at low levels instead of a straight line's constant step dominating a tiny starting value.
export function characterXpForLevel(level: number): number {
  const progress = (level - 1) / (CHARACTER_MAX_LEVEL - 1);
  const xp = XP_START + (XP_END - XP_START) * progress ** XP_CURVE_EASE;
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

// Equipment stat bonuses are flat (no per-level scaling on gear).
export function characterStatsForLevel(
  jobId: JobId,
  level: number,
  equipment: EquipmentBlock,
): StatBlock {
  const stats = jobStatsAtLevel(jobId, level);
  const equipmentStats = equipmentStatTotals(equipment);

  (Object.keys(stats) as Array<keyof StatBlock>).forEach((stat) => {
    stats[stat] += equipmentStats[stat];
  });

  return stats;
}

export function newEquipmentItem(equipmentId: EquipmentId): EquipmentItem {
  return {
    id: rngUuid() as EquipmentItemId,
    equipmentId,
    infusedItemIds: [],
  };
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
  const stats = characterStatsForLevel(jobId, 1, equipment);

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
    hp: stats.Health,
    ep: stats.Energy,
    stats,
    equipment,
  };
}

export function partyGet(): Character[] {
  return gamestate().world.party;
}

export function isPartyAtFullHealth(): boolean {
  return partyGet().every(
    (character) => character.hp >= character.stats.Health,
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
