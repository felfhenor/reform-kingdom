import type { IsContentItem } from '@interfaces/identifiable';
import type { GameState } from '@interfaces/state-game';
import type {
  GameMap,
  TiledMap,
  TiledObject,
  TiledTileset,
} from '@interfaces/tiled-map';

export type ContentRef = { folder: string; name: string };

export type ContentRefResolve = (name: string, folder: string) => string;

export type ModKind = 'content' | 'i18n';

export type ModRef = {
  id: string;
  name: string;
  version: string;
  kind: ModKind;
};

export type ModManifest = ModRef & {
  author?: string;
  description?: string;
};

export type ModSource = 'local' | 'folder' | 'modio';

export type ModFile = {
  path: string;
  data: Uint8Array<ArrayBuffer>;
};

export type ModSprite = {
  sheet: string;
  sprite: string;
  url: string;
};

export type ModMapPatch = {
  map: string;
  objects: TiledObject[];
};

export type ModBundle = {
  manifest: ModManifest;
  content: Record<string, IsContentItem[]>;
  maps: Record<string, TiledMap>;
  mapPatches: ModMapPatch[];
  sprites: ModSprite[];
};

export type ModBundleParseResult = {
  bundle?: ModBundle;
  errors: string[];
};

export type ModBundleParseIO = {
  toUrl: (file: ModFile) => string;
  parseYaml: (text: string) => unknown;
  baseTileset: (name: string) => TiledTileset | undefined;
};

export type TiledTsjRead = {
  data: Record<string, unknown>;
  inlined?: boolean;
};

export type TiledTilesetInlineIO = {
  readTsj: (path: string) => TiledTsjRead | undefined;
  imagePath: (path: string) => string;
};

export type ModsFound = {
  bundles: ModBundle[];
  missing: ModRef[];
};

export type SavefileModsPrepared = {
  state: GameState;
  errors: string[];
};

export type ModsLiveSnapshot = {
  contentById: Map<string, IsContentItem>;
  idsByName: Map<string, string>;
  maps: Map<string, GameMap>;
  sprites: ModSprite[];
  refs: ModRef[];
};

export type ModApplyResult = Record<string, string[]>;

export type SpriteFrame = {
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ModInstalled = {
  source: ModSource;
  manifest?: ModManifest;
  bundle?: ModBundle;
  errors: string[];
  key: string;
  modioId?: number;
};

export type ModStoredEntry = {
  key: string;
  modioId?: number;
};

export type ModDiskRead = {
  files?: ModFile[];
  zip?: Uint8Array<ArrayBuffer>;
};

export type ElectronModsBridge = {
  modsList: () => Promise<string[]>;
  modsRead: (name: string) => Promise<ModDiskRead>;
  modsOpenFolder: () => Promise<boolean>;
};

export type WindowWithElectronModsBridge = Window & {
  reformElectron?: Partial<ElectronModsBridge>;
};
