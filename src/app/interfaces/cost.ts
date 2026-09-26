import type { ItemId } from '@interfaces/content-item';

export type CostItem = {
  itemId: ItemId;
  required: number;
};

export type ItemQuantity = {
  itemId: ItemId;
  quantity: number;
};
