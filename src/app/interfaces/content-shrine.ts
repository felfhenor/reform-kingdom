import type { CostItem } from '@interfaces/cost';
import type { GlobalEffectId } from '@interfaces/content-globaleffect';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';
import type { WorldNodeHideable } from '@interfaces/world-nodes';

export type ShrineId = Branded<string, 'ShrineId'>;

export type ShrineLevel = {
  costs: CostItem[];
  globalEffectId: GlobalEffectId;
  globalEffectDuration: number;
};

export type ShrineContent = IsContentItem &
  HasDescription &
  WorldNodeHideable & {
    id: ShrineId;
    __type: 'shrine';

    // Level N grants levels[N]'s buff (level 0 -> tier I is free); levels[N].costs is
    // the price to reach level N+1 - the last entry's costs are unused once maxed.
    levels: ShrineLevel[];
  };
