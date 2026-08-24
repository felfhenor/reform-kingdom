/**
 * Validates that every research node is placed in exactly one
 * ResearchTreeContent cell, every placed cell resolves to a real research
 * node, and a node's row is always strictly below every one of its
 * prerequisites' rows. Ported from
 * `scripts/validate-researchtreeplacement.ts`.
 */

import { getEntriesByType } from '@helpers/content';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  ResearchContent,
  ResearchId,
  ResearchTreeContent,
} from '@interfaces';

type Placement = { treeName: string; row: number };

function buildPlacementIndex(
  trees: ResearchTreeContent[],
): Map<ResearchId, Placement[]> {
  const index = new Map<ResearchId, Placement[]>();

  trees.forEach((tree) => {
    tree.rows.forEach((row, rowIndex) => {
      row.forEach((cell) => {
        if ('blank' in cell) return;

        const placements = index.get(cell.researchId) ?? [];
        placements.push({ treeName: tree.name, row: rowIndex });
        index.set(cell.researchId, placements);
      });
    });
  });

  return index;
}

function checkDanglingCells(
  trees: ResearchTreeContent[],
  byId: Map<ResearchId, ResearchContent>,
): AnalysisCheck[] {
  const checks: AnalysisCheck[] = [];

  trees.forEach((tree) => {
    tree.rows.forEach((row, rowIndex) => {
      row.forEach((cell) => {
        if ('blank' in cell) return;
        if (byId.has(cell.researchId)) return;

        checks.push({
          id: `researchtreeplacement:dangling:${tree.name}:${rowIndex}:${cell.researchId}`,
          label: tree.name,
          status: 'fail',
          message: `Tree "${tree.name}" row ${rowIndex + 1} references research id "${cell.researchId}", which doesn't resolve to a real research node.`,
        });
      });
    });
  });

  return checks;
}

function checkPlacementCounts(
  researchNodes: ResearchContent[],
  placementIndex: Map<ResearchId, Placement[]>,
): AnalysisCheck[] {
  return researchNodes.map((node) => {
    const placements = placementIndex.get(node.id) ?? [];
    const id = `researchtreeplacement:count:${node.id}`;

    if (placements.length === 0) {
      return {
        id,
        label: node.name,
        status: 'fail',
        message: `"${node.name}" isn't placed in any research tree - it's authored content but won't render anywhere.`,
      };
    }
    if (placements.length > 1) {
      return {
        id,
        label: node.name,
        status: 'fail',
        message: `"${node.name}" is placed in ${placements.length} cells across the research trees - it should appear exactly once.`,
      };
    }

    return {
      id,
      label: node.name,
      status: 'pass',
      message: `"${node.name}" is placed exactly once.`,
    };
  });
}

// A node's row should be strictly greater than every one of its
// prerequisites' rows - otherwise the tree visually draws a prerequisite
// below or beside the node that needs it, which reads wrong even though
// it's mechanically valid.
function checkRowOrdering(
  researchNodes: ResearchContent[],
  byId: Map<ResearchId, ResearchContent>,
  placementIndex: Map<ResearchId, Placement[]>,
): AnalysisCheck[] {
  const checks: AnalysisCheck[] = [];

  researchNodes.forEach((node) => {
    const [placement] = placementIndex.get(node.id) ?? [];
    if (!placement) return; // already flagged by checkPlacementCounts

    node.prerequisiteResearchIds.forEach((prereqId) => {
      const prereq = byId.get(prereqId);
      const [prereqPlacement] = placementIndex.get(prereqId) ?? [];
      if (!prereq || !prereqPlacement) return; // dangling ref, flagged elsewhere

      if (prereqPlacement.row >= placement.row) {
        checks.push({
          id: `researchtreeplacement:rowOrder:${node.id}:${prereqId}`,
          label: node.name,
          status: 'fail',
          message: `"${node.name}" (row ${placement.row + 1}) requires "${prereq.name}" (row ${prereqPlacement.row + 1}), which isn't strictly above it.`,
        });
      }
    });
  });

  return checks;
}

export function runResearchTreePlacementAnalysis(): AnalysisRunResult {
  const researchNodes = getEntriesByType<ResearchContent>('research');
  const trees = getEntriesByType<ResearchTreeContent>('researchtree');
  const byId = new Map(researchNodes.map((n) => [n.id, n]));
  const placementIndex = buildPlacementIndex(trees);

  const checks = [
    ...checkDanglingCells(trees, byId),
    ...checkPlacementCounts(researchNodes, placementIndex),
    ...checkRowOrdering(researchNodes, byId, placementIndex),
  ];

  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? 'Every research node is placed exactly once, with no dangling references or row-ordering violations.'
        : `${failures} problem(s) found.`,
  };
}
