import { getEntry } from '@helpers/content/content';
import { pruneInvalidTownStock } from '@helpers/town/shop/town-stock';
import {
  pruneInvalidTownCraftQueue,
  pruneInvalidTownTradeskills,
  townTradeskillsMaterialize,
} from '@helpers/town/crafting/town-craft-tradeskills';
import { pruneInvalidTownSpecialtyPriority } from '@helpers/town/crafting/town-craft-priority-state';
import { pruneInvalidTownCommissionSlots } from '@helpers/town/town-commission-slots';
import { pruneInvalidTownMaterials } from '@helpers/town/town-materials';
import {
  pruneInvalidTownWorkers,
  townWorkerRosterMaterialize,
} from '@helpers/town/worker/town-worker-roster';
import type { GameStateTowns, TownContent, TownId } from '@interfaces';

export function pruneInvalidTowns(towns: GameStateTowns): GameStateTowns {
  const pruned: GameStateTowns = {};

  (Object.keys(towns) as TownId[]).forEach((townId) => {
    const town = getEntry<TownContent>(townId);
    if (town) {
      // Materialize after pruning, not just at first-visit - self-heals legacy saves and content that later adds a roster entry.
      const workers = townWorkerRosterMaterialize(
        town,
        pruneInvalidTownWorkers(town, towns[townId].workers ?? {}),
      );

      pruned[townId] = {
        ...towns[townId],
        lastProcessedTick: towns[townId].lastProcessedTick ?? {},
        stock: pruneInvalidTownStock(towns[townId].stock ?? []),
        workers,
        reputation: towns[townId].reputation ?? 0,
        hiddenGold: towns[townId].hiddenGold ?? 0,
        materials: pruneInvalidTownMaterials(towns[townId].materials ?? {}),
        tradeskills: townTradeskillsMaterialize(
          townId,
          pruneInvalidTownTradeskills(towns[townId].tradeskills ?? {}),
        ),
        craftQueue: pruneInvalidTownCraftQueue(towns[townId].craftQueue ?? []),
        commissionSlots: pruneInvalidTownCommissionSlots(
          towns[townId].commissionSlots ?? [],
        ),
        specialtyPriority: pruneInvalidTownSpecialtyPriority(
          towns[townId].specialtyPriority ?? [],
        ),
      };
    }
  });

  return pruned;
}
