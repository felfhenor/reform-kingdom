import { DEBUFF_POTENCY_PER_RANK } from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { characterJobAbilities } from '@helpers/hero/job-ability';
import {
  skillTreeJobNodes,
  skillTreeNodeLevel,
} from '@helpers/hero/skill-tree-content';
import type {
  Character,
  DropRarity,
  JobAbilityContent,
  JobAbilityId,
  JobAbilityRank,
  JobAbilityRow,
  JobAbilityType,
  SkillTreeNodeContent,
} from '@interfaces';
import { ROMAN_NUMERAL_REVERSE } from '@interfaces';
import { clamp, sortBy } from 'es-toolkit/compat';

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
  SkillRepeatChance: (value) => `+${value}% skill repeat chance`,
  CoverChance: (value) => `${value}% chance to cover an ally`,
  DebuffPotency: (value) => {
    const turns = value * DEBUFF_POTENCY_PER_RANK.duration;
    return `+${value * DEBUFF_POTENCY_PER_RANK.chance}% debuff chance, +${turns} turn${turns === 1 ? '' : 's'}`;
  },
};

export function jobAbilityValueLabel(
  ability: JobAbilityContent,
  value: number,
): string {
  return JOB_ABILITY_VALUE_LABELS[ability.type]?.(value) ?? `${value}`;
}

function jobAbilityRow(
  ability: JobAbilityContent,
  tier: number,
  current: JobAbilityRank,
  next: JobAbilityRank | undefined,
): JobAbilityRow {
  const rarityIndex = clamp(tier - 1, 0, JOB_ABILITY_TIER_RARITIES.length - 1);

  return {
    ability,
    name: `${ability.name} ${ROMAN_NUMERAL_REVERSE[tier]}`,
    sprite: ability.sprite,
    rarity: JOB_ABILITY_TIER_RARITIES[rarityIndex],
    current,
    next,
  };
}

function nodeAbilityValue(
  node: SkillTreeNodeContent,
  abilityId: JobAbilityId,
): number | undefined {
  return node.effects.flatMap((effect) =>
    effect.kind === 'JobAbility' &&
    getEntry<JobAbilityContent>(effect.jobAbilityId)?.id === abilityId
      ? [effect.value]
      : [],
  )[0];
}

function abilityRankNodes(
  nodes: SkillTreeNodeContent[],
  abilityId: JobAbilityId,
): SkillTreeNodeContent[] {
  return sortBy(
    nodes.filter((node) => nodeAbilityValue(node, abilityId) !== undefined),
    (node) => skillTreeNodeLevel(nodes, node),
  );
}

// Each ability the hero holds; its tier and next rank come from the current job's tree.
export function characterJobAbilityRows(
  character: Pick<
    Character,
    'jobId' | 'teachings' | 'skillTreeNodes' | 'debugEffects'
  >,
): JobAbilityRow[] {
  const learned = new Set(character.skillTreeNodes?.[character.jobId] ?? []);
  const nodes = skillTreeJobNodes(character.jobId);
  const levelOf = (node?: SkillTreeNodeContent) =>
    node ? skillTreeNodeLevel(nodes, node) : 0;

  return characterJobAbilities(character).map(({ ability, value }) => {
    const ranks = abilityRankNodes(nodes, ability.id);
    const learnedCount = ranks.filter((node) => learned.has(node.id)).length;
    const nextNode = ranks[learnedCount];

    return jobAbilityRow(
      ability,
      Math.max(learnedCount, 1),
      { level: levelOf(ranks[learnedCount - 1]), value },
      nextNode
        ? {
            level: levelOf(nextNode),
            value: nodeAbilityValue(nextNode, ability.id) ?? 0,
          }
        : undefined,
    );
  });
}
