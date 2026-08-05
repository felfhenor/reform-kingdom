import {
  getCollectibleFoundAtNode,
  getCollectibleQuantity,
  isCollectibleDiscovered,
} from '@helpers/collectibles';
import { getEntriesByType } from '@helpers/content';
import type {
  CollectibleContent,
  CollectibleId,
  EncounterContent,
  MuseumCollectibleEntry,
} from '@interfaces';
import { RARITY_PRIORITY } from '@interfaces';
import { orderBy } from 'es-toolkit/compat';

// The nodes an as-yet-undiscovered collectible can drop from, derived by
// reverse-scanning every encounter's completion rewards - collectibles don't
// know their own source node until a copy has actually been found.
export function collectibleSourceNodeNames(
  collectibleId: CollectibleId,
): string[] {
  const encounters = getEntriesByType<EncounterContent>('encounter');

  const names = new Set<string>();
  encounters.forEach((encounter) => {
    const dropsHere = encounter.completionRewards.some(
      (reward) =>
        'collectibleId' in reward && reward.collectibleId === collectibleId,
    );
    if (dropsHere) names.add(encounter.name);
  });

  return [...names];
}

// Every collectible in the game, discovered or not - undiscovered entries
// are still returned (with `quantity: 0`) so the museum can render them as
// silhouettes rather than omitting them entirely.
export function getMuseumCollectibleEntries(): MuseumCollectibleEntry[] {
  const collectibles = getEntriesByType<CollectibleContent>('collectible');

  const entries = collectibles.map((collectible) => {
    const discovered = isCollectibleDiscovered(collectible.id);

    return {
      collectible,
      discovered,
      quantity: getCollectibleQuantity(collectible.id),
      foundAtNode: getCollectibleFoundAtNode(collectible.id),
      sourceNodeNames: discovered
        ? []
        : collectibleSourceNodeNames(collectible.id),
    };
  });

  return orderBy(
    entries,
    [
      (entry) => (entry.discovered ? 1 : 0),
      (entry) => RARITY_PRIORITY[entry.collectible.rarity],
      (entry) => entry.collectible.name,
    ],
    ['desc', 'desc', 'asc'],
  );
}

export function filterMuseumCollectibleEntries(
  entries: MuseumCollectibleEntry[],
  searchText: string,
): MuseumCollectibleEntry[] {
  const text = searchText.trim().toLowerCase();
  if (text === '') return entries;

  return entries.filter((entry) => {
    if (!entry.discovered) {
      return entry.sourceNodeNames.some((name) =>
        name.toLowerCase().includes(text),
      );
    }

    if (entry.collectible.name.toLowerCase().includes(text)) return true;
    if (entry.collectible.description.toLowerCase().includes(text)) {
      return true;
    }
    if (entry.foundAtNode?.toLowerCase().includes(text)) return true;

    return false;
  });
}
