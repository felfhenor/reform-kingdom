import { analyticsSendDesignEvent } from '@helpers/analytics';
import { getEntry } from '@helpers/content';
import { defaultEquipment } from '@helpers/defaults';
import { equippedItems, planEquipmentOptimization } from '@helpers/equipment';
import { characterStatsForLevel, characterXpForLevel } from '@helpers/party';
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

// Snapshots the character's current level/xp under their outgoing job, then
// pulls out any progress previously saved for the incoming job (if the
// character has held it before), falling back to level 1 otherwise.
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

// Equips each `planEquipmentOptimization` winner into a freshly-reset
// equipment block (every slot empty, as after a reclass) and removes it from
// the armory. No displacement bookkeeping is needed since every target slot
// starts empty - see `characterReclass`, the only caller.
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

// Reclassing fully unequips the hero; their old gear is routed to the
// Armory rather than discarded, per M2-03 in the roadmap. Level/xp for the
// outgoing job is saved and, if the incoming job was held before, restored.
// The freshly emptied loadout is then auto-optimized against the incoming
// job's `statPriority` (see `planEquipmentOptimization`), so a hero reclasses
// straight into the best gear their armory can already offer.
export function characterReclass(characterId: CharacterId, jobId: JobId): void {
  let didReclass = false;

  updateGamestate((state) => {
    const character = state.world.party.find((c) => c.id === characterId);
    if (!character) return state;
    didReclass = true;

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

    return state;
  });

  if (didReclass) analyticsSendDesignEvent('Hero:Reclass:Start');
}
