import { RECLASS_GOLD_PER_LEVEL } from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { defaultEquipment } from '@helpers/defaults';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { characterJobLevel } from '@helpers/hero/job';
import { characterSkillTreeSeeded } from '@helpers/hero/skill-tree-content';
import { characterStats, characterXpForLevel } from '@helpers/hero/party';
import { characterCurrentRegalia } from '@helpers/hero/regalia';
import {
  stateCharacterUnequipForRegalia,
  stateRegaliaLoad,
  stateRegaliaSettle,
} from '@helpers/hero/regalia-state';
import { planEquipmentOptimization } from '@helpers/item/equipment-optimize';
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
import { partyMaxLevel } from '@helpers/item/gathering';
import { taskEventLevelReached } from '@helpers/task/task-events';
import { partition } from 'es-toolkit/compat';

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

// No displacement bookkeeping needed since every target slot starts empty.
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

// Mutates `state` in place - shared across every pick in a reclass batch, so an earlier pick's gold spend is reflected before a later pick's affordability check.
function reclassCharacterStart(
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
  stateCharacterUnequipForRegalia(state, characterId);

  const { jobProgress, level, xp } = characterJobProgressSwap(character, jobId);
  Object.assign(character, { jobId, jobProgress, level, xp });
  const seeded = characterSkillTreeSeeded(character, jobId);
  character.skillTreeNodes[jobId] = seeded.skillTreeNodes[jobId];
  character.skillTreeVersions[jobId] = seeded.skillTreeVersions[jobId];
  return true;
}

function reclassCharacterOptimize(
  state: GameState,
  characterId: CharacterId,
): void {
  const character = state.world.party.find((c) => c.id === characterId);
  const job = character ? getEntry<JobContent>(character.jobId) : undefined;
  if (!character || !job) return;

  const winners = planEquipmentOptimization(
    character,
    state.armory,
    job.statPriority,
  );
  const { equipment, armory } = applyOptimizationWinners(state.armory, winners);
  state.armory = armory;
  character.equipment = equipment;
}

function reclassCharacterFinish(
  state: GameState,
  characterId: CharacterId,
): void {
  const character = state.world.party.find((c) => c.id === characterId);
  if (!character) return;

  const stats = characterStats(character);
  Object.assign(character, { stats, hp: stats.Health, ep: stats.Energy });
}

// Every hero is unequipped before any loads, and regalia heroes load before the rest optimize, so batch order can't steal gear.
function reclassCharactersInState(
  state: GameState,
  picks: CharacterReclassPick[],
): CharacterReclassPick[] {
  const started = picks.filter((pick) =>
    reclassCharacterStart(state, pick.characterId, pick.jobId),
  );
  const regaliaFor = (pick: CharacterReclassPick) => {
    const character = state.world.party.find((c) => c.id === pick.characterId);
    return character
      ? characterCurrentRegalia(state.regalias.entries, character)
      : undefined;
  };
  const [withRegalia, without] = partition(
    started,
    (pick) => !!regaliaFor(pick),
  );

  withRegalia.forEach((pick) => {
    const regalia = regaliaFor(pick);
    if (regalia) stateRegaliaLoad(state, pick.characterId, regalia);
  });
  without.forEach((pick) => reclassCharacterOptimize(state, pick.characterId));
  started.forEach((pick) => reclassCharacterFinish(state, pick.characterId));

  stateRegaliaSettle(state);
  return started;
}

// Reclassing unequips gear (to the Armory, or the regalia vault), then loads the new job's current regalia or auto-optimizes.
// Batched into one `updateGamestate` transaction so a multi-hero "Reclass All" prices and applies every swap atomically.
export async function charactersReclass(
  picks: CharacterReclassPick[],
): Promise<void> {
  const reclassedJobNames: string[] = [];

  await updateGamestate((state) => {
    reclassCharactersInState(state, picks).forEach((pick) => {
      const jobName = getEntry<JobContent>(pick.jobId)?.name;
      if (jobName) reclassedJobNames.push(jobName);
    });

    return state;
  });

  reclassedJobNames.forEach((jobName) => {
    analyticsSendDesignEvent(
      `Hero:Reclass:Start:${analyticsSafeSegment(jobName)}`,
    );
  });

  if (reclassedJobNames.length > 0) {
    analyticsSendDesignEvent('Hero:Reclass:Start', reclassedJobNames.length);
    void taskEventLevelReached(partyMaxLevel());
  }
}

export async function characterReclass(
  characterId: CharacterId,
  jobId: JobId,
): Promise<void> {
  await charactersReclass([{ characterId, jobId }]);
}
