import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/town/reputation/town-reputation-buff');
vi.mock('@helpers/town/town-commission-generate');

import { ensureTown } from '@helpers/content/ensure-town';
import { worldTownsState } from '@helpers/state-game';
import { TOWN_REPUTATION_THRESHOLDS } from '@helpers/town/reputation/town-reputation';
import { townReputationBuffRefresh } from '@helpers/town/reputation/town-reputation-buff';
import { townReputationGainAndRefresh } from '@helpers/town/reputation/town-reputation-grant';
import { townCommissionRefreshTierScaledSlots } from '@helpers/town/town-commission-generate';
import type { TownId } from '@interfaces';
import { captureAnalyticsEvents } from '@/testing/analytics';
import { buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const town = ensureTown({ id: 'larsia' as TownId, name: 'Larsia' });
const nextTier = TOWN_REPUTATION_THRESHOLDS[1];

beforeEach(() => {
  vi.clearAllMocks();
  seedContent([town]);
  seedGamestate((state) => {
    state.world.currentLocation = { mapName: 'LarsianDesert', x: 1, y: 1 };
    state.world.towns[town.id] = buildTownNodeState({ reputation: 0 });
  });
});

describe('townReputationGainAndRefresh', () => {
  it('refreshes the local buff and tier-scaled commissions on reaching a new tier', async () => {
    const events = captureAnalyticsEvents();

    await townReputationGainAndRefresh(town.id, nextTier, 'RaidBuyoff');

    expect(worldTownsState()[town.id].reputation).toBe(nextTier);
    expect(townReputationBuffRefresh).toHaveBeenCalledWith('LarsianDesert');
    expect(townCommissionRefreshTierScaledSlots).toHaveBeenCalledWith(town.id);
    expect(events).toContain('Town:Reputation:RaidBuyoff');
  });

  it('skips the refresh for a gain within the same tier', async () => {
    const events = captureAnalyticsEvents();

    await townReputationGainAndRefresh(town.id, nextTier - 1, 'Commission');

    expect(worldTownsState()[town.id].reputation).toBe(nextTier - 1);
    expect(townReputationBuffRefresh).not.toHaveBeenCalled();
    expect(townCommissionRefreshTierScaledSlots).not.toHaveBeenCalled();
    expect(events).toContain('Town:Reputation:Commission');
  });
});
