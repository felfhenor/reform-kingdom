import { combatantDamageEventEmit } from '@helpers/combat/combat-damage-events';
import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import {
  CHARACTER_MAX_LEVEL,
  HEALING_MINIMUM_SECONDS,
  HEALING_SECONDS_PER_LEVEL,
} from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { heroLevelUpVfxEmit } from '@helpers/engine/hero-level-up-vfx';
import { heroSkillsAtLevel } from '@helpers/hero/job';
import { characterStats, characterXpForLevel } from '@helpers/hero/party';
import { globalEffectSumsState, updateGamestate } from '@helpers/state-game';
import type {
  Character,
  CharacterXpGain,
  Combatant,
  EquipmentSkillContent,
  JobContent,
} from '@interfaces';
import { clamp } from 'es-toolkit/compat';
import { taskEventLevelReached } from '@helpers/task/task-events';

// Bonus from the precomputed global effect sums cache - 1x with nothing active/owned.
function xpGainMultiplier(): number {
  return 1 + globalEffectSumsState().xpGainMultiplierBonus;
}

// What each hero actually receives, so anything reporting an XP gain should show this rather than the raw amount.
export function partyXpGainAmount(amount: number): number {
  return Math.round(amount * xpGainMultiplier());
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
    stats: characterStats({ ...character, level }),
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

function announceCharacterXpGain(
  beforeLevel: number,
  gained: number,
  after: Character,
): void {
  if (beforeLevel < CHARACTER_MAX_LEVEL) {
    combatantDamageEventEmit(after.id, gained, 'xp');
  }
  if (after.level > beforeLevel) {
    analyticsSendDesignEvent('Hero:LevelUp', after.level);
    heroLevelUpVfxEmit(after.id);
  }
  logCharacterProgress(beforeLevel, after);
}

// Per character so a weak hero isn't penalised by a stronger partymate; max-level heroes are omitted since they can't progress.
export function partyGainXp(
  xpAtLevel: (level: number) => number,
): CharacterXpGain[] {
  // Only the level is kept from the pre-update character - the character itself is a draft and is revoked after the callback.
  const progress: { beforeLevel: number; gained: number; after: Character }[] =
    [];

  updateGamestate((state) => {
    state.world.party.forEach((character, index) => {
      const gained = partyXpGainAmount(xpAtLevel(character.level));
      if (gained <= 0) return;

      const updated = characterLeveledUp(character, gained);
      progress.push({ beforeLevel: character.level, gained, after: updated });
      state.world.party[index] = updated;
    });

    return state;
  });

  progress.forEach(({ beforeLevel, gained, after }) =>
    announceCharacterXpGain(beforeLevel, gained, after),
  );

  const leveledUp = progress.some((p) => p.after.level > p.beforeLevel);
  if (leveledUp) {
    void taskEventLevelReached(
      Math.max(...progress.map(({ after }) => after.level)),
    );
  }

  return progress
    .filter(({ beforeLevel }) => beforeLevel < CHARACTER_MAX_LEVEL)
    .map(({ beforeLevel, gained, after }) => ({
      characterId: after.id,
      xp: gained,
      leveledUp: after.level > beforeLevel,
    }));
}
