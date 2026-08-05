import type { ElementRef, OnDestroy } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { ArmoryItemSlotComponent } from '@components/armory-item-slot/armory-item-slot.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import {
  filterArmoryEntries,
  getArmoryEntries,
  kingdomSubviewClear,
} from '@helpers';

const CELL_FOOTPRINT_PX = 72;

@Component({
  selector: 'app-play-kingdom-armory',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardPageComponent, ArmoryItemSlotComponent],
  templateUrl: './play-kingdom-armory.component.html',
  styleUrl: './play-kingdom-armory.component.scss',
})
export class PlayKingdomArmoryComponent implements OnDestroy {
  private gridContainer =
    viewChild<ElementRef<HTMLDivElement>>('gridContainer');
  private gridResizeObserver: ResizeObserver | undefined;

  public searchText = signal('');
  public currentPage = signal(0);
  public itemsPerPage = signal(1);

  public entries = computed(() => getArmoryEntries());

  public filteredEntries = computed(() =>
    filterArmoryEntries(this.entries(), this.searchText()),
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
