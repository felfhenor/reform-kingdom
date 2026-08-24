import type { ElementRef, OnDestroy } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { BarGlobalEffectComponent } from '@components/bar-global-effect/bar-global-effect.component';
import { PanelMapNodeComponent } from '@components/panel-map-node/panel-map-node.component';
import { StatusEncounterComponent } from '@components/status-encounter/status-encounter.component';
import { getEntry } from '@helpers/content';
import {
  isWorldCameraPanned,
  mapNodeDeselect,
  mapNodeSelect,
  selectedMapNode,
  worldCameraRecenterRequest,
} from '@helpers/engine/ui';
import { isGlobalEffectActive } from '@helpers/hero/global-effects';
import { partyGet } from '@helpers/hero/party';
import { travelStepTicksCost } from '@helpers/hero/travel';
import {
  gatheringProgressFraction,
  isGathering,
} from '@helpers/item/gathering';
import { getMap } from '@helpers/maps';
import {
  pixiAppInitialize,
  pixiResponsiveCanvasSetup,
  pixiWorldContainersCreate,
} from '@helpers/pixi/pixi-app-setup';
import {
  cameraBoundsCalculate,
  cameraOffsetFromDrag,
  cameraPositionCalculate,
  viewportTilesCalculate,
} from '@helpers/pixi/pixi-camera';
import { pixiGridOverlayCreate } from '@helpers/pixi/pixi-grid';
import {
  pixiIndicatorEncounterProgressCreate,
  pixiIndicatorGatherProgressCreate,
  pixiIndicatorNodeSelectionCreate,
  pixiIndicatorPlayerAtLocationCreate,
  pixiIndicatorPlayerSpriteCreate,
} from '@helpers/pixi/pixi-indicators';
import { pixiTiledMapRender } from '@helpers/pixi/pixi-map-render';
import {
  pixiSpriteFrameTexturesLoad,
  pixiTiledMapTexturesLoad,
} from '@helpers/pixi/pixi-texture-loader';
import { gamestate } from '@helpers/state-game';
import { getOption } from '@helpers/state-options';
import { currentLocationGet, isPlayerAtLocation } from '@helpers/world';
import { worldNodeEncounterCount } from '@helpers/world-node/world-node-encounter';
import { worldNodeLabelInfo } from '@helpers/world-node/world-node-status';
import {
  isWorldNodeVisible,
  worldNodeByName,
  worldNodeDiscoverIfHidden,
} from '@helpers/world-node/world-nodes';
import type {
  CameraPosition,
  CurrentLocation,
  GlobalEffectId,
  JobContent,
  TiledMap,
  TiledObject,
  WorldNodeLabelInfo,
} from '@interfaces';
import { ContentService } from '@services/content.service';
import { clamp } from 'es-toolkit/compat';
import type { Application, Container, Graphics, Text, Texture } from 'pixi.js';

const FADE_DURATION_MS = 300;

@Component({
  selector: 'app-game-play-world',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PanelMapNodeComponent,
    BarGlobalEffectComponent,
    StatusEncounterComponent,
  ],
  template: `
    <div #pixiContainer class="h-full w-full"></div>
    @if (isMapLoading()) {
      <div class="map-loading-overlay bg-base-100">
        <span class="loading loading-spinner loading-lg text-primary"></span>
        <p class="text-sm text-lighter">Loading map...</p>
      </div>
    }
    <div class="fade-overlay" [class.fade-active]="fadeVisible()"></div>
    <div class="death-overlay" [class.death-active]="isPartyDead()"></div>
    <app-bar-global-effect class="global-effect-bar"></app-bar-global-effect>
    <app-panel-map-node></app-panel-map-node>

    <app-status-encounter class="encounter-status-layer"></app-status-encounter>
  `,
  styleUrl: './game-play-world.component.scss',
})
export class GamePlayWorldComponent implements OnDestroy {
  private contentService = inject(ContentService);

  private pixiContainer =
    viewChild<ElementRef<HTMLDivElement>>('pixiContainer');

  private cameraOffset = signal<CameraPosition>({ x: 0, y: 0 });

  // Frozen anchor while panned, so party movement doesn't drag the panned view. Cleared by `recenterCamera`.
  private frozenCameraBase?: CameraPosition;

