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
import { StatusCraftingComponent } from '@components/status-crafting/status-crafting.component';
import { StatusEncounterComponent } from '@components/status-encounter/status-encounter.component';
import { StatusWorkerLevelupComponent } from '@components/status-worker-levelup/status-worker-levelup.component';
import { getEntry } from '@helpers/content';
import { gatherVfx$ } from '@helpers/engine/gather-vfx';
import {
  isWorldCameraPanned,
  mapNodeDeselect,
  mapNodeSelect,
  selectedMapNode,
  worldCameraRecenterRequest,
} from '@helpers/engine/ui';
import { isGlobalEffectActive } from '@helpers/hero/global-effects';
import { partyGet } from '@helpers/hero/party';
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
  tileToScreenPosition,
  viewportTilesCalculate,
} from '@helpers/pixi/pixi-camera';
import { pixiGridOverlayCreate } from '@helpers/pixi/pixi-grid';
import { pixiFloatingTextCreate } from '@helpers/pixi/pixi-floating-text';
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
import {
  defaultTravelGlideState,
  travelGlideAdvance,
} from '@helpers/pixi/pixi-travel-glide';
import { gamestate } from '@helpers/state-game';
import { getOption } from '@helpers/state-options';
import { currentLocationGet, isPlayerAtLocation } from '@helpers/world';
import { workersTravelingTokens } from '@helpers/worker/worker-travel';
import { worldNodeDiscoverIfCollectibleGateMet } from '@helpers/world-node/world-node-collectible-gate';
import { worldNodeEncounterCount } from '@helpers/world-node/world-node-encounter';
import { worldNodeLabelInfo } from '@helpers/world-node/world-node-status';
import {
  isWorldNodeCollectibleGateMet,
  isWorldNodeVisible,
  worldNodeByName,
  worldNodeDiscoverIfHidden,
} from '@helpers/world-node/world-nodes';
import type {
  AtlasedImage,
  CameraBounds,
  CameraPosition,
  CurrentLocation,
  GatherVfxEvent,
  GlobalEffectId,
  JobContent,
  TiledMap,
  TiledObject,
  TravelGlideState,
  ViewportTiles,
  WorkerContent,
  WorkerId,
  WorldNodeLabelInfo,
} from '@interfaces';
import { ContentService } from '@services/content.service';
import { clamp, maxBy, sumBy } from 'es-toolkit/compat';
import { Container } from 'pixi.js';
import type { Application, Graphics, Text, Texture } from 'pixi.js';
import type { Subscription } from 'rxjs';

const FADE_DURATION_MS = 300;
// Minimum time between two floating-text spawns at the same node, so simultaneous gathers stagger instead of stacking.
const FLOATING_TEXT_STAGGER_MS = 180;
const FLOATING_TEXT_MAX_ACTIVE = 24;
const FLOATING_TEXT_MAX_PENDING = 40;

