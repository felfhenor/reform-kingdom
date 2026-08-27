import {
  defaultAffinities,
  defaultCombatStats,
  defaultStats,
  defaultTagResistances,
  defaultWorkerStats,
} from '@helpers/defaults';
import type {
  AstralProjectorContent,
  AstralProjectorId,
  AstralProjectorRequirementCollectible,
  AstralProjectorRequirementMaterial,
  CaravanContent,
  CaravanId,
  CaravanTokenTrade,
  CaravanTrade,
  CaravanTraderContent,
  CaravanTraderId,
  CaravanTradeType,
  CollectibleContent,
  CollectibleId,
  CombatantCombatStats,
  CombatantStatusEffectData,
  CommissionOfferContent,
  CommissionOfferId,
  CommissionOfferRequirement,
  CommissionOfferRequirementEquipment,
  CommissionOfferRequirementItem,
  CommissionOfferSlot,
  ContentType,
  DroppedCollectibleReward,
  DroppedEquipmentReward,
  DroppedItemReward,
  DroppedRecipeReward,
  DroppedReward,
  DroppedWorkerReward,
  EncounterContent,
  EncounterFight,
  EncounterFightMonster,
  EncounterId,
  EncounterRandomContent,
  EncounterRandomId,
  EncounterRandomPoolMonster,
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
  GatheringContent,
  GatheringId,
  GatherResult,
  GatherResultItem,
  GlobalEffectContent,
  GlobalEffectEffect,
  GlobalEffectEffectDebuffResistance,
  GlobalEffectEffectGainStats,
  GlobalEffectEffectXPGainMultiplier,
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
  NodeOverrideContent,
  NodeOverrideId,
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
  StatusEffectTag,
  TradeskillContent,
  TradeskillId,
  TradeskillLevelRequirementContent,
  TradeskillLevelRequirementId,
  WorkerContent,
  WorkerId,
  WorkerStatBlock,
} from '@interfaces';
import { EquipmentTypeToSlot } from '@interfaces';

// eat my ass, typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const initializers: Record<ContentType, (entry: any) => any> = {
  astralprojector: ensureAstralProjector,
  caravan: ensureCaravan,
  caravantrader: ensureCaravanTrader,
  collectible: ensureCollectible,
  commissionoffer: ensureCommissionOffer,
  encounter: ensureEncounter,
  encounterrandom: ensureEncounterRandom,
  equipment: ensureEquipment,
  gathering: ensureGathering,
  globaleffect: ensureGlobalEffect,
  item: ensureItem,
  job: ensureJob,
  monster: ensureMonster,
  nodeoverride: ensureNodeOverride,
  recipe: ensureRecipe,
  skill: ensureSkill,
  statuseffect: ensureStatusEffect,
  tradeskill: ensureTradeskill,
  tradeskilllevelrequirement: ensureTradeskillLevelRequirement,
  worker: ensureWorker,
};

const VALID_GAME_ELEMENTS = Object.keys(defaultAffinities()) as GameElement[];
const VALID_STATUS_EFFECT_TAGS = Object.keys(
  defaultTagResistances(),
) as StatusEffectTag[];
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
const VALID_CARAVAN_TRADE_TYPES: CaravanTradeType[] = ['sell', 'buy'];
const VALID_SKILL_ATTRIBUTES: EquipmentSkillAttribute[] = [
  'BypassDefense',
  'DamagesTarget',
  'AllowPlink',
  'AllowLuckDodge',
  'HealsTarget',
  'Buff',
  'Debuff',
];

function ensureStats(statblock: Partial<StatBlock> = {}): Required<StatBlock> {
  return Object.assign({}, defaultStats(), statblock);
}

function ensureTagResistances(
  resistances: Partial<Record<StatusEffectTag, number>> = {},
): Record<StatusEffectTag, number> {
  return Object.assign({}, defaultTagResistances(), resistances);
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

export function hasContentInitializer<T extends IsContentItem>(
  content: T,
): boolean {
  return !!initializers[content.__type];
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
    infusionStats: ensureStats(item.infusionStats),
    infusionDebuffResistances: ensureTagResistances(
      item.infusionDebuffResistances,
    ),
    unobtainable: item.unobtainable ?? false,
  };
}

