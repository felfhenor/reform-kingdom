import { Graphics } from 'pixi.js';

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

export function pixiIndicatorPlayerSpriteCreate(tileSize: number): Graphics {
  const graphics = new Graphics()
    .circle(tileSize / 2, tileSize / 2, tileSize / 3)
    .fill(0x3b82f6);

  graphics.cullable = true;

  return graphics;
}
