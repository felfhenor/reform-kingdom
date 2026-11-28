import { contentName } from '@helpers/i18n/i18n-content';
import { t } from '@helpers/i18n/i18n';
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
      combatMessageLog(
        combat,
        t('combatSkillElements.beginsCharging', {
          name,
          name2: contentName(skill),
        }),
      );
    }
    return;
  }

  const costs = skillElementCosts(skill);
  elementPoolPay(combat, costs);

  const spent = elementBlockText(costs);
  combatMessageLog(
    combat,
    delayed
      ? t('combatSkillElements.beginsChargingConsuming', {
          name,
          name2: contentName(skill),
          spent,
        })
      : t('combatSkillElements.channels', { name, spent }),
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