function ensureDroppedReward(
  reward: Partial<DroppedItemReward> &
    Partial<DroppedEquipmentReward> &
    Partial<DroppedCollectibleReward> &
    Partial<DroppedRecipeReward> &
    Partial<DroppedWorkerReward> = {},
): DroppedReward {
  if (reward.equipmentId) {
    return {
      kind: 'Equipment',
      equipmentId: reward.equipmentId,
      chance: reward.chance ?? 0,
    };
  }

  if (reward.collectibleId) {
    return {
      kind: 'Collectible',
      collectibleId: reward.collectibleId,
      chance: reward.chance ?? 0,
    };
  }

  if (reward.recipeId) {
    return {
      kind: 'Recipe',
      recipeId: reward.recipeId,
      chance: reward.chance ?? 0,
    };
  }

  if (reward.workerId) {
    return {
      kind: 'Worker',
      workerId: reward.workerId,
      chance: reward.chance ?? 0,
    };
  }

  return {
    kind: 'Item',
    itemId: reward.itemId ?? ('UNKNOWN' as ItemId),
    min: reward.min ?? 0,
    max: reward.max ?? 0,
    bonusPerLevel: reward.bonusPerLevel,
    chance: reward.chance ?? 0,
  };
}

function ensureMonsterSkill(skill: Partial<MonsterSkill> = {}): MonsterSkill {
  return {
    skillId: skill.skillId ?? ('UNKNOWN' as EquipmentSkillId),
    weight: skill.weight ?? 1,
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
    xp: monster.xp ?? { min: 0, max: 0 },
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
    hidden: encounter.hidden ?? false,
    invisibleUntilCollectibleIdsFound:
      encounter.invisibleUntilCollectibleIdsFound ?? [],
  };
}

function ensureEncounterRandomPoolMonster(
  monster: Partial<EncounterRandomPoolMonster> = {},
): EncounterRandomPoolMonster {
  return {
    monsterId: monster.monsterId ?? ('UNKNOWN' as MonsterId),
    weight: monster.weight ?? 1,
  };
}

function ensureEncounterRandom(
  encounter: Partial<EncounterRandomContent>,
): Required<EncounterRandomContent> {
  return {
    id: encounter.id ?? ('UNKNOWN' as EncounterRandomId),
    name: encounter.name ?? 'UNKNOWN',
    __type: 'encounterrandom',
    description: encounter.description ?? 'UNKNOWN',
    resetTime: encounter.resetTime ?? 3600,
    levelRange: encounter.levelRange ?? { min: 1, max: 1 },
    encounterRange: encounter.encounterRange ?? { min: 1, max: 1 },
    combatantRange: encounter.combatantRange ?? { min: 1, max: 1 },
    creaturePool: ensureArray(
      encounter.creaturePool,
      ensureEncounterRandomPoolMonster,
    ),
    fights: ensureArray(encounter.fights, ensureEncounterFight),
    completionRewards: ensureArray(
      encounter.completionRewards,
      ensureDroppedReward,
    ),
    hidden: encounter.hidden ?? false,
    invisibleUntilCollectibleIdsFound:
      encounter.invisibleUntilCollectibleIdsFound ?? [],
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
    hidden: gathering.hidden ?? false,
    invisibleUntilCollectibleIdsFound:
      gathering.invisibleUntilCollectibleIdsFound ?? [],
    workerLevelRange: gathering.workerLevelRange ?? { min: 1, max: 99 },
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
    unobtainable: collectible.unobtainable ?? false,
  };
}

function ensureCaravanTrade(trade: Partial<CaravanTrade> = {}): CaravanTrade {
  return {
    type: ensureEnumValue(trade.type, VALID_CARAVAN_TRADE_TYPES, 'sell'),
    value: trade.value ?? 0,
    itemId: trade.itemId,
    equipmentId: trade.equipmentId,
    collectibleId: trade.collectibleId,
    recipeId: trade.recipeId,
    limit: trade.limit,
    weight: trade.weight ?? 1,
  };
}

function ensureCommissionOfferSlot(
  slot: Partial<CommissionOfferSlot> = {},
): CommissionOfferSlot {
  return {
    commissionOfferId:
      slot.commissionOfferId ?? ('UNKNOWN' as CommissionOfferId),
    weight: slot.weight ?? 1,
  };
}

function ensureCaravan(
  caravan: Partial<CaravanContent>,
): Required<CaravanContent> {
  return {
    id: caravan.id ?? ('UNKNOWN' as CaravanId),
    name: caravan.name ?? 'UNKNOWN',
    __type: 'caravan',
    description: caravan.description ?? 'UNKNOWN',
    traderResetTime: caravan.traderResetTime ?? 3600,
    level: caravan.level ?? { min: 1, max: 1 },
    markupPercentages: caravan.markupPercentages ?? { sell: 0, buy: 0 },
    traderCategories: caravan.traderCategories ?? [],
    commissionOffers: ensureArray(
      caravan.commissionOffers,
      ensureCommissionOfferSlot,
    ),
    hidden: caravan.hidden ?? false,
    invisibleUntilCollectibleIdsFound:
      caravan.invisibleUntilCollectibleIdsFound ?? [],
  };
}

