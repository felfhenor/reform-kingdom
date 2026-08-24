import { getEntriesByType, getEntry } from '@helpers/content';
import {
  activeResearchState,
  isResearchCompleted,
  isResearchPrerequisitesMet,
  researchProgressFraction,
} from '@helpers/research/research';
import { researchCanAfford } from '@helpers/research/research-queue';
import type {
  ResearchContent,
  ResearchNodeState,
  ResearchTreeContent,
  ResearchTreeLayoutRowCell,
} from '@interfaces';

export function researchTrees(): ResearchTreeContent[] {
  return getEntriesByType<ResearchTreeContent>('researchtree');
}

function researchNodeState(content: ResearchContent): ResearchNodeState {
  if (isResearchCompleted(content.id)) return 'Completed';
  if (activeResearchState().researchId === content.id) return 'Active';
  if (!isResearchPrerequisitesMet(content)) return 'Locked';
  return 'Available';
}

// Just resolves each authored cell to its content + joined live state for
// rendering - no depth/graph computation, since row/column are already
// positional in the authored ResearchTreeContent data (see the plan's
// "Tree placement is hand-authored" note). A `{ blank: true }` cell, and a
// missing/dangling researchId reference, both resolve to `undefined` rather
// than being dropped from the row - preserving column position is the
// whole point of a blank cell (see ResearchTreeLayoutRowCell), and a
// dangling reference rendering as an empty slot is a reasonable fallback
// (the researchtreeplacement validator is what actually catches it as a
// content bug).
export function researchTreeLayout(
  tree: ResearchTreeContent,
): ResearchTreeLayoutRowCell[][] {
  return tree.rows.map((row) =>
    row.map((cell): ResearchTreeLayoutRowCell => {
      if ('blank' in cell) return undefined;

      const content = getEntry<ResearchContent>(cell.researchId);
      if (!content) return undefined;

      const state = researchNodeState(content);
      return {
        content,
        state,
        affordable: researchCanAfford(content),
        progressFraction: state === 'Active' ? researchProgressFraction() : 0,
      };
    }),
  );
}
