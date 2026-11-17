import {
  afterRenderEffect,
  Component,
  ElementRef,
  inject,
  input,
} from '@angular/core';

@Component({
  selector: 'app-button-glow, [appButtonGlow]',
  imports: [],
  templateUrl: './button-glow.component.html',
  styleUrl: './button-glow.component.scss',
  host: {
    '[class.button-glow-active]': 'buttonGlowActive()',
  },
})
export class ButtonGlowComponent {
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
            anim.animationName.endsWith('app-button-glow-pulse'),
        )
        .forEach((anim) => (anim.startTime = 0));
    });
  }
}
