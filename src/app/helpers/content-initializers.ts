import { defaultStats } from '@helpers/defaults';
import type {
  CollectibleContent,
  CollectibleId,
  ContentType,
  EquipmentContent,
  EquipmentId,
  EquipmentSkillContent,
  EquipmentSkillId,
  IsContentItem,
  ItemContent,
  ItemId,
  JobContent,
  JobId,
  MonsterContent,
  MonsterId,
  StatBlock,
  TraitContent,
  TraitId,
} from '@interfaces';

// eat my ass, typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const initializers: Record<ContentType, (entry: any) => any> = {
  collectible: ensureCollectible,
  equipment: ensureEquipment,
  item: ensureItem,
  job: ensureJob,
  monster: ensureMonster,
  skill: ensureSkill,
  trait: ensureTrait,
};

function ensureStats(statblock: Partial<StatBlock> = {}): Required<StatBlock> {
  return Object.assign({}, defaultStats(), statblock);
}

export function ensureContent<T extends IsContentItem>(content: T): T {
  return initializers[content.__type](content) satisfies T;
}

function ensureItem(item: Partial<ItemContent>): Required<ItemContent> {
  return {
    id: item.id ?? ('UNKNOWN' as ItemId),
    name: item.name ?? 'UNKNOWN',
    __type: 'item',
    description: item.description ?? 'UNKNOWN',
    sprite: item.sprite ?? 'UNKNOWN',
  };
}

function ensureMonster(
  monster: Partial<MonsterContent>,
): Required<MonsterContent> {
  return {
    id: monster.id ?? ('UNKNOWN' as MonsterId),
    name: monster.name ?? 'UNKNOWN',
    __type: 'monster',
    description: monster.description ?? 'UNKNOWN',
    sprite: monster.sprite ?? 'UNKNOWN',
    frames: monster.frames ?? 4,
    baseStats: ensureStats(monster.baseStats),
    statsPerLevel: ensureStats(monster.statsPerLevel),
  };
}

function ensureCollectible(
  collectible: Partial<CollectibleContent>,
): Required<CollectibleContent> {
  return {
    id: collectible.id ?? ('UNKNOWN' as CollectibleId),
    name: collectible.name ?? 'UNKNOWN',
    __type: 'collectible',
    description: collectible.description ?? 'UNKNOWN',
    sprite: collectible.sprite ?? 'UNKNOWN',
  };
}

function ensureEquipment(
  equipment: Partial<EquipmentContent>,
): Required<EquipmentContent> {
  return {
    id: equipment.id ?? ('UNKNOWN' as EquipmentId),
    name: equipment.name ?? 'UNKNOWN',
    __type: 'equipment',
    description: equipment.description ?? 'UNKNOWN',
    baseStats: ensureStats(equipment.baseStats),
    statsPerLevel: ensureStats(equipment.statsPerLevel),
    sprite: equipment.sprite ?? 'UNKNOWN',
  };
}

function ensureJob(job: Partial<JobContent>): Required<JobContent> {
  return {
    id: job.id ?? ('UNKNOWN' as JobId),
    name: job.name ?? 'UNKNOWN',
    __type: 'job',
    description: job.description ?? 'UNKNOWN',
    baseStats: ensureStats(job.baseStats),
    statsPerLevel: ensureStats(job.statsPerLevel),
    sprite: job.sprite ?? 'UNKNOWN',
    frames: job.frames ?? 4,
  };
}

function ensureTrait(trait: Partial<TraitContent>): Required<TraitContent> {
  return {
    id: trait.id ?? ('UNKNOWN' as TraitId),
    name: trait.name ?? 'UNKNOWN',
    __type: 'trait',
    description: trait.description ?? 'UNKNOWN',
    baseStats: ensureStats(trait.baseStats),
  };
}

function ensureSkill(
  skill: Partial<EquipmentSkillContent>,
): Required<EquipmentSkillContent> {
  return {
    id: skill.id ?? ('UNKNOWN' as EquipmentSkillId),
    name: skill.name ?? 'UNKNOWN',
    __type: 'skill',
    description: skill.description ?? 'UNKNOWN',
    sprite: skill.sprite ?? 'UNKNOWN',
    frames: skill.frames ?? 4,
    rarity: skill.rarity ?? 'Common',
    dropLevel: skill.dropLevel ?? 0,
    preventModification: skill.preventModification ?? false,
    preventDrop: skill.preventDrop ?? false,
    isFavorite: skill.isFavorite ?? false,
    disableUpgrades: skill.disableUpgrades ?? false,
    enchantLevel: skill.enchantLevel ?? 0,
    techniques: skill.techniques ?? [],
    usesPerCombat: skill.usesPerCombat ?? -1,
    numTargets: skill.numTargets ?? 1,
    damageScaling: ensureStats(skill.damageScaling),
    statusEffectDurationBoost: skill.statusEffectDurationBoost ?? {},
    statusEffectChanceBoost: skill.statusEffectChanceBoost ?? {},
  };
}
