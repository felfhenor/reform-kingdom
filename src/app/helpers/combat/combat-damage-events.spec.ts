import {
  combatantDamageEventEmit,
  combatantDamageEvents,
  combatantDamageEventsClear,
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

  it('assigns each emitted event a unique id', () => {
    combatantDamageEventEmit('hero-1', -25);
    combatantDamageEventEmit('hero-1', -10);

    const [first, second] = combatantDamageEvents();
    expect(first.id).not.toBe(second.id);
  });
});

describe('combatantDamageEventsClear', () => {
  beforeEach(() => {
    combatantDamageEvents.set([]);
  });

  it('removes only the events matching the given ids', () => {
    combatantDamageEventEmit('hero-1', -25);
    combatantDamageEventEmit('hero-2', 15);

    const [toRemove, toKeep] = combatantDamageEvents();
    combatantDamageEventsClear([toRemove.id]);

    expect(combatantDamageEvents()).toEqual([toKeep]);
  });
});
