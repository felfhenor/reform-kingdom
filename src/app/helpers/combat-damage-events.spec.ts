import {
  heroDamageEventEmit,
  heroDamageEvents,
  heroDamageEventsClear,
} from '@helpers/combat-damage-events';
import { beforeEach, describe, expect, it } from 'vitest';

describe('heroDamageEventEmit', () => {
  beforeEach(() => {
    heroDamageEvents.set([]);
  });

  it('appends a new event with the given characterId and amount', () => {
    heroDamageEventEmit('hero-1', -25);

    const events = heroDamageEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ characterId: 'hero-1', amount: -25 });
  });

  it('assigns each emitted event a unique id', () => {
    heroDamageEventEmit('hero-1', -25);
    heroDamageEventEmit('hero-1', -10);

    const [first, second] = heroDamageEvents();
    expect(first.id).not.toBe(second.id);
  });
});

describe('heroDamageEventsClear', () => {
  beforeEach(() => {
    heroDamageEvents.set([]);
  });

  it('removes only the events matching the given ids', () => {
    heroDamageEventEmit('hero-1', -25);
    heroDamageEventEmit('hero-2', 15);

    const [toRemove, toKeep] = heroDamageEvents();
    heroDamageEventsClear([toRemove.id]);

    expect(heroDamageEvents()).toEqual([toKeep]);
  });
});
