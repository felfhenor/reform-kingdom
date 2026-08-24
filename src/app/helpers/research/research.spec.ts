import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/materials', () => ({
  applyMaterialDelta: vi.fn(),
  goldCoinId: vi.fn(() => 'gold-coin-id'),
}));

vi.mock('@helpers/research/research-content', () => ({
  researchPointItemId: vi.fn(() => 'insight-crystals-id'),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import { getEntry } from '@helpers/content';
import { applyMaterialDelta } from '@helpers/materials';
import {
  isResearchCompleted,
  isResearchPrerequisitesMet,
  activeResearchState,
  activeResearchContent,
  researchProgressFraction,
  researchForfeitActiveWithRefund,
  retrofitResearch,
  pruneInvalidDiscoveredResearch,
} from '@helpers/research/research';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  GameState,
  GameStateDiscoveredResearch,
  ItemId,
  ResearchContent,
  ResearchCost,
  ResearchId,
  ResearchState,
} from '@interfaces';

const RESEARCH_ID = 'research-1' as ResearchId;
const OTHER_RESEARCH_ID = 'research-2' as ResearchId;

const zeroCost: ResearchCost = { rp: 0, gold: 0, materials: [] };

const researchContent: ResearchContent = {
  id: RESEARCH_ID,
  name: 'Worn Paths',
  __type: 'research',
  description: 'Well-trodden roads shave time off every journey.',
  prerequisiteResearchIds: [],
  cost: zeroCost,
  researchTime: 100,
};

function mockGamestate(partial: {
  discoveredResearch?: GameStateDiscoveredResearch;
  research?: ResearchState;
}): void {
  vi.mocked(gamestate).mockReturnValue({
    discoveredResearch: partial.discoveredResearch ?? {},
    research: partial.research ?? {
      status: 'Idle',
      researchId: undefined,
      ticksIntoResearch: 0,
      costPaid: undefined,
    },
  } as unknown as GameState);
}

describe('research Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isResearchCompleted', () => {
    it('is true when the id has a discoveredResearch entry with foundAt', () => {
      mockGamestate({ discoveredResearch: { [RESEARCH_ID]: { foundAt: 123 } } });
      expect(isResearchCompleted(RESEARCH_ID)).toBe(true);
    });

    it('is false when the id has no discoveredResearch entry', () => {
      mockGamestate({ discoveredResearch: {} });
      expect(isResearchCompleted(RESEARCH_ID)).toBe(false);
    });
  });

  describe('isResearchPrerequisitesMet', () => {
    it('is vacuously true with no prerequisites', () => {
      mockGamestate({ discoveredResearch: {} });
      expect(isResearchPrerequisitesMet(researchContent)).toBe(true);
    });

    it('is true when every prerequisite is completed', () => {
      mockGamestate({
        discoveredResearch: { [OTHER_RESEARCH_ID]: { foundAt: 1 } },
      });
      expect(
        isResearchPrerequisitesMet({
          ...researchContent,
          prerequisiteResearchIds: [OTHER_RESEARCH_ID],
        }),
      ).toBe(true);
    });

    it('is false when any prerequisite is not completed', () => {
      mockGamestate({ discoveredResearch: {} });
      expect(
        isResearchPrerequisitesMet({
          ...researchContent,
          prerequisiteResearchIds: [OTHER_RESEARCH_ID],
        }),
      ).toBe(false);
    });
  });

  describe('activeResearchState', () => {
    it('returns gamestate().research', () => {
      const research: ResearchState = {
        status: 'Researching',
        researchId: RESEARCH_ID,
        ticksIntoResearch: 5,
        costPaid: zeroCost,
      };
      mockGamestate({ research });
      expect(activeResearchState()).toEqual(research);
    });
  });

  describe('activeResearchContent', () => {
    it('is undefined when nothing is active', () => {
      mockGamestate({});
      expect(activeResearchContent()).toBeUndefined();
    });

    it('resolves the active researchId via getEntry', () => {
      mockGamestate({
        research: {
          status: 'Researching',
          researchId: RESEARCH_ID,
          ticksIntoResearch: 0,
          costPaid: zeroCost,
        },
      });
      vi.mocked(getEntry).mockReturnValue(researchContent as never);

      expect(activeResearchContent()).toBe(researchContent);
      expect(getEntry).toHaveBeenCalledWith(RESEARCH_ID);
    });
  });

  describe('researchProgressFraction', () => {
    it('is 0 when nothing is active', () => {
      mockGamestate({});
      expect(researchProgressFraction()).toBe(0);
    });

    it('is 0 when the active content has a non-positive researchTime', () => {
      mockGamestate({
        research: {
          status: 'Researching',
          researchId: RESEARCH_ID,
          ticksIntoResearch: 10,
          costPaid: zeroCost,
        },
      });
      vi.mocked(getEntry).mockReturnValue({
        ...researchContent,
        researchTime: 0,
      } as never);

      expect(researchProgressFraction()).toBe(0);
    });

    it('computes ticksIntoResearch / researchTime', () => {
      mockGamestate({
        research: {
          status: 'Researching',
          researchId: RESEARCH_ID,
          ticksIntoResearch: 25,
          costPaid: zeroCost,
        },
      });
      vi.mocked(getEntry).mockReturnValue({
        ...researchContent,
        researchTime: 100,
      } as never);

      expect(researchProgressFraction()).toBe(0.25);
    });

    it('clamps at 1 even if ticksIntoResearch overshoots researchTime', () => {
      mockGamestate({
        research: {
          status: 'Researching',
          researchId: RESEARCH_ID,
          ticksIntoResearch: 999,
          costPaid: zeroCost,
        },
      });
      vi.mocked(getEntry).mockReturnValue({
        ...researchContent,
        researchTime: 100,
      } as never);

      expect(researchProgressFraction()).toBe(1);
    });
  });

  describe('researchForfeitActiveWithRefund', () => {
    it('resets to Idle without refunding when nothing was active', () => {
      mockGamestate({});

      researchForfeitActiveWithRefund();

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        research: {
          status: 'Idle',
          researchId: undefined,
          ticksIntoResearch: 0,
          costPaid: undefined,
        },
      } as unknown as GameState);

      expect(applyMaterialDelta).not.toHaveBeenCalled();
      expect(result.research).toEqual({
        status: 'Idle',
        researchId: undefined,
        ticksIntoResearch: 0,
        costPaid: undefined,
      });
    });

    it('refunds the costPaid snapshot and resets to Idle when a node was active', () => {
      const costPaid: ResearchCost = {
        rp: 15,
        gold: 500,
        materials: [{ itemId: 'wood-id' as ItemId, quantity: 3 }],
      };

      researchForfeitActiveWithRefund();

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        research: {
          status: 'Researching',
          researchId: RESEARCH_ID,
          ticksIntoResearch: 10,
          costPaid,
        },
      } as unknown as GameState);

      expect(applyMaterialDelta).toHaveBeenCalledWith(
        expect.anything(),
        'insight-crystals-id',
        15,
      );
      expect(applyMaterialDelta).toHaveBeenCalledWith(
        expect.anything(),
        'gold-coin-id',
        500,
      );
      expect(applyMaterialDelta).toHaveBeenCalledWith(
        expect.anything(),
        'wood-id',
        3,
      );
      expect(result.research).toEqual({
        status: 'Idle',
        researchId: undefined,
        ticksIntoResearch: 0,
        costPaid: undefined,
      });
    });
  });

  describe('retrofitResearch', () => {
    it('does nothing when nothing is Researching', () => {
      const state = {
        research: {
          status: 'Idle',
          researchId: undefined,
          ticksIntoResearch: 0,
          costPaid: undefined,
        },
      } as unknown as GameState;

      retrofitResearch(state);

      expect(state.research.status).toBe('Idle');
      expect(getEntry).not.toHaveBeenCalled();
    });

    it("refunds and resets to Idle when the active node's content was removed", () => {
      vi.mocked(getEntry).mockReturnValue(undefined as never);
      const costPaid: ResearchCost = { rp: 15, gold: 500, materials: [] };
      const state = {
        research: {
          status: 'Researching',
          researchId: RESEARCH_ID,
          ticksIntoResearch: 10,
          costPaid,
        },
      } as unknown as GameState;

      retrofitResearch(state);

      expect(applyMaterialDelta).toHaveBeenCalledWith(state, 'insight-crystals-id', 15);
      expect(applyMaterialDelta).toHaveBeenCalledWith(state, 'gold-coin-id', 500);
      expect(state.research).toEqual({
        status: 'Idle',
        researchId: undefined,
        ticksIntoResearch: 0,
        costPaid: undefined,
      });
    });

    it('clamps ticksIntoResearch down when researchTime shrank', () => {
      vi.mocked(getEntry).mockReturnValue({
        ...researchContent,
        researchTime: 50,
      } as never);
      const state = {
        research: {
          status: 'Researching',
          researchId: RESEARCH_ID,
          ticksIntoResearch: 90,
          costPaid: zeroCost,
        },
      } as unknown as GameState;

      retrofitResearch(state);

      expect(state.research.ticksIntoResearch).toBe(50);
      expect(applyMaterialDelta).not.toHaveBeenCalled();
    });

    it('leaves ticksIntoResearch untouched when it is still under researchTime', () => {
      vi.mocked(getEntry).mockReturnValue({
        ...researchContent,
        researchTime: 100,
      } as never);
      const state = {
        research: {
          status: 'Researching',
          researchId: RESEARCH_ID,
          ticksIntoResearch: 40,
          costPaid: zeroCost,
        },
      } as unknown as GameState;

      retrofitResearch(state);

      expect(state.research.ticksIntoResearch).toBe(40);
    });
  });

  describe('pruneInvalidDiscoveredResearch', () => {
    it('drops entries whose researchId no longer resolves to content', () => {
      vi.mocked(getEntry).mockImplementation(
        (id) => (id === RESEARCH_ID ? (researchContent as never) : undefined),
      );

      const discovered: GameStateDiscoveredResearch = {
        [RESEARCH_ID]: { foundAt: 1 },
        [OTHER_RESEARCH_ID]: { foundAt: 2 },
      };

      expect(pruneInvalidDiscoveredResearch(discovered)).toEqual({
        [RESEARCH_ID]: { foundAt: 1 },
      });
    });
  });
});
