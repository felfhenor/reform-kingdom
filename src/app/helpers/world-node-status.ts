import { caravanBrandName } from '@helpers/caravan';
import { rangeLabel } from '@helpers/leveled-range';
import { worldNodeCaravanTimerText } from '@helpers/world-node-caravan';
import { worldNodeExploreRandomTimerText } from '@helpers/world-node-encounter';
import {
  worldNodeCaravan,
  worldNodeEncounter,
  worldNodeEncounterRandom,
  worldNodeGathering,
} from '@helpers/world-nodes';
import type {
  LevelRange,
  WorldNodeEntry,
  WorldNodeInteractionKind,
  WorldNodeLabelInfo,
} from '@interfaces';

export function worldNodeLevelRange(
  entry: WorldNodeEntry,
): LevelRange | undefined {
  return (
    worldNodeEncounter(entry)?.levelRange ??
    worldNodeGathering(entry)?.levelRange ??
    worldNodeEncounterRandom(entry)?.levelRange ??
    worldNodeCaravan(entry)?.level
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
      return 'Travel';
    default:
      return undefined;
  }
}

// Ignores hidden/discovered state - pixi-map-render.ts creates every label up front and toggles
// visibility separately via `isWorldNodeVisible`, so discovery changes don't need a full re-render.
export function worldNodeLabelInfo(
  entry: WorldNodeEntry,
): WorldNodeLabelInfo | undefined {
  const kind = worldNodeInteractionKind(entry);
  if (!kind) return undefined;

  const levelRange = worldNodeLevelRange(entry);
  // Caravan names are authored as "<Brand> - <Branch>"; the branch is just the map, so drop it here.
  const lines =
    kind === 'Trade' ? [caravanBrandName(entry.nodeName)] : [entry.nodeName];
  // Caravan level range shows in the node panel instead; the floating label stays name + timer only.
  if (levelRange && kind !== 'Trade') {
    lines.push(`Lv.${worldNodeLevelLabel(levelRange)}`);
  }

  if (kind === 'ExploreRandom') {
    const timerText = worldNodeExploreRandomTimerText(entry);
    if (timerText) lines.unshift(timerText);
  }

  if (kind === 'Trade') {
    const timerText = worldNodeCaravanTimerText(entry);
    if (timerText) lines.unshift(timerText);
  }

  return { kind, text: lines.join('\n') };
}
