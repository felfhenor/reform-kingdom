/* eslint-disable @typescript-eslint/no-explicit-any */
const fs = require('fs-extra');
const path = require('path');

fs.ensureDirSync('./public/json');
fs.ensureDirSync('./public/maps');

const mapFiles = fs
  .readdirSync('./gamemaps')
  .filter((file: string) => file.endsWith('.json'));

const mapNames = mapFiles.map((file: string) => path.basename(file, '.json'));

// tileset image paths are authored relative to `gamemaps/`, eg. `../public/mapdata/foo.png`.
// once the map is copied into `public/maps/`, that path needs to instead be relative to
// `public/maps/`, eg. `../mapdata/foo.png`, so the client can resolve it.
const rewriteTilesetImagePaths = (map: any) => {
  (map.tilesets ?? []).forEach((tileset: any) => {
    if (typeof tileset.image !== 'string') return;

    tileset.image = tileset.image.replace(/^\.\.\/public\//, '../');
  });
};

mapFiles.forEach((file: string) => {
  const map = fs.readJsonSync(`./gamemaps/${file}`);

  rewriteTilesetImagePaths(map);

  fs.writeJsonSync(`./public/maps/${file}`, map);
});

fs.writeJsonSync('./public/json/maps.json', mapNames);
console.info(
  `Copied ${mapFiles.length} map file(s) to public/maps/ and wrote public/json/maps.json`,
);
