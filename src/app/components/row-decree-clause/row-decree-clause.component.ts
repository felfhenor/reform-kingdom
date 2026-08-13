import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { decreeClauseSummary, getEntry, rewardContentInfo } from '@helpers';
import type { DecreeClause, ItemContent, RewardContentInfo } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

const FAILURE_WARNING_THRESHOLD = 3;

// Clause types with parameters worth editing in place - the rest have
// nothing to change (see `isEditable`).
const EDITABLE_CLAUSE_TYPES: DecreeClause['type'][] = [
  'GatherMaterial',
  'FarmNode',
];

@Component({
  selector: 'app-row-decree-clause',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-2 flex-1 min-w-0' },
  imports: [AtlasImageComponent, TippyDirective],
  templateUrl: './row-decree-clause.component.html',
})
export class RowDecreeClauseComponent {
  public clause = input.required<DecreeClause>();

  public toggleEnabled = output<void>();
  public remove = output<void>();
  public edit = output<void>();

  public summary = computed(() => decreeClauseSummary(this.clause()));
  public isFailing = computed(
    () => this.clause().failureCount >= FAILURE_WARNING_THRESHOLD,
  );

  public isEditable = computed(() =>
    EDITABLE_CLAUSE_TYPES.includes(this.clause().type),
  );

  // Only GatherMaterial (its material) and FarmNode (its reward) have a
  // specific icon to show - the other clause types have nothing to display.
  public icon = computed<RewardContentInfo | undefined>(() => {
    const clause = this.clause();

    if (clause.type === 'GatherMaterial') {
      const item = getEntry<ItemContent>(clause.materialId);
      return item
        ? { name: item.name, sprite: item.sprite, spritesheet: 'item' }
        : undefined;
    }

    if (clause.type === 'FarmNode') return rewardContentInfo(clause.reward);

    return undefined;
  });
}
