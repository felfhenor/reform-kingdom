// Skill stat bonuses match skills by family string, so a typo silently does nothing.
// Checks each bonus targets a real, stat-scaling, hero-usable family and that
// skill-stat affixes share one family so an item rolls at most one.
import { getEntriesByType } from '@helpers/content/content';
import {
  collectSkillReferences,
  resolveSkill,
} from '@helpers/debug/analysis-skills-sources';
import {
  analysisFail,
  analysisIssueChecks,
  analysisWarn,
} from '@helpers/debug/analysis-utils';
import { skillTechniqueStatScaling } from '@helpers/hero/skill';
import type {
  AffixContent,
  AnalysisIssue,
  AnalysisRunResult,
  EquipmentContent,
  EquipmentSkillContent as Skill,
  ItemContent,
  JobContent,
  SkillStatBonus,
  SkillStatBonusContext,
  SkillStatBonusSource,
} from '@interfaces';
import { groupBy } from 'es-toolkit/compat';

const SKILL_ENHANCEMENT_AFFIX_FAMILY = 'Skill Enhancement';

function skillStatBonusSources(
  equipment: EquipmentContent[],
  items: ItemContent[],
  affixes: AffixContent[],
): SkillStatBonusSource[] {
  const sources: SkillStatBonusSource[] = [
    ...equipment.map((entry) => ({
      id: entry.id,
      label: `Equipment ${entry.name}`,
      bonuses: entry.skillStatBonuses ?? [],
      equipment: { type: entry.type, grantedSkillIds: entry.grantedSkillIds },
    })),
    ...items.map((entry) => ({
      id: entry.id,
      label: `Item ${entry.name}`,
      bonuses: entry.infusionSkillStatBonuses ?? [],
    })),
    ...affixes.map((entry) => ({
      id: entry.id,
      label: `Affix ${entry.name}`,
      bonuses: entry.effects.flatMap((effect) =>
        effect.kind === 'SkillStatBonus' ? [effect] : [],
      ),
      affixFamily: entry.family,
    })),
  ];

  return sources.filter(
    (source) =>
      source.bonuses.length > 0 ||
      source.affixFamily === SKILL_ENHANCEMENT_AFFIX_FAMILY,
  );
}

function familyOfSkill(skillRef: string): string[] {
  const skill = resolveSkill(skillRef);
  return skill ? [skill.family] : [];
}

function jobFamilies(job: JobContent): string[] {
  return job.skillPath.flatMap((path) =>
    path.levels.flatMap((level) => familyOfSkill(level.skillId)),
  );
}

// Families a hero can ever cast: learned on a job path, or granted by gear.
function heroCastableFamilies(
  jobs: JobContent[],
  equipment: EquipmentContent[],
  affixes: AffixContent[],
): Set<string> {
  return new Set(
    collectSkillReferences(jobs, [], equipment, affixes).flatMap((reference) =>
      familyOfSkill(reference.skillRef),
    ),
  );
}

function equippableFamilies(
  gear: NonNullable<SkillStatBonusSource['equipment']>,
  jobs: JobContent[],
): Set<string> {
  const learned = jobs
    .filter((job) => job.equippableTypes.includes(gear.type))
    .flatMap(jobFamilies);

  return new Set([...gear.grantedSkillIds.flatMap(familyOfSkill), ...learned]);
}

function skillScalesOffStat(skill: Skill): boolean {
  return skill.techniques.some(
    (technique) => skillTechniqueStatScaling(technique).length > 0,
  );
}

function unusableFamilyIssues(
  bonus: SkillStatBonus,
  source: SkillStatBonusSource,
  context: SkillStatBonusContext,
): AnalysisIssue[] {
  const { skillFamily } = bonus;

  if (!context.heroFamilies.has(skillFamily)) {
    return [
      analysisWarn(
        `boosts "${skillFamily}", which no job learns and no gear grants, so no hero can use it.`,
      ),
    ];
  }

  const { equipment } = source;
  if (!equipment) return [];
  if (equippableFamilies(equipment, context.jobs).has(skillFamily)) return [];

  return [
    analysisWarn(
      `boosts "${skillFamily}", but no job that can equip a ${equipment.type} learns or is granted it.`,
    ),
  ];
}

