import { combatReset, currentCombat } from '@helpers/combat';
import { combatMessageLog } from '@helpers/combat-log';
import { getEntry } from '@helpers/content';
import { addGlobalEffect } from '@helpers/global-effects';
import { addMaterial } from '@helpers/materials';
import { monsterDroppedItemRewards, monsterXpReward } from '@helpers/monster';
import { partyGainXp, syncPartyHpFromCombat } from '@helpers/party';
import type {
  Combat,
  Combatant,
  GlobalEffectId,
  ItemContent,
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

function defeatedMonsters(combat: Combat): MonsterContent[] {
  return combat.guardians
    .map((guardian) =>
      guardian.monsterId ? getEntry<MonsterContent>(guardian.monsterId) : undefined,
    )
    .filter((monster): monster is MonsterContent => !!monster);
}

function grantVictoryRewards(combat: Combat): void {
  const monsters = defeatedMonsters(combat);

  const totalXp = sumBy(monsters, (monster) => monsterXpReward(monster));
  if (totalXp > 0) {
    partyGainXp(totalXp);
    combatMessageLog(combat, `The party gained ${totalXp} XP!`);
  }

  monsters.forEach((monster) => {
    monsterDroppedItemRewards(monster).forEach(({ itemId, quantity }) => {
      addMaterial(itemId, quantity);

      const item = getEntry<ItemContent>(itemId);
      combatMessageLog(
        combat,
        `The party found ${quantity} ${item?.name ?? 'items'}!`,
      );
    });
  });
}

function handleCombatVictory(combat: Combat): void {
  combatMessageLog(combat, 'Heroes have won the combat!');

  syncPartyHpFromCombat(combat.heroes);
  grantVictoryRewards(combat);
}

// ~2 ticks (roughly 2 seconds at 1x speed) of global healing per hero level.
// See M1-09 in the roadmap for the eventual per-hero healing-timer design.
function healingTicksForParty(combat: Combat): number {
  const highestLevel = Math.max(...combat.heroes.map((hero) => hero.level), 1);
  return highestLevel * 2;
}

export function combatHandleDefeat(combat: Combat): void {
  combatMessageLog(combat, 'Heroes have lost the combat!');
  combatMessageLog(combat, 'Heroes have been sent home for recovery!');

  syncPartyHpFromCombat(combat.heroes);
  addGlobalEffect('Healing' as GlobalEffectId, healingTicksForParty(combat));
}

export function combatCheckIfOver(combat: Combat): boolean {
  if (!isCombatOver(combat)) return false;

  combatMessageLog(combat, 'Combat is over.');

  if (didHeroesWin(combat)) {
    handleCombatVictory(combat);
  } else {
    combatHandleDefeat(combat);
  }

  combatReset();

  combatMessageLog(combat, '');

  return true;
}
