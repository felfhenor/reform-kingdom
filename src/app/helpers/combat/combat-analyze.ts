import { techniqueHasAttribute } from '@helpers/combat/combat-damage-amount';
import {
  combatantMessageToken,
  combatMessageLog,
} from '@helpers/combat/combat-log';
import { monsterRecordAnalyze } from '@helpers/kingdom/bestiary';
import type {
  Combat,
  Combatant,
  EquipmentSkillContentTechnique,
  MonsterId,
} from '@interfaces';

// Monsters cast analyzing skills too, so only a hero-side caster scanning an enemy monster counts.
export function combatAnalyzeTarget(
  combat: Combat,
  caster: Combatant,
  target: Combatant,
  technique: EquipmentSkillContentTechnique,
): void {
  if (!techniqueHasAttribute(technique, 'Analyzes')) return;
  if (caster.isEnemy || !target.isEnemy || !target.monsterId) return;

  const monsterId = target.monsterId as MonsterId;
  if (!monsterRecordAnalyze(monsterId, target.level, combat.locationName)) {
    return;
  }

  combatMessageLog(
    combat,
    `**${combatantMessageToken(caster)}** learned the strengths and weaknesses of **${combatantMessageToken(target)}**!`,
  );
}
