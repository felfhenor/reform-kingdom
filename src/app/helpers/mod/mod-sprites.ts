import type { Signal } from '@angular/core';
import { signal } from '@angular/core';
import type { ModSprite } from '@interfaces';

export const MOD_SPRITE_SIZE = 64;
export const MOD_BACKGROUND_SHEET = 'backgrounds';

const _modSprites = signal<Map<string, ModSprite>>(new Map());
export const modSprites: Signal<Map<string, ModSprite>> =
  _modSprites.asReadonly();

export function modSpriteKey(sheet: string, sprite: string): string {
  return `${sheet}/${sprite}`;
}

export function setModSprites(sprites: ModSprite[]): void {
  _modSprites.set(
    new Map(
      sprites.map((sprite) => [
        modSpriteKey(sprite.sheet, sprite.sprite),
        sprite,
      ]),
    ),
  );
}
