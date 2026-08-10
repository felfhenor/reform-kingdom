/* eslint-disable @typescript-eslint/no-explicit-any */
const fs = require('fs-extra');
const path = require('path');

fs.ensureDirSync('./public/json');
fs.ensureDirSync('./public/maps');

const mapFiles = fs
  .readdirSync('./gamemaps')
  .filter((file: string) => file.endsWith('.json'));

const mapNames = mapFiles.map((file: string) => path.basename(file, '.json'));

const GAMEMAPS_DIR = path.resolve('./gamemaps');
const PUBLIC_MAPS_DIR = path.resolve('./public/maps');

// image paths in tileset data are authored relative to wherever that data lives
// (the map file for an embedded tileset, or the .tsj file for an external one).
// once the map is copied into `public/maps/`, the path needs to instead be relative
// to `public/maps/`, eg. `../mapdata/foo.png`, so the client can resolve it.
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

mapFiles.forEach((file: string) => {
  const map = fs.readJsonSync(`./gamemaps/${file}`);

  map.tilesets = (map.tilesets ?? []).map((tileset: any) =>
    resolveTileset(tileset, GAMEMAPS_DIR),
  );

  fs.writeJsonSync(`./public/maps/${file}`, map);
});

fs.writeJsonSync('./public/json/maps.json', mapNames);
console.info(
  `Copied ${mapFiles.length} map file(s) to public/maps/ and wrote public/json/maps.json`,
);
