import type { CaravanTraderId } from '@interfaces/content-caravan-trader';
import type { MonsterId } from '@interfaces/content-monster';
import type { TownId } from '@interfaces/content-town';
import type { TradeskillId } from '@interfaces/content-tradeskill';
import type {
  DropCollectible,
  DropEquipment,
  DropItem,
  DropRecipe,
} from '@interfaces/droppable';

// Derived from static content, not tracked per-player. Expected exactly one per collectible.
export type CollectibleSource =
  | { type: 'node'; name: string }
  | { type: 'monster'; name: string; monsterId: MonsterId }
  | { type: 'crafting'; tradeskillId: TradeskillId; tradeskillLevel: number }
  | { type: 'trader'; traderId: CaravanTraderId; name: string }
  | { type: 'raid'; townId: TownId; name: string }
  | { type: 'town'; townId: TownId; name: string };

// The content a source lookup searches for.
export type SourceTarget =
  DropItem | DropEquipment | DropRecipe | DropCollectible;
