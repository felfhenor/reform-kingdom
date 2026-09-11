import { DecimalPipe, formatNumber } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  signal,
  viewChild,
} from '@angular/core';
import { CurrencyCostComponent } from '@components/currency-cost/currency-cost';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { TooltipItemPreviewComponent } from '@components/tooltip-item-preview/tooltip-item-preview.component';
import { SFXDirective } from '@directives/sfx.directive';
import { notifySuccess } from '@helpers/engine/notify';
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
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

@Component({
  selector: 'app-panel-town-shop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyCostComponent,
    DecimalPipe,
    SweetAlert2Module,
    TippyDirective,
    TooltipItemPreviewComponent,
    SlotRarityOutlineComponent,
    SFXDirective,
  ],
  host: { class: 'card bg-base-200 shadow-sm flex flex-col min-h-0' },
  templateUrl: './panel-town-shop.component.html',
})
export class PanelTownShopComponent {
  private locale = inject(LOCALE_ID);
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

  private confirmSwal = viewChild<SwalComponent>('confirmSwal');
  private pendingRow = signal<TownStockRow | undefined>(undefined);

  public requestTrade(row: TownStockRow): void {
    if (row.price === undefined || !row.affordable) return;

    this.pendingRow.set(row);
    const name = this.stockEntryName(row.entry);
    const price = formatNumber(row.price, this.locale);

    const swal = this.confirmSwal();
    if (!swal) return;
    swal.swalOptions = { text: `Buy ${name} for ${price}g?` };
    swal.fire();
  }

  public async confirmSingle(): Promise<void> {
    const row = this.pendingRow();
    this.pendingRow.set(undefined);
    if (!row) return;

    const town = this.town();
    const name = this.stockEntryName(row.entry);
    if (!(await townExecuteTrade(town.id, row.index))) return;

    notifySuccess(`You bought ${name}!`);
  }
}
