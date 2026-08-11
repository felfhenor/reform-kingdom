import { computed } from '@angular/core';
import { isEquipmentDiscovered } from '@helpers/armory';
import { isCollectibleDiscovered } from '@helpers/collectibles';
import { getEntry } from '@helpers/content';
import {
  encounterRandomIsAvailable,
  encounterRandomState,
  encounterRandomTimerLabel,
} from '@helpers/encounter-random';
import { isGatherNodeDiscovered } from '@helpers/gather-node-discovery';
import { allMaps, getMap } from '@helpers/maps';
import { isMaterialDiscovered } from '@helpers/materials';
import { monstersFromFights } from '@helpers/monster';
import {
  isRecipeDiscovered,
  recipeResultContent,
  recipeResultSpritesheet,
} from '@helpers/recipes';
import { tiledMapGetLayer, tiledObjectSpriteFrame } from '@helpers/tiled-map';
import type {
  CollectibleContent,
  DroppedReward,
  EncounterContent,
  EncounterLevelRange,
  EncounterRandomContent,
  EncounterRandomFight,
  EquipmentContent,
  GameMap,
  GatheringContent,
  ItemContent,
  ItemId,
  MaterialId,
  MonsterContent,
  NodeOverrideContent,
  RecipeContent,
  RewardContentInfo,
  RewardIdentity,
  TiledMap,
  TiledObject,
  TiledObjectSpriteFrame,
  WorldNodeCompletionRewardProgress,
  WorldNodeEntry,
  WorldNodeInteractionKind,
  WorldNodeLabelInfo,
  WorldNodeLookup,
  WorldNodeNameMap,
  WorldNodePositionMap,
  WorldNodeType,
} from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

const NODE_LAYER_NAMES = ['Explore Nodes', 'Other Nodes'];

function tiledObjectTilePosition(
  map: TiledMap,
  object: TiledObject,
): { x: number; y: number } {
  return {
    x: Math.floor(object.x / map.tilewidth),
    y: Math.floor(object.y / map.tileheight) - 1,
  };
}

export function worldNodeMapsBuild(
  maps: Map<string, GameMap>,
): WorldNodeLookup {
  const byPosition: WorldNodePositionMap = {};
  const byName: WorldNodeNameMap = {};

  maps.forEach((gameMap, mapName) => {
    const tiledMap = gameMap.data as TiledMap;

    NODE_LAYER_NAMES.forEach((layerName) => {
      const layer = tiledMapGetLayer(tiledMap, layerName);

      (layer?.objects ?? []).forEach((object) => {
        const { x, y } = tiledObjectTilePosition(tiledMap, object);
        const entry: WorldNodeEntry = {
          mapName,
          x,
          y,
          nodeName: object.name,
          nodeData: object,
        };

        byPosition[mapName] ??= {};
        byPosition[mapName][x] ??= {};
        byPosition[mapName][x][y] = entry;

        byName[object.name] = entry;
      });
    });
  });

  return { byPosition, byName };
}

export const worldNodeLookup = computed(() => worldNodeMapsBuild(allMaps()));

export function worldNodeAt(
  mapName: string,
  x: number,
  y: number,
): WorldNodeEntry | undefined {
  return worldNodeLookup().byPosition[mapName]?.[x]?.[y];
}

export function worldNodeByName(nodeName: string): WorldNodeEntry | undefined {
  return worldNodeLookup().byName[nodeName];
}

export function worldNodesOfType(type: WorldNodeType): WorldNodeEntry[] {
  return Object.values(worldNodeLookup().byName).filter(
    (entry) => entry.nodeData.type === type,
  );
}

export function worldNodeEncounter(
  entry: WorldNodeEntry,
): EncounterContent | undefined {
  const content = getEntry<EncounterContent>(entry.nodeName);
  return content?.__type === 'encounter' ? content : undefined;
}

export function worldNodeGathering(
  entry: WorldNodeEntry,
): GatheringContent | undefined {
  const content = getEntry<GatheringContent>(entry.nodeName);
  return content?.__type === 'gathering' ? content : undefined;
}

export function worldNodeEncounterRandom(
  entry: WorldNodeEntry,
): EncounterRandomContent | undefined {
  const content = getEntry<EncounterRandomContent>(entry.nodeName);
  return content?.__type === 'encounterrandom' ? content : undefined;
}

// A manually-authored override for a node's displayed data - lets a node
// (e.g. a Kingdom node like the Duchy of Carrina) have text like a
// description without needing to be backed by an Encounter/Gathering entry.
export function worldNodeOverride(
  entry: WorldNodeEntry,
): NodeOverrideContent | undefined {
  const content = getEntry<NodeOverrideContent>(entry.nodeName);
  return content?.__type === 'nodeoverride' ? content : undefined;
}

export function worldNodeLevelRange(
  entry: WorldNodeEntry,
): EncounterLevelRange | undefined {
  return (
    worldNodeEncounter(entry)?.levelRange ??
    worldNodeGathering(entry)?.levelRange ??
    worldNodeEncounterRandom(entry)?.levelRange
  );
}

