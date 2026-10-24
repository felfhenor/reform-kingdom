import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  viewChild,
} from '@angular/core';
import type { GlobalEffect, GlobalEffectContent } from '@interfaces';

@Component({
  selector: 'app-tooltip-global-effect',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'hidden' },
  template: `
    <ng-template #tooltipContent>
      @let e = effect();
      <div class="p-2 max-w-[400px]">
        <div class="type-entity-name mb-2">{{ e.name }}</div>

        <p>{{ description() ?? e.description }}</p>

        @if (e.extendedDescription; as extended) {
          <p class="type-meta mt-2">{{ extended }}</p>
        }
      </div>
    </ng-template>
  `,
})
export class TooltipGlobalEffectComponent {
  public effect = input.required<
    GlobalEffectContent & Pick<Partial<GlobalEffect>, 'extendedDescription'>
  >();
  // Overrides the stored description with live text (e.g. Auto Mode's status).
  public description = input<string>();

  public template = viewChild.required<TemplateRef<unknown>>('tooltipContent');
}
