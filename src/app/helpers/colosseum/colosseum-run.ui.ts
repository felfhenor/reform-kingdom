import { t } from '@helpers/i18n/i18n';
import { colosseumCreateFight } from '@helpers/colosseum/colosseum';
import {
  COLOSSEUM_LIVE_EVENT_SCOPE,
  COLOSSEUM_QUIET_EVENT_SCOPE,
  colosseumFightOutcome,
  colosseumPlayOut,
  colosseumRunOne,
} from '@helpers/colosseum/colosseum-run';
import { combatStep } from '@helpers/combat/combat';
import { combatEventScopeRun } from '@helpers/combat/combat-event-scope';
import { combatMessageLog } from '@helpers/combat/combat-log';
import { COLOSSEUM_BATCH_CHUNK_RUNS } from '@helpers/config';
import { schedulerYield } from '@helpers/engine/scheduler';
import { partyHpFromCombat } from '@helpers/hero/character-progress';
import {
  runStatsCombatBegin,
  runStatsCombatTake,
} from '@helpers/run-stats/run-stats-combat';
import type {
  Character,
  ColosseumFightOutcome,
  ColosseumRunResult,
  Combat,
  EncounterId,
} from '@interfaces';

const OUTCOME_MESSAGES: Record<ColosseumFightOutcome, string> = {
  Won: 'Heroes have won the combat!',
  Lost: 'The heroes have fallen.',
  Stalemate: 'Heroes were not able to finish the fight.',
};

export function colosseumLiveFight(
  party: Character[],
  encounterId: EncounterId,
  fightIndex: number,
  manual: boolean,
): Combat | undefined {
  const combat = colosseumCreateFight(party, encounterId, fightIndex, {
    manual,
    quiet: false,
  });
  if (combat) {
    combatMessageLog(
      combat,
      t('colosseumRun.encounteringMonsterGroup', {
        fightIndex: fightIndex + 1,
      }),
    );
  }
  return combat;
}

// One watched step on a fresh copy, so the scene sees a new fight object every time.
export function colosseumLiveStep(current: Combat): {
  combat: Combat;
  outcome?: ColosseumFightOutcome;
} {
  const combat = structuredClone(current);
  runStatsCombatBegin();
  const escaped = combatEventScopeRun(COLOSSEUM_LIVE_EVENT_SCOPE, () =>
    combatStep(combat),
  );
  // Drained so the next real round starts clean; a watched fight shows no stats.
  runStatsCombatTake();
  if (escaped) combatMessageLog(combat, t('colosseumRun.thePartyEscaped'));
  return { combat, outcome: escaped ? 'Lost' : colosseumFightOutcome(combat) };
}

// Skip to End: plays the rest silently in Auto.
export function colosseumLiveSkip(current: Combat): {
  combat: Combat;
  outcome: ColosseumFightOutcome;
} {
  const combat = structuredClone(current);
  const outcome = combatEventScopeRun(COLOSSEUM_QUIET_EVENT_SCOPE, () =>
    colosseumPlayOut(combat, {}),
  );
  return { combat, outcome };
}

export function colosseumLiveFinish(
  combat: Combat,
  outcome: ColosseumFightOutcome,
): void {
  combatMessageLog(combat, OUTCOME_MESSAGES[outcome]);
}

// The next fight of a whole-encounter run, with HP and EP carried over like a real encounter.
export function colosseumLiveNext(
  party: Character[],
  finished: Combat,
  nextIndex: number,
): { party: Character[]; combat?: Combat } {
  const carried = partyHpFromCombat(party, finished.heroes);
  const manual = !!finished.simulation?.manual;
  const encounterId = finished.encounterId;
  const combat = encounterId
    ? colosseumLiveFight(carried, encounterId, nextIndex, manual)
    : undefined;
  return { party: carried, combat };
}

export async function colosseumBatchRun(
  party: Character[],
  encounterId: EncounterId,
  fightIndex: number | undefined,
  count: number,
  onProgress: (results: ColosseumRunResult[]) => void,
  isCancelled: () => boolean,
): Promise<ColosseumRunResult[]> {
  const results: ColosseumRunResult[] = [];
  while (results.length < count && !isCancelled()) {
    const chunk = Math.min(COLOSSEUM_BATCH_CHUNK_RUNS, count - results.length);
    for (let i = 0; i < chunk; i++) {
      const result = colosseumRunOne(party, encounterId, fightIndex);
      if (!result) return results;
      results.push(result);
    }
    onProgress([...results]);
    await schedulerYield();
  }
  return results;
}
