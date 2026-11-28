import { i18nNodes, tPlural, t } from '@helpers/i18n/i18n';
import { combatantDisplayName } from '@helpers/combat/combat-create';
import { contentName, contentNameById } from '@helpers/i18n/i18n-content';
import { regionForMap } from '@helpers/lore/region-intro';
import { signal } from '@angular/core';
import {
  COMBAT_LOG_MAX_ENTRIES,
  COMBAT_LOG_PERSIST_DELAY_MS,
} from '@helpers/config';
import { recipeStylizedName } from '@helpers/crafting/recipes';
import { localStorageSignal } from '@helpers/engine/signal';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { rngUuid } from '@helpers/rng';
import type {
  AdventureLogEntryKind,
  AtlasedImage,
  CollectibleContent,
  Combat,
  Combatant,
  CombatId,
  CombatLog,
  CombatLogIcon,
  CombatLogMarker,
  DropRarity,
  EquipmentContent,
  ItemContent,
  RecipeContent,
} from '@interfaces';
import { startCase } from 'es-toolkit';
import { parseInline } from 'marked';
import mustache from 'mustache';

export const combatLog = localStorageSignal<CombatLog[]>(
  'combatLog',
  [],
  undefined,
  { persistDelayMs: COMBAT_LOG_PERSIST_DELAY_MS },
);

// Colosseum fights log here so the adventure log never sees them.
export const combatSimulationLog = signal<CombatLog[]>([]);

export function resetCombatLog() {
  combatLog.set([]);
}

// While a batch is open, all log entries defer here instead of writing straight to combatLog, preserving chronological order.
let pendingCombatLogMessages: CombatLog[] | null = null;

export function beginCombatLogCommits() {
  pendingCombatLogMessages = [];
}

export function endCombatLogCommits() {
  if (!pendingCombatLogMessages) return;

  const batch = pendingCombatLogMessages;
  pendingCombatLogMessages = null;

  combatLog.update((logs) =>
    [...batch, ...logs].slice(0, COMBAT_LOG_MAX_ENTRIES),
  );
}

function pushLogEntry(unstampedEntry: CombatLog): void {
  const entry: CombatLog = { ...unstampedEntry, tick: timerTicksElapsed() };

  if (pendingCombatLogMessages) {
    pendingCombatLogMessages.unshift(entry);
    return;
  }

  combatLog.update((logs) => [entry, ...logs].slice(0, COMBAT_LOG_MAX_ENTRIES));
}

export function combatFormatMessage(template: string, props: unknown): string {
  return mustache.render(template, props);
}

// A bolded name token - icon goes outside the `**` so splitting on it can't bisect the resulting <strong> tag.
const BOLD_NAME_TOKEN_PATTERN = /\*\*@@([^@]+)@@\*\*/g;

function hoistCombatantIconTokens(message: string): string {
  return message.replace(
    BOLD_NAME_TOKEN_PATTERN,
    (boldToken, id: string) => `@@icon-${id}@@${boldToken}`,
  );
}

export function combatMessageLog(
  combat: Combat,
  message: string,
  actor?: Combatant,
  icons?: CombatLogIcon | CombatLogIcon[],
  marker?: CombatLogMarker,
): void {
  if (combat.simulation?.quiet) return;

  const combatants = [
    ...(combat.heroes ?? []),
    ...(combat.helpers ?? []),
    ...(combat.guardians ?? []),
  ].map((combatant) => ({
    id: combatant.id,
    name: combatantDisplayName(combatant),
    hp: combatant.hp,
    maxHp: combatant.totalStats.Health,
    sprite: combatant.sprite ?? '',
    spritesheet: (combatant.monsterId ? 'monster' : 'job') as AtlasedImage,
  }));

  const entry: CombatLog = {
    kind: 'Combat',
    combatId: combat.id,
    messageId: rngUuid(),
    timestamp: Date.now(),
    locationName: combat.locationName,
    message: hoistCombatantIconTokens(message),
    spritesheet: actor?.isEnemy ? 'guardian' : 'hero',
    sprite: actor?.sprite,
    combatants,
    itemIcons: logIconList(icons),
    marker,
  };

  if (combat.simulation) {
    combatSimulationLog.update((logs) =>
      [entry, ...logs].slice(0, COMBAT_LOG_MAX_ENTRIES),
    );
    return;
  }

  pushLogEntry(entry);
}

// Wraps the status in invisible markers, so views with live HP/EP bars can strip it whatever language it was logged in.
export const COMBATANT_STATUS_MARK = '⁣';

