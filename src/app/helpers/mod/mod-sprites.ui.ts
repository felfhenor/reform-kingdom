import {
  MOD_SPRITE_SIZE,
  modSpriteKey,
  modSprites,
} from '@helpers/mod/mod-sprites';
import type { ArtAtlases, SpriteFrame } from '@interfaces';

// Mod sprites win over the baked atlas, so a mod can both add and replace art.
export function spriteFrameFor(
  atlases: ArtAtlases,
  sheet: string,
  sprite: string,
  sheetUrl: (sheet: string) => string,
): SpriteFrame | undefined {
  const modSprite = modSprites().get(modSpriteKey(sheet, sprite));
  if (modSprite) {
    return {
      url: modSprite.url,
      x: 0,
      y: 0,
      width: MOD_SPRITE_SIZE,
      height: MOD_SPRITE_SIZE,
    };
  }

  const frame = atlases[sheet]?.[`gameassets/${sheet}/${sprite}.png`];
  if (!frame) return undefined;

  return { url: sheetUrl(sheet), ...frame };
}
