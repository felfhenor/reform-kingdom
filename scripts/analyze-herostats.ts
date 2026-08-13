/**
 * Reports MIN (unequipped), MAX (best gear obtainable at this level), and
 * MID (the average of the two) stats for every job at a given level - a
 * quick sanity check when tuning monster/encounter difficulty against what
 * a party could plausibly have at that level.
 *
 * Stat formula mirrors `characterStatsForLevel`/`jobStatsAtLevel` in
 * `src/app/helpers/party.ts`: `baseStats[stat] + statsPerLevel[stat] * (level - 1)`,
 * plus flat (non-level-scaling) equipment `baseStats`.
 *
 * "Best gear" independently picks, per equipment type, the highest
 * stat-sum item the job can equip (`type` in `job.equippableTypes`) with
 * `levelRequirement <= level`. Weapon/Offhand is special-cased: a
 * two-handed weapon (Bow/Staff/Spear) fills both slots with one item, so
 * it's compared against the best one-handed weapon + offhand pair and
 * whichever totals higher wins - mirroring how `equipmentStatTotals`
 * (src/app/helpers/equipment.ts) dedupes a two-handed item to one entry.
 * "Best" is judged by summed stat total, since gear here has no
 * cost/tradeoff to weigh stats against each other.
 *
 * "Mid" has no in-game meaning - it's a stand-in for "a partially-geared
 * party" as a balance reference point.
 *
 * Also reports, per unlocked skill, an estimated damage/heal value at each
 * of the Min/Mid/Max stat tiers above. This is a hero-side-only estimate:
 * `combatApplySkillToTarget` (src/app/helpers/combat-damage.ts) mitigates
 * damage against a *target's* Resistance/Vitality (skipped entirely for
 * `BypassDefense` techniques, which covers every heal) and caps healing to
 * the target's missing HP - neither of which exists here without a target
 * to fight. What's reported is the raw, pre-mitigation technique power:
 * `Σ stat * (1 + damageScaling[stat])` over each stat the technique scales
 * from (assumes 0 elemental affinity, i.e. no equipped Artifact bonus) -
 * an upper bound on damage, and the uncapped/unresisted value for healing.
 *
 * Usage: ts-node scripts/analyze-herostats <level 1-99> [class1,class2,...]
 *
 * The class list is optional and matches `Job.name` case-insensitively
 * (e.g. `warrior,healer`); omit it to report every class.
 */

const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const rec = require('recursive-readdir');

const ROOT_DIR = path.resolve(__dirname, '..');
const JOB_DIR = path.join(ROOT_DIR, 'gamedata', 'job');
const EQUIPMENT_DIR = path.join(ROOT_DIR, 'gamedata', 'equipment');
const SKILL_DIR = path.join(ROOT_DIR, 'gamedata', 'skill');

const CHARACTER_MAX_LEVEL = 99;

const STATS = [
  'Intelligence',
  'Strength',
  'Vitality',
  'Resistance',
  'Agility',
  'Health',
  'Energy',
  'Luck',
] as const;
type Stat = (typeof STATS)[number];
type StatBlock = Record<Stat, number>;

type JobSkillPathLevel = {
  level: number;
  skillId: string;
};

type Job = {
  name: string;
  baseStats: StatBlock;
  statsPerLevel: StatBlock;
  equippableTypes: string[];
  skillPath: { pathName: string; levels: JobSkillPathLevel[] }[];
};

type Equipment = {
  name: string;
  levelRequirement: number;
  type: string;
  baseStats: Partial<StatBlock>;
};

type SkillTechnique = {
  targetType: string;
  targets: number;
  damageScaling: Partial<StatBlock>;
  elements: string[];
  attributes: string[];
  statusEffects: { statusEffectId: string; chance: number; duration: number }[];
};

type Skill = {
  name: string;
  techniques: SkillTechnique[];
};

