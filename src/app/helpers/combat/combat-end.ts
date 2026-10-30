import { combatantIsDead } from '@helpers/combat/combat-combatant-hp';
import {
  combatantMessageToken,
  combatMessageLog,
} from '@helpers/combat/combat-log';
import { grantResolvedDrops } from '@helpers/combat/combat-rewards';
import { combatReset } from '@helpers/combat/combat-state';
import { worldCombatState } from '@helpers/state-game';
import { taskRecordEncounterClear } from '@helpers/task/task-progress';
import { monsterXpReward, xpForOverLevel } from '@helpers/combat/monster';
import { commissionRecordMonsterKill } from '@helpers/commission/commission-kill-progress';
import { getEntry } from '@helpers/content/content';
import {
  autoModeRecordClauseFailure,
  autoModeRecordClauseSuccess,
  autoModeRecordNodeFailure,
  autoModeRecordNodeSuccess,
  autoModeResetNodeFailureCounts,
} from '@helpers/decree/auto-mode-state';
import { encounterStartFight } from '@helpers/encounter/encounter';
import {
  encounterRandomHandleVictory,
  encounterRandomNextFightIndex,
} from '@helpers/encounter/encounter-random-combat';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { playGameSFX } from '@helpers/engine/sfx';
import {
  partyGainXp,
  syncPartyHpFromCombat,
} from '@helpers/hero/character-progress';
import { travelBeginDeathsDoor } from '@helpers/hero/travel';
import { combatDropChanceBonus, rollDroppedRewards } from '@helpers/item/loot';
import { monsterRecordKill } from '@helpers/kingdom/bestiary';
import {
  raidResolveDefeat,
  raidResolveVictory,
} from '@helpers/town/raid/town-raid-resolve';
import type {
  CharacterXpGain,
  Combat,
  Combatant,
  EncounterContent,
  EncounterId,
  EncounterRandomContent,
  MonsterContent,
  ResolvedDrop,
  TownContent,
  TownId,
} from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

