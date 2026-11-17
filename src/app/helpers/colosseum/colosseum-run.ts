import { colosseumCreateFight } from '@helpers/colosseum/colosseum';
import { combatStep } from '@helpers/combat/combat';
import { didHeroesWin, isCombatOver } from '@helpers/combat/combat-end';
import { combatEventScopeRun } from '@helpers/combat/combat-event-scope';
import { COLOSSEUM_MAX_ROUNDS } from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { defaultHeroRunStats } from '@helpers/defaults';
import { partyHpFromCombat } from '@helpers/hero/character-progress';
import {
  runStatsCombatBegin,
  runStatsCombatTake,
  runStatsMergeHero,
} from '@helpers/run-stats/run-stats-combat';
import type {
  Character,
  CharacterId,
  ColosseumBatchSummary,
  ColosseumFightOutcome,
  ColosseumHeroAverages,
  ColosseumHeroStats,
  ColosseumRunResult,
  Combat,
  CombatEventScope,
  EncounterContent,
  EncounterId,
} from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

// Sim combatants keep their real ids, so their status-card events are keyed apart from the world's.
export const COLOSSEUM_LIVE_EVENT_SCOPE: CombatEventScope = {
  keyPrefix: 'colosseum:',
  muted: false,
};
export const COLOSSEUM_QUIET_EVENT_SCOPE: CombatEventScope = {
  keyPrefix: 'colosseum:',
  muted: true,
};

export function colosseumFightOutcome(
  combat: Combat,
): ColosseumFightOutcome | undefined {
  if (isCombatOver(combat)) return didHeroesWin(combat) ? 'Won' : 'Lost';
  return combat.rounds >= COLOSSEUM_MAX_ROUNDS ? 'Stalemate' : undefined;
}

export function colosseumAddStats(
  totals: ColosseumHeroStats,
  round: ColosseumHeroStats,
): void {
  (Object.keys(round) as CharacterId[]).forEach((id) => {
    const stats = round[id];
    if (stats) {
      totals[id] = runStatsMergeHero(
        totals[id] ?? defaultHeroRunStats(),
        stats,
      );
    }
  });
}

// Plays a private combat in place to its end in Auto, banking each step's hero stats into `totals`.
export function colosseumPlayOut(
  combat: Combat,
  totals: ColosseumHeroStats,
): ColosseumFightOutcome {
  // Skip to End plays the rest itself, so a Turn-based pick or a pending flee is dropped.
  if (combat.simulation) combat.simulation.manual = false;
  combat.manualFlee = undefined;
  combat.manualAction = undefined;
  let outcome = colosseumFightOutcome(combat);
  while (!outcome) {
    runStatsCombatBegin();
    combatStep(combat);
    colosseumAddStats(totals, runStatsCombatTake());
    outcome = colosseumFightOutcome(combat);
  }
  return outcome;
}

function colosseumRunFights(
  party: Character[],
  encounter: EncounterContent,
  fightIndexes: number[],
): ColosseumRunResult {
  const heroes: ColosseumHeroStats = {};
  let current = party;
  let rounds = 0;

  for (const index of fightIndexes) {
    const simulation = { manual: false, quiet: true };
    const combat = colosseumCreateFight(
      current,
      encounter.id,
      index,
      simulation,
    );
    if (!combat) continue;

    const outcome = colosseumPlayOut(combat, heroes);
    rounds += combat.rounds;
    if (outcome !== 'Won')
      return { outcome, rounds, fightIndex: index, heroes };
    current = partyHpFromCombat(current, combat.heroes);
  }

  const fightIndex = fightIndexes.at(-1) ?? 0;
  return { outcome: 'Won', rounds, fightIndex, heroes };
}

// One whole run, Auto and silent; HP and EP carry between an encounter's fights like a real one.
export function colosseumRunOne(
  party: Character[],
  encounterId: EncounterId,
  fightIndex?: number,
): ColosseumRunResult | undefined {
  const encounter = getEntry<EncounterContent>(encounterId);
  if (!encounter) return undefined;

  const indexes =
    fightIndex === undefined
      ? encounter.fights.map((_, index) => index)
      : [fightIndex];
  return combatEventScopeRun(COLOSSEUM_QUIET_EVENT_SCOPE, () =>
    colosseumRunFights(party, encounter, indexes),
  );
}

function colosseumAverage(
  results: ColosseumRunResult[],
  total: number,
): number {
  return results.length === 0 ? 0 : total / results.length;
}

function colosseumHeroAverages(
  results: ColosseumRunResult[],
  characterId: CharacterId,
): ColosseumHeroAverages {
  const average = (key: 'damageDealt' | 'healing' | 'kills' | 'deaths') =>
    colosseumAverage(
      results,
      sumBy(results, (result) => result.heroes[characterId]?.[key] ?? 0),
    );
  return {
    characterId,
    damageDealt: average('damageDealt'),
    healing: average('healing'),
    kills: average('kills'),
    deaths: average('deaths'),
  };
}

// Stalemates count as losses on the fight they stalled in.
function colosseumLossesByFight(
  results: ColosseumRunResult[],
  fightCount: number,
): number[] {
  return Array.from(
    { length: fightCount },
    (_, index) =>
      results.filter((r) => r.outcome !== 'Won' && r.fightIndex === index)
        .length,
  );
}

export function colosseumBatchSummarize(
  results: ColosseumRunResult[],
  fightCount: number,
  heroIds: CharacterId[],
): ColosseumBatchSummary {
  const wins = results.filter((result) => result.outcome === 'Won').length;
  const heroes = heroIds.map((id) => colosseumHeroAverages(results, id));
  return {
    runs: results.length,
    wins,
    stalemates: results.filter((r) => r.outcome === 'Stalemate').length,
    winRate: colosseumAverage(results, wins),
    averageRounds: colosseumAverage(
      results,
      sumBy(results, (r) => r.rounds),
    ),
    averageHeroDeaths: sumBy(heroes, (hero) => hero.deaths),
    lossesByFight: colosseumLossesByFight(results, fightCount),
    heroes,
  };
}
