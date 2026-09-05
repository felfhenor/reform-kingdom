import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { SlotCommissionComponent } from '@components/slot-commission/slot-commission.component';
import { travelStart } from '@helpers/hero/travel';
import {
  townCommissionFulfill,
  townCommissionRowViewModels,
} from '@helpers/town/town-commission-fulfill';
import type { TownCommissionRowViewModel, WorldNodeEntry } from '@interfaces';

@Component({
  selector: 'app-panel-town-quests',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SlotCommissionComponent],
  template: `
    <div class="flex flex-col gap-2">
      @for (row of commissions(); track row.slotId) {
        <app-slot-commission
          [row]="row"
          [fulfill]="() => fulfillCommission(row)"
          (travel)="travelToTown()"
        />
      } @empty {
        <p class="text-sm text-lighter italic">
          No commissions are available yet.
        </p>
      }
    </div>
  `,
})
export class PanelTownQuestsComponent {
  public entry = input.required<WorldNodeEntry>();

  public commissions = computed<TownCommissionRowViewModel[]>(() =>
    townCommissionRowViewModels(this.entry()),
  );

  public fulfillCommission(row: TownCommissionRowViewModel): Promise<boolean> {
    return townCommissionFulfill(row.townId, row.slotId);
  }

  public travelToTown(): void {
    travelStart(this.entry().nodeName);
  }
}
