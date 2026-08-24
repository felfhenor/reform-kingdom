import { describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

import { getEntry } from '@helpers/content';
import { researchEffectDescription } from '@helpers/research/research-effect-description';
import type { ItemId, ResearchEffect } from '@interfaces';

// Identity formatter - number formatting itself is Angular's job (the
// component injects LOCALE_ID and passes formatNumber); this helper only
// needs to prove it calls formatValue with the right values, in the right
// place in the string.
const identity = (value: number) => String(value);

describe('researchEffectDescription', () => {
  it('describes TravelTimeReduction', () => {
    const effect: ResearchEffect = { type: 'TravelTimeReduction', percent: 5 };
    expect(researchEffectDescription(effect, identity)).toBe(
      '5% reduced travel time.',
    );
  });

  it('describes CaravanPriceReduction', () => {
    const effect: ResearchEffect = { type: 'CaravanPriceReduction', percent: 5 };
    expect(researchEffectDescription(effect, identity)).toBe(
      '5% lower prices when buying from caravans.',
    );
  });

  it('describes AstralSpellDurationIncrease', () => {
    const effect: ResearchEffect = {
      type: 'AstralSpellDurationIncrease',
      percent: 15,
    };
    expect(researchEffectDescription(effect, identity)).toBe(
      '15% longer Astral Projector spell duration.',
    );
  });

  it('describes ArmorySellValueIncrease', () => {
    const effect: ResearchEffect = { type: 'ArmorySellValueIncrease', percent: 5 };
    expect(researchEffectDescription(effect, identity)).toBe(
      '5% higher Armory sell values.',
    );
  });

  it('describes PostWipeHealTimeReduction', () => {
    const effect: ResearchEffect = {
      type: 'PostWipeHealTimeReduction',
      percent: 15,
    };
    expect(researchEffectDescription(effect, identity)).toBe(
      '15% faster recovery after a wipe.',
    );
  });

  it('describes MonsterLootBonusQuantity', () => {
    const effect: ResearchEffect = {
      type: 'MonsterLootBonusQuantity',
      bonusQuantity: 1,
    };
    expect(researchEffectDescription(effect, identity)).toBe(
      '+1 extra item(s) from every monster kill.',
    );
  });

  it('describes GatherBonusQuantityChance with both fields', () => {
    const effect: ResearchEffect = {
      type: 'GatherBonusQuantityChance',
      chance: 5,
      bonusQuantity: 1,
    };
    expect(researchEffectDescription(effect, identity)).toBe(
      '5% chance to gather 1 extra item(s).',
    );
  });

  it('describes MonsterBonusGoldChance with both fields', () => {
    const effect: ResearchEffect = {
      type: 'MonsterBonusGoldChance',
      chance: 5,
      bonusGold: 10,
    };
    expect(researchEffectDescription(effect, identity)).toBe(
      '5% chance to find 10 bonus gold from monster kills.',
    );
  });

  it('describes CraftBonusXpChance with both fields', () => {
    const effect: ResearchEffect = {
      type: 'CraftBonusXpChance',
      chance: 5,
      bonusXp: 1,
    };
    expect(researchEffectDescription(effect, identity)).toBe(
      '5% chance to gain 1 bonus tradeskill XP when crafting.',
    );
  });

  it('describes CraftBonusXpChanceIncrease', () => {
    const effect: ResearchEffect = {
      type: 'CraftBonusXpChanceIncrease',
      chance: 5,
    };
    expect(researchEffectDescription(effect, identity)).toBe(
      '+5% chance to that bonus XP proc.',
    );
  });

  it('describes CraftBonusXpAmountIncrease', () => {
    const effect: ResearchEffect = {
      type: 'CraftBonusXpAmountIncrease',
      bonusXp: 1,
    };
    expect(researchEffectDescription(effect, identity)).toBe(
      '+1 to that bonus XP amount.',
    );
  });

  describe('MaterialAutomation', () => {
    it("resolves the granted item's name via getEntry", () => {
      vi.mocked(getEntry).mockReturnValue({ name: 'Copper Ore' } as never);
      const effect: ResearchEffect = {
        type: 'MaterialAutomation',
        itemId: 'copper-ore-id' as ItemId,
        quantityPerGrant: 2,
        ticksPerGrant: 3600,
      };

      expect(researchEffectDescription(effect, identity)).toBe(
        'Automatically grants 2 Copper Ore every 3600 ticks.',
      );
      expect(getEntry).toHaveBeenCalledWith('copper-ore-id');
    });

    it("falls back to 'Unknown' when the granted item no longer resolves", () => {
      vi.mocked(getEntry).mockReturnValue(undefined);
      const effect: ResearchEffect = {
        type: 'MaterialAutomation',
        itemId: 'missing-item-id' as ItemId,
        quantityPerGrant: 2,
        ticksPerGrant: 3600,
      };

      expect(researchEffectDescription(effect, identity)).toBe(
        'Automatically grants 2 Unknown every 3600 ticks.',
      );
    });
  });
});
