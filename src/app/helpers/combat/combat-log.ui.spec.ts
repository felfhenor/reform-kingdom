import { adventureLogMessageParts } from '@helpers/combat/combat-log.ui';
import type { CombatLog } from '@interfaces';
import { describe, expect, it } from 'vitest';

function buildEntry(overrides: Partial<CombatLog>): CombatLog {
  return {
    kind: 'Raid',
    messageId: 'm1',
    timestamp: 0,
    locationName: 'Larsia',
    message: '',
    ...overrides,
  };
}

describe('adventureLogMessageParts', () => {
  it('gives each item-icon token its own icon, in order', () => {
    const parts = adventureLogMessageParts(
      buildEntry({
        message: 'Lost @@icon@@wood, @@icon@@stone',
        itemIcons: [
          { sprite: 'wood', spritesheet: 'item' },
          { sprite: 'stone', spritesheet: 'item' },
        ],
      }),
    );

    expect(parts).toEqual([
      { kind: 'text', html: 'Lost ' },
      { kind: 'icon', sprite: 'wood', spritesheet: 'item' },
      { kind: 'text', html: 'wood, ' },
      { kind: 'icon', sprite: 'stone', spritesheet: 'item' },
      { kind: 'text', html: 'stone' },
    ]);
  });

  it('does not advance the item-icon counter on combatant portrait tokens', () => {
    const parts = adventureLogMessageParts(
      buildEntry({
        message: '@@icon-h1@@**@@h1@@** found @@icon@@wood',
        combatants: [
          {
            id: 'h1',
            name: 'Jala',
            hp: 10,
            maxHp: 10,
            sprite: 'jala',
            spritesheet: 'job',
          },
        ],
        itemIcons: [{ sprite: 'wood', spritesheet: 'item' }],
      }),
    );

    expect(parts.filter((part) => part.kind === 'icon')).toEqual([
      { kind: 'icon', sprite: 'jala', spritesheet: 'job' },
      { kind: 'icon', sprite: 'wood', spritesheet: 'item' },
    ]);
  });

  it('falls back to the legacy single-icon fields for older entries', () => {
    const parts = adventureLogMessageParts(
      buildEntry({
        message: 'Found @@icon@@wood',
        itemSprite: 'wood',
        itemSpritesheet: 'item',
      }),
    );

    expect(parts).toEqual([
      { kind: 'text', html: 'Found ' },
      { kind: 'icon', sprite: 'wood', spritesheet: 'item' },
      { kind: 'text', html: 'wood' },
    ]);
  });
});
