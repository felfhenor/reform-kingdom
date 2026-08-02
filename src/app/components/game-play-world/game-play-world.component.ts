import type { ElementRef, OnDestroy } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  signal,
  viewChild,
} from '@angular/core';
import { IconComponent } from '@components/icon/icon.component';
import { MapNodePanelComponent } from '@components/map-node-panel/map-node-panel.component';
import { SFXDirective } from '@directives/sfx.directive';
import {
  cameraBoundsCalculate,
  cameraOffsetFromDrag,
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
import type { CameraPosition, TiledMap, TiledObject } from '@interfaces';
import type { Application, Container, Graphics } from 'pixi.js';

@Component({
  selector: 'app-game-play-world',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MapNodePanelComponent, IconComponent, SFXDirective],
  template: `
    <div #pixiContainer class="h-full w-full"></div>
    <app-map-node-panel></app-map-node-panel>

    @if (isPanned()) {
      <button
        type="button"
        class="btn btn-circle btn-primary recenter-button shadow-lg"
        appSfx="ui-click"
        [sfxTrigger]="['click', 'hover']"
        (click)="recenterCamera()"
      >
        <app-icon name="tablerFocus"></app-icon>
      </button>
    }
  `,
  styleUrl: './game-play-world.component.scss',
})
export class GamePlayWorldComponent implements OnDestroy {
  private pixiContainer =
    viewChild<ElementRef<HTMLDivElement>>('pixiContainer');

  private isPixiSetup = signal<boolean>(false);
  private cameraOffset = signal<CameraPosition>({ x: 0, y: 0 });

  public isPanned = computed(() => {
    const offset = this.cameraOffset();
    return offset.x !== 0 || offset.y !== 0;
  });

  private app?: Application;
  private map?: TiledMap;
  private mapContainer?: Container;
  private gridOverlay?: Graphics;
  private playerIndicatorContainer?: Container;
  private nodeSelectionContainer?: Container;
  private nodeSelectionIndicator?: Graphics;
  private resizeObserver?: ResizeObserver;
  private playerIndicatorTicker?: () => void;
  private canvas?: HTMLCanvasElement;
  private isDragging = false;
  private dragMoved = false;
  private dragPointerId?: number;
  private lastPointerPosition = { x: 0, y: 0 };

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

    this.canvas?.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas?.removeEventListener('pointermove', this.onPointerMove);
    this.canvas?.removeEventListener('pointerup', this.onPointerUp);
    this.canvas?.removeEventListener('pointercancel', this.onPointerUp);

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
    // Dragging to pan the map also lands a pointertap here since the pointer
    // goes down and up over the same stage target; `dragMoved` (set by our
    // own pointermove handler below, always before this fires) tells the two
    // apart so panning doesn't also deselect the current node.
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on('pointertap', () => {
      if (this.dragMoved) return;
      mapNodeDeselect();
    });

    this.canvas = this.app.canvas as HTMLCanvasElement;
    this.canvas.style.touchAction = 'none';
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);

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

  private onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;

    this.isDragging = true;
    this.dragMoved = false;
    this.dragPointerId = event.pointerId;
    this.lastPointerPosition = { x: event.clientX, y: event.clientY };
    this.canvas?.setPointerCapture(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (
      !this.isDragging ||
      event.pointerId !== this.dragPointerId ||
      !this.app ||
      !this.map
    )
      return;

    const dragDeltaX = event.clientX - this.lastPointerPosition.x;
    const dragDeltaY = event.clientY - this.lastPointerPosition.y;
    this.lastPointerPosition = { x: event.clientX, y: event.clientY };
    if (dragDeltaX === 0 && dragDeltaY === 0) return;

    this.dragMoved = true;
    this.panCamera(dragDeltaX, dragDeltaY);
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.dragPointerId) return;

    this.isDragging = false;
    this.dragPointerId = undefined;
  };

  private panCamera(dragDeltaX: number, dragDeltaY: number): void {
    if (!this.app || !this.map) return;

    const location = currentLocationGet();
    const viewportWidthTiles = this.app.screen.width / this.map.tilewidth;
    const viewportHeightTiles = this.app.screen.height / this.map.tileheight;

    const base = cameraPositionCalculate(
      location.x,
      location.y,
      viewportWidthTiles,
      viewportHeightTiles,
      this.map.width,
      this.map.height,
    );
    const bounds = cameraBoundsCalculate(
      viewportWidthTiles,
      viewportHeightTiles,
      this.map.width,
      this.map.height,
    );

    this.cameraOffset.set(
      cameraOffsetFromDrag(
        this.cameraOffset(),
        dragDeltaX,
        dragDeltaY,
        this.map.tilewidth,
        this.map.tileheight,
        base,
        bounds,
      ),
    );

    this.positionCamera();
  }

  public recenterCamera(): void {
    this.cameraOffset.set({ x: 0, y: 0 });
    this.positionCamera();
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

    const base = cameraPositionCalculate(
      location.x,
      location.y,
      viewportWidthTiles,
      viewportHeightTiles,
      this.map.width,
      this.map.height,
    );
    const offset = this.cameraOffset();
    const camera = { x: base.x + offset.x, y: base.y + offset.y };

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
