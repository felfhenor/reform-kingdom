import { commissionGenerateIfMissing } from '@helpers/commission/commission-tick';
import { getEntriesByType, getEntry } from '@helpers/content';
import { formatDuration, timerTicksElapsed } from '@helpers/engine/timer';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import { worldNodeCaravan } from '@helpers/world-node/world-nodes';
import type {
  CaravanContent,
  CaravanId,
  CaravanNodeState,
  CaravanTimerUrgency,
  CaravanTraderContent,
  GameStateDiscoveredCaravans,
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

export function isCaravanDiscovered(caravanId: CaravanId): boolean {
  return !!gamestate().discoveredCaravans[caravanId]?.foundAt;
}

export function isPartyAtCaravan(caravanId: CaravanId): boolean {
  const entry = worldNodeAtCurrentLocation();
  return !!entry && worldNodeCaravan(entry)?.id === caravanId;
}

export function caravanMarkDiscovered(caravanId: CaravanId): void {
  if (isCaravanDiscovered(caravanId)) return;

  updateGamestate((state) => {
    state.discoveredCaravans[caravanId] = { foundAt: Date.now() };
    return state;
  });
}

// Every "party is engaging with this caravan" call site (travel arrival,
// opening trade while already there) should go through this, not the two
// halves separately - otherwise one gets forgotten.
export function caravanMarkVisited(caravanId: CaravanId): void {
  caravanMarkDiscovered(caravanId);
  commissionGenerateIfMissing(caravanId);
}

// Drops any discovery entries whose caravanId no longer resolves to real
// content - e.g. after a caravan is renamed/removed from gamedata.
export function pruneInvalidDiscoveredCaravans(
  discovered: GameStateDiscoveredCaravans,
): GameStateDiscoveredCaravans {
  const pruned: GameStateDiscoveredCaravans = {};

  (Object.keys(discovered) as CaravanId[]).forEach((caravanId) => {
    if (getEntry<CaravanContent>(caravanId)) {
      pruned[caravanId] = discovered[caravanId];
    }
  });

  return pruned;
}
