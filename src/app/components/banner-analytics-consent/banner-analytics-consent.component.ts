import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { ButtonCloseComponent } from '@components/button-close/button-close.component';
import {
  setOption,
  shouldShowAnalyticsConsentBanner,
} from '@helpers/state-options';

@Component({
  selector: 'app-banner-analytics-consent',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonCloseComponent],
  templateUrl: './banner-analytics-consent.component.html',
  styleUrl: './banner-analytics-consent.component.scss',
})
export class BannerAnalyticsConsentComponent {
  public showBanner = computed(() => shouldShowAnalyticsConsentBanner());

  optIn(): void {
    setOption('analyticsEnabled', true);
    setOption('analyticsOptInDismissed', true);
  }

  dismiss(): void {
    setOption('analyticsOptInDismissed', true);
  }
}
