import { TPipe } from '@pipes/t.pipe';
import { FFKeyboardDirective } from '@ff/controls/ff-keyboard.directive';
import { FFButtonComponent } from '@ff/components/button/button.component';
import { FFFocusService } from '@ff/focus/ff-focus.service';
import type { FFFocusEdgeDetail } from '@ff/interfaces/ff-input';
import type { ElementRef, OnDestroy } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  inject,
  Injector,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { ButtonKingdomBackComponent } from '@components/button-kingdom-back/button-kingdom-back.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { IconComponent } from '@components/icon/icon.component';
import { ListReflowDirective } from '@directives/list-reflow.directive';

// 64px cell + 16px gap; p-2 padding (16) cancels the missing trailing gap.
const CELL_FOOTPRINT_PX = 80;

@Component({
  selector: 'app-page-paged-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TPipe,
    FFKeyboardDirective,
    FFButtonComponent,
    BlankSlateComponent,
    CardPageComponent,
    ButtonKingdomBackComponent,
    IconComponent,
    ListReflowDirective,
  ],
  templateUrl: './page-paged-grid.component.html',
  styleUrl: './page-paged-grid.component.scss',
})
export class PagePagedGridComponent<T> implements OnDestroy {
  private gridContainer =
    viewChild<ElementRef<HTMLDivElement>>('gridContainer');
  private gridResizeObserver?: ResizeObserver;

  public entries = input.required<T[]>();
  public filterFn = input.required<(entries: T[], searchText: string) => T[]>();
  public searchPlaceholder = input('Search by name or description...');
  public emptyMessage = input('No results found.');
  public showToolbar = input(true);
  public showGrid = input(true);
  public reflow = input(false);

  public searchText = signal('');
  public currentPage = signal(0);
  public itemsPerPage = signal(1);

  public filteredEntries = computed(() =>
    this.filterFn()(this.entries(), this.searchText()),
  );

  public totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredEntries().length / this.itemsPerPage())),
  );

  public page = computed(() =>
    Math.min(this.currentPage(), this.totalPages() - 1),
  );

  public pagedEntries = computed(() => {
    const start = this.page() * this.itemsPerPage();
    return this.filteredEntries().slice(start, start + this.itemsPerPage());
  });

  private readonly injector = inject(Injector);
  private readonly focus = inject(FFFocusService);

  constructor() {
    afterNextRender(() => this.observeGridSize());
  }

  // D-pad past the grid's left/right edge turns the page, landing on the facing edge of the new one.
  public onFocusEdge(event: Event): void {
    const { direction } = (event as CustomEvent<FFFocusEdgeDetail>).detail;
    if (direction === 'right' && this.page() < this.totalPages() - 1) {
      event.preventDefault();
      this.nextPage();
      this.focusGridEdge('first');
    }
    if (direction === 'left' && this.page() > 0) {
      event.preventDefault();
      this.prevPage();
      this.focusGridEdge('last');
    }
  }

  private focusGridEdge(edge: 'first' | 'last'): void {
    afterNextRender(
      () => {
        const grid = this.gridContainer()?.nativeElement;
        if (grid) this.focus.focusEdgeOf(grid, edge);
      },
      { injector: this.injector },
    );
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
      // Read the auto-fill track count the browser resolved rather than re-deriving it.
      const columns = Math.max(
        1,
        getComputedStyle(el).gridTemplateColumns.split(' ').length,
      );
      const rows = Math.max(1, Math.floor(el.clientHeight / CELL_FOOTPRINT_PX));
      this.itemsPerPage.set(columns * rows);
    };

    updateItemsPerPage();
    this.gridResizeObserver = new ResizeObserver(updateItemsPerPage);
    this.gridResizeObserver.observe(el);
  }
}
