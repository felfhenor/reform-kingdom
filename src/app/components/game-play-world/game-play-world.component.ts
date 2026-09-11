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
import {
  PARTY_FORMATION_CATCHUP_MS,
  PARTY_FORMATION_FOLLOW_DELAY_MS,
  PARTY_FORMATION_HISTORY_MAX_AGE_MS,
  PARTY_FORMATION_JITTER_MAX_TILES,
  PARTY_FORMATION_JITTER_MIN_TILES,
} from '@helpers/config';
import { getEntry } from '@helpers/content/content';
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
} from '@helpers/pixi/pixi-app-setup.ui';
import {
  cameraBoundsCalculate,
  cameraOffsetFromDrag,
  cameraPositionCalculate,
  tileToScreenPosition,
  viewportTilesCalculate,
} from '@helpers/pixi/pixi-camera';
import { pixiFloatingTextCreate } from '@helpers/pixi/pixi-floating-text';
import { pixiGridOverlayCreate } from '@helpers/pixi/pixi-grid.ui';
import {
  pixiIndicatorEncounterProgressCreate,
  pixiIndicatorGatherProgressCreate,
  pixiIndicatorNodeSelectionCreate,
  pixiIndicatorNodeStatusUpdate,
  pixiIndicatorPlayerAtLocationCreate,
  pixiIndicatorPlayerSpriteCreate,
} from '@helpers/pixi/pixi-indicators';
import { pixiTiledMapRender } from '@helpers/pixi/pixi-map-render';
import {
  partyFollowerCatchUpPosition,
  partyFollowerCatchUpStart,
  partyFollowerFormationOffset,
  partyFollowerJitterPosition,
  partyPositionHistoryRecord,
  partyPositionHistorySample,
} from '@helpers/pixi/pixi-party-formation.ui';
import {
  pixiSpriteFrameTexturesLoad,
  pixiTiledMapTexturesLoad,
} from '@helpers/pixi/pixi-texture-loader';
import {
  defaultTravelGlideState,
  travelGlideAdvance,
} from '@helpers/pixi/pixi-travel-glide.ui';
import { gamestate } from '@helpers/state-game';
import { getOption } from '@helpers/state-options';
import { townWorkersTravelingTokens } from '@helpers/town/worker/town-worker-travel.ui';
import { workersTravelingTokens } from '@helpers/worker/worker-travel.ui';
import { currentLocationGet } from '@helpers/world';
import { worldNodeDiscoverIfCollectibleGateMet } from '@helpers/world-node/world-node-collectible-gate.ui';
import { worldNodeEncounterCount } from '@helpers/world-node/world-node-encounter';
import { worldNodeExploreRandomIsCompleted } from '@helpers/world-node/world-node-encounter.ui';
import { worldNodeInteractionKind } from '@helpers/world-node/world-node-status';
import { worldNodeLabelInfo } from '@helpers/world-node/world-node-status.ui';
import {
  isWorldNodeCollectibleGateMet,
  isWorldNodeVisible,
  worldNodeByName,
} from '@helpers/world-node/world-nodes';
import { worldNodeDiscoverIfHidden } from '@helpers/world-node/world-nodes.ui';
import { isPlayerAtLocation } from '@helpers/world.ui';
import type {
  AtlasedImage,
  CameraBounds,
  CameraPosition,
  CurrentLocation,
  GatherVfxEvent,
  GlobalEffectId,
  JobContent,
  PartyPositionSample,
  TiledMap,
  TiledObject,
  TravelGlideState,
  ViewportTiles,
  WorkerContent,
  WorkerId,
  WorldNodeLabelInfo,
  WorldNodeStatusInfo,
} from '@interfaces';
import { ContentService } from '@services/content.service';
import { clamp, maxBy, sumBy } from 'es-toolkit/compat';
import type { Application, Graphics, Text, Texture } from 'pixi.js';
import { Container } from 'pixi.js';
import type { Subscription } from 'rxjs';

