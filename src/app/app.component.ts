import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BannerAnalyticsConsentComponent } from '@components/banner-analytics-consent/banner-analytics-consent.component';
import { ScreenLoadingComponent } from '@components/screen-loading/screen-loading.component';
import { TeleportOutletDirective } from '@directives/teleport.outlet.directive';
import { LoadingService } from '@services/loading.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    ScreenLoadingComponent,
    TeleportOutletDirective,
    BannerAnalyticsConsentComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  protected loadingService = inject(LoadingService);

  @HostListener('document:contextmenu')
  onContextMenu(): boolean {
    return false;
  }
}
