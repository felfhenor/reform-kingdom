import {
  combatantMessageToken,
  combatMessageLog,
} from '@helpers/combat/combat-log';
import {
  combatantSkills,
  combatAvailableSkillsForCombatant,
  combatGetPossibleCombatantTargetsForSkillTechnique,
} from '@helpers/combat/combat-targetting';
import { autoModeIsEnabled } from '@helpers/decree/auto-mode-state';
import { skillOwnTechniques } from '@helpers/hero/skill-modifier';
import { regionForMap } from '@helpers/lore/region-intro';
import { rngShuffle } from '@helpers/rng';
import {
  globalEffectSumsState,
  runStatsState,
  worldCurrentLocationState,
} from '@helpers/state-game';
import type {
  Combat,
  Combatant,
  CombatOrderPick,
  EquipmentSkill,
} from '@interfaces';

export function regionIsSealed(mapName: string): boolean {
  const region = regionForMap(mapName);
  return !region || runStatsState().seals[region.id] !== undefined;
}

export function combatAutomationAllowedAt(mapName: string): boolean {
  return (
    !globalEffectSumsState().requireSealForDecreeAutomation ||
    regionIsSealed(mapName)
  );
}

// Only Decree fights on a sealed map play themselves.
export function combatIsManual(): boolean {
  return (
    globalEffectSumsState().manualCombat &&
    !(
      autoModeIsEnabled() &&
      combatAutomationAllowedAt(worldCurrentLocationState().mapName)
    )
  );
}

export function combatantTakesOrders(
  combat: Combat,
  combatant: Combatant,
): boolean {
  return (
    !combatant.summonerId &&
    combat.heroes.includes(combatant) &&
    combatIsManual()
  );
}

// Ignores confusion and redirection, which are only rolled when the skill is cast.
export function combatManualSkillUsable(
  combat: Combat,
  hero: Combatant,
  skill: EquipmentSkill,
): boolean {
  return (
    combatAvailableSkillsForCombatant(combat, hero).includes(skill) &&
    skillOwnTechniques(skill).some(
      (tech) =>
        combatGetPossibleCombatantTargetsForSkillTechnique(
          combat,
          hero,
          skill,
          tech,
          false,
        ).length > 0,
    )
  );
}

// A hero with nothing usable, or a fleeing party, plays the turn out without asking.
export function combatManualNeedsOrders(
  combat: Combat,
  combatant: Combatant,
): boolean {
  return (
    !combat.manualFlee &&
    combatantTakesOrders(combat, combatant) &&
    combatantSkills(combatant).some((s) =>
      combatManualSkillUsable(combat, combatant, s),
    )
  );
}

export function combatManualAwaitingOrders(combat: Combat): boolean {
  return (
    !!combat.turnQueue?.[0]?.awaitingOrders &&
    !combat.manualAction &&
    !combat.manualFlee &&
    combatIsManual()
  );
}

function combatantLosesTurn(
  combat: Combat,
  combatant: Combatant,
  why: string,
): undefined {
  combatMessageLog(
    combat,
    `**${combatantMessageToken(combatant)}** ${why} and loses the turn!`,
  );
  return undefined;
}

// A fleeing party gets out once the round ends with a hero standing and enemies left.
export function combatManualEscaped(combat: Combat): boolean {
  return (
    !!combat.manualFlee &&
    combat.heroes.some((c) => !c.summonerId && c.hp > 0) &&
    combat.guardians.some((c) => c.hp > 0)
  );
}

// The chosen target leads the match list; the shuffled rest fills any extra targets at random.
export function combatManualPick(
  combat: Combat,
  combatant: Combatant,
  skills: EquipmentSkill[],
): CombatOrderPick | undefined {
  if (combat.manualFlee) return undefined;
  const action = combat.manualAction;
  if (!action) return combatantLosesTurn(combat, combatant, 'has no orders');

  const skill = skills.find((s) => s.id === action.skillId);
  if (!skill) {
    const name =
      combatantSkills(combatant).find((s) => s.id === action.skillId)?.name ??
      'their skill';
    return combatantLosesTurn(combat, combatant, `couldn't use **${name}**`);
  }

  const everyone = [...combat.heroes, ...combat.helpers, ...combat.guardians];
  const target = everyone.find((c) => c.id === action.targetId);
  const others = rngShuffle(everyone.filter((c) => c !== target));
  return {
    skill,
    targetMode: 'MatchingEnemies',
    matchingCombatants: target ? [target, ...others] : others,
  };
}
