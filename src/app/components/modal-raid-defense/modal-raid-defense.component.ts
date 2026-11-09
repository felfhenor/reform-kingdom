import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { RowRaidCombatantsComponent } from '@components/row-raid-combatants/row-raid-combatants.component';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { ButtonTravelHereComponent } from '@components/button-travel-here/button-travel-here.component';
import { ModalComponent } from '@components/modal/modal.component';
import { raidDefenseRowViewModels } from '@helpers/town/raid/town-raid-defense.ui';

@Component({
  selector: 'app-modal-raid-defense',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RowRaidCombatantsComponent,
    BlankSlateComponent,
    ButtonTravelHereComponent,
    ModalComponent,
  ],
  templateUrl: './modal-raid-defense.component.html',
})
export class ModalRaidDefenseComponent {
  public rows = computed(() => raidDefenseRowViewModels());
}
