import { effect } from '@angular/core';
import { desktopNotify } from '@helpers/engine/desktop-notify';
import { electronWindowFlash } from '@helpers/engine/electron-window.ui';
import {
  windowAttentionAlerts,
  windowAttentionRaised,
} from '@helpers/engine/window-attention';
import { isGameStateReady } from '@helpers/state-game';
import { getOption } from '@helpers/state-options';

// Needs an injection context. A load that drops readiness resets the baseline.
export function windowAttentionBind(): void {
  let previousIds: Set<string> | undefined;
  effect(() => {
    if (!isGameStateReady()) {
      previousIds = undefined;
      return;
    }

    const current = windowAttentionAlerts();
    const raised = previousIds
      ? windowAttentionRaised(previousIds, current)
      : [];
    previousIds = new Set(current.map((alert) => alert.id));

    const shouldFlash = raised.some((alert) => alert.flash);
    if (shouldFlash && getOption('flashTaskbarOnAlerts')) electronWindowFlash();
    raised.forEach((alert) => desktopNotify(alert));
  });
}
