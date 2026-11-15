import { combatWonInAmbushRound } from '@helpers/combat/combat-ambush';
import {
  combatantHealthPercent,
  combatantIsDead,
} from '@helpers/combat/combat-combatant-hp';
import { ACHIEVEMENT_LAST_HERO_STANDING_HP_PERCENT } from '@helpers/config';
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

export function combatVictoryMoments(combat: Combat): AchievementMoment[] {
  const moments: [AchievementMoment, boolean][] = [
    ['AmbushVictory', combatWonInAmbushRound(combat)],
    ['CoverDeathVictory', !!combat.heroDiedCovering],
    ['LastHeroStandingVictory', combatWonByLastHeroStanding(combat)],
  ];
  return moments.filter(([, isMet]) => isMet).map(([moment]) => moment);
}
