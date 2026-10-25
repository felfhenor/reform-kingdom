import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { applyGlobalEffectAdd } from '@helpers/hero/global-effect-state';
import { jobAbilityValue } from '@helpers/hero/job-ability';
import { rumorWhisper } from '@helpers/rumor/rumor-whisper';
import { updateGamestate } from '@helpers/state-game';
import { isPartyAtNode } from '@helpers/world';
import {
  shrinePrayerCooldownRemaining,
  worldNodeShrineCurrentTier,
  worldNodeShrineLevel,
} from '@helpers/world-node/world-node-shrine';
import {
  worldNodeByName,
  worldNodeShrine,
} from '@helpers/world-node/world-nodes';
import type {
  GlobalEffectContent,
  ShrineContent,
  ShrineLevel,
} from '@interfaces';

// Every isShrineBuff effect is removed first (not just this shrine's), so re-praying refreshes rather than duplicates.
// Awaited and re-checked in the update so a double-click inside the deferral can't pray twice.
export async function shrinePray(nodeName: string): Promise<boolean> {
  const node = worldNodeByName(nodeName);
  const shrine = node ? worldNodeShrine(node) : undefined;
  if (!shrine || !isPartyAtNode(nodeName)) return false;
  if (shrinePrayerCooldownRemaining() > 0) return false;

  const tier = worldNodeShrineCurrentTier(shrine, nodeName);
  if (!tier) return false;

  const currentTick = timerTicksElapsed();
  // Fixed at prayer time - a later party change doesn't stretch or shrink it.
  const duration = Math.round(
    tier.globalEffectDuration * (1 + jobAbilityValue('ShrineDurationBoost')),
  );

  let prayed = false;
  await updateGamestate((state) => {
    if (shrinePrayerCooldownRemaining() > 0) return state;

    state.globalEffects = state.globalEffects.filter(
      (effect) => !effect.isShrineBuff,
    );
    applyGlobalEffectAdd(state, tier.globalEffectId, duration, currentTick);
    state.world.prayerLastTick = currentTick;
    prayed = true;
    return state;
  });

  if (prayed) shrinePrayAnnounce(shrine, tier);
  return prayed;
}

function shrinePrayAnnounce(shrine: ShrineContent, tier: ShrineLevel): void {
  const content = getEntry<GlobalEffectContent>(tier.globalEffectId);
  if (content) {
    miscellaneousMessageLog(
      `The party has prayed at **${shrine.name}**, gaining **${content.name}**.`,
    );
  }

  if (shrine.founderWhispers) rumorWhisper();

  analyticsSendDesignEvent(
    `World:Shrine:Pray:${analyticsSafeSegment(shrine.name)}`,
  );
}

export function worldNodeShrineLegendVerses(
  shrine: ShrineContent,
  nodeName: string,
): string[] {
  return shrine.levels
    .slice(0, worldNodeShrineLevel(nodeName))
    .map((level) => level.legend)
    .filter((verse) => verse.length > 0);
}

export function worldNodeShrineLegendVerseCount(shrine: ShrineContent): number {
  return shrine.levels.filter((level) => level.legend.length > 0).length;
}
