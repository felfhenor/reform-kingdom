import {
  adventureLogMessageHtml,
  combatLogHealthColor,
  ICON_TOKEN_PATTERN,
} from '@helpers/combat/combat-log';
import {
  ADVENTURE_LOG_OVERLAY_LIFETIME_TICKS,
  ADVENTURE_LOG_OVERLAY_MAX_LINES,
} from '@helpers/config';
import type {
  AdventureLogEntryKind,
  AtlasedImage,
  CombatLog,
} from '@interfaces';

const COMBATANT_TOKEN_PATTERN = /@@([^@]+)@@/g;

export type AdventureLogMessagePart =
  | { kind: 'text'; html: string }
  | { kind: 'icon'; sprite: string; spritesheet: AtlasedImage };

// Swaps each `@@id@@` token for that combatant's HP-colored name.
export function adventureLogEntryHtml(entry: CombatLog): string {
  if (!entry.combatants || entry.combatants.length === 0) {
    return adventureLogMessageHtml(entry.message);
  }

  const combatantsById = new Map(entry.combatants.map((c) => [c.id, c]));
  const coloredMessage = entry.message.replace(
    COMBATANT_TOKEN_PATTERN,
    (token, id: string) => {
      const combatant = combatantsById.get(id);
      if (!combatant) return token;

      const color = combatLogHealthColor(combatant.hp, combatant.maxHp);
      return `<span class="${color}">${combatant.name}</span>`;
    },
  );

  return adventureLogMessageHtml(coloredMessage);
}

// Splits the rendered message around every icon token (the reward icon and/or a per-combatant portrait) so each can render as a live component between text fragments.
export function adventureLogMessageParts(
  entry: CombatLog,
): AdventureLogMessagePart[] {
  const html = adventureLogEntryHtml(entry);
  const combatantsById = new Map(
    (entry.combatants ?? []).map((c) => [c.id, c]),
  );

  const parts: AdventureLogMessagePart[] = [];
  let lastIndex = 0;

  for (const match of html.matchAll(ICON_TOKEN_PATTERN)) {
    const [token, combatantId] = match;
    const index = match.index ?? 0;

    const icon = combatantId
      ? combatantsById.get(combatantId)
      : entry.itemSprite && entry.itemSpritesheet
        ? { sprite: entry.itemSprite, spritesheet: entry.itemSpritesheet }
        : undefined;

    if (!icon?.sprite) continue;

    const text = html.slice(lastIndex, index);
    if (text) parts.push({ kind: 'text', html: text });

    parts.push({
      kind: 'icon',
      sprite: icon.sprite,
      spritesheet: icon.spritesheet,
    });
    lastIndex = index + token.length;
  }

  const tail = html.slice(lastIndex);
  if (tail || parts.length === 0) parts.push({ kind: 'text', html: tail });

  return parts;
}

export function adventureLogTimestampTooltip(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => value.toString().padStart(2, '0');

  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// Expects the log newest-first (as stored); returns oldest-first so new lines append at the bottom.
export function adventureLogOverlayEntries(
  entries: CombatLog[],
  currentTick: number,
  kinds: Record<AdventureLogEntryKind, boolean>,
): CombatLog[] {
  const visible: CombatLog[] = [];

  for (const entry of entries) {
    if (entry.tick === undefined) break;

    // Negative age means the entry predates a New Game / lower-tick import, so everything past it is stale too.
    const age = currentTick - entry.tick;
    if (age < 0 || age >= ADVENTURE_LOG_OVERLAY_LIFETIME_TICKS) break;
    if (!kinds[entry.kind] || entry.message.trim() === '') continue;

    visible.push(entry);
    if (visible.length >= ADVENTURE_LOG_OVERLAY_MAX_LINES) break;
  }

  return visible.reverse();
}
