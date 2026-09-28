import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { getEntry } from '@helpers/content/content';
import type { Character, JobContent } from '@interfaces';

@Component({
  selector: 'app-row-hero-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconJobComponent, SlotIconBlankComponent],
  host: { class: 'contents' },
  template: `
    @let job = heroJob();

    <app-slot-icon-blank>
      <app-icon-job [job]="job" />
    </app-slot-icon-blank>

    <div class="flex flex-col min-w-0">
      <span class="type-entity-name truncate">{{ hero().name }}</span>
      <span class="type-meta">
        Lv. {{ hero().level }} {{ job?.shorthand ?? 'JOB' }}
      </span>
    </div>
  `,
})
export class RowHeroSummaryComponent {
  public hero = input.required<Character>();

  public heroJob = computed(() => getEntry<JobContent>(this.hero().jobId));
}
