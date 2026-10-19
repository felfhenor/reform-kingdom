import { combatOrdersFromJobDefaults } from '@helpers/combat/combat-order';
import {
  CHARACTER_MAX_LEVEL,
  CHARACTER_XP_END,
  CHARACTER_XP_START,
  XP_CURVE_EASE,
} from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { defaultEquipment, defaultStats } from '@helpers/defaults';
import { roundToNearest10 } from '@helpers/engine/number';
import { characterNonGearEffects } from '@helpers/hero/hero-effect';
import { characterSkillTreeSeeded } from '@helpers/hero/skill-tree-content';
import { affixEffectSum } from '@helpers/item/affix';
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
  EquipmentTypeToSlot,
  type AffixEffect,
  type Character,
  type CharacterId,
  type CharacterStatSource,
  type EquipmentBlock,
  type EquipmentContent,
  type GatherYieldBonus,
  type HeroEffect,
  type JobContent,
  type JobId,
  type StatBlock,
} from '@interfaces';
import { clamp } from 'es-toolkit/compat';

// `progress ** 1.5` eases in gently at low levels instead of a straight line's constant step dominating a tiny starting value.
export function characterXpForLevel(level: number): number {
  const progress = (level - 1) / (CHARACTER_MAX_LEVEL - 1);
  const xp =
    CHARACTER_XP_START +
    (CHARACTER_XP_END - CHARACTER_XP_START) * progress ** XP_CURVE_EASE;
  return roundToNearest10(xp);
}

function jobStatsAtLevel(
  jobId: JobId,
  level: number,
  effects: HeroEffect[],
): StatBlock {
  const job = getEntry<JobContent>(jobId);
  const stats = { ...(job?.baseStats ?? defaultStats()) };
  const perLevel = job?.statsPerLevel ?? defaultStats();

  (Object.keys(stats) as Array<keyof StatBlock>).forEach((stat) => {
    const growth =
      perLevel[stat] +
      affixEffectSum(effects, 'StatPerLevel', (effect) => effect.stat === stat);
    stats[stat] += growth * (level - 1);
  });

  return stats;
}

export function characterStatsForLevel(
  jobId: JobId,
  level: number,
  equipment: EquipmentBlock,
  effects: HeroEffect[],
): StatBlock {
  const stats = jobStatsAtLevel(jobId, level, effects);
  const equipmentStats = affixEffectsAddToBlock(
    equipmentStatTotals(equipment),
    effects,
    STAT_BONUS,
  );

  // Floored at 1 - a stat at or below 0 (Health/Energy especially) breaks max-pool clamping downstream.
  (Object.keys(stats) as Array<keyof StatBlock>).forEach((stat) => {
    stats[stat] = clamp(stats[stat] + equipmentStats[stat], 1, Infinity);
  });

  return stats;
}

export function characterStats(character: CharacterStatSource): StatBlock {
  return characterStatsForLevel(
    character.jobId,
    character.level,
    character.equipment,
    characterNonGearEffects(character),
  );
}

// Clamps current hp/ep to the recomputed max, since a change can shrink max Health/Energy.
export function characterRecalculateStats(character: Character): Character {
  const stats = characterStats(character);

  return {
    ...character,
    stats,
    hp: clamp(character.hp, 0, stats.Health),
    ep: clamp(character.ep, 0, stats.Energy),
  };
}

function equipStarterItem(
  equipment: EquipmentBlock,
  content: EquipmentContent,
): void {
  const item = newEquipmentItem(content.id);
  EquipmentTypeToSlot[content.type].forEach((slot) => (equipment[slot] = item));
}

function starterEquipment(jobId: JobId): EquipmentBlock {
  const equipment = defaultEquipment();
  const job = getEntry<JobContent>(jobId);
  (job?.starterEquipmentIds ?? [])
    .map((equipmentId) => getEntry<EquipmentContent>(equipmentId))
    .filter((content): content is EquipmentContent => !!content)
    .forEach((content) => equipStarterItem(equipment, content));

  return equipment;
}

export function createCharacter(name: string, jobId: JobId): Character {
  const equipment = starterEquipment(jobId);
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
    combatOrders: { [jobId]: combatOrdersFromJobDefaults(jobId) },
    teachings: {},
    ...characterSkillTreeSeeded(
      { skillTreeNodes: {}, skillTreeVersions: {} },
      jobId,
    ),
    burstSkills: {},
    currentRegaliaIds: {},
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

export function pruneInvalidPartyEquipment(party: Character[]): Character[] {
  return party.map((character) =>
    characterRecalculateStats({
      ...character,
      equipment: pruneInvalidEquippedItems(character.equipment),
    }),
  );
}
