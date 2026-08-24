import { getEntriesByType } from '@helpers/content';
import { formatDuration, timerTicksElapsed } from '@helpers/engine/timer';
import { gamestate } from '@helpers/state-game';
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

export function caravanState(
  caravanId: CaravanId,
): CaravanNodeState | undefined {
  return gamestate().world.caravans[caravanId];
}

// Node names are authored "<Brand> - <Branch>"; the branch (map name) is redundant in UI.
export function caravanBrandName(nodeName: string): string {
  return nodeName.split(' - ')[0];
}

// Traders matching content's traderCategories and level range; zero eligible traders leaves the caravan unstaffed (see caravanProcessTick).
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
export function caravanTimerUrgency(
  ticksUntilReset: number,
): CaravanTimerUrgency {
  if (ticksUntilReset >= URGENCY_SAFE_MIN_TICKS) return 'safe';
  if (ticksUntilReset >= URGENCY_WARNING_MIN_TICKS) return 'warning';
  return 'danger';
}
