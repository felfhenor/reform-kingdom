import { DecimalPipe, formatNumber } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  signal,
  viewChild,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { ButtonKingdomBackComponent } from '@components/button-kingdom-back/button-kingdom-back.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { TooltipItemPreviewComponent } from '@components/tooltip-item-preview/tooltip-item-preview.component';
import { getEntriesByType, getEntry } from '@helpers/content';
import {
  craftQueueTicksRemaining,
  craftQueueUnitsRemaining,
  getCraftableRecipeEntries,
} from '@helpers/crafting';
import { craftQueueRemove, craftQueueStart } from '@helpers/crafting-queue';
import { recipeResultContent, recipeResultSpritesheet } from '@helpers/recipes';
import { formatDuration } from '@helpers/timer';
import {
  tradeskillActiveGate,
  tradeskillBuilding,
  tradeskillMaxQueueSize,
} from '@helpers/tradeskill';
import {
  craftingHideUncraftable,
  craftingHideUncraftableToggle,
  kingdomSubviewForTradeskill,
  kingdomSubviewShow,
  uiClockTick,
} from '@helpers/ui';
import type {
  CollectibleContent,
  CraftQueueEntryId,
  CraftRequirementEntry,
  RecipeContent,
  RecipeId,
  Tradeskill,
  TradeskillBuildingState,
  TradeskillContent,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { clamp, sortBy } from 'es-toolkit/compat';

@Component({
  selector: 'app-panel-play-kingdom-tradeskill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    CardPageComponent,
    DecimalPipe,
    SlotIconBlankComponent,
    ButtonKingdomBackComponent,
    SweetAlert2Module,
    TippyDirective,
    TooltipItemPreviewComponent,
  ],
  templateUrl: './panel-play-kingdom-tradeskill.component.html',
})
export class PanelPlayKingdomTradeskillComponent {
  private locale = inject(LOCALE_ID);

  public tradeskill = input.required<Tradeskill>();

  public formatDuration = formatDuration;
  public kingdomSubviewShow = kingdomSubviewShow;

  // Alphabetical, to the left of the Back button - see the pageactions row
  // in the template. Recomputes once a second (via `uiClockTick`) so the
  // per-tradeskill queue/remaining-time tooltips never look frozen.
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
      return `${content.name} Lv.${level} (idle)`;

    const units = formatNumber(
      craftQueueUnitsRemaining(tradeskill),
      this.locale,
    );
    const remaining = formatDuration(craftQueueTicksRemaining(tradeskill));
    return `${content.name} Lv.${level} (${units} items crafting, ${remaining} remaining)`;
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

  public visibleRecipeEntries = computed(() =>
    this.hideUncraftable()
      ? this.recipeEntries().filter((entry) => entry.maxCraftable > 0)
      : this.recipeEntries(),
  );
  public isQueueFull = computed(
    () =>
      this.building().queue.length >=
      tradeskillMaxQueueSize(this.building().level),
  );
  public queueSize = computed(() =>
    Array(tradeskillMaxQueueSize(this.building().level)).fill(null),
  );

  public xpPercent = computed(() => {
    const { current, maximum } = this.building().xp;
    return maximum > 0
      ? Math.min(100, Math.round((current / maximum) * 100))
      : 0;
  });

  public gateCollectible = computed(() => {
    const gate = tradeskillActiveGate(this.tradeskill());
    return gate
      ? getEntry<CollectibleContent>(gate.requiredCollectibleId)
      : undefined;
  });

  public gateNextLevel = computed(() => this.building().level + 1);

  // Recomputes whenever `gamestate()` changes AND once a second regardless
  // (via `uiClockTick`), so the remaining-time text never looks frozen even
  // if the gameloop itself is skipping ticks (e.g. tab backgrounded).
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

  // Clamps the stored selection against the recipe's current craftable
  // ceiling, so it's never shown above what's actually craftable. This is
  // what keeps the field showing the last-used quantity after a craft (or a
  // lower value if resources no longer support it) without needing to know
  // the post-craft state directly - gamestate updates asynchronously, so
  // recomputing craftability right after `craftQueueStart` would still see
  // stale, pre-craft resource counts.
  public displayQuantity(recipeId: RecipeId, maxCraftable: number): number {
    return clamp(Math.floor(this.quantityFor(recipeId)), 1, maxCraftable);
  }

  // Steps from the clamped displayed value (not the raw stored one), and
  // writes back through the signal - native `stepUp`/`stepDown` on the input
  // itself don't fire an `input` event, so driving the buttons that way left
  // the stored quantity out of sync with what was visibly shown.
  public stepQuantity(
    recipeId: RecipeId,
    maxCraftable: number,
    delta: number,
  ): void {
    const next = clamp(
      this.displayQuantity(recipeId, maxCraftable) + delta,
      1,
      maxCraftable,
    );

    this.quantities.update((quantities) => ({
      ...quantities,
      [recipeId]: next,
    }));
  }

  // Clamps live as the user types (rather than only on Craft) so the field
  // can never visually sit above what's actually craftable, and resets to 1
  // if the field is cleared entirely.
  public onQuantityInput(
    event: Event,
    recipeId: RecipeId,
    maxCraftable: number,
  ): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    const clamped = Number.isFinite(value) ? clamp(value, 1, maxCraftable) : 1;

    this.quantities.update((quantities) => ({
      ...quantities,
      [recipeId]: clamped,
    }));
  }

  public requirementTooltip(entry: CraftRequirementEntry): string {
    const name = entry.content?.name ?? 'Unknown';

    if (entry.kind === 'collectible') return `${name} (not consumed)`;

    const owned = formatNumber(entry.owned, this.locale);
    const quantity = formatNumber(entry.quantity, this.locale);
    return `${name} (${owned}/${quantity})`;
  }

  public xpChanceTooltip(xpChance: number): string {
    return `${Math.round(xpChance)}% chance to gain tradeskill XP`;
  }

  public craft(recipeId: RecipeId, maxCraftable: number): void {
    const quantity = this.displayQuantity(recipeId, maxCraftable);
    craftQueueStart(this.tradeskill(), recipeId, quantity);
  }

  public onQueueEntryContextMenu(
    event: MouseEvent,
    entryId: CraftQueueEntryId,
  ): void {
    event.preventDefault();
    this.pendingRemoveEntryId.set(entryId);
    this.removeSwal()?.fire();
  }

  public confirmRemoveQueueEntry(): void {
    const entryId = this.pendingRemoveEntryId();
    if (!entryId) return;

    craftQueueRemove(this.tradeskill(), entryId);
    this.pendingRemoveEntryId.set(undefined);
  }
}
