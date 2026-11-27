import {
  pathRelative,
  pathResolve,
  tiledTilesetInline,
} from '@helpers/pixi/tiled-map-inline';
import { describe, expect, it } from 'vitest';

describe('path helpers', () => {
  it('resolves and relativizes POSIX-style', () => {
    expect(pathResolve('gamemaps', '../public/mapdata/a.tsj')).toBe(
      'public/mapdata/a.tsj',
    );
    expect(pathRelative('public/maps', 'public/mapdata/a.png')).toBe(
      '../mapdata/a.png',
    );
  });
});

describe('tiledTilesetInline', () => {
  const io = {
    readTsj: (path: string) =>
      path === 'public/mapdata/a.tsj'
        ? { data: { image: 'a.png' } }
        : undefined,
    imagePath: (path: string) => pathRelative('public/maps', path),
  };

  it('inlines an external tileset and rewrites its image', () => {
    expect(
      tiledTilesetInline(
        { firstgid: 5, source: '../public/mapdata/a.tsj' },
        'gamemaps',
        io,
      ),
    ).toEqual({ image: '../mapdata/a.png', firstgid: 5 });
  });

  it('returns undefined for a missing tileset', () => {
    expect(
      tiledTilesetInline({ firstgid: 1, source: 'nope.tsj' }, 'maps', io),
    ).toBeUndefined();
  });

  it('keeps already-inlined data as-is', () => {
    const inlinedIO = {
      ...io,
      readTsj: () => ({ data: { image: '../mapdata/b.png' }, inlined: true }),
    };
    expect(
      tiledTilesetInline({ firstgid: 2, source: 'x.tsj' }, 'maps', inlinedIO),
    ).toEqual({ image: '../mapdata/b.png', firstgid: 2 });
  });
});
