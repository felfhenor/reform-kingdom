import type { CombatId } from '@interfaces/combat';

export type AdventureLogEntryKind =
  'Combat' | 'Travel' | 'Gather' | 'Craft' | 'Miscellaneous';

// A combatant's HP snapshot at log time, keyed by id so `@@id@@` message
// tokens (see combatantMessageToken) can be swapped for a colored name.
export type CombatLogCombatantSnapshot = {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
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
};
