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
import { SFXDirective } from '@directives/sfx.directive';
import { getEntriesByType, getEntry } from '@helpers/content/content';
import { recipeResultOwnedQuantity } from '@helpers/crafting/recipes';
import { tradeskillNameForId } from '@helpers/crafting/tradeskill';
import { gatherDifficultyTier } from '@helpers/engine/difficulty-tier';
import { rangeLabel } from '@helpers/engine/leveled-range';
import { workersState } from '@helpers/state-game';
import {
  isRecipeWorkerCraftable,
  recipeWorkerLevelRange,
  recipeWorkerStaminaCost,
} from '@helpers/worker/worker-crafting';
import { workerAssignCraft } from '@helpers/worker/worker-crafting.ui';
import { workerStatsForLevel } from '@helpers/worker/worker-progression';
import type {
  DifficultyTier,
  ItemContent,
  RecipeContent,
  RecipeId,
  WorkerContent,
  WorkerId,
} from '@interfaces';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
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
    AtlasImageComponent,
    DecimalPipe,
    FormsModule,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
    SFXDirective,
  ],
  templateUrl: './panel-kingdom-workers-assignment-craft.component.html',
  styleUrl: './panel-kingdom-workers-assignment-craft.component.scss',
})
export class PanelKingdomWorkersAssignmentCraftComponent {
  public workerId = input.required<WorkerId>();

  public worker = computed(() => workersState()[this.workerId()]);
  public content = computed(() => getEntry<WorkerContent>(this.workerId()));
  public level = computed(() => this.worker()?.level ?? 1);

  public assignedRecipeId = computed(() => {
    const assignment = this.worker()?.assignment;
    return assignment && 'recipeId' in assignment
      ? assignment.recipeId
      : undefined;
  });

  // Resets once a confirmed recipe lands, so the old one never flashes back in between.
  public draftRecipeId = linkedSignal<unknown, RecipeId | undefined>({
    source: () => ({
      workerId: this.workerId(),
      recipeId: this.assignedRecipeId(),
    }),
    computation: () => undefined,
  });

  public isActive = computed(() => !!this.assignedRecipeId());

  // Assigned while out gathering - it starts once the worker is home.
  public isPending = computed(
    () => this.isActive() && this.worker()?.status.kind !== 'Crafting',
  );

  // Keeps the last recipe on screen after the worker switches to gathering.
  public shownRecipeId = linkedSignal<
    { workerId: WorkerId; recipeId?: RecipeId },
    RecipeId | undefined
  >({
    source: () => ({
      workerId: this.workerId(),
      recipeId: this.assignedRecipeId(),
    }),
    computation: (source, previous) =>
      source.recipeId ??
      (previous?.source.workerId === source.workerId
        ? previous.value
        : undefined),
  });

  public displayedRecipeId = computed(
    () => this.draftRecipeId() ?? this.shownRecipeId(),
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
    return (
      !!recipeId &&
      recipeId !== this.assignedRecipeId() &&
      this.recipeOptions().some((o) => o.recipeId === recipeId && !o.disabled)
    );
  });

  public setDraftRecipeId(recipeId: RecipeId): void {
    this.draftRecipeId.set(recipeId);
  }

  public confirm(): void {
    const recipeId = this.displayedRecipeId();
    if (!recipeId) return;

    void workerAssignCraft(this.workerId(), recipeId).then((assigned) => {
      if (!assigned) this.draftRecipeId.set(undefined);
    });
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
      name: recipe.name,
      tradeskillName: tradeskillNameForId(recipe.tradeskillId) ?? '?',
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
