import { DecimalPipe } from '@angular/common';
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
  imports: [DecimalPipe, SlotCommissionComponent],
  host: { class: 'card bg-base-200 shadow-sm flex flex-col min-h-0' },
  templateUrl: './panel-town-quests.component.html',
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
