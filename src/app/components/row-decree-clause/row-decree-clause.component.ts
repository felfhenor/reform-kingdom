import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconComponent } from '@components/icon/icon.component';
import { SFXDirective } from '@directives/sfx.directive';
import { getEntry } from '@helpers/content/content';
import { farmNodeRewardQuantity } from '@helpers/decree/decree-farm-node';
import { decreeClauseSummary } from '@helpers/decree/decree.ui';
import { getMaterialQuantity } from '@helpers/item/materials';
import { rewardContentInfo } from '@helpers/world-node/world-node-rewards';
import type { DecreeClause, ItemContent, RewardContentInfo } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { AnimationService } from '@services/animation.service';

const FAILURE_WARNING_THRESHOLD = 3;

// Clause types with parameters worth editing in place - the rest have
// nothing to change.
const EDITABLE_CLAUSE_TYPES: DecreeClause['type'][] = [
  'GatherMaterial',
  'FarmNode',
  'FinishUnfinishedAreas',
  'LevelUpParty',
  'DefendTowns',
];

@Component({
  selector: 'app-row-decree-clause',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-2 flex-1 min-w-0' },
  imports: [
    AtlasImageComponent,
    TippyDirective,
    SFXDirective,
    DecimalPipe,
    IconComponent,
  ],
  templateUrl: './row-decree-clause.component.html',
})
export class RowDecreeClauseComponent {
  private anim = inject(AnimationService);
  private el = inject(ElementRef<HTMLElement>);
  private hasInitialized = false;

  public clause = input.required<DecreeClause>();

  public toggleEnabled = output<void>();
  public remove = output<void>();
  public edit = output<void>();

  constructor() {
    // Same clause id, new params - decreeClauseUpdate replaces the clause object in place,
    // so this only fires on a real edit, not on the row's initial mount/add.
    effect(() => {
      this.clause();
      untracked(() => {
        if (!this.hasInitialized) {
          this.hasInitialized = true;
          return;
        }
        this.anim.pulse(this.el.nativeElement);
      });
    });
  }

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

  // GatherMaterial/FarmNode target a specific reward, so "how many do I already have" is meaningful; other clause types have no single item to count.
  public ownedQuantity = computed<number | undefined>(() => {
    const clause = this.clause();

    if (clause.type === 'GatherMaterial') {
      return getMaterialQuantity(clause.materialId);
    }

    if (clause.type === 'FarmNode')
      return farmNodeRewardQuantity(clause.reward);

    return undefined;
  });
}
