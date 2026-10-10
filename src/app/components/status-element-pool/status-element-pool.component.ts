import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { IconElementChargeComponent } from '@components/icon-element-charge/icon-element-charge.component';
import { elementPool } from '@helpers/combat/combat-element-pool';
import { COMBAT_ELEMENT_CHARGES_PER_ELEMENT } from '@helpers/config';
import type { Combat } from '@interfaces';
import { GameElementOrder } from '@interfaces';
import { range } from 'es-toolkit/compat';

@Component({
  selector: 'app-status-element-pool',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconElementChargeComponent],
  template: `
    <div class="flex flex-col gap-2">
      @for (row of rows(); track row.element) {
        <div class="flex flex-row gap-2">
          @for (slot of slots; track slot) {
            <app-icon-element-charge
              [element]="row.element"
              [filled]="slot < row.charges"
              [size]="expanded() ? 'md' : 'sm'"
              [canGlow]="true"
            />
          }
        </div>
      }
    </div>
  `,
})
export class StatusElementPoolComponent {
  public combat = input.required<Combat>();
  public expanded = input<boolean>(false);

  public readonly slots = range(COMBAT_ELEMENT_CHARGES_PER_ELEMENT);

  public rows = computed(() => {
    const pool = elementPool(this.combat());
    return GameElementOrder.map((element) => ({
      element,
      charges: pool[element],
    }));
  });
}
