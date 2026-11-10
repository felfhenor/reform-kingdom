import { caravanBrandName } from '@helpers/caravan/caravan';
import { combatAutomationLockedReason } from '@helpers/combat/combat-manual.ui';
import {
  exploreDifficultyTier,
  gatherDifficultyTier,
} from '@helpers/engine/difficulty-tier';
import { rangeLabel } from '@helpers/engine/leveled-range';
import { partyMinLevel } from '@helpers/item/gathering';
import { worldNodeCaravanTimerText } from '@helpers/world-node/world-node-caravan';
import { worldNodeCaravanVisitedTraderName } from '@helpers/world-node/world-node-caravan.ui';
import { worldNodeExploreRandomTimerText } from '@helpers/world-node/world-node-encounter';
import { worldNodeExploreRandomIsCompleted } from '@helpers/world-node/world-node-encounter.ui';
import { worldNodeDevelopmentIsMaxLevel } from '@helpers/world-node/world-node-development';
import {
  worldNodeDevelopable,
  worldNodeDevelopmentLevel,
  worldNodeDevelopmentTimerText,
} from '@helpers/world-node/world-node-development-state';
import { worldNodeGateProgress } from '@helpers/world-node/world-node-gate';
import { worldNodeCompletionRewardProgress } from '@helpers/world-node/world-node-rewards';
import {
  worldNodeInteractionKind,
  worldNodeLevelRange,
} from '@helpers/world-node/world-node-status';
import {
  worldNodeEncounter,
  worldNodeEncounterRandom,
  worldNodeGathering,
} from '@helpers/world-node/world-nodes';
import type {
  DifficultyTier,
  ExploreNodeFarmOption,
  WorldNodeObtainedProgress,
  WorldNodeEntry,
  WorldNodeLabelInfo,
  WorldNodeStatusInfo,
} from '@interfaces';

// `(obtained/total)` suffix for the map label, hidden once complete (or if there's nothing to count).
function nodeProgressSuffix({
  obtained,
  total,
}: WorldNodeObtainedProgress): string {
  return total > 0 && obtained < total ? ` (${obtained}/${total})` : '';
}

// Towns and caravans are excluded: their levels describe guardians/trader staffing, not a challenge to the party.
export function worldNodeDifficultyTier(
  entry: WorldNodeEntry,
): DifficultyTier | undefined {
  const gatherRange = worldNodeGathering(entry)?.levelRange;
  if (gatherRange) return gatherDifficultyTier(gatherRange, partyMinLevel());

  const exploreRange =
    worldNodeEncounter(entry)?.levelRange ??
    worldNodeEncounterRandom(entry)?.levelRange;
  return exploreRange
    ? exploreDifficultyTier(exploreRange, partyMinLevel())
    : undefined;
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
  const suffixLevel = worldNodeDevelopmentLevel(entry.nodeName);
  const nodeNameLine =
    (suffixLevel > 0 ? `${entry.nodeName} +${suffixLevel}` : entry.nodeName) +
    nodeProgressSuffix(
      kind === 'Gate'
        ? worldNodeGateProgress(entry)
        : worldNodeCompletionRewardProgress(entry),
    );
  const lines =
    kind === 'Trade' ? [caravanBrandName(entry.nodeName)] : [nodeNameLine];
  // Caravan level range shows in the node panel instead; the floating label stays name + timer only.
  if (levelRange && kind !== 'Trade') {
    lines.push(`Lv. ${rangeLabel(levelRange)}`);
  }

  const developTimerText = worldNodeDevelopmentTimerText(entry.nodeName);
  if (developTimerText) lines.unshift(developTimerText);

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

  return {
    kind,
    text: lines.join('\n'),
    difficulty: worldNodeDifficultyTier(entry),
  };
}

export function worldNodeFarmOption(
  entry: WorldNodeEntry,
): ExploreNodeFarmOption {
  const levelRange = worldNodeLevelRange(entry);
  const lockedReason = combatAutomationLockedReason(entry.mapName);
  return {
    nodeName: entry.nodeName,
    levelLabel: levelRange ? rangeLabel(levelRange) : '?',
    difficulty: worldNodeDifficultyTier(entry),
    entry,
    disabled: !!lockedReason,
    lockedReason,
  };
}

// ExploreRandomNodes badge their per-cycle state; developable nodes badge only once maxed out.
export function worldNodeStatusInfo(
  entry: WorldNodeEntry,
): WorldNodeStatusInfo | undefined {
  if (worldNodeInteractionKind(entry) === 'ExploreRandom') {
    return {
      badge: worldNodeExploreRandomIsCompleted(entry) ? 'Beaten' : 'NotBeaten',
    };
  }

  const content = worldNodeDevelopable(entry.nodeName);
  if (!content) return undefined;

  const level = worldNodeDevelopmentLevel(entry.nodeName);
  return {
    badge: worldNodeDevelopmentIsMaxLevel(content, level)
      ? 'Developed'
      : undefined,
  };
}
