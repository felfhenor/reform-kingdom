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
import { SlotCommissionComponent } from '@components/slot-commission/slot-commission.component';
import { SlotCompletionRewardComponent } from '@components/slot-completion-reward/slot-completion-reward.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { SpriteNodeComponent } from '@components/sprite-node/sprite-node.component';
import { TooltipItemPreviewComponent } from '@components/tooltip-item-preview/tooltip-item-preview.component';
import { formatDuration, timerTicksElapsed } from '@helpers/engine/timer';
import { modalCloseTop } from '@helpers/engine/modal-stack';
import { notifyError, notifySuccess } from '@helpers/engine/notify';
import { activeTownNode } from '@helpers/engine/ui';
import { travelStart } from '@helpers/hero/travel';
import { getGoldQuantity, goldCoinId } from '@helpers/item/materials';
import { raidEngageCombat } from '@helpers/town/raid/town-raid-combat';
import {
  townCommissionFulfill,
  townCommissionRowViewModels,
} from '@helpers/town/town-commission-fulfill';
import {
  raidAssaulterPreview,
  raidDefenderPreview,
  townRaidTelegraph,
} from '@helpers/town/raid/town-raid-state';
import {
  townCraftQueueRows,
  townTradeskillLevelRows,
} from '@helpers/town/crafting/town-craft-display';
import { townCraftQueueSize } from '@helpers/town/crafting/town-craft-queue-size';
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
  TownCommissionRowViewModel,
  TownCraftQueueRow,
  TownModalTab,
  TownRaidCombatantRow,
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
    SlotCommissionComponent,
    SlotIconBlankComponent,
    SlotCompletionRewardComponent,
    TooltipItemPreviewComponent,
    CurrencyCostComponent,
    TippyDirective,
  ],
  templateUrl: './modal-town.component.html',
  styleUrl: './modal-town.component.scss',
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

  public raidTelegraph = computed(() => {
    const town = this.town();
    return town ? townRaidTelegraph(town.id) : undefined;
  });

  public raidCountdown = computed(() => {
    const telegraph = this.raidTelegraph();
    if (!telegraph) return undefined;

    return formatDuration(
      telegraph.engageWindowExpiresAtTick - timerTicksElapsed(),
    );
  });

  public raidRewards = computed(() => this.town()?.defense.rewards ?? []);

  public raidAssaulters = computed<TownRaidCombatantRow[]>(() => {
    const town = this.town();
    return town ? raidAssaulterPreview(town) : [];
  });

  public raidDefenders = computed<TownRaidCombatantRow[]>(() => {
    const town = this.town();
    return town ? raidDefenderPreview(town) : [];
  });

  public engageRaid(): void {
    const town = this.town();
    if (!town) return;

    if (!raidEngageCombat(town.id)) {
      notifyError(`Could not engage the raid on ${town.name}.`);
      return;
    }

    modalCloseTop();
  }

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

  // Fixed length so the grid always shows every slot up to the reputation-scaled max, not just the filled ones.
  public craftQueueSlots = computed<undefined[]>(() => {
    const town = this.town();
    return new Array(town ? townCraftQueueSize(town) : 0).fill(undefined);
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

  public commissions = computed<TownCommissionRowViewModel[]>(() => {
    const entry = this.entry();
    return entry ? townCommissionRowViewModels(entry) : [];
  });

  public travelToTown(): void {
    const entry = this.entry();
    if (entry) travelStart(entry.nodeName);
  }

  public fulfillCommission(
    row: TownCommissionRowViewModel,
  ): Promise<boolean> {
    return townCommissionFulfill(row.townId, row.slotId);
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
