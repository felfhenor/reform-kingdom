import {
  allContentById,
  getEntriesByType,
  getEntry,
} from '@helpers/content/content';
import { isRecipeTownUnique } from '@helpers/crafting/recipe-town-unique';
import {
  baseContentSources,
  isCraftedOnly,
  isRepeatableSource,
  sourceMatchesTarget,
  sourceTargetKey,
} from '@helpers/item/content-sources';
import { worldNodeMonsterIds } from '@helpers/world-node/world-node-monster-drops';
import { worldNodeLevelRange } from '@helpers/world-node/world-node-status';
import {
  worldNodeByName,
  worldNodeLookup,
} from '@helpers/world-node/world-nodes';
import type {
  CollectibleSource,
  CraftedMaterialHome,
  EquipmentContent,
  EquipmentHomeContext,
  EquipmentHomeGearCache,
  EquipmentId,
  ItemContent,
  ItemId,
  MaterialSource,
  MonsterContent,
  MonsterId,
  RecipeContent,
  SourceTarget,
  WorldNodeEntry,
} from '@interfaces';
import { maxBy, minBy, uniq } from 'es-toolkit/compat';

function monsterNodesBuild(): Map<MonsterId, WorldNodeEntry[]> {
  const byMonster = new Map<MonsterId, WorldNodeEntry[]>();
  Object.values(worldNodeLookup().byName).forEach((entry) =>
    uniq(worldNodeMonsterIds(entry)).forEach((monsterId) =>
      byMonster.set(monsterId, [...(byMonster.get(monsterId) ?? []), entry]),
    ),
  );
  return byMonster;
}

function nodeLocation(entry: WorldNodeEntry | undefined): MaterialSource[] {
  const range = entry ? worldNodeLevelRange(entry) : undefined;
  return entry && range ? [{ mapName: entry.mapName, level: range.min }] : [];
}

// Each node the monster fights at, from the lowest level its drop row rolls there.
function monsterLocations(
  monsterId: MonsterId,
  target: SourceTarget,
  context: EquipmentHomeContext,
): MaterialSource[] {
  const drops = (getEntry<MonsterContent>(monsterId)?.drops ?? []).filter(
    (row) => sourceMatchesTarget(row, target),
  );

  return (context.monsterNodes.get(monsterId) ?? []).flatMap((entry) => {
    const range = worldNodeLevelRange(entry);
    if (!range) return [];
    return drops
      .filter(
        (drop) => drop.maxLevel >= range.min && drop.minLevel <= range.max,
      )
      .map((drop) => ({
        mapName: entry.mapName,
        level: Math.max(range.min, drop.minLevel),
      }));
  });
}

function sourceLocations(
  source: CollectibleSource,
  target: SourceTarget,
  context: EquipmentHomeContext,
): MaterialSource[] {
  if (!isRepeatableSource(source)) return [];
  if (source.type === 'node') return nodeLocation(worldNodeByName(source.name));
  if (source.type === 'monster') {
    return monsterLocations(source.monsterId, target, context);
  }
  return [];
}

// The lowest-level place on a map that keeps producing it; traders roam, so they have no place.
function directEarliest(
  target: SourceTarget,
  context: EquipmentHomeContext,
): MaterialSource | undefined {
  const locations = baseContentSources(target).flatMap((source) =>
    sourceLocations(source, target, context),
  );
  return minBy(locations, (location) => location.level);
}

function playerRecipesByResult(): Map<string, RecipeContent[]> {
  const byResult = new Map<string, RecipeContent[]>();
  getEntriesByType<RecipeContent>('recipe').forEach((recipe) => {
    if (isRecipeTownUnique(recipe.id)) return;
    const key = sourceTargetKey(recipe.result);
    byResult.set(key, [...(byResult.get(key) ?? []), recipe]);
  });
  return byResult;
}

// A recipe is obtainable once its latest sourced ingredient is; unsourced ones (shop goods, collectibles) don't count.
function recipeEarliest(
  recipe: RecipeContent,
  context: EquipmentHomeContext,
): MaterialSource | undefined {
  const sources = recipe.requirements.flatMap((requirement) => {
    const target: SourceTarget | undefined =
      'itemId' in requirement
        ? { itemId: requirement.itemId }
        : 'equipmentId' in requirement
          ? { equipmentId: requirement.equipmentId }
          : undefined;
    const source = target ? sourceEarliest(target, context) : undefined;
    return source ? [source] : [];
  });
  return maxBy(sources, (source) => source.level);
}

