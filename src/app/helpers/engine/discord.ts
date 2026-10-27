import { caravanBrandName, caravanState } from '@helpers/caravan/caravan';
import { getEntry } from '@helpers/content/content';
import { isInElectron } from '@helpers/engine/electron';
import { activeTownNode, gamePlayView } from '@helpers/engine/ui';
import { isGlobalEffectActive } from '@helpers/hero/global-effects';
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
  CaravanTraderContent,
  DiscordPresenceOpts,
  GlobalEffectId,
  JobContent,
  WorldNodeEntry,
} from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

let discordMainStatus = '';
export function discordSetMainStatus(status: string) {
  discordMainStatus = status;
}

export function discordSetStatus(status: DiscordPresenceOpts) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).discordRPCStatus = {
    ...status,
    details: discordMainStatus || status.details,
  };
}

function discordCombatState(): string | undefined {
  const combat = worldCombatState();
  return combat ? `Exploring ${combat.locationName}` : undefined;
}

function discordTravelState(): string | undefined {
  const travel = worldTravelState();
  if (travel.status !== 'Traveling' || !travel.destinationNodeName) {
    return undefined;
  }

  return `Traveling to ${travel.destinationNodeName}`;
}

function discordGatherState(): string | undefined {
  const gathering = worldGatheringState();
  if (gathering.status !== 'Gathering' || !gathering.nodeName) {
    return undefined;
  }

  return `Gathering in ${gathering.nodeName}`;
}

function discordCaravanTraderName(entry: WorldNodeEntry): string | undefined {
  const caravan = worldNodeCaravan(entry);
  if (!caravan) return undefined;

  const traderId = caravanState(caravan.id)?.traderId;
  if (!traderId) return undefined;

  return getEntry<CaravanTraderContent>(traderId)?.name;
}

function discordLocationDisplayName(entry: WorldNodeEntry): string {
  return entry.nodeData.type === 'CaravanNode'
    ? caravanBrandName(entry.nodeName)
    : entry.nodeName;
}

function discordTownState(): string | undefined {
  if (gamePlayView() !== 'town') return undefined;

  const entry = activeTownNode();
  const town = entry ? worldNodeTown(entry) : undefined;
  return town ? `Visiting ${town.name}` : undefined;
}

function isPartyRecovering(): boolean {
  return (
    isGlobalEffectActive('Deaths Door' as GlobalEffectId) ||
    isGlobalEffectActive('Healing' as GlobalEffectId)
  );
}

function discordIdleState(): string {
  const entry = worldNodeAtCurrentLocation();
  if (!entry) return 'Traveling';

  const traderName = discordCaravanTraderName(entry);
  if (traderName) return `Trading with ${traderName}`;

  const locationName = discordLocationDisplayName(entry);
  return isPartyRecovering()
    ? `Recovering at ${locationName}`
    : `Resting at ${locationName}`;
}

function discordActivityState(): string {
  if (isTitleCrawlPending()) return 'Starting a grand adventure';

  const activity =
    discordCombatState() ??
    discordTravelState() ??
    discordGatherState() ??
    discordTownState() ??
    discordIdleState();

  return getOption('gameloopPaused') ? `Paused · ${activity}` : activity;
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

  const averageLevel = Math.round(sumBy(party, 'level') / party.length);

  return `${heroes} · Avg. Lv. ${averageLevel}`;
}

export function discordUpdateStatus() {
  if (!isInElectron()) return;

  discordSetMainStatus(discordPartyDetails());
  discordSetStatus({ state: discordActivityState() });
}
