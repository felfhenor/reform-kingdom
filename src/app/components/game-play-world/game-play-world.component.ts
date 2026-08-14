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
import { StatusHeroComponent } from '@components/status-hero/status-hero.component';
import { PanelMapNodeComponent } from '@components/panel-map-node/panel-map-node.component';
import { getEntry } from '@helpers/content';
import { gatheringProgressFraction, isGathering } from '@helpers/gathering';
import { isGlobalEffectActive } from '@helpers/global-effects';
import { getMap } from '@helpers/maps';
import { partyGet } from '@helpers/party';
import {
  pixiAppInitialize,
  pixiResponsiveCanvasSetup,
  pixiWorldContainersCreate,
} from '@helpers/pixi-app-setup';
import {
  cameraBoundsCalculate,
  cameraOffsetFromDrag,
  cameraPositionCalculate,
} from '@helpers/pixi-camera';
import { pixiGridOverlayCreate } from '@helpers/pixi-grid';
import {
  pixiIndicatorGatherProgressCreate,
  pixiIndicatorNodeSelectionCreate,
  pixiIndicatorPlayerAtLocationCreate,
  pixiIndicatorPlayerSpriteCreate,
} from '@helpers/pixi-indicators';
import { pixiTiledMapRender } from '@helpers/pixi-map-render';
import {
  pixiSpriteFrameTexturesLoad,
  pixiTiledMapTexturesLoad,
} from '@helpers/pixi-texture-loader';
import { gamestate } from '@helpers/state-game';
import { getOption } from '@helpers/state-options';
import { travelStepTicksCost } from '@helpers/travel';
import {
  isWorldCameraPanned,
  mapNodeDeselect,
  mapNodeSelect,
  selectedMapNode,
  worldCameraRecenterRequest,
} from '@helpers/ui';
import { currentLocationGet, isPlayerAtLocation } from '@helpers/world';
import { worldNodeLabelInfo } from '@helpers/world-node-status';
import {
  isWorldNodeVisible,
  worldNodeByName,
  worldNodeDiscoverIfHidden,
} from '@helpers/world-nodes';
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

const JOB_SPRITESHEET_URL = 'art/spritesheets/job.webp';

const FADE_DURATION_MS = 300;

