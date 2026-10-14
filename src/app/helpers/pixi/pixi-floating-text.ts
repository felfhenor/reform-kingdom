import {
  GATHER_VFX_FLOAT_DISTANCE,
  GATHER_VFX_JITTER_RANGE,
  GATHER_VFX_LIFETIME_MS,
  GATHER_VFX_QUOTE_HOLD_FRACTION,
  GATHER_VFX_QUOTE_LIFETIME_MS,
  GATHER_VFX_QUOTE_WRAP_WIDTH,
} from '@helpers/config';
import { uiTextFontFamily, uiTextLetterSpacing } from '@helpers/engine/font.ui';
import type { GatherVfxEvent } from '@interfaces';
import type { Texture } from 'pixi.js';
import { Container, Sprite, Text } from 'pixi.js';

// Elapsed-time -> visual state. Returns undefined once the effect's lifetime has passed (caller destroys it).
export function gatherVfxFloatState(
  elapsedMs: number,
  lifetimeMs = GATHER_VFX_LIFETIME_MS,
  holdFraction = 0,
): { alpha: number; offsetY: number } | undefined {
  if (elapsedMs >= lifetimeMs) return undefined;

  const fraction = elapsedMs / lifetimeMs;
  const fadeFraction =
    Math.max(0, fraction - holdFraction) / (1 - holdFraction);
  return {
    alpha: 1 - fadeFraction,
    offsetY: -GATHER_VFX_FLOAT_DISTANCE * fraction,
  };
}

function pixiFloatingQuoteCreate(quote: string, width: number): Text {
  return new Text({
    text: `"${quote}"`,
    style: {
      fontSize: 11,
      fontFamily: uiTextFontFamily(),
      fontStyle: 'italic',
      fill: 0xffffff,
      stroke: { color: 0x000000, width: 3 },
      align: 'center',
      wordWrap: true,
      wordWrapWidth: width,
      letterSpacing: uiTextLetterSpacing(),
    },
  });
}

function pixiFloatingTextLabelCreate(
  text: string,
  color: number,
  fontSize: number,
): Text {
  return new Text({
    text,
    style: {
      fontSize,
      fontFamily: uiTextFontFamily(),
      fontWeight: 'bold',
      fill: color,
      stroke: { color: 0x000000, width: 3 },
      letterSpacing: uiTextLetterSpacing(),
    },
  });
}

// `nodePosition` is re-supplied to `update` every frame (not captured once at creation) since the node's
// own screen position changes as the camera pans - a spawn-time-only position would drift away from the node.
export function pixiFloatingTextCreate(
  event: GatherVfxEvent,
  iconTexture: Texture | undefined,
  tileSize: number,
): {
  container: Container;
  update: (
    elapsedMs: number,
    nodePosition: { x: number; y: number },
  ) => boolean;
} {
  const container = new Container();
  container.cullable = true;

  const qtyText = pixiFloatingTextLabelCreate(
    `+${event.quantity}`,
    0x4ade80,
    13,
  );
  const nameText = pixiFloatingTextLabelCreate(event.name, 0xffffff, 11);
  const iconSize = 16;
  const gap = 4;

  let cursorX = 0;
  qtyText.position.set(cursorX, 0);
  container.addChild(qtyText);
  cursorX += qtyText.width + gap;

  if (iconTexture) {
    const icon = new Sprite(iconTexture);
    icon.width = iconSize;
    icon.height = iconSize;
    icon.position.set(cursorX, (qtyText.height - iconSize) / 2);
    container.addChild(icon);
    cursorX += iconSize + gap;
  }

  nameText.position.set(cursorX, 0);
  container.addChild(nameText);
  cursorX += nameText.width;

  if (event.quote) {
    const quoteText = pixiFloatingQuoteCreate(
      event.quote,
      GATHER_VFX_QUOTE_WRAP_WIDTH,
    );
    quoteText.anchor.set(0.5, 0);
    quoteText.position.set(cursorX / 2, qtyText.height + gap);
    container.addChild(quoteText);
  }

  // Pivot on the row's own horizontal center so `container.x` below lands the row centered on the tile,
  // not its left edge.
  container.pivot.set(cursorX / 2, qtyText.height / 2);

  const lifetimeMs = event.quote
    ? GATHER_VFX_QUOTE_LIFETIME_MS
    : GATHER_VFX_LIFETIME_MS;
  const holdFraction = event.quote ? GATHER_VFX_QUOTE_HOLD_FRACTION : 0;

  // Picked once and held for the popup's whole lifetime, so simultaneous popups at one node don't perfectly overlap.
  const jitterX = (Math.random() - 0.5) * GATHER_VFX_JITTER_RANGE;

  const update = (
    elapsedMs: number,
    nodePosition: { x: number; y: number },
  ): boolean => {
    const state = gatherVfxFloatState(elapsedMs, lifetimeMs, holdFraction);
    if (!state) return false;

    container.alpha = state.alpha;
    // `nodePosition` is the tile's top-left corner, so `+ tileSize / 2`
    // centers the row on the tile horizontally.
    container.position.set(
      nodePosition.x + tileSize / 2 + jitterX,
      nodePosition.y - tileSize - 10 + state.offsetY,
    );
    return true;
  };

  return { container, update };
}
