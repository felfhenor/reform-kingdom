// Query layer for ResearchEffect: every consumer sums the relevant variant(s)
// across all currently-completed research live, rather than any node
// mutating another's stored value (see the "Every effect-bearing consumer
// sums..." note in the design plan's Node roster section). Split out of
// research.ts to stay under the 400-line helper limit.
import { isResearchCompleted, researchEntries } from '@helpers/research/research';
import type { ResearchEffect } from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

function completedEffects(): ResearchEffect[] {
  return researchEntries()
    .filter((research) => isResearchCompleted(research.id))
    .map((research) => research.effect)
    .filter((effect): effect is ResearchEffect => !!effect);
}

function sumResearchEffect<K extends ResearchEffect['type']>(
  type: K,
  selector: (effect: Extract<ResearchEffect, { type: K }>) => number,
): number {
  const matching = completedEffects().filter(
    (effect): effect is Extract<ResearchEffect, { type: K }> =>
      effect.type === type,
  );

  return sumBy(matching, selector);
}

export function researchTravelTimeReductionPercent(): number {
  return sumResearchEffect('TravelTimeReduction', (effect) => effect.percent);
}

export function researchCaravanPriceReductionPercent(): number {
  return sumResearchEffect('CaravanPriceReduction', (effect) => effect.percent);
}

export function researchAstralSpellDurationIncreasePercent(): number {
  return sumResearchEffect(
    'AstralSpellDurationIncrease',
    (effect) => effect.percent,
  );
}

export function researchArmorySellValueIncreasePercent(): number {
  return sumResearchEffect(
    'ArmorySellValueIncrease',
    (effect) => effect.percent,
  );
}

export function researchPostWipeHealTimeReductionPercent(): number {
  return sumResearchEffect(
    'PostWipeHealTimeReduction',
    (effect) => effect.percent,
  );
}

export function researchMonsterLootBonusQuantity(): number {
  return sumResearchEffect(
    'MonsterLootBonusQuantity',
    (effect) => effect.bonusQuantity,
  );
}

export function researchGatherBonusQuantityChance(): {
  chance: number;
  bonusQuantity: number;
} {
  return {
    chance: sumResearchEffect('GatherBonusQuantityChance', (effect) => effect.chance),
    bonusQuantity: sumResearchEffect(
      'GatherBonusQuantityChance',
      (effect) => effect.bonusQuantity,
    ),
  };
}

export function researchMonsterBonusGoldChance(): {
  chance: number;
  bonusGold: number;
} {
  return {
    chance: sumResearchEffect('MonsterBonusGoldChance', (effect) => effect.chance),
    bonusGold: sumResearchEffect(
      'MonsterBonusGoldChance',
      (effect) => effect.bonusGold,
    ),
  };
}

// Keen Eye (`CraftBonusXpChance`) authors the base chance/bonusXp; Sharper
// Eye/Deeper Insight (`...Increase` variants) add on top rather than
// mutating Keen Eye's own values - see the Domain-tab roster note.
export function researchCraftBonusXp(): { chance: number; bonusXp: number } {
  return {
    chance:
      sumResearchEffect('CraftBonusXpChance', (effect) => effect.chance) +
      sumResearchEffect('CraftBonusXpChanceIncrease', (effect) => effect.chance),
    bonusXp:
      sumResearchEffect('CraftBonusXpChance', (effect) => effect.bonusXp) +
      sumResearchEffect(
        'CraftBonusXpAmountIncrease',
        (effect) => effect.bonusXp,
      ),
  };
}