// Mirrors `EquipmentTypeToSlot` in src/app/interfaces/equipment.ts - only
// the keys matter here (to enumerate every equippable item type).
const EQUIPMENT_TYPES = [
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
const TWO_HANDED_TYPES = ['Bow', 'Staff', 'Spear'];
const ONE_HANDED_WEAPON_TYPES = ['Dagger', 'Mace', 'Sword', 'Whip'];
const OFFHAND_ONLY_TYPES = ['Dirk', 'Shield'];

function zeroStats(): StatBlock {
  const stats = {} as StatBlock;
  STATS.forEach((stat) => {
    stats[stat] = 0;
  });
  return stats;
}

async function loadYmlArray<T>(dir: string): Promise<T[]> {
  const files: string[] = (await rec(dir)).filter((file: string) =>
    file.endsWith('.yml'),
  );

  const entries: T[] = [];
  files.forEach((file: string) => {
    const doc = yaml.load(fs.readFileSync(file, 'utf-8')) as T[] | undefined;
    entries.push(...(doc ?? []));
  });
  return entries;
}

function statSum(stats: Partial<StatBlock>): number {
  return STATS.reduce((sum, stat) => sum + (stats[stat] ?? 0), 0);
}

function jobStatsAtLevel(job: Job, level: number): StatBlock {
  const stats = { ...job.baseStats };
  STATS.forEach((stat) => {
    stats[stat] += (job.statsPerLevel[stat] ?? 0) * (level - 1);
  });
  return stats;
}

function addStats(target: StatBlock, source: Partial<StatBlock>): void {
  STATS.forEach((stat) => {
    target[stat] += source[stat] ?? 0;
  });
}

// Highest stat-sum item of `type` the job can equip at `level`, or
// undefined if none qualify.
function bestOfType(
  equipment: Equipment[],
  type: string,
  level: number,
): Equipment | undefined {
  const candidates = equipment.filter(
    (item) => item.type === type && item.levelRequirement <= level,
  );
  if (candidates.length === 0) return undefined;

  return candidates.reduce((best, item) =>
    statSum(item.baseStats) > statSum(best.baseStats) ? item : best,
  );
}

// Best item across a set of equipment types (e.g. every one-handed weapon
// type), or undefined if the job can't equip any of them / none qualify.
function bestOfTypes(
  equipment: Equipment[],
  types: string[],
  job: Job,
  level: number,
): Equipment | undefined {
  return types
    .filter((type) => job.equippableTypes.includes(type))
    .map((type) => bestOfType(equipment, type, level))
    .filter((item): item is Equipment => !!item)
    .reduce<Equipment | undefined>(
      (best, item) =>
        !best || statSum(item.baseStats) > statSum(best.baseStats)
          ? item
          : best,
      undefined,
    );
}

// Picks the best available item per equipment type the job can use, then
// resolves the Weapon/Offhand overlap by comparing a two-handed weapon
// against a one-handed weapon + offhand pair (see file-level comment).
function bestEquipmentSet(
  job: Job,
  equipment: Equipment[],
  level: number,
): Equipment[] {
  const picks: Equipment[] = [];

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
  const bestOneHanded = bestOfTypes(
    equipment,
    ONE_HANDED_WEAPON_TYPES,
    job,
    level,
  );
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
  STATS.forEach((stat) => {
    mid[stat] = (min[stat] + max[stat]) / 2;
  });
  return mid;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Mirrors `heroSkillsAtLevel` in src/app/helpers/job.ts: the highest-level
// entry unlocked so far on each skill path (skillPath entries are yml
// name-references, per project convention - resolved against `skills` by
// `Skill.name`, not a real id).
function heroSkillsAtLevel(job: Job, level: number): string[] {
  return job.skillPath
    .map((path) => {
      const unlocked = path.levels.filter((entry) => entry.level <= level);
      if (unlocked.length === 0) return undefined;
      return unlocked.reduce((latest, entry) =>
        entry.level > latest.level ? entry : latest,
      ).skillId;
    })
    .filter((skillId): skillId is string => !!skillId);
}

function techniqueType(technique: SkillTechnique): string {
  const attributes = technique.attributes ?? [];
  if (attributes.includes('HealsTarget')) return 'Heal';
  if (attributes.includes('DamagesTarget')) return 'Damage';
  if (attributes.includes('Buff')) return 'Buff';
  if (attributes.includes('Debuff')) return 'Debuff';
  return 'Effect';
}

// Raw, pre-mitigation technique power at a given stat block - see the
// file-level comment for what this does and doesn't account for.
function techniqueRawValue(
  stats: StatBlock,
  technique: SkillTechnique,
): number {
  const damageScaling = technique.damageScaling ?? {};
  return STATS.reduce((sum, stat) => {
    const scaling = damageScaling[stat] ?? 0;
    if (scaling === 0) return sum;
    return sum + stats[stat] * (1 + scaling);
  }, 0);
}

// Case-insensitive filter by `name` - returns every item if `namesArg` is
// omitted/empty.
function filterByNames<T extends { name: string }>(
  items: T[],
  namesArg: string | undefined,
): T[] {
  if (!namesArg) return items;

  const wanted = namesArg.split(',').map((name) => name.trim().toLowerCase());
  return items.filter((item) => wanted.includes(item.name.toLowerCase()));
}

function statRow(stats: StatBlock): Record<string, number> {
  const row: Record<string, number> = {};
  STATS.forEach((stat) => {
    row[stat] = round2(stats[stat]);
  });
  row['Total'] = round2(statSum(stats));
  return row;
}

async function main(): Promise<void> {
  const level = Number(process.argv[2]);
  const classFilterArg = process.argv[3];

  if (!Number.isInteger(level) || level < 1 || level > CHARACTER_MAX_LEVEL) {
    console.error(
      `Usage: ts-node scripts/analyze-herostats <level 1-${CHARACTER_MAX_LEVEL}> [class1,class2,...]`,
    );
    process.exit(1);
  }

  const jobs = await loadYmlArray<Job>(JOB_DIR);
  const equipment = await loadYmlArray<Equipment>(EQUIPMENT_DIR);
  const skills = await loadYmlArray<Skill>(SKILL_DIR);
  const skillsByName = new Map(skills.map((skill) => [skill.name, skill]));

  const selectedJobs = filterByNames(jobs, classFilterArg);
  if (selectedJobs.length === 0) {
    console.error(
      `No classes matched "${classFilterArg}". Available classes: ${jobs.map((job) => job.name).join(', ')}`,
    );
    process.exit(1);
  }

  console.log(`=== Hero stats at level ${level} ===`);

  const minTable: Record<string, Record<string, number>> = {};
  const midTable: Record<string, Record<string, number>> = {};
  const maxTable: Record<string, Record<string, number>> = {};
  const skillTable: Record<
    string,
    {
      Type: string;
      Elements: string;
      Targets: number;
      'Min value': number | string;
      'Mid value': number | string;
      'Max value': number | string;
      'Status effects': string;
    }
  > = {};

  selectedJobs.forEach((job) => {
    const min = jobStatsAtLevel(job, level);

    const max = { ...min };
    const gearSet = bestEquipmentSet(job, equipment, level);
    gearSet.forEach((item) => addStats(max, item.baseStats));

    const mid = midpoint(min, max);

    console.log(
      `\n${job.name} MAX gear: ${
        gearSet
          .map(
            (item) =>
              `${item.name} (${item.type}, req L${item.levelRequirement})`,
          )
          .join(', ') || '(nothing available to equip at this level)'
      }`,
    );

    minTable[job.name] = statRow(min);
    midTable[job.name] = statRow(mid);
    maxTable[job.name] = statRow(max);

    heroSkillsAtLevel(job, level).forEach((skillName) => {
      const skill = skillsByName.get(skillName);
      if (!skill) {
        console.error(
          `  ! "${job.name}" has unlocked skill "${skillName}" but no matching entry exists under gamedata/skill.`,
        );
        return;
      }

      skill.techniques.forEach((technique, index) => {
        const type = techniqueType(technique);
        const isValued = type === 'Damage' || type === 'Heal';
        const label =
          skill.techniques.length > 1
            ? `${job.name} - ${skill.name} (#${index + 1})`
            : `${job.name} - ${skill.name}`;

        skillTable[label] = {
          Type: type,
          Elements: (technique.elements ?? []).join(', ') || '-',
          Targets: technique.targets,
          'Min value': isValued
            ? Math.floor(techniqueRawValue(min, technique))
            : '-',
          'Mid value': isValued
            ? Math.floor(techniqueRawValue(mid, technique))
            : '-',
          'Max value': isValued
            ? Math.floor(techniqueRawValue(max, technique))
            : '-',
          'Status effects':
            (technique.statusEffects ?? [])
              .map((effect) => effect.statusEffectId)
              .join(', ') || '-',
        };
      });
    });
  });

  console.log('\n--- MIN (unequipped) ---');
  console.table(minTable);

  console.log('\n--- MID (average of min/max) ---');
  console.table(midTable);

  console.log('\n--- MAX (best gear at this level) ---');
  console.table(maxTable);

  console.log(
    '\n--- Skill damage/healing estimates (raw, pre-mitigation - see file header) ---',
  );
  console.table(skillTable);
}

main();
