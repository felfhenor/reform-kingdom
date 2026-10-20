import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconElementChargeComponent } from '@components/icon-element-charge/icon-element-charge.component';
import type { SkillModifierLine } from '@interfaces';

@Component({
  selector: 'app-row-skill-modifier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconElementChargeComponent],
  template: `
    @let entry = line();
    <span class="inline-flex flex-wrap items-center gap-2 text-sm text-oath">
      {{ entry.label }}:
      @for (element of entry.elements; track element) {
        +
        <app-icon-element-charge
          class="inline-block align-middle"
          [element]="element"
          [filled]="true"
          size="sm"
        />
      }
      {{ entry.texts.join('; ') }}
    </span>
  `,
})
export class RowSkillModifierComponent {
  public line = input.required<SkillModifierLine>();
}
