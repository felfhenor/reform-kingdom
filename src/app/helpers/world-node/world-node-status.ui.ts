import { caravanBrandName } from '@helpers/caravan/caravan';
import { worldNodeCaravanTimerText } from '@helpers/world-node/world-node-caravan';
import { worldNodeExploreRandomTimerText } from '@helpers/world-node/world-node-encounter';
import { worldNodeLevel } from '@helpers/world-node/world-node-level';
import {
  worldNodeInteractionKind,
  worldNodeLevelLabel,
  worldNodeLevelRange,
} from '@helpers/world-node/world-node-status';
import type { WorldNodeEntry, WorldNodeLabelInfo } from '@interfaces';

// Ignores hidden/discovered state - pixi-map-render.ts creates every label up front and toggles
// visibility separately via `isWorldNodeVisible`, so discovery changes don't need a full re-render.
export function worldNodeLabelInfo(
  entry: WorldNodeEntry,
): WorldNodeLabelInfo | undefined {
  const kind = worldNodeInteractionKind(entry);
  if (!kind) return undefined;

  const levelRange = worldNodeLevelRange(entry);
  // Caravan names are authored as "<Brand> - <Branch>"; the branch is just the map, so drop it here.
  const gatherLevel = kind === 'Gather' ? worldNodeLevel(entry.nodeName) : 0;
  const nodeNameLine =
    gatherLevel > 0 ? `${entry.nodeName} +${gatherLevel}` : entry.nodeName;
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
  }

  return { kind, text: lines.join('\n') };
}
