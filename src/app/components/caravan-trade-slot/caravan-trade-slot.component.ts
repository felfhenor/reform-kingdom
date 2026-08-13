import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { CurrencyCostComponent } from '@components/currency-cost/currency-cost';
import { IconBlankSlotComponent } from '@components/icon-blank-slot/icon-blank-slot.component';
import { ItemStatRowsComponent } from '@components/item-stat-rows/item-stat-rows.component';
import { caravanTradeDisplay, goldCoinId } from '@helpers';
import type { CaravanTradeRow } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-caravan-trade-slot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    CurrencyCostComponent,
    IconBlankSlotComponent,
    ItemStatRowsComponent,
    TippyDirective,
  ],
  templateUrl: './caravan-trade-slot.component.html',
  styleUrl: './caravan-trade-slot.component.scss',
})
export class CaravanTradeSlotComponent {
  public row = input.required<CaravanTradeRow>();

  public activate = output<void>();

  public goldCoinItemId = goldCoinId();

  public display = computed(() => caravanTradeDisplay(this.row().trade));

  // `type: 'sell'` is the trader selling to the party (the party buys);
  // `type: 'buy'` is the trader buying from the party (the party sells).
  public isPartyBuying = computed(() => this.row().trade.type === 'sell');
}
