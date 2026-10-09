import { DecimalPipe, formatNumber } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  LOCALE_ID,
  signal,
  viewChild,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { BarProgressComponent } from '@components/bar-progress/bar-progress.component';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { ButtonKingdomBackComponent } from '@components/button-kingdom-back/button-kingdom-back.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { IconItemPreviewComponent } from '@components/icon-item-preview/icon-item-preview.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { SlotRequirementComponent } from '@components/slot-requirement/slot-requirement.component';
import { TextNumberTweenComponent } from '@components/text-number-tween/text-number-tween.component';
import { TooltipItemPreviewComponent } from '@components/tooltip-item-preview/tooltip-item-preview.component';
import { ListReflowDirective } from '@directives/list-reflow.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { getEntriesByType, getEntry } from '@helpers/content/content';
import {
  craftQueueTicksRemaining,
  getCraftableRecipeEntries,
} from '@helpers/crafting/crafting';
import {
  craftQueueStart,
  findStackableEntryIndex,
} from '@helpers/crafting/crafting-queue';
import { craftQueueRemove } from '@helpers/crafting/crafting-queue.ui';
import { craftQueueUnitsRemaining } from '@helpers/crafting/crafting.ui';
import { filterCraftRecipeEntries } from '@helpers/crafting/recipe-filter.ui';
import {
  recipeResultContent,
  recipeResultSpritesheet,
} from '@helpers/crafting/recipes';
import {
  tradeskillActiveGate,
  tradeskillBuilding,
  tradeskillMaxQueueSize,
} from '@helpers/crafting/tradeskill';
import { formatDuration } from '@helpers/engine/timer';
import {
  craftingHideUncraftable,
  craftingHideUncraftableToggle,
  kingdomSubviewForTradeskill,
  kingdomSubviewShow,
  uiClockTick,
} from '@helpers/engine/ui';
import type {
  CollectibleContent,
  CraftQueueEntryId,
  CraftRecipeEntry,
  CraftRequirementEntry,
  RecipeContent,
  RecipeId,
  Tradeskill,
  TradeskillBuildingState,
  TradeskillContent,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { AnimationService } from '@services/animation.service';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { clamp, sortBy } from 'es-toolkit/compat';

@Component({
  selector: 'app-panel-play-kingdom-tradeskill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ListReflowDirective,
    SlotRequirementComponent,
    BlankSlateComponent,
    BarProgressComponent,
    TextNumberTweenComponent,
    AtlasImageComponent,
    CardPageComponent,
    DecimalPipe,
    IconItemPreviewComponent,
    SlotIconBlankComponent,
    ButtonKingdomBackComponent,
    SweetAlert2Module,
    TippyDirective,
    TooltipItemPreviewComponent,
    SlotRarityOutlineComponent,
    SFXDirective,
  ],
  templateUrl: './panel-play-kingdom-tradeskill.component.html',
})
export class PanelPlayKingdomTradeskillComponent {
  private locale = inject(LOCALE_ID);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private anim = inject(AnimationService);

  public tradeskill = input.required<Tradeskill>();

  public formatDuration = formatDuration;
  public kingdomSubviewShow = kingdomSubviewShow;

  // Alphabetical, to the left of the Back button. Recomputes once a second
  // (via `uiClockTick`) so the per-tradeskill queue/remaining-time tooltips
  // never look frozen.
  public tradeskillNav = computed(() => {
    uiClockTick();
    const current = this.tradeskill();

    return sortBy(
      getEntriesByType<TradeskillContent>('tradeskill'),
      (t) => t.name,
    ).map((content) => {
      const name = content.name as Tradeskill;
      const building = tradeskillBuilding(name);

      return {
        content,
        subview: kingdomSubviewForTradeskill(name),
        isCurrent: name === current,
        isIdle: building.queue.length === 0,
        tooltip: this.tradeskillNavTooltip(content, building, name),
      };
    });
  });

  private tradeskillNavTooltip(
    content: TradeskillContent,
    building: TradeskillBuildingState,
    tradeskill: Tradeskill,
  ): string {
    const level = formatNumber(building.level, this.locale);
    if (building.queue.length === 0)
      return `${content.name} Lv. ${level} (idle)`;

    const units = formatNumber(
      craftQueueUnitsRemaining(tradeskill),
      this.locale,
    );
    const remaining = formatDuration(craftQueueTicksRemaining(tradeskill));
    return `${content.name} Lv. ${level} (${units} items crafting, ${remaining} remaining)`;
  }

  public building = computed(() => tradeskillBuilding(this.tradeskill()));
  public recipeEntries = computed(() =>
    getCraftableRecipeEntries(this.tradeskill()),
  );

  public hideUncraftable = craftingHideUncraftable;
  public toggleHideUncraftable = craftingHideUncraftableToggle;

  public uncraftableCount = computed(
    () =>
      this.recipeEntries().filter((entry) => entry.maxCraftable === 0).length,
  );

  public searchText = signal('');

  public visibleRecipeEntries = computed(() =>
    filterCraftRecipeEntries(
      this.hideUncraftable()
        ? this.recipeEntries().filter((entry) => entry.maxCraftable > 0)
        : this.recipeEntries(),
      this.searchText(),
    ),
  );

