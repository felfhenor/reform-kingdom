import { armoryAdd } from '@helpers/armory';
import { collectiblesAdd } from '@helpers/collectibles';
import { combatReset, currentCombat } from '@helpers/combat';
import {
  collectibleDropHtml,
  combatMessageLog,
  equipmentDropHtml,
  itemDropHtml,
  recipeDropHtml,
} from '@helpers/combat-log';
import { getEntry } from '@helpers/content';
import { encounterStartFight } from '@helpers/encounter';
import { rollDroppedRewards } from '@helpers/loot';
import { addMaterial } from '@helpers/materials';
import { monsterXpReward } from '@helpers/monster';
import { partyGainXp, syncPartyHpFromCombat } from '@helpers/party';
import { recipeDiscover } from '@helpers/recipes';
import { travelBeginDeathsDoor } from '@helpers/travel';
import type {
  CollectibleContent,
  Combat,
  Combatant,
  EncounterContent,
  EncounterId,
  EquipmentContent,
  ItemContent,
  ItemId,
  MonsterContent,
  RecipeContent,
  ResolvedDrop,
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

// Shared by monster kill drops and encounter completion rewards, both of
// which now roll from the same `DroppedReward[]` schema (see `loot.ts`).
function grantResolvedDrops(combat: Combat, drops: ResolvedDrop[]): void {
  const itemsFound: Record<ItemId, number> = {};

  drops.forEach((drop) => {
    if ('equipmentId' in drop) {
      armoryAdd(drop.equipmentId);

      const equipment = getEntry<EquipmentContent>(drop.equipmentId);
      if (!equipment) return;

      combatMessageLog(
        combat,
        `The party found ${equipmentDropHtml(equipment)}!`,
      );
      return;
    }

    if ('collectibleId' in drop) {
      collectiblesAdd(drop.collectibleId, 1, combat.locationName);

      const collectible = getEntry<CollectibleContent>(drop.collectibleId);
      if (!collectible) return;

      combatMessageLog(
        combat,
        `The party found ${collectibleDropHtml(collectible)}!`,
      );
      return;
    }

    if ('recipeId' in drop) {
      recipeDiscover(drop.recipeId, combat.locationName);

      const recipe = getEntry<RecipeContent>(drop.recipeId);
      if (!recipe) return;

      combatMessageLog(combat, `The party found ${recipeDropHtml(recipe)}!`);
      return;
    }

    itemsFound[drop.itemId] = (itemsFound[drop.itemId] ?? 0) + drop.quantity;
  });

  Object.keys(itemsFound).forEach((itemId) => {
    const quantity = itemsFound[itemId as ItemId];
    if (quantity <= 0) return;

    addMaterial(itemId as ItemId, quantity);

    const item = getEntry<ItemContent>(itemId);
    if (!item) return;

    combatMessageLog(combat, `The party found ${itemDropHtml(item, quantity)}!`);
  });
}

function grantVictoryRewards(combat: Combat): void {
  const monsters = defeatedMonsters(combat);

  const totalXp = sumBy(monsters, ({ monster, level }) =>
    monsterXpReward(monster, level),
  );
  if (totalXp > 0) {
    partyGainXp(totalXp);
    combatMessageLog(combat, `The party gained ${totalXp} XP!`);
  }

  const drops = monsters.flatMap(({ monster, level }) =>
    rollDroppedRewards(monster.drops, level),
  );
  grantResolvedDrops(combat, drops);
}

// Fires once the last fight in an encounter has been won (the node is fully
// cleared) - rolled fresh every time, so repeat clears can hit the same
// rewards again, same as per-kill monster drops.
function grantEncounterCompletionRewards(combat: Combat): void {
  if (combat.encounterId === undefined) return;

  const encounter = getEntry<EncounterContent>(combat.encounterId);
  if (!encounter) return;

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

// Returns true if another fight in the same encounter was started - callers
// must not reset combat state in that case, since it would immediately wipe
// out the fight `encounterStartFight` just wrote to `state.world.combat`.
function handleCombatVictory(combat: Combat): boolean {
  combatMessageLog(combat, 'Heroes have won the combat!');

  syncPartyHpFromCombat(combat.heroes);
  grantVictoryRewards(combat);

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
  combatMessageLog(combat, 'The fallen party awaits recall to the kingdom.');

  syncPartyHpFromCombat(combat.heroes);
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
