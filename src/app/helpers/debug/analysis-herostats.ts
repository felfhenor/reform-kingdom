/**
 * Reports MIN (unequipped), MAX (best gear obtainable at this level), and
 * MID (average of the two) stats for every job at a given level, plus
 * estimated skill damage/heal values at each tier. Ported from
 * `scripts/analyze-herostats.ts` - see that file's history for the full
 * methodology writeup (best-gear selection, two-handed vs. one-handed+offhand
 * tie-break, raw pre-mitigation skill power).
 */

import { maxBy, sumBy } from 'es-toolkit/compat';
import { getEntriesByType, getEntry } from '@helpers/content';
import {
  addStats,
  filterByNames,
  round2,
  statSum,
  zeroStats,
} from '@helpers/debug/analysis-utils';
import type {
  AnalysisCheck,
  AnalysisParams,
  AnalysisRunResult,
  AnalysisTable,
  EquipmentContent,
  EquipmentItemType,
  EquipmentSkillContent,
  EquipmentSkillContentTechnique,
  EquipmentSkillId,
  JobContent,
  StatBlock,
  StatusEffectContent,
} from '@interfaces';

const CHARACTER_MAX_LEVEL = 99;

const STAT_NAMES = [
  'Intelligence',
  'Strength',
  'Vitality',
  'Resistance',
  'Agility',
  'Health',
  'Energy',
  'Luck',
] as const;

// Mirrors `EquipmentTypeToSlot` in src/app/interfaces/equipment.ts - only
// the keys matter here (to enumerate every equippable item type).
const EQUIPMENT_TYPES: EquipmentItemType[] = [
  'Accessory',
  'Arrow',
  'Artifact',
  'Bow',
  'Cloth Armor',
  'Dagger',
  'Dirk',
  'Hat',
  'Helm',
  'Mace',
  'Ring',
  'Shield',
  'Staff',
  'Spear',
  'Sword',
  'Trinket',
  'Whip',
];
const TWO_HANDED_TYPES: EquipmentItemType[] = ['Bow', 'Staff', 'Spear'];
const ONE_HANDED_WEAPON_TYPES: EquipmentItemType[] = [
  'Dagger',
  'Mace',
  'Sword',
  'Whip',
];
const OFFHAND_ONLY_TYPES: EquipmentItemType[] = ['Dirk', 'Shield'];

function jobStatsAtLevel(job: JobContent, level: number): StatBlock {
  const stats = { ...job.baseStats };
  STAT_NAMES.forEach((stat) => {
    stats[stat] += (job.statsPerLevel[stat] ?? 0) * (level - 1);
  });
  return stats;
}

function bestOfType(
  equipment: EquipmentContent[],
  type: string,
  level: number,
): EquipmentContent | undefined {
  const candidates = equipment.filter(
    (item) => item.type === type && item.levelRequirement <= level,
  );
  if (candidates.length === 0) return undefined;

  return maxBy(candidates, (item) => statSum(item.baseStats));
}

function bestOfTypes(
  equipment: EquipmentContent[],
  types: EquipmentItemType[],
  job: JobContent,
  level: number,
): EquipmentContent | undefined {
  const candidates = types
    .filter((type) => job.equippableTypes.includes(type))
    .map((type) => bestOfType(equipment, type, level))
    .filter((item): item is EquipmentContent => !!item);

  return maxBy(candidates, (item) => statSum(item.baseStats));
}

function bestEquipmentSet(
  job: JobContent,
  equipment: EquipmentContent[],
  level: number,
): EquipmentContent[] {
  const picks: EquipmentContent[] = [];

  const independentTypes = EQUIPMENT_TYPES.filter(
    (type) =>
      job.equippableTypes.includes(type) &&
      !TWO_HANDED_TYPES.includes(type) &&
      !ONE_HANDED_WEAPON_TYPES.includes(type) &&
      !OFFHAND_ONLY_TYPES.includes(type),
  );
  independentTypes.forEach((type) => {
    const best = bestOfType(equipment, type, level);
    if (best) picks.push(best);
  });

  const bestTwoHanded = bestOfTypes(equipment, TWO_HANDED_TYPES, job, level);
  const bestOneHanded = bestOfTypes(equipment, ONE_HANDED_WEAPON_TYPES, job, level);
  const bestOffhand = bestOfTypes(equipment, OFFHAND_ONLY_TYPES, job, level);

  const twoHandedValue = bestTwoHanded ? statSum(bestTwoHanded.baseStats) : -1;
  const pairValue =
    (bestOneHanded ? statSum(bestOneHanded.baseStats) : 0) +
    (bestOffhand ? statSum(bestOffhand.baseStats) : 0);

  if (bestTwoHanded && twoHandedValue >= pairValue) {
    picks.push(bestTwoHanded);
  } else {
    if (bestOneHanded) picks.push(bestOneHanded);
    if (bestOffhand) picks.push(bestOffhand);
  }

  return picks;
}

function midpoint(min: StatBlock, max: StatBlock): StatBlock {
  const mid = zeroStats();
  STAT_NAMES.forEach((stat) => {
    mid[stat] = (min[stat] + max[stat]) / 2;
  });
  return mid;
}

// Highest-level entry unlocked so far on each skill path.
function heroSkillIdsAtLevel(job: JobContent, level: number): EquipmentSkillId[] {
  return job.skillPath
    .map((path) => {
      const unlocked = path.levels.filter((entry) => entry.level <= level);
      if (unlocked.length === 0) return undefined;
      return maxBy(unlocked, (entry) => entry.level)?.skillId;
    })
    .filter((skillId): skillId is EquipmentSkillId => !!skillId);
}

