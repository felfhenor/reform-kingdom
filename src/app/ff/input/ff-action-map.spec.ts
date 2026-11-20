import {
  FF_STANDARD_BUTTON,
  ffActionMap,
  ffActionForButton,
} from '@ff/input/ff-action-map';
import { describe, expect, it } from 'vitest';

describe('ffActionMap', () => {
  it('confirms with the bottom face button by default', () => {
    const map = ffActionMap('xbox');
    expect(map.confirm).toBe(FF_STANDARD_BUTTON.south);
    expect(map.back).toBe(FF_STANDARD_BUTTON.east);
  });

  it.each(['switch', 'switch2'] as const)(
    'swaps face buttons to follow Nintendo labels for %s',
    (family) => {
      const map = ffActionMap(family);
      expect(map.confirm).toBe(FF_STANDARD_BUTTON.east);
      expect(map.back).toBe(FF_STANDARD_BUTTON.south);
      expect(map.context).toBe(FF_STANDARD_BUTTON.north);
      expect(map.details).toBe(FF_STANDARD_BUTTON.west);
      expect(map.tabNext).toBe(FF_STANDARD_BUTTON.rb);
    },
  );
});

describe('ffActionForButton', () => {
  it('resolves a pressed button to its action', () => {
    const map = ffActionMap('xbox');
    expect(ffActionForButton(map, FF_STANDARD_BUTTON.rb)).toBe('tabNext');
    expect(ffActionForButton(map, FF_STANDARD_BUTTON.start)).toBe('menu');
  });

  it('returns undefined for unmapped buttons', () => {
    expect(ffActionForButton(ffActionMap('xbox'), 16)).toBeUndefined();
  });
});
