import type { GlobalEffectId } from '@interfaces/content-globaleffect';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';
import type {
  WorldNodeDevelopmentLevel,
  WorldNodeHideable,
} from '@interfaces/world-nodes';

export type ShrineId = Branded<string, 'ShrineId'>;

export type ShrineLevel = WorldNodeDevelopmentLevel & {
  globalEffectId: GlobalEffectId;
  globalEffectDuration: number;
};

export type ShrineContent = IsContentItem &
  HasDescription &
  WorldNodeHideable & {
    id: ShrineId;
    __type: 'shrine';

    // Level 0 = no investment (not prayable); level N (1..levels.length) grants
    // levels[N-1]'s buff, unlocked by paying levels[N-1].costs.
    levels: ShrineLevel[];
  };
