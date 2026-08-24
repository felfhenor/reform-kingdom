import type { ResearchContent } from '@interfaces/content-research';

export type ResearchNodeState = 'Locked' | 'Available' | 'Active' | 'Completed';

export type ResearchTreeLayoutCell = {
  content: ResearchContent;
  state: ResearchNodeState;
  affordable: boolean;
  // Only meaningful when state === 'Active'.
  progressFraction: number;
};

// A row is an array of these, one per authored cell (including blanks), so
// column position is preserved for alignment - `undefined` renders as an
// empty same-sized slot, covering both an authored `{ blank: true }` cell
// and a dangling/unresolvable researchId (the researchtreeplacement
// validator is what actually catches the latter as a content bug).
export type ResearchTreeLayoutRowCell = ResearchTreeLayoutCell | undefined;
