import type {
  GameState,
  LegacyState,
  SavefileBundle,
  SavefileBundleSections,
} from '@interfaces';
import { isPlainObject } from 'es-toolkit';

const SAVEFILE_BUNDLE_FORMAT = 'reform-kingdom-bundle';
const SAVEFILE_BUNDLE_VERSION = 1;

export function savefileBundleCreate(
  savefile: GameState,
  legacy: LegacyState,
): SavefileBundle {
  return {
    format: SAVEFILE_BUNDLE_FORMAT,
    version: SAVEFILE_BUNDLE_VERSION,
    savefile,
    legacy,
  };
}

// Anything without the bundle marker is an older .rek holding just the savefile.
export function savefileBundleUnpack(value: unknown): SavefileBundleSections {
  if (!isPlainObject(value) || value['format'] !== SAVEFILE_BUNDLE_FORMAT) {
    return { savefile: value };
  }

  return { savefile: value['savefile'], legacy: value['legacy'] };
}
