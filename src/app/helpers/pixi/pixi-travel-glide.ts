import { travelStepTicksCost } from '@helpers/hero/travel';
import type { CurrentLocation, TravelGlideState, TravelStep } from '@interfaces';
import { clamp } from 'es-toolkit/compat';

// Advances a token's eased visual position by one tick, toward the in-flight step.
// Shared by the party's own token and each worker's token. Pure - callers persist the state.
export function travelGlideAdvance(
  glide: TravelGlideState,
  targetLocation: CurrentLocation,
  inFlightStep: TravelStep | undefined,
  now: number,
  speedMultiplier: number,
): TravelGlideState {
  // A map change or teleport/idle state has nothing to glide toward - snap.
  if (
    targetLocation.mapName !== glide.visual.mapName ||
    !inFlightStep ||
    inFlightStep.kind === 'Teleport'
  ) {
    return { ...glide, visual: { ...targetLocation }, hasActiveStep: false };
  }

  const destinationChanged =
    !glide.hasActiveStep ||
    glide.stepDestination.mapName !== inFlightStep.mapName ||
    glide.stepDestination.x !== inFlightStep.x ||
    glide.stepDestination.y !== inFlightStep.y;

  // Origin is wherever the token is currently rendered, not the tick-driven
  // target, to avoid a visible snap on step handoff.
  const next: TravelGlideState = destinationChanged
    ? {
        visual: glide.visual,
        stepOrigin: { ...glide.visual },
        stepDestination: {
          mapName: inFlightStep.mapName,
          x: inFlightStep.x,
          y: inFlightStep.y,
        },
        stepStartTime: now,
        stepDurationMs:
          (travelStepTicksCost(inFlightStep, targetLocation) * 1000) /
          Math.max(speedMultiplier, 0.001),
        hasActiveStep: true,
      }
    : glide;

  const fraction =
    next.stepDurationMs > 0
      ? clamp((now - next.stepStartTime) / next.stepDurationMs, 0, 1)
      : 1;

  return {
    ...next,
    visual: {
      mapName: targetLocation.mapName,
      x:
        next.stepOrigin.x +
        (next.stepDestination.x - next.stepOrigin.x) * fraction,
      y:
        next.stepOrigin.y +
        (next.stepDestination.y - next.stepOrigin.y) * fraction,
    },
  };
}

export function defaultTravelGlideState(
  location: CurrentLocation,
): TravelGlideState {
  return {
    visual: { ...location },
    stepOrigin: { ...location },
    stepDestination: { ...location },
    stepStartTime: 0,
    stepDurationMs: 0,
    hasActiveStep: false,
  };
}