@Component({
  selector: 'app-game-play-world',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PanelMapNodeComponent,
    BarGlobalEffectComponent,
    StatusHeroComponent,
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

    <app-status-hero class="hero-status-layer"></app-status-hero>
  `,
  styleUrl: './game-play-world.component.scss',
})
export class GamePlayWorldComponent implements OnDestroy {
  private contentService = inject(ContentService);

  private pixiContainer =
    viewChild<ElementRef<HTMLDivElement>>('pixiContainer');

  private cameraOffset = signal<CameraPosition>({ x: 0, y: 0 });

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

  // The rendered token/camera position, eased toward `currentLocation` in
  // real time rather than snapping to it - see `updateVisualPosition`. Kept
  // separate from `currentLocation` (which is the tick-driven, save-safe
  // source of truth, and only jumps once *every* tick of a step has
  // resolved) so game logic never has to reason about fractional tile
  // positions.
  private visualPosition: CurrentLocation = { mapName: '', x: 0, y: 0 };

  // The endpoints and real-time schedule of whichever travel step is
  // currently being glided toward - captured once when that step first
  // becomes current (see `updateVisualPosition`), not recomputed per frame,
  // so the glide's pace stays constant for the step's whole duration instead
  // of drifting as `visualPosition` moves. `stepOriginTile` starts from
  // wherever `visualPosition` already was (not the tick-driven origin tile)
  // so a step-to-step handoff never causes a visible snap.
  private stepOriginTile: CurrentLocation = { mapName: '', x: 0, y: 0 };
  private stepDestinationTile: CurrentLocation = { mapName: '', x: 0, y: 0 };
  private stepStartTime = performance.now();
  private stepDurationMs = 0;
  private hasActiveStep = false;

  // Tracks whether the party was mid-glide as of the last frame, so
  // `updateVisualPosition` can tell a fresh departure (stationary -> moving)
  // apart from an ongoing glide - a panned camera only needs recentering at
  // the moment travel starts, not on every step-to-step handoff within it.
  private wasMoving = false;

  // Whether the "at location" indicator (rather than the walking token) is
  // currently shown - driven by visual arrival (see `updatePlayerIndicator`),
  // not the instant `currentLocation` ticks over, so the walking token stays
  // visible for the full glide instead of swapping the moment the tile is
  // reached logically.
  private isShowingAtLocationIndicator = false;
  private partyTokenTextures: Texture[] = [];
  private isTransitioningMap = false;
  private wasPartyDead = false;

  constructor() {
    // Bootstraps the very first map load - this fires reliably since it's
    // the component's initial synchronous effect run. Further map changes
    // (driven by the gameloop's background ticking, not a user-triggered
    // Angular event) aren't guaranteed to wake the zoneless effect scheduler
    // promptly, so `checkForMapChange` below re-checks every render frame
    // via the Pixi ticker instead, independent of Angular's CD entirely.
    effect(() => {
      const mapName = currentLocationGet().mapName;
      this.checkForMapChange(mapName);
    });

    effect(() => {
      const showBackdropGrid = getOption('showBackdropGrid');
      if (this.gridOverlay) this.gridOverlay.visible = showBackdropGrid;
    });

    effect(() => {
      isWorldCameraPanned.set(this.isPanned());
    });

    // The recenter button lives in the navbar (so it can sit beside the
    // pause button), but the camera offset it resets is owned here - this
    // effect is the bridge between the navbar's click and this component's
    // state. Skipped on the initial run so mounting the component doesn't
    // itself count as a recenter request. The call is wrapped in `untracked`
    // because `recenterCamera` transitively reads `cameraOffset` (via
    // `positionCamera`) - without it, that read would register as a
    // dependency of this same effect, so any later drag (which also writes
    // `cameraOffset`) would re-trigger it and immediately snap the camera
    // back to center again.
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

  // Deaths Door expiring recalls the party to the kingdom with an instant
  // teleport (see `handleDeathsDoorExpiry`) - they never walk there. When
  // that also changes the loaded map, `checkForMapChange` already covers it
  // with its own fade. But if the party died on the kingdom's own map,
  // there's no map-name change for it to catch, so `updateVisualPosition`
  // would otherwise glide the token from the death spot back to the
  // recall point - a visible "walk back". This snaps `visualPosition`
  // straight to the target behind a plain CSS fade (no Pixi teardown, so
  // no re-triggering texture loads) to mask the jump.
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
    this.nodeSelectionContainer?.removeChildren();
    this.app?.destroy(true, { children: true, texture: true });

    this.app = undefined;
    this.map = undefined;
    this.mapContainer = undefined;
    this.gridOverlay = undefined;
    this.playerIndicatorContainer = undefined;
    this.gatherProgressContainer = undefined;
    this.gatherProgressBar = undefined;
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

    const containers = pixiWorldContainersCreate(this.app);
    this.mapContainer = containers.mapContainer;
    this.playerIndicatorContainer = containers.playerIndicatorContainer;
    this.gatherProgressContainer = containers.gatherProgressContainer;
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

  // Every node's label is created up front (see `pixi-map-render.ts`) but
  // starts invisible with no pointer cursor, so this is what actually shows
  // it - run once right after the map renders, then every tick thereafter.
  // The per-tick refresh covers two live-changing cases: an `ExploreRandomNode`'s
  // countdown text (ticks every second) and a hidden node's visibility/cursor
  // flipping the instant it's clicked-discovered, without needing a full map
  // re-render. PixiJS's `Text.text`/`visible`/`cursor` setters are no-ops
  // when the value is unchanged, so recomputing every frame for values that
  // rarely change is cheap and needs no manual throttling - same pattern as
  // `updateGatherProgressIndicator`.
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

    const location = this.visualPosition;
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

    return pixiSpriteFrameTexturesLoad(JOB_SPRITESHEET_URL, frame, job.frames);
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

  // True once the eased `visualPosition` has actually caught up to the
  // tick-driven `currentLocation` - the two fall out of sync for the
  // duration of a glide (see `visualPosition`'s field doc), so anything that
  // should only happen once the party has visibly, not just logically,
  // arrived at a tile needs to check this rather than `isPlayerAtLocation()`
  // alone.
  private isVisuallyAtTarget(): boolean {
    const target = currentLocationGet();
    return (
      this.visualPosition.mapName === target.mapName &&
      Math.abs(this.visualPosition.x - target.x) < 0.001 &&
      Math.abs(this.visualPosition.y - target.y) < 0.001
    );
  }

  // The walking token should stay visible for the entire glide, only
  // swapping to the "at location" indicator once the token has visually
  // (not just logically) arrived - otherwise it flips the instant the
  // destination tile is reached at the tick layer, well before the render
  // layer has finished easing into it.
  private updatePlayerIndicatorIfNeeded(): void {
    const shouldShowAtLocation =
      this.isVisuallyAtTarget() && isPlayerAtLocation();
    if (shouldShowAtLocation === this.isShowingAtLocationIndicator) return;

    this.isShowingAtLocationIndicator = shouldShowAtLocation;
    this.setupPlayerIndicator();
  }

  // The gather progress bar hovers above the party's tile while a gather
  // cycle is running, filling as `gatheringProcessTick` (see helpers/
  // gathering.ts) counts up toward the node's `gatherTime` - full means the
  // next item-chance roll is about to happen. Gated on visual arrival (not
  // just `isGathering()`) so it doesn't pop in while the token is still
  // mid-glide toward the node - gathering starts the instant the tick layer
  // resolves the final travel step, which can be well before the walk
  // animation has finished easing into the tile.
  private updateGatherProgressIndicator(): void {
    if (!this.gatherProgressBar) return;

    const active = isGathering() && this.isVisuallyAtTarget();
    this.gatherProgressBar.container.visible = active;
    if (active) this.gatherProgressBar.update(gatheringProgressFraction());
  }

  // Eases the rendered token position toward the tick-driven, authoritative
  // `currentLocation` instead of snapping - see the field doc on
  // `visualPosition`. Deliberately does *not* wait for a travel step to
  // fully resolve (i.e. for `currentLocation` to jump) before starting to
  // glide toward it: a step's ticks only resolve in a single lump once every
  // `travelStepTicksCost` ticks (see `helpers/travel.ts`), so gliding *after*
  // that jump instead of *during* it would mean the token sits fully still
  // for the whole tick-accumulation window and then glides - doubling the
  // real-world time per tile and, worse, making every path/off-path speed
  // change look like a dead stop. Instead, the moment a new step becomes
  // current (`travel.path[0]`), its real-time schedule is captured once (see
  // `stepOriginTile`/`stepDurationMs`) and the token eases toward it
  // continuously for that step's whole duration, landing on the destination
  // tile at (approximately) the same real moment the tick layer resolves it.
  // A map change is handled separately (with a fade) by `transitionToMap`,
  // so a mismatched map name here just snaps rather than gliding across maps.
  private updateVisualPosition(): void {
    if (!this.map) return;

    const now = performance.now();

    const location = currentLocationGet();
    if (location.mapName !== this.visualPosition.mapName) {
      this.visualPosition = { ...location };
      this.hasActiveStep = false;
      this.wasMoving = false;
      return;
    }

    const travel = gamestate().world.travel;
    const inFlightStep =
      travel.status === 'Traveling' ? travel.path[0] : undefined;

    // Idle, or an instant (0-tick) Teleport hop that's about to resolve in
    // the same tick it became current - nothing to glide toward, so settle
    // directly onto the authoritative tile.
    if (!inFlightStep || inFlightStep.kind === 'Teleport') {
      this.visualPosition = { ...location };
      this.hasActiveStep = false;
      this.wasMoving = false;
      return;
    }

    const destinationChanged =
      !this.hasActiveStep ||
      this.stepDestinationTile.mapName !== inFlightStep.mapName ||
      this.stepDestinationTile.x !== inFlightStep.x ||
      this.stepDestinationTile.y !== inFlightStep.y;

    if (destinationChanged) {
      // Only a genuine stationary -> moving transition (not a step-to-step
      // handoff within an ongoing glide) should recenter a panned camera.
      if (!this.hasActiveStep && this.isPanned()) {
        this.recenterCamera();
      }

      // Origin is wherever the token is *currently rendered* - not the
      // tick-driven `location` - so a handoff from one step to the next
      // never causes a visible snap even if the previous glide hadn't
      // pixel-perfectly finished yet.
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

    this.wasMoving = fraction < 1;
  }

  private positionCamera(): void {
    if (
      !this.app ||
      !this.mapContainer ||
      !this.playerIndicatorContainer ||
      !this.gatherProgressContainer ||
      !this.nodeSelectionContainer ||
      !this.map
    )
      return;

    const location = this.visualPosition;
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
    const offset = this.cameraOffset();

    // `offset` was clamped relative to `base` back when the drag happened
    // (see `panCamera`), but `base` shifts as the party moves - if the party
    // then walks toward the same edge the camera was already panned against,
    // the stale offset can push `base + offset` past the map edge. Reclamping
    // the combined position (rather than trusting the offset alone) keeps
    // the camera pinned at the edge exactly like a fresh pan would.
    const camera = {
      x: clamp(base.x + offset.x, bounds.minX, bounds.maxX),
      y: clamp(base.y + offset.y, bounds.minY, bounds.maxY),
    };

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

    this.gatherProgressContainer.position.set(
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