function ensureCaravanTokenTrade(
  trade: Partial<CaravanTokenTrade> = {},
): CaravanTokenTrade {
  return {
    tokenCost: trade.tokenCost ?? 3,
    itemId: trade.itemId,
    equipmentId: trade.equipmentId,
    collectibleId: trade.collectibleId,
    recipeId: trade.recipeId,
  };
}

function ensureCaravanTrader(
  trader: Partial<CaravanTraderContent>,
): Required<CaravanTraderContent> {
  return {
    id: trader.id ?? ('UNKNOWN' as CaravanTraderId),
    name: trader.name ?? 'UNKNOWN',
    __type: 'caravantrader',
    description: trader.description ?? 'UNKNOWN',
    category: trader.category ?? 'UNKNOWN',
    level: trader.level ?? 1,
    trades: ensureArray(trader.trades, ensureCaravanTrade),
    tokenTrades: ensureArray(trader.tokenTrades, ensureCaravanTokenTrade),
  };
}

function ensureCommissionOfferRequirement(
  requirement: Partial<CommissionOfferRequirementItem> &
    Partial<CommissionOfferRequirementEquipment> = {},
): CommissionOfferRequirement {
  if (requirement.equipmentId) {
    return {
      equipmentId: requirement.equipmentId,
      quantityMin: requirement.quantityMin ?? 1,
      quantityMax: requirement.quantityMax ?? 1,
    };
  }

  return {
    itemId: requirement.itemId ?? ('UNKNOWN' as ItemId),
    quantityMin: requirement.quantityMin ?? 1,
    quantityMax: requirement.quantityMax ?? 1,
  };
}

function ensureCommissionOffer(
  offer: Partial<CommissionOfferContent>,
): Required<CommissionOfferContent> {
  return {
    id: offer.id ?? ('UNKNOWN' as CommissionOfferId),
    name: offer.name ?? 'UNKNOWN',
    __type: 'commissionoffer',
    description: offer.description ?? 'UNKNOWN',
    requirements: ensureArray(
      offer.requirements,
      ensureCommissionOfferRequirement,
    ),
    tokenReward: offer.tokenReward ?? 1,
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
    debuffResistances: ensureTagResistances(equipment.debuffResistances),
    sprite: equipment.sprite ?? 'UNKNOWN',
    type: equipment.type ?? 'Accessory',
    // Defaults to 0, not 1 - infusion slots must always be explicitly
    // opted into at the data level. This fallback only guards against
    // malformed/legacy entries, it does not grant free slots.
    slots: equipment.slots ?? 0,
    grantedSkillIds: equipment.grantedSkillIds ?? [],
    unobtainable: equipment.unobtainable ?? false,
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
    statPriority: ensureEnumArray(job.statPriority, VALID_GAME_STATS),
    skillPath: ensureArray(job.skillPath, ensureJobSkillPath),
  };
}

function ensureWorkerStats(
  statblock: Partial<WorkerStatBlock> = {},
): Required<WorkerStatBlock> {
  return Object.assign({}, defaultWorkerStats(), statblock);
}

function ensureWorker(worker: Partial<WorkerContent>): Required<WorkerContent> {
  const baseStats = ensureWorkerStats(worker.baseStats);
  // A 0 gatherSpeed would make worker-gathering's tick formula divide by
  // zero (infinite ticks per unit) - floor the BASE value only (not
  // statsPerLevel, which can legitimately be a small or zero per-level
  // increment) so a missing/zero-authored value can never produce a
  // silent, permanent gather stall.
  baseStats.gatherSpeed = Math.max(1, baseStats.gatherSpeed);

  return {
    id: worker.id ?? ('UNKNOWN' as WorkerId),
    name: worker.name ?? 'UNKNOWN',
    __type: 'worker',
    description: worker.description ?? 'UNKNOWN',
    sprite: worker.sprite ?? 'UNKNOWN',
    frames: worker.frames ?? 4,
    baseStats,
    statsPerLevel: ensureWorkerStats(worker.statsPerLevel),
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
    tradeskillId: recipe.tradeskillId ?? ('UNKNOWN' as TradeskillId),
    minTradeskillLevel: recipe.minTradeskillLevel ?? 1,
    maxTradeskillLevel: recipe.maxTradeskillLevel ?? 1,
    tradeskillXP: recipe.tradeskillXP ?? 0,
    craftTime: recipe.craftTime ?? 60,
    tokenUnlockCost: recipe.tokenUnlockCost ?? 3,
  };
}

