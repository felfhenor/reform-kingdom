import { analyticsSendDesignEvent } from '@helpers/analytics';
import { miscellaneousMessageLog } from '@helpers/combat-log';
import { getEntry } from '@helpers/content';
import { heroSkillsAtLevel } from '@helpers/job';
import {
  CHARACTER_MAX_LEVEL,
  characterStatsForLevel,
  characterXpForLevel,
} from '@helpers/party';
import { updateGamestate } from '@helpers/state-game';
import type {
  Character,
  Combatant,
  EquipmentSkillContent,
  JobContent,
} from '@interfaces';
import { clamp } from 'es-toolkit/compat';

export function syncPartyHpFromCombat(heroes: Combatant[]): void {
  updateGamestate((state) => {
    state.world.party = state.world.party.map((character) => {
      const combatant = heroes.find((hero) => hero.id === character.id);
      if (!combatant) return character;

      return {
        ...character,
        hp: clamp(combatant.hp, 0, character.stats.Health),
        ep: clamp(combatant.ep, 0, character.stats.Energy),
      };
    });

    return state;
  });
}

export function healPartyToFull(): void {
  updateGamestate((state) => {
    state.world.party = state.world.party.map((character) => ({
      ...character,
      hp: character.stats.Health,
      ep: character.stats.Energy,
    }));

    return state;
  });
}

const HEALING_MINIMUM_SECONDS = 10;
const HEALING_SECONDS_PER_LEVEL = 2;

// Flat minimum plus per-level scaling; see M1-09 in the roadmap for the eventual per-hero healing-timer design.
export function healingTicksForLevel(members: { level: number }[]): number {
  const highestLevel = Math.max(...members.map((member) => member.level), 1);
  return HEALING_MINIMUM_SECONDS + highestLevel * HEALING_SECONDS_PER_LEVEL;
}

function characterLeveledUp(character: Character, amount: number): Character {
  let level = character.level;
  let current = character.xp.current + amount;
  let maximum = character.xp.maximum;

  while (level < CHARACTER_MAX_LEVEL && current >= maximum) {
    current -= maximum;
    level += 1;
    maximum = characterXpForLevel(level);
  }

  if (level >= CHARACTER_MAX_LEVEL) {
    current = Math.min(current, maximum);
  }

  if (level === character.level) {
    return { ...character, xp: { current, maximum } };
  }

  return {
    ...character,
    level,
    xp: { current, maximum },
    stats: characterStatsForLevel(character.jobId, level, character.equipment),
  };
}

// Skills are derived from job + level, not tracked as "known" state, so diffing before/after ids also announces rank upgrades (e.g. Double Strike I -> II).
function logCharacterProgress(before: Character, after: Character): void {
  if (after.level === before.level) return;

  miscellaneousMessageLog(`**${after.name}** reached level ${after.level}!`);

  const job = getEntry<JobContent>(after.jobId);
  if (!job) return;

  const previousSkillIds = new Set(heroSkillsAtLevel(job, before.level));
  const newSkillIds = heroSkillsAtLevel(job, after.level).filter(
    (skillId) => !previousSkillIds.has(skillId),
  );

  newSkillIds.forEach((skillId) => {
    const skill = getEntry<EquipmentSkillContent>(skillId);
    if (!skill) return;

    miscellaneousMessageLog(`**${after.name}** learned **${skill.name}**!`);
  });
}

function xpProgressForLevel(level: number, currentXp: number): Character['xp'] {
  const maximum = characterXpForLevel(level);
  return { current: Math.min(currentXp, maximum), maximum };
}

// Rescales xp.maximum to the current `characterXpForLevel` curve, clamping `current` down if needed. Never forces a level-up itself.
export function retrofitPartyXp(party: Character[]): Character[] {
  return party.map((character) => {
    const jobProgress = Object.fromEntries(
      Object.entries(character.jobProgress ?? {}).map(([jobId, progress]) => [
        jobId,
        progress
          ? {
              ...progress,
              xp: xpProgressForLevel(progress.level, progress.xp.current),
            }
          : progress,
      ]),
    ) as Character['jobProgress'];

    return {
      ...character,
      xp: xpProgressForLevel(character.level, character.xp.current),
      jobProgress,
    };
  });
}

// Callers (e.g. `combat-end.ts`) use the return value to know when to retry nodes previously given up on (see `autoModeResetNodeFailureCounts`).
export function partyGainXp(amount: number): boolean {
  let anyLeveledUp = false;

  updateGamestate((state) => {
    state.world.party = state.world.party.map((character) => {
      const updated = characterLeveledUp(character, amount);
      if (updated.level > character.level) {
        anyLeveledUp = true;
        analyticsSendDesignEvent('Hero:LevelUp', updated.level);
      }
      logCharacterProgress(character, updated);
      return updated;
    });

    return state;
  });

  return anyLeveledUp;
}
