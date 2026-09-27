import type { AnimationCallbackEvent } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BannerAnalyticsConsentComponent } from '@components/banner-analytics-consent/banner-analytics-consent.component';
import { ScreenLoadingComponent } from '@components/screen-loading/screen-loading.component';
import { TutorialOverlayComponent } from '@components/tutorial-overlay/tutorial-overlay.component';
import { TeleportOutletDirective } from '@directives/teleport.outlet.directive';
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
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private anim = inject(AnimationService);
  protected loadingService = inject(LoadingService);

  @HostListener('document:contextmenu')
  onContextMenu(): boolean {
    return false;
  }

  public onLoadingLeave(event: AnimationCallbackEvent): void {
    this.anim
      .fadeOut(event.target)
      .then(() => event.animationComplete())
      .catch(() => event.animationComplete());
  }
}