  public fadeVisible = signal<boolean>(false);
  public isMapLoading = signal<boolean>(true);

  public isPanned = computed(() => {
    const offset = this.cameraOffset();
    return offset.x !== 0 || offset.y !== 0;
  });

  public isPartyDead = computed(() =>
    isGlobalEffectActive('Deaths Door' as GlobalEffectId),
  );

  private app?: Application;
  private map?: TiledMap;
  private loadedMapName?: string;
  private mapContainer?: Container;
  private gridOverlay?: Graphics;
  private playerIndicatorContainer?: Container;
  private gatherProgressContainer?: Container;
  private gatherProgressBar?: {
    container: Container;
    update: (fraction: number) => void;
  };
  private encounterProgressContainer?: Container;
  private encounterProgressBar?: {
    container: Container;
    update: (fraction: number) => void;
  };
  private nodeSelectionContainer?: Container;
  private nodeSelectionIndicator?: Graphics;
  private nodeLabels?: Map<string, Text>;
  private resizeObserver?: ResizeObserver;
  private playerIndicatorTicker?: () => void;
  private visualPositionTicker?: () => void;
  private canvas?: HTMLCanvasElement;
  private isDragging = false;
  private dragMoved = false;
  private dragPointerId?: number;
  private lastPointerPosition = { x: 0, y: 0 };

  // Rendered position, eased toward the tick-driven `currentLocation` rather than snapping to it - see `updateVisualPosition`.
  private visualPosition: CurrentLocation = { mapName: '', x: 0, y: 0 };

  // Endpoints/schedule of the step currently being glided toward, captured once so pace stays constant - see `updateVisualPosition`.
  private stepOriginTile: CurrentLocation = { mapName: '', x: 0, y: 0 };
  private stepDestinationTile: CurrentLocation = { mapName: '', x: 0, y: 0 };
  private stepStartTime = performance.now();
  private stepDurationMs = 0;
  private hasActiveStep = false;

  // Driven by visual arrival, not the tick-layer `currentLocation`, so the walking token stays visible for the full glide.
  private isShowingAtLocationIndicator = false;
  private partyTokenTextures: Texture[] = [];
  private isTransitioningMap = false;
  private wasPartyDead = false;

  constructor() {
    // Bootstraps the first map load; later map changes are re-checked via the Pixi ticker instead (zoneless CD isn't guaranteed to wake for background ticks).
    effect(() => {
      const mapName = currentLocationGet().mapName;
      this.checkForMapChange(mapName);
    });

    effect(() => {
      const showBackdropGrid = getOption('showBackdropGrid');
      if (this.gridOverlay) this.gridOverlay.visible = showBackdropGrid;
    });

    // Only handles zoom changing while already in-game; `initPixi` applies zoom itself on (re)creation since `this.app` isn't a signal.
    // `untracked` avoids self-retrigger, since `positionCamera` transitively reads `cameraOffset`.
    effect(() => {
      const mapZoom = getOption('mapZoom');
      if (this.app) this.app.stage.scale.set(mapZoom);
      untracked(() => this.positionCamera());
    });

    effect(() => {
      isWorldCameraPanned.set(this.isPanned());
    });

    // Bridges the navbar's recenter button to this component's camera state; skips the initial run so mounting doesn't count as a request.
    // `untracked` avoids self-retrigger via `cameraOffset` (read transitively through `recenterCamera`/`positionCamera`).
    let isFirstRecenterCheck = true;
    effect(() => {
      worldCameraRecenterRequest();
      if (isFirstRecenterCheck) {
        isFirstRecenterCheck = false;
        return;
      }
      untracked(() => this.recenterCamera());
    });
  }

  private checkForMapChange(mapName: string): void {
    if (this.isTransitioningMap || this.loadedMapName === mapName) return;

    const map = getMap(mapName)?.data as TiledMap | undefined;
    if (!map) return;

    this.isTransitioningMap = true;
    void this.transitionToMap(map, mapName).finally(() => {
      this.isTransitioningMap = false;
    });
  }

