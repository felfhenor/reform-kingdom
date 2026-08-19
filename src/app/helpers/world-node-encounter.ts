import {
  encounterRandomIsAvailable,
  encounterRandomState,
  encounterRandomTimerLabel,
} from '@helpers/encounter-random';
import { monstersFromFights } from '@helpers/monster';
import { gamestate } from '@helpers/state-game';
import { worldNodeEncounter, worldNodeEncounterRandom } from '@helpers/world-nodes';
import type {
  EncounterRandomFight,
  MonsterContent,
  WorldNodeEncounterProgress,
  WorldNodeEntry,
} from '@interfaces';
import { clamp, sumBy } from 'es-toolkit/compat';

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

// `combat.fightIndex` is 0-based (the fight in progress) and doubles as the fights-cleared count.
export function worldNodeEncounterProgress(
  entry: WorldNodeEntry,
): WorldNodeEncounterProgress | undefined {
  const combat = gamestate().world.combat;
  if (!combat || combat.locationName !== entry.nodeName) return undefined;

  const total = worldNodeEncounterCount(entry);
  if (!total || total <= 0) return undefined;

  const fightIndex = combat.fightIndex ?? 0;
  return {
    current: fightIndex + 1,
    total,
    fraction: clamp(fightIndex / total, 0, 1),
  };
}

export function worldNodeMonsters(entry: WorldNodeEntry): MonsterContent[] {
  const encounter = worldNodeEncounter(entry);
  const fights = encounter ? encounter.fights : worldNodeExploreRandomFights(entry);

  return fights ? monstersFromFights(fights) : [];
}
