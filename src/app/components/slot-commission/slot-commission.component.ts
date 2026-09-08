import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { SlotCompletionRewardComponent } from '@components/slot-completion-reward/slot-completion-reward.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { commissionRarity } from '@helpers/commission/commission-requirement.ui';
import { notifySuccess } from '@helpers/engine/notify';
import { formatDuration } from '@helpers/engine/timer';
import { bestiaryDropQuantityLabel } from '@helpers/kingdom/bestiary.ui';
import type {
  CommissionRequirementEntry,
  CommissionSlotDisplay,
  DroppedReward,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-slot-commission',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    SlotCompletionRewardComponent,
    TippyDirective,
    SlotRarityOutlineComponent,
  ],
  templateUrl: './slot-commission.component.html',
})
export class SlotCommissionComponent {
  public row = input.required<CommissionSlotDisplay>();

  // True when already rendered inside the row's own location modal (a caravan's trade popup, a town's Quests tab) - hides the redundant travel button.
  public isInLocationModal = input(false);

  // Which system to call (caravan vs. town) - supplied by the caller so this component stays generic.
  public fulfill = input.required<() => Promise<boolean>>();

  public turnIn = output<void>();
  public travel = output<void>();

  public rarityLabel = computed(() =>
    commissionRarity(this.row().requirementEntries),
  );

  public requirementTooltip(entry: CommissionRequirementEntry): string {
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

  public async doTurnIn(): Promise<void> {
    if (!(await this.fulfill()())) return;
    this.turnIn.emit();
    notifySuccess('Commission turned in!');
  }
}
