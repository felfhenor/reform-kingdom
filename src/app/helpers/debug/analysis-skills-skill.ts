import { getEntry } from '@helpers/content/content';
import { analysisFail, analysisWarn } from '@helpers/debug/analysis-utils';
import type {
  AnalysisIssue,
  EquipmentSkillContent as Skill,
  EquipmentSkillTargetType,
  StatusEffectContent,
} from '@interfaces';

const REQUIRED_FIELDS = ['name', 'description', 'sprite', 'family'] as const;
const VALUE_TOKEN = /\{\{\s*value\s*\}\}/;

function isMissing(value: string): boolean {
  return value === '' || value === 'UNKNOWN';
}

function fieldIssues(skill: Skill): AnalysisIssue[] {
  const issues = REQUIRED_FIELDS.filter((field) => isMissing(skill[field])).map(
    (field) => analysisFail(`is missing "${field}".`),
  );

  if (skill.techniques.length === 0) {
    issues.push(analysisFail('has no techniques.'));
  }

  return issues;
}

function costIssues(skill: Skill): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];

  if (skill.epCost < 0) {
    issues.push(analysisFail(`has a negative epCost (${skill.epCost}).`));
  }
  if (skill.usesPerCombat !== -1 && skill.usesPerCombat < 1) {
    issues.push(
      analysisFail(
        `has usesPerCombat ${skill.usesPerCombat}; use -1 for unlimited or a positive count.`,
      ),
    );
  }

  return issues;
}

function maxTargets(skill: Skill, types: EquipmentSkillTargetType[]): number {
  return Math.max(
    0,
    ...skill.techniques
      .filter((t) => types.includes(t.targetType))
      .map((t) => t.targets),
  );
}

function describedCount(description: string, noun: RegExp): number | undefined {
  const match = description.match(noun);
  return match ? Number(match[1]) : undefined;
}

function descriptionCountIssues(skill: Skill): AnalysisIssue[] {
  const checks: Array<[RegExp, string, number]> = [
    [
      /(\d+)\s+enem(?:y|ies)/i,
      'enemies',
      maxTargets(skill, ['Enemies', 'All']),
    ],
    [/(\d+)\s+allies/i, 'allies', maxTargets(skill, ['Allies', 'All'])],
    [/(\d+)\s+times/i, 'times', skill.techniques.length],
  ];

  return checks.flatMap(([noun, label, expected]) => {
    const described = describedCount(skill.description, noun);
    if (described === undefined || described === expected) return [];

    return [
      analysisWarn(
        `description says ${described} ${label} but its techniques give ${expected}.`,
      ),
    ];
  });
}

function descriptionIssues(skill: Skill): AnalysisIssue[] {
  const scales = skill.techniques.some((t) =>
    Object.values(t.damageScaling).some((value) => value !== 0),
  );
  const hasToken = VALUE_TOKEN.test(skill.description);
  const issues = descriptionCountIssues(skill);

  if (scales && !hasToken) {
    issues.push(
      analysisWarn('scales with stats but its description has no {{ value }}.'),
    );
  }
  if (!scales && hasToken) {
    issues.push(
      analysisWarn('has {{ value }} in its description but no damageScaling.'),
    );
  }

  return issues;
}

function boostIssues(skill: Skill): AnalysisIssue[] {
  const applied = new Set<string>(
    skill.techniques.flatMap((t) =>
      t.statusEffects.map((s) => getEntry(s.statusEffectId)?.id ?? ''),
    ),
  );
  const boostKeys = [
    ...Object.keys(skill.statusEffectDurationBoost),
    ...Object.keys(skill.statusEffectChanceBoost),
  ];

  return boostKeys.flatMap((key) => {
    const effect = getEntry<StatusEffectContent>(key);
    if (effect?.__type !== 'statuseffect') {
      return [analysisFail(`boosts unknown status effect "${key}".`)];
    }
    if (!applied.has(effect.id)) {
      return [
        analysisWarn(
          `boosts status effect "${effect.name}", which none of its techniques apply.`,
        ),
      ];
    }
    return [];
  });
}

export function skillIssues(skill: Skill): AnalysisIssue[] {
  return [
    ...fieldIssues(skill),
    ...costIssues(skill),
    ...descriptionIssues(skill),
    ...boostIssues(skill),
  ];
}
