import {
  combatMessageLog,
  combatantMessageToken,
} from '@helpers/combat/combat-log';
import {
  combatApplyStatusEffectToTarget,
  combatCreateStatusEffect,
  statusEffectTagResistance,
} from '@helpers/combat/combat-statuseffects';
import { getEntry } from '@helpers/content/content';
import { luckReducedChance } from '@helpers/hero/luck';
import {
  skillTechniqueStatusEffectChance,
  skillTechniqueStatusEffectDuration,
} from '@helpers/hero/skill';
import { rngSucceedsChance } from '@helpers/rng';
import type {
  Combat,
  Combatant,
  DebuffPotency,
  EquipmentSkill,
  EquipmentSkillTechniqueStatusEffectApplication,
  StatBlock,
  StatusEffectContent,
} from '@interfaces';

function combatantDebuffPotency(
  caster: Combatant,
  effect: StatusEffectContent,
): DebuffPotency {
  return effect.effectType === 'Debuff' && caster.debuffPotency
    ? caster.debuffPotency
    : { chance: 0, duration: 0 };
}

// Luck and gear only shrug off harm: a buff lands at its own chance.
function statusEffectLandChance(
  chance: number,
  effect: StatusEffectContent,
  target: Combatant,
): number {
  return effect.effectType === 'Buff'
    ? chance
    : luckReducedChance(chance, target.totalStats.Luck);
}

// A separate roll from the LUK one, so gear resistance doesn't multiply into it.
function combatTargetResistsStatusEffect(
  combat: Combat,
  target: Combatant,
  effect: StatusEffectContent,
): boolean {
  if (effect.effectType === 'Buff') return false;

  const tagResistance = statusEffectTagResistance(target, effect.tags);
  if (tagResistance <= 0 || !rngSucceedsChance(tagResistance)) return false;

  combatMessageLog(
    combat,
    `**${effect.name}** is resisted by **${combatantMessageToken(target)}**!`,
    target,
  );
  return true;
}

export function combatTryApplyTechniqueStatusEffect(
  combat: Combat,
  caster: Combatant,
  target: Combatant,
  skill: EquipmentSkill,
  application: EquipmentSkillTechniqueStatusEffectApplication,
  capturedCreatorStats?: StatBlock,
): void {
  const effect = getEntry<StatusEffectContent>(application.statusEffectId);
  if (!effect) return;

  const potency = combatantDebuffPotency(caster, effect);
  const chance =
    skillTechniqueStatusEffectChance(skill, application) + potency.chance;
  if (!rngSucceedsChance(statusEffectLandChance(chance, effect, target))) {
    return;
  }
  if (combatTargetResistsStatusEffect(combat, target, effect)) return;

  const duration =
    skillTechniqueStatusEffectDuration(skill, application) + potency.duration;
  const statusEffect = combatCreateStatusEffect(
    effect,
    skill,
    caster,
    target,
    { duration },
    capturedCreatorStats,
  );
  combatApplyStatusEffectToTarget(combat, target, statusEffect);
}
