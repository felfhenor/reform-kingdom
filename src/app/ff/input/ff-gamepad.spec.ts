import {
  ffAxesActive,
  ffButtonsJustPressed,
  ffButtonsJustReleased,
  ffGamepadMayTakeInput,
  ffGamepadSnapshot,
  ffHeldDirection,
  ffRepeatFires,
  ffStickDirection,
  ffStickVector,
} from '@ff/input/ff-gamepad';
import { FF_STANDARD_BUTTON, ffActionMap } from '@ff/input/ff-action-map';
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

describe('ffStickDirection', () => {
  it('picks the dominant axis past the deadzone', () => {
    expect(ffStickDirection(0.9, 0.2, 0.5)).toBe('right');
    expect(ffStickDirection(-0.1, -0.8, 0.5)).toBe('up');
    expect(ffStickDirection(0.3, 0.3, 0.5)).toBeUndefined();
  });
});

describe('ffHeldDirection', () => {
  it('prefers the d-pad over the stick', () => {
    const buttons: boolean[] = [];
    buttons[FF_STANDARD_BUTTON.left] = true;
    expect(
      ffHeldDirection({ buttons, axes: [0.9, 0] }, ffActionMap('xbox'), 0.5),
    ).toBe('left');
    expect(
      ffHeldDirection(
        { buttons: [], axes: [0, 0.9] },
        ffActionMap('xbox'),
        0.5,
      ),
    ).toBe('down');
  });

  it('ignores the stick when it is claimed', () => {
    expect(
      ffHeldDirection(
        { buttons: [], axes: [0, 0.9] },
        ffActionMap('xbox'),
        0.5,
        false,
      ),
    ).toBeUndefined();
  });
});

describe('ffStickVector', () => {
  it('is zero inside the deadzone', () => {
    expect(ffStickVector(0.1, 0.1, 0.2)).toEqual({ x: 0, y: 0 });
  });

  it('reaches full length at full tilt', () => {
    const v = ffStickVector(1, 0, 0.2);
    expect(v.x).toBeCloseTo(1);
    expect(v.y).toBe(0);
  });

  it('starts from zero at the deadzone edge', () => {
    expect(ffStickVector(0, 0.6, 0.2).y).toBeCloseTo(0.5);
  });
});

describe('ffRepeatFires', () => {
  it('fires once, then repeats on an interval after the delay', () => {
    expect(ffRepeatFires(0, 400, 120)).toBe(1);
    expect(ffRepeatFires(399, 400, 120)).toBe(1);
    expect(ffRepeatFires(400, 400, 120)).toBe(2);
    expect(ffRepeatFires(640, 400, 120)).toBe(4);
  });
});
