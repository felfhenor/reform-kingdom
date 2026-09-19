import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { dictionaryWith } from '@helpers/engine/dictionary';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { applyGlobalEffectAdd } from '@helpers/hero/global-effect-state';
import { isGlobalEffectActive } from '@helpers/hero/global-effects';
import { updateGamestate } from '@helpers/state-game';
import {
  worldNodeCanAffordCost,
  worldNodeSpendCost,
} from '@helpers/world-node/world-node-cost';
import {
  isPartyAtShrine,
  worldNodeShrineCurrentTier,
  worldNodeShrineIsMaxLevel,
  worldNodeShrineLevelUpCost,
} from '@helpers/world-node/world-node-shrine';
import {
  worldNodeByName,
  worldNodeShrine,
} from '@helpers/world-node/world-nodes';
import type { GlobalEffectContent } from '@interfaces';

// Every isShrineBuff effect is removed first (not just this shrine's), so re-praying refreshes rather than duplicates.
export function shrinePray(nodeName: string): boolean {
  const node = worldNodeByName(nodeName);
  if (!node) return false;

  const shrine = worldNodeShrine(node);
  if (!shrine) return false;
  if (!isPartyAtShrine(nodeName)) return false;

  const tier = worldNodeShrineCurrentTier(shrine, nodeName);
  if (!tier) return false;

  const currentTick = timerTicksElapsed();

  updateGamestate((state) => {
    state.globalEffects = state.globalEffects.filter(
      (effect) => !effect.isShrineBuff,
    );
    applyGlobalEffectAdd(
      state,
      tier.globalEffectId,
      tier.globalEffectDuration,
      currentTick,
    );
    return state;
  });

  const content = getEntry<GlobalEffectContent>(tier.globalEffectId);
  if (content) {
    miscellaneousMessageLog(
      `The party has prayed at **${shrine.name}**, gaining **${content.name}**.`,
    );
  }

  analyticsSendDesignEvent(
    `World:Shrine:Pray:${analyticsSafeSegment(shrine.name)}`,
  );
  return true;
}

// Awaits its own updateGamestate call so the level bump lands before the re-pray below reads it back.
export async function shrineLevelUp(nodeName: string): Promise<boolean> {
  const node = worldNodeByName(nodeName);
  if (!node) return false;

  const shrine = worldNodeShrine(node);
  if (!shrine) return false;

  if (worldNodeShrineIsMaxLevel(shrine, nodeName)) return false;
  if (!isPartyAtShrine(nodeName)) return false;

  const cost = worldNodeShrineLevelUpCost(shrine, nodeName);
  if (!worldNodeCanAffordCost(cost)) return false;

  // Matches by effect id, so no two shrines should ever share a globalEffectId (unenforced).
  const currentTier = worldNodeShrineCurrentTier(shrine, nodeName);
  const hadActiveBuffFromThisShrine =
    !!currentTier && isGlobalEffectActive(currentTier.globalEffectId);

  await updateGamestate((state) => {
    worldNodeSpendCost(state, cost);

    const existing = state.shrines[nodeName];
    state.shrines = dictionaryWith(state.shrines, nodeName, {
      level: (existing?.level ?? 0) + 1,
    });
    return state;
  });

  analyticsSendDesignEvent(
    `World:Shrine:LevelUp:${analyticsSafeSegment(nodeName)}`,
  );

  if (hadActiveBuffFromThisShrine) {
    shrinePray(nodeName);
  }

  return true;
}