export function worldNodeLevelLabel(levelRange: EncounterLevelRange): string {
  return `${levelRange.min}-${levelRange.max}`;
}

// Every clickable node type maps to one of three things a player can do at
// it - this is what the always-on map label (see `pixiIndicatorNodeLabelCreate`)
// communicates so players can tell interactable nodes apart at a glance
// without opening each one.
export function worldNodeInteractionKind(
  entry: WorldNodeEntry,
): WorldNodeInteractionKind | undefined {
  switch (entry.nodeData.type) {
    case 'GatherNode':
      return 'Gather';
    case 'ExploreNode':
      return 'Explore';
    case 'ExploreRandomNode':
      return 'ExploreRandom';
    case 'TeleportNode':
    case 'Kingdom':
      return 'Travel';
    default:
      return undefined;
  }
}

export function worldNodeExploreRandomIsAvailable(
  entry: WorldNodeEntry,
): boolean {
  const content = worldNodeEncounterRandom(entry);
  if (!content) return false;

  return encounterRandomIsAvailable(content, encounterRandomState(content.id));
}

export function worldNodeExploreRandomTimerText(
  entry: WorldNodeEntry,
): string | undefined {
  const content = worldNodeEncounterRandom(entry);
  if (!content) return undefined;

  return encounterRandomTimerLabel(content, encounterRandomState(content.id));
}

export function worldNodeLabelInfo(
  entry: WorldNodeEntry,
): WorldNodeLabelInfo | undefined {
  const kind = worldNodeInteractionKind(entry);
  if (!kind) return undefined;

  const levelRange = worldNodeLevelRange(entry);
  const lines = [entry.nodeName];
  if (levelRange) lines.push(`Lv.${worldNodeLevelLabel(levelRange)}`);

  if (kind === 'ExploreRandom') {
    const timerText = worldNodeExploreRandomTimerText(entry);
    if (timerText) lines.unshift(timerText);
  }

  return { kind, text: lines.join('\n') };
}

// For an `ExploreRandomNode`, the encounter's `fights` are always empty as
// authored - the real, currently-locked-in fight list lives in generated
// game state instead (see `encounterRandomState`).
function worldNodeExploreRandomFights(
  entry: WorldNodeEntry,
): EncounterRandomFight[] | undefined {
  const content = worldNodeEncounterRandom(entry);
  if (!content) return undefined;

  return encounterRandomState(content.id)?.fights;
}

export function worldNodeEncounterCount(
  entry: WorldNodeEntry,
): number | undefined {
  const encounter = worldNodeEncounter(entry);
  if (encounter) return encounter.fights.length;

  return worldNodeExploreRandomFights(entry)?.length;
}

export function worldNodeMonsterCount(
  entry: WorldNodeEntry,
): number | undefined {
  const encounter = worldNodeEncounter(entry);
  if (encounter) return sumBy(encounter.fights, (fight) => fight.monsters.length);

  const fights = worldNodeExploreRandomFights(entry);
  return fights ? sumBy(fights, (fight) => fight.monsters.length) : undefined;
}

export function worldNodeMonsters(entry: WorldNodeEntry): MonsterContent[] {
  const encounter = worldNodeEncounter(entry);
  const fights = encounter ? encounter.fights : worldNodeExploreRandomFights(entry);

  return fights ? monstersFromFights(fights) : [];
}

export function worldNodeGatherTime(entry: WorldNodeEntry): number | undefined {
  return worldNodeGathering(entry)?.gatherTime;
}

export function worldNodeGatherMaterialIds(entry: WorldNodeEntry): ItemId[] {
  const gathering = worldNodeGathering(entry);
  if (!gathering) return [];

  const ids = new Set<ItemId>();
  gathering.gatherResults.forEach((result) => {
    result.items.forEach((item) => ids.add(item.itemId));
  });

  return [...ids];
}

// Every material obtainable from a GatherNode the player has actually
// visited before - the data source for the auto-mode "gather material"
// clause picker. Deliberately narrower than "every GatherNode in the
// world": a material that's only reachable from a node the player hasn't
// found yet (and might otherwise also be craftable) shouldn't be offered as
// a gather target before they've discovered where it actually comes from.
export function gatherableMaterialIds(): MaterialId[] {
  const ids = new Set<MaterialId>();

  worldNodesOfType('GatherNode')
    .filter((entry) => isGatherNodeDiscovered(entry.nodeName))
    .forEach((entry) => {
      worldNodeGatherMaterialIds(entry).forEach((id) => ids.add(id as MaterialId));
    });

  return [...ids];
}

export function worldNodeDescription(
  entry: WorldNodeEntry,
): string | undefined {
  return (
    worldNodeOverride(entry)?.description ??
    worldNodeEncounter(entry)?.description ??
    worldNodeGathering(entry)?.description ??
    worldNodeEncounterRandom(entry)?.description
  );
}

