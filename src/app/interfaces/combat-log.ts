import type { AtlasedImage } from '@interfaces/artable';
import type { CombatId } from '@interfaces/combat';

export type AdventureLogEntryKind =
  'Combat' | 'Travel' | 'Gather' | 'Craft' | 'Raid' | 'Miscellaneous';

// A combatant's HP snapshot at log time, keyed by id so `@@id@@` message
// tokens can be swapped for a colored name (and `@@icon-id@@` tokens for its portrait).
export type CombatLogCombatantSnapshot = {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  sprite: string;
  spritesheet: AtlasedImage;
};

export type CombatLog = {
  kind: AdventureLogEntryKind;
  combatId?: CombatId;
  messageId: string;
  timestamp: number;
  locationName: string;
  message: string;
  spritesheet?: 'guardian' | 'hero';
  sprite?: string;
  combatants?: CombatLogCombatantSnapshot[];
  // Reward icon rendered inline next to the item name (see `ITEM_ICON_TOKEN`), when this entry represents a gain/loss.
  itemSprite?: string;
  itemSpritesheet?: AtlasedImage;
};
