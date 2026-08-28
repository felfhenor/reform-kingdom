import { getEntry } from '@helpers/content';
import { defaultEquipment } from '@helpers/defaults';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import {
  characterStatsForLevel,
  characterXpForLevel,
} from '@helpers/hero/party';
import {
  equippedItems,
  planEquipmentOptimization,
} from '@helpers/item/equipment';
import { applyMaterialDelta, goldCoinId } from '@helpers/item/materials';
import { updateGamestate } from '@helpers/state-game';
import type {
  Character,
  CharacterId,
  CharacterReclassPick,
  EquipmentArmoryEntry,
  EquipmentBlock,
  EquipmentItem,
  GameState,
  JobContent,
  JobId,
} from '@interfaces';
import { EquipmentTypeToSlot } from '@interfaces';

// Level the hero would resume a job at: their current level if it's the active job, else their saved progress, else 1 for a job never held.
export function characterJobLevel(character: Character, jobId: JobId): number {
  if (character.jobId === jobId) return character.level;
  return character.jobProgress[jobId]?.level ?? 1;
}

const RECLASS_GOLD_PER_LEVEL = 100;

// Priced by the level the hero lands on, not the one they're leaving - reclassing back into a high-level job costs more than reclassing out of one.
export function characterReclassCost(
  character: Character,
  jobId: JobId,
): number {
  return characterJobLevel(character, jobId) * RECLASS_GOLD_PER_LEVEL;
}

// Saves outgoing job's level/xp, restores incoming job's saved progress if held before, else level 1.
function characterJobProgressSwap(
  character: Character,
  jobId: JobId,
): {
  jobProgress: Character['jobProgress'];
  level: number;
  xp: Character['xp'];
} {
  const jobProgress: Character['jobProgress'] = {
    ...character.jobProgress,
    [character.jobId]: { level: character.level, xp: character.xp },
  };

  const savedProgress = jobProgress[jobId];
  delete jobProgress[jobId];

  const level = savedProgress?.level ?? 1;
  const xp = savedProgress?.xp ?? {
    current: 0,
    maximum: characterXpForLevel(level),
  };

  return { jobProgress, level, xp };
}

// No displacement bookkeeping needed since every target slot starts empty (only caller is `reclassCharacterInState`).
function applyOptimizationWinners(
  armory: EquipmentItem[],
  winners: EquipmentArmoryEntry[],
): { equipment: EquipmentBlock; armory: EquipmentItem[] } {
  const equipment = defaultEquipment();
  const winnerIds = new Set(winners.map((winner) => winner.item.id));

  winners.forEach((winner) => {
    EquipmentTypeToSlot[winner.content.type].forEach((slot) => {
      equipment[slot] = winner.item;
    });
  });

  return {
    equipment,
    armory: armory.filter((item) => !winnerIds.has(item.id)),
  };
}

// Mutates `state` in place - shared across every pick in a `charactersReclass` batch, so an earlier pick's gold spend is reflected before a later pick's affordability check.
function reclassCharacterInState(
  state: GameState,
  characterId: CharacterId,
  jobId: JobId,
): boolean {
  const character = state.world.party.find((c) => c.id === characterId);
  if (!character) return false;

  const cost = characterReclassCost(character, jobId);
  const goldId = goldCoinId();
  if ((state.materials[goldId]?.quantity ?? 0) < cost) return false;

  applyMaterialDelta(state, goldId, -cost);

  state.armory = [...state.armory, ...equippedItems(character.equipment)];

  const { jobProgress, level, xp } = characterJobProgressSwap(character, jobId);
  const job = getEntry<JobContent>(jobId);
  const winners = job
    ? planEquipmentOptimization(
        { ...character, jobId, level, equipment: defaultEquipment() },
        state.armory,
        job.statPriority,
      )
    : [];
  const { equipment, armory } = applyOptimizationWinners(state.armory, winners);
  state.armory = armory;

  const stats = characterStatsForLevel(jobId, level, equipment);

  state.world.party = state.world.party.map((c) =>
    c.id === characterId
      ? {
          ...c,
          jobId,
          jobProgress,
          equipment,
          stats,
          hp: stats.Health,
          ep: stats.Energy,
          level,
          xp,
        }
      : c,
  );

  return true;
}

// Reclassing unequips gear to the Armory rather than discarding it, then auto-optimizes the new loadout.
// Batched into one `updateGamestate` transaction so a multi-hero "Reclass All" prices and applies every swap atomically.
export function charactersReclass(picks: CharacterReclassPick[]): void {
  let reclassedCount = 0;

  updateGamestate((state) => {
    picks.forEach((pick) => {
      if (reclassCharacterInState(state, pick.characterId, pick.jobId)) {
        reclassedCount += 1;

        const jobName = getEntry<JobContent>(pick.jobId)?.name;
        if (jobName) {
          analyticsSendDesignEvent(
            `Hero:Reclass:Start:${analyticsSafeSegment(jobName)}`,
          );
        }
      }
    });

    return state;
  });

  if (reclassedCount > 0) {
    analyticsSendDesignEvent('Hero:Reclass:Start', reclassedCount);
  }
}

export function characterReclass(characterId: CharacterId, jobId: JobId): void {
  charactersReclass([{ characterId, jobId }]);
}
