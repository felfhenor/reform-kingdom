import { autoModeToggle } from '@helpers/auto-mode';
import {
  decreeClauseAdd,
  decreeClauses,
  decreeRiskTolerance,
  decreeSetRiskTolerance,
} from '@helpers/decree';
import {
  characterInfuseEquipment,
  optimizeCharacterEquipment,
} from '@helpers/character-equipment';
import { partyMinLevel } from '@helpers/gathering';
import { canInfuseEquipmentItem, isInfusionMaterial } from '@helpers/infusion';
import { partyGet } from '@helpers/party';
import { gamestate } from '@helpers/state-game';
import { getCraftableRecipeEntries } from '@helpers/crafting';
import { craftQueueStart } from '@helpers/crafting-queue';
import { getEntry } from '@helpers/content';
import type {
  DecreeRiskLevel,
  EquipmentSlot,
  ItemContent,
  ItemId,
  MaterialId,
} from '@interfaces';
import { ALL_TRADESKILLS } from '@interfaces';
import {
  AVERAGE_CRAFT_INTERVAL_TICKS,
  AVERAGE_INFUSE_INTERVAL_TICKS,
  AVERAGE_REOPTIMIZE_INTERVAL_TICKS,
  OPTIMAL_CRAFT_INTERVAL_TICKS,
  OPTIMAL_INFUSE_INTERVAL_TICKS,
  OPTIMAL_RISK_LOW_LEVEL_CEILING,
  OPTIMAL_RISK_MEDIUM_LEVEL_CEILING,
} from './constants';
import type { StrategyName } from './types';

type StrategyPreset = {
  // A fresh party thrown straight at `High` risk (up to 7 levels above them,
  // per `HIGH_RISK_LEVELS_ABOVE_PARTY` in decree-evaluation.ts) mostly just
  // loses repeatedly and never progresses - so risk tolerance is a curve
  // over party level, not a fixed setting, matching how a real player
  // gradually gets bolder as their party gets sturdier.
  riskToleranceForLevel: (partyLevel: number) => DecreeRiskLevel;
  // Tick interval a policy hook runs on; `null` means the strategy never
  // does it at all (used to model Suboptimal's neglect).
  craftIntervalTicks: number | null;
  infuseIntervalTicks: number | null;
  reoptimizeEquipmentOnLevelUp: boolean;
  reoptimizeIntervalTicks: number | null;
};

// The three play-skill tiers, expressed purely as configuration over the
// game's own AI (Decree/auto-mode + these periodic policy hooks) rather than
// a separate bot - see the plan doc for the reasoning.
const STRATEGY_PRESETS: Record<StrategyName, StrategyPreset> = {
  optimal: {
    riskToleranceForLevel: (level) =>
      level < OPTIMAL_RISK_LOW_LEVEL_CEILING
        ? 'Low'
        : level < OPTIMAL_RISK_MEDIUM_LEVEL_CEILING
          ? 'Medium'
          : 'High',
    craftIntervalTicks: OPTIMAL_CRAFT_INTERVAL_TICKS,
    infuseIntervalTicks: OPTIMAL_INFUSE_INTERVAL_TICKS,
    reoptimizeEquipmentOnLevelUp: true,
    reoptimizeIntervalTicks: null,
  },
  average: {
    riskToleranceForLevel: () => 'Medium',
    craftIntervalTicks: AVERAGE_CRAFT_INTERVAL_TICKS,
    infuseIntervalTicks: AVERAGE_INFUSE_INTERVAL_TICKS,
    reoptimizeEquipmentOnLevelUp: false,
    reoptimizeIntervalTicks: AVERAGE_REOPTIMIZE_INTERVAL_TICKS,
  },
  suboptimal: {
    // Over-cautious the whole game, rather than scaling up at all - part of
    // what makes this "suboptimal" rather than merely "slower".
    riskToleranceForLevel: () => 'Low',
    craftIntervalTicks: null,
    infuseIntervalTicks: null,
    reoptimizeEquipmentOnLevelUp: false,
    reoptimizeIntervalTicks: null,
  },
};

// Re-applies `strategy`'s risk-tolerance curve for the party's current
// level. Cheap to call every tick - it only writes state when the band
// actually changes.
function syncRiskTolerance(strategy: StrategyName): void {
  const target = STRATEGY_PRESETS[strategy].riskToleranceForLevel(
    partyMinLevel(),
  );
  if (decreeRiskTolerance() !== target) {
    decreeSetRiskTolerance(target);
  }
}

