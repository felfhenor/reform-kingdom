import { getEntriesByType } from '@helpers/content';
import { gamestate } from '@helpers/state-game';
import { formatDuration, timerTicksElapsed } from '@helpers/timer';
import type {
  CaravanContent,
  CaravanId,
  CaravanNodeState,
  CaravanTimerUrgency,
  CaravanTraderContent,
} from '@interfaces';
import { clamp } from 'es-toolkit/compat';

const URGENCY_SAFE_MIN_TICKS = 1800; // 30 minutes
const URGENCY_WARNING_MIN_TICKS = 300; // 5 minutes

export function caravanState(caravanId: CaravanId): CaravanNodeState | undefined {
  return gamestate().world.caravans[caravanId];
}

// A caravan's node name is authored as "<Brand Name> - <Branch Name>" (e.g.
// "Goblin Group Company - Carrina") - the branch is just the map it's on,
// which is redundant once you're looking at that map, so every player-facing
// display (map label, node panel) shows only the brand name.
export function caravanBrandName(nodeName: string): string {
  return nodeName.split(' - ')[0];
}

// Every trader eligible to staff `content` - in one of its `traderCategories`
// and within its `level` range. A caravan with zero eligible traders (a
// content-authoring gap) ends up with no assigned trader at all, see
// `caravanProcessTick`.
export function caravanEligibleTraders(
  content: CaravanContent,
): CaravanTraderContent[] {
  return getEntriesByType<CaravanTraderContent>('caravantrader').filter(
    (trader) =>
      content.traderCategories.includes(trader.category) &&
      trader.level >= content.level.min &&
      trader.level <= content.level.max,
  );
}

export function caravanTicksUntilReset(
  content: CaravanContent,
  state: CaravanNodeState | undefined,
): number {
  if (!state) return content.traderResetTime;

  const ticksSinceGenerated = timerTicksElapsed() - state.generatedAtTick;
  return clamp(
    content.traderResetTime - ticksSinceGenerated,
    0,
    content.traderResetTime,
  );
}

export function caravanTimerLabel(
  content: CaravanContent,
  state: CaravanNodeState | undefined,
): string {
  return formatDuration(caravanTicksUntilReset(content, state));
}

// How urgently the "this merchant will be leaving in..." countdown should
// read - 30+ minutes left is safe, under 5 is danger, otherwise a warning.
export function caravanTimerUrgency(ticksUntilReset: number): CaravanTimerUrgency {
  if (ticksUntilReset >= URGENCY_SAFE_MIN_TICKS) return 'safe';
  if (ticksUntilReset >= URGENCY_WARNING_MIN_TICKS) return 'warning';
  return 'danger';
}
