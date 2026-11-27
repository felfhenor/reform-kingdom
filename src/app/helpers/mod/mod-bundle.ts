import { contentTypeList } from '@helpers/content/content-initializers';
import {
  MOD_BACKGROUND_SHEET,
  MOD_SPRITE_SIZE,
} from '@helpers/mod/mod-sprites';
import { tiledTilesetInline } from '@helpers/pixi/tiled-map-inline';
import { sortBy } from 'es-toolkit/compat';
import type {
  IsContentItem,
  ModBundle,
  ModBundleParseIO,
  ModBundleParseResult,
  ModFile,
  ModManifest,
  ModMapPatch,
  ModSprite,
  TiledMap,
  TiledObject,
  TiledTileset,
  TiledTilesetInlineIO,
} from '@interfaces';

const MOD_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const TILESET_NAME_PATTERN = /([^/]+)\.tsj$/;
const BASE_IMAGE_PATTERN = /(?:^|\/)mapdata\/([^/]+\.png)$/;
const decoder = new TextDecoder();

export function modFileText(file: ModFile): string {
  return decoder.decode(file.data);
}

// Zips often wrap everything in one top-level folder; strip it so paths start at the mod root.
export function modFilesNormalize(files: ModFile[]): ModFile[] {
  const cleaned = files.map((file) => ({
    ...file,
    path: file.path.replace(/\\/g, '/').replace(/^\/+/, ''),
  }));
  const manifest = sortBy(
    cleaned.filter((file) => /(^|\/)mod\.ya?ml$/.test(file.path)),
    (file) => file.path.length,
  )[0];
  const prefix = manifest ? manifest.path.replace(/mod\.ya?ml$/, '') : '';
  return cleaned
    .filter((file) => file.path.startsWith(prefix))
    .map((file) => ({ ...file, path: file.path.slice(prefix.length) }));
}

function modParseData(file: ModFile, io: ModBundleParseIO): unknown {
  const text = modFileText(file);
  return file.path.endsWith('.json') ? JSON.parse(text) : io.parseYaml(text);
}

export function modManifestParse(
  raw: unknown,
  errors: string[],
): ModManifest | undefined {
  const data = (raw ?? {}) as Record<string, unknown>;
  const id = String(data['id'] ?? '');
  if (!MOD_ID_PATTERN.test(id)) {
    errors.push(
      'mod.yml needs an `id` of lowercase letters, numbers and dashes.',
    );
    return undefined;
  }

  if (!data['name'] || data['version'] === undefined) {
    errors.push('mod.yml needs a `name` and a `version`.');
    return undefined;
  }

  const kind = data['kind'] === 'i18n' ? 'i18n' : 'content';
  return {
    id,
    name: String(data['name']),
    version: String(data['version']),
    kind,
    author: data['author'] ? String(data['author']) : undefined,
    description: data['description'] ? String(data['description']) : undefined,
    gameVersion: data['gameVersion']
      ? String(data['gameVersion']).replace(/^v/, '')
      : undefined,
  };
}

function modContentParse(
  files: ModFile[],
  contentTypes: string[],
  io: ModBundleParseIO,
  errors: string[],
): Record<string, IsContentItem[]> {
  const content: Record<string, IsContentItem[]> = {};
  files.forEach((file) => {
    const match = /^content\/([^/]+)\/.+\.(ya?ml|json)$/.exec(file.path);
    if (!match) return;

    const type = match[1];
    if (!contentTypes.includes(type)) {
      errors.push(`${file.path}: "${type}" is not a content type.`);
      return;
    }

    const entries = modParseData(file, io);
    if (!Array.isArray(entries)) {
      errors.push(`${file.path}: expected a list of entries.`);
      return;
    }

    entries.forEach((entry, index) => {
      if (entry && typeof entry === 'object') {
        (content[type] ??= []).push(entry as IsContentItem);
      } else {
        errors.push(`${file.path}: entry ${index + 1} has no fields.`);
      }
    });
  });
  return content;
}

