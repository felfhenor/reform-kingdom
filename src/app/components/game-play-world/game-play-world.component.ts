import { FFFocusService } from '@ff/focus/ff-focus.service';
import { FFInputService } from '@ff/input/ff-input.service';
import { FF_DIRECTIONS } from '@ff/input/ff-action-map';
import type { FFDirection } from '@ff/interfaces/ff-input';
import { GAMEPAD_PRIORITY } from '@helpers/engine/gamepad.ui';
import { modalHasAnyOpen } from '@helpers/engine/modal-stack';
import type { OnDestroy } from '@angular/core';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { AdventureLogOverlayComponent } from '@components/adventure-log-overlay/adventure-log-overlay.component';
import { BarGlobalEffectComponent } from '@components/bar-global-effect/bar-global-effect.component';
import { CardRegionIntroComponent } from '@components/card-region-intro/card-region-intro.component';
import { PanelMapNodeComponent } from '@components/panel-map-node/panel-map-node.component';
import { StatusCraftingComponent } from '@components/status-crafting/status-crafting.component';
import { StatusEdictsComponent } from '@components/status-edicts/status-edicts.component';
import { StatusEncounterComponent } from '@components/status-encounter/status-encounter.component';
import { StatusTaskListComponent } from '@components/status-task-list/status-task-list.component';
import { StatusTutorialUnlockComponent } from '@components/status-tutorial-unlock/status-tutorial-unlock.component';
import { StatusWorkerLevelupComponent } from '@components/status-worker-levelup/status-worker-levelup.component';
import {
  MAP_CURSOR_MAX_FRAME_MS,
  MAP_CURSOR_REACH_TILES,
  MAP_CURSOR_SECRET_REACH_TILES,
  MAP_CURSOR_TILES_PER_SECOND,
  PARTY_FORMATION_CATCHUP_MS,
  PARTY_FORMATION_FOLLOW_DELAY_MS,
  PARTY_FORMATION_HISTORY_MAX_AGE_MS,
  PARTY_FORMATION_JITTER_MAX_TILES,
  PARTY_FORMATION_JITTER_MIN_TILES,
} from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { uiTextFontFamily, uiTextLetterSpacing } from '@helpers/engine/font.ui';
import { gatherVfx$ } from '@helpers/engine/gather-vfx';
import {
  gamePlayView,
  isWorldCameraPanned,
  kingdomSubview,
  mapNodeDeselect,
  mapNodeSelect,
  selectedMapNode,
  setGamePlayView,
  worldCameraRequest,
  worldMapReady,
} from '@helpers/engine/ui';
import { isGlobalEffectActive } from '@helpers/hero/global-effects';
import { travelStart } from '@helpers/hero/travel';
import { travelCanStartTo } from '@helpers/hero/travel.ui';
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
import { pixiBackdropShardsCreate } from '@helpers/pixi/pixi-backdrop-shards.ui';
import {
  cameraBoundsCalculate,
  cameraOffsetFromDrag,
  cameraPositionCalculate,
  tileToScreenPosition,
  viewportTilesCalculate,
} from '@helpers/pixi/pixi-camera';
import { pixiFloatingTextCreate } from '@helpers/pixi/pixi-floating-text';
import { pixiMapMaxFps } from '@helpers/pixi/pixi-frame-rate.ui';
import { pixiGridOverlayCreate } from '@helpers/pixi/pixi-grid.ui';
import {
  pixiIndicatorMapCursorCreate,
  pixiIndicatorNodeSelectionCreate,
  pixiIndicatorNodeStatusUpdate,
  pixiIndicatorPlayerAtLocationCreate,
  pixiIndicatorPlayerSpriteCreate,
  pixiIndicatorProgressBarCreate,
  pixiNodeLabelColor,
} from '@helpers/pixi/pixi-indicators';
import {
  mapCursorJump,
  mapCursorMove,
  mapCursorTarget,
} from '@helpers/pixi/pixi-map-cursor.ui';
import { pixiTiledMapRender } from '@helpers/pixi/pixi-map-render';
import { pixiNodeForgottenSet } from '@helpers/pixi/pixi-node-forgotten.ui';
import { pixiNodeRevealCreate } from '@helpers/pixi/pixi-node-reveal.ui';
import { pixiNodeAnimationsCreate } from '@helpers/pixi/pixi-node-animation.ui';
import { pixiNodeSparklesCreate } from '@helpers/pixi/pixi-node-sparkle.ui';
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
import {
  worldCombatState,
  worldCurrentLocationState,
  worldPartyState,
  worldTravelState,
} from '@helpers/state-game';
import { getOption } from '@helpers/state-options';
import { townWorkersTravelingTokens } from '@helpers/town/worker/town-worker-travel.ui';
import { workersTravelingTokens } from '@helpers/worker/worker-travel.ui';
import { worldNodeDiscoverIfCollectibleGateMet } from '@helpers/world-node/world-node-collectible-gate.ui';
import { worldNodeEncounterCount } from '@helpers/world-node/world-node-encounter';
import {
  worldNodeLabelInfo,
  worldNodeStatusInfo,
} from '@helpers/world-node/world-node-status.ui';
import {
  isWorldNodeCollectibleGateMet,
  isWorldNodeForgotten,
  isWorldNodeVisible,
  worldNodeByName,
} from '@helpers/world-node/world-nodes';
import { isWorldNodeUncleared } from '@helpers/world-node/world-node-uncleared';
import { worldNodeDiscoverIfHidden } from '@helpers/world-node/world-nodes.ui';
import { isPlayerAtLocation } from '@helpers/world.ui';
import type {
  AtlasedImage,
  BackdropUpdate,
  CameraBounds,
  CameraPosition,
  CurrentLocation,
  GatherVfxEvent,
  GlobalEffectId,
  HudZone,
  JobContent,
  PartyPositionSample,
  PixiNodeAnimationUpdate,
  TiledMap,
  TiledObject,
  TravelGlideState,
  ViewportTiles,
  WorkerContent,
  WorkerId,
  WorldNodeLabelInfo,
  WorldNodeStatusInfo,
  MapCursorNode,
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

const HUD_ZONES: HudZone[] = ['buffs', 'bubbles', 'tasks', 'panel'];
const HUD_ZONE_LABELS: Record<HudZone, string> = {
  buffs: 'Buffs',
  bubbles: 'Bubbles',
  tasks: 'Tasks',
  panel: 'Node',
};

@Component({
  selector: 'app-game-play-world',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AdventureLogOverlayComponent,
    CardRegionIntroComponent,
    PanelMapNodeComponent,
    BarGlobalEffectComponent,
    StatusEdictsComponent,
    StatusEncounterComponent,
    StatusCraftingComponent,
    StatusWorkerLevelupComponent,
    StatusTutorialUnlockComponent,
    StatusTaskListComponent,
  ],
  template: `
    <div #pixiContainer class="h-full w-full"></div>
    @if (isMapLoading()) {
      <div
        class="absolute inset-0 flex flex-col items-center justify-center gap-4 z-[15] bg-base-100"
      >
        <span
          class="loading loading-spinner loading-lg text-base-content"
        ></span>
        <p class="type-muted">Loading map...</p>
      </div>
    }
    <div class="fade-overlay" [class.fade-active]="fadeVisible()"></div>
    <div class="death-overlay" [class.death-active]="isPartyDead()"></div>
    <div #hudFrame class="hud-frame ui-scaled">
      <div
        class="absolute top-0 left-0 right-0 flex flex-col pointer-events-none z-[11]"
      >
        <div #buffsZone class="flex items-start">
          <app-status-edicts
            class="pointer-events-auto cursor-pointer"
            (click)="viewEdicts()"
          ></app-status-edicts>

          <app-bar-global-effect
            class="pointer-events-auto"
          ></app-bar-global-effect>
        </div>
        <!-- In flow under the effect bar, since the bar's height depends on whether any effects are active. -->
        <app-adventure-log-overlay
          class="ms-4 mr-2 mt-2 w-[32rem] max-w-[calc(100%-2rem)]"
        ></app-adventure-log-overlay>
      </div>
      <app-panel-map-node #panelZone></app-panel-map-node>

      <app-status-encounter
        class="encounter-status-layer"
      ></app-status-encounter>
      <div
        #bubblesZone
        class="absolute top-8 right-4 flex gap-2 pointer-events-auto z-[20]"
      >
        <app-status-worker-levelup></app-status-worker-levelup>
        <app-status-crafting></app-status-crafting>
        <app-status-tutorial-unlock></app-status-tutorial-unlock>
      </div>
      <app-status-task-list
        #tasksZone
        class="task-list-layer"
      ></app-status-task-list>
      @if (introMapName(); as mapName) {
        <app-card-region-intro class="region-intro-layer" [mapName]="mapName" />
      }
    </div>
  `,
  styleUrl: './game-play-world.component.scss',
})
export class GamePlayWorldComponent implements OnDestroy {
  private contentService = inject(ContentService);

