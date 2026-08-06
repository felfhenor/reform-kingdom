import type { CombatId } from '@interfaces/combat';

export type AdventureLogEntryKind =
  | 'Combat'
  | 'Travel'
  | 'Gather'
  | 'Craft'
  | 'Miscellaneous';

export type CombatLog = {
  kind: AdventureLogEntryKind;
  combatId?: CombatId;
  messageId: string;
  timestamp: number;
  locationName: string;
  message: string;
  spritesheet?: 'guardian' | 'hero';
  sprite?: string;
  hp?: number;
  maxHp?: number;
};