function ensureTradeskill(
  tradeskill: Partial<TradeskillContent>,
): Required<TradeskillContent> {
  return {
    id: tradeskill.id ?? ('UNKNOWN' as TradeskillId),
    name: tradeskill.name ?? 'UNKNOWN',
    __type: 'tradeskill',
    sprite: tradeskill.sprite ?? 'UNKNOWN',
    description: tradeskill.description ?? 'UNKNOWN',
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
        key: (behavior['key'] as keyof CombatantStatusEffectData) ?? 'isFrozen',
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
    tags: ensureEnumArray(effect.tags, VALID_STATUS_EFFECT_TAGS),
    trigger: effect.trigger ?? 'TurnStart',
    onApply: ensureArray(effect.onApply, ensureStatusEffectBehavior),
    onTick: ensureArray(effect.onTick, ensureStatusEffectBehavior),
    onUnapply: ensureArray(effect.onUnapply, ensureStatusEffectBehavior),
    statScaling: ensureStats(effect.statScaling),
    useTargetStats: effect.useTargetStats ?? false,
  };
}

function ensureGlobalEffectEffect(
  effect: Partial<GlobalEffectEffectGainStats> &
    Partial<GlobalEffectEffectXPGainMultiplier> &
    Partial<GlobalEffectEffectDebuffResistance> = {},
): GlobalEffectEffect {
  if (effect.effectType === 'GlobalXPGainMultiplier') {
    return { effectType: 'GlobalXPGainMultiplier', value: effect.value ?? 0 };
  }

  if (effect.effectType === 'DebuffResistance') {
    return { effectType: 'DebuffResistance', value: effect.value ?? 0 };
  }

  return {
    effectType: 'GainStats',
    stat: (effect.stat ?? 'Strength') as GameStat,
    value: effect.value ?? 0,
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
    effects: ensureArray(effect.effects, ensureGlobalEffectEffect),
  };
}

function ensureAstralProjectorRequirement(
  requirement: Partial<AstralProjectorRequirementCollectible> &
    Partial<AstralProjectorRequirementMaterial> = {},
): AstralProjectorRequirementCollectible | AstralProjectorRequirementMaterial {
  if (requirement.collectibleId) {
    return { collectibleId: requirement.collectibleId };
  }

  return {
    itemId: requirement.itemId ?? ('UNKNOWN' as ItemId),
    quantity: requirement.quantity ?? 1,
  };
}

function ensureAstralProjector(
  astralProjector: Partial<AstralProjectorContent>,
): Required<AstralProjectorContent> {
  return {
    id: astralProjector.id ?? ('UNKNOWN' as AstralProjectorId),
    name: astralProjector.name ?? 'UNKNOWN',
    __type: 'astralprojector',
    globalEffectId:
      astralProjector.globalEffectId ?? ('UNKNOWN' as GlobalEffectId),
    duration: astralProjector.duration ?? 60,
    requiredCollectibles: ensureArray(
      astralProjector.requiredCollectibles,
      ensureAstralProjectorRequirement,
    ) as AstralProjectorRequirementCollectible[],
    requiredMaterials: ensureArray(
      astralProjector.requiredMaterials,
      ensureAstralProjectorRequirement,
    ) as AstralProjectorRequirementMaterial[],
  };
}

function ensureNodeOverride(
  override: Partial<NodeOverrideContent>,
): Required<NodeOverrideContent> {
  return {
    id: override.id ?? ('UNKNOWN' as NodeOverrideId),
    name: override.name ?? 'UNKNOWN',
    __type: 'nodeoverride',
    description: override.description ?? 'UNKNOWN',
    hidden: override.hidden ?? false,
    invisibleUntilCollectibleIdsFound:
      override.invisibleUntilCollectibleIdsFound ?? [],
  };
}

function ensureTradeskillLevelRequirement(
  requirement: Partial<TradeskillLevelRequirementContent>,
): Required<TradeskillLevelRequirementContent> {
  return {
    id: requirement.id ?? ('UNKNOWN' as TradeskillLevelRequirementId),
    name: requirement.name ?? 'UNKNOWN',
    __type: 'tradeskilllevelrequirement',
    tradeskillId: requirement.tradeskillId ?? ('UNKNOWN' as TradeskillId),
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
    requiredWeaponTypes: ensureEnumArray(
      skill.requiredWeaponTypes,
      VALID_EQUIPMENT_ITEM_TYPES,
    ),
    family: skill.family ?? 'UNKNOWN',
  };
}
