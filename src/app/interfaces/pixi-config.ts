import type { CurrentLocation } from '@interfaces/state-game';
import type { TravelStep } from '@interfaces/travel';

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

// Omitting the target recenters on the party.
export type WorldCameraRequest = {
  target?: CameraPosition;
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
// worker's token.
export type TravelGlideCursor = {
  origin: CurrentLocation;
  path: TravelStep[];
  progressTicks: number;
};

export type TravelGlideState = {
  visual: CurrentLocation;
  cursor: TravelGlideCursor;
  lastFrameTime: number;
  correction: { x: number; y: number };
  correctionStartTime: number;
};

// Buffered so trailing party members can render a delayed copy of the leader's path instead of tracking their own travel state.
export type PartyPositionSample = {
  time: number;
  position: CurrentLocation;
};

// Low-poly shard floating behind maps that leave tile gaps; field positions are fractions of the wrap field.
export type BackdropShard = {
  fieldX: number;
  fieldY: number;
  depth: number;
  sizePx: number;
  vertices: number[];
  color: number;
  alpha: number;
  hasHighlightEdge: boolean;
  // 0 for shards that never glint.
  glintReachPx: number;
  periodMs: number;
  phaseMs: number;
  tumbleAxis: number;
  tumblePhase: number;
  tumbleSpeedPerMs: number;
  shimmerPhase: number;
  floatPhaseX: number;
  floatPhaseY: number;
  floatSpeedX: number;
  floatSpeedY: number;
  floatAmplitudeX: number;
  floatAmplitudeY: number;
  wobbleAmplitude: number;
  // Set on "memory" shards: picks which landmark tile is etched into the shard, as a fraction of the available tiles.
  memoryPick?: number;
};

export type BackdropShardState = {
  offsetX: number;
  offsetY: number;
  rotation: number;
  // cos of the turn angle about the shard's tumble axis; negative while its back face is showing.
  facing: number;
  light: number;
  alpha: number;
  scale: number;
  shimmer: number;
  glint: number;
  glintScale: number;
};

export type BackdropUpdate = (
  nowMs: number,
  cameraPx: CameraPosition,
  viewWidth: number,
  viewHeight: number,
) => void;

export type BackdropStar = {
  fieldX: number;
  fieldY: number;
  radiusPx: number;
  phase: number;
};
