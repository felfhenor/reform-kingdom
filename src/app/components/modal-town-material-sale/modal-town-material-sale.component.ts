import {
  ChangeDetectionStrategy,
  Component,
  computed,
  viewChild,
} from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { ModalComponent } from '@components/modal/modal.component';
import { ModalTradeQuantityComponent } from '@components/modal-trade-quantity/modal-trade-quantity.component';
import { SlotCaravanTradeComponent } from '@components/slot-caravan-trade/slot-caravan-trade.component';
import { caravanTradeDisplay } from '@helpers/caravan/caravan-trade-display.ui';
import { notifyError, notifySuccess } from '@helpers/engine/notify';
import { activeTownNode } from '@helpers/engine/ui';
import { getGoldQuantity, getMaterialQuantity } from '@helpers/item/materials';
import {
  townMaterialSaleAvailable,
  townMaterialSaleMaxQuantity,
  townMaterialSalePrice,
} from '@helpers/town/shop/town-material-sale';
import { townExecuteMaterialSale } from '@helpers/town/shop/town-material-sale.ui';
import { worldNodeTown } from '@helpers/world-node/world-nodes';
import type { CaravanTradeRow } from '@interfaces';

@Component({
  selector: 'app-modal-town-material-sale',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlankSlateComponent,
    SlotCaravanTradeComponent,
    ModalComponent,
    ModalTradeQuantityComponent,
  ],
  templateUrl: './modal-town-material-sale.component.html',
})
export class ModalTownMaterialSaleComponent {
  public entry = computed(() => activeTownNode());

  public town = computed(() => {
    const entry = this.entry();
    return entry ? worldNodeTown(entry) : undefined;
  });

  // Reuses CaravanTradeRow/SlotCaravanTradeComponent so a town's material sales get the same
  // price/badge/tooltip presentation as a caravan's item trades, rather than a bespoke row type.
  public rows = computed<CaravanTradeRow[]>(() => {
    const town = this.town();
    if (!town) return [];

    const goldQuantity = getGoldQuantity();

    return town.materialThresholds
      .filter((threshold) => threshold.value > 0)
      .map((threshold, index): CaravanTradeRow => {
        const available = townMaterialSaleAvailable(town, threshold);
        return {
          index,
          trade: {
            type: 'sell',
            value: threshold.value,
            itemId: threshold.itemId,
            // Unused outside caravan reroll selection - required by CaravanTrade, irrelevant here.
            weight: 1,
          },
          price: townMaterialSalePrice(town, threshold),
          // Repurposes the "trades remaining" badge to show the town's sellable excess.
          remaining: available,
          soldOut: available <= 0,
          maxQuantity: townMaterialSaleMaxQuantity(
            town,
            threshold,
            goldQuantity,
          ),
          ownedQuantity: getMaterialQuantity(threshold.itemId),
        };
      });
  });

  private quantityPrompt = viewChild(ModalTradeQuantityComponent);

  public async requestTrade(
    row: CaravanTradeRow,
    skipConfirm = false,
  ): Promise<void> {
    if (row.soldOut) return;

    const name = caravanTradeDisplay(row.trade)?.name ?? 'this';
    const quantity =
      (await this.quantityPrompt()?.ask(
        { verb: 'Buy', name, price: row.price, maxQuantity: row.maxQuantity },
        skipConfirm,
      )) ?? 0;
    if (quantity > 0) await this.commitTrade(row, quantity);
  }

  private async commitTrade(
    row: CaravanTradeRow,
    quantity: number,
  ): Promise<void> {
    const town = this.town();
    const itemId = row.trade.itemId;
    if (!town || !itemId) return;

    const name = caravanTradeDisplay(row.trade)?.name ?? 'item';

    let success: boolean;
    try {
      success = await townExecuteMaterialSale(town.id, itemId, quantity);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : String(err));
      return;
    }
    if (!success) return;

    const qtyLabel = quantity > 1 ? ` x${quantity}` : '';
    notifySuccess(`You bought ${name}${qtyLabel}!`);
  }
}
