import { dictionaryWithout } from '@helpers/engine/dictionary';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { tutorialsState, updateGamestate } from '@helpers/state-game';
import type { GameStateTutorials, TutorialId } from '@interfaces';

export function isTutorialSeen(tutorialId: TutorialId): boolean {
  return !!tutorialsState()[tutorialId]?.foundAt;
}

// Awaits the write (updateGamestate defers outside a tick) so a caller checking isTutorialSeen right after sees it committed.
export async function tutorialMarkSeen(tutorialId: TutorialId): Promise<void> {
  if (isTutorialSeen(tutorialId)) return;

  await updateGamestate((state) => {
    state.tutorials = {
      ...state.tutorials,
      [tutorialId]: { foundAt: Date.now() },
    };
    return state;
  });

  analyticsSendDesignEvent(`Tutorial:Seen:${analyticsSafeSegment(tutorialId)}`);
}

// Debug tool: reverts a tutorial back to unseen.
export function tutorialUnmarkSeen(tutorialId: TutorialId): void {
  updateGamestate((state) => {
    state.tutorials = dictionaryWithout(state.tutorials, tutorialId);
    return state;
  });
}

export function pruneInvalidTutorials(
  tutorials: GameStateTutorials,
  isKnownTutorialId: (tutorialId: TutorialId) => boolean,
): GameStateTutorials {
  const pruned: GameStateTutorials = {};

  Object.keys(tutorials).forEach((tutorialId) => {
    if (isKnownTutorialId(tutorialId)) {
      pruned[tutorialId] = tutorials[tutorialId];
    }
  });

  return pruned;
}
