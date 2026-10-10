import {
  elementBlockText,
  elementPoolFill,
  elementPoolPay,
} from '@helpers/combat/combat-element-pool';
import {
  combatantMessageToken,
  combatMessageLog,
} from '@helpers/combat/combat-log';
import { combatantStartSkillCooldown } from '@helpers/combat/combat-skill-cooldown';
import {
  skillElementCosts,
  skillElements,
  skillHasElementCosts,
} from '@helpers/hero/skill';
import type { Combat, Combatant, EquipmentSkill } from '@interfaces';

// Runs on the cast turn, so a delayed skill pays up front and keeps its cost if the caster dies before release.
export function combatantPaySkillCast(
  combat: Combat,
  combatant: Combatant,
  skill: EquipmentSkill,
): void {
  combatantStartSkillCooldown(combatant, skill);

  const delayed = skill.delay > 0;
  const name = `**${combatantMessageToken(combatant)}**`;
  if (!skillHasElementCosts(skill)) {
    if (delayed) {
      combatMessageLog(combat, `${name} begins charging **${skill.name}**!`);
    }
    return;
  }

  const costs = skillElementCosts(skill);
  elementPoolPay(combat, costs);

  const spent = elementBlockText(costs);
  combatMessageLog(
    combat,
    delayed
      ? `${name} begins charging **${skill.name}**, consuming ${spent}!`
      : `${name} channels ${spent}!`,
  );
}

// Skills that spend charges don't also refill them.
export function combatFillSkillElements(
  combat: Combat,
  skill: EquipmentSkill,
): void {
  if (skillHasElementCosts(skill)) return;
  elementPoolFill(combat, skillElements(skill));
}
