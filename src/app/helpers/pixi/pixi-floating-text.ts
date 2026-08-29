import type { GatherVfxEvent } from '@interfaces';
import { Container, Sprite, Text } from 'pixi.js';
import type { Texture } from 'pixi.js';

const LIFETIME_MS = 1100;
const FLOAT_DISTANCE = 40;
const JITTER_RANGE = 20;

// Elapsed-time -> visual state. Returns undefined once the effect's lifetime has passed (caller destroys it).
export function gatherVfxFloatState(
  elapsedMs: number,
): { alpha: number; offsetY: number } | undefined {
  if (elapsedMs >= LIFETIME_MS) return undefined;

  const fraction = elapsedMs / LIFETIME_MS;
  return {
    alpha: 1 - fraction,
    offsetY: -FLOAT_DISTANCE * fraction,
  };
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
      fontFamily: 'Arial',
      fontWeight: 'bold',
      fill: color,
      stroke: { color: 0x000000, width: 3 },
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

  const qtyText = pixiFloatingTextLabelCreate(`+${event.quantity}`, 0x4ade80, 13);
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

  // Pivot on the row's own horizontal center so `container.x` below lands the row centered on the tile,
  // not its left edge.
  container.pivot.set(cursorX / 2, qtyText.height / 2);

  // Picked once and held for the popup's whole lifetime, so simultaneous popups at one node don't perfectly overlap.
  const jitterX = (Math.random() - 0.5) * JITTER_RANGE;

  const update = (
    elapsedMs: number,
    nodePosition: { x: number; y: number },
  ): boolean => {
    const state = gatherVfxFloatState(elapsedMs);
    if (!state) return false;

    container.alpha = state.alpha;
    // `nodePosition` is the tile's top-left corner (see `tileToScreenPosition`), so `+ tileSize / 2`
    // centers the row on the tile horizontally.
    container.position.set(
      nodePosition.x + tileSize / 2 + jitterX,
      nodePosition.y - tileSize - 10 + state.offsetY,
    );
    return true;
  };

  return { container, update };
}
