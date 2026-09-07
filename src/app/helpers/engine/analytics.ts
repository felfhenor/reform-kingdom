import { Subject } from 'rxjs';

const analyticsEvent = new Subject<{
  event: string;
  value: number;
}>();
export const analyticsEvent$ = analyticsEvent.asObservable();

export function analyticsSendDesignEvent(event: string, value = 1): void {
  analyticsEvent.next({ event, value });
}

// Strips colons so names like "Material: Copper Ingot" don't fragment into extra event id segments.
export function analyticsSafeSegment(name: string): string {
  return name.replace(/:/g, '');
}
