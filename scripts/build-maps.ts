/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  pathRelative,
  tiledTilesetInline,
} from '@helpers/pixi/tiled-map-inline';
import fs from 'fs-extra';
import path from 'path';
import { CONTENT_OUT_DIR } from './content-out-dir';
import { demoManifest } from './demo-content';
import { writeJsonIfChanged } from './write-json-if-changed';

fs.ensureDirSync(CONTENT_OUT_DIR);

const demoMaps = process.argv.includes('--demo')
  ? demoManifest().maps
  : undefined;

const mapFiles = fs
  .readdirSync('./gamemaps')
  .filter((file: string) => file.endsWith('.json'))
  .filter(
    (file: string) => demoMaps?.includes(path.basename(file, '.json')) ?? true,
  );

const GAMEMAPS_DIR = 'gamemaps';
// Not an actual output dir anymore - kept as the fixed anchor tileset image paths are computed relative to.
const PUBLIC_MAPS_DIR = 'public/maps';
const MAPDATA_DIR = 'public/mapdata';

const inlineIO = {
  readTsj: (tsjPath: string) => ({ data: fs.readJsonSync(tsjPath) }),
  imagePath: (imagePath: string) => pathRelative(PUBLIC_MAPS_DIR, imagePath),
};

const resolveTileset = (tileset: any, mapDir: string) =>
  tiledTilesetInline(tileset, mapDir, inlineIO);

// Object.create(null) so a map literally named "__proto__" can't silently vanish into the prototype instead of becoming an own key.
const allMaps: Record<string, unknown> = Object.create(null);

mapFiles.forEach((file: string) => {
  const map = fs.readJsonSync(`./gamemaps/${file}`);

  map.tilesets = (map.tilesets ?? []).map((tileset: any) =>
    resolveTileset(tileset, GAMEMAPS_DIR),
  );

  allMaps[path.basename(file, '.json')] = map;
});

// Every base tileset, so mod maps can use one without a fetch (which can't read file:// on desktop).
const allTilesets: Record<string, unknown> = Object.create(null);
fs.readdirSync(MAPDATA_DIR)
  .filter((file: string) => file.endsWith('.tsj'))
  .forEach((file: string) => {
    const tsj = fs.readJsonSync(`${MAPDATA_DIR}/${file}`);
    allTilesets[path.basename(file, '.tsj')] = {
      ...tsj,
      image: inlineIO.imagePath(`${MAPDATA_DIR}/${tsj.image}`),
    };
  });
writeJsonIfChanged(`${CONTENT_OUT_DIR}/all-tilesets.json`, allTilesets);

// Bundled into one file (rather than fetched per-map) so the client makes a single request at load instead of one per map.
writeJsonIfChanged(`${CONTENT_OUT_DIR}/all-maps.json`, allMaps);
console.info(
  `Wrote ${mapFiles.length} map(s) to ${CONTENT_OUT_DIR}/all-maps.json`,
);
