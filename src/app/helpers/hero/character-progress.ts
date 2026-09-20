import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import {
  CHARACTER_MAX_LEVEL,
  HEALING_MINIMUM_SECONDS,
  HEALING_SECONDS_PER_LEVEL,
} from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { globalEffectSums } from '@helpers/hero/global-effects';
import { heroSkillsAtLevel } from '@helpers/hero/job';
import {
  characterStatsForLevel,
  characterXpForLevel,
} from '@helpers/hero/party';
import { updateGamestate } from '@helpers/state-game';
import type {
  Character,
  Combatant,
  EquipmentSkillContent,
  JobContent,
} from '@interfaces';
import { clamp } from 'es-toolkit/compat';

// Bonus from the precomputed global effect sums cache - 1x with nothing active/owned.
function xpGainMultiplier(): number {
  return 1 + globalEffectSums().xpGainMultiplierBonus;
}

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
function logCharacterProgress(beforeLevel: number, after: Character): void {
  if (after.level === beforeLevel) return;

  miscellaneousMessageLog(`**${after.name}** reached level ${after.level}!`);

  const job = getEntry<JobContent>(after.jobId);
  if (!job) return;

  const previousSkillIds = new Set(heroSkillsAtLevel(job, beforeLevel));
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

// Rescales xp.maximum to the current level's xp curve, clamping `current` down if needed. Never forces a level-up itself.
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

// The return value tells callers when to retry nodes previously given up on.
export function partyGainXp(amount: number): boolean {
  const boostedAmount = Math.round(amount * xpGainMultiplier());
  // Only the level is kept from the pre-update character - the character itself is a draft and is revoked after the callback.
  const progress: { beforeLevel: number; after: Character }[] = [];

  updateGamestate((state) => {
    state.world.party = state.world.party.map((character) => {
      const updated = characterLeveledUp(character, boostedAmount);
      progress.push({ beforeLevel: character.level, after: updated });
      return updated;
    });

    return state;
  });

  progress.forEach(({ beforeLevel, after }) => {
    if (after.level > beforeLevel) {
      analyticsSendDesignEvent('Hero:LevelUp', after.level);
    }
    logCharacterProgress(beforeLevel, after);
  });

  return progress.some((p) => p.after.level > p.beforeLevel);
}
