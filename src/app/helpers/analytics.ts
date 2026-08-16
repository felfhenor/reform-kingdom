import { Subject } from 'rxjs';

const analyticsEvent = new Subject<{
  event: string;
  value: number;
}>();
export const analyticsEvent$ = analyticsEvent.asObservable();

export function analyticsSendDesignEvent(event: string, value = 1): void {
  analyticsEvent.next({ event, value });
}

// Strips colons from a name before it's interpolated into a colon-delimited
// event id - some content names embed a colon by convention (e.g. recipe
// names like "Material: Copper Ingot"), which would otherwise fragment into
// an extra, unintended segment (see `analyticsBoundEventId`'s segment cap).
export function analyticsSafeSegment(name: string): string {
  return name.replace(/:/g, '');
}

const MAX_EVENT_SEGMENTS = 5;
const MAX_SEGMENT_LENGTH = 32;

// Sanitizes a design-event id for GameAnalytics: strips characters outside
// [A-Za-z0-9:], then caps it at 5 colon-separated segments of at most 32
// characters each - GameAnalytics silently rejects ids over these limits, so
// this is enforced centrally rather than trusted to every call site.
export function analyticsBoundEventId(eventId: string): string {
  return eventId
    .replace(/[^a-zA-Z0-9:]/g, '')
    .split(':')
    .slice(0, MAX_EVENT_SEGMENTS)
    .map((segment) => segment.slice(0, MAX_SEGMENT_LENGTH))
    .join(':');
}
