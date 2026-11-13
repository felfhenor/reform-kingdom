import { combatantIsDead } from '@helpers/combat/combat-combatant-hp';
import {
  combatantMessageToken,
  combatMessageLog,
} from '@helpers/combat/combat-log';
import { grantResolvedDrops } from '@helpers/combat/combat-rewards';
import { combatReset } from '@helpers/combat/combat-state';
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
import { founderWhisperLog } from '@helpers/lore/founder-whisper';
import {
  runStatsFightHeroIds,
  runStatsRecordFightEnd,
  runStatsRecordSeal,
} from '@helpers/run-stats/run-stats';
import {
  globalEffectSumsState,
  updateGamestate,
  worldCombatState,
} from '@helpers/state-game';
import { taskRecordEncounterClear } from '@helpers/task/task-progress';
import { raidResolveVictory } from '@helpers/town/raid/town-raid-resolve';
import { monsterDropsOnMap } from '@helpers/world-node/world-node-monster-drops';
import { worldNodeByName } from '@helpers/world-node/world-nodes';
import type {
  CharacterXpGain,
  Combat,
  Combatant,
  EncounterContent,
  EncounterFight,
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
    if (monsterRecordKill(monster.id, level, combat.locationName)) {
      combatMessageLog(
        combat,
        `The party has fought enough **${monster.name}** to learn its strengths and weaknesses!`,
      );
    }
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
  const mapName = worldNodeByName(combat.locationName)?.mapName ?? '';
  return rewardingMonsters(combat).flatMap(({ monster, level }) =>
    rollDroppedRewards(monsterDropsOnMap(monster, mapName), level, bonus),
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

function currentEncounterFight(combat: Combat): EncounterFight | undefined {
  if (combat.fightIndex === undefined) return undefined;
  return completedEncounter(combat)?.fights[combat.fightIndex];
}

function recordEncounterClear(combat: Combat): void {
  const encounter = completedEncounter(combat);
  if (!encounter) return;

  const sealed = runStatsRecordSeal(encounter.id);
  if (sealed) {
    combatMessageLog(combat, `The memory of ${sealed.name} is set in stone.`);
    analyticsSendDesignEvent(
      `Progress:Seal:${analyticsSafeSegment(sealed.name)}`,
    );
  }

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
  // Nobody fights an auto-won fight, so only the run-wide win counts.
  runStatsRecordFightEnd(true, []);
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
  runStatsRecordFightEnd(true, runStatsFightHeroIds(combat));

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

  const fight = currentEncounterFight(combat);
  if (fight?.postFightWhisper) founderWhisperLog(fight.postFightWhisper);
  if (!nextFight) return false;

  encounterStartFight(
    nextFight.encounterId,
    nextFight.fightIndex,
    combat.locationName,
    heldXp,
    fight?.postFightDelay ?? 0,
  );
  return true;
}

function combatEndRunOnWipe(): void {
  updateGamestate((state) => {
    state.meta.runLost = true;
    return state;
  });
  analyticsSendDesignEvent('Combat:Encounter:RunLost');
}

export function combatHandleDefeat(combat: Combat): void {
  combatMessageLog(combat, 'Heroes have lost the combat!');
  analyticsSendDesignEvent('Combat:Encounter:Loss');
  playGameSFX('death');

  syncPartyHpFromCombat(combat.heroes);
  runStatsRecordFightEnd(false, runStatsFightHeroIds(combat));
  autoModeRecordClauseFailure();
  autoModeRecordNodeFailure(combat.locationName);

  if (globalEffectSumsState().wipeEndsRun) {
    combatEndRunOnWipe();
    return;
  }

  travelBeginDeathsDoor();

  // A lost raid fight leaves the telegraph up; the town only falls when the window expires.
  if (combat.raidTownId) {
    combatMessageLog(
      combat,
      `The raiders still threaten ${combat.locationName} - regroup and defend it before time runs out!`,
    );
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
