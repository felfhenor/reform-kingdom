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

export type TiledObjectOrientation = {
  gid: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
};
