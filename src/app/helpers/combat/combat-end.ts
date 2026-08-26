import { combatMessageLog } from '@helpers/combat/combat-log';
import { grantResolvedDrops } from '@helpers/combat/combat-rewards';
import { combatReset, currentCombat } from '@helpers/combat/combat-state';
import { monsterXpReward, xpForOverLevel } from '@helpers/combat/monster';
import { getEntry } from '@helpers/content';
import {
  autoModeRecordClauseFailure,
  autoModeRecordClauseSuccess,
  autoModeRecordNodeFailure,
  autoModeRecordNodeSuccess,
  autoModeResetNodeFailureCounts,
} from '@helpers/decree/auto-mode';
import { encounterStartFight } from '@helpers/encounter/encounter';
import { encounterRandomHandleVictory } from '@helpers/encounter/encounter-random-combat';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import {
  partyGainXp,
  syncPartyHpFromCombat,
} from '@helpers/hero/character-progress';
import { travelBeginDeathsDoor } from '@helpers/hero/travel';
import { rollDroppedRewards } from '@helpers/item/loot';
import { monsterRecordKill } from '@helpers/kingdom/bestiary';
import type {
  Combat,
  Combatant,
  EncounterContent,
  EncounterId,
  EncounterRandomContent,
  MonsterContent,
} from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

export function combatHasGuardiansAlive(): boolean {
  const combat = currentCombat();
  if (!combat) return false;
  return combat.guardians.some((guardian) => !combatantIsDead(guardian));
}

export function combatantIsDead(combatant: Combatant): boolean {
  return combatant.hp <= 0;
}

export function isCombatOver(combat: Combat): boolean {
  const allHeroesDead = combat.heroes.every((hero) => combatantIsDead(hero));
  const allGuardiansDead = combat.guardians.every((guardian) =>
    combatantIsDead(guardian),
  );

  return allHeroesDead || allGuardiansDead;
}

function didHeroesWin(combat: Combat): boolean {
  return combat.guardians.every((guardian) => combatantIsDead(guardian));
}

type DefeatedMonster = { monster: MonsterContent; level: number };

function defeatedMonsters(combat: Combat): DefeatedMonster[] {
  return combat.guardians
    .map((guardian) => {
      const monster = guardian.monsterId
        ? getEntry<MonsterContent>(guardian.monsterId)
        : undefined;
      return monster ? { monster, level: guardian.level } : undefined;
    })
    .filter((entry): entry is DefeatedMonster => !!entry);
}

// Highest hero level represents the party for over-level XP scaling.
function partyRepresentativeLevel(combat: Combat): number {
  return Math.max(...combat.heroes.map((hero) => hero.level), 1);
}

// Max level for the source encounter, used to cap over-level XP scaling.
function encounterMaxLevel(combat: Combat): number | undefined {
  if (combat.encounterId) {
    return getEntry<EncounterContent>(combat.encounterId)?.levelRange?.max;
  }
  if (combat.encounterRandomId) {
    return getEntry<EncounterRandomContent>(combat.encounterRandomId)
      ?.levelRange?.max;
  }
  return undefined;
}

function grantVictoryRewards(combat: Combat): void {
  const monsters = defeatedMonsters(combat);
  const maxLevel = encounterMaxLevel(combat);
  const partyLevel = partyRepresentativeLevel(combat);

  monsters.forEach(({ monster, level }) =>
    monsterRecordKill(monster.id, level, combat.locationName),
  );

  const totalXp = sumBy(monsters, ({ monster, level }) => {
    const rawXp = monsterXpReward(monster, level);
    return maxLevel !== undefined
      ? xpForOverLevel(rawXp, partyLevel, maxLevel)
      : 0;
  });
  if (totalXp > 0) {
    const leveledUp = partyGainXp(totalXp);
    combatMessageLog(combat, `The party gained ${totalXp} XP!`);
    if (leveledUp) autoModeResetNodeFailureCounts();
  }

  const drops = monsters.flatMap(({ monster, level }) =>
    rollDroppedRewards(monster.drops, level),
  );
  grantResolvedDrops(combat, drops);
}

// Fires once the encounter's last fight is won; rolled fresh each clear.
function grantEncounterCompletionRewards(combat: Combat): void {
  if (combat.encounterId === undefined) return;

  const encounter = getEntry<EncounterContent>(combat.encounterId);
  if (!encounter) return;

  analyticsSendDesignEvent(
    `World:Node:Complete:${analyticsSafeSegment(combat.locationName)}`,
  );

  // The encounter's level is rolled once and applied to every guardian at
  // `encounterStartFight` time, so the first guardian's level represents it.
  const level = combat.guardians[0]?.level ?? 1;
  const drops = rollDroppedRewards(encounter.completionRewards, level);
  grantResolvedDrops(combat, drops);
}

// The fight after this one within the same encounter, if there is one -
// encounters can chain several escalating fights (see gamedata/encounter).
function nextFightFor(
  combat: Combat,
): { encounterId: EncounterId; fightIndex: number } | undefined {
  if (combat.encounterId === undefined || combat.fightIndex === undefined) {
    return undefined;
  }

  const encounter = getEntry<EncounterContent>(combat.encounterId);
  if (!encounter) return undefined;

  const fightIndex = combat.fightIndex + 1;
  if (fightIndex >= encounter.fights.length) return undefined;

  return { encounterId: combat.encounterId, fightIndex };
}

// Returns true if another fight was started; callers must not reset combat state then.
function handleCombatVictory(combat: Combat): boolean {
  combatMessageLog(combat, 'Heroes have won the combat!');
  analyticsSendDesignEvent('Combat:Encounter:Win');

  syncPartyHpFromCombat(combat.heroes);
  autoModeRecordClauseSuccess();
  autoModeRecordNodeSuccess(combat.locationName);
  grantVictoryRewards(combat);

  if (combat.encounterRandomId) {
    return encounterRandomHandleVictory(combat);
  }

  const nextFight = nextFightFor(combat);
  if (!nextFight) {
    grantEncounterCompletionRewards(combat);
    return false;
  }

  encounterStartFight(
    nextFight.encounterId,
    nextFight.fightIndex,
    combat.locationName,
  );
  return true;
}

export function combatHandleDefeat(combat: Combat): void {
  combatMessageLog(combat, 'Heroes have lost the combat!');
  analyticsSendDesignEvent('Combat:Encounter:Loss');

  syncPartyHpFromCombat(combat.heroes);
  autoModeRecordClauseFailure();
  autoModeRecordNodeFailure(combat.locationName);
  travelBeginDeathsDoor();
}

export function combatCheckIfOver(combat: Combat): boolean {
  if (!isCombatOver(combat)) return false;

  combatMessageLog(combat, 'Combat is over.');

  let continuingEncounter = false;
  if (didHeroesWin(combat)) {
    continuingEncounter = handleCombatVictory(combat);
  } else {
    combatHandleDefeat(combat);
  }

  if (!continuingEncounter) {
    combatReset();
  }

  combatMessageLog(combat, '');

  return true;
}
