import { pluralize } from '@boringnode/pluralize';
import { rngUuid } from '@helpers/rng';
import { localStorageSignal } from '@helpers/signal';
import type {
  Combat,
  CombatLog,
  Combatant,
  EquipmentContent,
  ItemContent,
} from '@interfaces';
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

export function gatherMessageLog(locationName: string, message: string): void {
  const newLog: CombatLog = {
    kind: 'Gather',
    messageId: rngUuid(),
    timestamp: Date.now(),
    locationName,
    message,
  };

  combatLog.update((logs) => [newLog, ...logs].slice(0, 500));
}

// Colors an item's name by its rarity for adventure log messages (e.g. combat
// and gather drop announcements) - `adventureLogMessageHtml` renders the log
// message as markdown-inline, which passes raw HTML like this through as-is.
export function itemNameHtml(item: ItemContent, displayName = item.name): string {
  return `<span class="text-${item.rarity} font-semibold">${displayName}</span>`;
}

// "1 wergen stick" vs "3 wergen sticks" - only pluralize when the quantity
// actually calls for it, since item names are authored in singular form.
export function itemDropHtml(item: ItemContent, quantity: number): string {
  const lowerName = item.name.toLowerCase();
  const displayName = quantity === 1 ? lowerName : pluralize(lowerName);

  return `${quantity} ${itemNameHtml(item, displayName)}`;
}

// Colors an equipment item's name by its rarity, mirroring `itemNameHtml`.
export function equipmentNameHtml(equipment: EquipmentContent): string {
  return `<span class="text-${equipment.rarity} font-semibold">${equipment.name}</span>`;
}

// Equipment drops are always a single piece, so there's no quantity/plural
// to handle here - unlike `itemDropHtml`.
export function equipmentDropHtml(equipment: EquipmentContent): string {
  return equipmentNameHtml(equipment);
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
