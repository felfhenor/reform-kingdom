import {
  combatantDamageEventEmit,
  combatantDamageEvents,
} from '@helpers/combat/combat-damage-events';
import { beforeEach, describe, expect, it } from 'vitest';

describe('combatantDamageEventEmit', () => {
  beforeEach(() => {
    combatantDamageEvents.set([]);
  });

  it('appends a new event with the given combatantId and amount', () => {
    combatantDamageEventEmit('hero-1', -25);

    const events = combatantDamageEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ combatantId: 'hero-1', amount: -25 });
  });

  it('leaves the variant unset by default', () => {
    combatantDamageEventEmit('hero-1', -25);

    expect(combatantDamageEvents()[0].variant).toBeUndefined();
  });

  it('carries the given variant, including on a zero-amount event', () => {
    combatantDamageEventEmit('hero-1', -25, 'critical');
    combatantDamageEventEmit('hero-1', 0, 'miss');

    expect(combatantDamageEvents()).toMatchObject([
      { amount: -25, variant: 'critical' },
      { amount: 0, variant: 'miss' },
    ]);
  });

  it('assigns each emitted event a unique id', () => {
    combatantDamageEventEmit('hero-1', -25);
    combatantDamageEventEmit('hero-1', -10);

    const [first, second] = combatantDamageEvents();
    expect(first.id).not.toBe(second.id);
  });
});
