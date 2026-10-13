import { formatDuration, timerTicksElapsed } from '@helpers/engine/timer';
import { worldExploreRandomState } from '@helpers/state-game';
import type {
  EncounterRandomContent,
  EncounterRandomId,
  EncounterRandomNodeState,
} from '@interfaces';
import { clamp } from 'es-toolkit/compat';

export function encounterRandomState(
  id: EncounterRandomId,
): EncounterRandomNodeState | undefined {
  return worldExploreRandomState()[id];
}

// The current cycle's length - stored at generation, so a party change mid-cycle doesn't move it.
export function encounterRandomResetTime(
  content: EncounterRandomContent,
  state: EncounterRandomNodeState | undefined,
): number {
  return state?.resetTime ?? content.resetTime;
}

export function encounterRandomTicksUntilReset(
  content: EncounterRandomContent,
  state: EncounterRandomNodeState | undefined,
): number {
  const resetTime = encounterRandomResetTime(content, state);
  if (!state) return resetTime;

  const ticksSinceGenerated = timerTicksElapsed() - state.generatedAtTick;
  return clamp(resetTime - ticksSinceGenerated, 0, resetTime);
}

// A node is only enterable once it has a generated fight list and hasn't
// already been fully cleared this cycle - clearing it locks it out (no
// monsters left) until the next regeneration.
export function encounterRandomIsAvailable(
  content: EncounterRandomContent,
  state: EncounterRandomNodeState | undefined,
): boolean {
  return !!state && state.fights.length > 0 && !state.completedThisCycle;
}

export function encounterRandomTimerLabel(
  content: EncounterRandomContent,
  state: EncounterRandomNodeState | undefined,
): string {
  return formatDuration(encounterRandomTicksUntilReset(content, state));
}