  // Deaths Door recall teleports instantly; if it happens on the same map, `checkForMapChange` won't catch it, so this snaps the token to avoid a visible walk-back.
  private checkForDeathsDoorRecall(): void {
    const isDead = isGlobalEffectActive('Deaths Door' as GlobalEffectId);
    const justRecalled = this.wasPartyDead && !isDead;
    this.wasPartyDead = isDead;
    if (!justRecalled || this.isTransitioningMap) return;

    const target = currentLocationGet();
    if (target.mapName !== this.loadedMapName) return;

    this.isTransitioningMap = true;
    void this.snapVisualPositionTo(target).finally(() => {
      this.isTransitioningMap = false;
    });
  }

  private async snapVisualPositionTo(target: CurrentLocation): Promise<void> {
    await this.fadeOut();
    this.visualPosition = { ...target };
    this.hasActiveStep = false;
    this.positionCamera();
    await this.fadeIn();
  }

  ngOnDestroy(): void {
    this.teardownPixi();
  }

  private async transitionToMap(map: TiledMap, mapName: string): Promise<void> {
    const isFirstLoad = this.loadedMapName === undefined;

    if (!isFirstLoad) {
      await this.fadeOut();
      this.teardownPixi();
    }

    this.loadedMapName = mapName;
    this.cameraOffset.set({ x: 0, y: 0 });
    this.frozenCameraBase = undefined;

    await this.initPixi(map);

    if (isFirstLoad) {
      this.isMapLoading.set(false);
    } else {
      await this.fadeIn();
    }
  }

  private fadeOut(): Promise<void> {
    this.fadeVisible.set(true);
    return new Promise((resolve) => setTimeout(resolve, FADE_DURATION_MS));
  }

  private fadeIn(): Promise<void> {
    this.fadeVisible.set(false);
    return new Promise((resolve) => setTimeout(resolve, FADE_DURATION_MS));
  }

  private teardownPixi(): void {
    if (this.playerIndicatorTicker) {
      this.app?.ticker.remove(this.playerIndicatorTicker);
      this.playerIndicatorTicker = undefined;
    }

    if (this.visualPositionTicker) {
      this.app?.ticker.remove(this.visualPositionTicker);
      this.visualPositionTicker = undefined;
    }

    this.canvas?.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas?.removeEventListener('pointermove', this.onPointerMove);
    this.canvas?.removeEventListener('pointerup', this.onPointerUp);
    this.canvas?.removeEventListener('pointercancel', this.onPointerUp);

    this.resizeObserver?.disconnect();
    this.mapContainer?.removeChildren();
    this.playerIndicatorContainer?.removeChildren();
    this.gatherProgressContainer?.removeChildren();
    this.encounterProgressContainer?.removeChildren();
    this.nodeSelectionContainer?.removeChildren();
    this.app?.destroy(true, { children: true, texture: true });

    this.app = undefined;
    this.map = undefined;
    this.mapContainer = undefined;
    this.gridOverlay = undefined;
    this.playerIndicatorContainer = undefined;
    this.gatherProgressContainer = undefined;
    this.gatherProgressBar = undefined;
    this.encounterProgressContainer = undefined;
    this.encounterProgressBar = undefined;
    this.nodeSelectionContainer = undefined;
    this.nodeSelectionIndicator = undefined;
    this.nodeLabels = undefined;
    this.resizeObserver = undefined;
    this.canvas = undefined;
  }

