import { notification$ } from '@helpers/engine/notify';
import { onTestFinished } from 'vitest';

export function captureNotifications(): { message: string; type: string }[] {
  const notifications: { message: string; type: string }[] = [];
  const subscription = notification$.subscribe(({ message, type }) =>
    notifications.push({ message, type }),
  );
  onTestFinished(() => subscription.unsubscribe());
  return notifications;
}
