import { TPipe } from '@pipes/t.pipe';
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
import { ButtonWishlistComponent } from '@components/button-wishlist/button-wishlist.component';
import { SFXDirective } from '@directives/sfx.directive';
import { demoEndDismiss } from '@helpers/demo/demo.ui';
import { gamepadBlockBehindOverlay } from '@helpers/engine/gamepad.ui';
import { hotkeysBlockOutside } from '@helpers/engine/hotkeys.ui';
import { AnimationService } from '@services/animation.service';

@Component({
  selector: 'app-card-demo-end',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, ButtonWishlistComponent, SFXDirective],
  templateUrl: './card-demo-end.component.html',
  styleUrl: './card-demo-end.component.scss',
})
export class CardDemoEndComponent {
  private anim = inject(AnimationService);
  private backdrop = viewChild.required<ElementRef<HTMLElement>>('backdrop');
  private card = viewChild.required<ElementRef<HTMLElement>>('card');
  private continueButton =
    viewChild.required<ElementRef<HTMLButtonElement>>('continueButton');
  private isDismissing = signal(false);

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const fadeIn = this.anim.fadeIn(host, 600);
    afterNextRender(() => this.continueButton().nativeElement.focus());

    const unblock = hotkeysBlockOutside(host);
    gamepadBlockBehindOverlay();
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
      .then(() => demoEndDismiss());
  }
}
