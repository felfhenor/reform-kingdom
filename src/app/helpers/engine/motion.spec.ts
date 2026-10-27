import {
  isMotionReduced,
  motionSystemPreferenceSet,
} from '@helpers/engine/motion';
import { setOption } from '@helpers/state-options';
import { afterEach, describe, expect, it } from 'vitest';

describe('isMotionReduced', () => {
  afterEach(() => {
    setOption('motionPreference', 'system');
    motionSystemPreferenceSet(false);
  });

  it('follows the system preference by default', () => {
    expect(isMotionReduced()).toBe(false);
    motionSystemPreferenceSet(true);
    expect(isMotionReduced()).toBe(true);
  });

  it('can be forced on regardless of the system', () => {
    setOption('motionPreference', 'reduced');
    expect(isMotionReduced()).toBe(true);
  });

  it('can be forced off even when the system asks for reduced motion', () => {
    motionSystemPreferenceSet(true);
    setOption('motionPreference', 'full');
    expect(isMotionReduced()).toBe(false);
  });
});
