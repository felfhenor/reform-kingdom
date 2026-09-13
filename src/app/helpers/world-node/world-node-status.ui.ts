import { caravanBrandName } from '@helpers/caravan/caravan';
import { worldNodeCaravanTimerText } from '@helpers/world-node/world-node-caravan';
import { worldNodeCaravanVisitedTraderName } from '@helpers/world-node/world-node-caravan.ui';
import { worldNodeExploreRandomTimerText } from '@helpers/world-node/world-node-encounter';
import { worldNodeLevel } from '@helpers/world-node/world-node-level';
import { worldNodeCompletionRewardProgress } from '@helpers/world-node/world-node-rewards';
import { worldNodeShrineLevel } from '@helpers/world-node/world-node-shrine';
import {
  worldNodeInteractionKind,
  worldNodeLevelLabel,
  worldNodeLevelRange,
} from '@helpers/world-node/world-node-status';
import type {
  WorldNodeEntry,
  WorldNodeInteractionKind,
  WorldNodeLabelInfo,
} from '@interfaces';

// Each leveled node type gets its own branch, so a future one is a one-line addition.
function nodeNameSuffixLevel(
  kind: WorldNodeInteractionKind,
  entry: WorldNodeEntry,
): number {
  let level = 0;
  if (kind === 'Gather') level = worldNodeLevel(entry.nodeName);
  if (kind === 'Shrine') level = worldNodeShrineLevel(entry.nodeName);
  return level;
}

// `(obtained/total)` suffix for the map label, hidden once every reward's been found (or if there are none).
function nodeRewardProgressSuffix(entry: WorldNodeEntry): string {
  const { obtained, total } = worldNodeCompletionRewardProgress(entry);
  return total > 0 && obtained < total ? ` (${obtained}/${total})` : '';
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
  const suffixLevel = nodeNameSuffixLevel(kind, entry);
  const nodeNameLine =
    (suffixLevel > 0 ? `${entry.nodeName} +${suffixLevel}` : entry.nodeName) +
    nodeRewardProgressSuffix(entry);
  const lines =
    kind === 'Trade' ? [caravanBrandName(entry.nodeName)] : [nodeNameLine];
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

    const traderName = worldNodeCaravanVisitedTraderName(entry);
    if (traderName) lines.push(traderName);
  }

  return { kind, text: lines.join('\n') };
}