export function combatantStatusText(combatant: Combatant): string {
  const shield = combatant.shield ?? 0;
  const whole = (value: number) => Math.floor(value).toLocaleString();
  const params = {
    hp: whole(combatant.hp),
    maxHp: whole(combatant.totalStats.Health),
    ep: whole(combatant.ep),
    maxEp: whole(combatant.totalStats.Energy),
    shield: shield.toLocaleString(),
  };
  const text = t(
    shield > 0 ? 'combat.statusShielded' : 'combat.status',
    params,
  );
  return `${COMBATANT_STATUS_MARK}${text}${COMBATANT_STATUS_MARK}`;
}

// Stands in for a combatant's name.
export function combatantMessageToken(combatant: Combatant): string {
  return `@@${combatant.id}@@`;
}

// Marks where a reward icon renders inline, next to the item text it labels - the UI layer splits the message on this token to slot in a live sprite component.
export const ITEM_ICON_TOKEN = '@@icon@@';

// Matches the bare item-icon token or a per-combatant one (`@@icon-<id>@@`), so the UI layer can find every icon anchor in one pass.
export const ICON_TOKEN_PATTERN = /@@icon(?:-([^@]+))?@@/g;

// Labels arrive as map ids, node names, content names or already-translated text.
function logLocationLabel(name: string): string {
  const region = regionForMap(name);
  if (region) return contentName(region);
  const translated = contentNameById(name) ?? i18nNodes()[name];
  if (translated) return translated;
  return /^[A-Za-z]+$/.test(name) ? startCase(name) : name;
}

export function categoryMessageLog(
  category: AdventureLogEntryKind,
  locationName: string,
  message: string,
  icons?: CombatLogIcon | CombatLogIcon[],
): void {
  pushLogEntry({
    kind: category,
    messageId: rngUuid(),
    timestamp: Date.now(),
    locationName: logLocationLabel(locationName),
    message,
    itemIcons: logIconList(icons),
  });
}

function logIconList(
  icons: CombatLogIcon | CombatLogIcon[] | undefined,
): CombatLogIcon[] | undefined {
  if (!icons) return undefined;
  return Array.isArray(icons) ? icons : [icons];
}

export function rarityNameHtml(name: string, rarity: DropRarity): string {
  return `<span class="text-${rarity} type-entity-name">${name}</span>`;
}

export function itemNameHtml(
  item: ItemContent,
  displayName = contentName(item),
): string {
  return rarityNameHtml(displayName, item.rarity);
}

// The noun stays as named; inflecting it is English-only, so the count carries the plural instead.
export function itemDropHtml(item: ItemContent, quantity: number): string {
  return tPlural('log.itemDrop', quantity, { item: itemNameHtml(item) });
}

export function equipmentNameHtml(equipment: EquipmentContent): string {
  return rarityNameHtml(contentName(equipment), equipment.rarity);
}

// Equipment drops are always a single piece, so there's no quantity/plural to handle here.
export function equipmentDropHtml(equipment: EquipmentContent): string {
  return equipmentNameHtml(equipment);
}

export function collectibleNameHtml(collectible: CollectibleContent): string {
  return rarityNameHtml(contentName(collectible), collectible.rarity);
}

// Collectible drops are always a single piece, same as equipment.
export function collectibleDropHtml(collectible: CollectibleContent): string {
  return collectibleNameHtml(collectible);
}

// Recipes have no rarity of their own (their icon borrows their result's),
// so the name isn't tinted, unlike the other reward types above.
export function recipeNameHtml(recipe: RecipeContent): string {
  return `<span class="type-entity-name">${recipeStylizedName(recipe)}</span>`;
}

// Recipe drops are always a single piece, same as equipment/collectibles.
export function recipeDropHtml(recipe: RecipeContent): string {
  return `${recipeNameHtml(recipe)}`;
}

// A combatId also surfaces the line in that fight's manual combat scene.
export function miscellaneousMessageLog(
  message: string,
  combatId?: CombatId,
): void {
  pushLogEntry({
    kind: 'Miscellaneous',
    combatId,
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
    return 'text-health-high';
  } else if (healthPercentage > 25) {
    return 'text-health-mid';
  }

  return 'text-health-low';
}

// Combat/travel messages use markdown-style emphasis (e.g. "**Jala** attacks
// ..."), rendered inline (no wrapping <p>) since each entry is a single line.
export function adventureLogMessageHtml(message: string): string {
  return parseInline(message.replaceAll(COMBATANT_STATUS_MARK, ''), {
    async: false,
  });
}
