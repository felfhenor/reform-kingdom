/**
 * Reads live gamestate() - browser/`/debug`-dashboard only, no CLI wrapper
 * (see AnalysisScriptDefinition.usesGamestate). Reports the player's current
 * Insight Crystal balance against remaining research costs (informational),
 * and separately verifies the ledger consistency invariant
 * `balance + spentOnResearch === sum(ledger.rpGranted)` (a genuine bug
 * signal, not a curiosity stat - see "Migration and desync recovery" in the
 * research tree plan).
 */

import { getEntriesByType } from '@helpers/content';
import { getMaterialQuantity } from '@helpers/materials';
import { isResearchCompleted, researchPointItemId } from '@helpers/research/research';
import { gamestate } from '@helpers/state-game';
import type { AnalysisCheck, AnalysisRunResult, ResearchContent } from '@interfaces';
import { minBy, sumBy } from 'es-toolkit/compat';

function totalRpSpentOnResearch(researchNodes: ResearchContent[]): number {
  const completedSpend = sumBy(
    researchNodes.filter((n) => isResearchCompleted(n.id)),
    (n) => n.cost.rp,
  );

  const research = gamestate().research;
  const activeSpend = research.status === 'Researching' ? research.costPaid?.rp ?? 0 : 0;

  return completedSpend + activeSpend;
}

function consistencyCheck(
  balance: number,
  researchNodes: ResearchContent[],
): AnalysisCheck {
  const granted = gamestate().firstTimeNodeRewardsGranted;
  const ledgerSum = sumBy(Object.values(granted), (entry) => entry.rpGranted);
  const spent = totalRpSpentOnResearch(researchNodes);
  const expected = balance + spent;

  if (expected === ledgerSum) {
    return {
      id: 'researchunspentrp:consistency',
      label: 'Ledger consistency',
      status: 'pass',
      message: `Balance (${balance}) + spent (${spent}) matches the ledger total (${ledgerSum}).`,
    };
  }

  return {
    id: 'researchunspentrp:consistency',
    label: 'Ledger consistency',
    status: 'fail',
    message: `Balance (${balance}) + spent (${spent}) = ${expected}, but the firstTimeNodeRewardsGranted ledger totals ${ledgerSum} - RP desynced somewhere outside the normal spend/grant/reconcile paths.`,
  };
}

export function runResearchUnspentRpAnalysis(): AnalysisRunResult {
  const researchNodes = getEntriesByType<ResearchContent>('research');
  const balance = getMaterialQuantity(researchPointItemId());
  const remaining = researchNodes.filter((n) => !isResearchCompleted(n.id));

  const checks: AnalysisCheck[] = [consistencyCheck(balance, researchNodes)];

  if (remaining.length > 0) {
    const cheapest = minBy(remaining, (n) => n.cost.rp);
    checks.push({
      id: 'researchunspentrp:balance',
      label: 'Unspent Insight Crystal',
      status: 'info',
      message: `${balance} RP on hand. Cheapest remaining node ("${cheapest?.name}") costs ${cheapest?.cost.rp}.`,
    });
  } else {
    checks.push({
      id: 'researchunspentrp:balance',
      label: 'Unspent Insight Crystal',
      status: 'info',
      message: `${balance} RP on hand. Every research node is already completed.`,
    });
  }

  return {
    checks,
    summary: `${balance} RP unspent; ${remaining.length} node(s) remaining.`,
  };
}
