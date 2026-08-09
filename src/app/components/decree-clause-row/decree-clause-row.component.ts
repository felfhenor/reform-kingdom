import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { decreeClauseSummary, getEntry } from '@helpers';
import type { DecreeClause, ItemContent } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

const FAILURE_WARNING_THRESHOLD = 3;

@Component({
  selector: 'app-decree-clause-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-2 flex-1 min-w-0' },
  imports: [AtlasImageComponent, TippyDirective],
  templateUrl: './decree-clause-row.component.html',
})
export class DecreeClauseRowComponent {
  public clause = input.required<DecreeClause>();

  public toggleEnabled = output<void>();
  public remove = output<void>();
  public edit = output<void>();

  public summary = computed(() => decreeClauseSummary(this.clause()));
  public isFailing = computed(
    () => this.clause().failureCount >= FAILURE_WARNING_THRESHOLD,
  );

  // Only GatherMaterial has parameters worth editing in place (a material +
  // a target quantity) - the other clause types have nothing to change.
  public isEditable = computed(() => this.clause().type === 'GatherMaterial');

  // Only a GatherMaterial clause has a specific item to show an icon for.
  public materialIcon = computed(() => {
    const clause = this.clause();
    if (clause.type !== 'GatherMaterial') return undefined;
    return getEntry<ItemContent>(clause.materialId);
  });
}
