// A `{min,max}` level range - shared by anything that gates or labels
// content by player level (encounters, caravans, gathering nodes, etc.)
// rather than each having its own identically-shaped alias.
export type LevelRange = {
  min: number;
  max: number;
};
