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
import { GlobalEffectBarComponent } from '@components/global-effect-bar/global-effect-bar.component';
import { HeroStatusComponent } from '@components/hero-status/hero-status.component';
import { MapNodePanelComponent } from '@components/map-node-panel/map-node-panel.component';
import {
  cameraBoundsCalculate,
  cameraOffsetFromDrag,
  cameraPositionCalculate,
  currentLocationGet,
  gatheringProgressFraction,
  getEntry,
  getMap,
  getOption,
  isGathering,
  isGlobalEffectActive,
  isPlayerAtLocation,
  isWorldCameraPanned,
  mapNodeDeselect,
  mapNodeSelect,
  partyGet,
  pixiAppInitialize,
  pixiGridOverlayCreate,
  pixiIndicatorGatherProgressCreate,
  pixiIndicatorNodeSelectionCreate,
  pixiIndicatorPlayerAtLocationCreate,
  pixiIndicatorPlayerSpriteCreate,
  pixiResponsiveCanvasSetup,
  pixiSpriteFrameTexturesLoad,
  pixiTiledMapRender,
  pixiTiledMapTexturesLoad,
  pixiWorldContainersCreate,
  selectedMapNode,
  TICKS_PER_STEP_MOVE,
  worldCameraRecenterRequest,
  worldNodeByName,
} from '@helpers';
import type {
  CameraPosition,
  CurrentLocation,
  GlobalEffectId,
  JobContent,
  TiledMap,
  TiledObject,
} from '@interfaces';
import { ContentService } from '@services/content.service';
import { clamp } from 'es-toolkit/compat';
import type { Application, Container, Graphics, Texture } from 'pixi.js';

const JOB_SPRITESHEET_URL = 'art/spritesheets/job.webp';

// Matches the per-tile travel pace at 1x game speed (see
// `helpers/travel.ts`); scaled by the game speed option below so the visual
// glide keeps pace with how fast the party is actually moving.
const BASE_TILES_PER_SECOND = 1 / TICKS_PER_STEP_MOVE;
const FADE_DURATION_MS = 300;

@Component({
  selector: 'app-game-play-world',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MapNodePanelComponent, GlobalEffectBarComponent, HeroStatusComponent],
  template: `
    <div #pixiContainer class="h-full w-full"></div>
    <div class="fade-overlay" [class.visible]="fadeVisible()"></div>
    <div class="death-overlay" [class.visible]="isPartyDead()"></div>
    <app-global-effect-bar class="global-effect-bar"></app-global-effect-bar>
    <app-map-node-panel></app-map-node-panel>

    <app-hero-status class="hero-status-layer"></app-hero-status>
  `,
  styleUrl: './game-play-world.component.scss',
})
export class GamePlayWorldComponent implements OnDestroy {
  private contentService = inject(ContentService);

  private pixiContainer =
    viewChild<ElementRef<HTMLDivElement>>('pixiContainer');

  private cameraOffset = signal<CameraPosition>({ x: 0, y: 0 });

  public fadeVisible = signal<boolean>(false);

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
  // source of truth) so game logic never has to reason about fractional
  // tile positions.
  private visualPosition: CurrentLocation = { mapName: '', x: 0, y: 0 };
  private lastVisualFrameTime = performance.now();

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

    if (!isFirstLoad) {
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
    this.resizeObserver = undefined;
    this.canvas = undefined;
  }

  private async initPixi(map: TiledMap): Promise<void> {
    const element = this.pixiContainer()?.nativeElement;
    if (!element) return;

    this.map = map;
    this.visualPosition = { ...currentLocationGet() };
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

    this.gatherProgressBar = pixiIndicatorGatherProgressCreate(map.tilewidth);
    this.gatherProgressContainer.addChild(this.gatherProgressBar.container);

    if (this.partyTokenTextures.length === 0) {
      this.partyTokenTextures = await this.loadPartyTokenTextures();
    }

    this.isShowingAtLocationIndicator = isPlayerAtLocation();
    this.setupPlayerIndicator();

    this.lastVisualFrameTime = performance.now();
    this.visualPositionTicker = () => {
      this.checkForMapChange(currentLocationGet().mapName);
      this.checkForDeathsDoorRecall();
      this.updateVisualPosition();
      this.updatePlayerIndicatorIfNeeded();
      this.updateGatherProgressIndicator();
      this.positionCamera();
    };
    this.app.ticker.add(this.visualPositionTicker);

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
    const shouldShowAtLocation = this.isVisuallyAtTarget() && isPlayerAtLocation();
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
  // `currentLocation` at a fixed real-world pace (scaled by game speed)
  // instead of snapping - see the field doc on `visualPosition`. A map
  // change is handled separately (with a fade) by `transitionToMap`, so a
  // mismatched map name here just snaps rather than gliding across maps.
  private updateVisualPosition(): void {
    if (!this.map) return;

    const now = performance.now();
    const deltaSeconds = (now - this.lastVisualFrameTime) / 1000;
    this.lastVisualFrameTime = now;

    const target = currentLocationGet();
    if (target.mapName !== this.visualPosition.mapName) {
      this.visualPosition = { ...target };
      return;
    }

    const dx = target.x - this.visualPosition.x;
    const dy = target.y - this.visualPosition.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) return;

    const speedMultiplier = getOption('debugTickMultiplier');
    const maxStep = BASE_TILES_PER_SECOND * speedMultiplier * deltaSeconds;

    if (distance <= maxStep) {
      this.visualPosition.x = target.x;
      this.visualPosition.y = target.y;
      return;
    }

    const ratio = maxStep / distance;
    this.visualPosition.x += dx * ratio;
    this.visualPosition.y += dy * ratio;
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
