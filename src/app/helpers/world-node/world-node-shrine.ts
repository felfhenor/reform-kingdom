import { shrinesState } from '@helpers/state-game';
import type { ShrineContent, ShrineLevel } from '@interfaces';

// Absent entry (or a missing shrines slice, e.g. mid-migration on an old save) means level 0.
export function worldNodeShrineLevel(nodeName: string): number {
  return shrinesState()?.[nodeName]?.level ?? 0;
}

// Level N grants levels[N-1]'s buff - level 0 has no tier, so the shrine requires an initial investment before it's prayable.
export function worldNodeShrineCurrentTier(
  shrine: ShrineContent,
  nodeName: string,
): ShrineLevel | undefined {
  return shrine.levels[worldNodeShrineLevel(nodeName) - 1];
}
