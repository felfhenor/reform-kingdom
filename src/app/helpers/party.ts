import { armoryGet } from '@helpers/armory';
import { miscellaneousMessageLog } from '@helpers/combat-log';
import { getEntry } from '@helpers/content';
import { defaultEquipment, defaultStats } from '@helpers/defaults';
import {
  canEquipItem,
  canModifyEquipment,
  equipmentStatTotals,
  equippedItems,
  pruneInvalidEquippedItems,
  slotsHoldingEquipment,
} from '@helpers/equipment';
import { heroSkillsAtLevel } from '@helpers/job';
import { rngUuid } from '@helpers/rng';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  EquipmentTypeToSlot,
  type Character,
  type CharacterId,
  type Combatant,
  type EquipmentBlock,
  type EquipmentContent,
  type EquipmentId,
  type EquipmentItem,
  type EquipmentSkillContent,
  type EquipmentSlot,
  type JobContent,
  type JobId,
  type StatBlock,
} from '@interfaces';
import { clamp } from 'es-toolkit/compat';

export const CHARACTER_MAX_LEVEL = 99;
const XP_BASE_PER_LEVEL = 100;
const STARTER_ARMOR_NAME = 'Cloak of Adventuring';
const STARTER_HAT_NAME = 'Hat of Adventuring';

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

  const starterHat = getEntry<EquipmentContent>(STARTER_HAT_NAME);
  if (starterHat) {
    equipment.Helmet = { equipmentId: starterHat.id };
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
    ep: stats.Energy,
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

// Clears any equipped gear that no longer resolves to real content (e.g.
// after a piece of gear is renamed/removed from gamedata) and recalculates
// stats/hp/ep to match, since pruning can shrink max Health/Energy.
export function pruneInvalidPartyEquipment(party: Character[]): Character[] {
  return party.map((character) => {
    const equipment = pruneInvalidEquippedItems(character.equipment);
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
      ep: clamp(character.ep, 0, stats.Energy),
    };
  });
}

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
        ep: stats.Energy,
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
        ep: clamp(character.ep, 0, stats.Energy),
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

// Equips an armory item onto a hero, occupying every slot the item's
// content declares (e.g. a two-handed weapon fills both Weapon and Offhand
// at once). Any item(s) currently occupying those slots are fully displaced
// - including from any *other* slot they themselves occupy, so partially
// overwriting one hand of an already-equipped two-hander frees the other
// hand too - and returned to the armory as whole items, not duplicated per
// slot. Atomic: a failed check never partially mutates either side. Returns
// false without changing state if equipment can't currently be modified,
// the item isn't eligible (level/class), or the item isn't actually in the
// armory.
export function characterEquipFromArmory(
  characterId: CharacterId,
  equipmentId: EquipmentId,
): boolean {
  if (!canModifyEquipment()) return false;

  const character = partyGet().find((c) => c.id === characterId);
  if (!character) return false;

  const equipmentContent = getEntry<EquipmentContent>(equipmentId);
  if (!equipmentContent || !canEquipItem(character, equipmentContent)) {
    return false;
  }

  const isInArmory = armoryGet().some(
    (item) => item.equipmentId === equipmentId,
  );
  if (!isInArmory) return false;

  const targetSlots = EquipmentTypeToSlot[equipmentContent.type];

  const displacedIds = new Set<EquipmentId>();
  targetSlots.forEach((slot) => {
    const existing = character.equipment[slot];
    if (existing && existing.equipmentId !== equipmentId) {
      displacedIds.add(existing.equipmentId);
    }
  });

  const clearedSlots = new Set<EquipmentSlot>(targetSlots);
  displacedIds.forEach((displacedId) => {
    slotsHoldingEquipment(character.equipment, displacedId).forEach((slot) =>
      clearedSlots.add(slot),
    );
  });

  const displacedItems: EquipmentItem[] = Array.from(displacedIds).map(
    (displacedId) => ({ equipmentId: displacedId }),
  );

  updateGamestate((state) => {
    const armoryIndex = state.armory.findIndex(
      (item) => item.equipmentId === equipmentId,
    );
    if (armoryIndex === -1) return state;

    state.armory = [
      ...state.armory.filter((_, index) => index !== armoryIndex),
      ...displacedItems,
    ];

    state.world.party = state.world.party.map((c) => {
      if (c.id !== characterId) return c;

      const equipment = { ...c.equipment };
      clearedSlots.forEach((slot) => {
        equipment[slot] = undefined;
      });
      targetSlots.forEach((slot) => {
        equipment[slot] = { equipmentId };
      });

      const stats = characterStatsForLevel(c.jobId, c.level, equipment);

      return {
        ...c,
        equipment,
        stats,
        hp: clamp(c.hp, 0, stats.Health),
        ep: clamp(c.ep, 0, stats.Energy),
      };
    });

    return state;
  });

  return true;
}

// Moves a hero's currently-equipped item (if any) back into the armory,
// clearing every slot it occupies (a two-handed weapon frees both hands at
// once, as a single armory entry, not one per slot). Returns false without
// changing state if equipment can't currently be modified or the slot is
// already empty.
export function characterUnequipToArmory(
  characterId: CharacterId,
  slot: EquipmentSlot,
): boolean {
  if (!canModifyEquipment()) return false;

  const character = partyGet().find((c) => c.id === characterId);
  const previousItem = character?.equipment[slot];
  if (!character || !previousItem) return false;

  const occupiedSlots = slotsHoldingEquipment(
    character.equipment,
    previousItem.equipmentId,
  );

  updateGamestate((state) => {
    state.armory = [...state.armory, previousItem];

    state.world.party = state.world.party.map((c) => {
      if (c.id !== characterId) return c;

      const equipment = { ...c.equipment };
      occupiedSlots.forEach((occupiedSlot) => {
        equipment[occupiedSlot] = undefined;
      });

      const stats = characterStatsForLevel(c.jobId, c.level, equipment);

      return {
        ...c,
        equipment,
        stats,
        hp: clamp(c.hp, 0, stats.Health),
        ep: clamp(c.ep, 0, stats.Energy),
      };
    });

    return state;
  });

  return true;
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

// Skills are derived from job + level rather than tracked as "known" state
// (see heroSkillsAtLevel), so diffing the unlocked skill ids before/after
// also naturally announces within-path rank upgrades (e.g. Double Strike I
// -> II) as a newly learned skill.
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

export function partyGainXp(amount: number): void {
  updateGamestate((state) => {
    state.world.party = state.world.party.map((character) => {
      const updated = characterLeveledUp(character, amount);
      logCharacterProgress(character, updated);
      return updated;
    });

    return state;
  });
}
