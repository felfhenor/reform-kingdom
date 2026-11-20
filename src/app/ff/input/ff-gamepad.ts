import type { FFGamepadSnapshot } from '@ff/interfaces/ff-input';

const ANALOG_PRESS_THRESHOLD = 0.5;

export function ffGamepadSnapshot(
  gamepad: Pick<Gamepad, 'buttons' | 'axes'>,
): FFGamepadSnapshot {
  return {
    buttons: gamepad.buttons.map(
      (button) => button.pressed || button.value > ANALOG_PRESS_THRESHOLD,
    ),
    axes: [...gamepad.axes],
  };
}

export function ffButtonsJustPressed(
  previous: FFGamepadSnapshot | undefined,
  next: FFGamepadSnapshot,
): number[] {
  return next.buttons.flatMap((pressed, index) =>
    pressed && !previous?.buttons[index] ? [index] : [],
  );
}

export function ffButtonsJustReleased(
  previous: FFGamepadSnapshot | undefined,
  next: FFGamepadSnapshot,
): number[] {
  return (previous?.buttons ?? []).flatMap((pressed, index) =>
    pressed && !next.buttons[index] ? [index] : [],
  );
}

const STANDARD_AXIS_COUNT = 4;

export function ffAxesActive(axes: number[], deadzone: number): boolean {
  return axes
    .slice(0, STANDARD_AXIS_COUNT)
    .some((axis) => Math.abs(axis) > deadzone);
}

// Steam Input can expose one physical pad twice; the other copy can't take over until the active one goes quiet.
export function ffGamepadMayTakeInput(
  activeIndex: number | undefined,
  index: number,
  msSinceActiveInput: number,
  takeoverMs: number,
): boolean {
  return (
    activeIndex === undefined ||
    activeIndex === index ||
    msSinceActiveInput >= takeoverMs
  );
}
