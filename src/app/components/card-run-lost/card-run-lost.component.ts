import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
} from '@angular/core';
import { ButtonRunEndComponent } from '@components/button-run-end/button-run-end.component';
import { hotkeysBlockOutside } from '@helpers/engine/hotkeys.ui';
import { closeAllMenus } from '@helpers/engine/ui';
import { saveGameState } from '@helpers/state-game';
import { AnimationService } from '@services/animation.service';

@Component({
  selector: 'app-card-run-lost',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonRunEndComponent],
  templateUrl: './card-run-lost.component.html',
  styleUrl: './card-run-lost.component.scss',
})
export class CardRunLostComponent {
  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const fadeIn = inject(AnimationService).fadeIn(host, 600);
    const unblock = hotkeysBlockOutside(host);

    // The held gameloop never autosaves again, so a reload would otherwise undo the loss.
    void saveGameState();
    closeAllMenus();
    afterNextRender(() => host.querySelector('button')?.focus());

    inject(DestroyRef).onDestroy(() => {
      unblock();
      fadeIn.pause();
    });
  }
}
