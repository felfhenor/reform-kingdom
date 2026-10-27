import { NODE_REVEAL_RING_RADIUS_TILES } from '@helpers/config';
import { isMotionReduced } from '@helpers/engine/motion';
import { nodeRevealState } from '@helpers/pixi/pixi-node-reveal';
import type { Container } from 'pixi.js';
import { Graphics } from 'pixi.js';

// Scales the node's sprite (always the wrapper's first child) so labels/status icons don't bounce with it.
export function pixiNodeRevealCreate(
  wrapper: Container,
  tileSize: number,
): (elapsedMs: number) => boolean {
  const sprite = wrapper.children[0];
  const baseScale = { x: sprite.scale.x, y: sprite.scale.y };

  const ring = new Graphics()
    .circle(0, 0, tileSize * NODE_REVEAL_RING_RADIUS_TILES)
    .fill({ color: 0xfde68a, alpha: 0.25 })
    .stroke({ color: 0xfde68a, width: 3 });
  ring.position.copyFrom(sprite.position);
  wrapper.addChildAt(ring, 0);

  return (elapsedMs) => {
    const state = nodeRevealState(elapsedMs);
    if (!state) {
      sprite.scale.set(baseScale.x, baseScale.y);
      ring.destroy();
      return false;
    }

    // Reduced motion keeps the ring as a fading highlight but drops the bounce and growth.
    const isReduced = isMotionReduced();
    const scale = isReduced ? 1 : state.scale;
    sprite.scale.set(baseScale.x * scale, baseScale.y * scale);
    ring.scale.set(isReduced ? 1 : state.ringScale);
    ring.alpha = state.ringAlpha;
    return true;
  };
}
