import { ffControllerFamily } from '@ff/input/ff-controller-family';
import { describe, expect, it } from 'vitest';

describe('ffControllerFamily', () => {
  it.each([
    ['Xbox 360 Controller (XInput STANDARD GAMEPAD)', 'xbox'],
    [
      'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)',
      'playstation',
    ],
    ['054c-09cc-Wireless Controller', 'playstation'],
    ['Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)', 'switch'],
    ['Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2069)', 'switch2'],
    ['Steam Deck (Vendor: 28de Product: 1205)', 'steam-deck'],
    ['Steam Controller (Vendor: 28de Product: 1102)', 'steam-controller'],
    ['Steam Virtual Gamepad (Vendor: 28de Product: 11ff)', 'xbox'],
    ['Joy-Con (L/R)', 'switch'],
    ['Some Unknown Pad', 'xbox'],
  ])('maps %s to %s', (id, family) => {
    expect(ffControllerFamily(id)).toBe(family);
  });
});
