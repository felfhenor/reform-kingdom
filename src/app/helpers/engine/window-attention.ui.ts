import { effect } from '@angular/core';
import { electronWindowFlash } from '@helpers/engine/electron-window.ui';
import {
  windowAttentionFlags,
  windowAttentionRaised,
} from '@helpers/engine/window-attention';
import { isGameStateReady } from '@helpers/state-game';
import { getOption } from '@helpers/state-options';

// Needs an injection context. A load that drops readiness resets the baseline.
export function windowAttentionBind(): void {
  let previous: boolean[] | undefined;
  effect(() => {
    if (!isGameStateReady()) {
      previous = undefined;
      return;
    }

    const current = windowAttentionFlags();
    const raised = !!previous && windowAttentionRaised(previous, current);
    previous = current;
    if (raised && getOption('flashTaskbarOnAlerts')) electronWindowFlash();
  });
}
