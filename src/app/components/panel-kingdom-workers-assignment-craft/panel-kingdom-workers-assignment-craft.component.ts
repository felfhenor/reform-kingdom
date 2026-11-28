import { TPipe } from '@pipes/t.pipe';
import { contentName, contentNameById } from '@helpers/i18n/i18n-content';
import { FFSelectDirective } from '@ff/controls/ff-select.directive';
import { FFStepperDirective } from '@ff/controls/ff-stepper.directive';
import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconComponent } from '@components/icon/icon.component';
import { SFXDirective } from '@directives/sfx.directive';
import { getEntriesByType, getEntry } from '@helpers/content/content';
import { recipeResultOwnedQuantity } from '@helpers/crafting/recipes';
import { gatherDifficultyTier } from '@helpers/engine/difficulty-tier';
import { rangeLabel } from '@helpers/engine/leveled-range';
import { workersState } from '@helpers/state-game';
import {
  isRecipeWorkerCraftable,
  recipeWorkerLevelRange,
  recipeWorkerStaminaCost,
} from '@helpers/worker/worker-crafting';
import { workerAssignCraft } from '@helpers/worker/worker-crafting.ui';
import { workerOrderCount } from '@helpers/worker/worker-order';
import {
  workerAssignmentSameJob,
  workerOrderDraftKept,
} from '@helpers/worker/worker-order.ui';
import {
  kingdomWorkerStatsForLevel,
  workerStatsForLevel,
} from '@helpers/worker/worker-progression';
import type {
  DifficultyTier,
  ItemContent,
  RecipeContent,
  RecipeId,
  WorkerContent,
  WorkerId,
  WorkerOrderDraftSource,
} from '@interfaces';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { TippyDirective } from '@ngneat/helipopper';
import { sortBy } from 'es-toolkit/compat';

type RecipeOption = {
  recipeId: RecipeId;
  name: string;
  tradeskillName: string;
  sprite: string;
  staminaCost: number;
  levelRangeLabel: string;
  difficulty: DifficultyTier;
  maxLevel: number;
  owned: number;
  disabled: boolean;
};

@Component({
  selector: 'app-panel-kingdom-workers-assignment-craft',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TPipe,
    FFSelectDirective,
    FFStepperDirective,
    AtlasImageComponent,
    DecimalPipe,
    IconComponent,
    FormsModule,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
    SFXDirective,
    TippyDirective,
  ],
  templateUrl: './panel-kingdom-workers-assignment-craft.component.html',
  styleUrl: './panel-kingdom-workers-assignment-craft.component.scss',
})
export class PanelKingdomWorkersAssignmentCraftComponent {
  public workerId = input.required<WorkerId>();

  public worker = computed(() => workersState()[this.workerId()]);
  public content = computed(() => getEntry<WorkerContent>(this.workerId()));
  public level = computed(() => this.worker()?.level ?? 1);

  public craftSpeed = computed(() => {
    const content = this.content();
    return content
      ? kingdomWorkerStatsForLevel(content, this.level()).craftSpeed
      : 0;
  });

  private craftAssignment = computed(() => {
    const assignment = this.worker()?.assignment;
    return assignment && 'recipeId' in assignment ? assignment : undefined;
  });

  public assignedRecipeId = computed(() => this.craftAssignment()?.recipeId);

  // Ignores the ticking count, so drafts reset only when a confirm changes the job.
  private assignment = computed(() => this.worker()?.assignment, {
    equal: workerAssignmentSameJob,
  });
  private draftSource = computed(() => ({
    workerId: this.workerId(),
    assignment: this.assignment(),
  }));
  public draftRecipeId = linkedSignal<unknown, RecipeId | undefined>({
    source: this.draftSource,
    computation: () => undefined,
  });
  public draftCount = linkedSignal<WorkerOrderDraftSource, string | undefined>({
    source: () => ({
      job: this.draftSource(),
      remaining: this.craftAssignment()?.remaining,
    }),
    computation: (source, previous) =>
      !!previous &&
      previous.source.job === source.job &&
      workerOrderDraftKept(previous.value, source.remaining)
        ? previous.value
        : undefined,
  });

  // The live count only belongs to the recipe it's counting, not a different one being picked.
  public displayedCount = computed(() => {
    const sameJob = this.displayedRecipeId() === this.assignedRecipeId();
    const live = sameJob
      ? this.craftAssignment()?.remaining?.toString()
      : undefined;
    return this.draftCount() ?? live ?? '';
  });

  public isActive = computed(() => !!this.assignedRecipeId());

  // Assigned while out on a trip - it starts once the worker is home.
  public isPending = computed(
    () => this.isActive() && this.worker()?.status.kind !== 'Crafting',
  );

  public displayedRecipeId = computed(
    () => this.draftRecipeId() ?? this.assignedRecipeId(),
  );

  public recipeOptions = computed<RecipeOption[]>(() => {
    const content = this.content();
    const level = this.level();
    const stamina = content ? workerStatsForLevel(content, level).stamina : 0;

    const options = getEntriesByType<RecipeContent>('recipe')
      .filter(isRecipeWorkerCraftable)
      .map((recipe) => this.recipeOption(recipe, level, stamina))
      .filter((option): option is RecipeOption => !!option);

    return sortBy(options, [(o) => o.tradeskillName, (o) => o.name]);
  });

  public canConfirm = computed(() => {
    const recipeId = this.displayedRecipeId();
    const countChanged =
      workerOrderCount(Number(this.displayedCount())) !==
      this.craftAssignment()?.remaining;
    return (
      !!recipeId &&
      (recipeId !== this.assignedRecipeId() || countChanged) &&
      this.recipeOptions().some((o) => o.recipeId === recipeId && !o.disabled)
    );
  });

  public setDraftRecipeId(recipeId: RecipeId): void {
    this.draftRecipeId.set(recipeId);
  }

  public confirm(): void {
    const recipeId = this.displayedRecipeId();
    if (!recipeId) return;

    const count = Number(this.displayedCount());
    void workerAssignCraft(this.workerId(), recipeId, count).then(
      (assigned) => {
        if (assigned) return;
        this.draftRecipeId.set(undefined);
        this.draftCount.set(undefined);
      },
    );
  }

  private recipeOption(
    recipe: RecipeContent,
    level: number,
    stamina: number,
  ): RecipeOption | undefined {
    if (!('itemId' in recipe.result)) return undefined;
    const item = getEntry<ItemContent>(recipe.result.itemId);
    if (!item) return undefined;

    const range = recipeWorkerLevelRange(recipe);
    const staminaCost = recipeWorkerStaminaCost(recipe);

    return {
      recipeId: recipe.id,
      name: contentName(recipe),
      tradeskillName: contentNameById(recipe.tradeskillId) ?? '?',
      sprite: item.sprite,
      staminaCost,
      levelRangeLabel: rangeLabel(range),
      difficulty: gatherDifficultyTier(range, level),
      maxLevel: range.max,
      owned: recipeResultOwnedQuantity(recipe),
      disabled: stamina < staminaCost,
    };
  }
}
