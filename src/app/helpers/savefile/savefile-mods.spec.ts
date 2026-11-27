import { seedContent } from '@/testing/content';
import { contentSnapshotBase, getEntry } from '@helpers/content/content';
import { ensureItem } from '@helpers/content/ensure-item';
import { defaultGameState } from '@helpers/defaults';
import { modsAppliedRefs, setModsInstalled } from '@helpers/mod/mod-registry';
import {
  modsApplyEnabled,
  savefileModsMissing,
  savefileModsPrepare,
} from '@helpers/savefile/savefile-mods';
import type { IsContentItem, ItemId, ModBundle, ModRef } from '@interfaces';
import { beforeEach, describe, expect, it } from 'vitest';

function installed(version: string, items: Partial<IsContentItem>[] = []) {
  const bundle: ModBundle = {
    manifest: { id: 'gems', name: 'Gems', version, kind: 'content' },
    content: { item: items as IsContentItem[] },
    maps: {},
    mapPatches: [],
    sprites: [],
  };
  setModsInstalled([
    {
      key: 'gems',
      source: 'local',
      manifest: bundle.manifest,
      bundle,
      errors: [],
    },
  ]);
}

function saveWith(mods: ModRef[]) {
  const state = defaultGameState();
  state.meta.mods = mods;
  return state;
}

const GEMS_V1: ModRef = {
  id: 'gems',
  name: 'Gems',
  version: '1',
  kind: 'content',
};

beforeEach(() => {
  seedContent([ensureItem({ id: 'ore' as ItemId, name: 'Ore' })]);
  contentSnapshotBase();
  setModsInstalled([]);
});

describe('savefileModsPrepare', () => {
  it('reports missing mods without applying anything', () => {
    const { errors } = savefileModsPrepare(saveWith([GEMS_V1]));

    expect(errors).toEqual(['Missing mod: Gems (v1)']);
    expect(modsAppliedRefs()).toEqual([]);
  });

  it('applies installed mods and bumps their version', () => {
    installed('2', [{ id: 'gem', name: 'Gem' }]);

    const { state, errors } = savefileModsPrepare(saveWith([GEMS_V1]));

    expect(errors).toEqual([]);
    expect(state.meta.mods[0].version).toBe('2');
    expect(getEntry('gem')).toBeDefined();
  });

  it('resets to the base game for an unmodded save', () => {
    installed('1', [{ id: 'gem', name: 'Gem' }]);
    modsApplyEnabled(['gems']);

    savefileModsPrepare(saveWith([]));

    expect(getEntry('gem')).toBeUndefined();
  });

  it('backs out when an installed mod no longer applies cleanly', () => {
    installed('1', [{ id: 'clash', name: 'Ore' }]);

    const { errors } = savefileModsPrepare(saveWith([GEMS_V1]));

    expect(errors).toHaveLength(1);
    expect(modsAppliedRefs()).toEqual([]);
  });
});

describe('savefileModsMissing', () => {
  it('lists nothing once the mod is installed', () => {
    installed('1');
    expect(savefileModsMissing(saveWith([GEMS_V1]))).toEqual([]);
  });
});

describe('modsApplyEnabled', () => {
  it('applies installed mods', () => {
    installed('1', [{ id: 'gem', name: 'Gem' }]);

    expect(modsApplyEnabled(['gems'])).toEqual([]);
    expect(modsAppliedRefs().map((ref) => ref.id)).toEqual(['gems']);
  });

  it('reports enabled mods that are missing instead of dropping them', () => {
    installed('1');

    expect(modsApplyEnabled(['nope', 'gems'])).toHaveLength(1);
    expect(modsAppliedRefs()).toEqual([]);
  });
});
