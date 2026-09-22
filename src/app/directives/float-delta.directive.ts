import {
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  untracked,
} from '@angular/core';
import { AnimationService } from '@services/animation.service';
import type { JSAnimation } from 'animejs';

// Watches a numeric value and spawns a floating "+N"/"-N" indicator on the host whenever it changes.
// `appFloatDeltaEnabled` guards a component reused for unrelated values (e.g. an @for
// row tracked by index) from playing a popup as if its own value changed.
@Directive({
  selector: '[appFloatDelta]',
})
export class FloatDeltaDirective {
  private anim = inject(AnimationService);
  private el = inject(ElementRef<HTMLElement>);
  private hasInitialized = false;
  private previous = 0;
  private currentAnim?: JSAnimation;

  public appFloatDelta = input.required<number>();
  public appFloatDeltaEnabled = input(true);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.currentAnim?.pause());

    effect(() => {
      const value = this.appFloatDelta();
      untracked(() => {
        if (!this.hasInitialized) {
          this.hasInitialized = true;
          this.previous = value;
          return;
        }
        const delta = value - this.previous;
        this.previous = value;
        if (delta === 0 || !this.appFloatDeltaEnabled()) return;
        this.currentAnim = this.anim.floatDelta(this.el.nativeElement, delta);
      });
    });
  }
}
