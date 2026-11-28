import type { AtlasedImage } from '@interfaces/artable';
import type { CombatId } from '@interfaces/combat';

export type AdventureLogEntryKind =
  | 'Combat'
  | 'Travel'
  | 'Gather'
  | 'Craft'
  | 'Raid'
  | 'Achievement'
  | 'Miscellaneous';

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

// One reward in a log line's list - `html` carries its own icon token when `icon` is set.
export type AdventureLogRewardPart = {
  html: string;
  icon?: CombatLogIcon;
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
  // Lets views find round starts and outcomes whatever language the line was logged in.
  marker?: CombatLogMarker;
  // The Nth `ITEM_ICON_TOKEN` in the message renders the Nth icon here.
  itemIcons?: CombatLogIcon[];
  // Legacy single-icon fields - still read so entries saved before `itemIcons` keep their icon.
  itemSprite?: string;
  itemSpritesheet?: AtlasedImage;
};

export type CombatLogMarker = 'roundStart' | 'won' | 'escaped';
