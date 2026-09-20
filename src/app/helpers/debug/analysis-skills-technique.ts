import { SKILL_MAX_ALLY_TARGETS } from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { analysisFail, analysisWarn } from '@helpers/debug/analysis-utils';
import type {
  AnalysisIssue,
  EquipmentSkillAttribute,
  EquipmentSkillContentTechnique as Technique,
  StatusEffectContent,
} from '@interfaces';

const DAMAGE_TOKEN = /\{\{\s*damage\s*\}\}/;
const EFFECT_TYPES = ['Buff', 'Debuff'] as const;

function hasAttr(t: Technique, attribute: EquipmentSkillAttribute): boolean {
  return t.attributes.includes(attribute);
}

function hasScaling(t: Technique): boolean {
  return Object.values(t.damageScaling).some((value) => value !== 0);
}

function lookupStatusEffect(id: string): StatusEffectContent | undefined {
  const entry = getEntry<StatusEffectContent>(id);
  return entry?.__type === 'statuseffect' ? entry : undefined;
}

function damageTagIssues(t: Technique): AnalysisIssue[] {
  const damages = hasAttr(t, 'DamagesTarget');
  const heals = hasAttr(t, 'HealsTarget');
  const scales = hasScaling(t);
  const issues: AnalysisIssue[] = [];

  if (damages && heals) {
    issues.push(analysisFail('is tagged both DamagesTarget and HealsTarget.'));
  }
  if (scales && !damages && !heals) {
    issues.push(
      analysisFail(
        'has damageScaling but neither DamagesTarget nor HealsTarget, so it deals untagged damage (no crits or monster-type bonus).',
      ),
    );
  }
  if (!scales && (damages || heals)) {
    issues.push(
      analysisFail(
        `is tagged ${damages ? 'DamagesTarget' : 'HealsTarget'} but has no damageScaling, so it does nothing.`,
      ),
    );
  }
  if (damages && t.targetType === 'Allies') {
    issues.push(analysisFail('is tagged DamagesTarget but targets Allies.'));
  }
  if (damages && t.targetType === 'Self') {
    issues.push(analysisWarn('is tagged DamagesTarget but targets Self.'));
  }

  return issues;
}

function healIssues(t: Technique): AnalysisIssue[] {
  if (!hasAttr(t, 'HealsTarget')) return [];

  const issues: AnalysisIssue[] = [];
  if (!hasAttr(t, 'BypassDefense')) {
    issues.push(
      analysisFail(
        'heals without BypassDefense, so target defense zeroes the heal.',
      ),
    );
  }
  if (hasAttr(t, 'AllowPlink')) {
    issues.push(
      analysisFail(
        'heals with AllowPlink, which turns the heal into 1 damage.',
      ),
    );
  }
  if (t.targetType === 'Enemies') {
    issues.push(analysisFail('is tagged HealsTarget but targets Enemies.'));
  }
  if (hasAttr(t, 'AllowLuckDodge')) {
    issues.push(analysisWarn('heals with AllowLuckDodge, so heals can miss.'));
  }
  if (!t.targetBehaviors.some((b) => b.behavior === 'NotMaxHealth')) {
    issues.push(
      analysisWarn(
        'heals without a NotMaxHealth target behavior, so casts can be wasted on full-health targets.',
      ),
    );
  }

  return issues;
}

function effectTypeIssues(
  t: Technique,
  appliedTypes: Set<string>,
): AnalysisIssue[] {
  return EFFECT_TYPES.flatMap((type) => {
    const tagged = hasAttr(t, type);
    const applied = appliedTypes.has(type);

    if (tagged && !applied) {
      return [
        analysisFail(`is tagged ${type} but applies no ${type} status effect.`),
      ];
    }
    if (!tagged && applied) {
      return [
        analysisFail(
          `applies a ${type} status effect but isn't tagged ${type}.`,
        ),
      ];
    }
    return [];
  });
}

function effectTargetIssues(
  t: Technique,
  appliedTypes: Set<string>,
): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];

  if (appliedTypes.has('Buff') && t.targetType === 'Enemies') {
    issues.push(analysisFail('applies a Buff status effect to Enemies.'));
  }
  if (appliedTypes.has('Debuff') && ['Allies', 'Self'].includes(t.targetType)) {
    issues.push(
      analysisWarn(`applies a Debuff status effect to ${t.targetType}.`),
    );
  }

  return issues;
}

function statusEffectIssues(t: Technique): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];
  const appliedTypes = new Set<string>();
  let hasUnknownEffect = false;

  t.statusEffects.forEach((application) => {
    const effect = lookupStatusEffect(application.statusEffectId);
    if (!effect) {
      hasUnknownEffect = true;
      issues.push(
        analysisFail(
          `applies unknown status effect "${application.statusEffectId}".`,
        ),
      );
    } else {
      appliedTypes.add(effect.effectType);
    }

    if (!(application.chance > 0 && application.chance <= 100)) {
      issues.push(
        analysisFail(`has a status effect chance of ${application.chance}.`),
      );
    }
    if (!(application.duration >= 1)) {
      issues.push(
        analysisFail(
          `has a status effect duration of ${application.duration}.`,
        ),
      );
    }
  });

  if (hasUnknownEffect) return issues;

  return [
    ...issues,
    ...effectTypeIssues(t, appliedTypes),
    ...effectTargetIssues(t, appliedTypes),
  ];
}

function targetBehaviorIssues(t: Technique): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];

  t.targetBehaviors.forEach((b) => {
    if (b.behavior !== 'IfStatusEffect' && b.behavior !== 'IfNotStatusEffect') {
      return;
    }
    if (!b.statusEffectId || !lookupStatusEffect(b.statusEffectId)) {
      issues.push(
        analysisFail(
          `has a ${b.behavior} target behavior with an unknown status effect "${b.statusEffectId ?? ''}".`,
        ),
      );
    }
  });

  if (!t.targetBehaviors.some((b) => b.behavior === 'NotZeroHealth')) {
    issues.push(
      analysisWarn(
        'has no NotZeroHealth target behavior, so it can target downed combatants.',
      ),
    );
  }

  return issues;
}

function targetCountIssues(t: Technique): AnalysisIssue[] {
  if (t.targets < 1) return [analysisFail(`targets ${t.targets} combatants.`)];

  if (t.targetType === 'Allies' && t.targets > SKILL_MAX_ALLY_TARGETS) {
    return [
      analysisWarn(
        `targets ${t.targets} allies but parties cap at ${SKILL_MAX_ALLY_TARGETS}, so the extra targets are ignored.`,
      ),
    ];
  }
  if (t.targetType === 'Self' && t.targets !== 1) {
    return [analysisWarn(`targets Self with targets: ${t.targets}.`)];
  }

  return [];
}

function combatMessageIssues(t: Technique): AnalysisIssue[] {
  if (!t.combatMessage || t.combatMessage === 'UNKNOWN') {
    return [analysisFail('has no combatMessage.')];
  }
  if (hasAttr(t, 'HealsTarget') && DAMAGE_TOKEN.test(t.combatMessage)) {
    return [
      analysisFail(
        'heal combatMessage uses {{ damage }}, which is negative for heals; use {{ absdamage }}.',
      ),
    ];
  }

  return [];
}

export function techniqueIssues(t: Technique): AnalysisIssue[] {
  return [
    ...damageTagIssues(t),
    ...healIssues(t),
    ...statusEffectIssues(t),
    ...targetBehaviorIssues(t),
    ...targetCountIssues(t),
    ...combatMessageIssues(t),
  ];
}
