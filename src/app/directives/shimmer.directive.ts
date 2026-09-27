import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { AnimationService } from '@services/animation.service';

@Directive({
  selector: '[appShimmer]',
})
export class ShimmerDirective {
  constructor() {
    const anim = inject(AnimationService).shimmer(
      inject(ElementRef<HTMLElement>).nativeElement,
    );
    inject(DestroyRef).onDestroy(() => anim.cancel());
  }
}
