import { analyticsEvent$ } from '@helpers/engine/analytics';
import { onTestFinished } from 'vitest';

export function captureAnalyticsEvents(): string[] {
  const events: string[] = [];
  const subscription = analyticsEvent$.subscribe(({ event }) =>
    events.push(event),
  );
  onTestFinished(() => subscription.unsubscribe());
  return events;
}
