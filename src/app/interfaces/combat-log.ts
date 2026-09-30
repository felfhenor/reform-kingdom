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

export type CombatLogIcon = {
  sprite: string;
  spritesheet: AtlasedImage;
};

export type CombatLog = {
  kind: AdventureLogEntryKind;
  combatId?: CombatId;
  messageId: string;
  timestamp: number;
  // Game tick at log time; missing on entries saved before it existed.
  tick?: number;
  locationName: string;
  message: string;
  spritesheet?: 'guardian' | 'hero';
  sprite?: string;
  combatants?: CombatLogCombatantSnapshot[];
  // The Nth `ITEM_ICON_TOKEN` in the message renders the Nth icon here.
  itemIcons?: CombatLogIcon[];
  // Legacy single-icon fields - still read so entries saved before `itemIcons` keep their icon.
  itemSprite?: string;
  itemSpritesheet?: AtlasedImage;
};
