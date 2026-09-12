import {
  adventureLogMessageHtml,
  combatLogHealthColor,
  ITEM_ICON_TOKEN,
} from '@helpers/combat/combat-log';
import type { CombatLog } from '@interfaces';

const COMBATANT_TOKEN_PATTERN = /@@([^@]+)@@/g;

export type AdventureLogMessageParts = {
  before: string;
  after: string;
};

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

// Splits the rendered message around the reward-icon token so the icon can render as a live component between the two text fragments.
export function adventureLogMessageParts(
  entry: CombatLog,
): AdventureLogMessageParts {
  const html = adventureLogEntryHtml(entry);
  const tokenIndex = html.indexOf(ITEM_ICON_TOKEN);
  if (tokenIndex === -1) return { before: html, after: '' };

  return {
    before: html.slice(0, tokenIndex),
    after: html.slice(tokenIndex + ITEM_ICON_TOKEN.length),
  };
}

export function adventureLogTimestampTooltip(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => value.toString().padStart(2, '0');

  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
