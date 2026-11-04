import type { CaravanTraderId } from '@interfaces/content-caravan-trader';
import type { TownId } from '@interfaces/content-town';
import type { TradeskillId } from '@interfaces/content-tradeskill';

// Derived from static content, not tracked per-player. Expected exactly one per collectible.
export type CollectibleSource =
  | { type: 'node'; name: string }
  | { type: 'crafting'; tradeskillId: TradeskillId; tradeskillLevel: number }
  | { type: 'trader'; traderId: CaravanTraderId; name: string }
  | { type: 'raid'; townId: TownId; name: string };
