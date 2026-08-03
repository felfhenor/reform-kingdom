import { rngUuid } from '@helpers/rng';
import { localStorageSignal } from '@helpers/signal';
import type { Combat, CombatLog, Combatant } from '@interfaces';
import { parseInline } from 'marked';
import mustache from 'mustache';

export const combatLog = localStorageSignal<CombatLog[]>('combatLog', []);

let pendingCombatLogMessages: CombatLog[] = [];

export function beginCombatLogCommits() {
  pendingCombatLogMessages = [];
}

export function endCombatLogCommits() {
  combatLog.update((logs) =>
    [...pendingCombatLogMessages, ...logs].slice(0, 500),
  );

  pendingCombatLogMessages = [];
}

export function combatFormatMessage(template: string, props: unknown): string {
  return mustache.render(template, props);
}

export function combatMessageLog(
  combat: Combat,
  message: string,
  actor?: Combatant,
): void {
  const newLog: CombatLog = {
    kind: 'Combat',
    combatId: combat.id,
    messageId: rngUuid(),
    timestamp: Date.now(),
    locationName: combat.locationName,
    message,
    spritesheet: actor?.isEnemy ? 'guardian' : 'hero',
    sprite: actor?.sprite,
    hp: actor?.hp,
    maxHp: actor?.totalStats.Health,
  };

  pendingCombatLogMessages.unshift(newLog);
}

export function travelMessageLog(locationName: string, message: string): void {
  const newLog: CombatLog = {
    kind: 'Travel',
    messageId: rngUuid(),
    timestamp: Date.now(),
    locationName,
    message,
  };

  combatLog.update((logs) => [newLog, ...logs].slice(0, 500));
}

export function miscellaneousMessageLog(message: string): void {
  const newLog: CombatLog = {
    kind: 'Miscellaneous',
    messageId: rngUuid(),
    timestamp: Date.now(),
    locationName: 'Miscellaneous',
    message,
  };

  combatLog.update((logs) => [newLog, ...logs].slice(0, 500));
}

export function combatLogReset(): void {
  combatLog.set([]);
  pendingCombatLogMessages = [];
}

export function combatLogHealthColor(
  health: number,
  totalHealth: number,
): string {
  const healthPercentage = Math.round((100 * health) / totalHealth);

  if (healthPercentage >= 75) {
    return 'text-green-400';
  } else if (healthPercentage > 25) {
    return 'text-yellow-400';
  }

  return 'text-rose-400';
}

// Combat/travel messages use markdown-style emphasis (e.g. "**Jala** attacks
// ..."), rendered inline (no wrapping <p>) since each entry is a single line.
export function adventureLogMessageHtml(message: string): string {
  return parseInline(message, { async: false });
}

export function adventureLogTimestampTooltip(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => value.toString().padStart(2, '0');

  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
