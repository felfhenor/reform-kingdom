import {
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  untracked,
} from '@angular/core';
import { AnimationService } from '@services/animation.service';

// Watches a numeric value and spawns a floating "+N"/"-N" indicator on the host whenever it changes.
@Directive({
  selector: '[appFloatDelta]',
})
export class FloatDeltaDirective {
  private anim = inject(AnimationService);
  private el = inject(ElementRef<HTMLElement>);
  private hasInitialized = false;
  private previous = 0;

  public appFloatDelta = input.required<number>();

  constructor() {
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
        if (delta === 0) return;
        this.anim.floatDelta(this.el.nativeElement, delta);
      });
    });
  }
}
