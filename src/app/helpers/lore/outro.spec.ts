import { describe, expect, it } from 'vitest';

import { ensureCollectible } from '@helpers/content/ensure-item';
import {
  isOutroCrawlPending,
  isStoryScreenPending,
  isVictoryPopupPending,
} from '@helpers/lore/outro';
import type { CollectibleId } from '@interfaces';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const forgetterId = 'memory-of-the-forgetter' as CollectibleId;

function seedFelDefeated(
  meta: { outroCrawlSeen?: boolean; victoryPopupSeen?: boolean } = {},
  skipStoryCrawls = false,
): void {
  seedContent([
    ensureCollectible({ id: forgetterId, name: 'Memory of the Forgetter' }),
  ]);
  seedGamestate((state) => {
    state.collectibles[forgetterId] = { quantity: 1, foundAt: 1000 };
    state.globalEffectSums.skipStoryCrawls = skipStoryCrawls;
    Object.assign(state.meta, meta);
  });
}

describe('isOutroCrawlPending', () => {
  it('waits for the final collectible', () => {
    seedContent([
      ensureCollectible({ id: forgetterId, name: 'Memory of the Forgetter' }),
    ]);
    seedGamestate();

    expect(isOutroCrawlPending()).toBe(false);
  });

  it('plays once the final collectible is found, until it has been seen', () => {
    seedFelDefeated();
    expect(isOutroCrawlPending()).toBe(true);

    seedFelDefeated({ outroCrawlSeen: true });
    expect(isOutroCrawlPending()).toBe(false);
  });

  it('never plays when the final collectible no longer exists', () => {
    seedContent([]);
    seedGamestate((state) => {
      state.collectibles[forgetterId] = { quantity: 1, foundAt: 1000 };
    });

    expect(isOutroCrawlPending()).toBe(false);
  });
});

describe('isVictoryPopupPending', () => {
  it('follows the outro crawl and stays until dismissed', () => {
    seedFelDefeated();
    expect(isVictoryPopupPending()).toBe(false);

    seedFelDefeated({ outroCrawlSeen: true });
    expect(isVictoryPopupPending()).toBe(true);

    seedFelDefeated({ outroCrawlSeen: true, victoryPopupSeen: true });
    expect(isVictoryPopupPending()).toBe(false);
  });

  it('opens straight after Fel falls when story crawls are skipped', () => {
    seedFelDefeated({}, true);
    expect(isOutroCrawlPending()).toBe(false);
    expect(isVictoryPopupPending()).toBe(true);

    seedFelDefeated({ victoryPopupSeen: true }, true);
    expect(isVictoryPopupPending()).toBe(false);
  });

  it('waits for Fel even when story crawls are skipped', () => {
    seedContent([
      ensureCollectible({ id: forgetterId, name: 'Memory of the Forgetter' }),
    ]);
    seedGamestate((state) => (state.globalEffectSums.skipStoryCrawls = true));

    expect(isVictoryPopupPending()).toBe(false);
  });
});

describe('isStoryScreenPending', () => {
  it('covers the title crawl, outro crawl and victory popup', () => {
    seedGamestate((state) => (state.meta.titleCrawlPending = true));
    expect(isStoryScreenPending()).toBe(true);

    seedFelDefeated();
    expect(isStoryScreenPending()).toBe(true);

    seedFelDefeated({ outroCrawlSeen: true });
    expect(isStoryScreenPending()).toBe(true);

    seedFelDefeated({ outroCrawlSeen: true, victoryPopupSeen: true });
    expect(isStoryScreenPending()).toBe(false);
  });

  it('ignores a queued title crawl while story crawls are skipped', () => {
    seedGamestate((state) => {
      state.meta.titleCrawlPending = true;
      state.globalEffectSums.skipStoryCrawls = true;
    });
    expect(isStoryScreenPending()).toBe(false);
  });

  it('holds for good once the run is lost', () => {
    seedGamestate((state) => (state.meta.runLost = true));
    expect(isStoryScreenPending()).toBe(true);
  });
});
