import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  viewChild,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import type { AchievementContent } from '@interfaces';

@Component({
  selector: 'app-tooltip-achievement',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AtlasImageComponent],
  host: { class: 'hidden' },
  template: `
    <ng-template #tooltipContent>
      @let a = achievement();
      <div class="flex flex-row gap-4 p-2 max-w-[400px]">
        <div class="w-[64px] h-[64px] min-w-[64px] min-h-[64px] shrink-0">
          <app-atlas-image spritesheet="achievement" [assetName]="a.sprite" />
        </div>

        <div class="flex flex-col gap-2">
          <span class="type-entity-name">{{ a.name }}</span>
          <p>{{ a.description }}</p>
        </div>
      </div>
    </ng-template>
  `,
})
export class TooltipAchievementComponent {
  public achievement = input.required<AchievementContent>();

  public template = viewChild.required<TemplateRef<unknown>>('tooltipContent');
}
