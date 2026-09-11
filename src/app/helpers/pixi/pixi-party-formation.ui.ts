import type { CurrentLocation, PartyPositionSample } from '@interfaces';
import { clamp } from 'es-toolkit/compat';

// Prunes samples older than maxAgeMs so the buffer doesn't grow unbounded.
export function partyPositionHistoryRecord(
  history: PartyPositionSample[],
  position: CurrentLocation,
  now: number,
  maxAgeMs: number,
): PartyPositionSample[] {
  const next = [...history, { time: now, position }];
  const cutoff = now - maxAgeMs;
  const keepFrom = next.findIndex((sample) => sample.time >= cutoff);
  return keepFrom <= 0 ? next : next.slice(keepFrom);
}

// Interpolates the leader's recorded position as of `now - delayMs`; snaps instead across a map change mid-buffer, since x/y aren't comparable across maps.
export function partyPositionHistorySample(
  history: PartyPositionSample[],
  now: number,
  delayMs: number,
): CurrentLocation | undefined {
  if (history.length === 0) return undefined;

  const targetTime = now - delayMs;
  const first = history[0];
  const last = history[history.length - 1];
  if (targetTime <= first.time) return first.position;
  if (targetTime >= last.time) return last.position;

  const nextIndex = history.findIndex((sample) => sample.time >= targetTime);
  const prev = history[nextIndex - 1] ?? history[nextIndex];
  const next = history[nextIndex];
  if (prev.position.mapName !== next.position.mapName) return next.position;

  const span = next.time - prev.time;
  const fraction = span > 0 ? (targetTime - prev.time) / span : 1;

  return {
    mapName: next.position.mapName,
    x: prev.position.x + (next.position.x - prev.position.x) * fraction,
    y: prev.position.y + (next.position.y - prev.position.y) * fraction,
  };
}

// Pre-settles the tween (zero visible duration) when there's no actual gap to close, so an already-parked party doesn't flash back to walking sprites on boot/map-load.
export function partyFollowerCatchUpStart(
  from: CurrentLocation,
  to: CurrentLocation,
  now: number,
  durationMs: number,
): { from: CurrentLocation; startTime: number } {
  const alreadyThere =
    from.mapName === to.mapName &&
    Math.abs(from.x - to.x) < 0.001 &&
    Math.abs(from.y - to.y) < 0.001;

  return { from, startTime: alreadyThere ? now - durationMs : now };
}

export function partyFollowerCatchUpPosition(
  from: CurrentLocation,
  to: CurrentLocation,
  startTime: number,
  durationMs: number,
  now: number,
): CurrentLocation {
  if (from.mapName !== to.mapName || durationMs <= 0) return to;

  const fraction = clamp((now - startTime) / durationMs, 0, 1);
  return {
    mapName: to.mapName,
    x: from.x + (to.x - from.x) * fraction,
    y: from.y + (to.y - from.y) * fraction,
  };
}

// Nudges a follower's target off the leader's exact line, so a trailing party doesn't render as a perfectly straight/stacked column.
export function partyFollowerJitterPosition(
  position: CurrentLocation,
  offset: { x: number; y: number },
): CurrentLocation {
  return {
    mapName: position.mapName,
    x: position.x + offset.x,
    y: position.y + offset.y,
  };
}

// Spreads followers evenly by angle around the leader, each at a randomized nonzero radius - the angle
// jitter is capped below half the step between slots, so two followers (or a follower and the leader,
// at radius 0) can never land on the same spot.
export function partyFollowerFormationOffset(
  index: number,
  followerCount: number,
  minRadiusTiles: number,
  maxRadiusTiles: number,
): { x: number; y: number } {
  const angleStep = (Math.PI * 2) / Math.max(followerCount, 1);
  const angle = index * angleStep + (Math.random() - 0.5) * angleStep * 0.6;
  const radius =
    minRadiusTiles + Math.random() * (maxRadiusTiles - minRadiusTiles);

  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}
