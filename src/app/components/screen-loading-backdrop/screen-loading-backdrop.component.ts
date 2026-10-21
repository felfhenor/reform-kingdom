import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  linkedSignal,
  signal,
  viewChildren,
} from '@angular/core';
import {
  LOADING_BACKDROP_CELL_PX,
  LOADING_BACKDROP_SWAP_MS,
} from '@helpers/config';
import {
  loadingGridSize,
  loadingIconGridFill,
  loadingIconPool,
} from '@helpers/engine/loading.ui';
import { rngChoiceOther, rngNumber, rngRandom } from '@helpers/rng';
import { AnimationService } from '@services/animation.service';
import { ContentService } from '@services/content.service';

@Component({
  selector: 'app-screen-loading-backdrop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './screen-loading-backdrop.component.html',
  styleUrl: './screen-loading-backdrop.component.scss',
  host: {
    'aria-hidden': 'true',
    class: 'absolute inset-0 overflow-hidden',
    '[style.--cell-px.px]': 'cellPx',
    '(click)': 'ripple($event)',
  },
})
export class ScreenLoadingBackdropComponent {
  private anim = inject(AnimationService);
  private contentService = inject(ContentService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  private rng = rngRandom();
  private hasStartedReveal = false;
  // Swaps wait for the reveal, otherwise a swap overrides a cell's pending reveal and it pops in.
  private hasFinishedReveal = false;

  protected cellPx = LOADING_BACKDROP_CELL_PX;
  protected grid = signal(
    { cols: 0, rows: 0 },
    { equal: (a, b) => a.cols === b.cols && a.rows === b.rows },
  );

  private pool = computed(() =>
    loadingIconPool(this.contentService.artAtlases()),
  );

  protected sheetUrls = computed(() =>
    Object.fromEntries(
      Object.keys(this.contentService.artAtlases()).map((sheet) => [
        sheet,
        `url('${this.contentService.toCacheBustURL(`art/spritesheets/${sheet}.webp`)}')`,
      ]),
    ),
  );

  protected cells = linkedSignal(() =>
    loadingIconGridFill(
      this.pool(),
      this.grid().cols * this.grid().rows,
      this.rng,
    ),
  );

  private cellEls = viewChildren<ElementRef<HTMLElement>>('cell');

  constructor() {
    const resizeObserver = new ResizeObserver(([entry]) =>
      this.grid.set(
        loadingGridSize(
          entry.contentRect.width,
          entry.contentRect.height,
          this.cellPx,
        ),
      ),
    );
    resizeObserver.observe(this.host.nativeElement);

    const swapTimer = setInterval(
      () => this.swapRandomCell(),
      LOADING_BACKDROP_SWAP_MS,
    );

    inject(DestroyRef).onDestroy(() => {
      resizeObserver.disconnect();
      clearInterval(swapTimer);
    });

    effect(() => {
      const els = this.cellEls();
      if (this.hasStartedReveal || els.length === 0) return;
      if (this.anim.reducedMotion) return;

      this.hasStartedReveal = true;
      const { cols, rows } = this.grid();
      this.anim
        .gridReveal(
          els.map((el) => el.nativeElement),
          cols,
          rows,
        )
        .then(() => (this.hasFinishedReveal = true));
    });
  }

  protected ripple(event: MouseEvent): void {
    const els = this.cellEls();
    if (els.length === 0 || this.anim.reducedMotion) return;

    const { cols, rows } = this.grid();
    const rect = this.host.nativeElement.getBoundingClientRect();
    const col = Math.floor((event.clientX - rect.left) / this.cellPx);
    const row = Math.floor((event.clientY - rect.top) / this.cellPx);

    this.anim.gridRipple(
      els.map((el) => el.nativeElement),
      cols,
      rows,
      row * cols + col,
    );
  }

  private swapRandomCell(): void {
    const els = this.cellEls();
    if (els.length === 0 || !this.hasFinishedReveal || document.hidden) return;

    const index = rngNumber(els.length, this.rng);
    const el = els[index].nativeElement;

    this.anim.iconSwapOut(el).then(() => {
      this.cells.update((cells) =>
        cells.map((icon, i) =>
          i === index ? rngChoiceOther(this.pool(), icon, this.rng) : icon,
        ),
      );
      this.anim.iconSwapIn(el);
    });
  }
}
