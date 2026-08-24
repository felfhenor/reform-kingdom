import type { ResearchId } from '@interfaces/content-research';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type ResearchTreeId = Branded<string, 'ResearchTreeId'>;

// Wrapped in an object (not a bare ResearchId) to match the gamedata
// auto-linker's convention for cross-content references - see
// content-recipe.ts's RecipeRequirementItem, droppable.ts's DropItem, etc.
export type ResearchTreeNodeCell = {
  researchId: ResearchId;
};

// An empty placeholder position - e.g. `- blank: true` in a row's YAML -
// used purely to keep a later row's node(s) visually aligned under the
// right column (see "Quartermaster's Contracts III" in
// gamedata/researchtree/expedition.yml, which needs a blank before it so it
// lines up under "Quartermaster's Contracts II" rather than the first
// column). Carries no cross-reference, so the gamedata auto-linker leaves
// it alone.
export type ResearchTreeBlankCell = {
  blank: true;
};

export type ResearchTreeCell = ResearchTreeNodeCell | ResearchTreeBlankCell;

export type ResearchTreeContent = IsContentItem &
  HasDescription & {
    id: ResearchTreeId;
    __type: 'researchtree';

    // One entry per tab. Row/column are positional - a cell's row is its
    // index in `rows`, its column is its index within that row - rather than
    // separately-authored numbers that could drift out of sync with where
    // the node is actually drawn. Row index also doubles as that row's cost
    // tier (row 0 = Tier 1, row 1 = Tier 2, etc.) - see the researchrpgaps
    // and researchtreeplacement validators.
    rows: ResearchTreeCell[][];
  };
