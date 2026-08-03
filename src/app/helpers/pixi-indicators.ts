import type { Texture } from 'pixi.js';
import { AnimatedSprite, Graphics } from 'pixi.js';

export function pixiIndicatorPlayerAtLocationCreate(tileSize: number): {
  graphics: Graphics;
  ticker: () => void;
} {
  const graphics = new Graphics()
    .rect(0, 0, tileSize, tileSize)
    .fill(0xffffff)
    .rect(2, 2, tileSize - 4, tileSize - 4)
    .cut();

  graphics.cullable = true;

  let alpha = 1;
  let direction = -1;
  let lastTime = performance.now();
  const animationSpeed = 0.002;

  const ticker = () => {
    const now = performance.now();
    const deltaTime = now - lastTime;
    lastTime = now;

    alpha += direction * animationSpeed * deltaTime;
    if (alpha <= 0.4) direction = 1;
    if (alpha >= 0.8) direction = -1;

    alpha = Math.max(0.4, Math.min(0.8, alpha));
    graphics.alpha = alpha;
  };

  return { graphics, ticker };
}

// The party's token while it's traveling between locations. Renders the lead
// hero's job walk-cycle (animates itself via Ticker.shared once playing, no
// manual ticker needed) - falls back to a plain circle if no sprite frames
// could be resolved (e.g. content not yet loaded).
export function pixiIndicatorPlayerSpriteCreate(
  tileSize: number,
  frameTextures: Texture[],
): AnimatedSprite | Graphics {
  if (frameTextures.length === 0) {
    const graphics = new Graphics()
      .circle(tileSize / 2, tileSize / 2, tileSize / 3)
      .fill(0x3b82f6);

    graphics.cullable = true;
    return graphics;
  }

  const sprite = new AnimatedSprite({
    textures: frameTextures,
    animationSpeed: 0.2,
    autoPlay: true,
  });

  sprite.anchor.set(0.5, 0.5);
  sprite.x = tileSize / 2;
  sprite.y = tileSize / 2;
  sprite.width = tileSize;
  sprite.height = tileSize;
  sprite.cullable = true;

  return sprite;
}

export function pixiIndicatorNodeSelectionCreate(tileSize: number): Graphics {
  const graphics = new Graphics()
    .rect(1, 1, tileSize - 2, tileSize - 2)
    .stroke({
      width: 3,
      color: 0xfbbf24,
      alignment: 0.5,
    });

  graphics.cullable = true;
  graphics.visible = false;

  return graphics;
}
