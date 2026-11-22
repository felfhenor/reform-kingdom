import { electronWindowBridge } from '@helpers/engine/electron';
import { getOption } from '@helpers/state-options';
import type { DesktopNotification } from '@interfaces';

function isDesktopNotificationEnabled({
  category,
}: DesktopNotification): boolean {
  return (
    getOption('desktopNotifications') &&
    !!getOption('desktopNotificationKinds')[category]
  );
}

// The main process drops it while the window is focused, so callers needn't check.
export function desktopNotify(notification: DesktopNotification): void {
  if (!isDesktopNotificationEnabled(notification)) return;

  electronWindowBridge()?.windowNotify?.(notification.title, notification.body);
}