const FADE_DURATION_MS = 300;
// Minimum time between two floating-text spawns at the same node, so simultaneous gathers stagger instead of stacking.
const FLOATING_TEXT_STAGGER_MS = 360;
const FLOATING_TEXT_MAX_ACTIVE = 24;
const FLOATING_TEXT_MAX_PENDING = 40;
// Countdown/visibility text only needs to read accurately within this window, not every tick.
const NODE_STATUS_UPDATE_INTERVAL_MS = 150;

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

  // Frozen anchor while panned, so party movement doesn't drag the panned view.
  private frozenCameraBase?: CameraPosition;

  // Refreshed only on resize/zoom/map-load, not every frame.
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
  private partyFollowerContainer?: Container;
  private partyFollowerTokens: Container[] = [];
  // Fixed per-follower tile offset (evenly spread by angle so followers can't overlap each other), re-rolled whenever tokens are (re)created.
  private followerOffsets: Array<{ x: number; y: number }> = [];
  // Buffer of the leader's own recent visual positions, so followers can render a delayed copy of its path.
  private partyPositionHistory: PartyPositionSample[] = [];
  // Set once the leader visually arrives, so a follower's converge-to-tile tween runs once rather than restarting every frame.
  private followerCatchUp: Array<
    { from: CurrentLocation; startTime: number } | undefined
  > = [];
  private followerRenderedPosition: CurrentLocation[] = [];
  private workerIndicatorContainer?: Container;
  private workerTokens = new Map<WorkerId, Container>();
  private workerGlideStates = new Map<WorkerId, TravelGlideState>();
  private workerTokenTextures = new Map<WorkerId, Texture[]>();
  private pendingWorkerTextureLoads = new Set<WorkerId>();
  // Keyed by "townId:workerId", not WorkerId alone, in case content ever reuses one across towns.
  private townWorkerTokens = new Map<string, Container>();
  private townWorkerGlideStates = new Map<string, TravelGlideState>();
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
  private nodeStatusIcons?: Map<string, Graphics>;
  private floatingTextContainer?: Container;
  // Keyed per node (not one global FIFO) so a busy node's stagger gate can't head-of-line-block another node's popups.
  private pendingGatherVfxByNode = new Map<string, GatherVfxEvent[]>();
  private lastFloatingTextSpawnAtByNode = new Map<string, number>();
  private lastNodeStatusUpdateAt = 0;
  private activeFloatingTexts: Array<{
    container: Container;
    update: (
      elapsedMs: number,
      nodePosition: { x: number; y: number },
    ) => boolean;
    spawnedAt: number;
    nodeName: string;
  }> = [];
  // Icon textures persist across map transitions.
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

  // Rendered position, eased toward the tick-driven `currentLocation` rather than snapping to it.
  private visualPosition: CurrentLocation = { mapName: '', x: 0, y: 0 };

  // Endpoints/schedule of the step currently being glided toward, captured once so pace stays constant.
  private stepOriginTile: CurrentLocation = { mapName: '', x: 0, y: 0 };
  private stepDestinationTile: CurrentLocation = { mapName: '', x: 0, y: 0 };
  private stepStartTime = performance.now();
  private stepDurationMs = 0;
  private hasActiveStep = false;

  // Driven by visual arrival, not the tick-layer `currentLocation`, so the walking token stays visible for the full glide.
  private isShowingAtLocationIndicator = false;
  // Indexed by party slot (0 = leader); persists across map transitions like other loaded textures.
  private partyTokenTexturesByIndex: Texture[][] = [];
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

    // `untracked` avoids self-retrigger.
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
    // `untracked` avoids self-retrigger.
    let isFirstRecenterCheck = true;
    effect(() => {
      worldCameraRecenterRequest();
      if (isFirstRecenterCheck) {
        isFirstRecenterCheck = false;
        return;
      }
      untracked(() => this.recenterCamera());
    });

    // Subscribed once so it survives map transitions; queued events are dropped
    // when their node isn't on the currently loaded map.
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

  // Deaths Door recall teleports instantly, so this snaps the token to avoid a visible walk-back.
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
    // Cleared so followers don't walk back from their pre-teleport trail positions.
    this.partyPositionHistory = [];
    this.followerCatchUp = [];
    this.followerRenderedPosition = [];
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
    // Same reasoning - an AnimatedSprite stays registered on Ticker.shared until destroyed, so
    // removeChildren() alone would leave every follower token ticking forever after teardown.
    this.partyFollowerTokens.forEach((token) => token.destroy({ children: true }));
    this.app?.destroy(true, { children: true, texture: true });

    // Queued/active floating text is map-scoped (positions reference nodes on the map being torn down) -
    // the icon texture cache is not, and persists below.
    this.pendingGatherVfxByNode.clear();
    this.lastFloatingTextSpawnAtByNode.clear();
    this.lastNodeStatusUpdateAt = 0;
    this.pendingFloatingTextTextureLoads.clear();
    this.activeFloatingTexts = [];

    this.app = undefined;
    this.map = undefined;
    this.mapContainer = undefined;
    this.gridOverlay = undefined;
    this.playerIndicatorContainer = undefined;
    this.partyFollowerContainer = undefined;
    this.workerIndicatorContainer = undefined;
    // Tokens/glide state are per-app-instance; loaded textures persist across map transitions.
    this.partyFollowerTokens = [];
    this.followerOffsets = [];
    this.partyPositionHistory = [];
    this.followerCatchUp = [];
    this.followerRenderedPosition = [];
    this.workerTokens.clear();
    this.workerGlideStates.clear();
    this.townWorkerTokens.clear();
    this.townWorkerGlideStates.clear();
    this.gatherProgressContainer = undefined;
    this.gatherProgressBar = undefined;
    this.encounterProgressContainer = undefined;
    this.encounterProgressBar = undefined;
    this.nodeSelectionContainer = undefined;
    this.nodeSelectionIndicator = undefined;
    this.nodeLabels = undefined;
    this.nodeWrappers = undefined;
    this.nodeStatusIcons = undefined;
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
    this.partyFollowerContainer = containers.partyFollowerContainer;
    this.workerIndicatorContainer = containers.workerIndicatorContainer;
    this.gatherProgressContainer = containers.gatherProgressContainer;
    this.encounterProgressContainer = containers.encounterProgressContainer;
    this.nodeSelectionContainer = containers.nodeSelectionContainer;
    this.floatingTextContainer = containers.floatingTextContainer;

    // Clicking empty map deselects the node. `dragMoved` distinguishes a pan-drag's pointertap from an actual deselect click.
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
      this.app.renderer,
      map,
      textures,
      (object) => this.onNodeClick(object),
      (object) => this.resolveNodeLabel(object),
      (object) => this.resolveNodeStatus(object),
    );
    this.mapContainer.addChild(renderedMap.container);
    this.nodeLabels = renderedMap.nodeLabels;
    this.nodeWrappers = renderedMap.nodeWrappers;
    this.nodeStatusIcons = renderedMap.nodeStatusIcons;
    this.updateNodeLabels();
    this.updateNodeWrapperVisibility();
    this.updateNodeStatusIcons();

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

    if (this.partyTokenTexturesByIndex.length === 0) {
      this.partyTokenTexturesByIndex = await Promise.all(
        partyGet().map((_, index) => this.loadPartyTokenTextures(index)),
      );
    }

    this.isShowingAtLocationIndicator = isPlayerAtLocation();
    this.setupPlayerIndicator();

    this.visualPositionTicker = () => {
      this.checkForMapChange(currentLocationGet().mapName);
      this.checkForDeathsDoorRecall();
      this.updateVisualPosition();
      // Ahead of updatePlayerIndicatorIfNeeded() so a fresh arrival's catch-up state exists the same frame the indicator-swap check reads it.
      this.advancePartyFollowerPositions();
      this.updatePlayerIndicatorIfNeeded();
      this.updateGatherProgressIndicator();
      this.updateEncounterProgressIndicator();
      this.maybeUpdateNodeStatus(performance.now());
      this.positionCamera();
      this.renderPartyFollowerIndicators();
      this.updateWorkerIndicators();
      this.updateTownWorkerIndicators();
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

  private maybeUpdateNodeStatus(now: number): void {
    if (now - this.lastNodeStatusUpdateAt < NODE_STATUS_UPDATE_INTERVAL_MS)
      return;
    this.lastNodeStatusUpdateAt = now;
    this.updateNodeLabels();
    this.updateNodeWrapperVisibility();
    this.updateNodeStatusIcons();
  }

  // Throttled; a collectible pickup doesn't trigger a map rebuild so this still needs to poll.
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

  // Only ExploreRandomNode has a per-cycle beaten/not-beaten state worth badging on the map.
  private resolveNodeStatus(
    object: TiledObject,
  ): WorldNodeStatusInfo | undefined {
    const entry = worldNodeByName(object.name);
    if (!entry || worldNodeInteractionKind(entry) !== 'ExploreRandom')
      return undefined;

    return { beaten: worldNodeExploreRandomIsCompleted(entry) };
  }

  // Catches countdown text and hidden-node discovery updates.
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

  // Hidden alongside the label until discovered, so an un-found node can't leak its cycle state.
  private updateNodeStatusIcons(): void {
    if (!this.nodeStatusIcons) return;

    this.nodeStatusIcons.forEach((icon, nodeName) => {
      const entry = worldNodeByName(nodeName);
      if (!entry) return;

      const visible = isWorldNodeVisible(entry);
      icon.visible = visible;
      if (!visible) return;

      pixiIndicatorNodeStatusUpdate(
        icon,
        worldNodeExploreRandomIsCompleted(entry),
      );
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

  private async loadPartyTokenTextures(heroIndex: number): Promise<Texture[]> {
    const hero = partyGet()[heroIndex];
    if (!hero) return [];

    const job = getEntry<JobContent>(hero.jobId);
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
      this.setupPartyFollowerIndicators();
      return;
    }

    const sprite = pixiIndicatorPlayerSpriteCreate(
      this.map.tilewidth,
      this.partyTokenTexturesByIndex[0] ?? [],
    );
    this.playerIndicatorContainer.addChild(sprite);
    this.setupPartyFollowerIndicators();
  }

  // Trailing party members (slot 1+) are hidden, like the leader, whenever the party is parked at a node.
  private setupPartyFollowerIndicators(): void {
    if (!this.partyFollowerContainer || !this.map) return;

    // Destroyed, not just detached - an AnimatedSprite stays registered on Ticker.shared until destroyed.
    this.partyFollowerTokens.forEach((token) => token.destroy({ children: true }));
    this.partyFollowerContainer.removeChildren();
    this.partyFollowerTokens = [];
    this.followerOffsets = [];

    if (this.isShowingAtLocationIndicator) return;

    const followerCount = Math.max(partyGet().length - 1, 0);
    for (let index = 1; index <= followerCount; index++) {
      const sprite = pixiIndicatorPlayerSpriteCreate(
        this.map.tilewidth,
        this.partyTokenTexturesByIndex[index] ?? [],
      );
      // A per-follower container, positioned at the tile's screen corner like worker tokens, so the
      // sprite's own centering offset applies unmodified.
      const token = new Container();
      token.addChild(sprite);
      this.partyFollowerContainer.addChild(token);
      this.partyFollowerTokens.push(token);
      this.followerOffsets.push(
        partyFollowerFormationOffset(
          this.followerOffsets.length,
          followerCount,
          PARTY_FORMATION_JITTER_MIN_TILES,
          PARTY_FORMATION_JITTER_MAX_TILES,
        ),
      );
    }
  }

  // Pure state advance - screen placement happens later, in renderPartyFollowerIndicators().
  private advancePartyFollowerPositions(): void {
    const followerCount = this.partyFollowerTokens.length;
    if (followerCount === 0) return;

    const now = performance.now();
    this.partyPositionHistory = partyPositionHistoryRecord(
      this.partyPositionHistory,
      this.visualPosition,
      now,
      PARTY_FORMATION_HISTORY_MAX_AGE_MS,
    );

    const leaderArrived = this.isVisuallyAtTarget();

    for (let index = 0; index < followerCount; index++) {
      const offset = this.followerOffsets[index] ?? { x: 0, y: 0 };

      if (!leaderArrived) {
        this.followerCatchUp[index] = undefined;
        const sampled =
          partyPositionHistorySample(
            this.partyPositionHistory,
            now,
            (index + 1) * PARTY_FORMATION_FOLLOW_DELAY_MS,
          ) ?? this.visualPosition;
        this.followerRenderedPosition[index] = partyFollowerJitterPosition(
          sampled,
          offset,
        );
        continue;
      }

      const target = partyFollowerJitterPosition(this.visualPosition, offset);
      const catchUp =
        this.followerCatchUp[index] ??
        partyFollowerCatchUpStart(
          this.followerRenderedPosition[index] ?? target,
          target,
          now,
          PARTY_FORMATION_CATCHUP_MS,
        );
      this.followerCatchUp[index] = catchUp;
      this.followerRenderedPosition[index] = partyFollowerCatchUpPosition(
        catchUp.from,
        target,
        catchUp.startTime,
        PARTY_FORMATION_CATCHUP_MS,
        now,
      );
    }
  }

  // Gates the "at location" swap so followers converge before it fires, instead of popping mid-walk.
  private arePartyFollowersSettled(): boolean {
    const now = performance.now();
    return this.followerCatchUp.every(
      (catchUp) =>
        !catchUp || now - catchUp.startTime >= PARTY_FORMATION_CATCHUP_MS,
    );
  }

  private renderPartyFollowerIndicators(): void {
    if (!this.partyFollowerContainer || !this.map) return;
    const map = this.map;

    this.partyFollowerTokens.forEach((token, index) => {
      const position = this.followerRenderedPosition[index];
      if (!position) return;

      const screenPosition = tileToScreenPosition(
        position.x,
        position.y,
        this.lastCamera,
        map.tilewidth,
        map.tileheight,
      );
      token.position.set(screenPosition.x, screenPosition.y);
    });
  }

  // Use for anything gated on visible, not just logical, arrival.
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
      this.isVisuallyAtTarget() &&
      isPlayerAtLocation() &&
      this.arePartyFollowersSettled();
    if (shouldShowAtLocation === this.isShowingAtLocationIndicator) return;

    this.isShowingAtLocationIndicator = shouldShowAtLocation;
    this.setupPlayerIndicator();
  }

  // Gated on visual arrival, so the bar doesn't pop in while the token is still mid-glide.
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
  // Map changes are handled separately (with a fade), so a mismatched map name here just snaps.
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

    // Stay anchored while panned, so party movement doesn't drag the view.
    const base =
      this.frozenCameraBase ??
      cameraPositionCalculate(
        location.x,
        location.y,
        viewportWidthTiles,
        viewportHeightTiles,
        bounds,
      );

    // Reclamped to cover a resize while panned shifting the bounds.
    const camera = {
      x: clamp(base.x + offset.x, bounds.minX, bounds.maxX),
      y: clamp(base.y + offset.y, bounds.minY, bounds.maxY),
    };

    // Offsets by half a tile so the tile center, not its top-left corner, lands at screen center.
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
    this.nodeSelectionIndicator.position.set(
      screenPosition.x,
      screenPosition.y,
    );
  }

  private async loadWorkerTokenTextures(
    workerId: WorkerId,
  ): Promise<Texture[]> {
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

    return pixiSpriteFrameTexturesLoad(
      workerSpritesheetUrl,
      frame,
      worker.frames,
    );
  }

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
      // child's own centering offset applies unmodified.
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

  private updateTownWorkerIndicators(): void {
    if (!this.workerIndicatorContainer || !this.map) return;

    const tokens = townWorkersTravelingTokens().filter(
      (token) => token.mapName === this.loadedMapName,
    );
    const activeKeys = new Set(
      tokens.map((token) => `${token.townId}:${token.workerId}`),
    );

    for (const [key, token] of this.townWorkerTokens) {
      if (activeKeys.has(key)) continue;

      token.destroy({ children: true });
      this.townWorkerTokens.delete(key);
      this.townWorkerGlideStates.delete(key);
    }

    const now = performance.now();
    const speedMultiplier = getOption('debugTickMultiplier');

    tokens.forEach((token) => {
      const key = `${token.townId}:${token.workerId}`;
      const workerLocation =
        gamestate().world.towns[token.townId]?.workers[token.workerId]
          ?.location;
      if (!workerLocation) return;

      if (
        !this.townWorkerTokens.has(key) &&
        !this.pendingWorkerTextureLoads.has(token.workerId)
      ) {
        this.createTownWorkerSprite(key, token.workerId, workerLocation);
      }

      const glide = this.townWorkerGlideStates.get(key);
      const workerToken = this.townWorkerTokens.get(key);
      if (!glide || !workerToken || !this.map) return;

      const inFlightStep = token.path[0];
      const nextGlide = travelGlideAdvance(
        glide,
        workerLocation,
        inFlightStep,
        now,
        speedMultiplier,
      );
      this.townWorkerGlideStates.set(key, nextGlide);

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

  private createTownWorkerSprite(
    key: string,
    workerId: WorkerId,
    initialLocation: CurrentLocation,
  ): void {
    this.pendingWorkerTextureLoads.add(workerId);

    void this.resolveWorkerTokenTextures(workerId).then((textures) => {
      this.pendingWorkerTextureLoads.delete(workerId);

      // Worker/map state may have changed while textures were loading - re-check first.
      if (!this.workerIndicatorContainer || !this.map) return;
      if (this.townWorkerTokens.has(key)) return;

      const sprite = pixiIndicatorPlayerSpriteCreate(
        this.map.tilewidth,
        textures,
      );
      const token = new Container();
      token.addChild(sprite);
      this.workerIndicatorContainer.addChild(token);
      this.townWorkerTokens.set(key, token);
      this.townWorkerGlideStates.set(
        key,
        defaultTravelGlideState(initialLocation),
      );
    });
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
    this.activeFloatingTexts.push({
      container,
      update,
      spawnedAt: now,
      nodeName: event.nodeName,
    });
  }
}
