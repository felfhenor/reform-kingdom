import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { ModalComponent } from '@components/modal/modal.component';
import { activeTownNode } from '@helpers/engine/ui';
import { worldNodeTown } from '@helpers/world-node/world-nodes';
import type { TownModalTab } from '@interfaces';

@Component({
  selector: 'app-modal-town',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent],
  templateUrl: './modal-town.component.html',
})
export class ModalTownComponent {
  public entry = computed(() => activeTownNode());

  public town = computed(() => {
    const entry = this.entry();
    return entry ? worldNodeTown(entry) : undefined;
  });

  public currentTab = signal<TownModalTab>('shop');
}
