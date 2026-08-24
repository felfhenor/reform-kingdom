/**
 * Validates that every research node is actually affordable (enough RP is
 * obtainable in the game to reach it), that the prerequisite graph has no
 * cycles or dangling references, and that firstTimeRewards entries follow
 * the RP-only/chance:100 authoring conventions. Ported from
 * `scripts/validate-researchrpgaps.ts`.
 */

import { getEntriesByType } from '@helpers/content';
import { rangeAtLevel } from '@helpers/leveled-range';
import { researchPointItemId } from '@helpers/research/research-content';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  DroppedReward,
  EncounterContent,
  EncounterRandomContent,
  GatheringContent,
  LevelRange,
  ResearchContent,
  ResearchId,
} from '@interfaces';

type FirstTimeRewardNode = { firstTimeRewards?: DroppedReward[]; levelRange: LevelRange };

function checkFirstTimeReward(
  reward: DroppedReward,
  index: number,
  node: FirstTimeRewardNode,
  rpItemId: ReturnType<typeof researchPointItemId>,
): { check?: AnalysisCheck; rp: number } {
  const id = `researchrpgaps:firstTimeReward:${index}`;

  if (!('itemId' in reward) || reward.itemId !== rpItemId) {
    return {
      check: {
        id,
        label: 'firstTimeRewards',
        status: 'fail',
        message:
          'A firstTimeRewards entry is not an Insight Crystal item reward - this field is RP-only by convention.',
      },
      rp: 0,
    };
  }

  const rp = rangeAtLevel(reward, node.levelRange.max).max;

  if (reward.chance !== 100) {
    return {
      check: {
        id,
        label: 'firstTimeRewards',
        status: 'warning',
        message:
          "An Insight Crystal firstTimeRewards entry has chance < 100 - a whiffed roll silently forfeits that node's RP forever (the ledger marks granted on attempt, not success).",
      },
      rp,
    };
  }

  return { rp };
}

function totalRpEverObtainable(): {
  total: number;
  checks: AnalysisCheck[];
} {
  const rpItemId = researchPointItemId();
  const checks: AnalysisCheck[] = [];
  let total = 0;

  const nodes: FirstTimeRewardNode[] = [
    ...getEntriesByType<EncounterContent>('encounter'),
    ...getEntriesByType<GatheringContent>('gathering'),
    ...getEntriesByType<EncounterRandomContent>('encounterrandom'),
  ];

  nodes.forEach((node) => {
    (node.firstTimeRewards ?? []).forEach((reward, index) => {
      const { check, rp } = checkFirstTimeReward(reward, index, node, rpItemId);
      if (check) checks.push(check);
      total += rp;
    });
  });

  return { total, checks };
}

// Sums `cost.rp` once per unique ancestor via a visited-id walk - a naive
// recursive sum would double-count a prerequisite shared by more than one
// path (a diamond), since it's paid once by the player but would be summed
// once per downstream branch.
function cumulativeRpCost(
  content: ResearchContent,
  byId: Map<ResearchId, ResearchContent>,
): { total: number; cycle: boolean; dangling: boolean } {
  const visited = new Set<ResearchId>();
  let cycle = false;
  let dangling = false;
  let total = 0;

  const visit = (node: ResearchContent, path: Set<ResearchId>): void => {
    if (path.has(node.id)) {
      cycle = true;
      return;
    }
    if (visited.has(node.id)) return;

    visited.add(node.id);
    total += node.cost.rp;

    const nextPath = new Set(path).add(node.id);
    node.prerequisiteResearchIds.forEach((prereqId) => {
      const prereq = byId.get(prereqId);
      if (!prereq) {
        dangling = true;
        return;
      }
      visit(prereq, nextPath);
    });
  };

  visit(content, new Set());
  return { total, cycle, dangling };
}

export function runResearchRpGapsAnalysis(): AnalysisRunResult {
  const researchNodes = getEntriesByType<ResearchContent>('research');
  const byId = new Map(researchNodes.map((n) => [n.id, n]));
  const { total: totalRp, checks: rewardChecks } = totalRpEverObtainable();

  const nodeChecks: AnalysisCheck[] = researchNodes.map((node) => {
    const id = `researchrpgaps:${node.id}`;
    const { total, cycle, dangling } = cumulativeRpCost(node, byId);

    if (cycle) {
      return {
        id,
        label: node.name,
        status: 'fail',
        message: `"${node.name}" has a prerequisite cycle - it can never be started.`,
      };
    }
    if (dangling) {
      return {
        id,
        label: node.name,
        status: 'fail',
        message: `"${node.name}" has a prerequisiteResearchIds entry that doesn't resolve to a real research node.`,
      };
    }
    if (total > totalRp) {
      return {
        id,
        label: node.name,
        status: 'fail',
        message: `"${node.name}" needs ${total} RP cumulatively (including prerequisites), but only ${totalRp} RP is obtainable in the game.`,
      };
    }

    return {
      id,
      label: node.name,
      status: 'pass',
      message: `"${node.name}" is reachable with ${total}/${totalRp} RP obtainable.`,
    };
  });

  const checks = [...rewardChecks, ...nodeChecks];
  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? `Every research node is reachable within ${totalRp} total obtainable RP.`
        : `${failures} problem(s) found.`,
  };
}
