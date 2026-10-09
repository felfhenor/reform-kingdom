import { commissionGenerateIfMissing } from '@helpers/commission/commission-tick';
import {
  URGENCY_SAFE_MIN_TICKS,
  URGENCY_WARNING_MIN_TICKS,
} from '@helpers/config';
import { getEntriesByType } from '@helpers/content/content';
import { ledgerHas, ledgerMark } from '@helpers/engine/ledger';
import { formatDuration, timerTicksElapsed } from '@helpers/engine/timer';
import {
  discoveredCaravansState,
  updateGamestate,
  worldCaravansState,
} from '@helpers/state-game';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import { worldNodeCaravan } from '@helpers/world-node/world-nodes';
import type {
  CaravanContent,
  CaravanId,
  CaravanNodeState,
  CaravanTimerUrgency,
  CaravanTraderContent,
  CaravanTraderId,
} from '@interfaces';
import { clamp } from 'es-toolkit/compat';

export function caravanState(
  caravanId: CaravanId,
): CaravanNodeState | undefined {
  return worldCaravansState()[caravanId];
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

// Trader ids currently staffing any OTHER caravan node, so a reroll never
// stations the same merchant at two camps at once.
export function caravanBusyTraderIds(
  excludingCaravanId: CaravanId,
): Set<CaravanTraderId> {
  const caravans = worldCaravansState();
  const busy = new Set<CaravanTraderId>();

  (Object.keys(caravans) as CaravanId[]).forEach((caravanId) => {
    if (caravanId === excludingCaravanId) return;

    const traderId = caravans[caravanId]?.traderId;
    if (traderId) busy.add(traderId);
  });

  return busy;
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

export function isCaravanDiscovered(caravanId: CaravanId): boolean {
  return ledgerHas(discoveredCaravansState(), caravanId);
}

export function isPartyAtCaravan(caravanId: CaravanId): boolean {
  const entry = worldNodeAtCurrentLocation();
  return !!entry && worldNodeCaravan(entry)?.id === caravanId;
}

export function caravanMarkDiscovered(caravanId: CaravanId): void {
  if (isCaravanDiscovered(caravanId)) return;

  updateGamestate((state) => {
    ledgerMark(state.discoveredCaravans, caravanId);
    return state;
  });
}

export function caravanMarkVisited(caravanId: CaravanId): void {
  caravanMarkDiscovered(caravanId);
  commissionGenerateIfMissing(caravanId);

  updateGamestate((state) => {
    const caravan = state.world.caravans[caravanId];
    if (caravan && caravan.visitedTraderId !== caravan.traderId) {
      caravan.visitedTraderId = caravan.traderId;
    }
    return state;
  });
}
