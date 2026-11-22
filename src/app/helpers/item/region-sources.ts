import {
  REGION_GEAR_DROP_LEVELS_ABOVE,
  REGION_GEAR_DROP_LEVELS_BELOW,
} from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import {
  baseContentSources,
  nodeSource,
  sourceMatchesTarget,
  sourceUniqueKey,
} from '@helpers/item/content-sources';
import {
  craftedMaterialHomeOf,
  equipmentHomeMapOf,
} from '@helpers/item/equipment-home-map';
import {
  regionGatheringDrops,
  worldNodeMonsterIds,
} from '@helpers/world-node/world-node-monster-drops';
import { globalEffectSumsState } from '@helpers/state-game';
import { worldNodeLevelRange } from '@helpers/world-node/world-node-status';
import { worldNodesOfType } from '@helpers/world-node/world-nodes';
import type {
  CollectibleSource,
  EquipmentContent,
  LevelRange,
  SourceTarget,
} from '@interfaces';
import { uniq, uniqBy } from 'es-toolkit/compat';

// Fight nodes on the map whose level range overlaps the window.
function fightNodeSources(
  mapName: string,
  window: LevelRange,
): CollectibleSource[] {
  return [
    ...worldNodesOfType('ExploreNode'),
    ...worldNodesOfType('ExploreRandomNode'),
  ]
    .filter((entry) => {
      const range = worldNodeLevelRange(entry);
      return (
        entry.mapName === mapName &&
        worldNodeMonsterIds(entry).length > 0 &&
        !!range &&
        range.max >= window.min &&
        range.min <= window.max
      );
    })
    .map((entry) => nodeSource({ name: entry.nodeName }));
}

const ANY_LEVEL: LevelRange = { min: 0, max: Number.MAX_SAFE_INTEGER };

// Every fight on a map whose gather tables monsters drop from.
function regionGatheringSources(target: SourceTarget): CollectibleSource[] {
  return uniq(worldNodesOfType('GatherNode').map((entry) => entry.mapName))
    .filter((mapName) =>
      regionGatheringDrops(mapName).some((drop) =>
        sourceMatchesTarget(drop, target),
      ),
    )
    .flatMap((mapName) => fightNodeSources(mapName, ANY_LEVEL));
}

export function regionGearSources(target: SourceTarget): CollectibleSource[] {
  if (!('equipmentId' in target)) return [];
  const mapName = equipmentHomeMapOf(target.equipmentId);
  const equipment = getEntry<EquipmentContent>(target.equipmentId);
  if (!mapName || !equipment) return [];

  return fightNodeSources(mapName, {
    min: equipment.levelRequirement - REGION_GEAR_DROP_LEVELS_BELOW,
    max: equipment.levelRequirement + REGION_GEAR_DROP_LEVELS_ABOVE,
  });
}

export function regionMaterialSources(
  target: SourceTarget,
): CollectibleSource[] {
  if (!('itemId' in target)) return [];
  const home = craftedMaterialHomeOf(target.itemId);
  if (!home) return [];

  return fightNodeSources(home.mapName, {
    min: home.level - REGION_GEAR_DROP_LEVELS_BELOW,
    max: Number.MAX_SAFE_INTEGER,
  });
}

// Static sources plus the monster drops this run's effects add.
export function regionContentSources(
  target: SourceTarget,
): CollectibleSource[] {
  const sums = globalEffectSumsState();
  return uniqBy(
    [
      ...baseContentSources(target),
      ...regionGatheringSources(target),
      ...(sums.regionGearDropChance > 0 ? regionGearSources(target) : []),
      ...(sums.regionMaterialDropChance > 0
        ? regionMaterialSources(target)
        : []),
    ],
    sourceUniqueKey,
  );
}
