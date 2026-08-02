import type { ElementRef, OnDestroy } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  signal,
  viewChild,
} from '@angular/core';
import { MapNodePanelComponent } from '@components/map-node-panel/map-node-panel.component';
import {
  cameraPositionCalculate,
  currentLocationGet,
  getMap,
  getOption,
  isPlayerAtLocation,
  mapNodeDeselect,
  mapNodeSelect,
  pixiAppInitialize,
  pixiGridOverlayCreate,
  pixiIndicatorNodeSelectionCreate,
  pixiIndicatorPlayerAtLocationCreate,
  pixiIndicatorPlayerSpriteCreate,
  pixiResponsiveCanvasSetup,
  pixiTiledMapRender,
  pixiTiledMapTexturesLoad,
  pixiWorldContainersCreate,
  selectedMapNode,
  worldNodeByName,
} from '@helpers';
import type { TiledMap, TiledObject } from '@interfaces';
import type { Application, Container, Graphics } from 'pixi.js';

@Component({
  selector: 'app-game-play-world',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MapNodePanelComponent],
  template: `
    <div #pixiContainer class="h-full w-full"></div>
    <app-map-node-panel></app-map-node-panel>
  `,
  styleUrl: './game-play-world.component.scss',
})
export class GamePlayWorldComponent implements OnDestroy {
  private pixiContainer =
    viewChild<ElementRef<HTMLDivElement>>('pixiContainer');

  private isPixiSetup = signal<boolean>(false);

  private app?: Application;
  private map?: TiledMap;
  private mapContainer?: Container;
  private gridOverlay?: Graphics;
  private playerIndicatorContainer?: Container;
  private nodeSelectionContainer?: Container;
  private nodeSelectionIndicator?: Graphics;
  private resizeObserver?: ResizeObserver;
  private playerIndicatorTicker?: () => void;

  constructor() {
    effect(() => {
      if (this.isPixiSetup()) return;

      const map = getMap(currentLocationGet().mapName)?.data as
        | TiledMap
        | undefined;
      if (!map) return;

      this.isPixiSetup.set(true);
      void this.initPixi(map);
    });

    effect(() => {
      const showBackdropGrid = getOption('showBackdropGrid');
      if (this.gridOverlay) this.gridOverlay.visible = showBackdropGrid;
    });

    effect(() => {
      selectedMapNode();
      if (!this.isPixiSetup()) return;
      this.positionCamera();
    });
  }

  ngOnDestroy(): void {
    if (this.playerIndicatorTicker) {
      this.app?.ticker.remove(this.playerIndicatorTicker);
    }

    this.resizeObserver?.disconnect();
    this.mapContainer?.removeChildren();
    this.playerIndicatorContainer?.removeChildren();
    this.nodeSelectionContainer?.removeChildren();
    this.app?.destroy(true, { children: true, texture: true });
  }

  private async initPixi(map: TiledMap): Promise<void> {
    const element = this.pixiContainer()?.nativeElement;
    if (!element) return;

    this.map = map;
    mapNodeDeselect();

    this.app = await pixiAppInitialize(element, {
      width: element.clientWidth,
      height: element.clientHeight,
      backgroundAlpha: 0,
      antialias: false,
    });

    const containers = pixiWorldContainersCreate(this.app);
    this.mapContainer = containers.mapContainer;
    this.playerIndicatorContainer = containers.playerIndicatorContainer;
    this.nodeSelectionContainer = containers.nodeSelectionContainer;

    // Clicking a node selects it; clicking anywhere else on the map (the
    // stage background behind everything) deselects it. Node clicks stop
    // propagation before it reaches this handler - see pixi-map-render.ts.
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on('pointertap', () => mapNodeDeselect());

    this.resizeObserver = pixiResponsiveCanvasSetup(this.app, element, () =>
      this.positionCamera(),
    );

    const textures = await pixiTiledMapTexturesLoad(map);
    this.mapContainer.addChild(
      pixiTiledMapRender(map, textures, (object) => this.onNodeClick(object)),
    );

    this.gridOverlay = pixiGridOverlayCreate(map);
    this.gridOverlay.visible = getOption('showBackdropGrid');
    this.mapContainer.addChild(this.gridOverlay);

    this.nodeSelectionIndicator = pixiIndicatorNodeSelectionCreate(
      map.tilewidth,
    );
    this.nodeSelectionContainer.addChild(this.nodeSelectionIndicator);

    this.setupPlayerIndicator();
    this.positionCamera();
  }

  private onNodeClick(object: TiledObject): void {
    const entry = worldNodeByName(object.name);
    if (entry) mapNodeSelect(entry);
  }

  private setupPlayerIndicator(): void {
    if (!this.app || !this.playerIndicatorContainer || !this.map) return;

    if (isPlayerAtLocation()) {
      const { graphics, ticker } = pixiIndicatorPlayerAtLocationCreate(
        this.map.tilewidth,
      );

      this.playerIndicatorTicker = ticker;
      this.app.ticker.add(ticker);
      this.playerIndicatorContainer.addChild(graphics);
      return;
    }

    this.playerIndicatorContainer.addChild(
      pixiIndicatorPlayerSpriteCreate(this.map.tilewidth),
    );
  }

  private positionCamera(): void {
    if (
      !this.app ||
      !this.mapContainer ||
      !this.playerIndicatorContainer ||
      !this.nodeSelectionContainer ||
      !this.map
    )
      return;

    const location = currentLocationGet();
    const viewportWidthTiles = this.app.screen.width / this.map.tilewidth;
    const viewportHeightTiles = this.app.screen.height / this.map.tileheight;

    const camera = cameraPositionCalculate(
      location.x,
      location.y,
      viewportWidthTiles,
      viewportHeightTiles,
      this.map.width,
      this.map.height,
    );

    // Camera tiles are anchored by their top-left corner, so without this
    // offset the player's tile sits with its top-left corner at screen
    // center rather than the tile (and player) itself being centered.
    const centerOffsetX = -this.map.tilewidth / 2;
    const centerOffsetY = -this.map.tileheight / 2;

    // The camera position is fractional (it's derived from viewport size in
    // tiles, which rarely divides evenly), so without rounding here the map
    // container sits at a subpixel offset. That misaligns every tile sprite
    // from the pixel grid by the same fractional amount, which shows up as
    // hairline tearing between tiles.
    this.mapContainer.position.set(
      Math.round(-camera.x * this.map.tilewidth + centerOffsetX),
      Math.round(-camera.y * this.map.tileheight + centerOffsetY),
    );

    this.playerIndicatorContainer.position.set(
      Math.round((location.x - camera.x) * this.map.tilewidth + centerOffsetX),
      Math.round((location.y - camera.y) * this.map.tileheight + centerOffsetY),
    );

    this.positionNodeSelectionIndicator(camera, centerOffsetX, centerOffsetY);
  }

  private positionNodeSelectionIndicator(
    camera: { x: number; y: number },
    centerOffsetX: number,
    centerOffsetY: number,
  ): void {
    if (!this.nodeSelectionIndicator || !this.map) return;

    const selected = selectedMapNode();
    this.nodeSelectionIndicator.visible = !!selected;
    if (!selected) return;

    this.nodeSelectionIndicator.position.set(
      Math.round((selected.x - camera.x) * this.map.tilewidth + centerOffsetX),
      Math.round((selected.y - camera.y) * this.map.tileheight + centerOffsetY),
    );
  }
}
