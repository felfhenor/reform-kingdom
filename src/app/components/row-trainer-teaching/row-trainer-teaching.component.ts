import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RowStatSummaryComponent } from '@components/row-stat-summary/row-stat-summary.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import type { TrainerTeachingRow } from '@interfaces';

@Component({
  selector: 'app-row-trainer-teaching',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, RowStatSummaryComponent, SlotRarityOutlineComponent],
  templateUrl: './row-trainer-teaching.component.html',
})
export class RowTrainerTeachingComponent {
  public row = input.required<TrainerTeachingRow>();
  // 'teachings' is the hero's full list; 'visit' is a trainer's shop.
  public mode = input<'teachings' | 'visit'>('teachings');

  public isDimmed = computed(() =>
    this.mode() === 'teachings'
      ? !this.row().isLearned
      : !this.row().isRevealed,
  );

  public unmetPrerequisites = computed(() =>
    this.row().prerequisites.filter((prerequisite) => !prerequisite.learned),
  );

  public missingCollectibles = computed(() =>
    this.row().collectibles.filter((collectible) => !collectible.owned),
  );

  // Level is already shown on its own line, so only unmet prerequisites/collectibles are listed.
  public showRequirements = computed(
    () =>
      this.mode() === 'visit' &&
      !this.row().isLearned &&
      this.unmetPrerequisites().length + this.missingCollectibles().length > 0,
  );
}
