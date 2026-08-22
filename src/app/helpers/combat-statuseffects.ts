import { combatCombatantTakeDamage } from '@helpers/combat-damage';
import { combatFormatMessage, combatMessageLog } from '@helpers/combat-log';
import { combatCombatantCombatStatSucceedsChance } from '@helpers/combat-stats';
import type {
  Combat,
  Combatant,
  CombatantCombatStats,
} from '@interfaces/combat';
import type { EquipmentSkill } from '@interfaces/content-skill';
import type {
  StatusEffect,
  StatusEffectAddCombatStatNumber,
  StatusEffectBehavior,
  StatusEffectBehaviorAddStat,
  StatusEffectBehaviorDataChange,
  StatusEffectBehaviorTakeStat,
  StatusEffectBehaviorType,
  StatusEffectContent,
  StatusEffectTag,
  StatusEffectTakeCombatStatNumber,
  StatusEffectTrigger,
} from '@interfaces/content-statuseffect';
import type { GameStat, StatBlock } from '@interfaces/stat';
import { isNumber, sumBy } from 'es-toolkit/compat';

export function combatCanTakeTurn(combatant: Combatant): boolean {
  return !combatant.statusEffectData.isFrozen;
}

// The highest resistance the combatant has across any of the effect's tags,
// not a sum - stacking multiple tag bonuses on one multi-tag effect would
// let unrelated gear combine into near-guaranteed immunity.
export function statusEffectTagResistance(
  combatant: Combatant,
  tags: StatusEffectTag[],
): number {
  if (tags.length === 0) return 0;
  return Math.max(0, ...tags.map((tag) => combatant.tagResistance?.[tag] ?? 0));
}

function statusEffectDamage(effect: StatusEffect): number {
  const statBlock = effect.useTargetStats
    ? effect.targetStats
    : effect.creatorStats;

  return Math.floor(
    sumBy(
      Object.keys(effect.statScaling) as GameStat[],
      (stat) => statBlock[stat] * effect.statScaling[stat],
    ),
  );
}

export function combatHandleCombatantStatusEffects(
  combat: Combat,
  combatant: Combatant,
  trigger: StatusEffectTrigger,
): void {
  const triggeredEffects = combatant.statusEffects.filter(
    (s) => s.trigger === trigger,
  );
  if (triggeredEffects.length === 0) return;

  triggeredEffects.forEach((eff) => {
    combatTriggerTickStatusEffect(combat, combatant, eff);

    eff.duration--;

    if (eff.duration <= 0) {
      combatTriggerUnapplyStatusEffect(combat, combatant, eff);
    }
  });

  combatant.statusEffects = combatant.statusEffects.filter(
    (s) => s.duration > 0,
  );
}

export function combatCreateStatusEffect(
  content: StatusEffectContent,
  skill: EquipmentSkill,
  creator: Combatant,
  target: Combatant,
  opts: Partial<StatusEffect>,
  capturedCreatorStats?: StatBlock,
): StatusEffect {
  const baseCreatorStats = capturedCreatorStats || creator.totalStats;

  return {
    duration: 1,
    ...content,
    ...opts,
    creatorStats: { ...baseCreatorStats },
    targetStats: { ...target.totalStats },
  };
}

export function combatApplyStatusEffectToTarget(
  combat: Combat,
  combatant: Combatant,
  statusEffect: StatusEffect,
): void {
  const existingEffect = combatant.statusEffects.find(
    (s) => s.id === statusEffect.id,
  );
  if (existingEffect) return;

  const shouldIgnoreDebuff = combatCombatantCombatStatSucceedsChance(
    combatant,
    'debuffIgnoreChance',
  );

  if (statusEffect.effectType === 'Debuff' && shouldIgnoreDebuff) {
    combatMessageLog(
      combat,
      `**${statusEffect.name}** is shrugged off by **${combatant.name}**!`,
      combatant,
    );
    return;
  }

  combatant.statusEffects.push(statusEffect);
  combatTriggerApplyStatusEffect(combat, combatant, statusEffect);
}

// Exported for `combat-create.ts`, which applies active `GainStats` global effects to heroes at creation time.
export function combatApplyStatDeltaToCombatant(
  combatant: Combatant,
  stat: GameStat,
  value: number,
): void {
  combatant.statBoosts[stat] += value;
  combatant.totalStats[stat] += value;
}

