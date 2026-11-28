import { TPipe } from '@pipes/t.pipe';
import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { CurrencyCostComponent } from '@components/currency-cost/currency-cost';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { TooltipItemPreviewComponent } from '@components/tooltip-item-preview/tooltip-item-preview.component';
import { ListRowDirective } from '@directives/list-row.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { caravanTradeDisplay } from '@helpers/caravan/caravan-trade-display.ui';
import { goldCoinId, hasGold, traderTokenId } from '@helpers/item/materials';
import type { CaravanTradeRow } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

const MERCHANT_NOTE_KEYS = {
  caravan: {
    selling: 'slotCaravanTrade.caravanSelling',
    buying: 'slotCaravanTrade.caravanBuying',
  },
  town: {
    selling: 'slotCaravanTrade.townSelling',
    buying: 'slotCaravanTrade.townBuying',
  },
} as const;

@Component({
  selector: 'app-slot-caravan-trade',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TPipe,
    CurrencyCostComponent,
    TooltipItemPreviewComponent,
    TippyDirective,
    SlotRarityOutlineComponent,
    ListRowDirective,
    SFXDirective,
    DecimalPipe,
  ],
  templateUrl: './slot-caravan-trade.component.html',
  styleUrl: './slot-caravan-trade.component.scss',
})
export class SlotCaravanTradeComponent {
  public row = input.required<CaravanTradeRow>();
  public merchantLabel = input<'caravan' | 'town'>('caravan');

  // Emits whether the confirmation should be skipped (shift-click).
  public activate = output<boolean>();

  public goldCoinItemId = goldCoinId();
  public traderTokenItemId = traderTokenId();

  public display = computed(() =>
    caravanTradeDisplay(this.row().trade, this.row().equipmentItem),
  );

  public hasEnoughGoldToBuy = computed(
    () => this.isPartyBuying() && !hasGold(this.row().price),
  );

  // `type: 'sell'` is the trader selling to the party (the party buys);
  // `type: 'buy'` is the trader buying from the party (the party sells).
  public isPartyBuying = computed(() => this.row().trade.type === 'sell');
  public merchantNoteKey = computed(
    () =>
      MERCHANT_NOTE_KEYS[this.merchantLabel()][
        this.isPartyBuying() ? 'selling' : 'buying'
      ],
  );
}
