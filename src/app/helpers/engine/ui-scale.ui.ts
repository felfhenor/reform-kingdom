import { computed } from '@angular/core';
import {
  UI_SCALE_AUTO_MAX,
  UI_SCALE_BASE_HEIGHT,
  UI_SCALE_BASE_WIDTH,
} from '@helpers/config';
import { windowHeight, windowWidth } from '@helpers/engine/ui';
import { getOption } from '@helpers/state-options';
import type { UiScale } from '@interfaces';
import { clamp } from 'es-toolkit/compat';

// The tighter axis wins, so an ultrawide scales by height and a narrow window never scales panels past its width.
export function uiScaleResolve(
  setting: UiScale,
  width: number,
  height: number,
): number {
  if (typeof setting === 'number') return setting;

  const fit = Math.min(
    width / UI_SCALE_BASE_WIDTH,
    height / UI_SCALE_BASE_HEIGHT,
  );
  return clamp(fit, 1, UI_SCALE_AUTO_MAX);
}

export const uiScaleCurrent = computed(() =>
  uiScaleResolve(getOption('uiScale'), windowWidth(), windowHeight()),
);
