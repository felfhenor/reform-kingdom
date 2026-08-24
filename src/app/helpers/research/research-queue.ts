import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/analytics';
import { miscellaneousMessageLog } from '@helpers/combat-log';
import { isCollectibleDiscovered } from '@helpers/collectibles';
import { getEntry } from '@helpers/content';
import {
  applyMaterialDelta,
  getGoldQuantity,
  getMaterialQuantity,
  goldCoinId,
} from '@helpers/materials';
import { notifySuccess } from '@helpers/notify';
import {
  isResearchCompleted,
  isResearchPrerequisitesMet,
  researchPointItemId,
} from '@helpers/research/research';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type { ResearchContent, ResearchId } from '@interfaces';

export function researchCanAfford(content: ResearchContent): boolean {
  if (getMaterialQuantity(researchPointItemId()) < content.cost.rp) {
    return false;
  }
  if (getGoldQuantity() < content.cost.gold) return false;

  const materialsAffordable = content.cost.materials.every(
    (material) => getMaterialQuantity(material.itemId) >= material.quantity,
  );
  if (!materialsAffordable) return false;

  return (
    !content.cost.collectibleId ||
    isCollectibleDiscovered(content.cost.collectibleId)
  );
}

// Starts `researchId` unconditionally - forfeits a different active node
// with no refund (that's the deliberate "swapping costs you" rule; the
// UI is responsible for confirming with the player before calling this,
// same as any other irreversible action in this codebase). Returns false
// without touching state if the node can't be started at all.
export function researchStartNode(researchId: ResearchId): boolean {
  const content = getEntry<ResearchContent>(researchId);
  if (!content) return false;
  if (isResearchCompleted(researchId)) return false;
  if (!isResearchPrerequisitesMet(content)) return false;
  if (!researchCanAfford(content)) return false;

  updateGamestate((state) => {
    applyMaterialDelta(state, researchPointItemId(), -content.cost.rp);
    applyMaterialDelta(state, goldCoinId(), -content.cost.gold);
    content.cost.materials.forEach((material) => {
      applyMaterialDelta(state, material.itemId, -material.quantity);
    });

    state.research = {
      status: 'Researching',
      researchId,
      ticksIntoResearch: 0,
      costPaid: content.cost,
    };
    return state;
  });

  analyticsSendDesignEvent(
    `Kingdom:Research:Start:${analyticsSafeSegment(content.name)}`,
  );
  return true;
}

function researchCompleteActive(researchId: ResearchId): void {
  const content = getEntry<ResearchContent>(researchId);

  updateGamestate((state) => {
    state.discoveredResearch[researchId] = { foundAt: Date.now() };
    state.research = {
      status: 'Idle',
      researchId: undefined,
      ticksIntoResearch: 0,
      costPaid: undefined,
    };
    return state;
  });

  notifySuccess(`Research complete: ${content?.name ?? 'Unknown'}`);
  miscellaneousMessageLog(
    `Research complete: **${content?.name ?? 'Unknown'}**.`,
  );
  analyticsSendDesignEvent(
    `Kingdom:Research:Complete:${analyticsSafeSegment(content?.name ?? 'Unknown')}`,
  );
}

// Wired into gameloop.ts alongside craftProcessTick/gatheringProcessTick.
export function researchProcessTick(): void {
  const research = gamestate().research;
  if (research.status !== 'Researching' || !research.researchId) return;

  const content = getEntry<ResearchContent>(research.researchId);
  if (!content) return; // retrofitResearch (migrate.ts) handles this case

  const ticksIntoResearch = research.ticksIntoResearch + 1;

  if (ticksIntoResearch < content.researchTime) {
    updateGamestate((state) => {
      state.research = { ...state.research, ticksIntoResearch };
      return state;
    });
    return;
  }

  researchCompleteActive(research.researchId);
}
