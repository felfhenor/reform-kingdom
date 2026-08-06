import {
  defaultAffinities,
  defaultCombatStats,
  defaultStats,
} from '@helpers/defaults';
import type {
  CollectibleContent,
  CollectibleId,
  CombatantCombatStats,
  CombatantStatusEffectData,
  ContentType,
  DroppedCollectibleReward,
  DroppedEquipmentReward,
  DroppedItemReward,
  DroppedRecipeReward,
  DroppedReward,
  EncounterContent,
  EncounterFight,
  EncounterFightMonster,
  EncounterId,
  EquipmentContent,
  EquipmentId,
  EquipmentItemType,
  EquipmentSkillAttribute,
  EquipmentSkillContent,
  EquipmentSkillContentTechnique,
  EquipmentSkillId,
  EquipmentSkillTargetBehavior,
  EquipmentSkillTargetBehaviorData,
  EquipmentSkillTargetType,
  EquipmentSkillTechniqueStatusEffectApplication,
  GameElement,
  GameStat,
  GatherResult,
  GatherResultItem,
  GatheringContent,
  GatheringId,
  GlobalEffectContent,
  GlobalEffectId,
  IsContentItem,
  ItemContent,
  ItemId,
  JobContent,
  JobId,
  JobSkillPath,
  JobSkillPathLevel,
  MonsterContent,
  MonsterId,
  MonsterSkill,
  RecipeContent,
  RecipeId,
  RecipeRequirement,
  RecipeRequirementCollectible,
  RecipeRequirementEquipment,
  RecipeRequirementItem,
  StatBlock,
  StatusEffectBehavior,
  StatusEffectBehaviorType,
  StatusEffectContent,
  StatusEffectId,
  TradeskillLevelRequirementContent,
  TradeskillLevelRequirementId,
  TraitContent,
  TraitId,
} from '@interfaces';
import { EquipmentTypeToSlot } from '@interfaces';

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
  statuseffect: ensureStatusEffect,
  trait: ensureTrait,
  tradeskilllevelrequirement: ensureTradeskillLevelRequirement,
};

const VALID_GAME_ELEMENTS = Object.keys(defaultAffinities()) as GameElement[];
const VALID_GAME_STATS = Object.keys(defaultStats()) as GameStat[];
const VALID_COMBAT_STATS = Object.keys(
  defaultCombatStats(),
) as (keyof CombatantCombatStats)[];
const VALID_EQUIPMENT_ITEM_TYPES = Object.keys(
  EquipmentTypeToSlot,
) as EquipmentItemType[];
const VALID_SKILL_TARGET_TYPES: EquipmentSkillTargetType[] = [
  'Allies',
  'Enemies',
  'Self',
  'All',
];
const VALID_SKILL_TARGET_BEHAVIORS: EquipmentSkillTargetBehavior[] = [
  'Always',
  'NotZeroHealth',
  'NotMaxHealth',
  'IfStatusEffect',
  'IfNotStatusEffect',
];
const VALID_SKILL_ATTRIBUTES: EquipmentSkillAttribute[] = [
  'BypassDefense',
  'DamagesTarget',
  'AllowPlink',
  'HealsTarget',
  'Buff',
  'Debuff',
];

function ensureStats(statblock: Partial<StatBlock> = {}): Required<StatBlock> {
  return Object.assign({}, defaultStats(), statblock);
}

// `ensureItemFn` is typed with `any` so every concrete `ensure*` helper can
// keep its own narrow `Partial<...>` (or union-of-partials) parameter type
// without fighting function parameter variance here.
function ensureArray<T>(
  items: unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ensureItemFn: (item: any) => T,
): T[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ensureItemFn(item ?? {}));
}

function ensureEnumArray<T extends string>(
  items: unknown,
  validValues: readonly T[],
): T[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item): item is T => validValues.includes(item as T));
}

function ensureEnumValue<T extends string>(
  value: unknown,
  validValues: readonly T[],
  fallback: T,
): T {
  return validValues.includes(value as T) ? (value as T) : fallback;
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
    unobtainable: item.unobtainable ?? false,
  };
}

function ensureDroppedReward(
  reward: Partial<DroppedItemReward> &
    Partial<DroppedEquipmentReward> &
    Partial<DroppedCollectibleReward> &
    Partial<DroppedRecipeReward> = {},
): DroppedReward {
  if (reward.equipmentId) {
    return {
      equipmentId: reward.equipmentId,
      chance: reward.chance ?? 0,
    };
  }

  if (reward.collectibleId) {
    return {
      collectibleId: reward.collectibleId,
      chance: reward.chance ?? 0,
    };
  }

  if (reward.recipeId) {
    return {
      recipeId: reward.recipeId,
      chance: reward.chance ?? 0,
    };
  }

  return {
    itemId: reward.itemId ?? ('UNKNOWN' as ItemId),
    min: reward.min ?? 0,
    max: reward.max ?? 0,
    multiplierPerLevel: reward.multiplierPerLevel ?? 1,
    chance: reward.chance ?? 0,
  };
}

