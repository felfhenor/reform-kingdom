import type { CaravanTraderId } from '@interfaces/content-caravan-trader';
import type { MonsterId } from '@interfaces/content-monster';
import type { TaskId } from '@interfaces/content-task';
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
  // `requires`: what an exchange consumes to make it.
  | { type: 'node'; name: string; requires?: SourceTarget[] }
  | { type: 'monster'; name: string; monsterId: MonsterId }
  | { type: 'crafting'; tradeskillId: TradeskillId; tradeskillLevel: number }
  | { type: 'trader'; traderId: CaravanTraderId; name: string }
  | { type: 'raid'; townId: TownId; name: string }
  | { type: 'town'; townId: TownId; name: string }
  | { type: 'townCraft'; townId: TownId; name: string; isEquipment: boolean }
  | { type: 'task'; taskId: TaskId; name: string };

// The content a source lookup searches for.
export type SourceTarget =
  DropItem | DropEquipment | DropRecipe | DropCollectible;

// Drops, trades, recipe results, gather results and town sales all name their output with these same fields, so one matcher covers every channel.
export const SOURCE_KEYS = [
  'itemId',
  'equipmentId',
  'recipeId',
  'collectibleId',
] as const;
export type SourceKey = (typeof SOURCE_KEYS)[number];
export type SourceFields = Partial<Record<SourceKey, string>>;

export type ContentSourceCache = {
  content: object;
  byTarget: Map<string, CollectibleSource[]>;
};