function bonusIssues(
  bonus: SkillStatBonus,
  source: SkillStatBonusSource,
  context: SkillStatBonusContext,
): AnalysisIssue[] {
  const skills = context.skillsByFamily.get(bonus.skillFamily);
  if (!skills) {
    return [
      analysisFail(`boosts unknown skill family "${bonus.skillFamily}".`),
    ];
  }

  const issues = unusableFamilyIssues(bonus, source, context);
  if (bonus.value === 0) {
    issues.push(
      analysisFail(`grants a 0 ${bonus.stat} bonus, which does nothing.`),
    );
  }
  if (!skills.some(skillScalesOffStat)) {
    issues.push(
      analysisFail(
        `boosts "${bonus.skillFamily}", which has no technique that scales off a stat, so the bonus never applies.`,
      ),
    );
  }

  return issues;
}

function duplicateBonusIssues(bonuses: SkillStatBonus[]): AnalysisIssue[] {
  const groups = groupBy(bonuses, (b) => `${b.skillFamily} ${b.stat}`);

  return Object.entries(groups)
    .filter(([, group]) => group.length > 1)
    .map(([key]) =>
      analysisWarn(`lists "${key}" more than once; the values are summed.`),
    );
}

function affixGroupIssues(source: SkillStatBonusSource): AnalysisIssue[] {
  if (source.affixFamily === undefined) return [];

  const hasBonus = source.bonuses.length > 0;
  const inGroup = source.affixFamily === SKILL_ENHANCEMENT_AFFIX_FAMILY;

  if (hasBonus && !inGroup) {
    return [
      analysisFail(
        `has a skill stat bonus but is in family "${source.affixFamily}" instead of "${SKILL_ENHANCEMENT_AFFIX_FAMILY}", so an item could roll several.`,
      ),
    ];
  }
  if (!hasBonus && inGroup) {
    return [
      analysisWarn(
        `is in family "${SKILL_ENHANCEMENT_AFFIX_FAMILY}" but has no skill stat bonus.`,
      ),
    ];
  }

  return [];
}

function sourceIssues(
  source: SkillStatBonusSource,
  context: SkillStatBonusContext,
): AnalysisIssue[] {
  return [
    ...source.bonuses.flatMap((bonus) => bonusIssues(bonus, source, context)),
    ...duplicateBonusIssues(source.bonuses),
    ...affixGroupIssues(source),
  ];
}

export function runSkillBonusesAnalysis(): AnalysisRunResult {
  const equipment = getEntriesByType<EquipmentContent>('equipment');
  const affixes = getEntriesByType<AffixContent>('affix');
  const jobs = getEntriesByType<JobContent>('job');
  const context: SkillStatBonusContext = {
    skillsByFamily: new Map(
      Object.entries(
        groupBy(getEntriesByType<Skill>('skill'), (skill) => skill.family),
      ),
    ),
    heroFamilies: heroCastableFamilies(jobs, equipment, affixes),
    jobs,
  };

  const sources = skillStatBonusSources(
    equipment,
    getEntriesByType<ItemContent>('item'),
    affixes,
  );
  const checks = sources.flatMap((source) =>
    analysisIssueChecks(
      `skillbonus:${source.id}`,
      source.label,
      sourceIssues(source, context),
      'Every bonus targets a real, usable skill family.',
    ),
  );

  const problems = checks.filter((check) => check.status !== 'pass').length;

  return {
    checks,
    summary:
      problems === 0
        ? `All ${sources.length} skill stat bonus source(s) are valid.`
        : `${problems} problem(s) across ${sources.length} skill stat bonus source(s).`,
  };
}
