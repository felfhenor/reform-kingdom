import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { IconElementChargeComponent } from '@components/icon-element-charge/icon-element-charge.component';
import { elementBlockCharges } from '@helpers/combat/combat-element-pool.ui';
import type { ElementBlock } from '@interfaces';

@Component({
  selector: 'app-row-element-charges',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconElementChargeComponent],
  template: `
    <div class="flex flex-row flex-wrap gap-2">
      @for (element of charges(); track $index) {
        <app-icon-element-charge
          [element]="element"
          [filled]="filled()"
          size="sm"
        />
      }
    </div>
  `,
})
export class RowElementChargesComponent {
  public block = input.required<ElementBlock>();
  public filled = input<boolean>(true);

  public charges = computed(() => elementBlockCharges(this.block()));
}
