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
import { caravanTokenTradeDisplay } from '@helpers/caravan/caravan-trade-display.ui';
import { hasTraderTokens, traderTokenId } from '@helpers/item/materials';
import type { CaravanTokenTrade } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-slot-caravan-token-trade',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyCostComponent,
    TooltipItemPreviewComponent,
    TippyDirective,
    SlotRarityOutlineComponent,
    SFXDirective,
  ],
  templateUrl: './slot-caravan-token-trade.component.html',
  styleUrl: './slot-caravan-token-trade.component.scss',
})
export class SlotCaravanTokenTradeComponent {
  public trade = input.required<CaravanTokenTrade>();

  public activate = output<void>();

  public traderTokenItemId = traderTokenId();

  public display = computed(() => caravanTokenTradeDisplay(this.trade()));

  public canAfford = computed(() => hasTraderTokens(this.trade().tokenCost));
}
