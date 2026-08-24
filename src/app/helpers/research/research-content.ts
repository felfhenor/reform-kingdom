// Pure content-only research queries - deliberately free of any gamestate
// import. `research.ts` re-exports these for normal app use, but CLI
// validators (scripts/validate-researchrpgaps.ts) must import directly from
// here: importing anything that touches state-game.ts pulls in Angular
// platform code that ts-node can't JIT-compile outside the app, breaking
// the CLI (see analysis-researchrpgaps.ts).
import { getEntriesByType, getEntry } from '@helpers/content';
import type { ItemContent, ItemId, ResearchContent } from '@interfaces';

const RESEARCH_POINT_NAME = 'Insight Crystal';

export function researchPointItemId(): ItemId {
  return getEntry<ItemContent>(RESEARCH_POINT_NAME)!.id;
}

export function researchEntries(): ResearchContent[] {
  return getEntriesByType<ResearchContent>('research');
}
