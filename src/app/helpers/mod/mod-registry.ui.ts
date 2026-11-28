import { t } from '@helpers/i18n/i18n';
import { modRefLabel } from '@helpers/mod/mod-registry';
import type { ModInstalled, ModRef } from '@interfaces';

export function modsListLabel(refs: ModRef[]): string {
  return refs.map(modRefLabel).join(', ');
}

// The demo has no content to mod, so only translations stay usable there.
export function modsDemoRestrict(mods: ModInstalled[]): ModInstalled[] {
  return mods.map((mod) =>
    !mod.manifest || mod.manifest.kind === 'i18n'
      ? mod
      : {
          ...mod,
          bundle: undefined,
          errors: [...mod.errors, t('mods.languageOnly')],
        },
  );
}
