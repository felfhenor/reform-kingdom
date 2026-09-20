import { analysisFail, analysisWarn } from '@helpers/debug/analysis-utils';
import { skillNameTier } from '@helpers/hero/skill';
import type {
  AnalysisIssue,
  EquipmentSkillContent as Skill,
} from '@interfaces';
import { RARITY_PRIORITY } from '@interfaces';
import { sortBy, uniq } from 'es-toolkit/compat';

// Equipment upgrades group skills by the family their name implies, so a mismatched `family` splits them.
export function skillFamilyNameIssues(skill: Skill): AnalysisIssue[] {
  const derived = skillNameTier(skill.name).family;
  if (derived === skill.family) return [];

  return [
    analysisFail(
      `has family "${skill.family}" but its name implies family "${derived}".`,
    ),
  ];
}

function tierIssues(tiers: number[]): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];

  if (uniq(tiers).length !== tiers.length) {
    issues.push(analysisFail('has two skills at the same tier.'));
  }

  const missing = Array.from({ length: Math.max(...tiers) }, (_, i) => i + 1)
    .filter((tier) => !tiers.includes(tier))
    .join(', ');
  if (missing) issues.push(analysisWarn(`has no skill at tier(s) ${missing}.`));

  return issues;
}

function progressionIssues(ordered: Skill[]): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];

  ordered.slice(1).forEach((skill, i) => {
    const previous = ordered[i];
    if (RARITY_PRIORITY[skill.rarity] < RARITY_PRIORITY[previous.rarity]) {
      issues.push(
        analysisWarn(
          `"${skill.name}" is ${skill.rarity}, lower than "${previous.name}" (${previous.rarity}).`,
        ),
      );
    }
    if (skill.epCost < previous.epCost) {
      issues.push(
        analysisWarn(
          `"${skill.name}" costs ${skill.epCost} EP, less than "${previous.name}" (${previous.epCost}).`,
        ),
      );
    }
  });

  return issues;
}

function weaponIssues(ordered: Skill[]): AnalysisIssue[] {
  const signatures = uniq(
    ordered.map((skill) => sortBy(skill.requiredWeaponTypes).join('|')),
  );
  if (signatures.length <= 1) return [];

  return [analysisWarn('has tiers with differing requiredWeaponTypes.')];
}

export function familyIssues(skills: Skill[]): AnalysisIssue[] {
  const ordered = sortBy(skills, (skill) => skillNameTier(skill.name).tier);
  const tiers = ordered.map((skill) => skillNameTier(skill.name).tier);

  return [
    ...tierIssues(tiers),
    ...progressionIssues(ordered),
    ...weaponIssues(ordered),
  ];
}
