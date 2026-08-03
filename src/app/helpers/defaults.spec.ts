import { defaultTravelState } from '@helpers/defaults';
import { describe, expect, it } from 'vitest';

describe('defaultTravelState', () => {
  it('should return an idle travel state with an empty path', () => {
    expect(defaultTravelState()).toEqual({
      status: 'Idle',
      path: [],
      ticksIntoStep: 0,
    });
  });
});
