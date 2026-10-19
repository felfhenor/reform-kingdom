import { getEntry } from '@helpers/content/content';
import {
  monsterSkillsAtLevel,
  monsterStatsAtLevel,
} from '@helpers/combat/monster';
import { analysisFail, analysisWarn } from '@helpers/debug/analysis-utils';
import { skillTreeJobSkillGrants } from '@helpers/hero/skill-tree-content';
import type {
  AffixContent,
  AnalysisIssue,
  EquipmentContent,
  EquipmentSkillContent as Skill,
  JobContent,
  LevelRange,
  MonsterContent,
  MonsterSkill,
  SkillReference,
  SkillSource,
  TrainerTeachingContent,
} from '@interfaces';
import { intersection, max, range, uniq } from 'es-toolkit/compat';

export function resolveSkill(ref: string): Skill | undefined {
  const entry = getEntry<Skill>(ref);
  return entry?.__type === 'skill' ? entry : undefined;
}

function jobReferences(jobs: JobContent[]): SkillReference[] {
  return jobs.flatMap((job) =>
    skillTreeJobSkillGrants(job.id).map((grant) => ({
      skillRef: grant.skillId,
      source: { kind: 'Job' as const, name: job.name },
    })),
  );
}

function monsterReferences(monsters: MonsterContent[]): SkillReference[] {
  return monsters.flatMap((monster) =>
    monster.skills.map((skill) => ({
      skillRef: skill.skillId,
      source: { kind: 'Monster' as const, name: monster.name },
    })),
  );
}

function equipmentReferences(equipment: EquipmentContent[]): SkillReference[] {
  return equipment.flatMap((item) =>
    item.grantedSkillIds.map((skillRef) => ({
      skillRef,
      source: { kind: 'Equipment' as const, name: item.name },
    })),
  );
}

function affixReferences(affixes: AffixContent[]): SkillReference[] {
  return affixes.flatMap((affix) =>
    affix.effects.flatMap((effect) =>
      effect.kind === 'GrantSkill'
        ? [
            {
              skillRef: effect.skillId,
              source: { kind: 'Affix' as const, name: affix.name },
            },
          ]
        : [],
    ),
  );
}

function teachingReferences(
  teachings: TrainerTeachingContent[],
): SkillReference[] {
  return teachings.flatMap((teaching) =>
    teaching.effects.flatMap((effect) =>
      effect.kind === 'GrantSkill'
        ? [
            {
              skillRef: effect.skillId,
              source: { kind: 'Teaching' as const, name: teaching.name },
            },
          ]
        : [],
    ),
  );
}

export function collectSkillReferences(
  jobs: JobContent[],
  monsters: MonsterContent[],
  equipment: EquipmentContent[],
  affixes: AffixContent[],
  teachings: TrainerTeachingContent[],
): SkillReference[] {
  return [
    ...jobReferences(jobs),
    ...monsterReferences(monsters),
    ...equipmentReferences(equipment),
    ...affixReferences(affixes),
    ...teachingReferences(teachings),
  ];
}

export function buildSkillSourceMap(
  references: SkillReference[],
): Map<string, SkillSource[]> {
  const sources = new Map<string, SkillSource[]>();

  references.forEach(({ skillRef, source }) => {
    const skill = resolveSkill(skillRef);
    if (!skill) return;

    const list = sources.get(skill.id) ?? [];
    list.push(source);
    sources.set(skill.id, list);
  });

  return sources;
}

export function unresolvedReferenceIssues(
  references: SkillReference[],
): Array<{ label: string; issue: AnalysisIssue }> {
  return references
    .filter(({ skillRef }) => !resolveSkill(skillRef))
    .map(({ skillRef, source }) => ({
      label: `${source.kind} ${source.name}`,
      issue: analysisFail(`references unknown skill "${skillRef}".`),
    }));
}

// Tree layout, tier order and requirements are covered by validate:skilltrees.
function jobTreeSkillIssues(job: JobContent): AnalysisIssue[] {
  const grants = skillTreeJobSkillGrants(job.id);
  if (grants.length === 0) return [analysisFail('has no skill tree skills.')];

  return grants.some((grant) => grant.isDefault)
    ? []
    : [analysisWarn('teaches no skill at level 1.')];
}

function jobSkills(job: JobContent): Skill[] {
  return uniq(
    skillTreeJobSkillGrants(job.id).flatMap(
      (grant) => resolveSkill(grant.skillId) ?? [],
    ),
  );
}

function jobWeaponIssues(job: JobContent): AnalysisIssue[] {
  return jobSkills(job)
    .filter(
      (skill) =>
        skill.requiredWeaponTypes.length > 0 &&
        intersection(skill.requiredWeaponTypes, job.equippableTypes).length ===
          0,
    )
    .map((skill) =>
      analysisFail(
        `learns "${skill.name}" but can't equip any of its required weapons (${skill.requiredWeaponTypes.join(', ')}).`,
      ),
    );
}

