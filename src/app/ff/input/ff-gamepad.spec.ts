import {
  ffAxesActive,
  ffButtonsJustPressed,
  ffButtonsJustReleased,
  ffGamepadMayTakeInput,
  ffGamepadSnapshot,
} from '@ff/input/ff-gamepad';
import { describe, expect, it } from 'vitest';

function button(pressed: boolean, value = pressed ? 1 : 0): GamepadButton {
  return { pressed, touched: pressed, value };
}

describe('ffGamepadSnapshot', () => {
  it('treats analog values past the threshold as pressed', () => {
    const snapshot = ffGamepadSnapshot({
      buttons: [button(true), button(false, 0.7), button(false, 0.2)],
      axes: [0.1, -0.9],
    });
    expect(snapshot).toEqual({
      buttons: [true, true, false],
      axes: [0.1, -0.9],
    });
  });
});

describe('ffButtonsJustPressed', () => {
  it('returns only buttons that went from released to pressed', () => {
    const previous = { buttons: [true, false, false], axes: [] };
    const next = { buttons: [true, true, false], axes: [] };
    expect(ffButtonsJustPressed(previous, next)).toEqual([1]);
  });

  it('treats every held button as new without a previous snapshot', () => {
    expect(
      ffButtonsJustPressed(undefined, { buttons: [false, true], axes: [] }),
    ).toEqual([1]);
  });
});

describe('ffButtonsJustReleased', () => {
  it('returns only buttons that went from pressed to released', () => {
    const previous = { buttons: [true, true, false], axes: [] };
    const next = { buttons: [true, false, false], axes: [] };
    expect(ffButtonsJustReleased(previous, next)).toEqual([1]);
  });

  it('releases nothing without a previous snapshot', () => {
    expect(
      ffButtonsJustReleased(undefined, { buttons: [false], axes: [] }),
    ).toEqual([]);
  });
});

describe('ffAxesActive', () => {
  it('ignores stick drift inside the deadzone', () => {
    expect(ffAxesActive([0.2, -0.3], 0.5)).toBe(false);
    expect(ffAxesActive([0.2, -0.6], 0.5)).toBe(true);
  });

  it('ignores axes past the four standard sticks', () => {
    expect(ffAxesActive([0, 0, 0, 0, 1.29], 0.5)).toBe(false);
  });
});

describe('ffGamepadMayTakeInput', () => {
  it('lets the active or first pad through', () => {
    expect(ffGamepadMayTakeInput(undefined, 1, 0, 250)).toBe(true);
    expect(ffGamepadMayTakeInput(1, 1, 0, 250)).toBe(true);
  });

  it('blocks a second pad until the active one goes quiet', () => {
    expect(ffGamepadMayTakeInput(0, 1, 100, 250)).toBe(false);
    expect(ffGamepadMayTakeInput(0, 1, 250, 250)).toBe(true);
  });
});
