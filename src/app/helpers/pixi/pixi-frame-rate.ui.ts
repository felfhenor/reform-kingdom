import { computed } from '@angular/core';
import { MAP_UNFOCUSED_MAX_FPS } from '@helpers/config';
import { windowFocused } from '@helpers/engine/ui';
import { getOption } from '@helpers/state-options';

// Options from before these keys existed are undefined until the migration merges defaults in.
export const pixiMapMaxFps = computed(() => {
  const frameRate = getOption('mapFrameRate') ?? 30;
  return getOption('lowerFrameRateWhenUnfocused') && !windowFocused()
    ? Math.min(frameRate, MAP_UNFOCUSED_MAX_FPS)
    : frameRate;
});
