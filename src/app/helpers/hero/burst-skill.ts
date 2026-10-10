import { HERO_BURST_SKILL_SLOTS } from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { skillIsSpecial } from '@helpers/hero/skill';
import type {
  Character,
  EquipmentSkillContent,
  EquipmentSkillId,
  JobContent,
  JobId,
} from '@interfaces';
import { uniq } from 'es-toolkit/compat';

function burstSkillIdFor(ref: string): EquipmentSkillId[] {
  const skill = getEntry<EquipmentSkillContent>(ref);
  return skill?.__type === 'skill' && skillIsSpecial(skill) ? [skill.id] : [];
}

// A skill the hero can't currently use is kept, so re-equipping the granting gear restores the choice.
export function pruneInvalidBurstSkills(
  burstSkills: Character['burstSkills'] | undefined,
): Character['burstSkills'] {
  const pruned: Character['burstSkills'] = {};

  (Object.keys(burstSkills ?? {}) as JobId[]).forEach((jobId) => {
    if (!getEntry<JobContent>(jobId)) return;

    const valid = uniq(
      (burstSkills?.[jobId] ?? []).flatMap(burstSkillIdFor),
    ).slice(0, HERO_BURST_SKILL_SLOTS);
    if (valid.length > 0) pruned[jobId] = valid;
  });

  return pruned;
}
