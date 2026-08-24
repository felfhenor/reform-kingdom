import type { WorldNodeInteractionKind } from '@interfaces';
import { clamp } from 'es-toolkit/compat';
import type { Texture } from 'pixi.js';
import { AnimatedSprite, Container, Graphics, Text } from 'pixi.js';

const NODE_LABEL_COLOR_BY_KIND: Record<WorldNodeInteractionKind, number> = {
  Gather: 0x4ade80,
  Explore: 0xfb7185,
  ExploreRandom: 0xc084fc,
  Trade: 0xfbbf24,
  Travel: 0x60a5fa,
};

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

    alpha = clamp(alpha, 0.4, 0.8);
    graphics.alpha = alpha;
  };

  return { graphics, ticker };
}

// Renders the lead hero's walk-cycle (self-animates via Ticker.shared); falls back to a plain circle if no frames resolved.
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

// Progress bar above the party's tile while gathering. The float-above offset lives in the graphics'
// transform, not their drawn rect, so scaling the fill doesn't drag it sideways.
export function pixiIndicatorGatherProgressCreate(tileSize: number): {
  container: Container;
  update: (fraction: number) => void;
} {
  const barWidth = tileSize * 0.8;
  const barHeight = 6;
  const offsetX = (tileSize - barWidth) / 2;
  const offsetY = -40;

  const container = new Container();
  container.cullable = true;
  container.visible = false;

  const background = new Graphics()
    .rect(0, 0, barWidth, barHeight)
    .fill(0x000000);
  background.alpha = 0.6;
  background.x = offsetX;
  background.y = offsetY;

  const fill = new Graphics().rect(0, 0, barWidth, barHeight).fill(0x4ade80);
  fill.x = offsetX;
  fill.y = offsetY;

  container.addChild(background, fill);

  const update = (fraction: number) => {
    fill.scale.x = clamp(fraction, 0, 1);
  };

  return { container, update };
}

// Same shape/positioning as `pixiIndicatorGatherProgressCreate`, just a different fill color.
export function pixiIndicatorEncounterProgressCreate(tileSize: number): {
  container: Container;
  update: (fraction: number) => void;
} {
  const barWidth = tileSize * 0.8;
  const barHeight = 6;
  const offsetX = (tileSize - barWidth) / 2;
  const offsetY = -40;

  const container = new Container();
  container.cullable = true;
  container.visible = false;

  const background = new Graphics()
    .rect(0, 0, barWidth, barHeight)
    .fill(0x000000);
  background.alpha = 0.6;
  background.x = offsetX;
  background.y = offsetY;

  const fill = new Graphics().rect(0, 0, barWidth, barHeight).fill(0xfb7185);
  fill.x = offsetX;
  fill.y = offsetY;

  container.addChild(background, fill);

  const update = (fraction: number) => {
    fill.scale.x = clamp(fraction, 0, 1);
  };

  return { container, update };
}

// Always visible (not just on hover/selection) so players can spot interactable nodes at a glance.
export function pixiIndicatorNodeLabelCreate(
  kind: WorldNodeInteractionKind,
  text: string,
): Text {
  const label = new Text({
    text,
    style: {
      fontSize: 11,
      fontFamily: 'Arial',
      fontWeight: 'bold',
      align: 'center',
      fill: NODE_LABEL_COLOR_BY_KIND[kind],
      stroke: { color: 0x000000, width: 3 },
    },
  });

  label.anchor.set(0.5, 1);
  label.cullable = true;

  return label;
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
