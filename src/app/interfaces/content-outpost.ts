import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasNodeBackground } from '@interfaces/node-background';
import type { HasDescription } from '@interfaces/traits';
import type {
  WorldNodeDevelopable,
  WorldNodeEntry,
  WorldNodeHideable,
} from '@interfaces/world-nodes';

export type OutpostId = Branded<string, 'OutpostId'>;

// Level 1 (built) allows setting home here; later levels shorten the death penalty, and the last unlocks teleporting.
export type OutpostContent = IsContentItem &
  HasDescription &
  WorldNodeHideable &
  WorldNodeDevelopable &
  HasNodeBackground & {
    id: OutpostId;
    __type: 'outpost';
  };

export type OutpostTeleportRow = {
  entry: WorldNodeEntry;
  level: number;
  isCurrent: boolean;
  isUnlocked: boolean;
  canTeleport: boolean;
};
