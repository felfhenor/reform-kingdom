import { t } from '@helpers/i18n/i18n';
import { isDemoBuild } from '@helpers/demo/demo';
import { modsApply, modsApplyErrors, modsReset } from '@helpers/mod/mod-apply';
import {
  modRefLabel,
  modRefOf,
  modsFindBundles,
  modUsableBundle,
} from '@helpers/mod/mod-registry';
import type { GameState, ModRef, SavefileModsPrepared } from '@interfaces';

// Older saves recorded translation mods; the language is a global option now, so they never gate a load.
function savefileModRefs(state: GameState): ModRef[] {
  return (state.meta?.mods ?? []).filter((ref) => ref.kind !== 'i18n');
}

export function savefileModsMissing(state: GameState): string[] {
  const refs = savefileModRefs(state);
  if (refs.length > 0 && isDemoBuild()) {
    return [t('savefileMods.demoCannotLoadMods')];
  }

  return modsFindBundles(refs).missing.map((ref) =>
    t('savefileMods.missingMod', { ref: modRefLabel(ref) }),
  );
}

// Applies the save's mods before migration, which would otherwise prune every mod id; versions are bumped to what's installed.
export function savefileModsPrepare(state: GameState): SavefileModsPrepared {
  const refs = savefileModRefs(state);
  if (refs.length === 0) {
    modsReset();
    const hadRefs = (state.meta?.mods ?? []).length > 0;
    return {
      state: hadRefs ? { ...state, meta: { ...state.meta, mods: [] } } : state,
      errors: [],
    };
  }

  const missing = savefileModsMissing(state);
  if (missing.length > 0) return { state, errors: missing };

  const { bundles } = modsFindBundles(refs);
  const errors = modsApplyErrors(modsApply(bundles));
  if (errors.length > 0) {
    modsReset();
    return { state, errors };
  }

  const mods = bundles.map(modRefOf);
  return { state: { ...state, meta: { ...state.meta, mods } }, errors: [] };
}

export function modsApplyEnabled(enabledIds: string[]): string[] {
  const bundles = enabledIds.map((id) => modUsableBundle(id));
  const unusable = enabledIds
    .filter((_, i) => bundles[i] === undefined)
    .map((id) => t('savefileMods.notInstalledOrIt', { id }));
  if (unusable.length > 0) return unusable;

  return modsApplyErrors(
    modsApply(bundles.filter((bundle) => bundle !== undefined)),
  );
}
