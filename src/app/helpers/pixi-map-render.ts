import { pixiIndicatorNodeLabelCreate } from '@helpers/pixi-indicators';
import { tiledLayerTileAt } from '@helpers/tiled-map';
import type {
  PixiNodeClickHandler,
  PixiNodeLabelResolver,
  TiledLayer,
  TiledMap,
  TiledObject,
  TiledObjectOrientation,
} from '@interfaces';
import type { FederatedPointerEvent, Text } from 'pixi.js';
import { Container, Sprite, type Texture } from 'pixi.js';

export type PixiTiledMapRenderResult = {
  container: Container;
  // Node-name -> its always-on nametag `Text`, for callers that need to
  // live-update a label after the map is built (e.g. an `ExploreRandomNode`'s
  // countdown timer) - see `resolveNodeLabel`'s per-object result, which is
  // otherwise only ever read once at render time.
  nodeLabels: Map<string, Text>;
};

/**
 * Carrina-style maps are authored with a fixed layer order that this renderer
 * relies on for correct stacking, bottom to top: World Tiles, Dense Tiles,
 * Decorative Tiles, Path Tiles, Dense Objects, Decorative Objects, Path
 * Objects, Explore Nodes, Other Nodes. We render `map.layers` in file order
 * rather than re-sorting by name so that ordering is preserved automatically.
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

type PixiTiledObjectRenderResult = {
  wrapper: Container;
  label?: Text;
};

function pixiTiledObjectRender(
  object: TiledObject,
  textures: Record<number, Texture>,
  onNodeClick?: PixiNodeClickHandler,
  resolveNodeLabel?: PixiNodeLabelResolver,
): PixiTiledObjectRenderResult | undefined {
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

  // Only node objects (Explore Nodes / Other Nodes layers) carry a `type`;
  // decorative/terrain objects are typeless and should stay unclickable.
  if (onNodeClick && object.type) {
    wrapper.eventMode = 'static';
    wrapper.cursor = 'pointer';
    wrapper.on('pointertap', (event: FederatedPointerEvent) => {
      // Stops the tap from also reaching the stage's background handler,
      // which would otherwise treat this as an empty-map click and
      // immediately deselect the node this same tap just selected.
      event.stopPropagation();
      onNodeClick(object);
    });
  }

  // Same restriction as the click handler above - only node objects carry a
  // `type`, so decorative/terrain objects never get a label.
  const labelInfo = object.type ? resolveNodeLabel?.(object) : undefined;
  let label: Text | undefined;
  if (labelInfo) {
    label = pixiIndicatorNodeLabelCreate(labelInfo.kind, labelInfo.text);
    label.x = object.width / 2;
    label.y = -object.height - 4;
    wrapper.addChild(label);
  }

  return { wrapper, label };
}

function pixiTiledObjectLayerRender(
  layer: TiledLayer,
  textures: Record<number, Texture>,
  onNodeClick?: PixiNodeClickHandler,
  resolveNodeLabel?: PixiNodeLabelResolver,
): { container: Container; nodeLabels: Map<string, Text> } {
  const container = new Container();
  container.cullable = true;
  const nodeLabels = new Map<string, Text>();

  (layer.objects ?? []).forEach((object) => {
    const rendered = pixiTiledObjectRender(
      object,
      textures,
      onNodeClick,
      resolveNodeLabel,
    );
    if (!rendered) return;

    container.addChild(rendered.wrapper);
    if (rendered.label) nodeLabels.set(object.name, rendered.label);
  });

  return { container, nodeLabels };
}

export function pixiTiledMapRender(
  map: TiledMap,
  textures: Record<number, Texture>,
  onNodeClick?: PixiNodeClickHandler,
  resolveNodeLabel?: PixiNodeLabelResolver,
): PixiTiledMapRenderResult {
  const container = new Container();
  const nodeLabels = new Map<string, Text>();

  map.layers.forEach((layer) => {
    if (layer.type === 'tilelayer') {
      container.addChild(
        pixiTiledLayerRender(layer, textures, map.tilewidth, map.tileheight),
      );
      return;
    }

    const rendered = pixiTiledObjectLayerRender(
      layer,
      textures,
      onNodeClick,
      resolveNodeLabel,
    );
    container.addChild(rendered.container);
    rendered.nodeLabels.forEach((label, nodeName) =>
      nodeLabels.set(nodeName, label),
    );
  });

  return { container, nodeLabels };
}
