import { computed } from '@angular/core';
import { getEntry } from '@helpers/content/content';
import { characterNonGearEffects } from '@helpers/hero/hero-effect';
import { affixEffectsOfKind } from '@helpers/item/affix';
import { worldPartyState } from '@helpers/state-game';
import type {
  Character,
  GameStat,
  JobAbilityContent,
  JobAbilityId,
  JobAbilityType,
} from '@interfaces';
import { maxBy, sumBy } from 'es-toolkit/compat';
import { current, isDraft } from 'immer';

type JobAbilityRule =
  | { stacking: 'Sum' | 'Highest'; amount: 'Value' | 'LevelOffset' }
  | { stacking: 'Sum' | 'Highest'; amount: 'Stat'; stat: GameStat };

// The one place that knows how each ability type stacks, so no hook has to.
const JOB_ABILITY_RULES: Record<JobAbilityType, JobAbilityRule> = {
  RestoreHealthOOC: { stacking: 'Sum', amount: 'Stat', stat: 'Constitution' },
  RestoreEnergyOOC: { stacking: 'Sum', amount: 'Stat', stat: 'Spirit' },
  GatherYieldLuck: { stacking: 'Highest', amount: 'Stat', stat: 'Luck' },
  Intimidation: { stacking: 'Highest', amount: 'LevelOffset' },
  ShrineDurationBoost: { stacking: 'Highest', amount: 'Value' },
  CommissionReputationBoost: { stacking: 'Highest', amount: 'Value' },
  AstralDurationBoost: { stacking: 'Highest', amount: 'Value' },
  EncounterResetReduction: { stacking: 'Highest', amount: 'Value' },
  OnPathTravelSpeed: { stacking: 'Highest', amount: 'Value' },
  OffPathTravelSpeed: { stacking: 'Highest', amount: 'Value' },
  Ambush: { stacking: 'Highest', amount: 'Value' },
  EquipmentDropRateBoost: { stacking: 'Highest', amount: 'Value' },
  ItemDropRateBoost: { stacking: 'Highest', amount: 'Value' },
  // Per-hero: combat reads the owner's own rank, never the party value.
  SkillRepeatChance: { stacking: 'Highest', amount: 'Value' },
  CoverChance: { stacking: 'Highest', amount: 'Value' },
  DebuffPotency: { stacking: 'Highest', amount: 'Value' },
};

type JobAbilityPartyEntry = {
  character: Character;
  value: number;
  amount: number;
};

export type CharacterJobAbility = {
  ability: JobAbilityContent;
  value: number;
};

// Every JobAbility grant (tree nodes, teachings, debug) at its highest value; ranks of one ability never stack.
export function characterJobAbilities(
  character: Pick<
    Character,
    'jobId' | 'teachings' | 'skillTreeNodes' | 'debugEffects'
  >,
): CharacterJobAbility[] {
  const values = new Map<JobAbilityId, number>();
  affixEffectsOfKind(characterNonGearEffects(character), 'JobAbility').forEach(
    ({ jobAbilityId, value }) => {
      // Resolved so a grant by name merges with one by id.
      const id = getEntry<JobAbilityContent>(jobAbilityId)?.id;
      if (!id) return;

      const current = values.get(id);
      values.set(id, current === undefined ? value : Math.max(current, value));
    },
  );

  return [...values.entries()]
    .map(([jobAbilityId, value]) => ({
      ability: getEntry<JobAbilityContent>(jobAbilityId),
      value,
    }))
    .filter((entry): entry is CharacterJobAbility => !!entry.ability);
}

// 0 if the hero lacks it.
export function characterJobAbilityValue(
  character: Pick<
    Character,
    'jobId' | 'teachings' | 'skillTreeNodes' | 'debugEffects'
  >,
  type: JobAbilityType,
): number {
  return (
    characterJobAbilities(character).find(
      ({ ability }) => ability.type === type,
    )?.value ?? 0
  );
}

function jobAbilityAmount(
  rule: JobAbilityRule,
  character: Character,
  value: number,
): number {
  switch (rule.amount) {
    case 'Value':
      return value;
    case 'Stat':
      return character.stats[rule.stat] * value;
    case 'LevelOffset':
      return character.level + value;
  }
}

const partyJobAbilityEntries = computed(() => {
  const byType: Partial<Record<JobAbilityType, JobAbilityPartyEntry[]>> = {};

  // Read inside an update callback, the party is a draft that's revoked once the callback ends - cache a snapshot instead.
  const party = worldPartyState();
  const snapshot = isDraft(party) ? current(party) : party;

  snapshot.forEach((character) => {
    characterJobAbilities(character).forEach(({ ability, value }) => {
      const rule = JOB_ABILITY_RULES[ability.type];
      if (!rule) return;

      byType[ability.type] ??= [];
      byType[ability.type]?.push({
        character,
        value,
        amount: jobAbilityAmount(rule, character, value),
      });
    });
  });

  return byType;
});

const partyJobAbilityValues = computed(() => {
  const entriesByType = partyJobAbilityEntries();
  const values: Partial<Record<JobAbilityType, number>> = {};

  (Object.keys(entriesByType) as JobAbilityType[]).forEach((type) => {
    const entries = entriesByType[type] ?? [];
    if (entries.length === 0) return;

    // Summed types floor once at the end, so two 1.5s make 3 rather than 2.
    values[type] =
      JOB_ABILITY_RULES[type].stacking === 'Sum'
        ? Math.floor(sumBy(entries, (entry) => entry.amount))
        : Math.max(...entries.map((entry) => entry.amount));
  });

  return values;
});

// The party's aggregated value for `type`, with the type's stacking rule applied. 0 if nobody has it.
export function jobAbilityValue(type: JobAbilityType): number {
  return partyJobAbilityValues()[type] ?? 0;
}

// One entry per party member who has an ability of `type`, at their current rank.
export function jobAbilityEntries(
  type: JobAbilityType,
): { character: Character; value: number }[] {
  return (partyJobAbilityEntries()[type] ?? []).map(({ character, value }) => ({
    character,
    value,
  }));
}

// The single best contributor and their computed amount, for log lines that name the hero.
export function jobAbilityHighest(
  type: JobAbilityType,
): { character: Character; amount: number } | undefined {
  const best = maxBy(partyJobAbilityEntries()[type] ?? [], 'amount');
  return best ? { character: best.character, amount: best.amount } : undefined;
}
