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
import { StorageItemSlotComponent } from '@components/storage-item-slot/storage-item-slot.component';
import {
  filterStorageMaterials,
  getStorageMaterials,
  kingdomSubviewClear,
} from '@helpers';

const CELL_FOOTPRINT_PX = 72;

@Component({
  selector: 'app-play-kingdom-storage',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardPageComponent, StorageItemSlotComponent],
  templateUrl: './play-kingdom-storage.component.html',
  styleUrl: './play-kingdom-storage.component.scss',
})
export class PlayKingdomStorageComponent implements OnDestroy {
  private gridContainer =
    viewChild<ElementRef<HTMLDivElement>>('gridContainer');
  private gridResizeObserver: ResizeObserver | undefined;

  public searchText = signal('');
  public currentPage = signal(0);
  public itemsPerPage = signal(1);

  public materials = computed(() => getStorageMaterials());

  public filteredMaterials = computed(() =>
    filterStorageMaterials(this.materials(), this.searchText()),
  );

  public totalPages = computed(() =>
    Math.max(
      1,
      Math.ceil(this.filteredMaterials().length / this.itemsPerPage()),
    ),
  );

  public page = computed(() =>
    Math.min(this.currentPage(), this.totalPages() - 1),
  );

  public pagedMaterials = computed(() => {
    const start = this.page() * this.itemsPerPage();
    return this.filteredMaterials().slice(start, start + this.itemsPerPage());
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
