import type { WorldNodeInteractionKind } from '@interfaces';
import { clamp } from 'es-toolkit/compat';
import type { Texture } from 'pixi.js';
import { AnimatedSprite, Container, Graphics, Text } from 'pixi.js';

const NODE_LABEL_COLOR_BY_KIND: Record<WorldNodeInteractionKind, number> = {
  Gather: 0x4ade80,
  Explore: 0xfb7185,
  ExploreRandom: 0xc084fc,
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

// A small bar hovering above the party's tile while gathering, filling left
// to right as the current gather cycle progresses - full means the next
// item-chance roll is about to happen. Its screen position is set every
// frame by the caller (see game-play-world.component.ts); the bar/background
// graphics carry the "float above the tile" offset in their own transform
// (not baked into their drawn rect) so scaling the fill for progress doesn't
// also drag it sideways.
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

// A floating nametag rendered above every interactable node (gather/explore/
// travel), always visible rather than only on hover or selection, so players
// can tell at a glance which nodes they can go to and what level they need.
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
