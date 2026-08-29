import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/combat/combat-log', () => ({
  collectibleDropHtml: vi.fn(() => 'collectible-html'),
  combatMessageLog: vi.fn(),
  equipmentDropHtml: vi.fn(() => 'equipment-html'),
  itemDropHtml: vi.fn(() => 'item-html'),
  recipeDropHtml: vi.fn(() => 'recipe-html'),
}));

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/crafting/recipes', () => ({
  recipeDiscover: vi.fn(),
}));

vi.mock('@helpers/engine/gather-vfx', () => ({
  gatherVfxEmit: vi.fn(),
}));

vi.mock('@helpers/item/collectibles', () => ({
  collectiblesAdd: vi.fn(),
}));

vi.mock('@helpers/item/materials', () => ({
  addMaterial: vi.fn(),
}));

vi.mock('@helpers/kingdom/armory', () => ({
  armoryAdd: vi.fn(),
}));

vi.mock('@helpers/worker/worker-discovery', () => ({
  isWorkerRescued: vi.fn(),
  workerRescue: vi.fn(),
}));

vi.mock('@helpers/world-node/world-node-rewards', () => ({
  rewardContentInfo: vi.fn(),
}));

import { combatMessageLog } from '@helpers/combat/combat-log';
import { grantResolvedDrops } from '@helpers/combat/combat-rewards';
import { getEntry } from '@helpers/content';
import { gatherVfxEmit } from '@helpers/engine/gather-vfx';
import { addMaterial } from '@helpers/item/materials';
import { isWorkerRescued, workerRescue } from '@helpers/worker/worker-discovery';
import { rewardContentInfo } from '@helpers/world-node/world-node-rewards';
import type {
  Combat,
  ItemId,
  ResolvedDrop,
  WorkerContent,
  WorkerId,
} from '@interfaces';

const WORKER_ID = 'weaver-nell' as WorkerId;
const COMBAT = { locationName: 'Wergen Woods' } as Combat;

const workerContent: WorkerContent = {
  id: WORKER_ID,
  name: 'Weaver Nell',
  __type: 'worker',
  description: 'test',
  sprite: '0000',
  frames: 4,
  baseStats: { capacity: 6, gatherSpeed: 1, stamina: 30 },
  statsPerLevel: { capacity: 0.5, gatherSpeed: 0.1, stamina: 2 },
};

describe('grantResolvedDrops - Worker rewards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rescues and logs a message the first time a worker drop resolves', () => {
    vi.mocked(isWorkerRescued).mockReturnValue(false);
    vi.mocked(getEntry).mockReturnValue(workerContent);
    vi.mocked(rewardContentInfo).mockReturnValue({
      name: 'Weaver Nell',
      sprite: '0000',
      spritesheet: 'worker',
    });

    const drops: ResolvedDrop[] = [{ kind: 'Worker', workerId: WORKER_ID }];
    grantResolvedDrops(COMBAT, drops);

    expect(workerRescue).toHaveBeenCalledWith(WORKER_ID);
    expect(combatMessageLog).toHaveBeenCalledWith(
      COMBAT,
      'The party rescued Weaver Nell!',
    );
    expect(gatherVfxEmit).toHaveBeenCalledWith({
      nodeName: 'Wergen Woods',
      quantity: 1,
      name: 'Weaver Nell',
      sprite: '0000',
      spritesheet: 'worker',
    });
  });

  it('is a silent no-op when the worker was already rescued', () => {
    vi.mocked(isWorkerRescued).mockReturnValue(true);

    const drops: ResolvedDrop[] = [{ kind: 'Worker', workerId: WORKER_ID }];
    grantResolvedDrops(COMBAT, drops);

    expect(workerRescue).not.toHaveBeenCalled();
    expect(combatMessageLog).not.toHaveBeenCalled();
    expect(gatherVfxEmit).not.toHaveBeenCalled();
  });
});

describe('grantResolvedDrops - VFX per drop kind', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEntry).mockReturnValue({ name: 'Reward' } as never);
  });

  it('emits a gather VFX event for an Equipment drop', () => {
    vi.mocked(rewardContentInfo).mockReturnValue({
      name: 'Iron Sword',
      sprite: 'iron-sword',
      spritesheet: 'equipment',
    });

    const drops: ResolvedDrop[] = [
      { kind: 'Equipment', equipmentId: 'iron-sword' as never },
    ];
    grantResolvedDrops(COMBAT, drops);

    expect(gatherVfxEmit).toHaveBeenCalledWith({
      nodeName: 'Wergen Woods',
      quantity: 1,
      name: 'Iron Sword',
      sprite: 'iron-sword',
      spritesheet: 'equipment',
    });
  });

  it('emits a gather VFX event for a Collectible drop', () => {
    vi.mocked(rewardContentInfo).mockReturnValue({
      name: 'Old Coin',
      sprite: 'old-coin',
      spritesheet: 'collectible',
    });

    const drops: ResolvedDrop[] = [
      { kind: 'Collectible', collectibleId: 'old-coin' as never },
    ];
    grantResolvedDrops(COMBAT, drops);

    expect(gatherVfxEmit).toHaveBeenCalledWith({
      nodeName: 'Wergen Woods',
      quantity: 1,
      name: 'Old Coin',
      sprite: 'old-coin',
      spritesheet: 'collectible',
    });
  });

  it('emits a gather VFX event for a Recipe drop', () => {
    vi.mocked(rewardContentInfo).mockReturnValue({
      name: 'Recipe: Iron Sword',
      sprite: 'iron-sword',
      spritesheet: 'equipment',
    });

    const drops: ResolvedDrop[] = [
      { kind: 'Recipe', recipeId: 'recipe-iron-sword' as never },
    ];
    grantResolvedDrops(COMBAT, drops);

    expect(gatherVfxEmit).toHaveBeenCalledWith({
      nodeName: 'Wergen Woods',
      quantity: 1,
      name: 'Recipe: Iron Sword',
      sprite: 'iron-sword',
      spritesheet: 'equipment',
    });
  });

  it('does not emit when rewardContentInfo cannot resolve the drop', () => {
    vi.mocked(rewardContentInfo).mockReturnValue(undefined);

    const drops: ResolvedDrop[] = [
      { kind: 'Equipment', equipmentId: 'unknown' as never },
    ];
    grantResolvedDrops(COMBAT, drops);

    expect(gatherVfxEmit).not.toHaveBeenCalled();
  });
});

describe('grantResolvedDrops - Item rewards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aggregates quantities for the same item and grants once', () => {
    vi.mocked(getEntry).mockReturnValue({ name: 'Copper Ore' } as never);
    vi.mocked(rewardContentInfo).mockReturnValue({
      name: 'Copper Ore',
      sprite: 'copper-ore',
      spritesheet: 'item',
    });

    const itemId = 'copper-ore' as ItemId;
    const drops: ResolvedDrop[] = [
      { kind: 'Item', itemId, quantity: 2 },
      { kind: 'Item', itemId, quantity: 3 },
    ];
    grantResolvedDrops(COMBAT, drops);

    expect(addMaterial).toHaveBeenCalledTimes(1);
    expect(addMaterial).toHaveBeenCalledWith(itemId, 5);
    expect(gatherVfxEmit).toHaveBeenCalledWith({
      nodeName: 'Wergen Woods',
      quantity: 5,
      name: 'Copper Ore',
      sprite: 'copper-ore',
      spritesheet: 'item',
    });
  });
});