  private async initPixi(map: TiledMap): Promise<void> {
    const element = this.pixiContainer()?.nativeElement;
    if (!element) return;

    this.map = map;
    this.visualPosition = { ...currentLocationGet() };
    this.hasActiveStep = false;
    mapNodeDeselect();

    this.app = await pixiAppInitialize(element, {
      width: element.clientWidth,
      height: element.clientHeight,
      backgroundAlpha: 0,
      antialias: false,
    });
    // The mapZoom effect can't apply this itself - `this.app` didn't exist when it last ran.
    this.app.stage.scale.set(getOption('mapZoom'));

    const containers = pixiWorldContainersCreate(this.app);
    this.mapContainer = containers.mapContainer;
    this.playerIndicatorContainer = containers.playerIndicatorContainer;
    this.gatherProgressContainer = containers.gatherProgressContainer;
    this.encounterProgressContainer = containers.encounterProgressContainer;
    this.nodeSelectionContainer = containers.nodeSelectionContainer;

    // Clicking empty map deselects the node (node clicks stop propagation, see pixi-map-render.ts). `dragMoved` distinguishes a pan-drag's pointertap from an actual deselect click.
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
    const renderedMap = pixiTiledMapRender(
      map,
      textures,
      (object) => this.onNodeClick(object),
      (object) => this.resolveNodeLabel(object),
    );
    this.mapContainer.addChild(renderedMap.container);
    this.nodeLabels = renderedMap.nodeLabels;
    this.updateNodeLabels();

    this.gridOverlay = pixiGridOverlayCreate(map);
    this.gridOverlay.visible = getOption('showBackdropGrid');
    this.mapContainer.addChild(this.gridOverlay);

    this.nodeSelectionIndicator = pixiIndicatorNodeSelectionCreate(
      map.tilewidth,
    );
    this.nodeSelectionContainer.addChild(this.nodeSelectionIndicator);

    this.gatherProgressBar = pixiIndicatorGatherProgressCreate(map.tilewidth);
    this.gatherProgressContainer.addChild(this.gatherProgressBar.container);

    this.encounterProgressBar = pixiIndicatorEncounterProgressCreate(
      map.tilewidth,
    );
    this.encounterProgressContainer.addChild(
      this.encounterProgressBar.container,
    );

    if (this.partyTokenTextures.length === 0) {
      this.partyTokenTextures = await this.loadPartyTokenTextures();
    }

    this.isShowingAtLocationIndicator = isPlayerAtLocation();
    this.setupPlayerIndicator();

    this.visualPositionTicker = () => {
      this.checkForMapChange(currentLocationGet().mapName);
      this.checkForDeathsDoorRecall();
      this.updateVisualPosition();
      this.updatePlayerIndicatorIfNeeded();
      this.updateGatherProgressIndicator();
      this.updateEncounterProgressIndicator();
      this.updateNodeLabels();
      this.positionCamera();
    };
    this.app.ticker.add(this.visualPositionTicker);

    this.positionCamera();
  }

  private onNodeClick(object: TiledObject): void {
    const entry = worldNodeByName(object.name);
    if (!entry) return;

    worldNodeDiscoverIfHidden(entry);
    mapNodeSelect(entry);
  }

  private resolveNodeLabel(
    object: TiledObject,
  ): WorldNodeLabelInfo | undefined {
    const entry = worldNodeByName(object.name);
    return entry ? worldNodeLabelInfo(entry) : undefined;
  }

  // Runs every tick to catch countdown text and hidden-node discovery updates; PixiJS setters are no-ops when unchanged so this needs no throttling.
  private updateNodeLabels(): void {
    if (!this.nodeLabels) return;

    this.nodeLabels.forEach((label, nodeName) => {
      const entry = worldNodeByName(nodeName);
      if (!entry) return;

      const visible = isWorldNodeVisible(entry);
      label.visible = visible;
      if (label.parent) label.parent.cursor = visible ? 'pointer' : 'default';
      if (!visible) return;

      const info = worldNodeLabelInfo(entry);
      if (info) label.text = info.text;
    });
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

    const zoom = getOption('mapZoom');
    const { widthTiles: viewportWidthTiles, heightTiles: viewportHeightTiles } =
      viewportTilesCalculate(
        this.app.screen.width,
        this.app.screen.height,
        zoom,
        this.map.tilewidth,
        this.map.tileheight,
      );

    // Anchor only on the first off-center move of this gesture; later deltas accumulate against the same frozen anchor.
    if (!this.frozenCameraBase) {
      const location = this.visualPosition;
      this.frozenCameraBase = cameraPositionCalculate(
        location.x,
        location.y,
        viewportWidthTiles,
        viewportHeightTiles,
        this.map.width,
        this.map.height,
      );
    }
    const bounds = cameraBoundsCalculate(
      viewportWidthTiles,
      viewportHeightTiles,
      this.map.width,
      this.map.height,
    );

    // Tile size must include zoom, since drag deltas are screen pixels but offset is unscaled tile units.
    this.cameraOffset.set(
      cameraOffsetFromDrag(
        this.cameraOffset(),
        dragDeltaX,
        dragDeltaY,
        this.map.tilewidth * zoom,
        this.map.tileheight * zoom,
        this.frozenCameraBase,
        bounds,
      ),
    );

    this.positionCamera();
  }

