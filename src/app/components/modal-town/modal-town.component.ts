import { DecimalPipe, formatNumber } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  LOCALE_ID,
  signal,
  viewChild,
} from '@angular/core';
import { AtlasAnimationComponent } from '@components/atlas-animation/atlas-animation.component';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { BarProgressComponent } from '@components/bar-progress/bar-progress.component';
import { CurrencyCostComponent } from '@components/currency-cost/currency-cost';
import { IconItemPreviewComponent } from '@components/icon-item-preview/icon-item-preview.component';
import { IconComponent } from '@components/icon/icon.component';
import { ModalComponent } from '@components/modal/modal.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { SpriteNodeComponent } from '@components/sprite-node/sprite-node.component';
import { TooltipItemPreviewComponent } from '@components/tooltip-item-preview/tooltip-item-preview.component';
import { notifySuccess } from '@helpers/engine/notify';
import { activeTownNode } from '@helpers/engine/ui';
import { getGoldQuantity, goldCoinId } from '@helpers/item/materials';
import {
  townCraftQueueRows,
  townTradeskillLevelRows,
} from '@helpers/town/crafting/town-craft-display';
import { townReputationDisplay } from '@helpers/town/reputation/town-reputation';
import { townStockPrice } from '@helpers/town/shop/town-price';
import { townShopItemCap } from '@helpers/town/shop/town-shop-access';
import {
  townStock,
  townStockBonusCombatStats,
  townStockBonusResistances,
  townStockBonusStats,
  townStockDisplay,
  townStockExpiresIn,
} from '@helpers/town/shop/town-stock';
import {
  townExecuteTrade,
  townStockAffordable,
} from '@helpers/town/shop/town-trade';
import {
  townWorkerRosterEntries,
  townWorkerStatusDisplay,
} from '@helpers/town/worker/town-worker-roster';
import { worldNodeTown } from '@helpers/world-node/world-nodes';
import type {
  TownCraftQueueRow,
  TownModalTab,
  TownStockEntry,
  TownStockRow,
  TownTradeskillLevelRow,
  TownWorkerRosterEntry,
  TownWorkerStatusDisplay,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

@Component({
  selector: 'app-modal-town',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalComponent,
    DecimalPipe,
    AtlasAnimationComponent,
    AtlasImageComponent,
    SpriteNodeComponent,
    BarProgressComponent,
    SweetAlert2Module,
    IconComponent,
    IconItemPreviewComponent,
    SlotIconBlankComponent,
    TooltipItemPreviewComponent,
    CurrencyCostComponent,
    TippyDirective,
  ],
  templateUrl: './modal-town.component.html',
})
export class ModalTownComponent {
  private locale = inject(LOCALE_ID);
  public goldCoinItemId = goldCoinId();

  public entry = computed(() => activeTownNode());

  public town = computed(() => {
    const entry = this.entry();
    return entry ? worldNodeTown(entry) : undefined;
  });

  public townReputation = computed(() => {
    const town = this.town();
    return town ? townReputationDisplay(town.id) : undefined;
  });

  public currentTab = signal<TownModalTab>('shop');

  public stockRows = computed<TownStockRow[]>(() => {
    const town = this.town();
    if (!town) return [];

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

  public stockCap = computed(() => {
    const town = this.town();
    return town ? townShopItemCap(town.id) : 0;
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

  public tradeskillLevelRows = computed<TownTradeskillLevelRow[]>(() => {
    const town = this.town();
    return town ? townTradeskillLevelRows(town.id) : [];
  });

  public tradeskillTooltip(row: TownTradeskillLevelRow): string {
    return row.isSpecialty ? `${row.name} (Speciality)` : row.name;
  }

  public craftQueueRows = computed<TownCraftQueueRow[]>(() => {
    const town = this.town();
    return town ? townCraftQueueRows(town.id) : [];
  });

  // Fixed length so the grid always shows every slot up to maxQueueSize, not just the filled ones.
  public craftQueueSlots = computed<undefined[]>(() => {
    const town = this.town();
    return new Array(town?.crafting.maxQueueSize ?? 0).fill(undefined);
  });

  public workers = computed(() => {
    const town = this.town();
    return town ? townWorkerRosterEntries(town.id) : [];
  });

  public workerStatusDisplay(
    entry: TownWorkerRosterEntry,
  ): TownWorkerStatusDisplay {
    const town = this.town();
    return town
      ? townWorkerStatusDisplay(town, entry.status)
      : { label: '', locationEntry: undefined };
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
    if (!town) return;

    const name = this.stockEntryName(row.entry);
    if (!(await townExecuteTrade(town.id, row.index))) return;

    notifySuccess(`You bought ${name}!`);
  }
}
