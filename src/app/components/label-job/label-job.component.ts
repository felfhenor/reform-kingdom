import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { IconSpecComponent } from '@components/icon-spec/icon-spec.component';
import { getEntry } from '@helpers/content/content';
import { characterJobLevel } from '@helpers/hero/job';
import { characterSpecNode } from '@helpers/hero/skill-tree';
import { skillTreeNodeShortName } from '@helpers/hero/skill-tree-content';
import type { Character, JobContent, JobId } from '@interfaces';

// A hero's job with their spec for it; the spec slot leads so labels line up in lists.
@Component({
  selector: 'app-label-job',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, IconSpecComponent],
  template: `
    @let jobData = job();
    @let node = spec();
    <span class="inline-flex items-center gap-2">
      <span>
        @if (showLevel()) {
          Lv. {{ level() | number }}
        }
        @if (long()) {
          {{ node ? specName() : jobData?.name }} ({{ jobData?.shorthand }})
        } @else {
          {{ jobData?.shorthand ?? 'JOB' }}
        }
      </span>

      <app-icon-spec class="pb-1" [spec]="node" />
    </span>
  `,
})
export class LabelJobComponent {
  public character = input.required<Character>();
  public jobId = input<JobId>();
  public long = input(false);
  public showLevel = input(true);

  private resolvedJobId = computed(
    () => this.jobId() ?? this.character().jobId,
  );
  public job = computed(() => getEntry<JobContent>(this.resolvedJobId()));
  public level = computed(() =>
    characterJobLevel(this.character(), this.resolvedJobId()),
  );
  public spec = computed(() =>
    characterSpecNode(this.character(), this.resolvedJobId()),
  );
  public specName = computed(() => {
    const node = this.spec();
    return node ? skillTreeNodeShortName(node) : '';
  });
}
