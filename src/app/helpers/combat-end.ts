import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/analytics';
import {
  autoModeRecordClauseFailure,
  autoModeRecordClauseSuccess,
  autoModeRecordNodeFailure,
  autoModeRecordNodeSuccess,
  autoModeResetNodeFailureCounts,
} from '@helpers/auto-mode';
import { monsterRecordKill } from '@helpers/bestiary';
import { partyGainXp, syncPartyHpFromCombat } from '@helpers/character-progress';
import { combatReset, currentCombat } from '@helpers/combat';
import { combatMessageLog } from '@helpers/combat-log';
import { grantResolvedDrops } from '@helpers/combat-rewards';
import { getEntry } from '@helpers/content';
import { encounterStartFight } from '@helpers/encounter';
import { encounterRandomHandleVictory } from '@helpers/encounter-random-combat';
import { rollDroppedRewards } from '@helpers/loot';
import { addMaterial, goldCoinId } from '@helpers/materials';
import { monsterXpReward, xpForOverLevel } from '@helpers/monster';
import { researchPointItemId } from '@helpers/research/research';
import {
  researchMonsterBonusGoldChance,
  researchMonsterLootBonusQuantity,
} from '@helpers/research/research-effects';
import { rngSucceedsChance } from '@helpers/rng';
import { travelBeginDeathsDoor } from '@helpers/travel';
import {
  isFirstTimeNodeRewardsGranted,
  markFirstTimeNodeRewardsGranted,
} from '@helpers/world-node-first-time-rewards';
import type {
  Combat,
  Combatant,
  EncounterContent,
  EncounterId,
  EncounterRandomContent,
  MonsterContent,
  ResolvedDrop,
  ResolvedItemDrop,
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

// Trophy Hunter's effect: unconditional +N to every resolved item drop's
// quantity from monster kills - no chance roll, no gold-exclusion logic
// needed since equipment/collectible/recipe drops have no `quantity` field.
function applyMonsterLootBonusQuantity(drops: ResolvedDrop[]): ResolvedDrop[] {
  const bonus = researchMonsterLootBonusQuantity();
  if (bonus <= 0) return drops;

  return drops.map((drop) =>
    'itemId' in drop ? { ...drop, quantity: drop.quantity + bonus } : drop,
  );
}

// Looters' effect: scoped to monster-kill gold specifically, not node/dungeon
// completion gold (grantEncounterCompletionRewards is a separate function).
function grantMonsterBonusGold(combat: Combat, monsterCount: number): void {
  if (monsterCount === 0) return;

  const { chance, bonusGold } = researchMonsterBonusGoldChance();
  if (chance <= 0 || bonusGold <= 0 || !rngSucceedsChance(chance)) return;

  addMaterial(goldCoinId(), bonusGold);
  combatMessageLog(combat, `The party looted an extra ${bonusGold} gold!`);
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
  grantResolvedDrops(combat, applyMonsterLootBonusQuantity(drops));
  grantMonsterBonusGold(combat, monsters.length);
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

// Fires once per physical node, ever - gated by the ledger, not by anything
// about the tree's completion state (see world-node-first-time-rewards.ts).
// Marks granted even on a whiffed roll (chance < 100 on an authored RP entry
// is a content bug the researchrpgaps validator flags, not something this
// retries).
function grantEncounterFirstTimeRewards(combat: Combat): void {
  if (combat.encounterId === undefined) return;

  const encounter = getEntry<EncounterContent>(combat.encounterId);
  if (!encounter?.firstTimeRewards?.length) return;
  if (isFirstTimeNodeRewardsGranted(combat.locationName)) return;

  const level = combat.guardians[0]?.level ?? 1;
  const drops = rollDroppedRewards(encounter.firstTimeRewards, level);
  grantResolvedDrops(combat, drops);

  const rpItemId = researchPointItemId();
  const rpGranted = sumBy(
    drops.filter(
      (drop): drop is ResolvedItemDrop =>
        'itemId' in drop && drop.itemId === rpItemId,
    ),
    (drop) => drop.quantity,
  );
  markFirstTimeNodeRewardsGranted(combat.locationName, rpGranted);
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
    grantEncounterFirstTimeRewards(combat);
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
