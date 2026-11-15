import { combatWonInAmbushRound } from '@helpers/combat/combat-ambush';
import {
  combatantHealthPercent,
  combatantIsDead,
} from '@helpers/combat/combat-combatant-hp';
import {
  ACHIEVEMENT_GIANT_SLAYER_LEVEL_GAP,
  ACHIEVEMENT_LAST_HERO_STANDING_HP_PERCENT,
} from '@helpers/config';
import { encounterRandomNextFightIndex } from '@helpers/encounter/encounter-random-combat';
import { equipmentItemIsCursed } from '@helpers/item/affix';
import { equippedItems } from '@helpers/item/equipment';
import { globalEffectSumsState, worldPartyState } from '@helpers/state-game';
import type { AchievementMoment, Combat } from '@interfaces';

function combatWonByLastHeroStanding(combat: Combat): boolean {
  const standing = combat.heroes.filter((hero) => !combatantIsDead(hero));
  return (
    combat.heroes.length > 1 &&
    standing.length === 1 &&
    combatantHealthPercent(standing[0]) <=
      ACHIEVEMENT_LAST_HERO_STANDING_HP_PERCENT
  );
}

// Summons take their summoner's level, so only the monsters the fight began with count.
function combatWonAgainstGiant(combat: Combat): boolean {
  const strongest = Math.max(...combat.heroes.map((hero) => hero.level));
  return (
    combat.heroes.length > 0 &&
    combat.guardians.some(
      (guardian) =>
        !guardian.summonerId &&
        guardian.level - strongest >= ACHIEVEMENT_GIANT_SLAYER_LEVEL_GAP,
    )
  );
}

function partyAllCursed(): boolean {
  const party = worldPartyState();
  return (
    party.length > 0 &&
    party.every((hero) =>
      equippedItems(hero.equipment).some(equipmentItemIsCursed),
    )
  );
}

// Cursed drops (Fickle Curses) hand out the curses, so they don't count.
function combatClearedRandomNodeCursed(combat: Combat): boolean {
  return (
    !!combat.encounterRandomId &&
    !globalEffectSumsState().cursedDrops &&
    partyAllCursed() &&
    encounterRandomNextFightIndex(combat) === undefined
  );
}

export function combatVictoryMoments(combat: Combat): AchievementMoment[] {
  const moments: [AchievementMoment, boolean][] = [
    ['AmbushVictory', combatWonInAmbushRound(combat)],
    ['CoverDeathVictory', !!combat.heroDiedCovering],
    ['LastHeroStandingVictory', combatWonByLastHeroStanding(combat)],
    ['RetaliationKillVictory', !!combat.heroRetaliationKill],
    ['GiantSlayerVictory', combatWonAgainstGiant(combat)],
    ['CursedRandomClearVictory', combatClearedRandomNodeCursed(combat)],
  ];
  return moments.filter(([, isMet]) => isMet).map(([moment]) => moment);
}
