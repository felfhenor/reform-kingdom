import { getEntriesByType } from '@helpers/content/content';
import {
  MOD_BACKGROUND_SHEET,
  MOD_SPRITE_SIZE,
} from '@helpers/mod/mod-sprites';
import type { ContentType, ModBundle, ModSprite } from '@interfaces';
import { NODE_BACKGROUNDS } from '@interfaces';

export function modsKnownBackgrounds(bundles: ModBundle[]): Set<string> {
  return new Set<string>([
    ...NODE_BACKGROUNDS,
    ...bundles.flatMap((bundle) =>
      bundle.sprites
        .filter((art) => art.sheet === MOD_BACKGROUND_SHEET)
        .map((art) => art.sprite),
    ),
  ]);
}

function modBackgroundErrors(bundle: ModBundle, known: Set<string>): string[] {
  return Object.entries(bundle.content).flatMap(([type, entries]) =>
    entries.flatMap((entry) => {
      const background = (entry as { background?: unknown }).background;
      if (typeof background !== 'string' || known.has(background)) return [];
      return [
        `${type} "${entry.name ?? entry.id}": background "${background}" doesn't exist.`,
      ];
    }),
  );
}

// Checks every entry drawn with this art, base ones too, since a strip that doesn't match `frames` animates into blank frames.
function modFramesErrors(art: ModSprite): string[] {
  const users = getEntriesByType<{ sprite?: string; frames?: number }>(
    art.sheet as ContentType,
  ).filter((entry) => entry.sprite === art.sprite);
  const frames = users.find(
    (entry) => typeof entry.frames === 'number',
  )?.frames;
  if (frames === undefined || art.width === frames * MOD_SPRITE_SIZE) {
    return [];
  }
  return [
    `sprites/${art.sheet}/${art.sprite}.png is ${art.width}px wide, but it's drawn with ${frames} frames, which needs ${frames * MOD_SPRITE_SIZE}px.`,
  ];
}

export function modArtErrors(
  bundle: ModBundle,
  knownBackgrounds: Set<string>,
): string[] {
  return [
    ...modBackgroundErrors(bundle, knownBackgrounds),
    ...bundle.sprites
      .filter((art) => art.sheet !== MOD_BACKGROUND_SHEET)
      .flatMap(modFramesErrors),
  ];
}
