import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  viewChild,
} from '@angular/core';
import { DetailMonsterSummaryComponent } from '@components/detail-monster-summary/detail-monster-summary.component';
import { bestiaryEntry } from '@helpers/kingdom/bestiary.ui';
import type { MonsterContent } from '@interfaces';

@Component({
  selector: 'app-tooltip-monster-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DetailMonsterSummaryComponent],
  host: { class: 'hidden' },
  template: `
    <ng-template #tooltipContent>
      <div class="p-2 max-w-[400px]">
        <app-detail-monster-summary [entry]="entry()" [level]="level()" />
      </div>
    </ng-template>
  `,
})
export class TooltipMonsterPreviewComponent {
  public monster = input.required<MonsterContent>();
  public level = input<number>();

  // Only used where the monster is already on screen (combat, raids), so it never shows as "???".
  public entry = computed(() => ({
    ...bestiaryEntry(this.monster()),
    discovered: true,
  }));

  public template = viewChild.required<TemplateRef<unknown>>('tooltipContent');
}
