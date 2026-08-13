import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
} from '@angular/core';
import { ButtonCloseComponent } from '@components/button-close/button-close.component';
import { SlotCompletionRewardComponent } from '@components/slot-completion-reward/slot-completion-reward.component';
import { SlotGatherMaterialComponent } from '@components/slot-gather-material/slot-gather-material.component';
import { PanelMapNodeActionsCaravanComponent } from '@components/panel-map-node-actions-caravan/panel-map-node-actions-caravan.component';
import { PanelMapNodeActionsExploreComponent } from '@components/panel-map-node-actions-explore/panel-map-node-actions-explore.component';
import { PanelMapNodeActionsGatherComponent } from '@components/panel-map-node-actions-gather/panel-map-node-actions-gather.component';
import { PanelMapNodeBadgesCaravanComponent } from '@components/panel-map-node-badges-caravan/panel-map-node-badges-caravan.component';
import { PanelMapNodeBadgesExploreComponent } from '@components/panel-map-node-badges-explore/panel-map-node-badges-explore.component';
import { PanelMapNodeBadgesGatherComponent } from '@components/panel-map-node-badges-gather/panel-map-node-badges-gather.component';
import { SpriteNodeComponent } from '@components/sprite-node/sprite-node.component';
import { SFXDirective } from '@directives/sfx.directive';
import { sortBy } from 'es-toolkit/compat';
import {
  canEnterGatherNode,
  canPartyTravel,
  caravanBrandName,
  caravanTradeOpen,
  encounterRandomStartFight,
  encounterStartFight,
  gamestate,
  gatheringProgressFraction,
  mapNodeDeselect,
  rewardDisplayOrder,
  selectedMapNode,
  TICKS_PER_STEP_MOVE,
  travelPathTo,
  travelStart,
  worldNodeCompletionRewards,
  worldNodeCaravan,
  worldNodeCaravanIsAvailable,
  worldNodeDescription,
  worldNodeEncounter,
  worldNodeEncounterRandom,
  worldNodeExploreRandomIsAvailable,
  worldNodeGatherMaterialIds,
  worldNodeGathering,
  worldNodeLevelLabel,
  worldNodeLevelRange,
} from '@helpers';

@Component({
  selector: 'app-panel-map-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonCloseComponent,
    SlotCompletionRewardComponent,
    SlotGatherMaterialComponent,
    PanelMapNodeActionsCaravanComponent,
    PanelMapNodeActionsExploreComponent,
    PanelMapNodeActionsGatherComponent,
    PanelMapNodeBadgesCaravanComponent,
    PanelMapNodeBadgesExploreComponent,
    PanelMapNodeBadgesGatherComponent,
    SpriteNodeComponent,
    SFXDirective,
  ],
  templateUrl: './panel-map-node.component.html',
  styleUrl: './panel-map-node.component.scss',
  host: {
    '(document:pointerdown)': 'onDocumentPointerDown($event)',
  },
})
export class PanelMapNodeComponent {
  private elementRef = inject(ElementRef<HTMLElement>);

  public node = computed(() => selectedMapNode());

  public displayName = computed(() => {
    const entry = this.node();
    if (!entry) return '';

    return this.isCaravanNode() ? caravanBrandName(entry.nodeName) : entry.nodeName;
  });

  public levelLabel = computed(() => {
    const entry = this.node();
    const levelRange = entry ? worldNodeLevelRange(entry) : undefined;
    return levelRange ? worldNodeLevelLabel(levelRange) : '-';
  });

  public description = computed(() => {
    const entry = this.node();
    return entry ? worldNodeDescription(entry) : undefined;
  });

  public gatherMaterialIds = computed(() => {
    const entry = this.node();
    return entry ? worldNodeGatherMaterialIds(entry) : [];
  });

  public completionRewards = computed(() => {
    const entry = this.node();
    if (!entry) return [];

    return sortBy(worldNodeCompletionRewards(entry), [rewardDisplayOrder]);
  });

  public meetsGatherLevelRequirement = computed(() => {
    const entry = this.node();
    return !entry || canEnterGatherNode(entry.nodeName);
  });

  public isCaravanNode = computed(() => {
    const entry = this.node();
    return !!entry && !!worldNodeCaravan(entry);
  });

  public isGatherNode = computed(() => {
    const entry = this.node();
    return !!entry && !!worldNodeGathering(entry);
  });

  public isExploreNode = computed(() => {
    const entry = this.node();
    return (
      !!entry &&
      (!!worldNodeEncounter(entry) || !!worldNodeEncounterRandom(entry))
    );
  });

  public meetsCaravanAvailability = computed(() => {
    const entry = this.node();
    if (!entry || !worldNodeCaravan(entry)) return true;

    return worldNodeCaravanIsAvailable(entry);
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
    () =>
      this.travelPath()?.length === 0 && this.travelState().status === 'Idle',
  );

  private isInCombat = computed(() => !!gamestate().world.combat);

  public canReExplore = computed(() => {
    const entry = this.node();
    if (!entry || !this.isAtNode() || this.isInCombat()) return false;

    if (worldNodeEncounter(entry)) return true;

    return (
      !!worldNodeEncounterRandom(entry) && worldNodeExploreRandomIsAvailable(entry)
    );
  });

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
      this.meetsGatherLevelRequirement() &&
      this.meetsCaravanAvailability()
    );
  });

  public travel(): void {
    const entry = this.node();
    if (!entry) return;

    if (travelStart(entry.nodeName)) {
      this.close();
    }
  }

  public reExplore(): void {
    const entry = this.node();
    if (!entry) return;

    const encounter = worldNodeEncounter(entry);
    if (encounter) {
      encounterStartFight(encounter.id, 0, entry.nodeName);
      return;
    }

    if (worldNodeEncounterRandom(entry)) {
      encounterRandomStartFight(entry, 0);
    }
  }

  public openTrade(): void {
    const entry = this.node();
    if (!entry) return;

    caravanTradeOpen(entry);
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
