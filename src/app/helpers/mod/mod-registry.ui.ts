import { modRefLabel } from '@helpers/mod/mod-registry';
import type { ModRef } from '@interfaces';

export function modsListLabel(refs: ModRef[]): string {
  return refs.map(modRefLabel).join(', ');
}
