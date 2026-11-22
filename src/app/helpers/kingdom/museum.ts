import { isTraderDiscovered } from '@helpers/caravan/caravan';
import { getEntry } from '@helpers/content/content';
import { isMonsterDiscovered } from '@helpers/kingdom/bestiary';
import { isSourceAvailableThisRun } from '@helpers/item/obtainable-this-run';
import { regionContentSources } from '@helpers/item/region-sources';
import { isTownVisited } from '@helpers/town/town-visit';
import { isWorldMapVisited } from '@helpers/world-node/world-map-discovery';
import { isWorldNodeMapVisited } from '@helpers/world-node/world-nodes';
import type {
  CollectibleSource,
  EquipmentId,
  ItemId,
  RecipeId,
  SourceTarget,
  TaskContent,
  TaskId,
} from '@interfaces';

export function contentSources(target: SourceTarget): CollectibleSource[] {
  return regionContentSources(target).filter(isSourceAvailableThisRun);
}

export function itemSources(itemId: ItemId): CollectibleSource[] {
  return contentSources({ itemId });
}

export function equipmentSources(
  equipmentId: EquipmentId,
): CollectibleSource[] {
  return contentSources({ equipmentId });
}

export function recipeSources(recipeId: RecipeId): CollectibleSource[] {
  return contentSources({ recipeId });
}

// Matches the task list, which hides a task until its map is visited.
function isTaskSourceKnown(taskId: TaskId): boolean {
  const mapName = getEntry<TaskContent>(taskId)?.requireMapVisit;
  return !mapName || isWorldMapVisited(mapName);
}

// Whether the player has been where this source is, so naming it can't spoil anything.
export function isCollectibleSourceKnown(source: CollectibleSource): boolean {
  switch (source.type) {
    case 'node':
      return isWorldNodeMapVisited(source.name);
    case 'trader':
      return isTraderDiscovered(source.traderId);
    case 'raid':
    case 'town':
    case 'townCraft':
      return isTownVisited(source.townId);
    case 'task':
      return isTaskSourceKnown(source.taskId);
    case 'crafting':
      return true;
    case 'monster':
      return isMonsterDiscovered(source.monsterId);
  }
}
