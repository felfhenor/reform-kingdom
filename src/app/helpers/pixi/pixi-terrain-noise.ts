import {
  TERRAIN_NOISE_ALPHA,
  TERRAIN_NOISE_CELL_PX,
  TERRAIN_NOISE_DENSITY,
  TERRAIN_NOISE_FEATURE_CELLS,
} from '@helpers/config';
import { noiseSpeckleGrid } from '@helpers/noise';
import { Sprite, Texture } from 'pixi.js';

function pixiTerrainNoisePixelsFill(image: ImageData, seed: string): ImageData {
  const speckles = noiseSpeckleGrid(
    seed,
    image.width,
    image.height,
    TERRAIN_NOISE_FEATURE_CELLS,
    TERRAIN_NOISE_DENSITY,
  );
  speckles.forEach((isSpeckle, index) => {
    if (isSpeckle) image.data[index * 4 + 3] = TERRAIN_NOISE_ALPHA * 255;
  });
  return image;
}

// Caller owns (and must destroy) the texture.
export function pixiTerrainNoiseSpriteCreate(
  seed: string,
  widthPx: number,
  heightPx: number,
): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(widthPx / TERRAIN_NOISE_CELL_PX);
  canvas.height = Math.ceil(heightPx / TERRAIN_NOISE_CELL_PX);

  const context = canvas.getContext('2d');
  if (context) {
    const image = context.createImageData(canvas.width, canvas.height);
    context.putImageData(pixiTerrainNoisePixelsFill(image, seed), 0, 0);
  }

  const texture = Texture.from(canvas, true);
  texture.source.scaleMode = 'nearest';

  const sprite = new Sprite(texture);
  sprite.scale.set(TERRAIN_NOISE_CELL_PX);
  return sprite;
}