function sourceEarliest(
  target: SourceTarget,
  context: EquipmentHomeContext,
): MaterialSource | undefined {
  const id = sourceTargetKey(target);
  if (context.memo.has(id)) return context.memo.get(id);
  if (context.visiting.has(id)) {
    context.cycleCuts += 1;
    return undefined;
  }

  const cutsBefore = context.cycleCuts;
  context.visiting.add(id);
  const candidates = [
    directEarliest(target, context),
    ...(context.recipes.get(id) ?? []).map((recipe) =>
      recipeEarliest(recipe, context),
    ),
  ].filter((source): source is MaterialSource => !!source);
  context.visiting.delete(id);

  const earliest = minBy(candidates, (source) => source.level);
  // A result computed past a cut cycle may be missing a source, so it isn't final.
  if (context.cycleCuts === cutsBefore) context.memo.set(id, earliest);
  return earliest;
}

// The latest ingredient of its earliest player recipe, so late gear with early ingredients stays late.
function craftedHomeSource(
  target: SourceTarget,
  context: EquipmentHomeContext,
): MaterialSource | undefined {
  const sources = (context.recipes.get(sourceTargetKey(target)) ?? [])
    .map((recipe) => recipeEarliest(recipe, context))
    .filter((source): source is MaterialSource => !!source);
  return minBy(sources, (source) => source.level);
}

function homeContextBuild(): EquipmentHomeContext {
  return {
    monsterNodes: monsterNodesBuild(),
    recipes: playerRecipesByResult(),
    memo: new Map(),
    visiting: new Set(),
    cycleCuts: 0,
  };
}

export function equipmentHomeMapsBuild(): Map<EquipmentId, string> {
  const context = homeContextBuild();
  const homes = new Map<EquipmentId, string>();
  getEntriesByType<EquipmentContent>('equipment').forEach((equipment) => {
    const home = craftedHomeSource({ equipmentId: equipment.id }, context);
    if (home && !equipment.unobtainable) homes.set(equipment.id, home.mapName);
  });
  return homes;
}

export function craftedMaterialHomesBuild(): CraftedMaterialHome[] {
  const context = homeContextBuild();
  return getEntriesByType<ItemContent>('item').flatMap((item) => {
    if (item.unobtainable || !isCraftedOnly({ itemId: item.id })) return [];
    const home = craftedHomeSource({ itemId: item.id }, context);
    return home ? [{ item, ...home }] : [];
  });
}

function groupByMap<T>(entries: [string, T][]): Map<string, T[]> {
  const byMap = new Map<string, T[]>();
  entries.forEach(([map, entry]) =>
    byMap.set(map, [...(byMap.get(map) ?? []), entry]),
  );
  return byMap;
}

// Rebuilt when either the content or the world maps reload.
let homeCache: EquipmentHomeGearCache | undefined;

function homeCacheGet(): EquipmentHomeGearCache {
  const content = allContentById();
  const lookup = worldNodeLookup();
  if (homeCache?.content === content && homeCache.lookup === lookup) {
    return homeCache;
  }

  const gear = [...equipmentHomeMapsBuild()].flatMap(([id, map]) => {
    const equipment = getEntry<EquipmentContent>(id);
    return equipment ? [[map, equipment] as [string, EquipmentContent]] : [];
  });
  const materials = craftedMaterialHomesBuild().map(
    (home) => [home.mapName, home] as [string, CraftedMaterialHome],
  );
  homeCache = {
    content,
    lookup,
    byMap: groupByMap(gear),
    materialsByMap: groupByMap(materials),
    gearHomeById: new Map(gear.map(([map, equipment]) => [equipment.id, map])),
    materialHomeById: new Map(
      materials.map(([, home]) => [home.item.id, home]),
    ),
  };
  return homeCache;
}

export function equipmentHomeMapOf(id: EquipmentId): string | undefined {
  return homeCacheGet().gearHomeById.get(id);
}

export function craftedMaterialHomeOf(
  id: ItemId,
): CraftedMaterialHome | undefined {
  return homeCacheGet().materialHomeById.get(id);
}

export function equipmentHomeGear(mapName: string): EquipmentContent[] {
  return homeCacheGet().byMap.get(mapName) ?? [];
}

export function craftedMaterialHomes(mapName: string): CraftedMaterialHome[] {
  return homeCacheGet().materialsByMap.get(mapName) ?? [];
}
