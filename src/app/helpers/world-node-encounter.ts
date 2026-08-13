import {
  encounterRandomIsAvailable,
  encounterRandomState,
  encounterRandomTimerLabel,
} from '@helpers/encounter-random';
import { monstersFromFights } from '@helpers/monster';
import { worldNodeEncounter, worldNodeEncounterRandom } from '@helpers/world-nodes';
import type {
  EncounterRandomFight,
  MonsterContent,
  WorldNodeEntry,
} from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

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
function worldNodeExploreRandomFights(
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

export function worldNodeMonsterCount(
  entry: WorldNodeEntry,
): number | undefined {
  const encounter = worldNodeEncounter(entry);
  if (encounter) return sumBy(encounter.fights, (fight) => fight.monsters.length);

  const fights = worldNodeExploreRandomFights(entry);
  return fights ? sumBy(fights, (fight) => fight.monsters.length) : undefined;
}

export function worldNodeMonsters(entry: WorldNodeEntry): MonsterContent[] {
  const encounter = worldNodeEncounter(entry);
  const fights = encounter ? encounter.fights : worldNodeExploreRandomFights(entry);

  return fights ? monstersFromFights(fights) : [];
}
