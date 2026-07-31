import { getEntry } from '@helpers/content';
import { defaultEquipment, defaultStats } from '@helpers/defaults';
import { rngUuid } from '@helpers/rng';
import { updateGamestate } from '@helpers/state-game';
import type { Character, CharacterId, JobContent, JobId } from '@interfaces';

export function createCharacter(name: string, jobId: JobId): Character {
  const job = getEntry<JobContent>(jobId);

  return {
    id: rngUuid() as CharacterId,
    name,
    level: 1,
    xp: {
      current: 0,
      maximum: 100,
    },
    jobId,
    stats: { ...(job?.baseStats ?? defaultStats()) },
    equipment: defaultEquipment(),
    traitIds: [],
  };
}

export function setParty(party: Character[]): void {
  updateGamestate((state) => {
    state.world.party = party;
    return state;
  });
}
