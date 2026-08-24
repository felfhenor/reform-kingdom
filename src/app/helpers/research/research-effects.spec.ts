import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/research/research', () => ({
  isResearchCompleted: vi.fn(() => false),
  researchEntries: vi.fn(() => []),
}));

import {
  isResearchCompleted,
  researchEntries,
} from '@helpers/research/research';
import {
  researchArmorySellValueIncreasePercent,
  researchAstralSpellDurationIncreasePercent,
  researchCaravanPriceReductionPercent,
  researchCraftBonusXp,
  researchGatherBonusQuantityChance,
  researchMonsterBonusGoldChance,
  researchMonsterLootBonusQuantity,
  researchPostWipeHealTimeReductionPercent,
  researchTravelTimeReductionPercent,
} from '@helpers/research/research-effects';
import type { ResearchContent, ResearchId } from '@interfaces';

function nodeWithEffect(
  id: string,
  effect: ResearchContent['effect'],
): ResearchContent {
  return {
    id: id as ResearchId,
    name: id,
    __type: 'research',
    description: 'test node',
    prerequisiteResearchIds: [],
    cost: { rp: 0, gold: 0, materials: [] },
    researchTime: 1,
    effect,
  };
}

// Every test marks exactly these ids completed via `completedIds`, so a node
// left out of that set exercises the "only sum completed research" gating
// shared by every query below.
function setCompleted(...ids: string[]): void {
  const completed = new Set(ids);
  vi.mocked(isResearchCompleted).mockImplementation((id) =>
    completed.has(id as string),
  );
}