  private pixiContainer =
    viewChild<ElementRef<HTMLDivElement>>('pixiContainer');
  private hudFrame = viewChild<ElementRef<HTMLDivElement>>('hudFrame');
  private buffsZone = viewChild<ElementRef<HTMLElement>>('buffsZone');
  private bubblesZone = viewChild<ElementRef<HTMLElement>>('bubblesZone');
  private tasksZone = viewChild<string, ElementRef<HTMLElement>>('tasksZone', {
    read: ElementRef,
  });
  private panelZone = viewChild<string, ElementRef<HTMLElement>>('panelZone', {
    read: ElementRef,
  });
  // Unset while the map cursor drives.
  private hudZone = signal<HudZone | undefined>(undefined);
  private hudMode = computed(() => !!this.hudZone());

  private cameraOffset = signal<CameraPosition>({ x: 0, y: 0 });

  // Frozen anchor while panned, so party movement doesn't drag the panned view.
  private frozenCameraBase?: CameraPosition;

  // Refreshed only on resize/zoom/map-load, not every frame.
  private viewportTiles: ViewportTiles = { widthTiles: 0, heightTiles: 0 };
  private cameraBounds: CameraBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

  public fadeVisible = signal<boolean>(false);
  public isMapLoading = signal<boolean>(true);
  public introMapName = signal<string | undefined>(undefined);
  private isDestroyed = false;

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
  private backdropUpdate?: BackdropUpdate;
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
  private workerTokens = new Map<string, Container>();
  private workerGlideStates = new Map<string, TravelGlideState>();
  private workerTokenTextures = new Map<WorkerId, Texture[]>();
  private pendingWorkerTextureLoads = new Set<WorkerId>();
  private travelingWorkerTokens = computed(() => [
    ...workersTravelingTokens(),
    ...townWorkersTravelingTokens(),
  ]);
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
  private readonly ffInput = inject(FFInputService);
  private readonly focus = inject(FFFocusService);
  // Controller cursor in tile coordinates; undefined until the pad drives the map.
  private mapCursor?: CameraPosition;
  private mapCursorAt?: MapCursorNode;
  private mapCursorIndicator?: Graphics;
  private mapCursorFrameAt = 0;
  private releaseLeftStick?: () => void;
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
  private activeNodeReveals: Array<{
    update: (elapsedMs: number) => boolean;
    spawnedAt: number;
  }> = [];
  // Made on a node's first uncleared check and only hidden after, since clearing is one-way.
  private nodeSparkles = new Map<
    string,
    { container: Container; update: (nowMs: number) => void }
  >();
  private nodeAnimations: PixiNodeAnimationUpdate[] = [];
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
  private partyGlide: TravelGlideState = defaultTravelGlideState({
    mapName: '',
    x: 0,
    y: 0,
  });

