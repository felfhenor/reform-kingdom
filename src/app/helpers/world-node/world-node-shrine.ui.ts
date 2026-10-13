import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { applyGlobalEffectAdd } from '@helpers/hero/global-effect-state';
import { jobAbilityValue } from '@helpers/hero/job-ability';
import { updateGamestate } from '@helpers/state-game';
import { isPartyAtNode } from '@helpers/world';
import { worldNodeShrineCurrentTier } from '@helpers/world-node/world-node-shrine';
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
  if (!isPartyAtNode(nodeName)) return false;

  const tier = worldNodeShrineCurrentTier(shrine, nodeName);
  if (!tier) return false;

  const currentTick = timerTicksElapsed();
  // Fixed at prayer time - a later party change doesn't stretch or shrink it.
  const duration = Math.round(
    tier.globalEffectDuration * (1 + jobAbilityValue('ShrineDurationBoost')),
  );

  updateGamestate((state) => {
    state.globalEffects = state.globalEffects.filter(
      (effect) => !effect.isShrineBuff,
    );
    applyGlobalEffectAdd(state, tier.globalEffectId, duration, currentTick);
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
