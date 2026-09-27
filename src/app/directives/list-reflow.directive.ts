import {
  afterNextRender,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  untracked,
} from '@angular/core';
import { AnimationService } from '@services/animation.service';
import { clamp } from 'es-toolkit/compat';

type Position = { x: number; y: number };

// FLIP for a container's direct children: the ones that stay glide from their old spot when siblings are added, removed or reordered.
// Positions are transform-free layout offsets paired with the scroll offset, so a glide in flight or a scroll clamp during the change can't skew the next one.
@Directive({
  selector: '[appListReflow]',
})
export class ListReflowDirective {
  private container = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private anim = inject(AnimationService);
  private injector = inject(Injector);
  private isHeld = false;

  public appListReflowEnabled = input(true);
  public appListReflowEnter = input(true);

  private positions = new Map<Element, Position>();
  private scroll: Position = { x: 0, y: 0 };
  private running = new Map<Element, Animation>();
  private fading = new Map<Element, Animation>();
  private isOffsetParent = false;
  private isBaselined = false;
  private isDestroyed = false;
  private observed = new Set<Element>();
  private stopObserving?: () => void;
  private resizes = new ResizeObserver(() => this.rebaseline());

  constructor() {
    effect(() => {
      if (this.appListReflowEnabled()) untracked(() => this.start());
      else this.stop();
    });

    inject(DestroyRef).onDestroy(() => {
      this.isDestroyed = true;
      this.stop();
    });
  }

  // Observers only exist while enabled, so a grid that opts out pays nothing and keeps its own positioning.
  private start(): void {
    if (this.stopObserving) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const mutations = new MutationObserver(() => this.reflow());
    const onScroll = () => (this.scroll = this.currentScroll());
    // Mutations before this fires are the initial population; later ones, including into an empty list, glide.
    const baselineTimer = setTimeout(() => (this.isBaselined = true));

    // Nothing here reads layout: doing so mid-render resolves styles early and starts CSS transitions on buttons still being updated.
    // The first baseline comes from the ResizeObserver, which reports after the browser has laid the page out.
    mutations.observe(this.container, { childList: true });
    this.container.addEventListener('scroll', onScroll, { passive: true });
    this.resizes.observe(this.container);

    this.stopObserving = () => {
      mutations.disconnect();
      this.resizes.disconnect();
      this.observed.clear();
      this.container.removeEventListener('scroll', onScroll);
      clearTimeout(baselineTimer);
    };
  }

  private stop(): void {
    this.stopObserving?.();
    this.stopObserving = undefined;
    this.isBaselined = false;
    this.positions.clear();
    [this.running, this.fading].forEach((animations) => {
      animations.forEach((animation) => animation.cancel());
      animations.clear();
    });
  }

  // Child offsets are relative to the nearest positioned ancestor, so the container has to be one; checked lazily since it isn't attached yet in the constructor.
  private ensureOffsetParent(): void {
    if (this.isOffsetParent) return;

    if (getComputedStyle(this.container).position === 'static') {
      this.container.style.position = 'relative';
    }
    this.isOffsetParent = true;
  }

  // Pauses glides while something else (a CDK drag) is moving the children itself.
  public hold(): void {
    this.isHeld = true;
  }

  // Waits out the render and observer pass a drop triggers, or the reorder it caused would still glide.
  public release(): void {
    if (this.isDestroyed) return;

    afterNextRender(() => queueMicrotask(() => (this.isHeld = false)), {
      injector: this.injector,
    });
  }

  private currentScroll(): Position {
    return { x: this.container.scrollLeft, y: this.container.scrollTop };
  }

  private children(): HTMLElement[] {
    return Array.from(this.container.children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child.offsetParent !== null,
    );
  }

  private measure(): Map<Element, Position> {
    return new Map(
      this.children().map((child) => [
        child,
        { x: child.offsetLeft, y: child.offsetTop },
      ]),
    );
  }

  // Row sizes can change without the container resizing (a sprite loads, text wraps), which would leave old positions stale.
  private observeSizes(children: Iterable<Element>): void {
    const current = new Set(children);

    this.observed.forEach((child) => {
      if (current.has(child)) return;
      this.resizes.unobserve(child);
      this.observed.delete(child);
    });
    current.forEach((child) => {
      if (this.observed.has(child)) return;
      this.resizes.observe(child);
      this.observed.add(child);
    });
  }

  private rebaseline(): void {
    this.ensureOffsetParent();
    this.positions = this.measure();
    this.scroll = this.currentScroll();
    this.observeSizes(this.positions.keys());
  }

  private reflow(): void {
    if (!this.isBaselined) return;

    this.ensureOffsetParent();
    const next = this.measure();
    const nextScroll = this.currentScroll();

    [this.running, this.fading].forEach((animations) =>
      animations.forEach((animation, child) => {
        if (next.has(child)) return;
        animation.cancel();
        animations.delete(child);
      }),
    );

    if (this.isBaselined && !this.isHeld) {
      next.forEach((position, child) =>
        this.glide(child as HTMLElement, position, nextScroll),
      );
    }

    this.positions = next;
    this.scroll = nextScroll;
    this.observeSizes(next.keys());
  }

  // A child mid-glide is visually offset by its current transform, so a fresh glide starts from there rather than jumping.
  private currentOffset(child: Element): Position {
    if (!this.running.has(child)) return { x: 0, y: 0 };

    const matrix = new DOMMatrix(getComputedStyle(child).transform);
    return { x: matrix.m41, y: matrix.m42 };
  }

  private overlapsViewport(child: HTMLElement, x: number, y: number): boolean {
    return (
      x + child.offsetWidth > 0 &&
      x < this.container.clientWidth &&
      y + child.offsetHeight > 0 &&
      y < this.container.clientHeight
    );
  }

  private glide(child: HTMLElement, next: Position, nextScroll: Position) {
    const previous = this.positions.get(child);
    if (!previous) {
      if (this.appListReflowEnter()) {
        this.track(this.fading, child, this.anim.reflowEnter(child));
      }
      return;
    }

    const offset = this.currentOffset(child);
    this.running.get(child)?.cancel();
    this.running.delete(child);

    const fromX = previous.x - this.scroll.x + offset.x;
    const fromY = previous.y - this.scroll.y + offset.y;
    const toX = next.x - nextScroll.x;
    const toY = next.y - nextScroll.y;

    if (fromX === toX && fromY === toY) return;
    if (
      !this.overlapsViewport(child, fromX, fromY) &&
      !this.overlapsViewport(child, toX, toY)
    ) {
      return;
    }

    // Capped at one viewport so a row crossing a long list slides in from the edge rather than streaking through it.
    const reach = {
      x: this.container.clientWidth,
      y: this.container.clientHeight,
    };
    this.track(
      this.running,
      child,
      this.anim.reflow(
        child,
        clamp(fromX - toX, -reach.x, reach.x),
        clamp(fromY - toY, -reach.y, reach.y),
      ),
    );
  }

  private track(
    animations: Map<Element, Animation>,
    child: Element,
    animation: Animation,
  ): void {
    animations.set(child, animation);
    animation.finished
      .then(() => {
        if (animations.get(child) === animation) animations.delete(child);
      })
      .catch(() => undefined);
  }
}
