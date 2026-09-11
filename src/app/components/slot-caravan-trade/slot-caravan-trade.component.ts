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
import { SFXDirective } from '@directives/sfx.directive';
import { caravanTradeDisplay } from '@helpers/caravan/caravan-trade-display.ui';
import { goldCoinId, hasGold } from '@helpers/item/materials';
import type { CaravanTradeRow } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-slot-caravan-trade',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyCostComponent,
    TooltipItemPreviewComponent,
    TippyDirective,
    SlotRarityOutlineComponent,
    SFXDirective,
  ],
  templateUrl: './slot-caravan-trade.component.html',
  styleUrl: './slot-caravan-trade.component.scss',
})
export class SlotCaravanTradeComponent {
  public row = input.required<CaravanTradeRow>();

  public activate = output<void>();

  public goldCoinItemId = goldCoinId();

  public display = computed(() => caravanTradeDisplay(this.row().trade));

  public hasEnoughGoldToBuy = computed(
    () => this.isPartyBuying() && !hasGold(this.row().price),
  );

  // `type: 'sell'` is the trader selling to the party (the party buys);
  // `type: 'buy'` is the trader buying from the party (the party sells).
  public isPartyBuying = computed(() => this.row().trade.type === 'sell');
}
