import type { EquipmentId } from '@interfaces/content-equipment';
import type { ItemId } from '@interfaces/content-item';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { Tradeskill } from '@interfaces/tradeskill';

export type RecipeId = Branded<string, 'RecipeId'>;

export type RecipeResultItem = {
  itemId: ItemId;
  quantity: number;
  chance?: number;
};

export type RecipeResultEquipment = {
  equipmentId: EquipmentId;
  chance?: number;
};

export type RecipeResult = RecipeResultItem | RecipeResultEquipment;

export type RecipeRequirementItem = {
  itemId: ItemId;
  quantity: number;
};

export type RecipeRequirementEquipment = {
  equipmentId: EquipmentId;
};

export type RecipeRequirement =
  | RecipeRequirementItem
  | RecipeRequirementEquipment;

export type RecipeContent = IsContentItem & {
  id: RecipeId;
  __type: 'recipe';

  result: RecipeResult;
  requirements: RecipeRequirement[];

  tradeskill: Tradeskill;
  minTradeskillLevel: number;
  maxTradeskillLevel: number;
  tradeskillXP: number;
  craftTime: number;
};
