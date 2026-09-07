import { getOption } from '@helpers/state-options';

export function shouldShowAnalyticsConsentBanner(): boolean {
  return (
    !getOption('analyticsEnabled') && !getOption('analyticsOptInDismissed')
  );
}