@Component({
  selector: 'app-game-play-world',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PanelMapNodeComponent,
    BarGlobalEffectComponent,
    StatusEncounterComponent,
    StatusCraftingComponent,
    StatusWorkerLevelupComponent,
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
    <div class="top-right-status-layer">
      <app-status-worker-levelup></app-status-worker-levelup>
      <app-status-crafting></app-status-crafting>
    </div>
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

  // Refreshed only on resize/zoom/map-load by `refreshViewportGeometry`, not every frame.
  private viewportTiles: ViewportTiles = { widthTiles: 0, heightTiles: 0 };
  private cameraBounds: CameraBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

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
  private workerIndicatorContainer?: Container;
  // Each worker's sprite/graphics lives inside its own tile-positioned container, mirroring
  // playerIndicatorContainer's child-offset scheme so the anchor math never needs duplicating here.
  private workerTokens = new Map<WorkerId, Container>();
  private workerGlideStates = new Map<WorkerId, TravelGlideState>();
  private workerTokenTextures = new Map<WorkerId, Texture[]>();
  private pendingWorkerTextureLoads = new Set<WorkerId>();
  // Cached by positionCamera() each frame so updateWorkerIndicators() doesn't recompute it per worker.
  private lastCamera: CameraPosition = { x: 0, y: 0 };
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
  private nodeWrappers?: Map<string, Container>;
  private floatingTextContainer?: Container;
  // Keyed per node (not one global FIFO) so a busy node's stagger gate can't head-of-line-block another node's popups.
  private pendingGatherVfxByNode = new Map<string, GatherVfxEvent[]>();
  private lastFloatingTextSpawnAtByNode = new Map<string, number>();
  private activeFloatingTexts: Array<{
    container: Container;
    update: (
      elapsedMs: number,
      nodePosition: { x: number; y: number },
    ) => boolean;
    spawnedAt: number;
    nodeName: string;
  }> = [];
  // Icon textures persist across map transitions, same as workerTokenTextures/partyTokenTextures below.
  private floatingTextIconTextures = new Map<string, Texture>();
  private pendingFloatingTextTextureLoads = new Map<string, GatherVfxEvent[]>();
  private gatherVfxSubscription?: Subscription;
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
      untracked(() => {
        this.refreshViewportGeometry();
        this.positionCamera();
      });
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

    // Subscribed once (not per initPixi) so it survives map transitions; queued events are dropped
    // in updateFloatingTexts when their node isn't on the currently loaded map.
    this.gatherVfxSubscription = gatherVfx$.subscribe((event) => {
      this.enqueueGatherVfx(event);
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
    this.gatherVfxSubscription?.unsubscribe();
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
    this.workerIndicatorContainer?.removeChildren();
    this.gatherProgressContainer?.removeChildren();
    this.encounterProgressContainer?.removeChildren();
    this.nodeSelectionContainer?.removeChildren();
    // Destroyed individually (not via removeChildren + app.destroy's cascade) - each Text's canvas
    // texture would otherwise leak, since app.destroy only cascades into children still attached to it.
    this.activeFloatingTexts.forEach((entry) =>
      entry.container.destroy({ children: true }),
    );
    this.app?.destroy(true, { children: true, texture: true });

    // Queued/active floating text is map-scoped (positions reference nodes on the map being torn down) -
    // the icon texture cache is not, and persists below like workerTokenTextures does.
    this.pendingGatherVfxByNode.clear();
    this.lastFloatingTextSpawnAtByNode.clear();
    this.pendingFloatingTextTextureLoads.clear();
    this.activeFloatingTexts = [];

    this.app = undefined;
    this.map = undefined;
    this.mapContainer = undefined;
    this.gridOverlay = undefined;
    this.playerIndicatorContainer = undefined;
    this.workerIndicatorContainer = undefined;
    // Tokens/glide state are per-app-instance; loaded textures persist across map transitions, same as partyTokenTextures.
    this.workerTokens.clear();
    this.workerGlideStates.clear();
    this.gatherProgressContainer = undefined;
    this.gatherProgressBar = undefined;
    this.encounterProgressContainer = undefined;
    this.encounterProgressBar = undefined;
    this.nodeSelectionContainer = undefined;
    this.nodeSelectionIndicator = undefined;
    this.nodeLabels = undefined;
    this.nodeWrappers = undefined;
    this.floatingTextContainer = undefined;
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
    this.refreshViewportGeometry();

    const containers = pixiWorldContainersCreate(this.app);
    this.mapContainer = containers.mapContainer;
    this.playerIndicatorContainer = containers.playerIndicatorContainer;
    this.workerIndicatorContainer = containers.workerIndicatorContainer;
    this.gatherProgressContainer = containers.gatherProgressContainer;
    this.encounterProgressContainer = containers.encounterProgressContainer;
    this.nodeSelectionContainer = containers.nodeSelectionContainer;
    this.floatingTextContainer = containers.floatingTextContainer;

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

    this.resizeObserver = pixiResponsiveCanvasSetup(this.app, element, () => {
      this.refreshViewportGeometry();
      this.positionCamera();
    });

    const textures = await pixiTiledMapTexturesLoad(map);
    const renderedMap = pixiTiledMapRender(
      map,
      textures,
      (object) => this.onNodeClick(object),
      (object) => this.resolveNodeLabel(object),
    );
    this.mapContainer.addChild(renderedMap.container);
    this.nodeLabels = renderedMap.nodeLabels;
    this.nodeWrappers = renderedMap.nodeWrappers;
    this.updateNodeLabels();
    this.updateNodeWrapperVisibility();

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
      this.updateNodeWrapperVisibility();
      this.positionCamera();
      this.updateWorkerIndicators();
      this.updateFloatingTexts();
    };
    this.app.ticker.add(this.visualPositionTicker);

    this.positionCamera();
  }

  private onNodeClick(object: TiledObject): void {
    const entry = worldNodeByName(object.name);
    if (!entry) return;
    if (!isWorldNodeCollectibleGateMet(entry)) return;

    worldNodeDiscoverIfHidden(entry);
    mapNodeSelect(entry);
  }

  // Runs every tick since a collectible pickup doesn't trigger a map rebuild.
  private updateNodeWrapperVisibility(): void {
    if (!this.nodeWrappers) return;

    this.nodeWrappers.forEach((wrapper, nodeName) => {
      const entry = worldNodeByName(nodeName);
      if (!entry) return;

      worldNodeDiscoverIfCollectibleGateMet(entry);

      const unlocked = isWorldNodeCollectibleGateMet(entry);
      wrapper.visible = unlocked;
      wrapper.eventMode = unlocked ? 'static' : 'none';
    });
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

  // Screen size/zoom/map dimensions only change on resize/zoom/map load, not every frame.
  private refreshViewportGeometry(): void {
    if (!this.app || !this.map) return;

    this.viewportTiles = viewportTilesCalculate(
      this.app.screen.width,
      this.app.screen.height,
      getOption('mapZoom'),
      this.map.tilewidth,
      this.map.tileheight,
    );
    this.cameraBounds = cameraBoundsCalculate(
      this.viewportTiles.widthTiles,
      this.viewportTiles.heightTiles,
      this.map.width,
      this.map.height,
    );
  }

  private panCamera(dragDeltaX: number, dragDeltaY: number): void {
    if (!this.app || !this.map) return;

    const zoom = getOption('mapZoom');
    const { widthTiles: viewportWidthTiles, heightTiles: viewportHeightTiles } =
      this.viewportTiles;

    // Anchor only on the first off-center move of this gesture; later deltas accumulate against the same frozen anchor.
    if (!this.frozenCameraBase) {
      const location = this.visualPosition;
      this.frozenCameraBase = cameraPositionCalculate(
        location.x,
        location.y,
        viewportWidthTiles,
        viewportHeightTiles,
        this.cameraBounds,
      );
    }

    // Tile size must include zoom, since drag deltas are screen pixels but offset is unscaled tile units.
    this.cameraOffset.set(
      cameraOffsetFromDrag(
        this.cameraOffset(),
        dragDeltaX,
        dragDeltaY,
        this.map.tilewidth * zoom,
        this.map.tileheight * zoom,
        this.frozenCameraBase,
        this.cameraBounds,
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

    const location = currentLocationGet();
    const travel = gamestate().world.travel;
    const inFlightStep =
      travel.status === 'Traveling' ? travel.path[0] : undefined;

    const glide = travelGlideAdvance(
      {
        visual: this.visualPosition,
        stepOrigin: this.stepOriginTile,
        stepDestination: this.stepDestinationTile,
        stepStartTime: this.stepStartTime,
        stepDurationMs: this.stepDurationMs,
        hasActiveStep: this.hasActiveStep,
      },
      location,
      inFlightStep,
      performance.now(),
      getOption('debugTickMultiplier'),
    );

    this.visualPosition = glide.visual;
    this.stepOriginTile = glide.stepOrigin;
    this.stepDestinationTile = glide.stepDestination;
    this.stepStartTime = glide.stepStartTime;
    this.stepDurationMs = glide.stepDurationMs;
    this.hasActiveStep = glide.hasActiveStep;
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
    const { widthTiles: viewportWidthTiles, heightTiles: viewportHeightTiles } =
      this.viewportTiles;
    const bounds = this.cameraBounds;
    const offset = this.cameraOffset();

    // Stay anchored at `frozenCameraBase` while panned, so party movement doesn't drag the view.
    const base =
      this.frozenCameraBase ??
      cameraPositionCalculate(
        location.x,
        location.y,
        viewportWidthTiles,
        viewportHeightTiles,
        bounds,
      );

    // Reclamped (not trusting `offset` alone) to cover a resize while panned shifting the bounds.
    const camera = {
      x: clamp(base.x + offset.x, bounds.minX, bounds.maxX),
      y: clamp(base.y + offset.y, bounds.minY, bounds.maxY),
    };

    // Offsets by half a tile so the tile center, not its top-left corner, lands at screen center.
    // (mapContainer itself moves opposite the camera, unlike the token containers below, which
    // stay screen-anchored at the party's own tile - so it's positioned directly, not via tileToScreenPosition.)
    this.mapContainer.position.set(
      Math.round(-camera.x * this.map.tilewidth - this.map.tilewidth / 2),
      Math.round(-camera.y * this.map.tileheight - this.map.tileheight / 2),
    );

    const tokenScreenPosition = tileToScreenPosition(
      location.x,
      location.y,
      camera,
      this.map.tilewidth,
      this.map.tileheight,
    );
    this.playerIndicatorContainer.position.set(
      tokenScreenPosition.x,
      tokenScreenPosition.y,
    );
    this.gatherProgressContainer.position.set(
      tokenScreenPosition.x,
      tokenScreenPosition.y,
    );
    this.encounterProgressContainer.position.set(
      tokenScreenPosition.x,
      tokenScreenPosition.y,
    );

    this.positionNodeSelectionIndicator(camera);
    // Cached for updateWorkerIndicators(), which runs right after this in
    // the ticker and needs the same camera to position N worker tokens.
    this.lastCamera = camera;
  }

  private positionNodeSelectionIndicator(camera: CameraPosition): void {
    if (!this.nodeSelectionIndicator || !this.map) return;

    const selected = selectedMapNode();
    this.nodeSelectionIndicator.visible = !!selected;
    if (!selected) return;

    const screenPosition = tileToScreenPosition(
      selected.x,
      selected.y,
      camera,
      this.map.tilewidth,
      this.map.tileheight,
    );
    this.nodeSelectionIndicator.position.set(screenPosition.x, screenPosition.y);
  }

  private async loadWorkerTokenTextures(workerId: WorkerId): Promise<Texture[]> {
    const worker = getEntry<WorkerContent>(workerId);
    if (!worker) return [];

    const frame =
      this.contentService.artAtlases()['worker']?.[
        `gameassets/worker/${worker.sprite}.png`
      ];
    if (!frame) return [];

    const workerSpritesheetUrl = this.contentService.toCacheBustURL(
      'art/spritesheets/worker.webp',
    );

    return pixiSpriteFrameTexturesLoad(workerSpritesheetUrl, frame, worker.frames);
  }

  // Diffs `workersTravelingTokens()` against the currently-rendered sprites, creating/destroying/repositioning as needed.
  private updateWorkerIndicators(): void {
    if (!this.workerIndicatorContainer || !this.map) return;

    const tokens = workersTravelingTokens().filter(
      (token) => token.mapName === this.loadedMapName,
    );
    const activeIds = new Set(tokens.map((token) => token.workerId));

    for (const [workerId, token] of this.workerTokens) {
      if (activeIds.has(workerId)) continue;

      token.destroy({ children: true });
      this.workerTokens.delete(workerId);
      this.workerGlideStates.delete(workerId);
    }

    const now = performance.now();
    const speedMultiplier = getOption('debugTickMultiplier');

    tokens.forEach((token) => {
      const workerLocation = gamestate().workers[token.workerId]?.location;
      if (!workerLocation) return;

      if (
        !this.workerTokens.has(token.workerId) &&
        !this.pendingWorkerTextureLoads.has(token.workerId)
      ) {
        this.createWorkerSprite(token.workerId, workerLocation);
      }

      const glide = this.workerGlideStates.get(token.workerId);
      const workerToken = this.workerTokens.get(token.workerId);
      if (!glide || !workerToken || !this.map) return;

      const inFlightStep = token.path[0];
      const nextGlide = travelGlideAdvance(
        glide,
        workerLocation,
        inFlightStep,
        now,
        speedMultiplier,
      );
      this.workerGlideStates.set(token.workerId, nextGlide);

      const screenPosition = tileToScreenPosition(
        nextGlide.visual.x,
        nextGlide.visual.y,
        this.lastCamera,
        this.map.tilewidth,
        this.map.tileheight,
      );
      workerToken.position.set(screenPosition.x, screenPosition.y);
    });
  }

  private createWorkerSprite(
    workerId: WorkerId,
    initialLocation: CurrentLocation,
  ): void {
    this.pendingWorkerTextureLoads.add(workerId);

    void this.resolveWorkerTokenTextures(workerId).then((textures) => {
      this.pendingWorkerTextureLoads.delete(workerId);

      // Worker/map state may have changed while textures were loading - re-check first.
      if (!this.workerIndicatorContainer || !this.map) return;
      if (this.workerTokens.has(workerId)) return;

      const sprite = pixiIndicatorPlayerSpriteCreate(
        this.map.tilewidth,
        textures,
      );
      // A per-worker container, positioned at the tile's screen corner, so the sprite/graphics
      // child's own centering offset (baked in by pixiIndicatorPlayerSpriteCreate) applies unmodified.
      const token = new Container();
      token.addChild(sprite);
      this.workerIndicatorContainer.addChild(token);
      this.workerTokens.set(workerId, token);
      this.workerGlideStates.set(
        workerId,
        defaultTravelGlideState(initialLocation),
      );
    });
  }

  private async resolveWorkerTokenTextures(
    workerId: WorkerId,
  ): Promise<Texture[]> {
    const cached = this.workerTokenTextures.get(workerId);
    if (cached) return cached;

    const textures = await this.loadWorkerTokenTextures(workerId);
    this.workerTokenTextures.set(workerId, textures);
    return textures;
  }

  private enqueueGatherVfx(event: GatherVfxEvent): void {
    const queue = this.pendingGatherVfxByNode.get(event.nodeName) ?? [];
    queue.push(event);
    this.pendingGatherVfxByNode.set(event.nodeName, queue);
    this.trimPendingGatherVfx();
  }

  // Drops the oldest event from the largest queue on overflow, so one runaway node can't starve the others.
  private trimPendingGatherVfx(): void {
    const queues = Array.from(this.pendingGatherVfxByNode.values());
    const total = sumBy(queues, (queue) => queue.length);
    if (total <= FLOATING_TEXT_MAX_PENDING) return;

    maxBy(queues, (queue) => queue.length)?.shift();
  }

  // Each node's queue is checked independently every frame - a busy/gated node never blocks another node's popups.
  private updateFloatingTexts(): void {
    if (!this.floatingTextContainer || !this.map) return;

    const now = performance.now();

    this.pendingGatherVfxByNode.forEach((queue, nodeName) => {
      if (queue.length === 0) return;
      if (this.activeFloatingTexts.length >= FLOATING_TEXT_MAX_ACTIVE) return;

      const lastSpawn = this.lastFloatingTextSpawnAtByNode.get(nodeName) ?? 0;
      if (now - lastSpawn < FLOATING_TEXT_STAGGER_MS) return;

      const event = queue.shift();
      if (event) this.spawnFloatingText(event, now);
    });

    const map = this.map;
    this.activeFloatingTexts = this.activeFloatingTexts.filter((entry) => {
      const node = worldNodeByName(entry.nodeName);
      // Recomputed live every frame, not cached from spawn time, so the popup tracks the node while the camera pans.
      const nodePosition = node
        ? tileToScreenPosition(
            node.x,
            node.y,
            this.lastCamera,
            map.tilewidth,
            map.tileheight,
          )
        : undefined;

      const alive =
        !!nodePosition && entry.update(now - entry.spawnedAt, nodePosition);
      if (!alive) entry.container.destroy({ children: true });
      return alive;
    });
  }

  private spawnFloatingText(event: GatherVfxEvent, now: number): void {
    const entry = worldNodeByName(event.nodeName);
    // Content data could reference a removed node, or the event's node could be on a different
    // map than the one currently loaded - either way, there's nowhere valid to draw it.
    if (!entry || entry.mapName !== this.loadedMapName) return;

    const textureKey = `${event.spritesheet}:${event.sprite}`;
    const texture = this.floatingTextIconTextures.get(textureKey);

    if (!texture) {
      this.queueFloatingTextTextureWait(event, textureKey);
      return;
    }

    this.lastFloatingTextSpawnAtByNode.set(event.nodeName, now);
    this.createFloatingText(event, texture, now);
  }

  // Parks the event until its icon texture resolves, rather than spawning without one - re-enqueued
  // onto the normal per-node queue afterward so it still goes through the stagger gate.
  private queueFloatingTextTextureWait(
    event: GatherVfxEvent,
    textureKey: string,
  ): void {
    const waiting = this.pendingFloatingTextTextureLoads.get(textureKey);
    if (waiting) {
      // Bounded independently of trimPendingGatherVfx's cap - this bucket sits outside
      // pendingGatherVfxByNode until the texture resolves, so it needs its own ceiling.
      if (waiting.length < FLOATING_TEXT_MAX_PENDING) waiting.push(event);
      return;
    }

    this.pendingFloatingTextTextureLoads.set(textureKey, [event]);

    void this.resolveFloatingTextTexture(event.spritesheet, event.sprite).then(
      (texture) => {
        const waitingEvents =
          this.pendingFloatingTextTextureLoads.get(textureKey) ?? [];
        this.pendingFloatingTextTextureLoads.delete(textureKey);
        if (!texture) return;

        this.floatingTextIconTextures.set(textureKey, texture);
        waitingEvents.forEach((waitingEvent) =>
          this.enqueueGatherVfx(waitingEvent),
        );
      },
    );
  }

  private async resolveFloatingTextTexture(
    spritesheet: AtlasedImage,
    sprite: string,
  ): Promise<Texture | undefined> {
    const frame =
      this.contentService.artAtlases()[spritesheet]?.[
        `gameassets/${spritesheet}/${sprite}.png`
      ];
    if (!frame) return undefined;

    const url = this.contentService.toCacheBustURL(
      `art/spritesheets/${spritesheet}.webp`,
    );

    const textures = await pixiSpriteFrameTexturesLoad(url, frame, 1);
    return textures[0];
  }

  private createFloatingText(
    event: GatherVfxEvent,
    texture: Texture,
    now: number,
  ): void {
    if (!this.map || !this.floatingTextContainer) return;

    const { container, update } = pixiFloatingTextCreate(
      event,
      texture,
      this.map.tilewidth,
    );

    this.floatingTextContainer.addChild(container);
    // Position is set on the first `updateFloatingTexts` pass right after this (not here) - see
    // that method's filter loop, which recomputes every active popup's node position each frame.
    this.activeFloatingTexts.push({
      container,
      update,
      spawnedAt: now,
      nodeName: event.nodeName,
    });
  }
}
