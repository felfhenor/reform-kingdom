import { getEntry } from '@helpers/content';
import { applyMaterialDelta, goldCoinId } from '@helpers/materials';
import { researchPointItemId } from '@helpers/research/research-content';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  GameState,
  GameStateDiscoveredResearch,
  ResearchContent,
  ResearchCost,
  ResearchId,
  ResearchState,
} from '@interfaces';

// Re-exported so every existing call site (research-queue.ts,
// combat-end.ts, gathering.ts, etc.) keeps importing from '@helpers/research/research'
// unchanged - only CLI-sensitive consumers need the direct
// '@helpers/research/research-content' path. See research-content.ts for why.
export { researchEntries, researchPointItemId } from '@helpers/research/research-content';

export function isResearchCompleted(researchId: ResearchId): boolean {
  return !!gamestate().discoveredResearch[researchId]?.foundAt;
}

export function isResearchPrerequisitesMet(
  content: ResearchContent,
): boolean {
  return content.prerequisiteResearchIds.every(isResearchCompleted);
}

export function activeResearchState(): ResearchState {
  return gamestate().research;
}

export function activeResearchContent(): ResearchContent | undefined {
  const { researchId } = activeResearchState();
  return researchId ? getEntry<ResearchContent>(researchId) : undefined;
}

export function researchProgressFraction(): number {
  const content = activeResearchContent();
  if (!content || content.researchTime <= 0) return 0;

  return Math.min(
    1,
    activeResearchState().ticksIntoResearch / content.researchTime,
  );
}

// Refunds the active node's upfront cost from the `costPaid` snapshot (not
// the content's current `cost` - the content may no longer exist, and even
// if it does, a cost rebalance shouldn't change what gets refunded here).
// Distinct from a voluntary swap, which forfeits with no refund at all (see
// researchStartNode in research-queue.ts). Mutates `state` directly, same
// convention as applyMaterialDelta.
function refundResearchCost(state: GameState, costPaid: ResearchCost): void {
  applyMaterialDelta(state, researchPointItemId(), costPaid.rp);
  applyMaterialDelta(state, goldCoinId(), costPaid.gold);
  costPaid.materials.forEach((material) => {
    applyMaterialDelta(state, material.itemId, material.quantity);
  });
}

// Manual recovery escape hatch (see debugResetResearch in debug.ts) as well
// as the removed-content path in retrofitResearch below - both need the
// same "refund what was paid, reset to Idle" behavior. A no-op if nothing is
// currently active.
export function researchForfeitActiveWithRefund(): void {
  updateGamestate((state) => {
    if (state.research.status === 'Researching' && state.research.costPaid) {
      refundResearchCost(state, state.research.costPaid);
    }
    state.research = {
      status: 'Idle',
      researchId: undefined,
      ticksIntoResearch: 0,
      costPaid: undefined,
    };
    return state;
  });
}

// If the active node's content vanished (removed from gamedata), forfeit it
// with a refund rather than leaving state pointing at nothing. Otherwise
// just clamp progress to a possibly-shortened researchTime, same rescale
// philosophy as retrofitTradeskillXp. Mutates `state.research` directly -
// called from migrateGameState().
export function retrofitResearch(state: GameState): void {
  const research = state.research;
  if (research.status !== 'Researching' || !research.researchId) return;

  const content = getEntry<ResearchContent>(research.researchId);
  if (!content) {
    if (research.costPaid) refundResearchCost(state, research.costPaid);
    state.research = {
      status: 'Idle',
      researchId: undefined,
      ticksIntoResearch: 0,
      costPaid: undefined,
    };
    return;
  }

  state.research = {
    ...research,
    ticksIntoResearch: Math.min(
      research.ticksIntoResearch,
      content.researchTime,
    ),
  };
}

// A completed research node stays completed forever even if its content is
// later removed - this only drops the now-dangling ledger entry, it doesn't
// undo the completion's derived effects (there's nothing to undo, since
// effects are derived live from currently-existing completed nodes).
export function pruneInvalidDiscoveredResearch(
  discovered: GameStateDiscoveredResearch,
): GameStateDiscoveredResearch {
  const pruned: GameStateDiscoveredResearch = {};

  (Object.keys(discovered) as ResearchId[]).forEach((researchId) => {
    if (getEntry<ResearchContent>(researchId)) {
      pruned[researchId] = discovered[researchId];
    }
  });

  return pruned;
}
