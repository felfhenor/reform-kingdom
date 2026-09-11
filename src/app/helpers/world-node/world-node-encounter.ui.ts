import { monstersFromFights } from '@helpers/combat/monster';
import { encounterRandomState } from '@helpers/encounter/encounter-random';
import { gamestate } from '@helpers/state-game';
import {
  worldNodeEncounterCount,
  worldNodeExploreRandomFights,
} from '@helpers/world-node/world-node-encounter';
import {
  worldNodeEncounter,
  worldNodeEncounterRandom,
} from '@helpers/world-node/world-nodes';
import type {
  MonsterContent,
  WorldNodeEncounterProgress,
  WorldNodeEntry,
} from '@interfaces';
import { clamp, sumBy } from 'es-toolkit/compat';

export function worldNodeMonsterCount(
  entry: WorldNodeEntry,
): number | undefined {
  const encounter = worldNodeEncounter(entry);
  if (encounter)
    return sumBy(encounter.fights, (fight) => fight.monsters.length);

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

// Whether an ExploreRandomNode has been cleared for its current cycle - drives the map's beaten/not-beaten badge.
export function worldNodeExploreRandomIsCompleted(
  entry: WorldNodeEntry,
): boolean {
  const content = worldNodeEncounterRandom(entry);
  if (!content) return false;

  return !!encounterRandomState(content.id)?.completedThisCycle;
}

export function worldNodeMonsters(entry: WorldNodeEntry): MonsterContent[] {
  const encounter = worldNodeEncounter(entry);
  const fights = encounter
    ? encounter.fights
    : worldNodeExploreRandomFights(entry);

  return fights ? monstersFromFights(fights) : [];
}
