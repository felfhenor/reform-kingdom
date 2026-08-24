import { getEntry } from '@helpers/content';
import { defaultEquipment } from '@helpers/defaults';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import {
  characterStatsForLevel,
  characterXpForLevel,
} from '@helpers/hero/party';
import {
  equippedItems,
  planEquipmentOptimization,
} from '@helpers/item/equipment';
import { updateGamestate } from '@helpers/state-game';
import type {
  Character,
  CharacterId,
  EquipmentArmoryEntry,
  EquipmentBlock,
  EquipmentItem,
  JobContent,
  JobId,
} from '@interfaces';
import { EquipmentTypeToSlot } from '@interfaces';

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

// No displacement bookkeeping needed since every target slot starts empty (only caller is `characterReclass`).
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

// Reclassing unequips gear to the Armory (per M2-03) rather than discarding it, then auto-optimizes the new loadout.
export function characterReclass(characterId: CharacterId, jobId: JobId): void {
  let didReclass = false;

  updateGamestate((state) => {
    const character = state.world.party.find((c) => c.id === characterId);
    if (!character) return state;
    didReclass = true;

    state.armory = [...state.armory, ...equippedItems(character.equipment)];

    const { jobProgress, level, xp } = characterJobProgressSwap(
      character,
      jobId,
    );
    const job = getEntry<JobContent>(jobId);
    const winners = job
      ? planEquipmentOptimization(
          { ...character, jobId, level, equipment: defaultEquipment() },
          state.armory,
          job.statPriority,
        )
      : [];
    const { equipment, armory } = applyOptimizationWinners(
      state.armory,
      winners,
    );
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

    return state;
  });

  if (didReclass) analyticsSendDesignEvent('Hero:Reclass:Start');
}
