// Audits skills: technique tagging, family/tier consistency, and assignment to a job, monster, equipment, or affix.

import { getEntriesByType } from '@helpers/content/content';
import { buildMonsterLevels } from '@helpers/debug/analysis-item-sources';
import { techniqueIssues } from '@helpers/debug/analysis-skills-technique';
import {
  familyIssues,
  skillFamilyNameIssues,
} from '@helpers/debug/analysis-skills-family';
import { skillIssues } from '@helpers/debug/analysis-skills-skill';
import {
  buildSkillSourceMap,
  collectSkillReferences,
  jobIssues,
  monsterIssues,
  unequippableWeaponIssues,
  unresolvedReferenceIssues,
} from '@helpers/debug/analysis-skills-sources';
import {
  analysisIssueCheck,
  analysisWarn,
} from '@helpers/debug/analysis-utils';
import type {
  AffixContent,
  AnalysisCheck,
  AnalysisIssue,
  AnalysisParams,
  AnalysisRunResult,
  AnalysisTable,
  EncounterContent,
  EncounterRandomContent,
  EquipmentContent,
  EquipmentSkillContent,
  JobContent,
  MonsterContent,
  SkillSource,
} from '@interfaces';
import { groupBy, sortBy } from 'es-toolkit/compat';

function toChecks(
  idPrefix: string,
  label: string,
  issues: AnalysisIssue[],
  passMessage: string,
): AnalysisCheck[] {
  if (issues.length === 0) {
    return [
      { id: `${idPrefix}:ok`, label, status: 'pass', message: passMessage },
    ];
  }

  return issues.map((issue, i) =>
    analysisIssueCheck(`${idPrefix}:${i}`, label, issue),
  );
}

function skillAllIssues(
  skill: EquipmentSkillContent,
  sources: SkillSource[],
  jobs: JobContent[],
): AnalysisIssue[] {
  const techniques = skill.techniques.flatMap((technique, i) =>
    techniqueIssues(technique).map((issue) => ({
      ...issue,
      message: `technique ${i + 1} ${issue.message}`,
    })),
  );
  const orphan =
    sources.length === 0
      ? [
          analysisWarn(
            'is not assigned to any job path, monster, equipment, or affix.',
          ),
        ]
      : [];

  return [
    ...skillIssues(skill),
    ...skillFamilyNameIssues(skill),
    ...techniques,
    ...unequippableWeaponIssues(skill, jobs),
    ...orphan,
  ];
}

function sourceSummary(sources: SkillSource[]): string {
  const byKind = groupBy(sources, (source) => source.kind);

  return Object.entries(byKind)
    .map(([kind, list]) =>
      kind === 'Monster'
        ? `Monster x${list.length}`
        : `${kind}: ${list.map((s) => s.name).join(', ')}`,
    )
    .join('; ');
}

function inventoryTable(
  skills: EquipmentSkillContent[],
  sources: Map<string, SkillSource[]>,
): AnalysisTable {
  return {
    title: 'Skill Inventory',
    columns: [
      'Skill',
      'Family',
      'Rarity',
      'EP',
      'Uses',
      'Techniques',
      'Sources',
    ],
    rows: skills.map((skill) => ({
      Skill: skill.name,
      Family: skill.family,
      Rarity: skill.rarity,
      EP: skill.epCost,
      Uses: skill.usesPerCombat === -1 ? 'Unlimited' : skill.usesPerCombat,
      Techniques: skill.techniques.length,
      Sources: sourceSummary(sources.get(skill.id) ?? []) || 'None',
    })),
  };
}

function summarize(checks: AnalysisCheck[], skillCount: number): string {
  const failures = checks.filter((c) => c.status === 'fail').length;
  const warnings = checks.filter((c) => c.status === 'warning').length;
  if (failures === 0 && warnings === 0) {
    return `All ${skillCount} skills are tagged consistently and assigned.`;
  }

  return `${failures} skill problem(s) and ${warnings} warning(s) across ${skillCount} skills.`;
}

export function runSkillsAnalysis(
  params: AnalysisParams = {},
): AnalysisRunResult {
  const skills = sortBy(
    getEntriesByType<EquipmentSkillContent>('skill'),
    (skill) => skill.name,
  );
  const jobs = getEntriesByType<JobContent>('job');
  const monsters = getEntriesByType<MonsterContent>('monster');
  const references = collectSkillReferences(
    jobs,
    monsters,
    getEntriesByType<EquipmentContent>('equipment'),
    getEntriesByType<AffixContent>('affix'),
  );
  const sources = buildSkillSourceMap(references);
  const monsterLevels = buildMonsterLevels(
    getEntriesByType<EncounterContent>('encounter'),
    getEntriesByType<EncounterRandomContent>('encounterrandom'),
  );

  const checks: AnalysisCheck[] = [
    ...skills.flatMap((skill) =>
      toChecks(
        `skill:${skill.id}`,
        skill.name,
        skillAllIssues(skill, sources.get(skill.id) ?? [], jobs),
        'Tagging is consistent and it is assigned to at least one source.',
      ),
    ),
    ...Object.entries(groupBy(skills, (skill) => skill.family)).flatMap(
      ([family, list]) =>
        toChecks(
          `family:${family}`,
          `Family ${family}`,
          familyIssues(list),
          `${list.length} tier(s) are consistent.`,
        ),
    ),
    ...jobs.flatMap((job) =>
      toChecks(
        `job:${job.id}`,
        `Job ${job.name}`,
        jobIssues(job),
        'Skill paths are ordered and usable.',
      ),
    ),
    ...monsters.flatMap((monster) =>
      toChecks(
        `monster:${monster.id}`,
        `Monster ${monster.name}`,
        monsterIssues(monster, monsterLevels.get(monster.id)),
        'Skill list is valid and affordable.',
      ),
    ),
    ...unresolvedReferenceIssues(references).map(({ label, issue }, i) =>
      analysisIssueCheck(`reference:${i}`, label, issue),
    ),
  ];

  return {
    checks,
    tables: params['expanded'] ? [inventoryTable(skills, sources)] : undefined,
    summary: summarize(checks, skills.length),
  };
}
