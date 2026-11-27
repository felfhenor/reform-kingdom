import '@/testing/reset';
import {
  modGameVersionMismatch,
  modsDedupe,
  modsFindBundles,
  modsRunOutdated,
  setModsInstalled,
} from '@helpers/mod/mod-registry';
import type { ModBundle, ModInstalled } from '@interfaces';
import { describe, expect, it } from 'vitest';

function mod(key: string, id: string, errors: string[] = []): ModInstalled {
  const manifest = { id, name: id, version: '1', kind: 'content' as const };
  const bundle: ModBundle = {
    manifest,
    content: {},
    maps: {},
    mapPatches: [],
    sprites: [],
  };
  return { key, source: 'local', manifest, bundle, errors };
}

describe('modsDedupe', () => {
  it('keeps the first copy of an id and flags the rest', () => {
    const [first, second] = modsDedupe([mod('a', 'x'), mod('b', 'x')]);

    expect(first.bundle).toBeDefined();
    expect(second.bundle).toBeUndefined();
    expect(second.errors).toHaveLength(1);
  });
});

describe('modsFindBundles', () => {
  it('treats mods with errors as missing', () => {
    setModsInstalled([mod('a', 'ok'), mod('b', 'broken', ['bad'])]);
    const ref = { name: '', version: '1', kind: 'content' as const };

    const { bundles, missing } = modsFindBundles([
      { ...ref, id: 'ok' },
      { ...ref, id: 'broken' },
      { ...ref, id: 'gone' },
    ]);

    expect(bundles.map((b) => b.manifest.id)).toEqual(['ok']);
    expect(missing.map((m) => m.id)).toEqual(['broken', 'gone']);
  });
});

describe('modsRunOutdated', () => {
  it('flags a run mod only when a usable install has another version', () => {
    setModsInstalled([mod('a', 'ok'), mod('b', 'broken', ['bad'])]);
    const ref = { name: '', kind: 'content' as const };

    expect(modsRunOutdated([{ ...ref, id: 'ok', version: '1' }])).toBe(false);
    expect(modsRunOutdated([{ ...ref, id: 'ok', version: '0.9' }])).toBe(true);
    expect(modsRunOutdated([{ ...ref, id: 'broken', version: '0' }])).toBe(
      false,
    );
    expect(modsRunOutdated([{ ...ref, id: 'gone', version: '0' }])).toBe(false);
  });
});

describe('modGameVersionMismatch', () => {
  it('compares major.minor only, ignoring a leading v', () => {
    expect(modGameVersionMismatch('0.16.0', 'v0.16.3')).toBe(false);
    expect(modGameVersionMismatch('0.15', 'v0.16.3')).toBe(true);
    expect(modGameVersionMismatch(undefined, 'v0.16.3')).toBe(false);
    expect(modGameVersionMismatch('0.16', undefined)).toBe(false);
  });
});