function ensureMonsterSkill(skill: Partial<MonsterSkill> = {}): MonsterSkill {
  return {
    skillId: skill.skillId ?? ('UNKNOWN' as EquipmentSkillId),
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
    drops: ensureArray(monster.drops, ensureDroppedReward),
    skills: ensureArray(monster.skills, ensureMonsterSkill),
  };
}

function ensureEncounterFightMonster(
  monster: Partial<EncounterFightMonster> = {},
): EncounterFightMonster {
  return {
    monsterId: monster.monsterId ?? ('UNKNOWN' as MonsterId),
  };
}

function ensureEncounterFight(
  fight: Partial<EncounterFight> = {},
): EncounterFight {
  return {
    monsters: ensureArray(fight.monsters, ensureEncounterFightMonster),
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
    fights: ensureArray(encounter.fights, ensureEncounterFight),
    completionRewards: ensureArray(
      encounter.completionRewards,
      ensureDroppedReward,
    ),
  };
}

function ensureGatherResultItem(
  item: Partial<GatherResultItem> = {},
): GatherResultItem {
  return {
    itemId: item.itemId ?? ('UNKNOWN' as ItemId),
    quantity: item.quantity ?? 1,
  };
}

function ensureGatherResult(result: Partial<GatherResult> = {}): GatherResult {
  return {
    chance: result.chance ?? 0,
    items: ensureArray(result.items, ensureGatherResultItem),
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
    gatherResults: ensureArray(gathering.gatherResults, ensureGatherResult),
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
    description: equipment.description ?? 'UNKNOWN',
    baseStats: ensureStats(equipment.baseStats),
    sprite: equipment.sprite ?? 'UNKNOWN',
    type: equipment.type ?? 'Accessory',
  };
}

function ensureJobSkillPathLevel(
  level: Partial<JobSkillPathLevel> = {},
): JobSkillPathLevel {
  return {
    level: level.level ?? 1,
    skillId: level.skillId ?? ('UNKNOWN' as EquipmentSkillId),
  };
}

function ensureJobSkillPath(path: Partial<JobSkillPath> = {}): JobSkillPath {
  return {
    pathName: path.pathName ?? 'UNKNOWN',
    levels: ensureArray(path.levels, ensureJobSkillPathLevel),
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
    equippableTypes: ensureEnumArray(
      job.equippableTypes,
      VALID_EQUIPMENT_ITEM_TYPES,
    ),
    skillPath: ensureArray(job.skillPath, ensureJobSkillPath),
  };
}

function ensureRecipeRequirement(
  requirement: Partial<RecipeRequirementItem> &
    Partial<RecipeRequirementEquipment> &
    Partial<RecipeRequirementCollectible> = {},
): RecipeRequirement {
  if (requirement.equipmentId) {
    return { equipmentId: requirement.equipmentId };
  }

  if (requirement.collectibleId) {
    return { collectibleId: requirement.collectibleId };
  }

  return {
    itemId: requirement.itemId ?? ('UNKNOWN' as ItemId),
    quantity: requirement.quantity ?? 1,
  };
}

function ensureRecipe(recipe: Partial<RecipeContent>): Required<RecipeContent> {
  return {
    id: recipe.id ?? ('UNKNOWN' as RecipeId),
    name: recipe.name ?? 'UNKNOWN',
    __type: 'recipe',
    result: recipe.result ?? { itemId: 'UNKNOWN' as ItemId, quantity: 1 },
    requirements: ensureArray(recipe.requirements, ensureRecipeRequirement),
    tradeskill: recipe.tradeskill ?? 'Blacksmithing',
    minTradeskillLevel: recipe.minTradeskillLevel ?? 1,
    maxTradeskillLevel: recipe.maxTradeskillLevel ?? 1,
    tradeskillXP: recipe.tradeskillXP ?? 0,
    craftTime: recipe.craftTime ?? 60,
  };
}