  public recenterCamera(): void {
    this.cameraOffset.set({ x: 0, y: 0 });
    this.frozenCameraBase = undefined;
    this.positionCamera();
  }

  private async loadPartyTokenTextures(): Promise<Texture[]> {
    const lead = partyGet()[0];
    if (!lead) return [];

    const job = getEntry<JobContent>(lead.jobId);
    if (!job) return [];

    const frame =
      this.contentService.artAtlases()['job']?.[
        `gameassets/job/${job.sprite}.png`
      ];
    if (!frame) return [];

    const jobSpritesheetUrl = this.contentService.toCacheBustURL(
      'art/spritesheets/job.webp',
    );

    return pixiSpriteFrameTexturesLoad(jobSpritesheetUrl, frame, job.frames);
  }

  private setupPlayerIndicator(): void {
    if (!this.app || !this.playerIndicatorContainer || !this.map) return;

    if (this.playerIndicatorTicker) {
      this.app.ticker.remove(this.playerIndicatorTicker);
      this.playerIndicatorTicker = undefined;
    }
    this.playerIndicatorContainer.removeChildren();

    if (this.isShowingAtLocationIndicator) {
      const { graphics, ticker } = pixiIndicatorPlayerAtLocationCreate(
        this.map.tilewidth,
      );

      this.playerIndicatorTicker = ticker;
      this.app.ticker.add(ticker);
      this.playerIndicatorContainer.addChild(graphics);
      return;
    }

    const sprite = pixiIndicatorPlayerSpriteCreate(
      this.map.tilewidth,
      this.partyTokenTextures,
    );
    this.playerIndicatorContainer.addChild(sprite);
  }

  // True once the eased `visualPosition` catches up to `currentLocation` - use for anything gated on visible, not just logical, arrival.
  private isVisuallyAtTarget(): boolean {
    const target = currentLocationGet();
    return (
      this.visualPosition.mapName === target.mapName &&
      Math.abs(this.visualPosition.x - target.x) < 0.001 &&
      Math.abs(this.visualPosition.y - target.y) < 0.001
    );
  }

  // Swaps to the "at location" indicator only on visual arrival, so it doesn't flip before the glide finishes.
  private updatePlayerIndicatorIfNeeded(): void {
    const shouldShowAtLocation =
      this.isVisuallyAtTarget() && isPlayerAtLocation();
    if (shouldShowAtLocation === this.isShowingAtLocationIndicator) return;

    this.isShowingAtLocationIndicator = shouldShowAtLocation;
    this.setupPlayerIndicator();
  }

  // Gated on visual arrival, not just `isGathering()`, so the bar doesn't pop in while the token is still mid-glide.
  private updateGatherProgressIndicator(): void {
    if (!this.gatherProgressBar) return;

    const active = isGathering() && this.isVisuallyAtTarget();
    this.gatherProgressBar.container.visible = active;
    if (active) this.gatherProgressBar.update(gatheringProgressFraction());
  }

  // `combat.fightIndex` (0-based, in-progress fight) doubles as fights-cleared count. Gated on visual arrival like the gather bar.
  private updateEncounterProgressIndicator(): void {
    if (!this.encounterProgressBar) return;

    const combat = gamestate().world.combat;
    const entry = combat ? worldNodeByName(combat.locationName) : undefined;
    const total = entry ? worldNodeEncounterCount(entry) : undefined;

    const active =
      !!combat && !!total && total > 0 && this.isVisuallyAtTarget();
    this.encounterProgressBar.container.visible = active;
    if (active && combat && total) {
      this.encounterProgressBar.update((combat.fightIndex ?? 0) / total);
    }
  }

