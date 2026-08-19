import type { CollectibleId } from '@interfaces/content-collectible';
import type { EquipmentId } from '@interfaces/content-equipment';
import type { ItemId } from '@interfaces/content-item';
import type { TradeskillId } from '@interfaces/content-tradeskill';
import type { Branded, IsContentItem } from '@interfaces/identifiable';

export type RecipeId = Branded<string, 'RecipeId'>;

export type RecipeResultItem = {
  itemId: ItemId;
  // Defaults to 1 when omitted - some recipes (e.g. a bonus-material chance
  // roll) only specify `chance`.
  quantity?: number;
  chance?: number;
};

export type RecipeResultEquipment = {
  equipmentId: EquipmentId;
  chance?: number;
};

export type RecipeResultCollectible = {
  collectibleId: CollectibleId;
  chance?: number;
};

export type RecipeResult =
  | RecipeResultItem
  | RecipeResultEquipment
  | RecipeResultCollectible;

export type RecipeRequirementItem = {
  itemId: ItemId;
  quantity: number;
};

export type RecipeRequirementEquipment = {
  equipmentId: EquipmentId;
};

// Gates crafting on owning a collectible without consuming it - e.g. a
// recipe that requires a tool or blueprint you keep.
export type RecipeRequirementCollectible = {
  collectibleId: CollectibleId;
};

export type RecipeRequirement =
  | RecipeRequirementItem
  | RecipeRequirementEquipment
  | RecipeRequirementCollectible;

export type RecipeContent = IsContentItem & {
  id: RecipeId;
  __type: 'recipe';

  result: RecipeResult;
  requirements: RecipeRequirement[];

  tradeskillId: TradeskillId;
  minTradeskillLevel: number;
  maxTradeskillLevel: number;
  tradeskillXP: number;
  craftTime: number;
};
