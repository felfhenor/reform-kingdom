import {
  ensureArray,
  ensureItemQuantity,
} from '@helpers/content/ensure-helpers-core';
import type {
  AstralProjectorId,
  CollectibleId,
  ItemId,
  MonsterId,
  RecipeId,
  TaskContent,
  TaskId,
  TaskRequirement,
  TownId,
  TradeskillId,
  TrainerId,
  WorkerId,
} from '@interfaces';

// Unknown kinds fall back to an unreachable level so a typo can't auto-complete a task.
export function ensureTaskRequirement(
  requirement: Record<string, unknown> = {},
): TaskRequirement {
  const id = <T>(key: string) => (requirement[key] ?? 'UNKNOWN') as T;
  const quantity = (requirement['quantity'] as number) ?? 1;
  const level = (requirement['level'] as number) ?? 1;
  const nodeName = id<string>('nodeName');

  switch (requirement['kind']) {
    case 'GatherItem':
      return {
        kind: 'GatherItem',
        nodeName,
        itemId: id<ItemId>('itemId'),
        quantity,
      };
    case 'CraftRecipe':
      return {
        kind: 'CraftRecipe',
        recipeId: id<RecipeId>('recipeId'),
        quantity,
      };
    case 'ClearEncounter':
      return { kind: 'ClearEncounter', nodeName, quantity };
    case 'CastAstralSpell':
      return {
        kind: 'CastAstralSpell',
        astralProjectorId: id<AstralProjectorId>('astralProjectorId'),
        quantity,
      };
    case 'TradeskillLevel':
      return {
        kind: 'TradeskillLevel',
        tradeskillId: id<TradeskillId>('tradeskillId'),
        level,
      };
    case 'OwnCollectible':
      return {
        kind: 'OwnCollectible',
        collectibleId: id<CollectibleId>('collectibleId'),
      };
    case 'LearnTeaching':
      return { kind: 'LearnTeaching', trainerId: id<TrainerId>('trainerId') };
    case 'RescueWorker':
      return { kind: 'RescueWorker', workerId: id<WorkerId>('workerId') };
    case 'DefeatMonster':
      return {
        kind: 'DefeatMonster',
        monsterId: id<MonsterId>('monsterId'),
        quantity,
      };
    case 'ShrineLevel':
      return { kind: 'ShrineLevel', nodeName, level };
    case 'TownReputationTier':
      return {
        kind: 'TownReputationTier',
        townId: id<TownId>('townId'),
        tier: (requirement['tier'] as number) ?? 1,
      };
    case 'VisitTown':
      return { kind: 'VisitTown', townId: id<TownId>('townId') };
    case 'InfuseEquipment':
      return { kind: 'InfuseEquipment' };
    case 'FulfillCommission':
      return { kind: 'FulfillCommission', quantity };
    case 'ReachLevel':
      return { kind: 'ReachLevel', level };
    default:
      return { kind: 'ReachLevel', level: Infinity };
  }
}

export function ensureTask(task: Partial<TaskContent>): Required<TaskContent> {
  return {
    id: task.id ?? ('UNKNOWN' as TaskId),
    name: task.name ?? 'UNKNOWN',
    __type: 'task',
    description: task.description ?? '',
    order: task.order ?? 0,
    requirement: ensureTaskRequirement(task.requirement),
    rewards: ensureArray(task.rewards, ensureItemQuantity),
  };
}