function techniqueType(technique: EquipmentSkillContentTechnique): string {
  const attributes = technique.attributes ?? [];
  if (attributes.includes('HealsTarget')) return 'Heal';
  if (attributes.includes('DamagesTarget')) return 'Damage';
  if (attributes.includes('Buff')) return 'Buff';
  if (attributes.includes('Debuff')) return 'Debuff';
  return 'Effect';
}

// Raw, pre-mitigation technique power - see file header for what this
// does/doesn't account for (no target, no defense mitigation).
function techniqueRawValue(
  stats: StatBlock,
  technique: EquipmentSkillContentTechnique,
): number {
  const damageScaling = technique.damageScaling ?? {};
  return sumBy(STAT_NAMES, (stat) => {
    const scaling = damageScaling[stat] ?? 0;
    return scaling === 0 ? 0 : stats[stat] * (1 + scaling);
  });
}

function statRow(job: JobContent, stats: StatBlock): Record<string, string | number> {
  const row: Record<string, string | number> = { Job: job.name };
  STAT_NAMES.forEach((stat) => {
    row[stat] = round2(stats[stat]);
  });
  row['Total'] = round2(statSum(stats));
  return row;
}

export function runHeroStatsAnalysis(params: AnalysisParams): AnalysisRunResult {
  const level = Number(params['level'] ?? 50);
  if (!Number.isInteger(level) || level < 1 || level > CHARACTER_MAX_LEVEL) {
    throw new Error(
      `"level" must be an integer between 1 and ${CHARACTER_MAX_LEVEL}, got ${params['level']}.`,
    );
  }

  const jobs = getEntriesByType<JobContent>('job');
  const equipment = getEntriesByType<EquipmentContent>('equipment');

  const selectedJobs = filterByNames(jobs, params['classFilter'] as string[] | undefined);
  if (selectedJobs.length === 0) {
    throw new Error(
      `No classes matched "${params['classFilter']}". Available classes: ${jobs.map((job) => job.name).join(', ')}`,
    );
  }

  const checks: AnalysisCheck[] = [];
  const minRows: Record<string, string | number>[] = [];
  const midRows: Record<string, string | number>[] = [];
  const maxRows: Record<string, string | number>[] = [];
  const skillRows: Record<string, string | number>[] = [];

  selectedJobs.forEach((job) => {
    const min = jobStatsAtLevel(job, level);
    const max = { ...min };
    const gearSet = bestEquipmentSet(job, equipment, level);
    gearSet.forEach((item) => addStats(max, item.baseStats));
    const mid = midpoint(min, max);

    minRows.push(statRow(job, min));
    midRows.push(statRow(job, mid));
    maxRows.push(statRow(job, max));

    checks.push({
      id: `gear:${job.id}`,
      label: `Best gear: ${job.name}`,
      status: 'info',
      message: `${job.name} MAX gear: ${
        gearSet
          .map((item) => `${item.name} (${item.type}, req L${item.levelRequirement})`)
          .join(', ') || '(nothing available to equip at this level)'
      }`,
    });

    heroSkillIdsAtLevel(job, level).forEach((skillId) => {
      const skill = getEntry<EquipmentSkillContent>(skillId);
      if (!skill) {
        checks.push({
          id: `skill-missing:${job.id}:${skillId}`,
          label: `Skill lookup: ${job.name}`,
          status: 'fail',
          message: `"${job.name}" has unlocked skill "${skillId}" but no matching compiled skill entry exists.`,
        });
        return;
      }

      skill.techniques.forEach((technique, index) => {
        const type = techniqueType(technique);
        const isValued = type === 'Damage' || type === 'Heal';
        const label =
          skill.techniques.length > 1
            ? `${job.name} - ${skill.name} (#${index + 1})`
            : `${job.name} - ${skill.name}`;

        skillRows.push({
          Skill: label,
          Type: type,
          Elements: (technique.elements ?? []).join(', ') || '-',
          Targets: technique.targets,
          'Min value': isValued ? Math.floor(techniqueRawValue(min, technique)) : '-',
          'Mid value': isValued ? Math.floor(techniqueRawValue(mid, technique)) : '-',
          'Max value': isValued ? Math.floor(techniqueRawValue(max, technique)) : '-',
          'Status effects':
            (technique.statusEffects ?? [])
              .map(
                (effect) =>
                  getEntry<StatusEffectContent>(effect.statusEffectId)?.name ??
                  effect.statusEffectId,
              )
              .join(', ') || '-',
        });
      });
    });
  });

  const statColumns = ['Job', ...STAT_NAMES, 'Total'];
  const tables: AnalysisTable[] = [
    { title: `MIN (unequipped) stats at level ${level}`, columns: statColumns, rows: minRows },
    { title: `MID (average of min/max) stats at level ${level}`, columns: statColumns, rows: midRows },
    { title: `MAX (best gear) stats at level ${level}`, columns: statColumns, rows: maxRows },
    {
      title: 'Skill damage/healing estimates (raw, pre-mitigation)',
      columns: ['Skill', 'Type', 'Elements', 'Targets', 'Min value', 'Mid value', 'Max value', 'Status effects'],
      rows: skillRows,
    },
  ];

  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    tables,
    summary:
      failures === 0
        ? `Reported stats for ${selectedJobs.length} job(s) at level ${level}.`
        : `${failures} problem(s) found while reporting stats for ${selectedJobs.length} job(s) at level ${level}.`,
  };
}
