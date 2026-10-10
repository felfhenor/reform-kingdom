import { skillIsSpecial } from '@helpers/hero/skill';
import { rngChoice, rngChoiceWeighted } from '@helpers/rng';
import type { Combatant, EquipmentSkill } from '@interfaces';

// Monsters (incl. raid guardians and summons) fire an affordable special before the weighted roll.
export function combatantPickSkill(
  combatant: Combatant,
  skills: EquipmentSkill[],
): EquipmentSkill | undefined {
  const specials = combatant.monsterId ? skills.filter(skillIsSpecial) : [];
  if (specials.length > 0) return rngChoice(specials);

  return rngChoiceWeighted(
    skills,
    (skill) => combatant.skillWeights[skill.id] ?? 1,
  );
}
