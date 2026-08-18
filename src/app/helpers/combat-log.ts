import { pluralize } from '@boringnode/pluralize';
import { rngUuid } from '@helpers/rng';
import { localStorageSignal } from '@helpers/signal';
import type {
  CollectibleContent,
  Combat,
  CombatLog,
  Combatant,
  EquipmentContent,
  ItemContent,
  RecipeContent,
} from '@interfaces';
import { parseInline } from 'marked';
import mustache from 'mustache';

export const combatLog = localStorageSignal<CombatLog[]>('combatLog', []);

// While a batch is open, all log entries defer here instead of writing straight to combatLog, preserving chronological order.
let pendingCombatLogMessages: CombatLog[] | null = null;

export function beginCombatLogCommits() {
  pendingCombatLogMessages = [];
}

export function endCombatLogCommits() {
  if (!pendingCombatLogMessages) return;

  const batch = pendingCombatLogMessages;
  pendingCombatLogMessages = null;

  combatLog.update((logs) => [...batch, ...logs].slice(0, 500));
}

function pushLogEntry(entry: CombatLog): void {
  if (pendingCombatLogMessages) {
    pendingCombatLogMessages.unshift(entry);
    return;
  }

  combatLog.update((logs) => [entry, ...logs].slice(0, 500));
}

export function combatFormatMessage(template: string, props: unknown): string {
  return mustache.render(template, props);
}

export function combatMessageLog(
  combat: Combat,
  message: string,
  actor?: Combatant,
  colorOverride?: string,
): void {
  pushLogEntry({
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
    colorOverride,
  });
}

export function travelMessageLog(locationName: string, message: string): void {
  pushLogEntry({
    kind: 'Travel',
    messageId: rngUuid(),
    timestamp: Date.now(),
    locationName,
    message,
  });
}

export function gatherMessageLog(locationName: string, message: string): void {
  pushLogEntry({
    kind: 'Gather',
    messageId: rngUuid(),
    timestamp: Date.now(),
    locationName,
    message,
  });
}

export function craftMessageLog(locationName: string, message: string): void {
  pushLogEntry({
    kind: 'Craft',
    messageId: rngUuid(),
    timestamp: Date.now(),
    locationName,
    message,
  });
}

// Raw HTML passes through since adventureLogMessageHtml renders markdown-inline.
export function itemNameHtml(
  item: ItemContent,
  displayName = item.name,
): string {
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

// Colors a collectible's name by its rarity, mirroring `equipmentNameHtml`.
export function collectibleNameHtml(collectible: CollectibleContent): string {
  return `<span class="text-${collectible.rarity} font-semibold">${collectible.name}</span>`;
}

// Collectible drops are always a single piece, same as equipment.
export function collectibleDropHtml(collectible: CollectibleContent): string {
  return collectibleNameHtml(collectible);
}

// Recipes have no rarity of their own (their icon borrows their result's),
// so the name isn't tinted, unlike the other reward types above.
export function recipeNameHtml(recipe: RecipeContent): string {
  return `<span class="font-semibold">Recipe - ${recipe.name}</span>`;
}

// Recipe drops are always a single piece, same as equipment/collectibles.
export function recipeDropHtml(recipe: RecipeContent): string {
  return `${recipeNameHtml(recipe)}`;
}

export function miscellaneousMessageLog(message: string): void {
  pushLogEntry({
    kind: 'Miscellaneous',
    messageId: rngUuid(),
    timestamp: Date.now(),
    locationName: 'Miscellaneous',
    message,
  });
}

export function combatLogReset(): void {
  combatLog.set([]);
  pendingCombatLogMessages = null;
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