// PNG width lives at a fixed offset in the IHDR chunk.
export function modPngWidth(file: ModFile): number {
  const bytes = file.data;
  if (bytes.length < 24) return 0;
  return (
    ((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0
  );
}

function modSpritesParse(
  files: ModFile[],
  io: ModBundleParseIO,
  errors: string[],
): ModSprite[] {
  return files.flatMap((file) => {
    const match = /^sprites\/([^/]+)\/([^/]+)\.png$/.exec(file.path);
    if (!match) return [];

    const width = modPngWidth(file);
    const isGrid = match[1] !== MOD_BACKGROUND_SHEET;
    if (width === 0 || (isGrid && width % MOD_SPRITE_SIZE !== 0)) {
      errors.push(
        `${file.path}: width must be a multiple of ${MOD_SPRITE_SIZE}.`,
      );
      return [];
    }

    return [
      {
        sheet: match[1],
        sprite: match[2],
        url: io.toUrl(file),
        width,
      },
    ];
  });
}

function modTsjReader(
  byPath: Map<string, ModFile>,
  io: ModBundleParseIO,
  onMissing: (path: string) => void,
): TiledTilesetInlineIO['readTsj'] {
  return (path) => {
    // A base tileset name always means the game's own, wherever the mod's copy sits.
    const baseName = TILESET_NAME_PATTERN.exec(path)?.[1];
    const base = baseName ? io.baseTileset(baseName) : undefined;
    if (base) {
      return {
        data: base as unknown as Record<string, unknown>,
        inlined: true,
      };
    }

    const file = byPath.get(path);
    if (file) return { data: JSON.parse(modFileText(file)) };

    onMissing(path);
    return undefined;
  };
}

function modImagePather(
  byPath: Map<string, ModFile>,
  io: ModBundleParseIO,
  onMissing: (path: string) => void,
): TiledTilesetInlineIO['imagePath'] {
  return (path) => {
    const file = byPath.get(path);
    if (file) return io.toUrl(file);

    const baseImage = BASE_IMAGE_PATTERN.exec(path)?.[1];
    if (baseImage) return `../mapdata/${baseImage}`;

    onMissing(path);
    return '';
  };
}

function modMapTilesetIO(
  files: ModFile[],
  io: ModBundleParseIO,
  errors: string[],
  mapPath: string,
): TiledTilesetInlineIO {
  const byPath = new Map(files.map((file) => [file.path, file]));
  return {
    readTsj: modTsjReader(byPath, io, (path) =>
      errors.push(`${mapPath}: tileset "${path}" not found.`),
    ),
    imagePath: modImagePather(byPath, io, (path) =>
      errors.push(`${mapPath}: tileset image "${path}" not found.`),
    ),
  };
}

function modMapParse(
  file: ModFile,
  files: ModFile[],
  io: ModBundleParseIO,
  errors: string[],
): TiledMap | undefined {
  const map = JSON.parse(modFileText(file)) as TiledMap;
  const tilesetIO = modMapTilesetIO(files, io, errors, file.path);
  const tilesets = (map.tilesets ?? []).map((tileset) =>
    tiledTilesetInline(
      tileset as unknown as Record<string, unknown>,
      'maps',
      tilesetIO,
    ),
  );
  if (tilesets.some((tileset) => !tileset)) return undefined;

  return { ...map, tilesets: tilesets as unknown as TiledTileset[] };
}

function modMapsParse(
  files: ModFile[],
  io: ModBundleParseIO,
  errors: string[],
): Record<string, TiledMap> {
  const maps: Record<string, TiledMap> = Object.create(null);
  files.forEach((file) => {
    const name = /^maps\/([^/]+)\.json$/.exec(file.path)?.[1];
    if (!name || name.includes('.patch')) return;

    const map = modMapParse(file, files, io, errors);
    if (map) maps[name] = map;
  });
  return maps;
}

function modMapPatchesParse(
  files: ModFile[],
  io: ModBundleParseIO,
  errors: string[],
): ModMapPatch[] {
  return files.flatMap((file) => {
    const map = /^maps\/([^/]+)\.patch\.(ya?ml|json)$/.exec(file.path)?.[1];
    if (!map) return [];

    const objects = modParseData(file, io);
    if (!Array.isArray(objects)) {
      errors.push(`${file.path}: expected a list of map objects.`);
      return [];
    }

    return [{ map, objects: objects as TiledObject[] }];
  });
}

function modBundleBuild(
  manifest: ModManifest,
  files: ModFile[],
  contentTypes: string[],
  io: ModBundleParseIO,
  errors: string[],
): ModBundle {
  return {
    manifest,
    content: modContentParse(files, contentTypes, io, errors),
    maps: modMapsParse(files, io, errors),
    mapPatches: modMapPatchesParse(files, io, errors),
    sprites: modSpritesParse(files, io, errors),
  };
}

export function modBundleParse(
  rawFiles: ModFile[],
  io: ModBundleParseIO,
): ModBundleParseResult {
  const contentTypes: string[] = contentTypeList();
  const errors: string[] = [];
  const files = modFilesNormalize(rawFiles);
  const manifestFile = files.find((file) => /^mod\.ya?ml$/.test(file.path));
  if (!manifestFile) return { errors: ['Missing mod.yml.'] };

  try {
    const manifest = modManifestParse(modParseData(manifestFile, io), errors);
    if (!manifest) return { errors };

    const bundle = modBundleBuild(manifest, files, contentTypes, io, errors);
    return { bundle, errors };
  } catch (err) {
    errors.push(`Could not read mod: ${(err as Error).message}`);
    return { errors };
  }
}
