import type { AtlasedImage } from '@interfaces/artable';
import type { EquipmentContent } from '@interfaces/content-equipment';
import type { ExchangeNodeItemExchange } from '@interfaces/content-exchangenode';
import type { CostItem } from '@interfaces/cost';
import type { EquipmentItem } from '@interfaces/equipment';
import type { ItemPreviewDisplay } from '@interfaces/item-preview';

// One owned armory instance that an equipment exchange can be applied to.
export type ExchangeEquipmentRow = {
  kind: 'Equipment';
  exchangeIndex: number;
  item: EquipmentItem;
  inputContent: EquipmentContent;
  inputName: string;
  // Preview of the item after the exchange - same instance, new base.
  outputItem: EquipmentItem;
  outputContent: EquipmentContent;
  outputName: string;
  costs: CostItem[];
  canAfford: boolean;
  losesGems: boolean;
};

export type ExchangeItemRow = {
  kind: 'Item';
  exchangeIndex: number;
  exchange: ExchangeNodeItemExchange;
  canAfford: boolean;
  outputName: string;
};

export type ExchangeCollectibleRow = {
  kind: 'Collectible';
  exchangeIndex: number;
  display: ItemPreviewDisplay;
  costs: CostItem[];
  canAfford: boolean;
  outputName: string;
};

export type ExchangeRow =
  ExchangeEquipmentRow | ExchangeItemRow | ExchangeCollectibleRow;

// One accepted input, shown when the player has nothing to exchange; masked until discovered.
export type ExchangeInputHint = {
  id: string;
  discovered: boolean;
  name: string;
  spritesheet: AtlasedImage;
  sprite: string;
};
