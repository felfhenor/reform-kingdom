import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { LevelRange } from '@interfaces/level-range';
import type { HasDescription, HasMapNodeGating } from '@interfaces/traits';

export type CaravanId = Branded<string, 'CaravanId'>;

export type CaravanMarkupPercentages = {
  sell: number;
  buy: number;
};

export type CaravanContent = IsContentItem &
  HasDescription &
  HasMapNodeGating & {
    id: CaravanId;
    __type: 'caravan';

    // Ticks between the caravan rotating in a (possibly new) trader and
    // rerolling its active trades.
    traderResetTime: number;

    levelRange: LevelRange;

    // Applied to a trade's authored `value` at purchase time - `sell` marks
    // up what the trader charges the player, `buy` (typically negative)
    // discounts what the trader pays the player.
    markupPercentages: CaravanMarkupPercentages;

    // Tags matched against `CaravanTraderContent.category` - only traders
    // in one of these categories are eligible to staff this caravan.
    traderCategories: string[];
  };
