import type { TemplateRef } from '@angular/core';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconElementChargeComponent } from '@components/icon-element-charge/icon-element-charge.component';
import { IconSkillModifierSegmentComponent } from '@components/icon-skill-modifier-segment/icon-skill-modifier-segment.component';
import type { SkillModifierLine } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-row-skill-modifier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconElementChargeComponent,
    IconSkillModifierSegmentComponent,
    TippyDirective,
  ],
  template: `
    @let entry = line();
    <span class="inline-flex flex-wrap items-center gap-2 text-sm text-oath">
      @if (entry.label) {
        {{ entry.label }}:
      }
      @for (element of entry.elements; track element) {
        +
        <app-icon-element-charge
          class="inline-block align-middle"
          [element]="element"
          [filled]="true"
          size="sm"
          [tp]="'Generates a ' + element + ' charge'"
        />
      }
      @for (part of entry.entries; track $index) {
        @for (segment of part.segments; track $index) {
          <span class="inline-flex items-center gap-2">
            @if (segment.art) {
              <app-icon-skill-modifier-segment
                [segment]="segment"
                [skillTooltip]="skillTooltip()"
              />
            }
            <span [textContent]="segment.text"></span>
          </span>
        }
      }
    </span>
  `,
})
export class RowSkillModifierComponent {
  public line = input.required<SkillModifierLine>();
  public skillTooltip = input<TemplateRef<unknown>>();
}
