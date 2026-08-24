import type { ResearchId } from '@interfaces/content-research';

export type HasDescription = {
  description: string;
};

// Shared by map-placed content (encounters, gathering nodes, caravans, etc.)
// that can be fogged until discovered or entirely absent until research
// unlocks it. `hidden` is proximity-based fog-of-war (see
// `world-node-discovery.ts`); `blockedByResearchId` is existence-gating -
// the node doesn't exist at all until that research completes. The two are
// independent and can coexist on the same content.
export type HasMapNodeGating = {
  hidden?: boolean;
  // `?:` so plain (non-Required<>) usages can omit this entirely, matching
  // every other optional field on these content types; the explicit
  // `| undefined` keeps that same nullability available once `Required<T>`
  // strips the `?` modifier (used by every content-initializer's `ensure*`
  // function) - same combination already used by
  // `EquipmentContent.debuffResistances?: Record<...> | undefined`.
  blockedByResearchId?: ResearchId | undefined;
};
