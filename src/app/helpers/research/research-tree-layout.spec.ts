import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content', () => ({
  getEntriesByType: vi.fn(() => []),
  getEntry: vi.fn(),
}));

vi.mock('@helpers/research/research', () => ({
  activeResearchState: vi.fn(() => ({
    status: 'Idle',
    researchId: undefined,
    ticksIntoResearch: 0,
    costPaid: undefined,
  })),
  isResearchCompleted: vi.fn(() => false),
  isResearchPrerequisitesMet: vi.fn(() => true),
  researchProgressFraction: vi.fn(() => 0),
}));

vi.mock('@helpers/research/research-queue', () => ({
  researchCanAfford: vi.fn(() => false),
}));

import { getEntriesByType, getEntry } from '@helpers/content';
import {
  activeResearchState,
  isResearchCompleted,
  isResearchPrerequisitesMet,
  researchProgressFraction,
} from '@helpers/research/research';
import { researchCanAfford } from '@helpers/research/research-queue';
import {
  researchTreeLayout,
  researchTrees,
} from '@helpers/research/research-tree-layout';
import type {
  ResearchContent,
  ResearchId,
  ResearchTreeContent,
  ResearchTreeLayoutCell,
  ResearchTreeLayoutRowCell,
} from '@interfaces';

const NODE_A_ID = 'node-a' as ResearchId;
const NODE_B_ID = 'node-b' as ResearchId;
const DANGLING_ID = 'node-missing' as ResearchId;

// Every assertion below is on a cell already known (by test setup) to
// resolve to real content - this just narrows away the `| undefined` a
// blank/dangling slot can carry, rather than repeating a non-null assertion
// at every call site.
function resolvedCell(cell: ResearchTreeLayoutRowCell): ResearchTreeLayoutCell {
  if (!cell) throw new Error('Expected a resolved cell, got a blank slot.');
  return cell;
}

const nodeA: ResearchContent = {
  id: NODE_A_ID,
  name: 'Worn Paths',
  __type: 'research',
  description: 'Well-trodden roads shave time off every journey.',
  prerequisiteResearchIds: [],
  cost: { rp: 15, gold: 500, materials: [] },
  researchTime: 100,
};

const nodeB: ResearchContent = {
  ...nodeA,
  id: NODE_B_ID,
  name: 'Charted Roads',
  prerequisiteResearchIds: [NODE_A_ID],
};

const CONTENT_BY_ID: Record<string, ResearchContent> = {
  [NODE_A_ID]: nodeA,
  [NODE_B_ID]: nodeB,
};

const tree: ResearchTreeContent = {
  id: 'expedition-id' as never,
  name: 'Expedition',
  __type: 'researchtree',
  description: 'Faster roads and eyes on hidden corners of the map.',
  rows: [
    [{ researchId: NODE_A_ID }],
    [{ researchId: NODE_B_ID }, { researchId: DANGLING_ID }],
    [{ blank: true }, { researchId: NODE_B_ID }],
  ],
};

describe('research-tree-layout Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEntry).mockImplementation(
      (id) => CONTENT_BY_ID[id as string] as never,
    );
    vi.mocked(isResearchCompleted).mockReturnValue(false);
    vi.mocked(isResearchPrerequisitesMet).mockReturnValue(true);
    vi.mocked(researchCanAfford).mockReturnValue(false);
    vi.mocked(activeResearchState).mockReturnValue({
      status: 'Idle',
      researchId: undefined,
      ticksIntoResearch: 0,
      costPaid: undefined,
    });
  });

  describe('researchTrees', () => {
    it("delegates to getEntriesByType('researchtree')", () => {
      const trees = [tree];
      vi.mocked(getEntriesByType).mockReturnValue(trees);

      expect(researchTrees()).toBe(trees);
      expect(getEntriesByType).toHaveBeenCalledWith('researchtree');
    });
  });

  describe('researchTreeLayout', () => {
    it('resolves each row to its content, preserving column position', () => {
      const layout = researchTreeLayout(tree);

      expect(layout).toHaveLength(3);
      expect(layout[0]).toHaveLength(1);
      expect(resolvedCell(layout[0][0]).content).toBe(nodeA);
      expect(layout[1]).toHaveLength(2);
      expect(resolvedCell(layout[1][0]).content).toBe(nodeB);
    });

    it('resolves a dangling researchId reference to an undefined slot rather than dropping the row', () => {
      const layout = researchTreeLayout(tree);

      // Row 1's 2nd cell references DANGLING_ID, which getEntry can't resolve.
      expect(layout[1][1]).toBeUndefined();
    });

    it('resolves an authored { blank: true } cell to an undefined slot', () => {
      const layout = researchTreeLayout(tree);

      // Row 2's 1st cell is a blank placeholder authored to keep the 2nd
      // cell aligned under a specific column in a prior row.
      expect(layout[2][0]).toBeUndefined();
      expect(resolvedCell(layout[2][1]).content).toBe(nodeB);
    });

    it('marks a node Completed when isResearchCompleted is true', () => {
      vi.mocked(isResearchCompleted).mockImplementation((id) => id === NODE_A_ID);

      const layout = researchTreeLayout(tree);

      expect(resolvedCell(layout[0][0]).state).toBe('Completed');
    });

    it('marks a node Active when it matches the active research id', () => {
      vi.mocked(activeResearchState).mockReturnValue({
        status: 'Researching',
        researchId: NODE_A_ID,
        ticksIntoResearch: 40,
        costPaid: undefined,
      });
      vi.mocked(researchProgressFraction).mockReturnValue(0.4);

      const layout = researchTreeLayout(tree);

      expect(resolvedCell(layout[0][0]).state).toBe('Active');
      expect(resolvedCell(layout[0][0]).progressFraction).toBe(0.4);
    });

    it('marks a node Locked when its prerequisites are unmet', () => {
      vi.mocked(isResearchPrerequisitesMet).mockReturnValue(false);

      const layout = researchTreeLayout(tree);

      expect(resolvedCell(layout[0][0]).state).toBe('Locked');
    });

    it('marks a node Available when prerequisites are met but it is neither active nor completed', () => {
      const layout = researchTreeLayout(tree);

      expect(resolvedCell(layout[0][0]).state).toBe('Available');
    });

    it('only reports a nonzero progressFraction for the Active node', () => {
      const layout = researchTreeLayout(tree);

      expect(resolvedCell(layout[0][0]).progressFraction).toBe(0);
      expect(researchProgressFraction).not.toHaveBeenCalled();
    });

    it('reads affordability from researchCanAfford', () => {
      vi.mocked(researchCanAfford).mockReturnValue(true);

      const layout = researchTreeLayout(tree);

      expect(resolvedCell(layout[0][0]).affordable).toBe(true);
    });
  });
});
