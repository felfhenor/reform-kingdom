import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';
import type {
  WorldNodeDevelopable,
  WorldNodeHideable,
} from '@interfaces/world-nodes';

export type OutpostId = Branded<string, 'OutpostId'>;

// Level 1 (built) allows setting home here; each level past it shortens the death penalty.
export type OutpostContent = IsContentItem &
  HasDescription &
  WorldNodeHideable &
  WorldNodeDevelopable & {
    id: OutpostId;
    __type: 'outpost';
  };
