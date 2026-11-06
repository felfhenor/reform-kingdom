import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ButtonRunEndComponent } from '@components/button-run-end/button-run-end.component';
import { SFXDirective } from '@directives/sfx.directive';
import { hotkeysBlockOutside } from '@helpers/engine/hotkeys.ui';
import { victoryPopupDismiss } from '@helpers/lore/outro.ui';
import { AnimationService } from '@services/animation.service';

@Component({
  selector: 'app-card-victory',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonRunEndComponent, SFXDirective],
  templateUrl: './card-victory.component.html',
  styleUrl: './card-victory.component.scss',
})
export class CardVictoryComponent {
  private anim = inject(AnimationService);
  private backdrop = viewChild.required<ElementRef<HTMLElement>>('backdrop');
  private card = viewChild.required<ElementRef<HTMLElement>>('card');
  private continueButton =
    viewChild.required<ElementRef<HTMLButtonElement>>('continueButton');
  public isDismissing = signal(false);

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const fadeIn = this.anim.fadeIn(host, 600);
    afterNextRender(() => this.continueButton().nativeElement.focus());

    const unblock = hotkeysBlockOutside(host);
    inject(DestroyRef).onDestroy(() => {
      unblock();
      fadeIn.pause();
    });
  }

  public dismiss(): void {
    if (this.isDismissing()) return;

    this.isDismissing.set(true);
    this.anim.dismissOverlay(this.backdrop().nativeElement);
    void this.anim
      .shatterIntoSmoke(this.card().nativeElement)
      .catch(() => undefined)
      .then(() => victoryPopupDismiss());
  }
}
