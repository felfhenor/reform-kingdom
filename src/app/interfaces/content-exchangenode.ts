import type { CollectibleId } from '@interfaces/content-collectible';
import type { EdictId } from '@interfaces/content-edict';
import type { EquipmentId } from '@interfaces/content-equipment';
import type { CostItem, ItemQuantity } from '@interfaces/cost';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasNodeBackground } from '@interfaces/node-background';
import type { HasDescription } from '@interfaces/traits';
import type { WorldNodeHideable } from '@interfaces/world-nodes';

export type ExchangeNodeId = Branded<string, 'ExchangeNodeId'>;

// Swaps the base of an unequipped armory item - affixes and infusions carry over untouched.
export type ExchangeNodeEquipmentExchange = {
  kind: 'Equipment';
  inputEquipmentId: EquipmentId;
  outputEquipmentId: EquipmentId;
  costs: CostItem[];
};

export type ExchangeNodeItemExchange = {
  kind: 'Item';
  input: CostItem;
  output: ItemQuantity;
  costs: CostItem[];
};

// Stocked only in runs whose Legacy has cleared its edict; sold once per run.
export type ExchangeNodeCollectibleExchange = {
  kind: 'Collectible';
  requiredEdictId: EdictId;
  outputCollectibleId: CollectibleId;
  costs: CostItem[];
};

export type ExchangeNodeExchange =
  | ExchangeNodeEquipmentExchange
  | ExchangeNodeItemExchange
  | ExchangeNodeCollectibleExchange;

export type ExchangeNodeContent = IsContentItem &
  HasDescription &
  WorldNodeHideable &
  HasNodeBackground & {
    id: ExchangeNodeId;
    __type: 'exchangenode';

    // Shown in the exchange modal when the player owns no valid input.
    emptyText: string;

    // Label for the node's action button and each exchange's confirm button (e.g. "Purify").
    actionLabel: string;

    exchanges: ExchangeNodeExchange[];
  };

export type ExchangeResult = 'ok' | 'missing' | 'unaffordable' | 'invalid';
