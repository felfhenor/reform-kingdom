import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { SlotMuseumCollectibleComponent } from '@components/slot-museum-collectible/slot-museum-collectible.component';
import { SlotMuseumRecipeComponent } from '@components/slot-museum-recipe/slot-museum-recipe.component';
import { PagePagedGridComponent } from '@components/page-paged-grid/page-paged-grid.component';
import {
  filterMuseumCollectibleEntries,
  filterMuseumRecipeEntries,
  getMuseumCollectibleEntries,
  getMuseumRecipeEntries,
} from '@helpers';
import type {
  MuseumCollectibleEntry,
  MuseumRecipeEntry,
  MuseumTab,
} from '@interfaces';

@Component({
  selector: 'app-play-kingdom-museum',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SlotMuseumCollectibleComponent,
    SlotMuseumRecipeComponent,
    PagePagedGridComponent,
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

  public activeTab = signal<MuseumTab>('collectibles');

  public collectibleEntries = computed(() => getMuseumCollectibleEntries());
  public recipeEntries = computed(() => getMuseumRecipeEntries());

  public collectibleFilterFn = filterMuseumCollectibleEntries;
  public recipeFilterFn = filterMuseumRecipeEntries;

  public collectibleDiscoveredCount = computed(
    () => this.collectibleEntries().filter((entry) => entry.discovered).length,
  );
  public recipeDiscoveredCount = computed(
    () => this.recipeEntries().filter((entry) => entry.discovered).length,
  );

  public setTab(tab: MuseumTab): void {
    this.activeTab.set(tab);
    this.collectiblesGrid()?.resetPage();
    this.recipesGrid()?.resetPage();
  }
}
