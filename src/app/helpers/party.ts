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
