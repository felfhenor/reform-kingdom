import { defaultStats } from '@helpers/defaults';
import type {
  CollectibleContent,
  CollectibleId,
  ContentType,
  EncounterContent,
  EncounterId,
  EquipmentContent,
  EquipmentId,
  EquipmentSkillContent,
  EquipmentSkillId,
  GlobalEffectContent,
  GlobalEffectId,
  IsContentItem,
  ItemContent,
  ItemId,
  JobContent,
  JobId,
  MonsterContent,
  MonsterId,
  StatBlock,
  StatusEffectContent,
  StatusEffectId,
  TraitContent,
  TraitId,
} from '@interfaces';

// eat my ass, typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const initializers: Record<ContentType, (entry: any) => any> = {
  collectible: ensureCollectible,
  encounter: ensureEncounter,
  equipment: ensureEquipment,
  globaleffect: ensureGlobalEffect,
  item: ensureItem,
  job: ensureJob,
  monster: ensureMonster,
  skill: ensureSkill,
  statuseffect: ensureStatuseffect,
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
    targettingType: monster.targettingType ?? 'Random',
    rarity: monster.rarity ?? 'Common',
    xp: monster.xp ?? { min: 0, max: 0, multiplierPerLevel: 1 },
    droppedItems: monster.droppedItems ?? [],
    skills: monster.skills ?? [],
  };
}

function ensureEncounter(
  encounter: Partial<EncounterContent>,
): Required<EncounterContent> {
  return {
    id: encounter.id ?? ('UNKNOWN' as EncounterId),
    name: encounter.name ?? 'UNKNOWN',
    __type: 'encounter',
    description: encounter.description ?? 'UNKNOWN',
    levelRange: encounter.levelRange ?? { min: 1, max: 1 },
    fights: encounter.fights ?? [],
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

function ensureStatuseffect(
  effect: Partial<StatusEffectContent>,
): Required<StatusEffectContent> {
  return {
    id: effect.id ?? ('UNKNOWN' as StatusEffectId),
    name: effect.name ?? 'UNKNOWN',
    __type: 'statuseffect',
    effectType: effect.effectType ?? 'Buff',
    elements: effect.elements ?? [],
    trigger: effect.trigger ?? 'TurnStart',
    onApply: effect.onApply ?? [],
    onTick: effect.onTick ?? [],
    onUnapply: effect.onUnapply ?? [],
    statScaling: ensureStats(effect.statScaling),
    useTargetStats: effect.useTargetStats ?? false,
  };
}

function ensureGlobalEffect(
  effect: Partial<GlobalEffectContent>,
): Required<GlobalEffectContent> {
  return {
    id: effect.id ?? ('UNKNOWN' as GlobalEffectId),
    name: effect.name ?? 'UNKNOWN',
    __type: 'globaleffect',
    description: effect.description ?? 'UNKNOWN',
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
    techniques: skill.techniques ?? [],
    usesPerCombat: skill.usesPerCombat ?? -1,
    numTargets: skill.numTargets ?? 1,
    damageScaling: ensureStats(skill.damageScaling),
    statusEffectDurationBoost: skill.statusEffectDurationBoost ?? {},
    statusEffectChanceBoost: skill.statusEffectChanceBoost ?? {},
  };
}
