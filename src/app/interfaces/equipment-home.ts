import type {
  EquipmentContent,
  EquipmentId,
} from '@interfaces/content-equipment';
import type { ItemContent, ItemId } from '@interfaces/content-item';
import type { MonsterId } from '@interfaces/content-monster';
import type { RecipeContent } from '@interfaces/content-recipe';
import type { WorldNodeEntry } from '@interfaces/world-nodes';

export type MaterialSource = {
  mapName: string;
  level: number;
};

export type EquipmentHomeContext = {
  monsterNodes: Map<MonsterId, WorldNodeEntry[]>;
  recipes: Map<string, RecipeContent[]>;
  memo: Map<string, MaterialSource | undefined>;
  visiting: Set<string>;
  cycleCuts: number;
};

export type EquipmentHomeGearCache = {
  content: object;
  lookup: object;
  byMap: Map<string, EquipmentContent[]>;
  materialsByMap: Map<string, CraftedMaterialHome[]>;
  gearHomeById: Map<EquipmentId, string>;
  materialHomeById: Map<ItemId, CraftedMaterialHome>;
};

export type CraftedMaterialHome = MaterialSource & {
  item: ItemContent;
};

export type MaterialCostDemand = {
  total: number;
  largest: number;
};

export type MaterialCostDemandCache = {
  content: object;
  sums: object;
  byItem: Map<ItemId, MaterialCostDemand>;
};

export type ObtainableContext = {
  includeTasks: boolean;
  memo: Map<string, boolean>;
  visiting: Set<string>;
  cycleCuts: number;
};

export type ObtainableRunCache = {
  content: object;
  lookup: object;
  sums: object;
  withTasks: ObtainableContext;
  withoutTasks: ObtainableContext;
  developmentCaps: Map<string, number>;
};
