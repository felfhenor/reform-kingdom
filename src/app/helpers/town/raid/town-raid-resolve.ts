import { grantResolvedDrops } from '@helpers/combat/combat-rewards';
import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { rollDroppedRewards } from '@helpers/item/loot';
import { updateGamestate } from '@helpers/state-game';
import {
  townReputationGain,
  townReputationLose,
} from '@helpers/town/reputation/town-reputation';
import type { Combat, TownContent, TownId } from '@interfaces';

const RAID_WIN_REPUTATION_AMOUNT = 100;
const RAID_LOSS_REPUTATION_AMOUNT = 50;
export const RAID_LOSS_CRAFT_DEBUFF_TICKS = 3600;

// Grants the town's raid-only reward table through the same pipeline monster kills use.
export function raidResolveVictory(combat: Combat, townId: TownId): void {
  const town = getEntry<TownContent>(townId);
  if (!town) return;

  analyticsSendDesignEvent(`Town:Raid:Win:${analyticsSafeSegment(town.name)}`);

  const drops = rollDroppedRewards(town.defense.rewards, town.level);
  grantResolvedDrops(combat, drops);

  townReputationGain(townId, RAID_WIN_REPUTATION_AMOUNT, 'RaidDefense');

  updateGamestate((state) => {
    const target = state.world.towns[townId];
    if (target) target.lastRaidResolvedAtTick = timerTicksElapsed();
    return state;
  });
}

// Combat-object-agnostic (shared with the no-Combat auto-expire path) - callers log their own message.
export function raidResolveDefeat(townId: TownId): void {
  const town = getEntry<TownContent>(townId);
  if (!town) return;

  analyticsSendDesignEvent(`Town:Raid:Loss:${analyticsSafeSegment(town.name)}`);

  townReputationLose(townId, RAID_LOSS_REPUTATION_AMOUNT, 'RaidDefense');

  const now = timerTicksElapsed();
  updateGamestate((state) => {
    const target = state.world.towns[townId];
    if (target) {
      target.lastRaidResolvedAtTick = now;
      target.craftSpeedDebuffExpiresAtTick = now + RAID_LOSS_CRAFT_DEBUFF_TICKS;
      target.raidTelegraphedAtTick = undefined;
      target.raidEngageWindowExpiresAtTick = undefined;
      target.raidTelegraphedAssaulterIds = undefined;
    }
    return state;
  });
}
