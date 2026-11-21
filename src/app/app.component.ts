import type { AnimationCallbackEvent } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import { CardAchievementComponent } from '@components/card-achievement/card-achievement.component';
import { BannerAnalyticsConsentComponent } from '@components/banner-analytics-consent/banner-analytics-consent.component';
import { ScreenLoadingComponent } from '@components/screen-loading/screen-loading.component';
import { TutorialOverlayComponent } from '@components/tutorial-overlay/tutorial-overlay.component';
import { FFBarPromptsComponent } from '@ff/components/bar-prompts/bar-prompts.component';
import { FFSelectPopupComponent } from '@ff/controls/select-popup.component';
import { FFNumberPopupComponent } from '@ff/controls/number-popup.component';
import { ButtonCloseComponent } from '@components/button-close/button-close.component';
import { TeleportOutletDirective } from '@directives/teleport.outlet.directive';
import { FFFocusService } from '@ff/focus/ff-focus.service';
import { ffGamepadOn } from '@ff/input/ff-gamepad-on';
import { isDemoBuild } from '@helpers/demo/demo';
import {
  GAMEPAD_PRIORITY,
  gamepadBindFocusTips,
} from '@helpers/engine/gamepad.ui';
import { gamepadBindSwal } from '@helpers/engine/gamepad-swal.ui';
import { modalCloseTop, modalHasAnyOpen } from '@helpers/engine/modal-stack';
import { AnimationService } from '@services/animation.service';
import { LoadingService } from '@services/loading.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    ScreenLoadingComponent,
    TeleportOutletDirective,
    BannerAnalyticsConsentComponent,
    TutorialOverlayComponent,
    CardAchievementComponent,
    FFBarPromptsComponent,
    FFSelectPopupComponent,
    FFNumberPopupComponent,
    ButtonCloseComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private anim = inject(AnimationService);
  protected loadingService = inject(LoadingService);

  constructor() {
    // Electron's window title follows the page's.
    if (isDemoBuild()) inject(Title).setTitle('re:Form Kingdom Demo');

    inject(FFFocusService);
    this.bindGamepadDialogs();
    gamepadBindSwal();
    gamepadBindFocusTips();
  }

  protected readonly selectPopupPriority = GAMEPAD_PRIORITY.popover;

  private bindGamepadDialogs(): void {
    ffGamepadOn('back', modalCloseTop, {
      priority: GAMEPAD_PRIORITY.modal,
      enabled: modalHasAnyOpen,
      label: 'Close',
    });
  }

  @HostListener('document:contextmenu')
  onContextMenu(): boolean {
    return false;
  }

  public onLoadingLeave(event: AnimationCallbackEvent): void {
    this.anim.dismissOverlay(event.target as HTMLElement).finished.then(
      () => event.animationComplete(),
      () => event.animationComplete(),
    );
  }
}
