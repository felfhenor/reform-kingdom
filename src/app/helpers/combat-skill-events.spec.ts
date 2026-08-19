import {
  combatantSkillCastEventEmit,
  combatantSkillCastEvents,
  combatantSkillCastEventsClear,
} from '@helpers/combat-skill-events';
import { beforeEach, describe, expect, it } from 'vitest';

describe('combatantSkillCastEventEmit', () => {
  beforeEach(() => {
    combatantSkillCastEvents.set([]);
  });

  it('appends a new event with the given combatantId, skill name, and sprite', () => {
    combatantSkillCastEventEmit('hero-1', 'Fireball', '0001');

    const events = combatantSkillCastEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      combatantId: 'hero-1',
      skillName: 'Fireball',
      skillSprite: '0001',
    });
  });

  it('assigns each emitted event a unique id', () => {
    combatantSkillCastEventEmit('hero-1', 'Fireball', '0001');
    combatantSkillCastEventEmit('hero-1', 'Fireball', '0001');

    const [first, second] = combatantSkillCastEvents();
    expect(first.id).not.toBe(second.id);
  });
});

describe('combatantSkillCastEventsClear', () => {
  beforeEach(() => {
    combatantSkillCastEvents.set([]);
  });

  it('removes only the events matching the given ids', () => {
    combatantSkillCastEventEmit('hero-1', 'Fireball', '0001');
    combatantSkillCastEventEmit('hero-2', 'Slash', '0002');

    const [toRemove, toKeep] = combatantSkillCastEvents();
    combatantSkillCastEventsClear([toRemove.id]);

    expect(combatantSkillCastEvents()).toEqual([toKeep]);
  });
});
