import { getEntry } from '@helpers/content';
import { defaultEquipment, defaultStats } from '@helpers/defaults';
import {
  canModifyEquipment,
  equipmentStatTotals,
  equippedItems,
} from '@helpers/equipment';
import { rngUuid } from '@helpers/rng';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  Character,
  CharacterId,
  Combatant,
  EquipmentBlock,
  EquipmentContent,
  EquipmentId,
  EquipmentSlot,
  JobContent,
  JobId,
  StatBlock,
} from '@interfaces';
import { clamp } from 'es-toolkit/compat';

export const CHARACTER_MAX_LEVEL = 99;
const XP_BASE_PER_LEVEL = 100;
const STARTER_ARMOR_NAME = 'Cloak of Adventuring';

// Tunable XP curve: 100 XP for level 1->2, scaling up by level^1.5 thereafter.
export function characterXpForLevel(level: number): number {
  return Math.round(XP_BASE_PER_LEVEL * level ** 1.5);
}

function jobStatsAtLevel(jobId: JobId, level: number): StatBlock {
  const job = getEntry<JobContent>(jobId);
  const stats = { ...(job?.baseStats ?? defaultStats()) };
  const perLevel = job?.statsPerLevel ?? defaultStats();

  (Object.keys(stats) as Array<keyof StatBlock>).forEach((stat) => {
    stats[stat] += perLevel[stat] * (level - 1);
  });

  return stats;
}

// Equipment stat bonuses are flat (no per-level scaling on gear).
export function characterStatsForLevel(
  jobId: JobId,
  level: number,
  equipment: EquipmentBlock,
): StatBlock {
  const stats = jobStatsAtLevel(jobId, level);
  const equipmentStats = equipmentStatTotals(equipment);

  (Object.keys(stats) as Array<keyof StatBlock>).forEach((stat) => {
    stats[stat] += equipmentStats[stat];
  });

  return stats;
}

function starterEquipment(): EquipmentBlock {
  const equipment = defaultEquipment();

  const starterArmor = getEntry<EquipmentContent>(STARTER_ARMOR_NAME);
  if (starterArmor) {
    equipment.Armor = { equipmentId: starterArmor.id };
  }

  return equipment;
}

export function createCharacter(name: string, jobId: JobId): Character {
  const equipment = starterEquipment();
  const stats = characterStatsForLevel(jobId, 1, equipment);

  return {
    id: rngUuid() as CharacterId,
    name,
    level: 1,
    xp: {
      current: 0,
      maximum: characterXpForLevel(1),
    },
    jobId,
    jobProgress: {},
    hp: stats.Health,
    stats,
    equipment,
    traitIds: [],
  };
}

export function partyGet(): Character[] {
  return gamestate().world.party;
}

export function setParty(party: Character[]): void {
  updateGamestate((state) => {
    state.world.party = party;
    return state;
  });
}

// Snapshots the character's current level/xp under their outgoing job, then
// pulls out any progress previously saved for the incoming job (if the
// character has held it before), falling back to level 1 otherwise.
function characterJobProgressSwap(
  character: Character,
  jobId: JobId,
): { jobProgress: Character['jobProgress']; level: number; xp: Character['xp'] } {
  const jobProgress: Character['jobProgress'] = {
    ...character.jobProgress,
    [character.jobId]: { level: character.level, xp: character.xp },
  };

  const savedProgress = jobProgress[jobId];
  delete jobProgress[jobId];

  const level = savedProgress?.level ?? 1;
  const xp = savedProgress?.xp ?? { current: 0, maximum: characterXpForLevel(level) };

  return { jobProgress, level, xp };
}

// Reclassing fully unequips the hero; their old gear is routed to the
// Armory rather than discarded, per M2-03 in the roadmap. Level/xp for the
// outgoing job is saved and, if the incoming job was held before, restored.
export function characterReclass(characterId: CharacterId, jobId: JobId): void {
  updateGamestate((state) => {
    const character = state.world.party.find((c) => c.id === characterId);
    if (character) {
      state.armory = [...state.armory, ...equippedItems(character.equipment)];
    }

    state.world.party = state.world.party.map((character) => {
      if (character.id !== characterId) return character;

      const { jobProgress, level, xp } = characterJobProgressSwap(
        character,
        jobId,
      );
      const equipment = defaultEquipment();
      const stats = characterStatsForLevel(jobId, level, equipment);

      return {
        ...character,
        jobId,
        jobProgress,
        equipment,
        stats,
        hp: stats.Health,
        level,
        xp,
      };
    });
    return state;
  });
}

function applyCharacterEquipment(
  characterId: CharacterId,
  equipmentForCharacter: (character: Character) => EquipmentBlock,
): boolean {
  if (!canModifyEquipment()) return false;

  updateGamestate((state) => {
    state.world.party = state.world.party.map((character) => {
      if (character.id !== characterId) return character;

      const equipment = equipmentForCharacter(character);
      const stats = characterStatsForLevel(
        character.jobId,
        character.level,
        equipment,
      );

      return {
        ...character,
        equipment,
        stats,
        hp: clamp(character.hp, 0, stats.Health),
      };
    });

    return state;
  });

  return true;
}

// Returns false (without changing state) if equipment cannot currently be
// modified, e.g. while the party is in combat.
export function characterEquipItem(
  characterId: CharacterId,
  slot: EquipmentSlot,
  equipmentId: EquipmentId,
): boolean {
  return applyCharacterEquipment(characterId, (character) => ({
    ...character.equipment,
    [slot]: { equipmentId },
  }));
}

// Returns false (without changing state) if equipment cannot currently be
// modified, e.g. while the party is in combat.
export function characterUnequipItem(
  characterId: CharacterId,
  slot: EquipmentSlot,
): boolean {
  return applyCharacterEquipment(characterId, (character) => ({
    ...character.equipment,
    [slot]: undefined,
  }));
}

export function syncPartyHpFromCombat(heroes: Combatant[]): void {
  updateGamestate((state) => {
    state.world.party = state.world.party.map((character) => {
      const combatant = heroes.find((hero) => hero.id === character.id);
      if (!combatant) return character;

      return {
        ...character,
        hp: clamp(combatant.hp, 0, character.stats.Health),
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
    }));

    return state;
  });
}

const HEALING_MINIMUM_SECONDS = 10;
const HEALING_SECONDS_PER_LEVEL = 2;

// A flat 10-second minimum recovery period, plus ~2 ticks (roughly 2 seconds
// at 1x speed) of global healing per hero level on top of it. See M1-09 in
// the roadmap for the eventual per-hero healing-timer design.
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

export function partyGainXp(amount: number): void {
  updateGamestate((state) => {
    state.world.party = state.world.party.map((character) =>
      characterLeveledUp(character, amount),
    );

    return state;
  });
}
