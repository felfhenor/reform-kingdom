import { caravanBrandName, caravanState } from '@helpers/caravan';
import { currentCombat } from '@helpers/combat';
import { getEntry } from '@helpers/content';
import { partyGet } from '@helpers/party';
import { gamestate } from '@helpers/state-game';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import { worldNodeCaravan } from '@helpers/world-nodes';
import type {
  CaravanTraderContent,
  DiscordPresenceOpts,
  JobContent,
  WorldNodeEntry,
} from '@interfaces';

export function isInElectron() {
  return navigator.userAgent.toLowerCase().includes(' electron/');
}

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
  const combat = currentCombat();
  return combat ? `Exploring ${combat.locationName}` : undefined;
}

function discordTravelState(): string | undefined {
  const travel = gamestate().world.travel;
  if (travel.status !== 'Traveling' || !travel.destinationNodeName) {
    return undefined;
  }

  return `Traveling to ${travel.destinationNodeName}`;
}

function discordGatherState(): string | undefined {
  const gathering = gamestate().world.gathering;
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

function discordIdleState(): string {
  const entry = worldNodeAtCurrentLocation();
  if (!entry) return 'Traveling';

  const traderName = discordCaravanTraderName(entry);
  if (traderName) return `Trading with ${traderName}`;

  return `Resting at ${discordLocationDisplayName(entry)}`;
}

function discordActivityState(): string {
  return (
    discordCombatState() ??
    discordTravelState() ??
    discordGatherState() ??
    discordIdleState()
  );
}

function discordPartyDetails(): string {
  return partyGet()
    .map((character) => {
      const job = getEntry<JobContent>(character.jobId);
      return `${job?.name ?? 'Adventurer'} Lv${character.level}`;
    })
    .join(', ');
}

export function discordUpdateStatus() {
  if (!isInElectron()) return;

  discordSetMainStatus(discordPartyDetails());
  discordSetStatus({ state: discordActivityState() });
}
