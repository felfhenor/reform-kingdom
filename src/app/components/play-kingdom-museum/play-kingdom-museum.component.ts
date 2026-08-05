import type { ElementRef, OnDestroy } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { MuseumCollectibleSlotComponent } from '@components/museum-collectible-slot/museum-collectible-slot.component';
import {
  filterMuseumCollectibleEntries,
  getMuseumCollectibleEntries,
  kingdomSubviewClear,
} from '@helpers';

const CELL_FOOTPRINT_PX = 72;

type MuseumTab = 'collectibles' | 'recipes';

@Component({
  selector: 'app-play-kingdom-museum',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardPageComponent, MuseumCollectibleSlotComponent],
  templateUrl: './play-kingdom-museum.component.html',
  styleUrl: './play-kingdom-museum.component.scss',
})
export class PlayKingdomMuseumComponent implements OnDestroy {
  private gridContainer =
    viewChild<ElementRef<HTMLDivElement>>('gridContainer');
  private gridResizeObserver: ResizeObserver | undefined;

  public activeTab = signal<MuseumTab>('collectibles');

  public searchText = signal('');
  public currentPage = signal(0);
  public itemsPerPage = signal(1);

  public entries = computed(() => getMuseumCollectibleEntries());

  public filteredEntries = computed(() =>
    filterMuseumCollectibleEntries(this.entries(), this.searchText()),
  );

  public discoveredCount = computed(
    () => this.entries().filter((entry) => entry.discovered).length,
  );

  public totalPages = computed(() =>
    Math.max(
      1,
      Math.ceil(this.filteredEntries().length / this.itemsPerPage()),
    ),
  );

  public page = computed(() =>
    Math.min(this.currentPage(), this.totalPages() - 1),
  );

  public pagedEntries = computed(() => {
    const start = this.page() * this.itemsPerPage();
    return this.filteredEntries().slice(start, start + this.itemsPerPage());
  });

  constructor() {
    afterNextRender(() => this.observeGridSize());
  }

  ngOnDestroy(): void {
    this.gridResizeObserver?.disconnect();
  }

  public back(): void {
    kingdomSubviewClear();
  }

  public setTab(tab: MuseumTab): void {
    this.activeTab.set(tab);
    this.currentPage.set(0);
  }

  public onSearchInput(event: Event): void {
    this.searchText.set((event.target as HTMLInputElement).value);
    this.currentPage.set(0);
  }

  public prevPage(): void {
    this.currentPage.set(Math.max(0, this.page() - 1));
  }

  public nextPage(): void {
    this.currentPage.set(Math.min(this.totalPages() - 1, this.page() + 1));
  }

  private observeGridSize(): void {
    const el = this.gridContainer()?.nativeElement;
    if (!el) return;

    const updateItemsPerPage = () => {
      const columns = Math.max(
        1,
        Math.floor(el.clientWidth / CELL_FOOTPRINT_PX),
      );
      const rows = Math.max(1, Math.floor(el.clientHeight / CELL_FOOTPRINT_PX));
      this.itemsPerPage.set(columns * rows);
    };

    updateItemsPerPage();
    this.gridResizeObserver = new ResizeObserver(updateItemsPerPage);
    this.gridResizeObserver.observe(el);
  }
}
