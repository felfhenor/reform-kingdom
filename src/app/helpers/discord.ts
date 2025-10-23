import type { DiscordPresenceOpts } from '@interfaces';

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

export function discordUpdateStatus() {
  if (!isInElectron()) return;

  discordSetStatus({
    state: 'In game',
    details: `Winning the game, slowly...`,
  });
}
