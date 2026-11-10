import { signal } from '@angular/core';
import { orderCombatantsByAgility } from '@helpers/combat/combat';
import { combatantHealthBar } from '@helpers/combat/combat-combatant-hp.ui';
import {
  combatAutomationAllowedAt,
  combatIsManual,
} from '@helpers/combat/combat-manual';
import { combatantSkillOnCooldown } from '@helpers/combat/combat-skill-cooldown';
import { combatCombatantSkillEpCost } from '@helpers/combat/combat-stats';
import { combatantStatusEffectPreviews } from '@helpers/combat/combat-statuseffects.ui';
import {
  combatantSkills,
  combatAvailableSkillsForCombatant,
  combatGetPossibleCombatantTargetsForSkillTechnique,
} from '@helpers/combat/combat-targetting';
import { getEntry } from '@helpers/content/content';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { skillTechniqueNumTargets } from '@helpers/hero/skill';
import { skillOwnTechniques } from '@helpers/hero/skill-modifier';
import { regionForMap } from '@helpers/lore/region-intro';
import { updateGamestate, worldCombatState } from '@helpers/state-game';
import type {
  Combat,
  Combatant,
  CombatLogIcon,
  CombatManualAction,
  CombatManualOrder,
  CombatManualSkillOption,
  EncounterContent,
  EncounterRandomContent,
  EquipmentSkill,
  EquipmentSkillContentTechnique,
  JobContent,
  StatusCardBar,
  StatusCardEntry,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

// Held open after a manual fight ends, so its rewards can be read before closing.
export const combatManualOverlayOpen = signal(false);

export function combatManualOverlayVisible(): boolean {
  return (
    (!!worldCombatState() && combatIsManual()) || combatManualOverlayOpen()
  );
}

export function combatAutomationLockedReason(
  mapName: string,
): string | undefined {
  if (combatAutomationAllowedAt(mapName)) return undefined;
  const region = regionForMap(mapName);
  const boss = getEntry<EncounterContent>(region?.seal.sealEncounterId ?? '');
  return `Seal ${region?.name} first (clear ${boss?.name}).`;
}

export function combatManualHeroes(combat: Combat): Combatant[] {
  return combat.heroes.filter((c) => !c.summonerId);
}

export function combatManualTitle(combat: Combat): string {
  const fights = (
    getEntry<EncounterContent>(combat.encounterId ?? '') ??
    getEntry<EncounterRandomContent>(combat.encounterRandomId ?? '')
  )?.fights.length;
  return fights && combat.fightIndex !== undefined
    ? `${combat.locationName} (${combat.fightIndex + 1}/${fights})`
    : combat.locationName;
}

export function combatantIcon(c: Combatant): CombatLogIcon {
  if (c.monsterId) return { spritesheet: 'monster', sprite: c.sprite ?? '' };
  return {
    spritesheet: 'job',
    sprite: getEntry<JobContent>(c.jobId ?? '')?.sprite ?? '',
  };
}

// Pools can carry fractions from scaling; the cards show them floored.
function floorPool(value: number): number {
  return value > 0 ? Math.max(1, Math.floor(value)) : 0;
}

function combatManualBars(c: Combatant): StatusCardBar[] {
  const hp = combatantHealthBar(
    floorPool(c.hp),
    floorPool(c.totalStats.Health),
    c.shield,
  );
  if (c.monsterId) return [hp];
  const ep = floorPool(c.ep);
  return [
    hp,
    { variant: 'ep', current: ep, max: floorPool(c.totalStats.Energy) },
  ];
}

// No `monster` field, so the card skips its bestiary tooltip.
export function combatManualStatusCard(c: Combatant): StatusCardEntry {
  const job = getEntry<JobContent>(c.jobId ?? '');
  const icon = combatantIcon(c);
  return {
    combatantId: c.id,
    name: c.name,
    subtitleLevel: c.monsterId ? undefined : c.level,
    subtitleLabel: job?.shorthand,
    spritesheet: icon.spritesheet,
    spriteAssetName: icon.sprite,
    spriteFrames: c.monsterId ? c.frames : (job?.frames ?? 4),
    isDead: c.hp <= 0,
    bars: combatManualBars(c),
    statusEffects: combatantStatusEffectPreviews(c),
  };
}

function isFoeOf(hero: Combatant, c: Combatant): boolean {
  return c.isEnemy !== hero.isEnemy;
}

function foeTaunters(hero: Combatant, pool: Combatant[]): Combatant[] {
  return sortBy(
    pool.filter((c) => isFoeOf(hero, c) && c.combatStats.agroValue > 0),
    (c) => -c.combatStats.agroValue,
  );
}

// Mirrors the engine: taunters always come first, PreferHeroes fills from heroes, Vanished foes come last.
function combatManualPrimaryPool(
  combat: Combat,
  hero: Combatant,
  tech: EquipmentSkillContentTechnique,
  pool: Combatant[],
  numTargets: number,
): Combatant[] {
  const taunters = foeTaunters(hero, pool);
  if (taunters.length > 0) return taunters.slice(0, numTargets);

  const heroes = pool.filter((c) => combat.heroes.includes(c));
  const prefersHeroes = tech.targetBehaviors.some(
    (b) => b.behavior === 'PreferHeroes',
  );
  const preferred = prefersHeroes && heroes.length > 0 ? heroes : pool;
  const visible = preferred.filter(
    (c) => !(isFoeOf(hero, c) && c.combatStats.agroValue < 0),
  );
  return visible.length > 0 ? visible : preferred;
}

function unconfusedPool(
  combat: Combat,
  hero: Combatant,
  skill: EquipmentSkill,
  tech: EquipmentSkillContentTechnique,
): Combatant[] {
  return combatGetPossibleCombatantTargetsForSkillTechnique(
    combat,
    hero,
    skill,
    tech,
    false,
  );
}

// Empty when no technique has a real choice (self, all-target, one candidate).
function combatManualTargets(
  combat: Combat,
  hero: Combatant,
  skill: EquipmentSkill,
): Combatant[] {
  // A delayed skill can't keep a chosen target until it fires.
  if (skill.delay > 0) return [];
  for (const tech of skillOwnTechniques(skill)) {
    const n = skillTechniqueNumTargets(skill, tech);
    const base = unconfusedPool(combat, hero, skill, tech);
    const primary = combatManualPrimaryPool(combat, hero, tech, base, n);
    if (primary.length > n) return primary;
  }
  return [];
}

// Who a skill without a target choice hits; "auto" flags a pool no bigger than the skill's reach.
function combatManualAutoTargetLabel(
  combat: Combat,
  hero: Combatant,
  skill: EquipmentSkill,
): string {
  const tech = skillOwnTechniques(skill)[0];
  if (!tech || tech.targetType === 'Self') return 'Self';
  if (skill.delay > 0) return 'Picked when it fires';

  const base = unconfusedPool(combat, hero, skill, tech);
  const taunter = foeTaunters(hero, base)[0];
  if (taunter) return `${taunter.name} (taunting)`;
  if (base.length === 1) return `${base[0].name} (auto)`;

  const group =
    tech.targetType === 'Allies'
      ? 'Party'
      : tech.targetType === 'Enemies'
        ? 'All enemies'
        : 'Everyone';
  return base.length < skillTechniqueNumTargets(skill, tech)
    ? `${group} (auto)`
    : group;
}

function combatManualDisabledReason(
  combat: Combat,
  hero: Combatant,
  skill: EquipmentSkill,
): string | undefined {
  const hasTargets = skillOwnTechniques(skill).some(
    (tech) => unconfusedPool(combat, hero, skill, tech).length > 0,
  );
  if (
    combatAvailableSkillsForCombatant(combat, hero).includes(skill) &&
    hasTargets
  ) {
    return undefined;
  }
  if (hero.ep < combatCombatantSkillEpCost(hero, skill)) return 'Not enough EP';
  if (combatantSkillOnCooldown(hero, skill)) return 'Cooling down';
  return hasTargets ? 'Unavailable' : 'No valid targets';
}

export function combatManualSkillOptions(
  combat: Combat,
  hero: Combatant,
): CombatManualSkillOption[] {
  return combatantSkills(hero).map((skill) => {
    const tech = skillOwnTechniques(skill)[0];
    return {
      skill,
      targets: combatManualTargets(combat, hero, skill),
      autoTargetLabel: combatManualAutoTargetLabel(combat, hero, skill),
      epCost: combatCombatantSkillEpCost(hero, skill),
      targetCount:
        !tech || tech.targetType === 'Self'
          ? undefined
          : skillTechniqueNumTargets(skill, tech),
      disabledReason: combatManualDisabledReason(combat, hero, skill),
    };
  });
}

// Only lands on the round it was planned for, so a late double-click can't arm the next one.
export function combatManualConfirm(
  planned: Combat,
  actions: Record<string, CombatManualAction>,
  flee = false,
): void {
  updateGamestate((state) => {
    const combat = state.world.combat;
    if (
      combat?.id === planned.id &&
      combat.rounds === planned.rounds &&
      !!combat.ambushedBy === !!planned.ambushedBy &&
      !combat.manualActions
    ) {
      combat.manualActions = actions;
      if (flee) combat.manualFlee = true;
    }
    return state;
  });
  analyticsSendDesignEvent(
    flee ? 'Combat:Manual:Flee' : 'Combat:Manual:Confirm',
  );
}

export function combatManualFlee(planned: Combat): void {
  combatManualConfirm(planned, {}, true);
}

// Ambush rounds only let the heroes act; the dead are skipped either way.
export function combatManualTurnOrder(combat: Combat): Combatant[] {
  const order = orderCombatantsByAgility(combat).filter((c) => c.hp > 0);
  return combat.ambushedBy
    ? order.filter((c) => combat.heroes.includes(c))
    : order;
}

export function combatManualOrder(
  option: CombatManualSkillOption,
  target?: Combatant,
): CombatManualOrder {
  return {
    skillId: option.skill.id,
    targetId: target?.id,
    skillName: option.skill.name,
    skillSprite: option.skill.sprite,
    targetLabel: target?.name ?? option.autoTargetLabel,
    targetIcon: target ? combatantIcon(target) : undefined,
  };
}

// Reuses last round's skill; a target that's gone falls back to the first valid one.
export function combatManualRepeatOrder(
  combat: Combat,
  hero: Combatant,
  previous: CombatManualAction,
): CombatManualOrder | undefined {
  const option = combatManualSkillOptions(combat, hero).find(
    (o) => o.skill.id === previous.skillId && !o.disabledReason,
  );
  if (!option) return undefined;
  if (option.targets.length === 0) return combatManualOrder(option);
  const target =
    option.targets.find((c) => c.id === previous.targetId) ?? option.targets[0];
  return combatManualOrder(option, target);
}
