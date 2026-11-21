import { FF_DIRECTIONS } from '@ff/input/ff-action-map';
import type {
  FFActionMap,
  FFDirection,
  FFGamepadSnapshot,
} from '@ff/interfaces/ff-input';

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

export function ffStickDirection(
  x: number,
  y: number,
  deadzone: number,
): FFDirection | undefined {
  if (Math.max(Math.abs(x), Math.abs(y)) <= deadzone) return undefined;
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'right' : 'left';
  return y > 0 ? 'down' : 'up';
}

// A claimed left stick (e.g. panning a map) leaves directions to the D-pad alone.
export function ffHeldDirection(
  snapshot: FFGamepadSnapshot,
  actionMap: FFActionMap,
  deadzone: number,
  useStick = true,
): FFDirection | undefined {
  const dpad = FF_DIRECTIONS.find(
    (direction) => snapshot.buttons[actionMap[direction]],
  );
  if (dpad || !useStick) return dpad;
  return ffStickDirection(
    snapshot.axes[0] ?? 0,
    snapshot.axes[1] ?? 0,
    deadzone,
  );
}

// Radial deadzone, rescaled so movement starts from 0 at its edge and reaches 1 at full tilt.
export function ffStickVector(
  x: number,
  y: number,
  deadzone: number,
): { x: number; y: number } {
  const length = Math.hypot(x, y);
  if (length <= deadzone) return { x: 0, y: 0 };

  const scale = Math.min(1, (length - deadzone) / (1 - deadzone)) / length;
  return { x: x * scale, y: y * scale };
}

// Total fires owed for a hold of heldMs: one on press, then one per interval after the delay.
export function ffRepeatFires(
  heldMs: number,
  delayMs: number,
  intervalMs: number,
): number {
  return heldMs < delayMs ? 1 : 2 + Math.floor((heldMs - delayMs) / intervalMs);
}
