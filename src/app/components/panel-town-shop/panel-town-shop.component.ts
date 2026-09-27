import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  viewChild,
} from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { CurrencyCostComponent } from '@components/currency-cost/currency-cost';
import { ModalTradeQuantityComponent } from '@components/modal-trade-quantity/modal-trade-quantity.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { TooltipItemPreviewComponent } from '@components/tooltip-item-preview/tooltip-item-preview.component';
import { ListRowDirective } from '@directives/list-row.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { modalOpen } from '@helpers/engine/modal-stack';
import { notifyError, notifySuccess } from '@helpers/engine/notify';
import { getGoldQuantity, goldCoinId } from '@helpers/item/materials';
import { townStockPrice } from '@helpers/town/shop/town-price';
import { townShopItemCap } from '@helpers/town/shop/town-shop-access';
import { townStock, townStockDisplay } from '@helpers/town/shop/town-stock';
import {
  townStockBonusCombatStats,
  townStockBonusResistances,
  townStockBonusStats,
  townStockExpiresIn,
} from '@helpers/town/shop/town-stock.ui';
import { townStockAffordable } from '@helpers/town/shop/town-trade';
import { townExecuteTrade } from '@helpers/town/shop/town-trade.ui';
import type { TownContent, TownStockEntry, TownStockRow } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-panel-town-shop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlankSlateComponent,
    CurrencyCostComponent,
    DecimalPipe,
    ModalTradeQuantityComponent,
    TippyDirective,
    TooltipItemPreviewComponent,
    SlotRarityOutlineComponent,
    ListRowDirective,
    SFXDirective,
  ],
  host: { class: 'card shadow-sm flex flex-col min-h-0' },
  templateUrl: './panel-town-shop.component.html',
})
export class PanelTownShopComponent {
  public town = input.required<TownContent>();

  public goldCoinItemId = goldCoinId();

  public stockCap = computed(() => townShopItemCap(this.town().id));

  public stockRows = computed<TownStockRow[]>(() => {
    const town = this.town();
    const goldQuantity = getGoldQuantity();

    return townStock(town.id).map((entry, index) => {
      const price = townStockPrice(town, entry);
      return {
        index,
        entry,
        price,
        affordable:
          price !== undefined && townStockAffordable(price, goldQuantity),
        expiresIn: townStockExpiresIn(entry, town),
      };
    });
  });

  public openMaterialsModal(): void {
    modalOpen('town-materials');
  }

  public stockEntryName(entry: TownStockEntry): string {
    return townStockDisplay(entry)?.name ?? 'Unknown Item';
  }

  public stockRowDisplay(entry: TownStockEntry) {
    return townStockDisplay(entry);
  }

  public stockRowBonusStats(entry: TownStockEntry) {
    return townStockBonusStats(entry);
  }

  public stockRowBonusResistances(entry: TownStockEntry) {
    return townStockBonusResistances(entry);
  }

  public stockRowBonusCombatStats(entry: TownStockEntry) {
    return townStockBonusCombatStats(entry);
  }

  private quantityPrompt = viewChild(ModalTradeQuantityComponent);

  public async requestTrade(
    row: TownStockRow,
    skipConfirm = false,
  ): Promise<void> {
    if (row.price === undefined || !row.affordable) return;

    const name = this.stockEntryName(row.entry);
    const quantity =
      (await this.quantityPrompt()?.ask(
        { verb: 'Buy', name, price: row.price, maxQuantity: 1 },
        skipConfirm,
      )) ?? 0;
    if (quantity > 0) await this.buy(row, name);
  }

  private async buy(row: TownStockRow, name: string): Promise<void> {
    const town = this.town();

    try {
      if (!(await townExecuteTrade(town.id, row.entry.equipmentItem.id)))
        return;
    } catch (err) {
      notifyError(err instanceof Error ? err.message : String(err));
      return;
    }

    notifySuccess(`You bought ${name}!`);
  }
}
