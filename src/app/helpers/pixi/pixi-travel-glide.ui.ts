import {
  GAMELOOP_INTERVAL_MS,
  TRAVEL_GLIDE_CORRECTION_MS,
  TRAVEL_GLIDE_MAX_CORRECTION_TILES,
} from '@helpers/config';
import { travelStepTicksCost } from '@helpers/hero/travel-cost';
import { travelPathSumTicks } from '@helpers/hero/travel-cost-base';
import type {
  CurrentLocation,
  TravelGlideCursor,
  TravelGlideState,
  TravelStep,
} from '@interfaces';
import { clamp } from 'es-toolkit/compat';

function isSameTile(a: CurrentLocation, b: CurrentLocation): boolean {
  return a.mapName === b.mapName && a.x === b.x && a.y === b.y;
}

// Steps through the path with the tick layer's own costs; stops at a map change, which renders with a fade instead.
function travelGlidePositionAt(cursor: TravelGlideCursor): CurrentLocation {
  let origin = cursor.origin;
  let remaining = cursor.progressTicks;

  for (const step of cursor.path) {
    if (step.mapName !== origin.mapName) break;

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

  return { ...origin };
}

// Undefined when the tick state is on a different route (new trip, redirect) rather than further along this one.
function travelGlideStepsCompleted(
  cursor: TravelGlideCursor,
  location: CurrentLocation,
  path: TravelStep[],
): number | undefined {
  const completed = cursor.path.length - path.length;
  if (completed < 0) return undefined;
  if (
    path.length > 0 &&
    (!isSameTile(path[0], cursor.path[completed]) ||
      !isSameTile(path[path.length - 1], cursor.path[cursor.path.length - 1]))
  ) {
    return undefined;
  }

  const reached = completed === 0 ? cursor.origin : cursor.path[completed - 1];
  return isSameTile(reached, location) ? completed : undefined;
}

// Restarts on the new route from its starting tile (trailing any progress already made), easing out the gap from wherever the token was drawn.
function travelGlideReset(
  glide: TravelGlideState,
  location: CurrentLocation,
  path: TravelStep[],
  now: number,
): TravelGlideState {
  const cursor = { origin: { ...location }, path, progressTicks: 0 };
  const x = glide.visual.x - location.x;
  const y = glide.visual.y - location.y;
  const keepsCorrection =
    glide.visual.mapName === location.mapName &&
    Math.hypot(x, y) <= TRAVEL_GLIDE_MAX_CORRECTION_TILES;

  return {
    ...glide,
    cursor,
    correction: keepsCorrection ? { x, y } : { x: 0, y: 0 },
    correctionStartTime: now,
  };
}

// Normal pace absorbs the tick's phase offset; only hurry when over a loop behind, and never run over a loop ahead.
function travelGlideProgressAdvance(
  progressTicks: number,
  targetTicks: number,
  ticksPerLoop: number,
  elapsedMs: number,
): number {
  const catchUp = Math.max(0, targetTicks - progressTicks - ticksPerLoop);
  const advanced =
    progressTicks +
    ((ticksPerLoop + catchUp) * elapsedMs) / GAMELOOP_INTERVAL_MS;

  return Math.max(
    progressTicks,
    Math.min(advanced, targetTicks + ticksPerLoop),
  );
}

// Only drops steps the tick state has also completed, so the state never ends up behind the cursor's origin.
function travelGlideCursorConsume(
  cursor: TravelGlideCursor,
  maxSteps: number,
): TravelGlideCursor {
  let { origin, path, progressTicks } = cursor;

  for (let i = 0; i < maxSteps && path.length > 0; i++) {
    const step = path[0];
    const cost = travelStepTicksCost(step, origin);
    if (step.mapName !== origin.mapName || progressTicks < cost) break;

    progressTicks -= cost;
    origin = { mapName: step.mapName, x: step.x, y: step.y };
    path = path.slice(1);
  }

  return { origin, path, progressTicks };
}

function travelGlideVisual(
  glide: TravelGlideState,
  now: number,
): CurrentLocation {
  const base = travelGlidePositionAt(glide.cursor);
  const decay = clamp(
    1 - (now - glide.correctionStartTime) / TRAVEL_GLIDE_CORRECTION_MS,
    0,
    1,
  );

  return {
    mapName: base.mapName,
    x: base.x + glide.correction.x * decay,
    y: base.y + glide.correction.y * decay,
  };
}

// Walks a token along its own copy of the route at a steady pace trailing the tick state, so uneven per-tick step counts don't show.
// Shared by the party's own token and each worker's token. Pure - callers persist the state.
export function travelGlideAdvance(
  glide: TravelGlideState,
  location: CurrentLocation,
  path: TravelStep[],
  ticksIntoStep: number,
  now: number,
  ticksPerLoop: number,
): TravelGlideState {
  const completed = travelGlideStepsCompleted(glide.cursor, location, path);
  const tracked =
    completed === undefined
      ? travelGlideReset(glide, location, path, now)
      : glide;
  const stepsCompleted = completed ?? 0;

  const targetTicks =
    travelPathSumTicks(
      tracked.cursor.path.slice(0, stepsCompleted),
      tracked.cursor.origin,
      travelStepTicksCost,
    ) + ticksIntoStep;
  const elapsedMs =
    tracked.lastFrameTime > 0
      ? clamp(now - tracked.lastFrameTime, 0, GAMELOOP_INTERVAL_MS)
      : 0;
  const progressTicks = travelGlideProgressAdvance(
    tracked.cursor.progressTicks,
    targetTicks,
    ticksPerLoop,
    elapsedMs,
  );

  const next: TravelGlideState = {
    ...tracked,
    cursor: travelGlideCursorConsume(
      { ...tracked.cursor, progressTicks },
      stepsCompleted,
    ),
    lastFrameTime: now,
  };
  return { ...next, visual: travelGlideVisual(next, now) };
}

export function defaultTravelGlideState(
  location: CurrentLocation,
): TravelGlideState {
  return {
    visual: { ...location },
    cursor: { origin: { ...location }, path: [], progressTicks: 0 },
    lastFrameTime: 0,
    correction: { x: 0, y: 0 },
    correctionStartTime: 0,
  };
}
