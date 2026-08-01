import { tiledLayerTileAt } from '@helpers/tiled-map';
import type {
  TiledLayer,
  TiledMap,
  TiledObject,
  TiledObjectOrientation,
} from '@interfaces';
import { Container, Sprite, type Texture } from 'pixi.js';

/**
 * Carrina-style maps are authored with a fixed layer order that this renderer
 * relies on for correct stacking, bottom to top: World Tiles, Decorative
 * Tiles, Dense Tiles, Dense Objects, Decorative Objects, Explore Nodes, Other
 * Nodes. We render `map.layers` in file order rather than re-sorting by name
 * so that ordering is preserved automatically.
 */

const FLIPPED_HORIZONTALLY_FLAG = 0x80000000;
const FLIPPED_VERTICALLY_FLAG = 0x40000000;
const FLIPPED_DIAGONALLY_FLAG = 0x20000000;
const FLIP_FLAGS_MASK =
  FLIPPED_HORIZONTALLY_FLAG | FLIPPED_VERTICALLY_FLAG | FLIPPED_DIAGONALLY_FLAG;

// Tiled composes its 3 flip flags in a fixed order - diagonal (a transpose)
// first, then horizontal, then vertical - which for a square tile always
// reduces to one of these 8 (rotation, scaleX, scaleY) sprite transforms.
// Keyed by `${flipHorizontal}${flipVertical}${flipDiagonal}` as 0/1 digits.
const ORIENTATION_BY_FLAGS: Record<
  string,
  { rotation: number; scaleX: number; scaleY: number }
> = {
  '000': { rotation: 0, scaleX: 1, scaleY: 1 },
  '001': { rotation: Math.PI / 2, scaleX: 1, scaleY: -1 },
  '010': { rotation: 0, scaleX: 1, scaleY: -1 },
  '011': { rotation: Math.PI / 2, scaleX: -1, scaleY: -1 },
  '100': { rotation: 0, scaleX: -1, scaleY: 1 },
  '101': { rotation: Math.PI / 2, scaleX: 1, scaleY: 1 },
  '110': { rotation: 0, scaleX: -1, scaleY: -1 },
  '111': { rotation: Math.PI / 2, scaleX: -1, scaleY: 1 },
};

export function tiledGidOrientationRead(gid: number): TiledObjectOrientation {
  const flipHorizontal = (gid & FLIPPED_HORIZONTALLY_FLAG) !== 0;
  const flipVertical = (gid & FLIPPED_VERTICALLY_FLAG) !== 0;
  const flipDiagonal = (gid & FLIPPED_DIAGONALLY_FLAG) !== 0;
  const key = `${flipHorizontal ? 1 : 0}${flipVertical ? 1 : 0}${flipDiagonal ? 1 : 0}`;

  return {
    gid: (gid & ~FLIP_FLAGS_MASK) >>> 0,
    ...ORIENTATION_BY_FLAGS[key],
  };
}

function pixiTiledLayerRender(
  layer: TiledLayer,
  textures: Record<number, Texture>,
  tilewidth: number,
  tileheight: number,
): Container {
  const container = new Container();
  container.cullable = true;

  if (!layer.data || !layer.width || !layer.height) return container;

  for (let y = 0; y < layer.height; y++) {
    for (let x = 0; x < layer.width; x++) {
      const gid = tiledLayerTileAt(layer, x, y);
      if (gid === 0) continue;

      const texture = textures[gid];
      if (!texture) continue;

      const sprite = new Sprite(texture);
      sprite.x = x * tilewidth;
      sprite.y = y * tileheight;
      sprite.cullable = true;

      container.addChild(sprite);
    }
  }

  return container;
}

function pixiTiledObjectRender(
  object: TiledObject,
  textures: Record<number, Texture>,
): Container | undefined {
  if (!object.gid) return undefined;

  const orientation = tiledGidOrientationRead(object.gid);
  const texture = textures[orientation.gid];
  if (!texture) return undefined;

  // The gid's own flip flags reorient the tile image within its bounding
  // box, so that transform is centered on the box (it never moves the box).
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5, 0.5);
  sprite.x = object.width / 2;
  sprite.y = -object.height / 2;
  sprite.scale.set(
    (object.width / texture.width) * orientation.scaleX,
    (object.height / texture.height) * orientation.scaleY,
  );
  sprite.rotation = orientation.rotation;

  // Tiled also supports a free-form `rotation` on the object itself
  // (independent of the gid flip flags - this is what river/road bend tiles
  // use), applied clockwise around the object's own origin, which is its
  // bottom-left corner rather than its center. A wrapper container placed at
  // that origin gives us the correct pivot for it.
  const wrapper = new Container();
  wrapper.addChild(sprite);
  wrapper.x = object.x;
  wrapper.y = object.y;
  wrapper.rotation = ((object.rotation ?? 0) * Math.PI) / 180;
  wrapper.cullable = true;

  return wrapper;
}

function pixiTiledObjectLayerRender(
  layer: TiledLayer,
  textures: Record<number, Texture>,
): Container {
  const container = new Container();
  container.cullable = true;

  (layer.objects ?? []).forEach((object) => {
    const objectContainer = pixiTiledObjectRender(object, textures);
    if (objectContainer) container.addChild(objectContainer);
  });

  return container;
}

export function pixiTiledMapRender(
  map: TiledMap,
  textures: Record<number, Texture>,
): Container {
  const container = new Container();

  map.layers.forEach((layer) => {
    const layerContainer =
      layer.type === 'tilelayer'
        ? pixiTiledLayerRender(layer, textures, map.tilewidth, map.tileheight)
        : pixiTiledObjectLayerRender(layer, textures);

    container.addChild(layerContainer);
  });

  return container;
}
