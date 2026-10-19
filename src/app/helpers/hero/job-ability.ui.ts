import { getEntry } from '@helpers/content/content';
import type {
  Character,
  DropRarity,
  JobAbilityContent,
  JobAbilityId,
  JobAbilityRank,
  JobAbilityRow,
  JobAbilityType,
  JobContent,
} from '@interfaces';
import { ROMAN_NUMERAL_REVERSE } from '@interfaces';
import { clamp, findLast, sortBy } from 'es-toolkit/compat';

// Indexed by tier - 1; tiers past the end reuse the last rarity.
const JOB_ABILITY_TIER_RARITIES: DropRarity[] = ['Common', 'Uncommon'];

const percent = (value: number) => `${Math.round(value * 100)}%`;

// How a rank's raw value reads to the player, per ability type.
const JOB_ABILITY_VALUE_LABELS: Record<
  JobAbilityType,
  (value: number) => string
> = {
  RestoreHealthOOC: (value) => `${value}x CON per second`,
  RestoreEnergyOOC: (value) => `${value}x SPR per second`,
  ShrineDurationBoost: (value) => `+${percent(value)} duration`,
  CommissionReputationBoost: (value) => `+${percent(value)} reputation`,
  AstralDurationBoost: (value) => `+${percent(value)} duration`,
  EncounterResetReduction: (value) => `-${percent(value)} reset time`,
  OnPathTravelSpeed: (value) => `+${percent(value)} on-path speed`,
  OffPathTravelSpeed: (value) => `+${percent(value)} off-path speed`,
  Intimidation: (value) =>
    `Enemies surrender when ${Math.abs(value)}+ levels under`,
  Ambush: (value) => `${value}% chance`,
  GatherYieldLuck: (value) => `${value}x LUK chance`,
  EquipmentDropRateBoost: (value) => `+${value}% equipment drop rate`,
  ItemDropRateBoost: (value) => `+${value}% item drop rate`,
};

export function jobAbilityValueLabel(
  ability: JobAbilityContent,
  value: number,
): string {
  return JOB_ABILITY_VALUE_LABELS[ability.type]?.(value) ?? `${value}`;
}

// A not-yet-unlocked ability (tier 0) shows its bare name at the first tier's rarity.
function jobAbilityRow(
  ability: JobAbilityContent,
  sortedRanks: JobAbilityRank[],
  level: number,
): JobAbilityRow {
  const current = findLast(sortedRanks, (rank) => rank.level <= level);
  const tier = current ? sortedRanks.indexOf(current) + 1 : 0;
  const rarityIndex = clamp(tier - 1, 0, JOB_ABILITY_TIER_RARITIES.length - 1);

  return {
    ability,
    name:
      tier > 0
        ? `${ability.name} ${ROMAN_NUMERAL_REVERSE[tier]}`
        : ability.name,
    sprite: ability.sprite,
    rarity: JOB_ABILITY_TIER_RARITIES[rarityIndex],
    current,
    next: sortedRanks.find((rank) => rank.level > level),
  };
}

// Every ability the hero's job lists, with the rank they hold now (if any) and the next one to unlock.
export function characterJobAbilityRows(
  character: Pick<Character, 'jobId' | 'level'>,
): JobAbilityRow[] {
  const job = getEntry<JobContent>(character.jobId);
  if (!job) return [];

  const ranksById = new Map<JobAbilityId, JobAbilityRank[]>();
  job.abilities.forEach(({ jobAbilityId, level, value }) => {
    ranksById.set(jobAbilityId, [
      ...(ranksById.get(jobAbilityId) ?? []),
      { level, value },
    ]);
  });

  return [...ranksById.entries()]
    .map(([jobAbilityId, ranks]) => {
      const ability = getEntry<JobAbilityContent>(jobAbilityId);
      if (!ability) return undefined;

      const sorted = sortBy(ranks, (rank) => rank.level);
      return jobAbilityRow(ability, sorted, character.level);
    })
    .filter((row): row is JobAbilityRow => !!row);
}
