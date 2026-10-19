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
  JobContent,
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
  CombatDropRateBoost: { stacking: 'Highest', amount: 'Value' },
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

function jobAbilityRankValues(
  character: Pick<Character, 'jobId' | 'level'>,
): Map<JobAbilityId, number> {
  const ranks = new Map<JobAbilityId, { level: number; value: number }>();
  getEntry<JobContent>(character.jobId)?.abilities.forEach(
    ({ jobAbilityId, level, value }) => {
      if (level > character.level) return;

      const current = ranks.get(jobAbilityId);
      if (!current || level > current.level) {
        ranks.set(jobAbilityId, { level, value });
      }
    },
  );

  return new Map([...ranks].map(([id, { value }]) => [id, value]));
}

// Job ranks pick the highest reached level; granted effects only win when their value is higher.
export function characterJobAbilities(
  character: Pick<Character, 'jobId' | 'level' | 'teachings' | 'debugEffects'>,
): CharacterJobAbility[] {
  const values = jobAbilityRankValues(character);
  affixEffectsOfKind(characterNonGearEffects(character), 'JobAbility').forEach(
    ({ jobAbilityId, value }) => {
      // Resolved so a grant by name merges with the job's id-keyed rank.
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