function jobEnergyIssues(job: JobContent): AnalysisIssue[] {
  return skillTreeJobSkillGrants(job.id).flatMap(({ level, skillId }) => {
    const skill = resolveSkill(skillId);
    const energy =
      job.baseStats.Energy + job.statsPerLevel.Energy * (level - 1);
    if (!skill || skill.epCost <= energy) return [];

    return [
      analysisWarn(
        `learns "${skill.name}" (${skill.epCost} EP) at level ${level} with only ${energy} Energy before gear.`,
      ),
    ];
  });
}

export function jobIssues(job: JobContent): AnalysisIssue[] {
  return [
    ...jobTreeSkillIssues(job),
    ...jobWeaponIssues(job),
    ...jobEnergyIssues(job),
  ];
}

export function unequippableWeaponIssues(
  skill: Skill,
  jobs: JobContent[],
): AnalysisIssue[] {
  if (skill.requiredWeaponTypes.length === 0) return [];

  const equippable = jobs.some(
    (job) =>
      intersection(skill.requiredWeaponTypes, job.equippableTypes).length > 0,
  );
  if (equippable) return [];

  return [
    analysisWarn(
      `requires ${skill.requiredWeaponTypes.join(' / ')}, which no job can equip.`,
    ),
  ];
}

function skillWindows(
  entry: MonsterSkill,
  spawnRanges: LevelRange[],
): LevelRange[] {
  return spawnRanges
    .map((r) => ({
      min: Math.max(r.min, entry.minLevel),
      max: Math.min(r.max, entry.maxLevel),
    }))
    .filter((window) => window.min <= window.max);
}

function monsterEnergyIssues(
  monster: MonsterContent,
  spawnRanges: LevelRange[],
): AnalysisIssue[] {
  return monster.skills.flatMap((entry) => {
    const skill = resolveSkill(entry.skillId);
    const activeMax = max(skillWindows(entry, spawnRanges).map((w) => w.max));
    if (!skill || activeMax === undefined) return [];

    const energy = monsterStatsAtLevel(monster, activeMax).Energy;
    if (skill.epCost <= energy) return [];

    return [
      analysisWarn(
        `can never cast "${skill.name}" (${skill.epCost} EP) - it has ${energy} Energy at its highest level with that skill (${activeMax}).`,
      ),
    ];
  });
}

function monsterSkillLevelIssues(
  monster: MonsterContent,
  spawnRanges: LevelRange[],
): AnalysisIssue[] {
  const issues = monster.skills
    .filter((s) => s.minLevel > s.maxLevel)
    .map((s) =>
      analysisFail(`has skill "${s.skillId}" with minLevel above maxLevel.`),
    );
  if (spawnRanges.length === 0 || monster.skills.length === 0) return issues;

  monster.skills
    .filter((s) => skillWindows(s, spawnRanges).length === 0)
    .forEach((s) =>
      issues.push(
        analysisWarn(
          `skill "${s.skillId}" is never active at any spawn level.`,
        ),
      ),
    );

  spawnRanges.forEach((spawn) => {
    const bareLevel = range(spawn.min, spawn.max + 1).find(
      (level) => monsterSkillsAtLevel(monster, level).length === 0,
    );
    if (bareLevel === undefined) return;

    issues.push(
      analysisFail(`has no active skills at spawn level ${bareLevel}.`),
    );
  });

  return issues;
}

function monsterListIssues(monster: MonsterContent): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];
  const ids = monster.skills.map(
    (s) => resolveSkill(s.skillId)?.id ?? s.skillId,
  );
  const overlapsEarlier = monster.skills.some((s, i) =>
    monster.skills.some(
      (other, j) =>
        j < i &&
        ids[i] === ids[j] &&
        s.minLevel <= other.maxLevel &&
        other.minLevel <= s.maxLevel,
    ),
  );

  if (monster.skills.length === 0) {
    issues.push(analysisWarn('has no skills.'));
  }
  if (overlapsEarlier) {
    issues.push(
      analysisFail(
        'lists the same skill more than once at overlapping levels.',
      ),
    );
  }
  if (monster.skills.some((s) => !(s.weight > 0))) {
    issues.push(analysisFail('has a skill with a non-positive weight.'));
  }

  return issues;
}

export function monsterIssues(
  monster: MonsterContent,
  spawnRanges: LevelRange[] = [],
): AnalysisIssue[] {
  return [
    ...monsterListIssues(monster),
    ...monsterSkillLevelIssues(monster, spawnRanges),
    ...monsterEnergyIssues(monster, spawnRanges),
  ];
}
