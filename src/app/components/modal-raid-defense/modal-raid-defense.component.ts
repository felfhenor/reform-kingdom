import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { RowRaidCombatantsComponent } from '@components/row-raid-combatants/row-raid-combatants.component';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { ModalComponent } from '@components/modal/modal.component';
import { SFXDirective } from '@directives/sfx.directive';
import { formatDuration } from '@helpers/engine/timer';
import { travelStart } from '@helpers/hero/travel';
import { raidDefenseRowViewModels } from '@helpers/town/raid/town-raid-defense.ui';

@Component({
  selector: 'app-modal-raid-defense',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RowRaidCombatantsComponent,
    BlankSlateComponent,
    ModalComponent,
    SFXDirective,
  ],
  templateUrl: './modal-raid-defense.component.html',
})
export class ModalRaidDefenseComponent {
  public rows = computed(() => raidDefenseRowViewModels());

  public etaLabel(seconds: number): string {
    return formatDuration(seconds);
  }

  public travelTo(nodeName: string): void {
    travelStart(nodeName);
  }
}