  // Glides toward the in-flight step as soon as it becomes current, rather than waiting for its ticks to resolve - otherwise the token would sit still for the whole tick-accumulation window then jump.
  // Map changes are handled separately (with a fade) by `transitionToMap`, so a mismatched map name here just snaps.
  private updateVisualPosition(): void {
    if (!this.map) return;

    const now = performance.now();

    const location = currentLocationGet();
    if (location.mapName !== this.visualPosition.mapName) {
      this.visualPosition = { ...location };
      this.hasActiveStep = false;
      return;
    }

    const travel = gamestate().world.travel;
    const inFlightStep =
      travel.status === 'Traveling' ? travel.path[0] : undefined;

    // Idle, or an instant Teleport hop - nothing to glide toward.
    if (!inFlightStep || inFlightStep.kind === 'Teleport') {
      this.visualPosition = { ...location };
      this.hasActiveStep = false;
      return;
    }

    const destinationChanged =
      !this.hasActiveStep ||
      this.stepDestinationTile.mapName !== inFlightStep.mapName ||
      this.stepDestinationTile.x !== inFlightStep.x ||
      this.stepDestinationTile.y !== inFlightStep.y;

    if (destinationChanged) {
      // Origin is wherever the token is currently rendered, not tick-driven `location`, to avoid a visible snap on step handoff.
      this.stepOriginTile = { ...this.visualPosition };
      this.stepDestinationTile = {
        mapName: inFlightStep.mapName,
        x: inFlightStep.x,
        y: inFlightStep.y,
      };

      const speedMultiplier = Math.max(getOption('debugTickMultiplier'), 0.001);
      const stepTicks = travelStepTicksCost(inFlightStep, location);
      this.stepDurationMs = (stepTicks * 1000) / speedMultiplier;
      this.stepStartTime = now;
      this.hasActiveStep = true;
    }

    const fraction =
      this.stepDurationMs > 0
        ? clamp((now - this.stepStartTime) / this.stepDurationMs, 0, 1)
        : 1;

    this.visualPosition = {
      mapName: location.mapName,
      x:
        this.stepOriginTile.x +
        (this.stepDestinationTile.x - this.stepOriginTile.x) * fraction,
      y:
        this.stepOriginTile.y +
        (this.stepDestinationTile.y - this.stepOriginTile.y) * fraction,
    };
  }

  private positionCamera(): void {
    if (
      !this.app ||
      !this.mapContainer ||
      !this.playerIndicatorContainer ||
      !this.gatherProgressContainer ||
      !this.encounterProgressContainer ||
      !this.nodeSelectionContainer ||
      !this.map
    )
      return;

    const location = this.visualPosition;
    const zoom = getOption('mapZoom');
    const { widthTiles: viewportWidthTiles, heightTiles: viewportHeightTiles } =
      viewportTilesCalculate(
        this.app.screen.width,
        this.app.screen.height,
        zoom,
        this.map.tilewidth,
        this.map.tileheight,
      );

    const bounds = cameraBoundsCalculate(
      viewportWidthTiles,
      viewportHeightTiles,
      this.map.width,
      this.map.height,
    );
    const offset = this.cameraOffset();

    // Stay anchored at `frozenCameraBase` while panned, so party movement doesn't drag the view.
    const base =
      this.frozenCameraBase ??
      cameraPositionCalculate(
        location.x,
        location.y,
        viewportWidthTiles,
        viewportHeightTiles,
        this.map.width,
        this.map.height,
      );

    // Reclamped (not trusting `offset` alone) to cover a resize while panned shifting the bounds.
    const camera = {
      x: clamp(base.x + offset.x, bounds.minX, bounds.maxX),
      y: clamp(base.y + offset.y, bounds.minY, bounds.maxY),
    };

    // Offsets by half a tile so the tile center, not its top-left corner, lands at screen center.
    const centerOffsetX = -this.map.tilewidth / 2;
    const centerOffsetY = -this.map.tileheight / 2;

    // Rounded to avoid subpixel offset, which shows up as hairline tearing between tiles.
    this.mapContainer.position.set(
      Math.round(-camera.x * this.map.tilewidth + centerOffsetX),
      Math.round(-camera.y * this.map.tileheight + centerOffsetY),
    );

    this.playerIndicatorContainer.position.set(
      Math.round((location.x - camera.x) * this.map.tilewidth + centerOffsetX),
      Math.round((location.y - camera.y) * this.map.tileheight + centerOffsetY),
    );

    this.gatherProgressContainer.position.set(
      Math.round((location.x - camera.x) * this.map.tilewidth + centerOffsetX),
      Math.round((location.y - camera.y) * this.map.tileheight + centerOffsetY),
    );

    this.encounterProgressContainer.position.set(
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
