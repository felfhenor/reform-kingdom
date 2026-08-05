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
  GatheringContent,
  GatheringId,
  GlobalEffectContent,
  GlobalEffectId,
  IsContentItem,
  ItemContent,
  ItemId,
  JobContent,
  JobId,
  MonsterContent,
  MonsterId,
  RecipeContent,
  RecipeId,
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
  gathering: ensureGathering,
  globaleffect: ensureGlobalEffect,
  item: ensureItem,
  job: ensureJob,
  monster: ensureMonster,
  recipe: ensureRecipe,
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
    rarity: item.rarity ?? 'Common',
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
    drops: monster.drops ?? [],
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
    completionRewards: encounter.completionRewards ?? [],
  };
}

function ensureGathering(
  gathering: Partial<GatheringContent>,
): Required<GatheringContent> {
  return {
    id: gathering.id ?? ('UNKNOWN' as GatheringId),
    name: gathering.name ?? 'UNKNOWN',
    __type: 'gathering',
    description: gathering.description ?? 'UNKNOWN',
    levelRange: gathering.levelRange ?? { min: 1, max: 1 },
    xpGainedIfInLevelRange: gathering.xpGainedIfInLevelRange ?? 0,
    gatherTime: gathering.gatherTime ?? 1,
    gatherResults: gathering.gatherResults ?? [],
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
    rarity: collectible.rarity ?? 'Common',
  };
}

function ensureEquipment(
  equipment: Partial<EquipmentContent>,
): Required<EquipmentContent> {
  return {
    id: equipment.id ?? ('UNKNOWN' as EquipmentId),
    name: equipment.name ?? 'UNKNOWN',
    __type: 'equipment',
    levelRequirement: equipment.levelRequirement ?? 1,
    rarity: equipment.rarity ?? 'Common',
    slots: equipment.slots ?? [],
    description: equipment.description ?? 'UNKNOWN',
    baseStats: ensureStats(equipment.baseStats),
    sprite: equipment.sprite ?? 'UNKNOWN',
    requiredJobIds: equipment.requiredJobIds ?? [],
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

function ensureRecipe(recipe: Partial<RecipeContent>): Required<RecipeContent> {
  return {
    id: recipe.id ?? ('UNKNOWN' as RecipeId),
    name: recipe.name ?? 'UNKNOWN',
    __type: 'recipe',
    result: recipe.result ?? { itemId: 'UNKNOWN' as ItemId, quantity: 1 },
    requirements: recipe.requirements ?? [],
    tradeskill: recipe.tradeskill ?? 'Blacksmithing',
    minTradeskillLevel: recipe.minTradeskillLevel ?? 1,
    maxTradeskillLevel: recipe.maxTradeskillLevel ?? 1,
    tradeskillXP: recipe.tradeskillXP ?? 0,
    craftTime: recipe.craftTime ?? 60,
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
    sprite: effect.sprite ?? 'UNKNOWN',
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
    techniques: skill.techniques ?? [],
    usesPerCombat: skill.usesPerCombat ?? -1,
    numTargets: skill.numTargets ?? 1,
    damageScaling: ensureStats(skill.damageScaling),
    statusEffectDurationBoost: skill.statusEffectDurationBoost ?? {},
    statusEffectChanceBoost: skill.statusEffectChanceBoost ?? {},
  };
}
