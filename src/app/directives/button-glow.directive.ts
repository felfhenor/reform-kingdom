import {
  afterRenderEffect,
  Directive,
  ElementRef,
  inject,
  input,
} from '@angular/core';

@Directive({
  selector: '[appButtonGlow]',
  host: {
    '[class.button-glow-active]': 'buttonGlowActive()',
  },
})
export class ButtonGlowDirective {
  public buttonGlowActive = input<boolean>(true);

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

    // Pin every pulse to the document clock so glows that start at different times still beat together.
    afterRenderEffect(() => {
      if (!this.buttonGlowActive()) return;

      host
        .getAnimations()
        .filter(
          (anim) =>
            anim instanceof CSSAnimation &&
            anim.animationName === 'app-button-glow-pulse',
        )
        .forEach((anim) => (anim.startTime = 0));
    });
  }
}
