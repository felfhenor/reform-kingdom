import '@/testing/reset';
import { modBundleParse, modPngWidth } from '@helpers/mod/mod-bundle';
import type { ModFile, TiledTileset } from '@interfaces';
import * as yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

const encoder = new TextEncoder();
const text = (path: string, body: string): ModFile => ({
  path,
  data: encoder.encode(body),
});

function png(path: string, width: number): ModFile {
  const data = new Uint8Array(24);
  new DataView(data.buffer).setUint32(16, width);
  return { path, data };
}

const terrain = { name: 'terrain', image: '../mapdata/terrain.png' };
const io = {
  toUrl: (file: ModFile) => `blob:${file.path}`,
  parseYaml: (body: string) => yaml.load(body),
  baseTileset: (name: string) =>
    name === 'terrain' ? (terrain as unknown as TiledTileset) : undefined,
};

const MANIFEST = text('wrap/mod.yml', 'id: my-mod\nname: My Mod\nversion: 1.2');

describe('modBundleParse', () => {
  it('reads manifest, content, sprites, maps and patches under a wrapper folder', () => {
    const { bundle, errors } = modBundleParse(
      [
        MANIFEST,
        text('wrap/content/item/gems.yml', '- id: gem\n  name: Gem'),
        png('wrap/sprites/item/gem.png', 128),
        text(
          'wrap/maps/Cave.json',
          JSON.stringify({
            layers: [],
            tilesets: [
              { firstgid: 1, source: '../public/mapdata/terrain.tsj' },
            ],
          }),
        ),
        text(
          'wrap/maps/Carrina.patch.yml',
          '- name: Portal\n  type: TeleportNode',
        ),
      ],
      io,
    );

    expect(errors).toEqual([]);
    expect(bundle?.manifest).toMatchObject({
      id: 'my-mod',
      version: '1.2',
      kind: 'content',
    });
    expect(bundle?.content['item'][0].name).toBe('Gem');
    expect(bundle?.sprites).toEqual([
      {
        sheet: 'item',
        sprite: 'gem',
        url: 'blob:sprites/item/gem.png',
      },
    ]);
    expect(bundle?.maps['Cave'].tilesets[0]).toEqual({
      ...terrain,
      firstgid: 1,
    });
    expect(bundle?.mapPatches[0].map).toBe('Carrina');
  });

  it('uses the base tileset for a base name in any folder, even when the mod ships a copy', () => {
    const map = JSON.stringify({
      layers: [],
      tilesets: [
        { firstgid: 1, source: 'tiles/terrain.tsj' },
        { firstgid: 500, source: 'tiles/cave.tsj' },
      ],
    });
    const { bundle, errors } = modBundleParse(
      [
        MANIFEST,
        text('wrap/maps/Cave.json', map),
        text('wrap/maps/tiles/terrain.tsj', '{"name":"copy","image":"x.png"}'),
        text('wrap/maps/tiles/cave.tsj', '{"name":"cave","image":"cave.png"}'),
        png('wrap/maps/tiles/cave.png', 64),
      ],
      io,
    );

    expect(errors).toEqual([]);
    expect(bundle?.maps['Cave'].tilesets).toEqual([
      { ...terrain, firstgid: 1 },
      { name: 'cave', image: 'blob:maps/tiles/cave.png', firstgid: 500 },
    ]);
  });

  it('rejects a missing or bad manifest', () => {
    expect(modBundleParse([], io).errors).toEqual(['Missing mod.yml.']);
    expect(
      modBundleParse([text('mod.yml', 'id: Bad Id')], io).bundle,
    ).toBeUndefined();
  });

  it('reports unknown content types, bad sprites and missing tilesets', () => {
    const { errors } = modBundleParse(
      [
        MANIFEST,
        text('wrap/content/nope/x.yml', '- id: a'),
        png('wrap/sprites/item/odd.png', 50),
        text(
          'wrap/maps/M.json',
          JSON.stringify({
            layers: [],
            tilesets: [{ firstgid: 1, source: 'gone.tsj' }],
          }),
        ),
      ],
      io,
    );

    expect(errors).toHaveLength(3);
  });

  it('takes node backgrounds at any width', () => {
    const { bundle, errors } = modBundleParse(
      [MANIFEST, png('wrap/sprites/backgrounds/cave.png', 1000)],
      io,
    );

    expect(errors).toEqual([]);
    expect(bundle?.sprites[0]).toMatchObject({
      sheet: 'backgrounds',
      sprite: 'cave',
    });
  });

  it('survives unparseable files', () => {
    const { errors } = modBundleParse(
      [MANIFEST, text('wrap/maps/M.json', '{not json')],
      io,
    );
    expect(errors[0]).toContain('Could not read mod');
  });
});

describe('modPngWidth', () => {
  it('reads the IHDR width', () => {
    expect(modPngWidth(png('a.png', 64))).toBe(64);
    expect(modPngWidth({ path: 'a.png', data: new Uint8Array(4) })).toBe(0);
  });
});
