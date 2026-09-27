import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { AnimationService } from '@services/animation.service';

@Directive({
  selector: '[appFadeIn]',
})
export class FadeInDirective {
  constructor() {
    const anim = inject(AnimationService).fadeIn(
      inject<ElementRef<HTMLElement>>(ElementRef).nativeElement,
    );
    inject(DestroyRef).onDestroy(() => anim.pause());
  }
}
