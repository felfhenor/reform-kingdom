import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { CurrencyCostComponent } from '@components/currency-cost/currency-cost';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { formatDuration } from '@helpers/engine/timer';
import { traderTokenId } from '@helpers/item/materials';
import type {
  CaravanId,
  CommissionRowViewModel,
  CraftRequirementEntry,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { commissionFulfill } from '../../helpers/commission/commission-fulfill';
import { notifySuccess } from '../../helpers/engine/notify';

@Component({
  selector: 'app-slot-commission',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    CurrencyCostComponent,
    SlotIconBlankComponent,
    TippyDirective,
  ],
  templateUrl: './slot-commission.component.html',
})
export class SlotCommissionComponent {
  public row = input.required<CommissionRowViewModel>();

  public isInCaravanTradePopup = input(false);

  public travel = output<void>();

  public traderTokenItemId = traderTokenId();

  public requirementTooltip(entry: CraftRequirementEntry): string {
    const name = entry.content?.name ?? 'Unknown';
    return `${name} (${entry.owned}/${entry.quantity})`;
  }

  public etaLabel(seconds: number): string {
    return formatDuration(seconds);
  }

  public async turnIn(caravanId: CaravanId): Promise<void> {
    if (!(await commissionFulfill(caravanId))) return;
    notifySuccess(
      `Commission turned in: +${this.row().tokenReward} Trader Scrips!`,
    );
  }
}
