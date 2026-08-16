import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/analytics';
import { getEntry } from '@helpers/content';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  CollectibleContent,
  CollectibleId,
  GameStateCollectibles,
} from '@interfaces';

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
  return gamestate().collectibles[collectibleId]?.quantity ?? 0;
}

export function isCollectibleDiscovered(collectibleId: CollectibleId): boolean {
  return !!gamestate().collectibles[collectibleId]?.foundAt;
}

export function collectiblesAdd(
  collectibleId: CollectibleId,
  quantity = 1,
): void {
  if (quantity <= 0) return;

  const alreadyDiscovered = isCollectibleDiscovered(collectibleId);

  updateGamestate((state) => {
    const existing = state.collectibles[collectibleId];
    const current = existing?.quantity ?? 0;
    const foundAt = existing?.foundAt ?? Date.now();
    state.collectibles[collectibleId] = {
      quantity: current + quantity,
      foundAt,
    };
    return state;
  });

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
// have it (see `migrateGameState`).
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
