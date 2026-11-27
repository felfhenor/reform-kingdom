import type { TiledTilesetInlineIO } from '@interfaces';

function pathSegments(path: string): string[] {
  return path.split(/[\\/]/).filter((part) => part !== '' && part !== '.');
}

// POSIX-style resolve without Node's `path`, so the same code runs in scripts and the browser.
export function pathResolve(dir: string, relative: string): string {
  const out: string[] = [];
  [...pathSegments(dir), ...pathSegments(relative)].forEach((part) => {
    if (part === '..') out.pop();
    else out.push(part);
  });
  return out.join('/');
}

export function pathDirname(path: string): string {
  return pathSegments(path).slice(0, -1).join('/');
}

export function pathRelative(from: string, to: string): string {
  const fromParts = pathSegments(from);
  const toParts = pathSegments(to);
  let shared = 0;
  while (
    shared < fromParts.length &&
    shared < toParts.length &&
    fromParts[shared] === toParts[shared]
  ) {
    shared++;
  }

  return [
    ...fromParts.slice(shared).map(() => '..'),
    ...toParts.slice(shared),
  ].join('/');
}

function tiledTilesetRewriteImage(
  tileset: Record<string, unknown>,
  imageBaseDir: string,
  io: TiledTilesetInlineIO,
): Record<string, unknown> {
  if (typeof tileset['image'] !== 'string') return tileset;

  return {
    ...tileset,
    image: io.imagePath(pathResolve(imageBaseDir, tileset['image'])),
  };
}

// External `{ firstgid, source }` tilesets are inlined, so the client only ever deals with embedded ones.
export function tiledTilesetInline(
  tileset: Record<string, unknown>,
  mapDir: string,
  io: TiledTilesetInlineIO,
): Record<string, unknown> | undefined {
  if (typeof tileset['source'] !== 'string') {
    return tiledTilesetRewriteImage(tileset, mapDir, io);
  }

  const tsjPath = pathResolve(mapDir, tileset['source']);
  const tsj = io.readTsj(tsjPath);
  if (!tsj) return undefined;
  if (tsj.inlined) return { ...tsj.data, firstgid: tileset['firstgid'] };

  return tiledTilesetRewriteImage(
    { ...tsj.data, firstgid: tileset['firstgid'] },
    pathDirname(tsjPath),
    io,
  );
}
