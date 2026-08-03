import { pluralize } from '@boringnode/pluralize';
import { combatReset, currentCombat } from '@helpers/combat';
import { combatMessageLog } from '@helpers/combat-log';
import { getEntry } from '@helpers/content';
import { encounterStartFight } from '@helpers/encounter';
import { addMaterial } from '@helpers/materials';
import { monsterDroppedItemRewards, monsterXpReward } from '@helpers/monster';
import { partyGainXp, syncPartyHpFromCombat } from '@helpers/party';
import { travelBeginDeathsDoor } from '@helpers/travel';
import type {
  Combat,
  Combatant,
  EncounterContent,
  EncounterId,
  ItemContent,
  ItemId,
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

function grantVictoryRewards(combat: Combat): void {
  const monsters = defeatedMonsters(combat);

  const totalXp = sumBy(monsters, ({ monster, level }) =>
    monsterXpReward(monster, level),
  );
  if (totalXp > 0) {
    partyGainXp(totalXp);
    combatMessageLog(combat, `The party gained ${totalXp} XP!`);
  }

  const itemsFound: Record<ItemId, number> = {};

  monsters.forEach(({ monster, level }) => {
    monsterDroppedItemRewards(monster, level).forEach(
      ({ itemId, quantity }) => {
        itemsFound[itemId] = (itemsFound[itemId] ?? 0) + quantity;
      },
    );
  });

  Object.keys(itemsFound).forEach((itemId) => {
    const quantity = itemsFound[itemId as ItemId];
    if (quantity <= 0) return;

    addMaterial(itemId as ItemId, quantity);

    const item = getEntry<ItemContent>(itemId);
    const itemName = pluralize(item?.name?.toLowerCase() ?? 'item');
    combatMessageLog(combat, `The party found ${quantity} ${itemName}!`);
  });
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
  if (!nextFight) return false;

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
