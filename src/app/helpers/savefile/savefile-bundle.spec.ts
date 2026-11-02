import { describe, expect, it } from 'vitest';

import { defaultGameState } from '@helpers/defaults';
import { defaultLegacy } from '@helpers/legacy/legacy';
import {
  savefileBundleCreate,
  savefileBundleUnpack,
} from '@helpers/savefile/savefile-bundle';

describe('savefileBundleUnpack', () => {
  it('splits an exported bundle back into its sections', () => {
    const savefile = defaultGameState();
    const legacy = defaultLegacy();
    const json = JSON.stringify(savefileBundleCreate(savefile, legacy));

    expect(savefileBundleUnpack(JSON.parse(json))).toEqual({
      savefile,
      legacy,
    });
  });

  it('reads an older bare savefile as just the savefile', () => {
    const savefile = defaultGameState();
    expect(savefileBundleUnpack(savefile)).toEqual({ savefile });
  });

  it('passes a broken Legacy section through for its own validation', () => {
    const bundle = {
      ...savefileBundleCreate(defaultGameState(), defaultLegacy()),
      legacy: 'nope',
    };
    expect(savefileBundleUnpack(bundle).legacy).toBe('nope');
  });
});