// Sets up the standing Decree clause list + risk tolerance for `strategy`
// and turns Auto Mode on - called once per scenario, before the tick loop
// starts. `LevelUpParty`/`FinishUnfinishedAreas` cover combat progression;
// `ReturnToKingdom` is the fallback `advanceToNextClause` (auto-mode.ts)
// falls through to once neither is satisfiable, so it doubles as this
// strategy's own "give up and go home" behavior.
export function configureStrategyDecree(strategy: StrategyName): void {
  syncRiskTolerance(strategy);

  if (decreeClauses().length === 0) {
    decreeClauseAdd({ type: 'LevelUpParty' });
    decreeClauseAdd({ type: 'FinishUnfinishedAreas' });
    decreeClauseAdd({ type: 'ReturnToKingdom' });
  }

  autoModeToggle(true);
}

export type CraftAttemptResult = {
  // At least one tradeskill has a recipe unlocked (building level high
  // enough) - distinguishes "nothing to craft yet" from "wants to craft but
  // can't", which is what a supply-chain stonewall actually looks like.
  anyRecipeUnlocked: boolean;
  anyQueued: boolean;
};

// Queues the single best currently-craftable recipe (if any) for every
// tradeskill - `getCraftableRecipeEntries` already sorts craftable entries
// highest-level-first, so `[0]` is "the best thing craftable right now".
function attemptCrafting(): CraftAttemptResult {
  const result: CraftAttemptResult = {
    anyRecipeUnlocked: false,
    anyQueued: false,
  };

  ALL_TRADESKILLS.forEach((tradeskill) => {
    const entries = getCraftableRecipeEntries(tradeskill);
    const best = entries[0];
    if (!best) return;

    result.anyRecipeUnlocked = true;
    if (best.maxCraftable <= 0) return;

    if (craftQueueStart(tradeskill, best.recipe.id, best.maxCraftable)) {
      result.anyQueued = true;
    }
  });

  return result;
}

// Infuses the first equipped-item/slot/material combination that's valid
// and affordable. One infusion per call is intentional - this runs on a
// tick interval, so the strategy catches up gradually rather than trying to
// infuse every open slot in a single tick.
function attemptInfusion(): void {
  const materialIds = Object.keys(gamestate().materials) as MaterialId[];
  const infusionMaterialIds = materialIds.filter((id) => {
    const item = getEntry<ItemContent>(id);
    return item && isInfusionMaterial(item);
  });
  if (infusionMaterialIds.length === 0) return;

  for (const character of partyGet()) {
    for (const slot of Object.keys(character.equipment) as EquipmentSlot[]) {
      const item = character.equipment[slot];
      if (!item) continue;

      for (let slotIndex = 0; slotIndex < item.infusedItemIds.length; slotIndex++) {
        const materialId = infusionMaterialIds.find((id) =>
          canInfuseEquipmentItem(item, slotIndex, id as ItemId),
        );
        if (!materialId) continue;

        characterInfuseEquipment(
          character.id,
          item.id,
          slotIndex,
          materialId as ItemId,
        );
        return;
      }
    }
  }
}

function reoptimizeAllEquipment(): void {
  partyGet().forEach((character) => optimizeCharacterEquipment(character.id));
}

// Called every tick by the driver - internally no-ops except on each
// strategy's configured cadence, so cheap to call unconditionally. Returns
// the crafting attempt's result only on ticks where one actually ran (`null`
// otherwise), so the driver's supply-stall counter only samples real checks.
export function applyStrategyPolicy(
  strategy: StrategyName,
  tick: number,
  partyLeveledUpThisTick: boolean,
): CraftAttemptResult | null {
  const preset = STRATEGY_PRESETS[strategy];
  syncRiskTolerance(strategy);

  let craftResult: CraftAttemptResult | null = null;

  if (
    preset.craftIntervalTicks !== null &&
    tick % preset.craftIntervalTicks === 0
  ) {
    craftResult = attemptCrafting();
  }

  if (
    preset.infuseIntervalTicks !== null &&
    tick % preset.infuseIntervalTicks === 0
  ) {
    attemptInfusion();
  }

  if (preset.reoptimizeEquipmentOnLevelUp && partyLeveledUpThisTick) {
    reoptimizeAllEquipment();
  } else if (
    preset.reoptimizeIntervalTicks !== null &&
    tick % preset.reoptimizeIntervalTicks === 0
  ) {
    reoptimizeAllEquipment();
  }

  return craftResult;
}
