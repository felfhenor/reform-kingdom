import type { ElementRef, OnDestroy } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  signal,
  viewChild,
} from '@angular/core';
import {
  cameraPositionCalculate,
  currentLocationGet,
  getMap,
  isPlayerAtLocation,
  pixiAppInitialize,
  pixiIndicatorPlayerAtLocationCreate,
  pixiIndicatorPlayerSpriteCreate,
  pixiResponsiveCanvasSetup,
  pixiTiledMapRender,
  pixiTiledMapTexturesLoad,
  pixiWorldContainersCreate,
} from '@helpers';
import type { TiledMap } from '@interfaces';
import type { Application, Container } from 'pixi.js';

@Component({
  selector: 'app-game-play-world',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #pixiContainer class="h-full w-full"></div>`,
  styleUrl: './game-play-world.component.scss',
})
export class GamePlayWorldComponent implements OnDestroy {
  private pixiContainer =
    viewChild<ElementRef<HTMLDivElement>>('pixiContainer');

  private isPixiSetup = signal<boolean>(false);

  private app?: Application;
  private map?: TiledMap;
  private mapContainer?: Container;
  private playerIndicatorContainer?: Container;
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
  }

  ngOnDestroy(): void {
    if (this.playerIndicatorTicker) {
      this.app?.ticker.remove(this.playerIndicatorTicker);
    }

    this.resizeObserver?.disconnect();
    this.mapContainer?.removeChildren();
    this.playerIndicatorContainer?.removeChildren();
    this.app?.destroy(true, { children: true, texture: true });
  }

  private async initPixi(map: TiledMap): Promise<void> {
    const element = this.pixiContainer()?.nativeElement;
    if (!element) return;

    this.map = map;

    this.app = await pixiAppInitialize(element, {
      width: element.clientWidth,
      height: element.clientHeight,
      backgroundAlpha: 0,
      antialias: false,
    });

    const containers = pixiWorldContainersCreate(this.app);
    this.mapContainer = containers.mapContainer;
    this.playerIndicatorContainer = containers.playerIndicatorContainer;

    this.resizeObserver = pixiResponsiveCanvasSetup(this.app, element, () =>
      this.positionCamera(),
    );

    const textures = await pixiTiledMapTexturesLoad(map);
    this.mapContainer.addChild(pixiTiledMapRender(map, textures));

    this.setupPlayerIndicator();
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

    this.mapContainer.position.set(
      -camera.x * this.map.tilewidth,
      -camera.y * this.map.tileheight,
    );

    this.playerIndicatorContainer.position.set(
      (location.x - camera.x) * this.map.tilewidth,
      (location.y - camera.y) * this.map.tileheight,
    );
  }
}
