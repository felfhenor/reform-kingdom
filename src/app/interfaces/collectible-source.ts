// Derived from static content, not tracked per-player - see collectibleSourceMapBuild. Expected exactly one per collectible.
export type CollectibleSource =
  | { type: 'node'; name: string }
  | { type: 'crafting' }
  | { type: 'trader'; name: string };
