import { signal } from '@angular/core';
import { combatantIsDead } from '@helpers/combat/combat-combatant-hp';
import { combatantHealthBar } from '@helpers/combat/combat-combatant-hp.ui';
import {
  combatAutomationAllowedAt,
  combatIsManual,
  combatManualAwaitingOrders,
  combatManualSkillUsable,
} from '@helpers/combat/combat-manual';
import { combatantSkillOnCooldown } from '@helpers/combat/combat-skill-cooldown';
import { combatCombatantSkillEpCost } from '@helpers/combat/combat-stats';
import { combatantStatusEffectPreviews } from '@helpers/combat/combat-statuseffects.ui';
import {
  combatantSkills,
  combatGetPossibleCombatantTargetsForSkillTechnique,
} from '@helpers/combat/combat-targetting';
import {
  combatRoundQueue,
  combatTurnCombatant,
  orderCombatantsByAgility,
} from '@helpers/combat/combat-turn-queue';
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
  CombatManualSkillOption,
  CombatManualTurnSlot,
  CombatTurn,
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
  if (combatManualSkillUsable(combat, hero, skill)) return undefined;
  if (hero.ep < combatCombatantSkillEpCost(hero, skill)) return 'Not enough EP';
  if (combatantSkillOnCooldown(hero, skill)) return 'Cooling down';
  const hasTargets = skillOwnTechniques(skill).some(
    (tech) => unconfusedPool(combat, hero, skill, tech).length > 0,
  );
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

// Whose turn it is; input planned on an earlier turn is dropped.
export function combatManualTurnKey(combat: Combat): string {
  const turn = combat.turnQueue?.[0];
  return [
    combat.id,
    combat.rounds,
    !!combat.ambushedBy,
    combat.turnQueue?.length ?? 0,
    turn?.combatantId,
    !!turn?.bonus,
  ].join('|');
}

export function combatManualActiveHero(combat: Combat): Combatant | undefined {
  const turn = combat.turnQueue?.[0];
  return turn && combatManualAwaitingOrders(combat)
    ? combatTurnCombatant(combat, turn)
    : undefined;
}

// Only lands on the turn it was planned for, so a late double-click can't order the next one.
export function combatManualConfirm(
  planned: Combat,
  action?: CombatManualAction,
  flee = false,
): void {
  updateGamestate((state) => {
    const combat = state.world.combat;
    if (
      combat &&
      combatManualAwaitingOrders(combat) &&
      combatManualTurnKey(combat) === combatManualTurnKey(planned)
    ) {
      combat.manualAction = action;
      if (flee) combat.manualFlee = true;
    }
    return state;
  });
  analyticsSendDesignEvent(
    flee ? 'Combat:Manual:Flee' : 'Combat:Manual:Confirm',
  );
}

export function combatManualFlee(planned: Combat): void {
  combatManualConfirm(planned, undefined, true);
}

function combatManualTurnSlots(
  combat: Combat,
  turns: CombatTurn[],
  round: string,
): CombatManualTurnSlot[] {
  return turns.flatMap((turn) => {
    const c = combatTurnCombatant(combat, turn);
    if (!c || combatantIsDead(c)) return [];
    return [
      {
        kind: 'turn',
        key: `${round}:${c.id}${turn.bonus ? ':bonus' : ''}`,
        id: c.id,
        name: c.name,
        isEnemy: c.isEnemy,
        icon: combatantIcon(c),
      },
    ];
  });
}

// This round's remaining turns, then a guess at the next; keys hold steady as the next round becomes this one.
export function combatManualTurnOrder(combat: Combat): CombatManualTurnSlot[] {
  const nextRound = combat.ambushedBy ? combat.rounds : combat.rounds + 1;
  const next = orderCombatantsByAgility(combat).map((c) => ({
    combatantId: c.id,
  }));
  return [
    ...combatManualTurnSlots(
      combat,
      combat.turnQueue ?? combatRoundQueue(combat),
      combat.ambushedBy ? 'ambush' : `${combat.rounds}`,
    ),
    { kind: 'divider', key: `divider:${nextRound}`, round: nextRound + 1 },
    ...combatManualTurnSlots(combat, next, `${nextRound}`),
  ];
}

export function combatManualAction(
  option: CombatManualSkillOption,
  target?: Combatant,
): CombatManualAction {
  return { skillId: option.skill.id, targetId: target?.id };
}

// Reuses the hero's last skill; a target that's gone falls back to the first valid one.
export function combatManualRepeatAction(
  combat: Combat,
  hero: Combatant,
  previous: CombatManualAction,
): CombatManualAction | undefined {
  const option = combatManualSkillOptions(combat, hero).find(
    (o) => o.skill.id === previous.skillId && !o.disabledReason,
  );
  if (!option) return undefined;
  const target =
    option.targets.find((c) => c.id === previous.targetId) ?? option.targets[0];
  return combatManualAction(option, target);
}
