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
    case 'CaravanNode':
      return 'Trade';
    case 'TeleportNode':
    case 'Kingdom':
      return 'Travel';
    default:
      return undefined;
  }
}

// Always resolves the label text/kind regardless of hidden/discovered state
// - the map renderer (`pixi-map-render.ts`) creates every node's label
// up front and toggles its visibility live via `isWorldNodeVisible` once
// discovery state can change without a full map re-render, rather than
// baking that gating into the text itself.
export function worldNodeLabelInfo(
  entry: WorldNodeEntry,
): WorldNodeLabelInfo | undefined {
  const kind = worldNodeInteractionKind(entry);
  if (!kind) return undefined;

  const levelRange = worldNodeLevelRange(entry);
  // A caravan's name is authored as "<Brand Name> - <Branch Name>" (e.g.
  // "Duchy Trading Caravan - Carrina") - the branch is just the map it's on,
  // so the map label drops it entirely rather than showing the full
  // hyphenated name.
  const lines =
    kind === 'Trade' ? [caravanBrandName(entry.nodeName)] : [entry.nodeName];
  // A caravan's level range is shown in the map node panel instead (see
  // `worldNodeCaravanTraderLevel`/`worldNodeCaravanTradeCounts`) - the
  // floating map label stays focused on name + reset timer.
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
