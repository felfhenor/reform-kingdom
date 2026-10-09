import type {
  Combatant,
  CombatantDelayedSkill,
  CombatOrderPick,
  EquipmentSkill,
} from '@interfaces';

// Matching* overrides can't be replayed without their cast-time matches.
export function combatantQueueDelayedSkill(
  combatant: Combatant,
  skill: EquipmentSkill,
  combatOrderPick?: CombatOrderPick,
): void {
  const targetMode = combatOrderPick?.targetMode;
  const keepsTargetMode =
    targetMode !== 'MatchingAllies' && targetMode !== 'MatchingEnemies';

  combatant.delayedSkills ??= [];
  combatant.delayedSkills.push({
    skill,
    turnsRemaining: skill.delay,
    targetMode: keepsTargetMode ? targetMode : undefined,
    targetCharacterId: combatOrderPick?.targetCharacterId,
  });
}

export function combatantAdvanceDelayedSkills(
  combatant: Combatant,
): CombatantDelayedSkill[] {
  const pending = combatant.delayedSkills ?? [];
  if (pending.length === 0) return [];

  pending.forEach((entry) => entry.turnsRemaining--);

  combatant.delayedSkills = pending.filter((entry) => entry.turnsRemaining > 0);
  return pending.filter((entry) => entry.turnsRemaining <= 0);
}

export function combatantClearDelayedSkills(combatant: Combatant): void {
  combatant.delayedSkills = [];
}
