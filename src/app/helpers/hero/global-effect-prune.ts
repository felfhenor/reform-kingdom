import { getEntry } from '@helpers/content/content';
import type { GlobalEffect, GlobalEffectContent } from '@interfaces';

// Older saves lack fields added since (e.g. `effects`), so content fills the gaps under what was saved.
export function pruneInvalidGlobalEffects(
  globalEffects: GlobalEffect[],
): GlobalEffect[] {
  return globalEffects.flatMap((effect) => {
    const content = getEntry<GlobalEffectContent>(effect.id);
    return content ? [{ ...content, ...effect }] : [];
  });
}
