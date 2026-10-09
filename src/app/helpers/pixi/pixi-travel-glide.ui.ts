import {
  GAMELOOP_INTERVAL_MS,
  TRAVEL_GLIDE_CORRECTION_MS,
  TRAVEL_GLIDE_MAX_CORRECTION_TILES,
} from '@helpers/config';
import { travelStepTicksCost } from '@helpers/hero/travel-cost';
import type {
  CurrentLocation,
  TravelGlideState,
  TravelStep,
} from '@interfaces';
import { clamp } from 'es-toolkit/compat';

// Walks steps exactly like the tick layer, so an extrapolated position is where the next tick's state will put the token.
export function travelPathPositionAt(
  location: CurrentLocation,
  path: TravelStep[],
  progressTicks: number,
): CurrentLocation {
  let origin: CurrentLocation = { ...location };
  let remaining = progressTicks;

  for (const step of path) {
    if (step.kind === 'Teleport' || step.mapName !== origin.mapName) break;

    const cost = travelStepTicksCost(step, origin);
    if (remaining < cost) {
      const fraction = remaining / cost;
      return {
        mapName: origin.mapName,
        x: origin.x + (step.x - origin.x) * fraction,
        y: origin.y + (step.y - origin.y) * fraction,
      };
    }

    remaining -= cost;
    origin = { mapName: step.mapName, x: step.x, y: step.y };
  }

  return origin;
}

function travelGlideSyncKey(
  location: CurrentLocation,
  path: TravelStep[],
  ticksIntoStep: number,
): string {
  const next = path[0];
  const nextKey = next ? `${next.mapName}:${next.x}:${next.y}` : '';
  return `${location.mapName}:${location.x}:${location.y}|${path.length}|${nextKey}|${ticksIntoStep}`;
}

// Remembers how far the rendered token is from the new tick state's position, so the gap eases out instead of snapping.
function travelGlideResync(
  glide: TravelGlideState,
  syncKey: string,
  start: CurrentLocation,
  now: number,
): TravelGlideState {
  // The tick landed somewhere since the last frame; starting from now would stall the token for a frame every tick.
  const syncTime = glide.lastFrameTime > 0 ? glide.lastFrameTime : now;
  const x = glide.visual.x - start.x;
  const y = glide.visual.y - start.y;
  const keepsCorrection =
    glide.visual.mapName === start.mapName &&
    Math.hypot(x, y) <= TRAVEL_GLIDE_MAX_CORRECTION_TILES;

  return {
    visual: glide.visual,
    syncKey,
    syncTime,
    lastFrameTime: glide.lastFrameTime,
    correction: keepsCorrection ? { x, y } : { x: 0, y: 0 },
  };
}

// Advances a token's visual position by extrapolating the tick state forward in real time.
// Shared by the party's own token and each worker's token. Pure - callers persist the state.
export function travelGlideAdvance(
  glide: TravelGlideState,
  location: CurrentLocation,
  path: TravelStep[],
  ticksIntoStep: number,
  now: number,
  ticksPerLoop: number,
): TravelGlideState {
  const syncKey = travelGlideSyncKey(location, path, ticksIntoStep);
  const synced =
    syncKey === glide.syncKey
      ? glide
      : travelGlideResync(
          glide,
          syncKey,
          travelPathPositionAt(location, path, ticksIntoStep),
          now,
        );

  const elapsedMs = Math.max(0, now - synced.syncTime);
  const loopFraction = clamp(elapsedMs / GAMELOOP_INTERVAL_MS, 0, 1);
  const base = travelPathPositionAt(
    location,
    path,
    ticksIntoStep + loopFraction * ticksPerLoop,
  );
  const decay = clamp(1 - elapsedMs / TRAVEL_GLIDE_CORRECTION_MS, 0, 1);

  return {
    ...synced,
    lastFrameTime: now,
    visual: {
      mapName: base.mapName,
      x: base.x + synced.correction.x * decay,
      y: base.y + synced.correction.y * decay,
    },
  };
}

export function defaultTravelGlideState(
  location: CurrentLocation,
): TravelGlideState {
  return {
    visual: { ...location },
    syncKey: '',
    syncTime: 0,
    lastFrameTime: 0,
    correction: { x: 0, y: 0 },
  };
}
