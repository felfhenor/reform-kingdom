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
import { ButtonSavefileExportComponent } from '@components/button-savefile-export/button-savefile-export.component';
import { SFXDirective } from '@directives/sfx.directive';
import { modalHasAnyOpen } from '@helpers/engine/modal-stack';
import { victoryPopupDismiss } from '@helpers/lore/outro.ui';
import { AnimationService } from '@services/animation.service';

function inSwal(event: KeyboardEvent): boolean {
  return !!(event.target as Element | null)?.closest?.('.swal2-container');
}

@Component({
  selector: 'app-card-victory',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonRunEndComponent, ButtonSavefileExportComponent, SFXDirective],
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

    // Capture phase so navbar hotkeys (pause, view switches) can't act under the card; Esc and the pause menu stay usable.
    const onKeydown = (event: KeyboardEvent) => {
      // Swal stops its own keys from propagating, so the navbar hotkeys never see them.
      if (event.key === 'Escape' || modalHasAnyOpen() || inSwal(event)) return;

      event.stopImmediatePropagation();
      if (event.key === 'Tab' || host.contains(event.target as Node)) return;
      event.preventDefault();
    };

    window.addEventListener('keydown', onKeydown, { capture: true });
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('keydown', onKeydown, { capture: true });
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
