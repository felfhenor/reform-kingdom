import {
  encounterRandomIsAvailable,
  encounterRandomState,
  encounterRandomTimerLabel,
} from '@helpers/encounter/encounter-random';
import {
  worldNodeEncounter,
  worldNodeEncounterRandom,
} from '@helpers/world-node/world-nodes';
import type { EncounterRandomFight, WorldNodeEntry } from '@interfaces';

export function worldNodeExploreRandomIsAvailable(
  entry: WorldNodeEntry,
): boolean {
  const content = worldNodeEncounterRandom(entry);
  if (!content) return false;

  return encounterRandomIsAvailable(content, encounterRandomState(content.id));
}

export function worldNodeExploreRandomTimerText(
  entry: WorldNodeEntry,
): string | undefined {
  const content = worldNodeEncounterRandom(entry);
  if (!content) return undefined;

  return encounterRandomTimerLabel(content, encounterRandomState(content.id));
}

// For an `ExploreRandomNode`, the encounter's `fights` are always empty as
// authored - the real, currently-locked-in fight list lives in generated
// game state instead (see `encounterRandomState`).
export function worldNodeExploreRandomFights(
  entry: WorldNodeEntry,
): EncounterRandomFight[] | undefined {
  const content = worldNodeEncounterRandom(entry);
  if (!content) return undefined;

  return encounterRandomState(content.id)?.fights;
}

export function worldNodeEncounterCount(
  entry: WorldNodeEntry,
): number | undefined {
  const encounter = worldNodeEncounter(entry);
  if (encounter) return encounter.fights.length;

  return worldNodeExploreRandomFights(entry)?.length;
}
