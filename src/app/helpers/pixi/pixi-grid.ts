import type { TiledMap } from '@interfaces';
import { Graphics } from 'pixi.js';

export function pixiGridOverlayCreate(map: TiledMap): Graphics {
  const graphics = new Graphics();
  const width = map.width * map.tilewidth;
  const height = map.height * map.tileheight;

  for (let x = 0; x <= map.width; x++) {
    graphics.moveTo(x * map.tilewidth, 0).lineTo(x * map.tilewidth, height);
  }

  for (let y = 0; y <= map.height; y++) {
    graphics.moveTo(0, y * map.tileheight).lineTo(width, y * map.tileheight);
  }

  graphics.stroke({ width: 1, color: 0xffffff, alpha: 0.2 });
  graphics.cullable = true;

  return graphics;
}
