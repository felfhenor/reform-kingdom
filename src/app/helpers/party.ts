import { getEntry } from '@helpers/content';
import { defaultEquipment, defaultStats } from '@helpers/defaults';
import { rngUuid } from '@helpers/rng';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  Character,
  CharacterId,
  Combatant,
  JobContent,
  JobId,
} from '@interfaces';
import { clamp } from 'es-toolkit/compat';

export function createCharacter(name: string, jobId: JobId): Character {
  const job = getEntry<JobContent>(jobId);
  const stats = { ...(job?.baseStats ?? defaultStats()) };

  return {
    id: rngUuid() as CharacterId,
    name,
    level: 1,
    xp: {
      current: 0,
      maximum: 100,
    },
    jobId,
    hp: stats.Health,
    stats,
    equipment: defaultEquipment(),
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

export function characterReclass(characterId: CharacterId, jobId: JobId): void {
  const job = getEntry<JobContent>(jobId);
  const stats = { ...(job?.baseStats ?? defaultStats()) };

  updateGamestate((state) => {
    state.world.party = state.world.party.map((character) =>
      character.id === characterId
        ? {
            ...character,
            jobId,
            stats,
            hp: stats.Health,
            level: 1,
            xp: { current: 0, maximum: 100 },
          }
        : character,
    );
    return state;
  });
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

export function partyGainXp(amount: number): void {
  updateGamestate((state) => {
    state.world.party = state.world.party.map((character) => ({
      ...character,
      xp: {
        ...character.xp,
        current: character.xp.current + amount,
      },
    }));

    return state;
  });
}
