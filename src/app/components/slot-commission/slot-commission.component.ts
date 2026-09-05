import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { SlotCompletionRewardComponent } from '@components/slot-completion-reward/slot-completion-reward.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { commissionFulfill } from '@helpers/commission/commission-fulfill';
import { notifySuccess } from '@helpers/engine/notify';
import { formatDuration } from '@helpers/engine/timer';
import { bestiaryDropQuantityLabel } from '@helpers/kingdom/bestiary';
import type {
  CaravanId,
  CommissionRowViewModel,
  CraftRequirementEntry,
  DroppedReward,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-slot-commission',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    SlotCompletionRewardComponent,
    SlotIconBlankComponent,
    TippyDirective,
  ],
  templateUrl: './slot-commission.component.html',
})
export class SlotCommissionComponent {
  public row = input.required<CommissionRowViewModel>();

  public isInCaravanTradePopup = input(false);

  public travel = output<void>();

  public requirementTooltip(entry: CraftRequirementEntry): string {
    const name = entry.content?.name ?? 'Unknown';
    return `${name} (${entry.owned}/${entry.quantity})`;
  }

  public etaLabel(seconds: number): string {
    return formatDuration(seconds);
  }

  // Commission rewards aren't level-scaled, so the level passed here is inert.
  public rewardQuantityLabel(reward: DroppedReward): string {
    return bestiaryDropQuantityLabel(reward, 1);
  }

  public async turnIn(caravanId: CaravanId): Promise<void> {
    if (!(await commissionFulfill(caravanId))) return;
    notifySuccess('Commission turned in!');
  }
}
