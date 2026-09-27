import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { AnimationService } from '@services/animation.service';

@Directive({
  selector: '[appFadeIn]',
})
export class FadeInDirective {
  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    el.style.opacity = '0';
    const anim = inject(AnimationService).fadeIn(el);
    inject(DestroyRef).onDestroy(() => anim.pause());
  }
}
