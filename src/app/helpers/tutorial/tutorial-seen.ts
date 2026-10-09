import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { ledgerHas, ledgerMark } from '@helpers/engine/ledger';
import { tutorialsState, updateGamestate } from '@helpers/state-game';
import { TUTORIAL_CATALOG } from '@helpers/tutorial/tutorial-catalog';
import { tutorialTriggerSatisfied } from '@helpers/tutorial/tutorial-triggers';
import type { TutorialId } from '@interfaces';

export function isTutorialSeen(tutorialId: TutorialId): boolean {
  return ledgerHas(tutorialsState(), tutorialId);
}

// Awaits the write (updateGamestate defers outside a tick) so a caller checking isTutorialSeen right after sees it committed.
export async function tutorialMarkSeen(tutorialId: TutorialId): Promise<void> {
  if (isTutorialSeen(tutorialId)) return;

  await updateGamestate((state) => {
    ledgerMark(state.tutorials, tutorialId);
    return state;
  });

  analyticsSendDesignEvent(`Tutorial:Seen:${analyticsSafeSegment(tutorialId)}`);
}

export function tutorialUnmarkSeen(tutorialId: TutorialId): void {
  updateGamestate((state) => {
    delete state.tutorials[tutorialId];
    return state;
  });
}

export function tutorialRearmProcessTick(): void {
  TUTORIAL_CATALOG.forEach((tutorial) => {
    if (!tutorial.repeatable || !isTutorialSeen(tutorial.id)) return;
    if (tutorialTriggerSatisfied(tutorial.trigger)) return;
    tutorialUnmarkSeen(tutorial.id);
  });
}