export function combatHasGuardiansAlive(): boolean {
  const combat = worldCombatState();
  if (!combat) return false;
  return combat.guardians.some((guardian) => !combatantIsDead(guardian));
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

function defeatedMonsters(guardians: Combatant[]): DefeatedMonster[] {
  return guardians
    .map((guardian) => {
      const monster = guardian.monsterId
        ? getEntry<MonsterContent>(guardian.monsterId)
        : undefined;
      return monster ? { monster, level: guardian.level } : undefined;
    })
    .filter((entry): entry is DefeatedMonster => !!entry);
}

// Summons are excluded so a re-summoning monster can't be farmed for rewards.
function rewardingMonsters(combat: Combat): DefeatedMonster[] {
  return defeatedMonsters(combat.guardians.filter((g) => !g.summonerId));
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
  if (combat.raidTownId) {
    return getEntry<TownContent>(combat.raidTownId as TownId)?.defense
      ?.assaulter?.level?.max;
  }
  return undefined;
}

function rollVictoryXp(combat: Combat): number[] {
  return rewardingMonsters(combat).map(({ monster, level }) =>
    monsterXpReward(monster, level),
  );
}

// Kills are rolled once, then scaled against each hero's own level.
function victoryXpAtLevel(
  combat: Combat,
  rawXps: number[],
): (heroLevel: number) => number {
  const maxLevel = encounterMaxLevel(combat);
  if (maxLevel === undefined) return () => 0;

  return (heroLevel) =>
    sumBy(rawXps, (rawXp) => xpForOverLevel(rawXp, heroLevel, maxLevel));
}

function logVictoryXp(combat: Combat, gains: CharacterXpGain[]): void {
  if (gains.length === 0) return;

  const amounts = new Set(gains.map(({ xp }) => xp));
  if (gains.length === combat.heroes.length && amounts.size === 1) {
    combatMessageLog(combat, `The party gained ${gains[0].xp} XP!`);
    return;
  }

  gains.forEach(({ characterId, xp }) => {
    const hero = combat.heroes.find(({ id }) => id === characterId);
    if (!hero) return;

    combatMessageLog(
      combat,
      `**${combatantMessageToken(hero)}** gained ${xp} XP!`,
    );
  });
}

function recordVictoryKills(combat: Combat): void {
  defeatedMonsters(combat.guardians).forEach(({ monster, level }) => {
    monsterRecordKill(monster.id, level, combat.locationName);
  });

  rewardingMonsters(combat).forEach(({ monster }) =>
    commissionRecordMonsterKill(monster.id),
  );
}

function grantVictoryXp(combat: Combat, rawXps: number[]): void {
  const gains = partyGainXp(victoryXpAtLevel(combat, rawXps));
  logVictoryXp(combat, gains);
  if (gains.some(({ leveledUp }) => leveledUp)) {
    autoModeResetNodeFailureCounts();
  }
}

function rollMonsterDrops(combat: Combat): ResolvedDrop[] {
  const bonus = combatDropChanceBonus();
  return rewardingMonsters(combat).flatMap(({ monster, level }) =>
    rollDroppedRewards(monster.drops, level, bonus),
  );
}

function completedEncounter(combat: Combat): EncounterContent | undefined {
  if (combat.encounterId === undefined) return undefined;
  return getEntry<EncounterContent>(combat.encounterId);
}

// Fires once the encounter's last fight is won; rolled fresh each clear.
function rollEncounterCompletionRewards(combat: Combat): ResolvedDrop[] {
  const encounter = completedEncounter(combat);
  if (!encounter) return [];

  // The encounter's level is rolled once and applied to every guardian,
  // so the first guardian's level represents it.
  const level = combat.guardians[0]?.level ?? 1;
  return rollDroppedRewards(
    encounter.completionRewards,
    level,
    combatDropChanceBonus(),
  );
}

function recordEncounterClear(combat: Combat): void {
  if (!completedEncounter(combat)) return;

  analyticsSendDesignEvent(
    `World:Node:Complete:${analyticsSafeSegment(combat.locationName)}`,
  );
  taskRecordEncounterClear(combat.locationName);
}

// The last fight also rolls completion rewards and records the clear.
function grantEncounterFightDrops(
  combat: Combat,
  monsterDrops: ResolvedDrop[],
  isFinalFight: boolean,
): void {
  if (!isFinalFight) {
    grantResolvedDrops(combat, monsterDrops);
    return;
  }

  grantResolvedDrops(combat, [
    ...monsterDrops,
    ...rollEncounterCompletionRewards(combat),
  ]);
  recordEncounterClear(combat);
}

// A fight won without being fought (e.g. Intimidation): full rewards, but the party's HP/EP and combat state are untouched.
export function combatResolveAutoWin(
  combat: Combat,
  isFinalFight: boolean,
): void {
  recordVictoryKills(combat);
  grantVictoryXp(combat, rollVictoryXp(combat));
  grantEncounterFightDrops(combat, rollMonsterDrops(combat), isFinalFight);

  // Once per encounter, so the decree counts the whole auto-win as one success.
  if (isFinalFight) {
    autoModeRecordClauseSuccess();
    autoModeRecordNodeSuccess(combat.locationName);
  }
}

// The fight after this one within the same encounter, if there is one -
// encounters can chain several escalating fights.
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

function combatHasNextFight(combat: Combat): boolean {
  return combat.encounterRandomId
    ? encounterRandomNextFightIndex(combat) !== undefined
    : nextFightFor(combat) !== undefined;
}

// Returns true if another fight was started; callers must not reset combat state then.
function handleCombatVictory(combat: Combat): boolean {
  combatMessageLog(combat, 'Heroes have won the combat!');
  analyticsSendDesignEvent('Combat:Encounter:Win');

  syncPartyHpFromCombat(combat.heroes);
  recordVictoryKills(combat);

  // Only a cleared node counts as progress, so auto mode can't reset its failure counts on a node it never clears.
  const heldXp = [...(combat.heldXp ?? []), ...rollVictoryXp(combat)];
  if (!combatHasNextFight(combat)) {
    autoModeRecordClauseSuccess();
    autoModeRecordNodeSuccess(combat.locationName);
    grantVictoryXp(combat, heldXp);
  }

  // Final-fight kill drops are granted together with completion rewards so duplicate materials log once.
  const monsterDrops = rollMonsterDrops(combat);

  if (combat.raidTownId) {
    raidResolveVictory(combat, combat.raidTownId as TownId, monsterDrops);
    return false;
  }

  if (combat.encounterRandomId) {
    return encounterRandomHandleVictory(combat, monsterDrops, heldXp);
  }

  const nextFight = nextFightFor(combat);
  grantEncounterFightDrops(combat, monsterDrops, !nextFight);
  if (!nextFight) return false;

  encounterStartFight(
    nextFight.encounterId,
    nextFight.fightIndex,
    combat.locationName,
    heldXp,
  );
  return true;
}

export function combatHandleDefeat(combat: Combat): void {
  combatMessageLog(combat, 'Heroes have lost the combat!');
  analyticsSendDesignEvent('Combat:Encounter:Loss');
  playGameSFX('death');

  syncPartyHpFromCombat(combat.heroes);
  autoModeRecordClauseFailure();
  autoModeRecordNodeFailure(combat.locationName);
  travelBeginDeathsDoor();

  // A raid loss is still a real party wipe (Deaths Door above) plus its own town-scoped consequence.
  if (combat.raidTownId) {
    raidResolveDefeat(combat.raidTownId as TownId);
  }
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
