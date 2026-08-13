import type { ElementRef, OnDestroy } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { ButtonKingdomBackComponent } from '@components/button-kingdom-back/button-kingdom-back.component';

const CELL_FOOTPRINT_PX = 72;

@Component({
  selector: 'app-page-paged-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardPageComponent, ButtonKingdomBackComponent],
  templateUrl: './page-paged-grid.component.html',
  styleUrl: './page-paged-grid.component.scss',
})
export class PagePagedGridComponent<T> implements OnDestroy {
  private gridContainer =
    viewChild<ElementRef<HTMLDivElement>>('gridContainer');
  private gridResizeObserver: ResizeObserver | undefined;

  public entries = input.required<T[]>();
  public filterFn =
    input.required<(entries: T[], searchText: string) => T[]>();
  public searchPlaceholder = input('Search by name or description...');
  public emptyMessage = input('No results found.');
  public showToolbar = input(true);
  public showGrid = input(true);

  public searchText = signal('');
  public currentPage = signal(0);
  public itemsPerPage = signal(1);

  public filteredEntries = computed(() =>
    this.filterFn()(this.entries(), this.searchText()),
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

  public resetPage(): void {
    this.currentPage.set(0);
  }

  public onSearchInput(event: Event): void {
    this.searchText.set((event.target as HTMLInputElement).value);
    this.resetPage();
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
      const rows = Math.max(
        1,
        Math.floor(el.clientHeight / CELL_FOOTPRINT_PX),
      );
      this.itemsPerPage.set(columns * rows);
    };

    updateItemsPerPage();
    this.gridResizeObserver = new ResizeObserver(updateItemsPerPage);
    this.gridResizeObserver.observe(el);
  }
}
