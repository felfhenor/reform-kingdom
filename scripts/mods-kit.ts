import { contentTypeList } from '@helpers/content/content-initializers';
import type { ModFile } from '@interfaces';
import { sortBy } from 'es-toolkit/compat';
import fs from 'fs-extra';
import * as yaml from 'js-yaml';
import path from 'path';
import { modDirFiles, zipModFiles } from './mods-files';

// Builds dist/mods/reform-modkit(.zip): the only thing modders get, so it's generated from the game data and never edited by hand.
const KIT = 'reform-modkit';
const OUT_DIR = path.resolve('dist/mods');
const JSON_DIR = path.resolve('public/json');
const MAPDATA_DIR = path.resolve('public/mapdata');
const ART_DIR = path.resolve('gameassets');
const BACKGROUND_DIR = path.resolve('public/asset/nodebg');
const SAMPLE_BACKGROUND = 'cave-crystal-red.png';
const MOD = 'my-mod';
const MANIFEST_HEADER = [
  '# id: lowercase letters, numbers and dashes. Savefiles use this to find your mod - do not change it!',
  '# version: bump it for every release. Savefiles use this to update your mod.',
  "# gameVersion: the game version you built against. The mod manager in-game will warn players if there's a mismatch.",
  '',
].join('\n');

const files: ModFile[] = [];
const text = (filePath: string, body: string) =>
  files.push({ path: filePath, data: new Uint8Array(Buffer.from(body)) });
const copy = (filePath: string, source: string) =>
  files.push({ path: filePath, data: new Uint8Array(fs.readFileSync(source)) });
const dump = (data: unknown) => yaml.dump(data, { lineWidth: -1 });

const gameVersion = (): string =>
  String(fs.readJsonSync(path.resolve('package.json')).version);

const artSheets = (): string[] =>
  fs
    .readdirSync(ART_DIR)
    .filter((sheet) => fs.statSync(path.join(ART_DIR, sheet)).isDirectory());

const addModSkeleton = () => {
  text(
    `${MOD}/mod.yml`,
    MANIFEST_HEADER +
      yaml.dump(
        {
          id: MOD,
          name: 'My Mod',
          version: '1.0.0',
          author: 'Your Name',
          description: 'What your mod adds or changes.',
          gameVersion: gameVersion(),
        },
        { lineWidth: -1, forceQuotes: true },
      ),
  );
  contentTypeList().forEach((type) =>
    text(`${MOD}/content/${type}/.removeme`, ''),
  );
  [...artSheets(), 'backgrounds'].forEach((sheet) =>
    text(`${MOD}/sprites/${sheet}/.removeme`, ''),
  );
};

// Tiled needs the tilesets on disk to open a map; the game swaps in its own by file name.
const kitMapJson = (map: { tilesets: { source?: string }[] }) =>
  JSON.stringify(
    {
      ...map,
      tilesets: map.tilesets.map((tileset) =>
        tileset.source
          ? { ...tileset, source: `tilesets/${path.basename(tileset.source)}` }
          : tileset,
      ),
    },
    null,
    1,
  );

const addTilesets = (modDir: string) =>
  fs
    .readdirSync(MAPDATA_DIR)
    .forEach((file) =>
      copy(`${modDir}/maps/tilesets/${file}`, path.join(MAPDATA_DIR, file)),
    );

const addTemplateMap = () => {
  text(
    `${MOD}/maps/MyMap.json`,
    kitMapJson(fs.readJsonSync(path.resolve('gamemaps/Template.json'))),
  );
  addTilesets(MOD);
};

const addExample = async () => {
  const dir = 'examples/showcase';
  (await modDirFiles('showcase')).forEach((file) => {
    if (!/^maps\/[^/]+\.json$/.test(file.path)) {
      files.push({ ...file, path: `${dir}/${file.path}` });
      return;
    }
    const map = JSON.parse(Buffer.from(file.data).toString('utf-8'));
    text(`${dir}/${file.path}`, kitMapJson(map));
  });
  addTilesets(dir);
};

const addContentIndex = (all: Record<string, { id: string; name: string }[]>) =>
  Object.entries(all).forEach(([type, entries]) => {
    const rows = sortBy(
      entries.map((entry) => ({ name: entry.name, id: entry.id })),
      (entry) => entry.name.toLowerCase(),
    );
    text(`reference/content/${type}.yml`, dump(rows));
  });

type KitMapLayer = { name: string; objects?: { name: string; type: string }[] };
type KitMap = { width: number; height: number; layers: KitMapLayer[] };

const addMapIndex = (maps: Record<string, KitMap>) => {
  const rows = Object.entries(maps)
    .filter(([name]) => name !== 'Template')
    .map(([name, map]) => ({
      map: name,
      tiles: `${map.width}x${map.height}`,
      nodes: (
        map.layers.find((layer) => layer.name === 'Explore Nodes')?.objects ??
        []
      ).map((node) => `${node.name} (${node.type})`),
    }));
  text('reference/maps.yml', dump(rows));
};

type KitArtEntry = { sprite?: string; frames?: number };

// Base animations are stored one frame per file, so the list marks where each animation starts.
const animationFrames = (
  all: Record<string, KitArtEntry[]>,
  sheet: string,
): Map<string, number> =>
  new Map(
    (all[sheet] ?? [])
      .filter((entry) => !!entry.sprite && (entry.frames ?? 1) > 1)
      .map((entry) => [entry.sprite as string, entry.frames as number]),
  );

const addArtIndex = (all: Record<string, KitArtEntry[]>) => {
  artSheets().forEach((sheet) => {
    const sprites = sortBy(fs.readdirSync(path.join(ART_DIR, sheet)));
    const frames = animationFrames(all, sheet);
    text(
      `reference/sprites/${sheet}.txt`,
      sprites
        .map((file) => path.basename(file, '.png'))
        .map((name) =>
          frames.has(name) ? `${name} (${frames.get(name)} frames)` : name,
        )
        .join('\n'),
    );
    copy(
      `reference/art/${sheet}/${sprites[0]}`,
      path.join(ART_DIR, sheet, sprites[0]),
    );
  });
  const backgrounds = sortBy(fs.readdirSync(BACKGROUND_DIR));
  text(
    'reference/backgrounds.txt',
    backgrounds.map((file) => path.basename(file, '.png')).join('\n'),
  );
  copy(
    `reference/art/backgrounds/${SAMPLE_BACKGROUND}`,
    path.join(BACKGROUND_DIR, SAMPLE_BACKGROUND),
  );
};

const run = async () => {
  copy('MODDING.md', path.resolve('MODDING.md'));
  addModSkeleton();
  addTemplateMap();
  const all = fs.readJsonSync(path.join(JSON_DIR, 'all.json'));
  addContentIndex(all);
  addMapIndex(fs.readJsonSync(path.join(JSON_DIR, 'all-maps.json')));
  addArtIndex(all);
  await addExample();

  const kitDir = path.join(OUT_DIR, KIT);
  fs.removeSync(kitDir);
  files.forEach((file) =>
    fs.outputFileSync(path.join(kitDir, file.path), file.data),
  );
  fs.writeFileSync(
    `${kitDir}.zip`,
    await zipModFiles(
      files.map((file) => ({ ...file, path: `${KIT}/${file.path}` })),
    ),
  );
  console.log(`Wrote ${files.length} files to dist/mods/${KIT} and ${KIT}.zip`);
};

run();
