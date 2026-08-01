import type { CombatId } from '@interfaces/combat';

export type CombatLog = {
  combatId: CombatId;
  messageId: string;
  timestamp: number;
  locationName: string;
  message: string;
  spritesheet?: 'guardian' | 'hero';
  sprite?: string;
};
