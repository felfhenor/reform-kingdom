import { describe, expect, it } from 'vitest';
import { analyticsBoundEventId, analyticsSafeSegment } from '@helpers/analytics';

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

describe('analyticsBoundEventId', () => {
  it('strips characters outside letters, digits, and colons', () => {
    expect(analyticsBoundEventId("World:Node:Discover:S.S. Antigonus!")).toBe(
      'World:Node:Discover:SSAntigonus',
    );
  });

  it('leaves a short, well-formed event id untouched', () => {
    expect(analyticsBoundEventId('World:Node:Discover:HiddenGrove')).toBe(
      'World:Node:Discover:HiddenGrove',
    );
  });

  it('truncates each segment to 32 characters', () => {
    const longName = 'A'.repeat(40);

    expect(analyticsBoundEventId(`World:Node:Discover:${longName}`)).toBe(
      `World:Node:Discover:${'A'.repeat(32)}`,
    );
  });

  it('caps the event id at 5 segments, dropping any beyond that', () => {
    expect(analyticsBoundEventId('One:Two:Three:Four:Five:Six')).toBe(
      'One:Two:Three:Four:Five',
    );
  });
});
