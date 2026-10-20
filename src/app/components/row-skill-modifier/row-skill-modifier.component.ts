import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconElementChargeComponent } from '@components/icon-element-charge/icon-element-charge.component';
import { IconItemPreviewComponent } from '@components/icon-item-preview/icon-item-preview.component';
import type { SkillModifierLine } from '@interfaces';

@Component({
  selector: 'app-row-skill-modifier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconElementChargeComponent, IconItemPreviewComponent],
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
        />
      }
      @for (part of entry.entries; track $index) {
        @for (segment of part.segments; track $index) {
          <span class="inline-flex items-center gap-2">
            @if (segment.art; as segmentArt) {
              <span
                class="relative inline-block overflow-hidden shrink-0 w-4 h-4"
              >
                <app-icon-item-preview
                  [sprite]="segmentArt.sprite"
                  [spritesheet]="segmentArt.spritesheet"
                  cssClass="zoom-inline"
                />
              </span>
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
}
