import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
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
import { isMotionReduced } from '@helpers/engine/motion';
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
  private injector = inject(Injector);
  private destroyRef = inject(DestroyRef);

  private rng = rngRandom();
  private hasStartedReveal = false;
  // Swaps wait for the reveal, otherwise a swap overrides a cell's pending reveal and it pops in.
  private hasFinishedReveal = false;

  protected cellPx = LOADING_BACKDROP_CELL_PX;
  protected grid = signal(
    { cols: 0, rows: 0 },
    { equal: (a, b) => a.cols === b.cols && a.rows === b.rows },
  );

  // Waits for every sheet to decode so the reveal never plays over blank cells.
  private pool = computed(() =>
    this.contentService.hasLoadedArt()
      ? loadingIconPool(this.contentService.artAtlases())
      : [],
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

    this.destroyRef.onDestroy(() => {
      resizeObserver.disconnect();
      clearInterval(swapTimer);
    });

    effect(() => {
      const els = this.cellEls();
      if (this.hasStartedReveal || els.length === 0) return;
      if (isMotionReduced()) return;

      this.hasStartedReveal = true;
      const { cols, rows } = this.grid();
      void this.anim
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
    if (els.length === 0 || isMotionReduced()) return;

    const { cols } = this.grid();
    const rect = this.host.nativeElement.getBoundingClientRect();
    const col = Math.floor((event.clientX - rect.left) / this.cellPx);
    const row = Math.floor((event.clientY - rect.top) / this.cellPx);

    this.anim.gridRipple(
      els.map((el) => el.nativeElement),
      cols,
      row * cols + col,
    );
  }

  private swapRandomCell(): void {
    if (!this.hasFinishedReveal || document.hidden) return;

    // A cell still mid-swap or mid-ripple would snap back to full opacity if re-picked.
    const idle = this.cellEls()
      .map((ref, index) => ({ el: ref.nativeElement, index }))
      .filter(({ el }) => el.getAnimations().length === 0);
    if (idle.length === 0) return;

    const { el, index } = idle[rngNumber(idle.length, this.rng)];

    const swapOut = this.anim.iconSwapOut(el);
    void swapOut.finished.then(() => {
      if (this.destroyRef.destroyed) return;

      this.cells.update((cells) =>
        cells.map((icon, i) =>
          i === index ? rngChoiceOther(this.pool(), icon, this.rng) : icon,
        ),
      );
      // The old icon stays held hidden until the new one has rendered, so it can't flash back for a frame.
      afterNextRender(
        () => {
          this.anim.iconSwapIn(el);
          swapOut.cancel();
        },
        { injector: this.injector },
      );
    });
  }
}
