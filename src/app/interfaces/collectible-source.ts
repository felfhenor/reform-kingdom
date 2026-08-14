// Where a collectible can be obtained, derived entirely from static content
// (encounter/encounterrandom drops, recipe results, trader sells) rather
// than tracked per-player - see `collectibleSourceMapBuild` in
// `helpers/collectible-source.ts`. Each collectible is expected to have
// exactly one of these; more than one is a content-authoring error.
export type CollectibleSource =
  | { type: 'node'; name: string }
  | { type: 'crafting' }
  | { type: 'trader'; name: string };
