export type PixiAppConfig = {
  width: number;
  height: number;
  backgroundAlpha?: number;
  antialias?: boolean;
};

export type CameraPosition = {
  x: number;
  y: number;
};

export type CameraBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type ViewportTiles = {
  widthTiles: number;
  heightTiles: number;
};

export type TiledObjectOrientation = {
  gid: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
};
