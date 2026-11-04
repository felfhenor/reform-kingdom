import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { PagePagedGridComponent } from '@components/page-paged-grid/page-paged-grid.component';
import { SlotMuseumCollectibleComponent } from '@components/slot-museum-collectible/slot-museum-collectible.component';
import { SlotMuseumItemComponent } from '@components/slot-museum-item/slot-museum-item.component';
import { SlotMuseumRecipeComponent } from '@components/slot-museum-recipe/slot-museum-recipe.component';
import { SFXDirective } from '@directives/sfx.directive';
import { getEntry } from '@helpers/content/content';
import { recipeUnlockWithTokens } from '@helpers/crafting/recipes.ui';
import { notifyError, notifySuccess } from '@helpers/engine/notify';
import {
  filterMuseumCollectibleEntries,
  filterMuseumItemEntries,
  filterMuseumRecipeEntries,
  getMuseumCollectibleEntries,
  getMuseumItemEntries,
  getMuseumRecipeEntries,
} from '@helpers/kingdom/museum.ui';
import { isFelDefeated } from '@helpers/lore';
import {
  type MuseumCollectibleEntry,
  type MuseumItemEntry,
  type MuseumRecipeEntry,
  type MuseumTab,
  type RecipeContent,
  type RecipeId,
} from '@interfaces';

@Component({
  selector: 'app-play-kingdom-museum',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SlotMuseumCollectibleComponent,
    SlotMuseumRecipeComponent,
    PagePagedGridComponent,
    SFXDirective,
    NgTemplateOutlet,
    SlotMuseumItemComponent,
  ],
  templateUrl: './play-kingdom-museum.component.html',
  styleUrl: './play-kingdom-museum.component.scss',
})
export class PlayKingdomMuseumComponent {
  // Two grid instances (one per tab) rather than one bound to a union entry
  // type - each tab's slot component expects its own concrete entry shape,
  // and only one grid is ever in the DOM at a time via the tab `@if`/`@else`.
  private collectiblesGrid =
    viewChild<PagePagedGridComponent<MuseumCollectibleEntry>>(
      'collectiblesGrid',
    );
  private recipesGrid =
    viewChild<PagePagedGridComponent<MuseumRecipeEntry>>('recipesGrid');
  private itemsGrid =
    viewChild<PagePagedGridComponent<MuseumItemEntry>>('itemsGrid');

  public activeTab = signal<MuseumTab>('collectibles');

  public collectibleEntries = computed(() => getMuseumCollectibleEntries());
  public recipeEntries = computed(() => getMuseumRecipeEntries());
  public itemEntries = computed(() => getMuseumItemEntries());

  public collectibleFilterFn = filterMuseumCollectibleEntries;
  public recipeFilterFn = filterMuseumRecipeEntries;
  public itemFilterFn = filterMuseumItemEntries;

  public collectibleDiscoveredCount = computed(
    () => this.collectibleEntries().filter((entry) => entry.discovered).length,
  );
  public recipeDiscoveredCount = computed(
    () => this.recipeEntries().filter((entry) => entry.discovered).length,
  );
  public itemDiscoveredCount = computed(
    () => this.itemEntries().filter((entry) => entry.discovered).length,
  );

  public shouldShowSpoilerTabs = computed(() => isFelDefeated());

  public setTab(tab: MuseumTab): void {
    this.activeTab.set(tab);
    this.collectiblesGrid()?.resetPage();
    this.recipesGrid()?.resetPage();
    this.itemsGrid()?.resetPage();
  }

  public async unlockRecipe(recipeId: RecipeId): Promise<void> {
    if (!(await recipeUnlockWithTokens(recipeId))) {
      notifyError('Not enough Trader Scrips to unlock this recipe.');
      return;
    }

    const recipe = getEntry<RecipeContent>(recipeId);
    if (!recipe) return;

    notifySuccess(`Recipe "${recipe.name}" unlocked!`);
  }
}
