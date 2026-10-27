import { WINDOW_SIZE_PRESETS } from '@helpers/config';
import type {
  ElectronWindowBridge,
  ElectronWindowState,
  WindowSizeChoice,
  WindowWithElectronWindowBridge,
} from '@interfaces';

const WINDOW_SIZE_MAXIMIZED_ID = 'maximized';

// Partial since a desktop build older than these handlers still exposes the savefile bridge.
function electronWindowBridge(): Partial<ElectronWindowBridge> | undefined {
  return (window as WindowWithElectronWindowBridge).reformElectron;
}

export async function electronWindowState(): Promise<
  ElectronWindowState | undefined
> {
  return electronWindowBridge()?.windowGet?.();
}

export async function electronWindowSetFullscreen(
  fullscreen: boolean,
): Promise<ElectronWindowState | undefined> {
  return electronWindowBridge()?.windowSetFullscreen?.(fullscreen);
}

export async function electronWindowSetSize(
  choice: WindowSizeChoice,
): Promise<ElectronWindowState | undefined> {
  return electronWindowBridge()?.windowSetSize?.(choice.width, choice.height);
}

export function electronWindowOnSaveBeforeClose(
  callback: () => Promise<boolean>,
): (() => void) | undefined {
  return electronWindowBridge()?.windowOnSaveBeforeClose?.(callback);
}

export function electronWindowOnChange(
  callback: (state: ElectronWindowState) => void,
): (() => void) | undefined {
  return electronWindowBridge()?.windowOnChange?.(callback);
}

function windowSizePresetChoices(
  state: ElectronWindowState,
): WindowSizeChoice[] {
  return WINDOW_SIZE_PRESETS.filter(
    ({ width, height }) =>
      width >= state.minWidth &&
      height >= state.minHeight &&
      width <= state.maxWidth &&
      height <= state.maxHeight,
  ).map(({ width, height }) => ({
    id: `${width}x${height}`,
    label: `${width} × ${height}`,
    width,
    height,
  }));
}

// Off by one is tolerated since display scaling rounds the size read back from the window.
export function windowSizeCurrentId(state: ElectronWindowState): string {
  if (state.maximized) return WINDOW_SIZE_MAXIMIZED_ID;

  const preset = windowSizePresetChoices(state).find(
    ({ width, height }) =>
      Math.abs(width - state.width) <= 1 &&
      Math.abs(height - state.height) <= 1,
  );
  return preset?.id ?? `${state.width}x${state.height}`;
}

// Presets that fit the current display, plus the current size when it isn't one of them.
export function windowSizeChoices(
  state: ElectronWindowState,
): WindowSizeChoice[] {
  const choices = windowSizePresetChoices(state);
  const currentId = windowSizeCurrentId(state);
  if (choices.some((choice) => choice.id === currentId)) return choices;

  const label = state.maximized
    ? 'Maximized'
    : `Custom (${state.width} × ${state.height})`;
  const current = {
    id: currentId,
    label,
    width: state.width,
    height: state.height,
  };
  return [current, ...choices];
}
