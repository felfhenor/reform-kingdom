import {
  combatantSkillCastEventEmit,
  combatantSkillCastEvents,
} from '@helpers/combat/combat-skill-events';
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