  // Driven by visual arrival, not the tick-layer `currentLocation`, so the walking token stays visible for the full glide.
  private isShowingAtLocationIndicator = false;
  // Indexed by party slot (0 = leader); persists across map transitions like other loaded textures.
  private partyTokenTexturesByIndex: Texture[][] = [];
  // Party job ids the cached textures were built from; a mismatch triggers a reload.
  private partyTokenJobKey: string | undefined;
  private isReloadingPartyTextures = false;
  private isTransitioningMap = false;
  private wasPartyDead = false;

  constructor() {
    // Bootstraps the first map load; later map changes are re-checked via the Pixi ticker instead (zoneless CD isn't guaranteed to wake for background ticks).
    effect(() => {
      const mapName = worldCurrentLocationState().mapName;
      this.checkForMapChange(mapName);
    });

    effect(() => {
      const maxFps = pixiMapMaxFps();
      if (this.app) this.app.ticker.maxFPS = maxFps;
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

    // Skips the initial run so a request left over from before mounting isn't replayed.
    // `untracked` avoids self-retrigger.
    let isFirstCameraRequestCheck = true;
    effect(() => {
      const request = worldCameraRequest();
      if (isFirstCameraRequestCheck) {
        isFirstCameraRequestCheck = false;
        return;
      }
      untracked(() =>
        request?.target
          ? this.focusCamera(request.target)
          : this.recenterOnParty(),
      );
    });

    const destroyRef = inject(DestroyRef);
    const focus = inject(FFFocusService);
    effect(() => {
      const leftMap =
        this.ffInput.mode() !== 'gamepad' || gamePlayView() !== 'world';
      if (leftMap) untracked(() => this.setHudZone(undefined));
    });
    afterNextRender(() => {
      const unregisters = [
        ...this.registerMapCursorActions(),
        ...this.registerHudActions(),
        // A zone emptied under focus (node closed, last task done) would otherwise strand the D-pad.
        this.ffInput.onRefresh(() => {
          const zone = this.hudZone();
          const element = zone ? this.hudZoneElement(zone) : undefined;
          if (element && !focus.hasLanding(element)) this.setHudZone(undefined);
        }),
        focus.registerScope(GAMEPAD_PRIORITY.page, () => {
          const zone = this.hudZone();
          return zone ? (this.hudZoneElement(zone) ?? null) : null;
        }),
        // Body, not the host, so pad actions outside the world view still pass the scope filter.
        focus.registerScope(
          GAMEPAD_PRIORITY.page,
          () =>
            gamePlayView() === 'world' && !this.hudMode()
              ? document.body
              : null,
          false,
        ),
      ];
      destroyRef.onDestroy(() => {
        unregisters.forEach((unregister) => unregister());
        this.releaseLeftStick?.();
      });
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

    const target = worldCurrentLocationState();
    if (target.mapName !== this.loadedMapName) return;

    this.isTransitioningMap = true;
    void this.snapVisualPositionTo(target).finally(() => {
      this.isTransitioningMap = false;
    });
  }

  private async snapVisualPositionTo(target: CurrentLocation): Promise<void> {
    await this.fadeOut();
    this.partyGlide = defaultTravelGlideState(target);
    // Cleared so followers don't walk back from their pre-teleport trail positions.
    this.partyPositionHistory = [];
    this.followerCatchUp = [];
    this.followerRenderedPosition = [];
    this.positionCamera();
    await this.fadeIn();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    worldMapReady.set(false);
    this.teardownPixi();
    this.gatherVfxSubscription?.unsubscribe();
  }

  private async transitionToMap(map: TiledMap, mapName: string): Promise<void> {
    const isFirstLoad = this.loadedMapName === undefined;
    worldMapReady.set(false);
    this.introMapName.set(undefined);

    if (!isFirstLoad) {
      await this.fadeOut();
      this.teardownPixi();
    }

    this.loadedMapName = mapName;
    this.cameraOffset.set({ x: 0, y: 0 });
    this.frozenCameraBase = undefined;

    await this.initPixi(map, mapName);

    if (isFirstLoad) {
      this.isMapLoading.set(false);
    } else {
      await this.fadeIn();
    }
    if (this.isDestroyed) return;

    worldMapReady.set(true);
    this.introMapName.set(mapName);
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
    this.mapCursorIndicator?.destroy();
    this.mapCursorIndicator = undefined;
    this.mapCursor = undefined;
    this.mapCursorAt = undefined;
    // Destroyed individually (not via removeChildren + app.destroy's cascade) - each Text's canvas
    // texture would otherwise leak, since app.destroy only cascades into children still attached to it.
    this.activeFloatingTexts.forEach((entry) =>
      entry.container.destroy({ children: true }),
    );
    // Same reasoning - an AnimatedSprite stays registered on Ticker.shared until destroyed, so
    // removeChildren() alone would leave every follower token ticking forever after teardown.
    this.partyFollowerTokens.forEach((token) =>
      token.destroy({ children: true }),
    );
    this.nodeSparkles.forEach((sparkles) =>
      sparkles.container.destroy({ children: true }),
    );
    this.app?.destroy(true, { children: true, texture: true });

    // Queued/active floating text is map-scoped (positions reference nodes on the map being torn down) -
    // the icon texture cache is not, and persists below.
    this.pendingGatherVfxByNode.clear();
    this.lastFloatingTextSpawnAtByNode.clear();
    this.lastNodeStatusUpdateAt = 0;
    this.pendingFloatingTextTextureLoads.clear();
    this.activeFloatingTexts = [];
    this.activeNodeReveals = [];
    this.nodeSparkles.clear();
    this.nodeAnimations = [];

    this.app = undefined;
    this.map = undefined;
    this.mapContainer = undefined;
    this.backdropUpdate = undefined;
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

  private async initPixi(map: TiledMap, mapName: string): Promise<void> {
    const element = this.pixiContainer()?.nativeElement;
    if (!element) return;

    this.map = map;
    this.partyGlide = defaultTravelGlideState(worldCurrentLocationState());
    mapNodeDeselect();

    this.app = await pixiAppInitialize(element, {
      width: element.clientWidth,
      height: element.clientHeight,
      antialias: false,
    });
    // The mapZoom/FPS effects can't apply these themselves - `this.app` didn't exist when they last ran.
    this.app.stage.scale.set(getOption('mapZoom'));
    this.app.ticker.maxFPS = pixiMapMaxFps();
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
      mapName,
      textures,
      (object, clickCount) => this.onNodeClick(object, clickCount),
      (object) => this.resolveNodeLabel(object),
      (object) => this.resolveNodeStatus(object),
    );
    this.mapContainer.addChild(renderedMap.container);
    this.nodeLabels = renderedMap.nodeLabels;
    containers.nodeLabelLayer.attach(
      ...renderedMap.nodeLabels.values(),
      ...renderedMap.nodeStatusIcons.values(),
    );
    this.nodeWrappers = renderedMap.nodeWrappers;
    this.nodeStatusIcons = renderedMap.nodeStatusIcons;
    this.nodeAnimations = pixiNodeAnimationsCreate(
      renderedMap.nodeWrappers,
      textures,
    );

    const backdrop = pixiBackdropShardsCreate(map, mapName, textures);
    if (backdrop) containers.backdropContainer.addChild(backdrop.container);
    this.backdropUpdate = backdrop?.update;
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
    this.mapCursorIndicator = pixiIndicatorMapCursorCreate(map.tilewidth);
    this.nodeSelectionContainer.addChild(this.mapCursorIndicator);

    this.gatherProgressBar = pixiIndicatorProgressBarCreate(
      map.tilewidth,
      'Gather',
    );
    this.gatherProgressContainer.addChild(this.gatherProgressBar.container);

    this.encounterProgressBar = pixiIndicatorProgressBarCreate(
      map.tilewidth,
      'Explore',
    );
    this.encounterProgressContainer.addChild(
      this.encounterProgressBar.container,
    );

    if (this.partyTokenJobKey !== this.currentPartyJobKey()) {
      await this.reloadPartyTokenTextures();
    }

    this.isShowingAtLocationIndicator = isPlayerAtLocation();
    this.setupPlayerIndicator();

    this.visualPositionTicker = () => {
      this.checkForMapChange(worldCurrentLocationState().mapName);
      this.checkForDeathsDoorRecall();
      this.checkForPartyJobChange();
      this.updateVisualPosition();
      // Ahead of updatePlayerIndicatorIfNeeded() so a fresh arrival's catch-up state exists the same frame the indicator-swap check reads it.
      this.advancePartyFollowerPositions();
      this.updatePlayerIndicatorIfNeeded();
      this.updateGatherProgressIndicator();
      this.updateEncounterProgressIndicator();
      this.maybeUpdateNodeStatus(performance.now());
      this.updateMapCursor(performance.now());
      this.positionCamera();
      this.updateBackdrop();
      this.renderPartyFollowerIndicators();
      this.updateWorkerIndicators();
      this.updateFloatingTexts();
      this.updateNodeReveals();
      this.updateNodeSparkles();
      this.updateNodeAnimations();
    };
    this.app.ticker.add(this.visualPositionTicker);

    this.positionCamera();
  }

  private onNodeClick(object: TiledObject, clickCount: number): void {
    this.selectNode(object.name, clickCount);
  }

  private selectNode(nodeName: string, clickCount: number): void {
    const entry = worldNodeByName(nodeName);
    if (!entry) return;
    if (!isWorldNodeCollectibleGateMet(entry)) return;

    worldNodeDiscoverIfHidden(entry);
    mapNodeSelect(entry);

    if (clickCount === 2 && travelCanStartTo(entry))
      travelStart(entry.nodeName);
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

      if (worldNodeDiscoverIfCollectibleGateMet(entry) && this.map) {
        this.activeNodeReveals.push({
          update: pixiNodeRevealCreate(wrapper, this.map.tilewidth),
          spawnedAt: performance.now(),
        });
      }

      const unlocked = isWorldNodeCollectibleGateMet(entry);
      const forgotten = isWorldNodeForgotten(entry);
      wrapper.visible = unlocked || forgotten;
      wrapper.eventMode = unlocked ? 'static' : 'none';
      pixiNodeForgottenSet(wrapper, forgotten);
      this.setNodeSparklesVisible(
        wrapper,
        nodeName,
        isWorldNodeUncleared(entry),
      );
    });
  }

  private setNodeSparklesVisible(
    wrapper: Container,
    nodeName: string,
    visible: boolean,
  ): void {
    const existing = this.nodeSparkles.get(nodeName);
    if (existing) {
      existing.container.visible = visible;
      return;
    }

    if (!visible) return;
    this.nodeSparkles.set(
      nodeName,
      pixiNodeSparklesCreate(wrapper, this.nodeSparkles.size + 1),
    );
  }

  private resolveNodeLabel(
    object: TiledObject,
  ): WorldNodeLabelInfo | undefined {
    const entry = worldNodeByName(object.name);
    return entry ? worldNodeLabelInfo(entry) : undefined;
  }

  private resolveNodeStatus(
    object: TiledObject,
  ): WorldNodeStatusInfo | undefined {
    const entry = worldNodeByName(object.name);
    return entry ? worldNodeStatusInfo(entry) : undefined;
  }

  // Catches countdown text, hidden-node discovery, and difficulty shifts as the party levels.
  private updateNodeLabels(): void {
    if (!this.nodeLabels) return;

    const fontFamily = uiTextFontFamily();
    const letterSpacing = uiTextLetterSpacing();
    this.nodeLabels.forEach((label, nodeName) => {
      const entry = worldNodeByName(nodeName);
      if (!entry) return;

      const visible = isWorldNodeVisible(entry);
      label.visible = visible;
      if (label.parent) label.parent.cursor = visible ? 'pointer' : 'default';
      if (!visible) return;

      const info = worldNodeLabelInfo(entry);
      if (!info) return;

      label.text = info.text;
      label.style.fill = pixiNodeLabelColor(info);
      // Guarded since every style write re-renders the label texture.
      if (label.style.fontFamily !== fontFamily) {
        label.style.fontFamily = fontFamily;
        label.style.letterSpacing = letterSpacing;
      }
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

      const info = worldNodeStatusInfo(entry);
      if (info) pixiIndicatorNodeStatusUpdate(icon, info.badge);
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

    // Anchor only on the first off-center move of this gesture; later deltas accumulate against the same frozen anchor.
    this.frozenCameraBase ??= this.cameraPositionFor(this.partyGlide.visual);

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

  // Homes on the party, not the view center: the camera clamps at map edges, so they can differ.
  private recenterOnParty(): void {
    const { x, y } = this.partyGlide.visual;
    this.mapCursor = { x, y };
    this.recenterCamera();
  }

  public recenterCamera(): void {
    this.cameraOffset.set({ x: 0, y: 0 });
    this.frozenCameraBase = undefined;
    this.positionCamera();
  }

  private focusCamera(target: CameraPosition): void {
    if (!this.map) return;

    const base = this.cameraPositionFor(this.partyGlide.visual);
    const focus = this.cameraPositionFor(target);
    // A zero offset reads as unpanned, so a frozen base would pin the camera with no recenter button.
    if (focus.x === base.x && focus.y === base.y) {
      this.recenterCamera();
      return;
    }

    this.frozenCameraBase = base;
    this.cameraOffset.set({ x: focus.x - base.x, y: focus.y - base.y });
    this.positionCamera();
  }

  private cameraPositionFor(tile: CameraPosition): CameraPosition {
    return cameraPositionCalculate(
      tile.x,
      tile.y,
      this.viewportTiles.widthTiles,
      this.viewportTiles.heightTiles,
      this.cameraBounds,
    );
  }

  // One entry per party slot, so a class change or roster change both invalidate the cached textures.
  private currentPartyJobKey(): string {
    return worldPartyState()
      .map((hero) => hero.jobId)
      .join('|');
  }

  private async reloadPartyTokenTextures(): Promise<void> {
    const jobKey = this.currentPartyJobKey();
    const textures = await Promise.all(
      worldPartyState().map((_, index) => this.loadPartyTokenTextures(index)),
    );
    this.partyTokenTexturesByIndex = textures;
    this.partyTokenJobKey = jobKey;
  }

  // Polled from the Pixi ticker (like map changes) since zoneless CD isn't guaranteed to wake for state changes.
  private checkForPartyJobChange(): void {
    // transitionToMap() does its own reload, so leave it alone mid-transition.
    if (this.isReloadingPartyTextures || this.isTransitioningMap) return;
    if (this.partyTokenJobKey === this.currentPartyJobKey()) return;

    this.isReloadingPartyTextures = true;
    void this.reloadPartyTokenTextures()
      .then(() => this.setupPlayerIndicator())
      .finally(() => {
        this.isReloadingPartyTextures = false;
      });
  }

  private async loadPartyTokenTextures(heroIndex: number): Promise<Texture[]> {
    const hero = worldPartyState()[heroIndex];
    if (!hero) return [];

    const job = getEntry<JobContent>(hero.jobId);
    if (!job) return [];

    const frame =
      this.contentService.artAtlases()?.['job']?.[
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
    this.partyFollowerTokens.forEach((token) =>
      token.destroy({ children: true }),
    );
    this.partyFollowerContainer.removeChildren();
    this.partyFollowerTokens = [];
    this.followerOffsets = [];

    if (this.isShowingAtLocationIndicator) return;

    const followerCount = Math.max(worldPartyState().length - 1, 0);
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
      this.partyGlide.visual,
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
          ) ?? this.partyGlide.visual;
        this.followerRenderedPosition[index] = partyFollowerJitterPosition(
          sampled,
          offset,
        );
        continue;
      }

      const target = partyFollowerJitterPosition(
        this.partyGlide.visual,
        offset,
      );
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
    const target = worldCurrentLocationState();
    return (
      this.partyGlide.visual.mapName === target.mapName &&
      Math.abs(this.partyGlide.visual.x - target.x) < 0.001 &&
      Math.abs(this.partyGlide.visual.y - target.y) < 0.001
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

    const combat = worldCombatState();
    const entry = combat ? worldNodeByName(combat.locationName) : undefined;
    const total = entry ? worldNodeEncounterCount(entry) : undefined;

    const active =
      !!combat && !!total && total > 0 && this.isVisuallyAtTarget();
    this.encounterProgressBar.container.visible = active;
    if (active && combat && total) {
      this.encounterProgressBar.update((combat.fightIndex ?? 0) / total);
    }
  }

  // Map changes are handled separately (with a fade), so a mismatched map name here just snaps.
  private updateVisualPosition(): void {
    if (!this.map) return;

    const travel = worldTravelState();
    this.partyGlide = travelGlideAdvance(
      this.partyGlide,
      worldCurrentLocationState(),
      travel.status === 'Traveling' ? travel.path : [],
      travel.ticksIntoStep,
      performance.now(),
      getOption('debugTickMultiplier'),
    );
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

    const location = this.partyGlide.visual;
    const bounds = this.cameraBounds;
    const offset = this.cameraOffset();

    // Stay anchored while panned, so party movement doesn't drag the view.
    const base = this.frozenCameraBase ?? this.cameraPositionFor(location);

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
    this.positionMapCursorIndicator(camera);
    this.lastCamera = camera;
  }

  private updateBackdrop(): void {
    if (!this.backdropUpdate || !this.app || !this.map) return;

    const zoom = this.app.stage.scale.x;
    this.backdropUpdate(
      performance.now(),
      {
        x: this.lastCamera.x * this.map.tilewidth,
        y: this.lastCamera.y * this.map.tileheight,
      },
      this.app.screen.width / zoom,
      this.app.screen.height / zoom,
    );
  }

  // Directions and A drive the map cursor only while nothing (modal, menu, popup) sits over the map.
  private isMapCursorDriving(): boolean {
    return (
      this.ffInput.mode() === 'gamepad' &&
      gamePlayView() === 'world' &&
      !!this.map &&
      !this.isMapLoading() &&
      !modalHasAnyOpen() &&
      this.isMapInTopScope()
    );
  }

  private isMapInTopScope(): boolean {
    const element = this.pixiContainer()?.nativeElement;
    return !!element && this.ffInput.isElementActive(element);
  }

  private registerMapCursorActions(): (() => void)[] {
    const element = this.pixiContainer()?.nativeElement;
    const options = {
      element,
      priority: GAMEPAD_PRIORITY.pageMode,
      enabled: () => this.isMapCursorDriving(),
    };
    return [
      ...FF_DIRECTIONS.map((direction) =>
        this.ffInput.register(direction, () => this.jumpMapCursor(direction), {
          ...options,
          label: 'Move',
        }),
      ),
      // Selecting only; on the already-selected node A falls through to the panel's Travel.
      this.ffInput.register('confirm', () => this.selectMapCursorTarget(), {
        ...options,
        enabled: () =>
          this.isMapCursorDriving() &&
          this.mapCursorAt?.name !== selectedMapNode()?.nodeName,
        label: () => (this.mapCursorAt ? 'Select' : ''),
      }),
      // Below the panel's buttons: an A with nothing to do mustn't click whichever HUD button holds focus.
      this.ffInput.register('confirm', () => undefined, {
        ...options,
        priority: GAMEPAD_PRIORITY.global,
      }),
    ];
  }

  // L3 steps the D-pad through the non-empty HUD zones and back to the map cursor; B returns to the map.
  private registerHudActions(): (() => void)[] {
    const inHud = {
      priority: GAMEPAD_PRIORITY.pageMode,
      enabled: () => this.hudMode() && this.canToggleHud(),
    };
    return [
      // Above the node panel's own pad buttons, so A presses what's focused rather than Travel.
      this.ffInput.register('confirm', () => this.clickFocusedHudElement(), {
        ...inHud,
        label: 'Select',
      }),
      ...(['context', 'details'] as const).map((action) =>
        this.ffInput.register(action, () => undefined, inHud),
      ),
      this.ffInput.register('zone', () => this.setHudZone(this.nextHudZone()), {
        priority: GAMEPAD_PRIORITY.pageMode,
        enabled: () =>
          this.canToggleHud() && (this.hudMode() || !!this.nextHudZone()),
        label: () => {
          const next = this.nextHudZone();
          return next ? HUD_ZONE_LABELS[next] : 'Map';
        },
      }),
      this.ffInput.register('back', () => this.setHudZone(undefined), {
        priority: GAMEPAD_PRIORITY.pageMode,
        enabled: () => this.hudMode() && this.canToggleHud(),
        label: 'Map',
      }),
    ];
  }

  // Only from whichever of the two holds the top focus scope, so a dialog over either keeps L3.
  private canToggleHud(): boolean {
    if (this.ffInput.mode() !== 'gamepad' || gamePlayView() !== 'world') {
      return false;
    }

    const zone = this.hudZone();
    const element = zone ? this.hudZoneElement(zone) : undefined;
    return zone
      ? !!element && this.ffInput.isElementActive(element)
      : this.isMapCursorDriving();
  }

  private hudZoneElement(zone: HudZone): HTMLElement | undefined {
    const zones = {
      buffs: this.buffsZone,
      bubbles: this.bubblesZone,
      tasks: this.tasksZone,
      panel: this.panelZone,
    };
    return zones[zone]()?.nativeElement;
  }

  private nextHudZone(): HudZone | undefined {
    const current = this.hudZone();
    const after = current
      ? HUD_ZONES.slice(HUD_ZONES.indexOf(current) + 1)
      : HUD_ZONES;
    return after.find((zone) => {
      const element = this.hudZoneElement(zone);
      return !!element && this.focus.hasLanding(element);
    });
  }

  private clickFocusedHudElement(): void {
    const active = document.activeElement;
    const hud = this.hudFrame()?.nativeElement;
    if (active instanceof HTMLElement && hud?.contains(active)) active.click();
  }

  private setHudZone(zone?: HudZone): void {
    this.hudZone.set(zone);
    const element = zone ? this.hudZoneElement(zone) : undefined;
    if (element) {
      this.focus.focusLanding(element);
      return;
    }

    const active = document.activeElement;
    const hud = this.hudFrame()?.nativeElement;
    if (active instanceof HTMLElement && hud?.contains(active)) active.blur();
  }

  // Over empty ground A does nothing, rather than travelling to a node that may be off-screen.
  private selectMapCursorTarget(): void {
    if (this.mapCursorAt) this.selectNode(this.mapCursorAt.name, 1);
  }

  // Where the camera is looking, so the cursor starts on screen after mouse use.
  private mapViewCenter(): CameraPosition {
    return {
      x: this.lastCamera.x + this.viewportTiles.widthTiles / 2,
      y: this.lastCamera.y + this.viewportTiles.heightTiles / 2,
    };
  }

  private mapCursorNodes(): MapCursorNode[] {
    return [...(this.nodeWrappers ?? [])]
      .filter(
        ([, wrapper]) => wrapper.visible && wrapper.eventMode === 'static',
      )
      .map(([name]) => worldNodeByName(name))
      .filter((entry) => !!entry)
      .map((entry) => ({
        name: entry.nodeName,
        x: entry.x,
        y: entry.y,
        reachTiles: isWorldNodeVisible(entry)
          ? undefined
          : MAP_CURSOR_SECRET_REACH_TILES,
      }));
  }

  private updateMapCursor(now: number): void {
    const deltaMs = Math.min(
      now - this.mapCursorFrameAt,
      MAP_CURSOR_MAX_FRAME_MS,
    );
    this.mapCursorFrameAt = now;
    const driving = this.isMapCursorDriving();
    this.claimLeftStick(driving);
    if (!driving) {
      if (this.ffInput.mode() !== 'gamepad') this.mapCursor = undefined;
      return;
    }

    const cursor = this.mapCursor ?? this.mapViewCenter();
    const stick = this.ffInput.leftStick();
    const moving = stick.x !== 0 || stick.y !== 0;
    this.mapCursor =
      moving && this.map
        ? mapCursorMove(cursor, stick, deltaMs, MAP_CURSOR_TILES_PER_SECOND, {
            x: this.map.width,
            y: this.map.height,
          })
        : cursor;
    this.mapCursorAt = mapCursorTarget(
      this.mapCursor,
      this.mapCursorNodes(),
      MAP_CURSOR_REACH_TILES,
    );
    if (moving) this.focusCamera(this.mapCursor);
  }

  private claimLeftStick(claim: boolean): void {
    if (claim && !this.releaseLeftStick) {
      this.releaseLeftStick = this.ffInput.claimLeftStick();
    } else if (!claim && this.releaseLeftStick) {
      this.releaseLeftStick();
      this.releaseLeftStick = undefined;
    }
  }

  private jumpMapCursor(direction: FFDirection): void {
    if (!this.map) return;

    const from = this.mapCursorAt ?? this.mapCursor;
    if (!from) return;

    // Secrets are skipped, or hopping would reveal them; they're only found by aiming the stick.
    const revealed = this.mapCursorNodes().filter(
      (node) => node.reachTiles === undefined,
    );
    const next = mapCursorJump(from, revealed, direction, this.map.tilewidth);
    if (!next) return;

    this.mapCursor = { x: next.x, y: next.y };
    this.mapCursorAt = next;
    this.focusCamera(this.mapCursor);
  }

  // Snaps onto the targeted node, so it's clear what A will pick.
  private positionMapCursorIndicator(camera: CameraPosition): void {
    if (!this.mapCursorIndicator || !this.map) return;

    const at = this.mapCursorAt ?? this.mapCursor;
    this.mapCursorIndicator.visible = !!at && this.isMapCursorDriving();
    if (!at) return;

    const screenPosition = tileToScreenPosition(
      at.x,
      at.y,
      camera,
      this.map.tilewidth,
      this.map.tileheight,
    );
    this.mapCursorIndicator.position.set(screenPosition.x, screenPosition.y);
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

    const tokens = this.travelingWorkerTokens().filter(
      (token) => token.location.mapName === this.loadedMapName,
    );
    const activeKeys = new Set(tokens.map((token) => token.key));

    for (const [key, token] of this.workerTokens) {
      if (activeKeys.has(key)) continue;

      token.destroy({ children: true });
      this.workerTokens.delete(key);
      this.workerGlideStates.delete(key);
    }

    const now = performance.now();
    const speedMultiplier = getOption('debugTickMultiplier');

    tokens.forEach((token) => {
      if (
        !this.workerTokens.has(token.key) &&
        !this.pendingWorkerTextureLoads.has(token.workerId)
      ) {
        this.createWorkerSprite(token.key, token.workerId, token.location);
      }

      const glide = this.workerGlideStates.get(token.key);
      const workerToken = this.workerTokens.get(token.key);
      if (!glide || !workerToken || !this.map) return;

      const nextGlide = travelGlideAdvance(
        glide,
        token.location,
        token.path,
        token.ticksIntoStep,
        now,
        speedMultiplier,
      );
      this.workerGlideStates.set(token.key, nextGlide);

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
    key: string,
    workerId: WorkerId,
    initialLocation: CurrentLocation,
  ): void {
    this.pendingWorkerTextureLoads.add(workerId);

    void this.resolveWorkerTokenTextures(workerId).then((textures) => {
      this.pendingWorkerTextureLoads.delete(workerId);

      // Worker/map state may have changed while textures were loading - re-check first.
      if (!this.workerIndicatorContainer || !this.map) return;
      if (this.workerTokens.has(key)) return;

      const sprite = pixiIndicatorPlayerSpriteCreate(
        this.map.tilewidth,
        textures,
      );
      // A per-worker container, positioned at the tile's screen corner, so the sprite/graphics
      // child's own centering offset applies unmodified.
      const token = new Container();
      token.addChild(sprite);
      this.workerIndicatorContainer.addChild(token);
      this.workerTokens.set(key, token);
      this.workerGlideStates.set(key, defaultTravelGlideState(initialLocation));
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

  private updateNodeReveals(): void {
    if (this.activeNodeReveals.length === 0) return;

    const now = performance.now();
    this.activeNodeReveals = this.activeNodeReveals.filter((reveal) =>
      reveal.update(now - reveal.spawnedAt),
    );
  }

  private updateNodeSparkles(): void {
    const now = performance.now();
    this.nodeSparkles.forEach((sparkles) => {
      if (sparkles.container.visible) sparkles.update(now);
    });
  }

  private updateNodeAnimations(): void {
    const now = performance.now();
    this.nodeAnimations.forEach((update) => update(now));
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

  public viewEdicts() {
    setGamePlayView('kingdom');
    kingdomSubview.set('edicts');
  }
}
