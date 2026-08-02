export type TiledTileset = {
  firstgid: number;
  name: string;
  image: string;
  imagewidth: number;
  imageheight: number;
  columns: number;
  tilewidth: number;
  tileheight: number;
  margin: number;
  spacing: number;
  tilecount: number;
};

export type TiledObject = {
  id: number;
  name: string;
  type: string;
  gid?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  visible: boolean;
  properties?: Array<{ name: string; type: string; value: unknown }>;
};

export type WorldNodeType = 'Kingdom' | 'ExploreNode' | 'TeleportNode';

export type KingdomObject = TiledObject & { type: 'Kingdom' };
export type ExploreNodeObject = TiledObject & { type: 'ExploreNode' };

export type TeleportNodeProperty =
  | { name: 'tag'; type: 'string'; value: string }
  | { name: 'toTag'; type: 'string'; value: string };

export type TeleportNodeObject = TiledObject & {
  type: 'TeleportNode';
  properties: TeleportNodeProperty[];
};

export type WorldNodeObject =
  | KingdomObject
  | ExploreNodeObject
  | TeleportNodeObject;

export type TiledObjectSpriteFrame = {
  imagePath: string;
  imageWidth: number;
  imageHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TiledLayer = {
  id: number;
  name: string;
  type: 'tilelayer' | 'objectgroup';
  visible: boolean;
  width?: number;
  height?: number;
  data?: number[];
  objects?: TiledObject[];
};

export type TiledMap = {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: TiledTileset[];
};

export type PixiNodeClickHandler = (object: TiledObject) => void;
