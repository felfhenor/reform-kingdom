import type * as AnalyticsHelper from '@helpers/analytics';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof AnalyticsHelper>();
  return {
    ...actual,
    analyticsSendDesignEvent: vi.fn(),
  };
});

vi.mock('@helpers/combat-log', () => ({
  miscellaneousMessageLog: vi.fn(),
}));

vi.mock('@helpers/collectibles', () => ({
  isCollectibleDiscovered: vi.fn(() => false),
}));

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/materials', () => ({
  applyMaterialDelta: vi.fn(),
  getGoldQuantity: vi.fn(() => 0),
  getMaterialQuantity: vi.fn(() => 0),
  goldCoinId: vi.fn(() => 'gold-coin-id'),
}));

vi.mock('@helpers/notify', () => ({
  notifySuccess: vi.fn(),
}));

vi.mock('@helpers/research/research', () => ({
  isResearchCompleted: vi.fn(() => false),
  isResearchPrerequisitesMet: vi.fn(() => true),
  researchPointItemId: vi.fn(() => 'insight-crystals-id'),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import { analyticsSendDesignEvent } from '@helpers/analytics';
import { isCollectibleDiscovered } from '@helpers/collectibles';
import { miscellaneousMessageLog } from '@helpers/combat-log';
import { getEntry } from '@helpers/content';
import {
  applyMaterialDelta,
  getGoldQuantity,
  getMaterialQuantity,
} from '@helpers/materials';
import { notifySuccess } from '@helpers/notify';
import {
  isResearchCompleted,
  isResearchPrerequisitesMet,
} from '@helpers/research/research';
import {
  researchCanAfford,
  researchProcessTick,
  researchStartNode,
} from '@helpers/research/research-queue';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  CollectibleId,
  GameState,
  ItemId,
  ResearchContent,
  ResearchId,
} from '@interfaces';

const RESEARCH_ID = 'research-1' as ResearchId;
const COLLECTIBLE_ID = 'collectible-1' as CollectibleId;

const researchContent: ResearchContent = {
  id: RESEARCH_ID,
  name: 'Worn Paths',
  __type: 'research',
  description: 'Well-trodden roads shave time off every journey.',
  prerequisiteResearchIds: [],
  cost: { rp: 15, gold: 500, materials: [] },
  researchTime: 100,
};

describe('research-queue Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isResearchCompleted).mockReturnValue(false);
    vi.mocked(isResearchPrerequisitesMet).mockReturnValue(true);
    vi.mocked(isCollectibleDiscovered).mockReturnValue(false);
  });

  describe('researchCanAfford', () => {
    it('is false when RP is insufficient', () => {
      vi.mocked(getMaterialQuantity).mockReturnValue(0);
      vi.mocked(getGoldQuantity).mockReturnValue(500);

      expect(researchCanAfford(researchContent)).toBe(false);
    });

    it('is false when gold is insufficient', () => {
      vi.mocked(getMaterialQuantity).mockReturnValue(15);
      vi.mocked(getGoldQuantity).mockReturnValue(0);

      expect(researchCanAfford(researchContent)).toBe(false);
    });

    it('is false when a required material is insufficient', () => {
      vi.mocked(getMaterialQuantity).mockReturnValue(0);
      vi.mocked(getGoldQuantity).mockReturnValue(500);
      const content: ResearchContent = {
        ...researchContent,
        cost: {
          rp: 0,
          gold: 0,
          materials: [{ itemId: 'wood-id' as ItemId, quantity: 5 }],
        },
      };

      expect(researchCanAfford(content)).toBe(false);
    });

    it('is false when a required collectible is not discovered', () => {
      vi.mocked(getMaterialQuantity).mockReturnValue(15);
      vi.mocked(getGoldQuantity).mockReturnValue(500);
      vi.mocked(isCollectibleDiscovered).mockReturnValue(false);
      const content: ResearchContent = {
        ...researchContent,
        cost: { ...researchContent.cost, collectibleId: COLLECTIBLE_ID },
      };

      expect(researchCanAfford(content)).toBe(false);
    });

    it('is true when RP, gold, materials, and the collectible gate are all satisfied', () => {
      vi.mocked(getMaterialQuantity).mockReturnValue(15);
      vi.mocked(getGoldQuantity).mockReturnValue(500);
      vi.mocked(isCollectibleDiscovered).mockReturnValue(true);
      const content: ResearchContent = {
        ...researchContent,
        cost: { ...researchContent.cost, collectibleId: COLLECTIBLE_ID },
      };

      expect(researchCanAfford(content)).toBe(true);
    });
  });

  describe('researchStartNode', () => {
    beforeEach(() => {
      vi.mocked(getEntry).mockReturnValue(researchContent as never);
      vi.mocked(getMaterialQuantity).mockReturnValue(15);
      vi.mocked(getGoldQuantity).mockReturnValue(500);
    });

    it('returns false when the content does not resolve', () => {
      vi.mocked(getEntry).mockReturnValue(undefined as never);

      expect(researchStartNode(RESEARCH_ID)).toBe(false);
      expect(updateGamestate).not.toHaveBeenCalled();
    });

    it('returns false when already completed', () => {
      vi.mocked(isResearchCompleted).mockReturnValue(true);

      expect(researchStartNode(RESEARCH_ID)).toBe(false);
      expect(updateGamestate).not.toHaveBeenCalled();
    });

    it('returns false when prerequisites are not met', () => {
      vi.mocked(isResearchPrerequisitesMet).mockReturnValue(false);

      expect(researchStartNode(RESEARCH_ID)).toBe(false);
      expect(updateGamestate).not.toHaveBeenCalled();
    });

    it('returns false when the node cannot be afforded', () => {
      vi.mocked(getMaterialQuantity).mockReturnValue(0);

      expect(researchStartNode(RESEARCH_ID)).toBe(false);
      expect(updateGamestate).not.toHaveBeenCalled();
    });

    it('spends the RP/gold/material cost, sets the active research state, and returns true', () => {
      const contentWithMaterials: ResearchContent = {
        ...researchContent,
        cost: {
          ...researchContent.cost,
          materials: [{ itemId: 'wood-id' as ItemId, quantity: 3 }],
        },
      };
      vi.mocked(getEntry).mockReturnValue(contentWithMaterials as never);

      expect(researchStartNode(RESEARCH_ID)).toBe(true);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        materials: {},
        research: {
          status: 'Idle',
          researchId: undefined,
          ticksIntoResearch: 0,
          costPaid: undefined,
        },
      } as unknown as GameState);

      expect(applyMaterialDelta).toHaveBeenCalledWith(
        expect.anything(),
        'insight-crystals-id',
        -15,
      );
      expect(applyMaterialDelta).toHaveBeenCalledWith(
        expect.anything(),
        'gold-coin-id',
        -500,
      );
      expect(applyMaterialDelta).toHaveBeenCalledWith(
        expect.anything(),
        'wood-id',
        -3,
      );
      expect(result.research).toEqual({
        status: 'Researching',
        researchId: RESEARCH_ID,
        ticksIntoResearch: 0,
        costPaid: contentWithMaterials.cost,
      });
      expect(analyticsSendDesignEvent).toHaveBeenCalledWith(
        'Kingdom:Research:Start:Worn Paths',
      );
    });
  });

  describe('researchProcessTick', () => {
    it('does nothing when research is Idle', () => {
      vi.mocked(gamestate).mockReturnValue({
        research: {
          status: 'Idle',
          researchId: undefined,
          ticksIntoResearch: 0,
          costPaid: undefined,
        },
      } as unknown as GameState);

      researchProcessTick();

      expect(updateGamestate).not.toHaveBeenCalled();
    });

    it("does nothing when the active node's content no longer resolves", () => {
      vi.mocked(gamestate).mockReturnValue({
        research: {
          status: 'Researching',
          researchId: RESEARCH_ID,
          ticksIntoResearch: 0,
          costPaid: researchContent.cost,
        },
      } as unknown as GameState);
      vi.mocked(getEntry).mockReturnValue(undefined as never);

      researchProcessTick();

      expect(updateGamestate).not.toHaveBeenCalled();
    });

    it('increments ticksIntoResearch when researchTime has not been reached', () => {
      vi.mocked(gamestate).mockReturnValue({
        research: {
          status: 'Researching',
          researchId: RESEARCH_ID,
          ticksIntoResearch: 10,
          costPaid: researchContent.cost,
        },
      } as unknown as GameState);
      vi.mocked(getEntry).mockReturnValue(researchContent as never);

      researchProcessTick();

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        research: {
          status: 'Researching',
          researchId: RESEARCH_ID,
          ticksIntoResearch: 10,
          costPaid: researchContent.cost,
        },
      } as unknown as GameState);

      expect(result.research.ticksIntoResearch).toBe(11);
      expect(result.research.status).toBe('Researching');
    });

    it('completes the node, marks it discovered, and resets to Idle once researchTime is reached', () => {
      vi.mocked(gamestate).mockReturnValue({
        research: {
          status: 'Researching',
          researchId: RESEARCH_ID,
          ticksIntoResearch: 99,
          costPaid: researchContent.cost,
        },
      } as unknown as GameState);
      vi.mocked(getEntry).mockReturnValue(researchContent as never);

      researchProcessTick();

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        discoveredResearch: {},
        research: {
          status: 'Researching',
          researchId: RESEARCH_ID,
          ticksIntoResearch: 99,
          costPaid: researchContent.cost,
        },
      } as unknown as GameState);

      expect(result.discoveredResearch[RESEARCH_ID].foundAt).toBeTypeOf('number');
      expect(result.research).toEqual({
        status: 'Idle',
        researchId: undefined,
        ticksIntoResearch: 0,
        costPaid: undefined,
      });
      expect(notifySuccess).toHaveBeenCalledWith(
        'Research complete: Worn Paths',
      );
      expect(miscellaneousMessageLog).toHaveBeenCalledWith(
        'Research complete: **Worn Paths**.',
      );
      expect(analyticsSendDesignEvent).toHaveBeenCalledWith(
        'Kingdom:Research:Complete:Worn Paths',
      );
    });
  });
});