// A stable identity for a reward, used to de-dupe the preview list below -
// mirrors how `worldNodeGatherMaterialIds` de-dupes by itemId via a `Set`.
// Takes the bare `RewardIdentity` shape rather than a full `DroppedReward` so
// it can also key a reward a caller only has an id for (e.g. a Decree
// clause's stored farm target) - any `DroppedReward` is still accepted,
// since it's structurally a `RewardIdentity` plus extra odds/quantity fields.
export function rewardKey(reward: RewardIdentity): string {
  if ('itemId' in reward) return `item:${reward.itemId}`;
  if ('equipmentId' in reward) return `equipment:${reward.equipmentId}`;
  if ('recipeId' in reward) return `recipe:${reward.recipeId}`;
  return `collectible:${reward.collectibleId}`;
}

// The map tile this node renders as - the same sprite `map-node-panel` shows
// for the currently-selected node, resolved here so any UI that lists nodes
// off-map (e.g. the Farm Node clause's node picker) can show it too.
export function worldNodeSpriteFrame(
  entry: WorldNodeEntry,
): TiledObjectSpriteFrame | undefined {
  const map = getMap(entry.mapName)?.data as TiledMap | undefined;
  if (!map) return undefined;

  return tiledObjectSpriteFrame(map, entry.nodeData);
}

// Resolves a reward down to displayable content - the same fields
// `CompletionRewardSlotComponent` shows, minus discovery-gating, for UI that
// needs a reward's icon/name without also needing its drop odds (e.g. the
// Farm Node clause's reward picker and its row/summary display).
export function rewardContentInfo(
  reward: RewardIdentity,
): RewardContentInfo | undefined {
  if ('itemId' in reward) {
    const item = getEntry<ItemContent>(reward.itemId);
    return item
      ? { name: item.name, sprite: item.sprite, spritesheet: 'item' }
      : undefined;
  }

  if ('equipmentId' in reward) {
    const equipment = getEntry<EquipmentContent>(reward.equipmentId);
    return equipment
      ? { name: equipment.name, sprite: equipment.sprite, spritesheet: 'equipment' }
      : undefined;
  }

  if ('collectibleId' in reward) {
    const collectible = getEntry<CollectibleContent>(reward.collectibleId);
    return collectible
      ? { name: collectible.name, sprite: collectible.sprite, spritesheet: 'collectible' }
      : undefined;
  }

  const recipe = getEntry<RecipeContent>(reward.recipeId);
  if (!recipe) return undefined;

  // The recipe's own name (not its crafted result's) - a recipe reward
  // grants the blueprint, not the item, and recipe names already carry a
  // "Category: Item" naming convention (e.g. "Equipment: Bone-Hewn Cloak")
  // that calls this out. Sprite/spritesheet still borrow the result, since a
  // recipe has no icon of its own.
  const result = recipeResultContent(recipe);
  return result
    ? {
        name: recipe.name,
        sprite: result.sprite,
        spritesheet: recipeResultSpritesheet(recipe),
      }
    : undefined;
}

function isGoldCoinReward(reward: DroppedReward): boolean {
  if (!('itemId' in reward)) return false;
  return reward.itemId === getEntry<ItemContent>('Gold Coin')?.id;
}

// The distinct completion rewards an encounter can grant, excluding Gold
// Coin (which isn't tracked as a "reward" for discovery/preview purposes)
// and de-duplicated by reward identity.
export function worldNodeCompletionRewards(
  entry: WorldNodeEntry,
): DroppedReward[] {
  const completionRewards =
    worldNodeEncounter(entry)?.completionRewards ??
    worldNodeEncounterRandom(entry)?.completionRewards;
  if (!completionRewards) return [];

  const seen = new Set<string>();
  const rewards: DroppedReward[] = [];

  completionRewards.forEach((reward) => {
    if (isGoldCoinReward(reward)) return;

    const key = rewardKey(reward);
    if (seen.has(key)) return;

    seen.add(key);
    rewards.push(reward);
  });

  return rewards;
}

function isRewardDiscovered(reward: DroppedReward): boolean {
  if ('itemId' in reward) return isMaterialDiscovered(reward.itemId);
  if ('equipmentId' in reward) return isEquipmentDiscovered(reward.equipmentId);
  if ('recipeId' in reward) return isRecipeDiscovered(reward.recipeId);
  return isCollectibleDiscovered(reward.collectibleId);
}

// How many of an encounter's completion rewards the player has ever
// obtained, out of the total - used for the "X/Y Rewards" info-popup badge.
export function worldNodeCompletionRewardProgress(
  entry: WorldNodeEntry,
): WorldNodeCompletionRewardProgress {
  const rewards = worldNodeCompletionRewards(entry);

  return {
    obtained: rewards.filter(isRewardDiscovered).length,
    total: rewards.length,
  };
}
