import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/engine/page-visibility', () => ({
  isPageVisible: () => true,
}));

import {
  combatantDamageEventEmit,
  combatantDamageEvents,
} from '@helpers/combat/combat-damage-events';
import { combatEventScopeRun } from '@helpers/combat/combat-event-scope';
import {
  combatantSkillCastEventEmit,
  combatantSkillCastEvents,
} from '@helpers/combat/combat-skill-events';

beforeEach(() => {
  combatantDamageEvents.set([]);
  combatantSkillCastEvents.set([]);
});

describe('combatEventScopeRun', () => {
  it('prefixes event keys only inside the scope', () => {
    combatEventScopeRun({ keyPrefix: 'sim:', muted: false }, () => {
      combatantDamageEventEmit('hero-1', 5);
      combatantSkillCastEventEmit('hero-1', 'Slash', 'slash');
    });
    combatantDamageEventEmit('hero-1', 3);

    expect(combatantDamageEvents().map((e) => e.combatantId)).toEqual([
      'sim:hero-1',
      'hero-1',
    ]);
    expect(combatantSkillCastEvents()[0]?.combatantId).toBe('sim:hero-1');
  });

  it('drops events while muted, and restores the scope after a throw', () => {
    expect(() =>
      combatEventScopeRun({ keyPrefix: 'sim:', muted: true }, () => {
        combatantDamageEventEmit('hero-1', 5);
        throw new Error('boom');
      }),
    ).toThrow('boom');
    combatantDamageEventEmit('hero-1', 2);

    expect(combatantDamageEvents().map((e) => e.combatantId)).toEqual([
      'hero-1',
    ]);
  });
});
