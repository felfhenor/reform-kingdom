import type { EquipmentContent } from '@interfaces/content-equipment';
import type { ExchangeNodeItemExchange } from '@interfaces/content-exchangenode';
import type { CostItem } from '@interfaces/cost';
import type { EquipmentItem } from '@interfaces/equipment';

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
};

export type ExchangeRow = ExchangeEquipmentRow | ExchangeItemRow;
