import type { CaravanTokenTrade } from '@interfaces/content-caravan-trader';
import type { AdventureLogRewardPart } from '@interfaces/combat-log';

// What a trade's live re-check decided; the non-executed outcomes besides `rejected` warn the player.
export type TradeCommitOutcome =
  'executed' | 'rejected' | 'armoryFull' | 'vanished';

// Whichever single reward type a trade moves; only one id is ever set.
export type TradeGoods = Pick<
  CaravanTokenTrade,
  'itemId' | 'equipmentId' | 'collectibleId' | 'recipeId'
>;

// Filled in from live state during the commit, since draft references are revoked once it ends.
export type TradeReceipt = {
  totalPrice: number;
  goods?: AdventureLogRewardPart;
};
