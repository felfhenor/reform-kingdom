/**
 * Loads the compiled `public/json/*.json` / `public/maps/*.json` output
 * (produced by `npm run gamedata:build` / `npm run build:maps`) from disk
 * and populates the same `@helpers/content` / `@helpers/maps` signals that
 * `ContentService` populates in the browser - so the analysis functions
 * under `src/app/helpers/debug/` behave identically whether they're called
 * from a CLI script or the `/debug` dashboard.
 */

import fs from 'fs-extra';
import path from 'path';
import { unfurlContent } from '@helpers/content';
import { setAllMaps } from '@helpers/maps';
import type { GameMap, IsContentItem } from '@interfaces';

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const JSON_DIR = path.join(ROOT_DIR, 'public', 'json');
const MAPS_DIR = path.join(ROOT_DIR, 'public', 'maps');

function requireJson(filePath: string, description: string): unknown {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Could not find ${description} at "${filePath}". Run "npm run gamedata:build" (or "npm run build") before running this script.`,
    );
  }

  return fs.readJsonSync(filePath);
}

export function loadCompiledContentFromDisk(): void {
  const assets = requireJson(
    path.join(JSON_DIR, 'all.json'),
    'compiled content (public/json/all.json)',
  ) as Record<string, IsContentItem[]>;
  unfurlContent(assets, (message) => console.warn(`[Content] ${message}`));

  const mapNames = requireJson(
    path.join(JSON_DIR, 'maps.json'),
    'the compiled map list (public/json/maps.json)',
  ) as string[];

  const maps = new Map<string, GameMap>();
  mapNames.forEach((name) => {
    const data = requireJson(
      path.join(MAPS_DIR, `${name}.json`),
      `compiled map "${name}" (public/maps/${name}.json)`,
    );
    maps.set(name, { name, data });
  });
  setAllMaps(maps);
}
