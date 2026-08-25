import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { ButtonKingdomBackComponent } from '@components/button-kingdom-back/button-kingdom-back.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { SlotCommissionComponent } from '@components/slot-commission/slot-commission.component';
import { commissionRowViewModel } from '@helpers/commission/commission-fulfill';
import { nextCommissionResetAt } from '@helpers/commission/commission-reset';
import { formatDuration } from '@helpers/engine/timer';
import { uiClockTick } from '@helpers/engine/ui';
import { travelStart } from '@helpers/hero/travel';
import { worldNodesOfType } from '@helpers/world-node/world-nodes';
import type { CommissionRowViewModel } from '@interfaces';

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
  // Every caravan resets on the same wall-clock boundary, so one shared
  // countdown covers all rows - recomputes once a second via uiClockTick so
  // it doesn't look frozen between gameloop ticks.
  public resetLabel = computed(() => {
    uiClockTick();
    const msRemaining = nextCommissionResetAt() - Date.now();
    return formatDuration(Math.floor(msRemaining / 1000));
  });

  public rows = computed<CommissionRowViewModel[]>(() =>
    worldNodesOfType('CaravanNode')
      .map((entry) => commissionRowViewModel(entry))
      .filter((row): row is CommissionRowViewModel => !!row),
  );

  public travelTo(nodeName: string): void {
    travelStart(nodeName);
  }
}
