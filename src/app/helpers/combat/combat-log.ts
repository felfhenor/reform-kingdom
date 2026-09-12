import { pluralize } from '@boringnode/pluralize';
import { localStorageSignal } from '@helpers/engine/signal';
import { rngUuid } from '@helpers/rng';
import type {
  AdventureLogEntryKind,
  AtlasedImage,
  CollectibleContent,
  Combat,
  CombatLog,
  Combatant,
  EquipmentContent,
  ItemContent,
  RecipeContent,
  RewardContentInfo,
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
  icon?: Pick<RewardContentInfo, 'sprite' | 'spritesheet'>,
): void {
  const combatants = [
    ...(combat.heroes ?? []),
    ...(combat.helpers ?? []),
    ...(combat.guardians ?? []),
  ].map((combatant) => ({
    id: combatant.id,
    name: combatant.name,
    hp: combatant.hp,
    maxHp: combatant.totalStats.Health,
    sprite: combatant.sprite ?? '',
    spritesheet: (combatant.monsterId ? 'monster' : 'job') as AtlasedImage,
  }));

  pushLogEntry({
    kind: 'Combat',
    combatId: combat.id,
    messageId: rngUuid(),
    timestamp: Date.now(),
    locationName: combat.locationName,
    message: hoistCombatantIconTokens(message),
    spritesheet: actor?.isEnemy ? 'guardian' : 'hero',
    sprite: actor?.sprite,
    combatants,
    itemSprite: icon?.sprite,
    itemSpritesheet: icon?.spritesheet,
  });
}

// Stands in for a combatant's name.
export function combatantMessageToken(combatant: Combatant): string {
  return `@@${combatant.id}@@`;
}

// Marks where a reward icon renders inline, next to the item text it labels - the UI layer splits the message on this token to slot in a live sprite component.
export const ITEM_ICON_TOKEN = '@@icon@@';

// Matches the bare item-icon token or a per-combatant one (`@@icon-<id>@@`), so the UI layer can find every icon anchor in one pass.
export const ICON_TOKEN_PATTERN = /@@icon(?:-([^@]+))?@@/g;

export function categoryMessageLog(
  category: AdventureLogEntryKind,
  locationName: string,
  message: string,
  icon?: Pick<RewardContentInfo, 'sprite' | 'spritesheet'>,
): void {
  pushLogEntry({
    kind: category,
    messageId: rngUuid(),
    timestamp: Date.now(),
    locationName,
    message,
    itemSprite: icon?.sprite,
    itemSpritesheet: icon?.spritesheet,
  });
}

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

  return `${quantity.toLocaleString()} ${itemNameHtml(item, displayName)}`;
}

export function equipmentNameHtml(equipment: EquipmentContent): string {
  return `<span class="text-${equipment.rarity} font-semibold">${equipment.name}</span>`;
}

// Equipment drops are always a single piece, so there's no quantity/plural to handle here.
export function equipmentDropHtml(equipment: EquipmentContent): string {
  return equipmentNameHtml(equipment);
}

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
