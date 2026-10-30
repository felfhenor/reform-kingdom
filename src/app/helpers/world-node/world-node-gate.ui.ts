import { getEntry } from '@helpers/content/content';
import { museumCollectibleEntry } from '@helpers/kingdom/museum.ui';
import { worldNodeGateRequiredIds } from '@helpers/world-node/world-node-gate';
import type {
  CollectibleContent,
  MuseumCollectibleEntry,
  WorldNodeEntry,
} from '@interfaces';

export function worldNodeGateMissingCollectibleEntries(
  entry: WorldNodeEntry,
): MuseumCollectibleEntry[] {
  return worldNodeGateRequiredIds(entry)
    .map((id) => getEntry<CollectibleContent>(id))
    .filter((collectible): collectible is CollectibleContent => !!collectible)
    .map(museumCollectibleEntry)
    .filter((collectible) => !collectible.discovered);
}
