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
import { TeleportOutletDirective } from '@directives/teleport.outlet.directive';
import { isDemoBuild } from '@helpers/demo/demo';
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
