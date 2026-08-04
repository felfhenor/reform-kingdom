import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
} from '@angular/core';
import { ButtonCloseComponent } from '@components/button-close/button-close.component';
import { GatherMaterialSlotComponent } from '@components/gather-material-slot/gather-material-slot.component';
import { SFXDirective } from '@directives/sfx.directive';
import {
  canEnterGatherNode,
  canPartyTravel,
  gamestate,
  gatheringProgressFraction,
  getMap,
  mapNodeDeselect,
  selectedMapNode,
  TICKS_PER_STEP_MOVE,
  tiledObjectSpriteFrame,
  travelPathTo,
  travelStart,
  worldNodeDescription,
  worldNodeEncounterCount,
  worldNodeGatherMaterialIds,
  worldNodeGatherTime,
  worldNodeLevelLabel,
  worldNodeLevelRange,
  worldNodeMonsterCount,
} from '@helpers';
import type { TiledMap } from '@interfaces';

@Component({
  selector: 'app-map-node-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonCloseComponent, GatherMaterialSlotComponent, SFXDirective],
  templateUrl: './map-node-panel.component.html',
  styleUrl: './map-node-panel.component.scss',
  host: {
    '(document:pointerdown)': 'onDocumentPointerDown($event)',
  },
})
export class MapNodePanelComponent {
  private elementRef = inject(ElementRef<HTMLElement>);

  public node = computed(() => selectedMapNode());

  public spriteFrame = computed(() => {
    const entry = this.node();
    if (!entry) return undefined;

    const map = getMap(entry.mapName)?.data as TiledMap | undefined;
    if (!map) return undefined;

    return tiledObjectSpriteFrame(map, entry.nodeData);
  });

  public levelLabel = computed(() => {
    const entry = this.node();
    const levelRange = entry ? worldNodeLevelRange(entry) : undefined;
    return levelRange ? worldNodeLevelLabel(levelRange) : '—';
  });

  public encounterCount = computed(() => {
    const entry = this.node();
    return entry ? worldNodeEncounterCount(entry) : undefined;
  });

  public monsterCount = computed(() => {
    const entry = this.node();
    return entry ? worldNodeMonsterCount(entry) : undefined;
  });

  public description = computed(() => {
    const entry = this.node();
    return entry ? worldNodeDescription(entry) : undefined;
  });

  public gatherTime = computed(() => {
    const entry = this.node();
    return entry ? worldNodeGatherTime(entry) : undefined;
  });

  public gatherMaterialIds = computed(() => {
    const entry = this.node();
    return entry ? worldNodeGatherMaterialIds(entry) : [];
  });

  public meetsGatherLevelRequirement = computed(() => {
    const entry = this.node();
    return !entry || canEnterGatherNode(entry.nodeName);
  });

  public isGatheringHere = computed(() => {
    const entry = this.node();
    const gathering = gamestate().world.gathering;
    return (
      !!entry &&
      gathering.status === 'Gathering' &&
      gathering.nodeName === entry.nodeName
    );
  });

  public gatherProgressPercent = computed(() =>
    Math.round(gatheringProgressFraction() * 100),
  );

  private travelPath = computed(() => {
    const entry = this.node();
    return entry ? travelPathTo(entry.nodeName) : undefined;
  });

  public travelSeconds = computed(() => {
    const path = this.travelPath();
    if (!path) return undefined;

    return (
      path.filter((step) => step.kind === 'Move').length * TICKS_PER_STEP_MOVE
    );
  });

  private travelState = computed(() => gamestate().world.travel);

  public isAtNode = computed(
    () => this.travelPath()?.length === 0 && this.travelState().status === 'Idle',
  );

  public canTravelHere = computed(() => {
    const entry = this.node();
    const path = this.travelPath();
    const travel = this.travelState();
    const isCurrentDestination =
      travel.status === 'Traveling' &&
      travel.destinationNodeName === entry?.nodeName;

    return (
      !!path &&
      (path.length > 0 || travel.status === 'Traveling') &&
      !isCurrentDestination &&
      canPartyTravel() &&
      this.meetsGatherLevelRequirement()
    );
  });

  public travel(): void {
    const entry = this.node();
    if (!entry) return;

    if (travelStart(entry.nodeName)) {
      this.close();
    }
  }

  public close(): void {
    mapNodeDeselect();
  }

  protected onDocumentPointerDown(event: PointerEvent): void {
    if (!this.node()) return;

    const target = event.target;
    if (!(target instanceof Node)) return;
    if (target instanceof HTMLCanvasElement) return;
    if (this.elementRef.nativeElement.contains(target)) return;

    mapNodeDeselect();
  }
}
