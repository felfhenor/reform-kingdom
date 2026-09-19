import type { AutoModeState, GameState } from '@interfaces';

export function autoModePatch(
  state: GameState,
  patch: Partial<AutoModeState>,
): void {
  state.world.autoMode = { ...state.world.autoMode, ...patch };
}
