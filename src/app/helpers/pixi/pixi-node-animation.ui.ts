import { isMotionReduced } from '@helpers/engine/motion';
import { nodeAnimationFrameIndex } from '@helpers/pixi/pixi-node-animation';
import {
  pixiNodeSprite,
  tiledGidOrientationRead,
} from '@helpers/pixi/pixi-map-render';
import {
  isWorldNodeForgotten,
  worldNodeByName,
  worldNodeDisplayContent,
} from '@helpers/world-node/world-nodes';
import type { PixiNodeAnimationUpdate } from '@interfaces';
import { range } from 'es-toolkit/compat';
import type { Container, Texture } from 'pixi.js';

function pixiNodeAnimationCreate(
  nodeName: string,
  wrapper: Container,
  textures: Record<number, Texture>,
): PixiNodeAnimationUpdate | undefined {
  const entry = worldNodeByName(nodeName);
  const frames = entry ? (worldNodeDisplayContent(entry)?.frames ?? 0) : 0;
  const sprite = pixiNodeSprite(wrapper);
  if (!entry?.nodeData.gid || !sprite || frames < 2) return undefined;

  const firstGid = tiledGidOrientationRead(entry.nodeData.gid).gid;
  const frameTextures = range(frames)
    .map((offset) => textures[firstGid + offset])
    .filter((texture) => !!texture);
  const phase = Math.random();

  return (nowMs) => {
    const index =
      isMotionReduced() || isWorldNodeForgotten(entry)
        ? 0
        : nodeAnimationFrameIndex(nowMs, frameTextures.length, phase);
    sprite.texture = frameTextures[index];
  };
}

export function pixiNodeAnimationsCreate(
  nodeWrappers: Map<string, Container>,
  textures: Record<number, Texture>,
): PixiNodeAnimationUpdate[] {
  return [...nodeWrappers].flatMap(([nodeName, wrapper]) => {
    const update = pixiNodeAnimationCreate(nodeName, wrapper, textures);
    return update ? [update] : [];
  });
}
