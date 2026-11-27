import {
  allContentById,
  allIdsByName,
  contentRestoreBase,
  setAllContentById,
  setAllIdsByName,
} from '@helpers/content/content';
import { allMaps, mapsRestoreBase, setAllMaps } from '@helpers/maps';
import { modArtErrors, modsKnownBackgrounds } from '@helpers/mod/mod-apply-art';
import { modApplyContent } from '@helpers/mod/mod-apply-content';
import { modApplyMaps } from '@helpers/mod/mod-apply-maps';
import {
  modRefOf,
  modsAppliedRefs,
  setModsAppliedRefs,
} from '@helpers/mod/mod-registry';
import { modSprites, setModSprites } from '@helpers/mod/mod-sprites';
import type { ModApplyResult, ModBundle, ModsLiveSnapshot } from '@interfaces';

export function modsReset(): void {
  contentRestoreBase();
  mapsRestoreBase();
  setModSprites([]);
  setModsAppliedRefs([]);
}

// Rolling back restores exactly what was live, even if the registry changed since it was applied.
export function modsLiveCapture(): ModsLiveSnapshot {
  return {
    contentById: allContentById(),
    idsByName: allIdsByName(),
    maps: allMaps(),
    sprites: [...modSprites().values()],
    refs: modsAppliedRefs(),
  };
}

export function modsLiveRestore(snapshot: ModsLiveSnapshot): void {
  setAllContentById(snapshot.contentById);
  setAllIdsByName(snapshot.idsByName);
  setAllMaps(snapshot.maps);
  setModSprites(snapshot.sprites);
  setModsAppliedRefs(snapshot.refs);
}

// Always starts from the base game, so re-applying the same list is idempotent.
export function modsApply(bundles: ModBundle[]): ModApplyResult {
  modsReset();

  const result: ModApplyResult = {};
  const backgrounds = modsKnownBackgrounds(bundles);
  bundles
    .filter((bundle) => bundle.manifest.kind !== 'i18n')
    .forEach((bundle) => {
      result[bundle.manifest.id] = [
        ...modApplyContent(bundle),
        ...modApplyMaps(bundle),
        ...modArtErrors(bundle, backgrounds),
      ];
    });

  setModSprites(bundles.flatMap((bundle) => bundle.sprites));
  setModsAppliedRefs(bundles.map(modRefOf));
  return result;
}

// Checks bundles together without disturbing whatever is live, e.g. a mod being installed mid-run.
export function modsApplyDryRun(bundles: ModBundle[]): ModApplyResult {
  const live = modsLiveCapture();
  try {
    return modsApply(bundles);
  } finally {
    modsLiveRestore(live);
  }
}

export function modsApplyErrors(result: ModApplyResult): string[] {
  return Object.entries(result).flatMap(([id, errors]) =>
    errors.map((error) => `${id}: ${error}`),
  );
}
