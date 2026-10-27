import type { Signal } from '@angular/core';
import { environment } from '@environments/environment';
import { isInElectron } from '@helpers/engine/electron';
import { localStorageSignal } from '@helpers/engine/signal';
import type { GameOptions } from '@interfaces';

export function defaultOptions(): GameOptions {
  return {
    showDebug: !environment.production,
    debugConsoleLogStateUpdates: false,
    debugGameloopTimerUpdates: false,
    debugTickMultiplier: 1,
    debugSaveInterval: 15,

    sfxPlay: true,
    sfxVolume: 0.3,

    bgmPlay: true,
    bgmVolume: 0.1,

    gameloopPaused: false,
    // Web tabs share one save with no cross-tab lock, so only the desktop build defaults on.
    runInBackground: isInElectron(),
    muteWhenUnfocused: false,
    optionsTab: 'UI',

    showBackdropGrid: false,
    cleanFont: false,
    colorblindMode: false,
    motionPreference: 'system',

    analyticsEnabled: false,
    analyticsOptInDismissed: false,

    mapZoom: 1,
    uiScale: 'auto',

    partyViewAlwaysExpand: true,
    craftingViewAlwaysExpand: false,

    adventureLogOverlay: true,
    adventureLogOverlayKinds: {
      Combat: false,
      Travel: true,
      Gather: true,
      Craft: true,
      Raid: true,
      Miscellaneous: true,
    },
  };
}

const _options = localStorageSignal<GameOptions>('options', defaultOptions());
export const options: Signal<GameOptions> = _options.asReadonly();

export function setOptions(options: GameOptions) {
  _options.set(options);
}

export function setOption<T extends keyof GameOptions>(
  option: T,
  value: GameOptions[T],
): void {
  _options.update((state) => ({
    ...state,
    [option]: value,
  }));
}

export function getOption<T extends keyof GameOptions>(
  option: T,
): GameOptions[T] {
  return options()[option];
}
