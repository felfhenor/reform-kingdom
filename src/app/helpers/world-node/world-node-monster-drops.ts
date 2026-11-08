import { getEntry } from '@helpers/content/content';
import { worldNodeLevelRange } from '@helpers/world-node/world-node-status';
import {
  worldNodeEncounter,
  worldNodeEncounterRandom,
} from '@helpers/world-node/world-nodes';
import type {
  DroppedReward,
  MonsterContent,
  MonsterId,
  WorldNodeEntry,
} from '@interfaces';

export function worldNodeMonsterIds(entry: WorldNodeEntry): MonsterId[] {
  const encounter = worldNodeEncounter(entry);
  if (encounter) {
    return encounter.fights.flatMap((fight) =>
      fight.monsters.map((monster) => monster.monsterId),
    );
  }

  const encounterRandom = worldNodeEncounterRandom(entry);
  return encounterRandom?.creaturePool.map((pool) => pool.monsterId) ?? [];
}

// One row per monster drop that can roll at this node's level - not de-duplicated, so per-monster odds survive.
export function worldNodeMonsterDropTable(
  entry: WorldNodeEntry,
): DroppedReward[] {
  const levelRange = worldNodeLevelRange(entry);
  if (!levelRange) return [];

  return [...new Set(worldNodeMonsterIds(entry))].flatMap((monsterId) =>
    (getEntry<MonsterContent>(monsterId)?.drops ?? []).filter(
      (reward) =>
        levelRange.max >= reward.minLevel && levelRange.min <= reward.maxLevel,
    ),
  );
}
