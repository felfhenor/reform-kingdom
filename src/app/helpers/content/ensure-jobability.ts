import type {
  JobAbilityContent,
  JobAbilityId,
  JobAbilityType,
} from '@interfaces';

export function ensureJobAbility(
  ability: Partial<JobAbilityContent>,
): Required<JobAbilityContent> {
  return {
    id: ability.id ?? ('UNKNOWN' as JobAbilityId),
    name: ability.name ?? 'UNKNOWN',
    __type: 'jobability',
    description: ability.description ?? 'UNKNOWN',
    sprite: ability.sprite ?? 'UNKNOWN',
    // Not coerced to a valid type, so validate:jobabilities can flag typos.
    type: ability.type ?? ('UNKNOWN' as JobAbilityType),
  };
}
