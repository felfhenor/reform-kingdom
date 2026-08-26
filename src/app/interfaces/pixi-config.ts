import type { CurrentLocation } from '@interfaces/state-game';

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

// Tracks a single map-token's eased visual position toward a tick-driven
// logical location - shared shape for the party's own token and each
// worker's token (see helpers/pixi/pixi-travel-glide.ts).
export type TravelGlideState = {
  visual: CurrentLocation;
  stepOrigin: CurrentLocation;
  stepDestination: CurrentLocation;
  stepStartTime: number;
  stepDurationMs: number;
  hasActiveStep: boolean;
};
