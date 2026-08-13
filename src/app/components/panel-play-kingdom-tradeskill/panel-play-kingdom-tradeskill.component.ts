import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { ButtonKingdomBackComponent } from '@components/button-kingdom-back/button-kingdom-back.component';
import {
  craftQueueRemove,
  craftQueueStart,
  formatDuration,
  getCraftableRecipeEntries,
  getEntry,
  recipeResultContent,
  recipeResultSpritesheet,
  tradeskillActiveGate,
  tradeskillBuilding,
  tradeskillMaxQueueSize,
  uiClockTick,
} from '@helpers';
import type {
  CollectibleContent,
  CraftQueueEntryId,
  CraftRequirementEntry,
  RecipeContent,
  RecipeId,
  Tradeskill,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { clamp } from 'es-toolkit/compat';

@Component({
  selector: 'app-panel-play-kingdom-tradeskill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    CardPageComponent,
    SlotIconBlankComponent,
    ButtonKingdomBackComponent,
    SweetAlert2Module,
    TippyDirective,
  ],
  templateUrl: './panel-play-kingdom-tradeskill.component.html',
})
export class PanelPlayKingdomTradeskillComponent {
  public tradeskill = input.required<Tradeskill>();

  public formatDuration = formatDuration;

  public building = computed(() => tradeskillBuilding(this.tradeskill()));
  public recipeEntries = computed(() =>
    getCraftableRecipeEntries(this.tradeskill()),
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
    if (entry.kind === 'item') return `${name} x${entry.quantity}`;
    return name;
  }

  public xpChanceTooltip(xpChance: number): string {
    return `${Math.round(xpChance)}% chance to gain tradeskill XP`;
  }

  public craft(recipeId: RecipeId, maxCraftable: number): void {
    const quantity = clamp(
      1,
      Math.floor(this.quantityFor(recipeId)),
      maxCraftable,
    );
    craftQueueStart(this.tradeskill(), recipeId, quantity);
    this.quantities.update((quantities) => ({ ...quantities, [recipeId]: 1 }));
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
