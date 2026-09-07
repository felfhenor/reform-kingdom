import type { CommissionOfferId } from '@interfaces/content-commission-offer';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { LevelRange } from '@interfaces/level-range';
import type { HasDescription } from '@interfaces/traits';
import type { WorldNodeHideable } from '@interfaces/world-nodes';

export type CaravanId = Branded<string, 'CaravanId'>;

export type CaravanMarkupPercentages = {
  sell: number;
  buy: number;
};

// Weight lives per-caravan so the same offer can be common at one caravan
// and rare at another.
export type CommissionOfferSlot = {
  commissionOfferId: CommissionOfferId;
  weight: number;
  persistent?: boolean;
};

export type CaravanContent = IsContentItem &
  HasDescription &
  WorldNodeHideable & {
    id: CaravanId;
    __type: 'caravan';

    // Ticks between the caravan rotating in a (possibly new) trader and
    // rerolling its active trades.
    traderResetTime: number;

    level: LevelRange;

    // `sell` marks up what the trader charges the player, `buy` (typically
    // negative) discounts what the trader pays the player.
    markupPercentages: CaravanMarkupPercentages;

    // Only traders in one of these categories are eligible to staff this caravan.
    traderCategories: string[];

    // Direct pool this caravan rolls its daily commission from. Not
    // category-matched like traders; the caravan owns its own list.
    commissionOffers: CommissionOfferSlot[];
  };
