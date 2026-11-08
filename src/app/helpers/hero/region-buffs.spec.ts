import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/town/reputation/town-reputation-buff');
vi.mock('@helpers/world-node/world-node-outpost-buff');

import { regionBuffsSync } from '@helpers/hero/region-buffs';
import { townReputationBuffRefresh } from '@helpers/town/reputation/town-reputation-buff';
import { outpostBuffRefresh } from '@helpers/world-node/world-node-outpost-buff';

beforeEach(() => vi.clearAllMocks());

describe('regionBuffsSync', () => {
  it('refreshes town and outpost buffs for the new map', () => {
    regionBuffsSync('Carrina', 'LarsianDesert');

    expect(townReputationBuffRefresh).toHaveBeenCalledWith('LarsianDesert');
    expect(outpostBuffRefresh).toHaveBeenCalledWith('LarsianDesert');
  });

  it('does nothing without a map change', () => {
    regionBuffsSync('Carrina', 'Carrina');

    expect(townReputationBuffRefresh).not.toHaveBeenCalled();
    expect(outpostBuffRefresh).not.toHaveBeenCalled();
  });
});
