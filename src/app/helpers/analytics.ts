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

const MAX_EVENT_SEGMENTS = 5;
const MAX_SEGMENT_LENGTH = 32;

// GameAnalytics silently rejects ids over these limits, so enforce them centrally rather than per call site.
export function analyticsBoundEventId(eventId: string): string {
  return eventId
    .replace(/[^a-zA-Z0-9:]/g, '')
    .split(':')
    .slice(0, MAX_EVENT_SEGMENTS)
    .map((segment) => segment.slice(0, MAX_SEGMENT_LENGTH))
    .join(':');
}
