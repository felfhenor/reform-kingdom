import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { recomputeGlobalEffectSums } from '@helpers/hero/global-effect-state';
import { collectiblesState, updateGamestate } from '@helpers/state-game';
import type {
  CollectibleContent,
  CollectibleId,
  GameState,
  GameStateCollectibles,
} from '@interfaces';
import { taskEventCollectibleGained } from '@helpers/task/task-events';

// Drops any storage entries whose id no longer resolves to real content -
// e.g. after a collectible is renamed/removed from gamedata.
export function pruneInvalidCollectibles(
  collectibles: GameStateCollectibles,
): GameStateCollectibles {
  const pruned: GameStateCollectibles = {};

  (Object.keys(collectibles) as CollectibleId[]).forEach((collectibleId) => {
    if (getEntry<CollectibleContent>(collectibleId)) {
      pruned[collectibleId] = collectibles[collectibleId];
    }
  });

  return pruned;
}

export function getCollectibleQuantity(collectibleId: CollectibleId): number {
  return collectiblesState()[collectibleId]?.quantity ?? 0;
}

export function isCollectibleDiscovered(collectibleId: CollectibleId): boolean {
  return !!collectiblesState()[collectibleId]?.foundAt;
}

export function discoveredCollectibleCount(): number {
  return Object.values(collectiblesState()).filter((entry) => !!entry?.foundAt)
    .length;
}

// Shared raw mutator - callers already inside their own `updateGamestate`/tick
// draft (loot, caravan trades) call this directly instead of `collectiblesAdd`.
export function applyCollectibleGrant(
  state: GameState,
  collectibleId: CollectibleId,
  quantity: number,
): void {
  const existing = state.collectibles[collectibleId];
  state.collectibles[collectibleId] = {
    quantity: (existing?.quantity ?? 0) + quantity,
    foundAt: existing?.foundAt ?? Date.now(),
  };
  recomputeGlobalEffectSums(state);
}

export function collectiblesAdd(
  collectibleId: CollectibleId,
  quantity = 1,
): void {
  if (quantity <= 0) return;

  const alreadyDiscovered = isCollectibleDiscovered(collectibleId);

  updateGamestate((state) => {
    applyCollectibleGrant(state, collectibleId, quantity);
    return state;
  });
  void taskEventCollectibleGained(collectibleId);

  if (!alreadyDiscovered) {
    const collectibleName = getEntry<CollectibleContent>(collectibleId)?.name;

    if (collectibleName) {
      analyticsSendDesignEvent(
        `Progress:Museum:Unlock:${analyticsSafeSegment(collectibleName)}`,
      );
    }
  }
}

const FOUNDING_STONE_NAME = 'Founding Stone';

// Every player is guaranteed to own the Founding Stone - it isn't dropped by
// any encounter, so new/migrated saves are granted one if they don't already
// have it.
export function grantFoundingStoneIfMissing(
  collectibles: GameStateCollectibles,
): GameStateCollectibles {
  const foundingStone = getEntry<CollectibleContent>(FOUNDING_STONE_NAME);
  if (!foundingStone) return collectibles;

  if (collectibles[foundingStone.id]) return collectibles;

  return {
    ...collectibles,
    [foundingStone.id]: { quantity: 1, foundAt: Date.now() },
  };
}
