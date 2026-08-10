import { gamestate } from '@helpers/state-game';
import { formatDuration, timerTicksElapsed } from '@helpers/timer';
import type {
  EncounterRandomContent,
  EncounterRandomId,
  EncounterRandomNodeState,
} from '@interfaces';
import { clamp } from 'es-toolkit/compat';

export function encounterRandomState(
  id: EncounterRandomId,
): EncounterRandomNodeState | undefined {
  return gamestate().world.exploreRandom[id];
}

export function encounterRandomTicksUntilReset(
  content: EncounterRandomContent,
  state: EncounterRandomNodeState | undefined,
): number {
  if (!state) return content.resetTime;

  const ticksSinceGenerated = timerTicksElapsed() - state.generatedAtTick;
  return clamp(content.resetTime - ticksSinceGenerated, 0, content.resetTime);
}

// A node is only enterable once it has a generated fight list and hasn't
// already been fully cleared this cycle - clearing it locks it out (no
// monsters left) until the next regeneration, see `encounter-random-tick.ts`.
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
