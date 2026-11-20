import { NODE_SPARKLE_COLOR, NODE_SPARKLE_MOTE_SIZE_PX } from '@helpers/config';
import { isMotionReduced } from '@helpers/engine/motion';
import { pixiNodeSprite } from '@helpers/pixi/pixi-map-render';
import {
  nodeSparkleMotePhases,
  nodeSparkleMoteState,
  nodeSparkleMoteStill,
} from '@helpers/pixi/pixi-node-sparkle';
import { Container, Graphics } from 'pixi.js';

// Sits just above the node's sprite, under its label and status icon.
export function pixiNodeSparklesCreate(
  wrapper: Container,
  seed: number,
): { container: Container; update: (nowMs: number) => void } {
  const container = new Container();
  const sprite = pixiNodeSprite(wrapper);
  if (!sprite) return { container, update: () => undefined };

  const half = NODE_SPARKLE_MOTE_SIZE_PX / 2;
  const phases = nodeSparkleMotePhases(seed);
  const motes = phases.map(() => {
    const mote = new Graphics()
      .rect(-half, -half, NODE_SPARKLE_MOTE_SIZE_PX, NODE_SPARKLE_MOTE_SIZE_PX)
      .fill(NODE_SPARKLE_COLOR);
    // Unplaced until the first update, so it can't flash at the wrapper origin.
    mote.alpha = 0;
    return mote;
  });
  container.addChild(...motes);
  wrapper.addChildAt(container, wrapper.getChildIndex(sprite) + 1);

  // Read live, so motes track the sprite through its reveal bounce.
  const update = (nowMs: number) => {
    const isReduced = isMotionReduced();
    const { width, height } = sprite;
    const left = sprite.x - width / 2;
    const bottom = sprite.y + height / 2;
    motes.forEach((mote, index) => {
      const state = isReduced
        ? nodeSparkleMoteStill(phases[index])
        : nodeSparkleMoteState(nowMs, phases[index]);
      mote.position.set(left + state.x * width, bottom - state.y * height);
      mote.alpha = state.alpha;
    });
  };

  return { container, update };
}
