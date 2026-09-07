import { rangeLabel } from '@helpers/engine/leveled-range';
import {
  worldNodeCaravan,
  worldNodeEncounter,
  worldNodeEncounterRandom,
  worldNodeGathering,
  worldNodeTown,
} from '@helpers/world-node/world-nodes';
import type {
  LevelRange,
  WorldNodeEntry,
  WorldNodeInteractionKind,
} from '@interfaces';

export function worldNodeLevelRange(
  entry: WorldNodeEntry,
): LevelRange | undefined {
  const townLevel = worldNodeTown(entry)?.level;

  return (
    worldNodeEncounter(entry)?.levelRange ??
    worldNodeGathering(entry)?.levelRange ??
    worldNodeEncounterRandom(entry)?.levelRange ??
    worldNodeCaravan(entry)?.level ??
    (townLevel !== undefined ? { min: townLevel, max: townLevel } : undefined)
  );
}

export function worldNodeLevelLabel(levelRange: LevelRange): string {
  return rangeLabel(levelRange);
}

// What the always-on map label (`pixiIndicatorNodeLabelCreate`) shows so nodes are distinguishable at a glance.
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
    case 'CaravanNode':
      return 'Trade';
    case 'TeleportNode':
    case 'Kingdom':
    case 'NonPlayerKingdom':
      return 'Travel';
    default:
      return undefined;
  }
}
