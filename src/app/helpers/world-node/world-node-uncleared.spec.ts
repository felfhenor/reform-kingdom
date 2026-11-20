import { describe, expect, it } from 'vitest';

import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import { applyCollectibleGrant } from '@helpers/item/collectibles';
import { applyMaterialDelta } from '@helpers/item/materials';
import { isWorldNodeUncleared } from '@helpers/world-node/world-node-uncleared';
import type { CollectibleId, ItemId } from '@interfaces';
import { explore, mystical, seedDecreeWorld } from '@/testing/decree';

const relic = 'relic' as CollectibleId;
const bone = 'bone' as ItemId;
const proof = ensureDroppedReward({ collectibleId: relic, chance: 100 });
const boneDrop = ensureDroppedReward({ itemId: bone, chance: 100 });

describe('isWorldNodeUncleared', () => {
  it('is true for explore and mystical nodes until their clear is proven', () => {
    const nodes = seedDecreeWorld([
      { content: explore('Fresh', 1, 1, { completionRewards: [proof] }) },
      { content: mystical('Fresh Shrine', 1, { completionRewards: [proof] }) },
    ]);

    expect(isWorldNodeUncleared(nodes['Fresh'])).toBe(true);
    expect(isWorldNodeUncleared(nodes['Fresh Shrine'])).toBe(true);
  });

  it('is false once a clear reward is found', () => {
    const nodes = seedDecreeWorld(
      [
        { content: explore('Beaten', 1, 1, { completionRewards: [proof] }) },
        {
          content: mystical('Beaten Shrine', 1, { completionRewards: [proof] }),
        },
      ],
      (state) => applyCollectibleGrant(state, relic, 1),
    );

    expect(isWorldNodeUncleared(nodes['Beaten'])).toBe(false);
    expect(isWorldNodeUncleared(nodes['Beaten Shrine'])).toBe(false);
  });

  it('ignores a shared material found elsewhere when the node has a guaranteed collectible', () => {
    const nodes = seedDecreeWorld(
      [
        {
          content: explore('Bone Ruins', 1, 1, {
            completionRewards: [boneDrop, proof],
          }),
        },
        {
          content: explore('Bone Pit', 1, 1, { completionRewards: [boneDrop] }),
        },
      ],
      (state) => applyMaterialDelta(state, bone, 1),
    );

    expect(isWorldNodeUncleared(nodes['Bone Ruins'])).toBe(true);
    expect(isWorldNodeUncleared(nodes['Bone Pit'])).toBe(false);
  });

  it('is false for forgotten nodes still drawn on the map', () => {
    const nodes = seedDecreeWorld(
      [{ content: explore('Lost', 1) }],
      (state) => {
        state.globalEffectSums.removedWorldNodeTypes.ExploreNode = true;
      },
    );

    expect(isWorldNodeUncleared(nodes['Lost'])).toBe(false);
  });

  it('is false for hidden nodes not yet discovered', () => {
    const nodes = seedDecreeWorld([
      { content: explore('Secret', 1, 1, { hidden: true }) },
    ]);

    expect(isWorldNodeUncleared(nodes['Secret'])).toBe(false);
  });

  it('is false for non-encounter nodes', () => {
    const nodes = seedDecreeWorld([{ name: 'Home', type: 'Kingdom' }]);

    expect(isWorldNodeUncleared(nodes['Home'])).toBe(false);
  });
});
