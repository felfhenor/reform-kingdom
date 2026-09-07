import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { ButtonKingdomBackComponent } from '@components/button-kingdom-back/button-kingdom-back.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { SlotCommissionComponent } from '@components/slot-commission/slot-commission.component';
import { commissionFulfill } from '@helpers/commission/commission-fulfill';
import { commissionRowViewModel } from '@helpers/commission/commission-fulfill.ui';
import { nextCommissionResetAt } from '@helpers/commission/commission-reset.ui';
import { formatDuration } from '@helpers/engine/timer';
import { uiClockTick } from '@helpers/engine/ui';
import { travelStart } from '@helpers/hero/travel';
import {
  townCommissionFulfill,
  townCommissionRowViewModels,
} from '@helpers/town/town-commission-fulfill.ui';
import { worldNodesOfType } from '@helpers/world-node/world-nodes';
import type {
  CommissionRowViewModel,
  TownCommissionRowViewModel,
} from '@interfaces';

@Component({
  selector: 'app-play-kingdom-commissions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardPageComponent,
    ButtonKingdomBackComponent,
    SlotCommissionComponent,
  ],
  templateUrl: './play-kingdom-commissions.component.html',
})
export class PlayKingdomCommissionsComponent {
  // One shared wall-clock countdown for every caravan row - uiClockTick() forces a recompute each second so it doesn't look frozen between gameloop ticks. Towns have no reset, so this is caravan-only.
  public resetLabel = computed(() => {
    uiClockTick();
    const msRemaining = nextCommissionResetAt() - Date.now();
    return formatDuration(Math.floor(msRemaining / 1000));
  });

  public caravanRows = computed<CommissionRowViewModel[]>(() =>
    worldNodesOfType('CaravanNode')
      .map((entry) => commissionRowViewModel(entry))
      .filter((row): row is CommissionRowViewModel => !!row),
  );

  public townRows = computed<TownCommissionRowViewModel[]>(() =>
    worldNodesOfType('NonPlayerKingdom').flatMap((entry) =>
      townCommissionRowViewModels(entry),
    ),
  );

  public travelTo(nodeName: string): void {
    travelStart(nodeName);
  }

  public fulfillCaravan(row: CommissionRowViewModel): Promise<boolean> {
    return commissionFulfill(row.caravanId);
  }

  public fulfillTown(row: TownCommissionRowViewModel): Promise<boolean> {
    return townCommissionFulfill(row.townId, row.slotId);
  }
}
