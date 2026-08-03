import {
  adventureLogMessageHtml,
  adventureLogTimestampTooltip,
  beginCombatLogCommits,
  combatLog,
  combatLogReset,
  combatMessageLog,
  endCombatLogCommits,
  travelMessageLog,
} from '@helpers/combat-log';
import type { Combat, Combatant } from '@interfaces';
import { beforeEach, describe, expect, it } from 'vitest';

describe('combatMessageLog', () => {
  beforeEach(() => {
    combatLogReset();
  });

  it('snapshots the actor hp/maxHp onto the entry', () => {
    const combat = {
      id: 'combat-1',
      locationName: 'Field Ruins',
    } as unknown as Combat;
    const actor = {
      isEnemy: false,
      sprite: '0000',
      hp: 12,
      totalStats: { Health: 20 },
    } as unknown as Combatant;

    beginCombatLogCommits();
    combatMessageLog(combat, '**Jala** attacks Goblin.', actor);
    endCombatLogCommits();

    expect(combatLog()[0]).toMatchObject({
      hp: 12,
      maxHp: 20,
      spritesheet: 'hero',
    });
  });

  it('leaves hp/maxHp undefined when there is no actor', () => {
    const combat = {
      id: 'combat-1',
      locationName: 'Field Ruins',
    } as unknown as Combat;

    beginCombatLogCommits();
    combatMessageLog(combat, 'Combat is over.');
    endCombatLogCommits();

    expect(combatLog()[0].hp).toBeUndefined();
    expect(combatLog()[0].maxHp).toBeUndefined();
  });
});

describe('travelMessageLog', () => {
  beforeEach(() => {
    combatLogReset();
  });

  it('pushes a Travel-kind entry with no combatId onto the shared adventure log', () => {
    travelMessageLog('Duchy of Carrina', 'The party left for Field Ruins.');

    expect(combatLog()).toHaveLength(1);
    expect(combatLog()[0].combatId).toBeUndefined();
    expect(combatLog()[0]).toMatchObject({
      kind: 'Travel',
      locationName: 'Duchy of Carrina',
      message: 'The party left for Field Ruins.',
    });
  });

  it('prepends new entries so the log stays newest-first', () => {
    travelMessageLog('Duchy of Carrina', 'The party left for Field Ruins.');
    travelMessageLog('Field Ruins', 'The party has arrived at Field Ruins.');

    expect(combatLog().map((entry) => entry.message)).toEqual([
      'The party has arrived at Field Ruins.',
      'The party left for Field Ruins.',
    ]);
  });
});

describe('adventureLogMessageHtml', () => {
  it('renders markdown emphasis inline, without wrapping paragraph tags', () => {
    expect(adventureLogMessageHtml('**Jala** attacks **Goblin** for 8 damage.')).toBe(
      '<strong>Jala</strong> attacks <strong>Goblin</strong> for 8 damage.',
    );
  });

  it('renders italic markdown', () => {
    expect(adventureLogMessageHtml('_Combat round 2._')).toBe(
      '<em>Combat round 2.</em>',
    );
  });

  it('passes plain text through unchanged', () => {
    expect(adventureLogMessageHtml('Combat is over.')).toBe('Combat is over.');
  });
});

describe('adventureLogTimestampTooltip', () => {
  it('formats a timestamp as zero-padded HH:mm:ss', () => {
    const date = new Date(2026, 0, 1, 4, 5, 6);
    expect(adventureLogTimestampTooltip(date.getTime())).toBe('04:05:06');
  });
});