  public onSearchInput(event: Event): void {
    this.searchText.set((event.target as HTMLInputElement).value);
  }

  public isQueueFullForRecipe(recipeId: RecipeId): boolean {
    const building = this.building();
    const maxSize = tradeskillMaxQueueSize(building.level, this.tradeskill());
    if (building.queue.length < maxSize) return false;

    return findStackableEntryIndex(building.queue, recipeId) === -1;
  }
  public queueSize = computed(() =>
    Array(
      tradeskillMaxQueueSize(this.building().level, this.tradeskill()),
    ).fill(null),
  );

  public gateCollectible = computed(() => {
    const gate = tradeskillActiveGate(this.tradeskill());
    return gate
      ? getEntry<CollectibleContent>(gate.requiredCollectibleId)
      : undefined;
  });

  public gateNextLevel = computed(() => this.building().level + 1);

  // Also recomputes once a second so the remaining-time text never looks frozen while the gameloop skips ticks (e.g. tab backgrounded).
  public queueViewModels = computed(() => {
    uiClockTick();

    return this.building().queue.map((entry) => {
      const recipe = getEntry<RecipeContent>(entry.recipeId);

      return {
        entry,
        resultContent: recipe ? recipeResultContent(recipe) : undefined,
        resultSpritesheet: recipe
          ? recipeResultSpritesheet(recipe)
          : ('item' as const),
        remaining: recipe
          ? formatDuration(recipe.craftTime - entry.ticksIntoCraft)
          : '',
      };
    });
  });

  private removeSwal = viewChild<SwalComponent>('removeSwal');
  private pendingRemoveEntryId = signal<CraftQueueEntryId | undefined>(
    undefined,
  );
  private quantities = signal<Record<RecipeId, number>>({});

  public quantityFor(recipeId: RecipeId): number {
    return this.quantities()[recipeId] ?? 1;
  }

  public displayQuantity(recipeId: RecipeId, maxQueueable: number): number {
    return clamp(Math.floor(this.quantityFor(recipeId)), 1, maxQueueable);
  }

  // Steps from the clamped displayed value (not the raw stored one), and
  // writes back through the signal - native `stepUp`/`stepDown` on the input
  // itself don't fire an `input` event, so driving the buttons that way left
  // the stored quantity out of sync with what was visibly shown.
  public stepQuantity(
    recipeId: RecipeId,
    maxQueueable: number,
    delta: number,
  ): void {
    const next = clamp(
      this.displayQuantity(recipeId, maxQueueable) + delta,
      1,
      maxQueueable,
    );

    this.quantities.update((quantities) => ({
      ...quantities,
      [recipeId]: next,
    }));
  }

  // Clamps live as the user types so the field never shows more than one batch can queue.
  public onQuantityInput(
    input: HTMLInputElement,
    event: Event,
    recipeId: RecipeId,
    maxQueueable: number,
  ): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    const clamped = Number.isFinite(value) ? clamp(value, 1, maxQueueable) : 1;

    this.quantities.update((quantities) => ({
      ...quantities,
      [recipeId]: clamped,
    }));

    input.value = clamped.toString();
  }

  public requirementTooltip(entry: CraftRequirementEntry): string {
    const name = entry.content?.name ?? 'Unknown';

    if (entry.kind === 'collectible') return `${name} (not consumed)`;

    const owned = formatNumber(entry.owned, this.locale);
    const quantity = formatNumber(entry.quantity, this.locale);
    return `${name} (${owned}/${quantity})`;
  }

  public xpChanceTooltip(entry: CraftRecipeEntry): string {
    return `${entry.xpChanceTier} - ${Math.round(entry.xpChance)}% chance to gain tradeskill XP. This will reduce in probability as your tradeskill level gets higher.`;
  }

  public craft(
    recipeId: RecipeId,
    maxQueueable: number,
    sourceEl: HTMLElement,
  ): void {
    const quantity = this.displayQuantity(recipeId, maxQueueable);
    const slotIndex = this.queueSlotIndexFor(recipeId);
    if (!craftQueueStart(this.tradeskill(), recipeId, quantity)) return;

    const targetEl = this.host.nativeElement.querySelector(
      `[data-queue-slot="${slotIndex}"]`,
    );
    if (targetEl) this.anim.flyTo(sourceEl, targetEl, 'pulse');
  }

  // Mirrors where the queue will put the craft: onto an existing stack, else the first free slot.
  private queueSlotIndexFor(recipeId: RecipeId): number {
    const { queue } = this.building();
    const stackIndex = findStackableEntryIndex(queue, recipeId);
    return stackIndex === -1 ? queue.length : stackIndex;
  }

  public requestRemoveQueueEntry(
    event: Event,
    entryId: CraftQueueEntryId,
    skipConfirm = false,
  ): void {
    event.preventDefault();
    this.pendingRemoveEntryId.set(entryId);
    if (skipConfirm) {
      this.confirmRemoveQueueEntry();
      return;
    }

    this.removeSwal()?.fire();
  }

  public confirmRemoveQueueEntry(): void {
    const entryId = this.pendingRemoveEntryId();
    if (!entryId) return;

    craftQueueRemove(this.tradeskill(), entryId);
    this.pendingRemoveEntryId.set(undefined);
  }
}
