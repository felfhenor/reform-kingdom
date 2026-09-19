import { setAllContentById, setAllIdsByName } from '@helpers/content';
import { ensureContent } from '@helpers/content-initializers';
import { setAllMaps } from '@helpers/maps';
import type { ContentType, GameMap, IsContentItem } from '@interfaces';
import fs from 'fs-extra';
import path from 'path';

const PUBLIC_DIR = path.resolve(__dirname, '../../public');

// Mirrors `ContentService.unfurlAssets` (src/app/services/content.service.ts)
// against the same `public/json/all.json` build artifact the real app fetches
// over HTTP, so the simulator sees exactly the content the client would.
function unfurlAssets(assets: Record<string, IsContentItem[]>): void {
  const idsByName = new Map<string, string>();
  const contentById = new Map<string, IsContentItem>();

  Object.keys(assets).forEach((subtype) => {
    Object.values(assets[subtype]).forEach((entry) => {
      entry.__type = subtype as ContentType;

      if (idsByName.has(entry.name)) return;
      if (contentById.has(entry.id)) return;

      const cleaned = ensureContent(entry);
      idsByName.set(cleaned.name, cleaned.id);
      contentById.set(cleaned.id, cleaned);
    });
  });

  setAllIdsByName(idsByName);
  setAllContentById(contentById);
}

function loadContent(): void {
  const allJsonPath = path.join(PUBLIC_DIR, 'json/all.json');
  if (!fs.existsSync(allJsonPath)) {
    throw new Error(
      `Missing ${allJsonPath} - run \`npm run gamedata:build\` first.`,
    );
  }

  const assets = fs.readJsonSync(allJsonPath) as Record<
    string,
    IsContentItem[]
  >;
  unfurlAssets(assets);
}

function loadMaps(): void {
  const allMapsPath = path.join(PUBLIC_DIR, 'json/all-maps.json');
  if (!fs.existsSync(allMapsPath)) {
    throw new Error(
      `Missing ${allMapsPath} - run \`npm run build:maps\` first.`,
    );
  }

  const allMaps = fs.readJsonSync(allMapsPath) as Record<string, unknown>;
  const maps = new Map<string, GameMap>();

  Object.entries(allMaps).forEach(([name, data]) => {
    maps.set(name, { name, data });
  });

  setAllMaps(maps);
}

// Populates the same in-memory content/map signals `ContentService` fills
// from HTTP, straight from disk. Idempotent per process - call once before
// running any scenario.
export function bootstrapContent(): void {
  loadContent();
  loadMaps();
}
