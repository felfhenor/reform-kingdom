import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  viewChild,
} from '@angular/core';
import { DetailItemPreviewComponent } from '@components/detail-item-preview/detail-item-preview.component';
import { resolveRewardDisplay } from '@helpers/item/item-preview';
import { recipeKnownSourceNames } from '@helpers/kingdom/museum.ui';
import type { RecipeContent } from '@interfaces';

@Component({
  selector: 'app-tooltip-recipe-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DetailItemPreviewComponent],
  host: { class: 'hidden' },
  template: `
    <ng-template #tooltipContent>
      @let item = display();
      @if (item) {
        <div class="max-w-[400px]">
          <app-detail-item-preview [display]="item">
            @let sources = sourceNames();
            @if (sources.length > 0) {
              <div class="text-xs mt-2">Found in: {{ sources.join(', ') }}</div>
            }
          </app-detail-item-preview>
        </div>
      }
    </ng-template>
  `,
})
export class TooltipRecipePreviewComponent {
  public recipe = input.required<RecipeContent>();
  // Crafting lists pass the recipe's own name to match their rows; drops and the museum keep the "<Tradeskill> Recipe: X" form.
  public name = input<string>();

  public display = computed(() => {
    const display = resolveRewardDisplay({ recipeId: this.recipe().id });
    const name = this.name();
    return display && name ? { ...display, name } : display;
  });

  public sourceNames = computed(() => recipeKnownSourceNames(this.recipe()));

  public template = viewChild.required<TemplateRef<unknown>>('tooltipContent');
}