function ensureStatusEffectBehavior(
  behavior: Record<string, unknown> = {},
): StatusEffectBehavior {
  const type = behavior['type'] as StatusEffectBehaviorType;
  const combatMessage = behavior['combatMessage'] as string | undefined;

  switch (type) {
    case 'AddDamageToStat':
    case 'TakeDamageFromStat':
      return {
        type,
        combatMessage,
        modifyStat: ensureEnumValue(
          behavior['modifyStat'],
          VALID_GAME_STATS,
          'Strength',
        ),
      };

    case 'AddCombatStatElement':
    case 'TakeCombatStatElement':
      return {
        type,
        combatMessage,
        combatStat: ensureEnumValue(
          behavior['combatStat'],
          VALID_COMBAT_STATS,
          'repeatActionChance',
        ),
        element: ensureEnumValue(
          behavior['element'],
          VALID_GAME_ELEMENTS,
          'Fire',
        ),
        value: (behavior['value'] as number) ?? 0,
      };

    case 'AddCombatStatNumber':
    case 'TakeCombatStatNumber':
      return {
        type,
        combatMessage,
        combatStat: ensureEnumValue(
          behavior['combatStat'],
          VALID_COMBAT_STATS,
          'repeatActionChance',
        ),
        value: (behavior['value'] as number) ?? 0,
      };

    case 'ModifyStatusEffectData':
      return {
        type,
        combatMessage,
        key:
          (behavior['key'] as keyof CombatantStatusEffectData) ?? 'isFrozen',
        value: (behavior['value'] as boolean) ?? false,
      };

    case 'HealDamage':
    case 'TakeDamage':
      return { type, combatMessage };

    default:
      return {
        type: 'SendMessage',
        combatMessage: combatMessage ?? 'UNKNOWN',
      };
  }
}

function ensureStatusEffect(
  effect: Partial<StatusEffectContent>,
): Required<StatusEffectContent> {
  return {
    id: effect.id ?? ('UNKNOWN' as StatusEffectId),
    name: effect.name ?? 'UNKNOWN',
    __type: 'statuseffect',
    effectType: effect.effectType ?? 'Buff',
    elements: ensureEnumArray(effect.elements, VALID_GAME_ELEMENTS),
    trigger: effect.trigger ?? 'TurnStart',
    onApply: ensureArray(effect.onApply, ensureStatusEffectBehavior),
    onTick: ensureArray(effect.onTick, ensureStatusEffectBehavior),
    onUnapply: ensureArray(effect.onUnapply, ensureStatusEffectBehavior),
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

function ensureTradeskillLevelRequirement(
  requirement: Partial<TradeskillLevelRequirementContent>,
): Required<TradeskillLevelRequirementContent> {
  return {
    id: requirement.id ?? ('UNKNOWN' as TradeskillLevelRequirementId),
    name: requirement.name ?? 'UNKNOWN',
    __type: 'tradeskilllevelrequirement',
    tradeskill: requirement.tradeskill ?? 'Blacksmithing',
    level: requirement.level ?? 1,
    requiredCollectibleId:
      requirement.requiredCollectibleId ?? ('UNKNOWN' as CollectibleId),
  };
}

function ensureEquipmentSkillTargetBehaviorData(
  behavior: Partial<EquipmentSkillTargetBehaviorData> = {},
): EquipmentSkillTargetBehaviorData {
  return {
    behavior: ensureEnumValue(
      behavior.behavior,
      VALID_SKILL_TARGET_BEHAVIORS,
      'Always',
    ),
    statusEffectId: behavior.statusEffectId,
  };
}

function ensureEquipmentSkillTechniqueStatusEffectApplication(
  effect: Partial<EquipmentSkillTechniqueStatusEffectApplication> = {},
): EquipmentSkillTechniqueStatusEffectApplication {
  return {
    statusEffectId: effect.statusEffectId ?? ('UNKNOWN' as StatusEffectId),
    chance: effect.chance ?? 0,
    duration: effect.duration ?? 1,
  };
}

function ensureEquipmentSkillTechnique(
  technique: Partial<EquipmentSkillContentTechnique> = {},
): EquipmentSkillContentTechnique {
  return {
    targets: technique.targets ?? 1,
    targetType: ensureEnumValue(
      technique.targetType,
      VALID_SKILL_TARGET_TYPES,
      'Enemies',
    ),
    targetBehaviors: ensureArray(
      technique.targetBehaviors,
      ensureEquipmentSkillTargetBehaviorData,
    ),
    damageScaling: ensureStats(technique.damageScaling),
    elements: ensureEnumArray(technique.elements, VALID_GAME_ELEMENTS),
    attributes: ensureEnumArray(technique.attributes, VALID_SKILL_ATTRIBUTES),
    statusEffects: ensureArray(
      technique.statusEffects,
      ensureEquipmentSkillTechniqueStatusEffectApplication,
    ),
    combatMessage: technique.combatMessage ?? 'UNKNOWN',
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
    rarity: skill.rarity ?? 'Common',
    techniques: ensureArray(skill.techniques, ensureEquipmentSkillTechnique),
    usesPerCombat: skill.usesPerCombat ?? -1,
    epCost: skill.epCost ?? 0,
    statusEffectDurationBoost: skill.statusEffectDurationBoost ?? {},
    statusEffectChanceBoost: skill.statusEffectChanceBoost ?? {},
  };
}
