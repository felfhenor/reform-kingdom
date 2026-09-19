/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs-extra';
import path from 'path';

fs.ensureDirSync('./public/json');

const mapFiles = fs
  .readdirSync('./gamemaps')
  .filter((file: string) => file.endsWith('.json'));

const GAMEMAPS_DIR = path.resolve('./gamemaps');
// Not an actual output dir anymore - kept as the fixed anchor tileset image paths are computed relative to.
const PUBLIC_MAPS_DIR = path.resolve('./public/maps');

// image paths in tileset data are authored relative to wherever that data lives
// (the map file for an embedded tileset, or the .tsj file for an external one).
// rewrite them to be relative to `PUBLIC_MAPS_DIR` instead, eg. `../mapdata/foo.png`,
// which is the base path the client resolves tileset images against at runtime.
const rewriteTilesetImagePath = (tileset: any, imageBaseDir: string) => {
  if (typeof tileset.image !== 'string') return tileset;

  const imageAbsPath = path.resolve(imageBaseDir, tileset.image);
  const imageRelPath = path
    .relative(PUBLIC_MAPS_DIR, imageAbsPath)
    .split(path.sep)
    .join('/');

  return { ...tileset, image: imageRelPath };
};

// external tilesets are referenced via `{ firstgid, source }`, pointing at a .tsj
// file (itself Tiled JSON tileset format). resolve and inline that data so the
// client only ever deals with embedded tilesets.
const resolveTileset = (tileset: any, mapDir: string) => {
  if (typeof tileset.source !== 'string') {
    return rewriteTilesetImagePath(tileset, mapDir);
  }

  const tsjPath = path.resolve(mapDir, tileset.source);
  const tsjDir = path.dirname(tsjPath);
  const tsjData = fs.readJsonSync(tsjPath);

  return rewriteTilesetImagePath(
    { ...tsjData, firstgid: tileset.firstgid },
    tsjDir,
  );
};

// Object.create(null) so a map literally named "__proto__" can't silently vanish into the prototype instead of becoming an own key.
const allMaps: Record<string, unknown> = Object.create(null);

mapFiles.forEach((file: string) => {
  const map = fs.readJsonSync(`./gamemaps/${file}`);

  map.tilesets = (map.tilesets ?? []).map((tileset: any) =>
    resolveTileset(tileset, GAMEMAPS_DIR),
  );

  allMaps[path.basename(file, '.json')] = map;
});

// Bundled into one file (rather than fetched per-map) so the client makes a single request at load instead of one per map.
fs.writeJsonSync('./public/json/all-maps.json', allMaps);
console.info(
  `Wrote ${mapFiles.length} map(s) to public/json/all-maps.json`,
);
