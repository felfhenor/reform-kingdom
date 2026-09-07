import { caravanState, caravanTimerLabel } from '@helpers/caravan/caravan';
import { worldNodeCaravan } from '@helpers/world-node/world-nodes';
import type { WorldNodeEntry } from '@interfaces';

export function worldNodeCaravanTimerText(
  entry: WorldNodeEntry,
): string | undefined {
  const content = worldNodeCaravan(entry);
  if (!content) return undefined;

  return caravanTimerLabel(content, caravanState(content.id));
}
