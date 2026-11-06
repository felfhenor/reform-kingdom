import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { ButtonGlowComponent } from '@components/button-glow/button-glow.component';
import { IconComponent } from '@components/icon/icon.component';
import { SFXDirective } from '@directives/sfx.directive';
import { closeAllMenus } from '@helpers/engine/ui';
import { gameReset } from '@helpers/game-init';
import { legacyEndRun, legacyRunOutcome } from '@helpers/legacy/legacy.ui';
import { getOption, setOption } from '@helpers/state-options';
import { TippyDirective } from '@ngneat/helipopper';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

@Component({
  selector: 'app-button-run-end',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonGlowComponent,
    IconComponent,
    SFXDirective,
    SweetAlert2Module,
    TippyDirective,
  ],
  templateUrl: './button-run-end.component.html',
})
export class ButtonRunEndComponent {
  private router = inject(Router);

  public compact = input(false);

  public isFinished = computed(() => legacyRunOutcome() === 'Completed');
  public isLost = computed(() => legacyRunOutcome() === 'Lost');
  public isBusy = signal(false);

  public async endRun(): Promise<void> {
    if (this.isBusy()) return;

    this.isBusy.set(true);
    const wasPaused = getOption('gameloopPaused');
    setOption('gameloopPaused', true);

    try {
      const id = await legacyEndRun();
      if (!id) {
        setOption('gameloopPaused', wasPaused);
        return;
      }

      closeAllMenus();
      // Leave the game first so nothing on it renders the reset state, as Delete Savefile does.
      if (!(await this.router.navigate(['/summary', id]))) {
        setOption('gameloopPaused', wasPaused);
        return;
      }

      gameReset();
    } finally {
      this.isBusy.set(false);
    }
  }
}
