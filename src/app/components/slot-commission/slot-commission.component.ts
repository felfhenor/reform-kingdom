import { DecimalPipe, formatNumber } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  output,
} from '@angular/core';
import { SlotCompletionRewardComponent } from '@components/slot-completion-reward/slot-completion-reward.component';
import { SlotRequirementComponent } from '@components/slot-requirement/slot-requirement.component';
import { SFXDirective } from '@directives/sfx.directive';
import { commissionRarity } from '@helpers/commission/commission-requirement.ui';
import { formatDuration } from '@helpers/engine/timer';
import { bestiaryDropQuantityLabel } from '@helpers/kingdom/bestiary.ui';
import type {
  CommissionRequirementEntry,
  CommissionSlotDisplay,
  DroppedReward,
} from '@interfaces';

@Component({
  selector: 'app-slot-commission',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SlotRequirementComponent,
    DecimalPipe,
    SlotCompletionRewardComponent,
    SFXDirective,
  ],
  templateUrl: './slot-commission.component.html',
})
export class SlotCommissionComponent {
  private locale = inject(LOCALE_ID);

  public row = input.required<CommissionSlotDisplay>();

  // True when already rendered inside the row's own location modal (a caravan's trade popup, a town's Quests tab) - hides the redundant travel button.
  public isInLocationModal = input(false);

  // Which system to call (caravan vs. town) - supplied by the caller so this component stays generic.
  public fulfill = input.required<() => Promise<boolean>>();

  public turnIn = output<void>();
  public travel = output<void>();

  public commissionName = computed(() =>
    (this.row().commission?.name ?? 'Commission').replace('Commission - ', ''),
  );

  public rarityLabel = computed(() =>
    commissionRarity(this.row().requirementEntries),
  );

  public requirementTooltip(entry: CommissionRequirementEntry): string {
    const name = entry.content?.name ?? 'Unknown';
    const owned = formatNumber(entry.owned, this.locale);
    const quantity = formatNumber(entry.quantity, this.locale);
    return `${name} (${owned}/${quantity})`;
  }

  public etaLabel(seconds: number): string {
    return formatDuration(seconds);
  }

  // Commission rewards aren't level-scaled, so the level passed here is inert.
  public rewardQuantityLabel(reward: DroppedReward): string {
    return bestiaryDropQuantityLabel(reward, 1);
  }

  public async doTurnIn(): Promise<void> {
    if (!(await this.fulfill()())) return;
    this.turnIn.emit();
  }
}