describe('research-effects Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ignores research with no effect payload at all', () => {
    vi.mocked(researchEntries).mockReturnValue([
      nodeWithEffect('astral-reach-i', undefined),
    ]);
    setCompleted('astral-reach-i');

    expect(researchTravelTimeReductionPercent()).toBe(0);
  });

  it('excludes an effect from a node that is not yet completed', () => {
    vi.mocked(researchEntries).mockReturnValue([
      nodeWithEffect('worn-paths', { type: 'TravelTimeReduction', percent: 5 }),
    ]);
    setCompleted(); // nothing completed

    expect(researchTravelTimeReductionPercent()).toBe(0);
  });

  it('sums a single-field percent effect across multiple completed nodes', () => {
    vi.mocked(researchEntries).mockReturnValue([
      nodeWithEffect('worn-paths', { type: 'TravelTimeReduction', percent: 5 }),
      nodeWithEffect('charted-roads', { type: 'TravelTimeReduction', percent: 5 }),
      // A different effect type on a completed node must not leak in.
      nodeWithEffect('fair-trade', { type: 'ArmorySellValueIncrease', percent: 5 }),
    ]);
    setCompleted('worn-paths', 'charted-roads', 'fair-trade');

    expect(researchTravelTimeReductionPercent()).toBe(10);
  });

  it('sums CaravanPriceReduction', () => {
    vi.mocked(researchEntries).mockReturnValue([
      nodeWithEffect('contracts-i', { type: 'CaravanPriceReduction', percent: 5 }),
      nodeWithEffect('contracts-ii', { type: 'CaravanPriceReduction', percent: 5 }),
    ]);
    setCompleted('contracts-i', 'contracts-ii');

    expect(researchCaravanPriceReductionPercent()).toBe(10);
  });

  it('sums AstralSpellDurationIncrease', () => {
    vi.mocked(researchEntries).mockReturnValue([
      nodeWithEffect('amplify-i', { type: 'AstralSpellDurationIncrease', percent: 15 }),
      nodeWithEffect('amplify-ii', { type: 'AstralSpellDurationIncrease', percent: 15 }),
    ]);
    setCompleted('amplify-i', 'amplify-ii');

    expect(researchAstralSpellDurationIncreasePercent()).toBe(30);
  });

  it('sums ArmorySellValueIncrease', () => {
    vi.mocked(researchEntries).mockReturnValue([
      nodeWithEffect('fair-trade', { type: 'ArmorySellValueIncrease', percent: 5 }),
    ]);
    setCompleted('fair-trade');

    expect(researchArmorySellValueIncreasePercent()).toBe(5);
  });

  it('sums PostWipeHealTimeReduction', () => {
    vi.mocked(researchEntries).mockReturnValue([
      nodeWithEffect('swift-recovery', {
        type: 'PostWipeHealTimeReduction',
        percent: 15,
      }),
    ]);
    setCompleted('swift-recovery');

    expect(researchPostWipeHealTimeReductionPercent()).toBe(15);
  });

  it('sums MonsterLootBonusQuantity', () => {
    vi.mocked(researchEntries).mockReturnValue([
      nodeWithEffect('trophy-hunter', {
        type: 'MonsterLootBonusQuantity',
        bonusQuantity: 1,
      }),
    ]);
    setCompleted('trophy-hunter');

    expect(researchMonsterLootBonusQuantity()).toBe(1);
  });

  it('sums both fields of GatherBonusQuantityChance independently', () => {
    vi.mocked(researchEntries).mockReturnValue([
      nodeWithEffect('steady-hands', {
        type: 'GatherBonusQuantityChance',
        chance: 5,
        bonusQuantity: 1,
      }),
    ]);
    setCompleted('steady-hands');

    expect(researchGatherBonusQuantityChance()).toEqual({
      chance: 5,
      bonusQuantity: 1,
    });
  });

  it('sums both fields of MonsterBonusGoldChance independently', () => {
    vi.mocked(researchEntries).mockReturnValue([
      nodeWithEffect('looters', {
        type: 'MonsterBonusGoldChance',
        chance: 5,
        bonusGold: 10,
      }),
    ]);
    setCompleted('looters');

    expect(researchMonsterBonusGoldChance()).toEqual({ chance: 5, bonusGold: 10 });
  });

  describe('researchCraftBonusXp', () => {
    it('returns zeroes when no craft-xp research is completed', () => {
      vi.mocked(researchEntries).mockReturnValue([]);
      setCompleted();

      expect(researchCraftBonusXp()).toEqual({ chance: 0, bonusXp: 0 });
    });

    it('reports the base CraftBonusXpChance alone when no Increase nodes are completed', () => {
      vi.mocked(researchEntries).mockReturnValue([
        nodeWithEffect('keen-eye', {
          type: 'CraftBonusXpChance',
          chance: 5,
          bonusXp: 1,
        }),
      ]);
      setCompleted('keen-eye');

      expect(researchCraftBonusXp()).toEqual({ chance: 5, bonusXp: 1 });
    });

    it('adds ChanceIncrease/AmountIncrease from separate nodes on top of the base, without mutating it', () => {
      vi.mocked(researchEntries).mockReturnValue([
        nodeWithEffect('keen-eye', {
          type: 'CraftBonusXpChance',
          chance: 5,
          bonusXp: 1,
        }),
        nodeWithEffect('sharper-eye', {
          type: 'CraftBonusXpChanceIncrease',
          chance: 5,
        }),
        nodeWithEffect('deeper-insight', {
          type: 'CraftBonusXpAmountIncrease',
          bonusXp: 1,
        }),
      ]);
      setCompleted('keen-eye', 'sharper-eye', 'deeper-insight');

      expect(researchCraftBonusXp()).toEqual({ chance: 10, bonusXp: 2 });
    });

    it("sums an Increase node's own contribution even when the base Chance node is not completed (they're independent sums, not a mutation of the base)", () => {
      vi.mocked(researchEntries).mockReturnValue([
        nodeWithEffect('keen-eye', {
          type: 'CraftBonusXpChance',
          chance: 5,
          bonusXp: 1,
        }),
        nodeWithEffect('sharper-eye', {
          type: 'CraftBonusXpChanceIncrease',
          chance: 5,
        }),
      ]);
      setCompleted('sharper-eye'); // keen-eye not completed

      expect(researchCraftBonusXp()).toEqual({ chance: 5, bonusXp: 0 });
    });
  });
});
