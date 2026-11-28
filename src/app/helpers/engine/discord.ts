import { contentNameById } from '@helpers/i18n/i18n-content';
import { caravanBrandName, caravanState } from '@helpers/caravan/caravan';
import { getEntry } from '@helpers/content/content';
import { isDemoBuild } from '@helpers/demo/demo';
import { isInElectron } from '@helpers/engine/electron';
import {
  presenceActivityText,
  presencePausedText,
  steamRichPresence,
} from '@helpers/engine/presence';
import { activeTownNode, gamePlayView } from '@helpers/engine/ui';
import { isGlobalEffectActive } from '@helpers/hero/global-effects';
import { isStoryScreenPending } from '@helpers/lore/outro';
import { isTitleCrawlPending } from '@helpers/lore/title-crawl';
import {
  worldGatheringState,
  worldTravelState,
  worldPartyState,
  worldCombatState,
} from '@helpers/state-game';
import { getOption } from '@helpers/state-options';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import {
  worldNodeCaravan,
  worldNodeTown,
} from '@helpers/world-node/world-nodes';
import type {
  DiscordPresenceOpts,
  GlobalEffectId,
  JobContent,
  PresenceActivity,
  PresenceStatus,
  WorldNodeEntry,
} from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

export function discordSetStatus(status: PresenceStatus) {
  const activityText = presenceActivityText(status.activity);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).discordRPCStatus = {
    state: status.paused ? presencePausedText(activityText) : activityText,
    details: status.partyDetails || undefined,
    largeImageText: isDemoBuild() ? 're:Form Kingdom Demo' : undefined,
    steam: steamRichPresence(status.activity, status.partyLevel, status.paused),
  } satisfies DiscordPresenceOpts;
}

function discordCombatState(): PresenceActivity | undefined {
  const combat = worldCombatState();
  return combat ? { kind: 'Exploring', name: combat.locationName } : undefined;
}

function discordTravelState(): PresenceActivity | undefined {
  const travel = worldTravelState();
  if (travel.status !== 'Traveling' || !travel.destinationNodeName) {
    return undefined;
  }

  return { kind: 'TravelingTo', name: travel.destinationNodeName };
}

function discordGatherState(): PresenceActivity | undefined {
  const gathering = worldGatheringState();
  if (gathering.status !== 'Gathering' || !gathering.nodeName) {
    return undefined;
  }

  return { kind: 'Gathering', name: gathering.nodeName };
}

function discordCaravanTraderName(entry: WorldNodeEntry): string | undefined {
  const caravan = worldNodeCaravan(entry);
  if (!caravan) return undefined;

  const traderId = caravanState(caravan.id)?.traderId;
  if (!traderId) return undefined;

  return contentNameById(traderId);
}

function discordLocationDisplayName(entry: WorldNodeEntry): string {
  return entry.nodeData.type === 'CaravanNode'
    ? caravanBrandName(entry.nodeName)
    : entry.nodeName;
}

function discordTownState(): PresenceActivity | undefined {
  if (gamePlayView() !== 'town') return undefined;

  const entry = activeTownNode();
  const town = entry ? worldNodeTown(entry) : undefined;
  return town ? { kind: 'Visiting', name: town.name } : undefined;
}

function isPartyRecovering(): boolean {
  return (
    isGlobalEffectActive('Deaths Door' as GlobalEffectId) ||
    isGlobalEffectActive('Healing' as GlobalEffectId)
  );
}

function discordIdleState(): PresenceActivity {
  const entry = worldNodeAtCurrentLocation();
  if (!entry) return { kind: 'Traveling' };

  const traderName = discordCaravanTraderName(entry);
  if (traderName) return { kind: 'Trading', name: traderName };

  return {
    kind: isPartyRecovering() ? 'Recovering' : 'Resting',
    name: discordLocationDisplayName(entry),
  };
}

function discordWorldActivity(): PresenceActivity {
  return (
    discordCombatState() ??
    discordTravelState() ??
    discordGatherState() ??
    discordTownState() ??
    discordIdleState()
  );
}

function discordPartyDetails(): string {
  const party = worldPartyState();
  if (party.length === 0) return '';

  const heroes = party
    .map((character) => {
      const job = getEntry<JobContent>(character.jobId);
      return `${job?.name ?? 'Adventurer'} Lv${character.level}`;
    })
    .join(', ');

  return `${heroes} · Avg. Lv. ${discordPartyAverageLevel()}`;
}

function discordPartyAverageLevel(): number | undefined {
  const party = worldPartyState();
  if (party.length === 0) return undefined;

  return Math.round(sumBy(party, 'level') / party.length);
}

function discordStoryActivity(): PresenceActivity | undefined {
  if (isTitleCrawlPending()) return { kind: 'NewAdventure' };
  if (isStoryScreenPending()) return { kind: 'FinishedAdventure' };
  return undefined;
}

export function discordUpdateStatus() {
  if (!isInElectron()) return;

  const storyActivity = discordStoryActivity();
  discordSetStatus({
    activity: storyActivity ?? discordWorldActivity(),
    partyDetails: discordPartyDetails(),
    partyLevel: discordPartyAverageLevel(),
    paused: !storyActivity && !!getOption('gameloopPaused'),
  });
}
