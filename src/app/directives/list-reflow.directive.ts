import {
  afterNextRender,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  Injector,
  input,
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
  private resizes = new ResizeObserver(() => this.rebaseline());

  constructor() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const mutations = new MutationObserver(() => this.reflow());
    const onScroll = () => (this.scroll = this.currentScroll());

    mutations.observe(this.container, { childList: true });
    this.container.addEventListener('scroll', onScroll, { passive: true });
    this.observeSizes();

    inject(DestroyRef).onDestroy(() => {
      mutations.disconnect();
      this.resizes.disconnect();
      this.container.removeEventListener('scroll', onScroll);
      this.running.forEach((animation) => animation.cancel());
      this.fading.forEach((animation) => animation.cancel());
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
  private observeSizes(): void {
    this.resizes.disconnect();
    this.resizes.observe(this.container);
    this.children().forEach((child) => this.resizes.observe(child));
  }

  private rebaseline(): void {
    this.ensureOffsetParent();
    this.positions = this.measure();
    this.scroll = this.currentScroll();
  }

  private reflow(): void {
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

    if (
      this.positions.size > 0 &&
      this.appListReflowEnabled() &&
      !this.isHeld
    ) {
      next.forEach((position, child) =>
        this.glide(child as HTMLElement, position, nextScroll),
      );
    }

    this.positions = next;
    this.scroll = nextScroll;
    this.observeSizes();
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
