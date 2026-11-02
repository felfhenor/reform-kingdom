import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { BarProgressComponent } from '@components/bar-progress/bar-progress.component';
import { ModalComponent } from '@components/modal/modal.component';
import { isFelDefeated } from '@helpers/lore/outro';
import {
  remembranceOverall,
  remembranceRows,
} from '@helpers/remembrance/remembrance.ui';

@Component({
  selector: 'app-modal-remembrance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BarProgressComponent, DecimalPipe, ModalComponent],
  templateUrl: './modal-remembrance.component.html',
})
export class ModalRemembranceComponent {
  public isUnlocked = computed(() => isFelDefeated());
  public rows = computed(() => remembranceRows());
  public overall = computed(() => remembranceOverall(this.rows()));
}