function combatApplyCombatStatNumberDeltaToCombatant(
  combatant: Combatant,
  stat: keyof CombatantCombatStats,
  value: number,
): void {
  const ref = combatant.combatStats[stat];
  if (!isNumber(ref)) return;

  (combatant.combatStats[stat] as number) += value;
}

function combatHandleStatusEffectBehaviors(
  combat: Combat,
  combatant: Combatant,
  effect: StatusEffect,
  behavior: StatusEffectBehavior,
  suppressMessages = false,
): void {
  const templateData = {
    damage: 0,
    healing: 0,
    absdamage: 0,
    combatant,
  };

  const behaviorTypes: Record<StatusEffectBehaviorType, () => void> = {
    SendMessage: () => {},
    ModifyStatusEffectData: () => {
      const behaviorData = behavior as StatusEffectBehaviorDataChange;
      const { key, value } = behaviorData;
      combatant.statusEffectData[key] = value;
    },
    HealDamage: () => {
      const healing = statusEffectDamage(effect);
      templateData.healing = healing;

      combatCombatantTakeDamage(combatant, -healing);
    },
    TakeDamage: () => {
      const damage = statusEffectDamage(effect);
      templateData.damage = damage;
      templateData.absdamage = Math.abs(damage);

      combatCombatantTakeDamage(combatant, damage);
    },
    AddDamageToStat: () => {
      const behaviorData = behavior as StatusEffectBehaviorAddStat;

      const damage = statusEffectDamage(effect);
      templateData.damage = damage;

      combatApplyStatDeltaToCombatant(
        combatant,
        behaviorData.modifyStat,
        damage,
      );
    },
    TakeDamageFromStat: () => {
      const behaviorData = behavior as StatusEffectBehaviorTakeStat;

      const damage = statusEffectDamage(effect);
      templateData.damage = damage;

      combatApplyStatDeltaToCombatant(
        combatant,
        behaviorData.modifyStat,
        -damage,
      );
    },
    AddCombatStatNumber: () => {
      const behaviorData = behavior as StatusEffectAddCombatStatNumber;

      combatApplyCombatStatNumberDeltaToCombatant(
        combatant,
        behaviorData.combatStat,
        behaviorData.value,
      );
    },
    TakeCombatStatNumber: () => {
      const behaviorData = behavior as StatusEffectTakeCombatStatNumber;

      combatApplyCombatStatNumberDeltaToCombatant(
        combatant,
        behaviorData.combatStat,
        -behaviorData.value,
      );
    },
  };

  behaviorTypes[behavior.type]();

  if (!suppressMessages && behavior.combatMessage) {
    const message = combatFormatMessage(behavior.combatMessage, templateData);
    const color = effect.effectType === 'Buff' ? 'text-buff' : 'text-debuff';
    combatMessageLog(combat, message, combatant, color);
  }
}

function combatTriggerApplyStatusEffect(
  combat: Combat,
  combatant: Combatant,
  statusEffect: StatusEffect,
): void {
  statusEffect.onApply.forEach((beh) =>
    combatHandleStatusEffectBehaviors(combat, combatant, statusEffect, beh),
  );
}

function combatTriggerTickStatusEffect(
  combat: Combat,
  combatant: Combatant,
  statusEffect: StatusEffect,
): void {
  statusEffect.onTick.forEach((beh) =>
    combatHandleStatusEffectBehaviors(combat, combatant, statusEffect, beh),
  );
}

function combatTriggerUnapplyStatusEffect(
  combat: Combat,
  combatant: Combatant,
  statusEffect: StatusEffect,
): void {
  statusEffect.onUnapply.forEach((beh) =>
    combatHandleStatusEffectBehaviors(combat, combatant, statusEffect, beh),
  );
}

export function combatUnapplyAllStatusEffects(
  combat: Combat,
  combatant: Combatant,
): void {
  combatant.statusEffects.forEach((statusEffect) => {
    statusEffect.onUnapply.forEach((beh) =>
      combatHandleStatusEffectBehaviors(
        combat,
        combatant,
        statusEffect,
        beh,
        true,
      ),
    );
  });
}
