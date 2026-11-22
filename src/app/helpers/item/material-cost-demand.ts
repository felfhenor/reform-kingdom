import { allContentById, getEntriesByType } from '@helpers/content/content';
import { globalEffectSumsState } from '@helpers/state-game';
import { WORLD_NODE_DEVELOPABLE_TYPES } from '@helpers/world-node/world-node-development-state';
import { isWorldNodeTypeRemoved } from '@helpers/world-node/world-nodes';
import type {
  AstralProjectorContent,
  CostItem,
  ItemId,
  MaterialCostDemand,
  MaterialCostDemandCache,
  TrainerTeachingContent,
  WorldNodeDevelopableContent,
} from '@interfaces';
import { WORLD_NODE_TYPE_BY_CONTENT_TYPE } from '@interfaces';

function developmentCosts(): CostItem[] {
  return WORLD_NODE_DEVELOPABLE_TYPES.filter(
    (type) => !isWorldNodeTypeRemoved(WORLD_NODE_TYPE_BY_CONTENT_TYPE[type]),
  ).flatMap((type) =>
    getEntriesByType<WorldNodeDevelopableContent>(type).flatMap((content) =>
      content.levels.flatMap((level) => level.costs),
    ),
  );
}

function nonRecipeCosts(): CostItem[] {
  return [
    ...developmentCosts(),
    ...getEntriesByType<TrainerTeachingContent>('trainerteaching').flatMap(
      (teaching) => teaching.costs,
    ),
    ...getEntriesByType<AstralProjectorContent>('astralprojector').flatMap(
      (projector) =>
        projector.requiredMaterials.map(({ itemId, quantity }) => ({
          itemId,
          required: quantity,
        })),
    ),
  ];
}

let demandCache: MaterialCostDemandCache | undefined;

// Removed node types' costs don't count, so it follows this run's edicts.
export function materialCostDemand(): Map<ItemId, MaterialCostDemand> {
  const content = allContentById();
  const sums = globalEffectSumsState();
  if (demandCache?.content === content && demandCache.sums === sums) {
    return demandCache.byItem;
  }

  const byItem = new Map<ItemId, MaterialCostDemand>();
  nonRecipeCosts().forEach(({ itemId, required }) => {
    const current = byItem.get(itemId) ?? { total: 0, largest: 0 };
    byItem.set(itemId, {
      total: current.total + required,
      largest: Math.max(current.largest, required),
    });
  });
  demandCache = { content, sums, byItem };
  return byItem;
}
