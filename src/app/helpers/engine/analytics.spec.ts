import { analyticsSafeSegment } from '@helpers/engine/analytics';
import { describe, expect, it } from 'vitest';

describe('analyticsSafeSegment', () => {
  it('strips colons so a name cannot fragment into extra segments', () => {
    expect(analyticsSafeSegment('Material: Copper Ingot')).toBe(
      'Material Copper Ingot',
    );
  });

  it('leaves a name with no colons untouched', () => {
    expect(analyticsSafeSegment('Founding Stone')).toBe('Founding Stone');
  });
});
