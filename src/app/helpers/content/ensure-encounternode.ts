import { ensureArray } from '@helpers/content/ensure-helpers-core';
import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import type {
  EncounterContent,
  EncounterFight,
  EncounterFightMonster,
  EncounterId,
  EncounterRandomContent,
  EncounterRandomId,
  EncounterRandomPoolMonster,
  MonsterId,
} from '@interfaces';

function ensureEncounterFightMonster(
  monster: Partial<EncounterFightMonster> = {},
): EncounterFightMonster {
  return {
    monsterId: monster.monsterId ?? ('UNKNOWN' as MonsterId),
  };
}

function ensureEncounterFight(
  fight: Partial<EncounterFight> = {},
): EncounterFight {
  return {
    monsters: ensureArray(fight.monsters, ensureEncounterFightMonster),
  };
}

export function ensureEncounter(
  encounter: Partial<EncounterContent>,
): Required<EncounterContent> {
  return {
    id: encounter.id ?? ('UNKNOWN' as EncounterId),
    name: encounter.name ?? 'UNKNOWN',
    __type: 'encounter',
    description: encounter.description ?? 'UNKNOWN',
    levelRange: encounter.levelRange ?? { min: 1, max: 1 },
    fights: ensureArray(encounter.fights, ensureEncounterFight),
    completionRewards: ensureArray(
      encounter.completionRewards,
      ensureDroppedReward,
    ),
    hidden: encounter.hidden ?? false,
    invisibleUntilCollectibleIdsFound:
      encounter.invisibleUntilCollectibleIdsFound ?? [],
  };
}

function ensureEncounterRandomPoolMonster(
  monster: Partial<EncounterRandomPoolMonster> = {},
): EncounterRandomPoolMonster {
  return {
    monsterId: monster.monsterId ?? ('UNKNOWN' as MonsterId),
    weight: monster.weight ?? 1,
  };
}

export function ensureEncounterRandom(
  encounter: Partial<EncounterRandomContent>,
): Required<EncounterRandomContent> {
  return {
    id: encounter.id ?? ('UNKNOWN' as EncounterRandomId),
    name: encounter.name ?? 'UNKNOWN',
    __type: 'encounterrandom',
    description: encounter.description ?? 'UNKNOWN',
    resetTime: encounter.resetTime ?? 3600,
    levelRange: encounter.levelRange ?? { min: 1, max: 1 },
    encounterRange: encounter.encounterRange ?? { min: 1, max: 1 },
    combatantRange: encounter.combatantRange ?? { min: 1, max: 1 },
    creaturePool: ensureArray(
      encounter.creaturePool,
      ensureEncounterRandomPoolMonster,
    ),
    fights: ensureArray(encounter.fights, ensureEncounterFight),
    completionRewards: ensureArray(
      encounter.completionRewards,
      ensureDroppedReward,
    ),
    hidden: encounter.hidden ?? false,
    invisibleUntilCollectibleIdsFound:
      encounter.invisibleUntilCollectibleIdsFound ?? [],
  };
}
